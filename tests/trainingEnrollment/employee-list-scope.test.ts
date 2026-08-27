import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createListEnrollmentsHandler } from "../../app/api/training-plan/enrollments/route";
import { SESSION_COOKIE_NAME } from "../../app/lib/auth/session";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

// An EMPLOYEE listing enrollments must never see anyone else's. The filter used to be assigned
// straight from principal.employeeId, and a null there means "no filter" downstream — so an
// account with no employee link received the entire table. Every user_account.employee_user_id is
// NULL right now, which made that every EMPLOYEE login on this database.
const employee = (
  overrides: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal => ({
  userId: "42",
  username: "employee.test",
  role: "EMPLOYEE",
  employeeId: null,
  employeeUserId: null,
  companyId: "7",
  email: null,
  employeeCode: null,
  displayName: "Employee Test",
  companyCode: "ATA",
  companyName: "ATA Development Demo Company",
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
  ...overrides,
});

const listWith = async (principal: AuthenticatedPrincipal, query = "") => {
  const listEnrollments = vi.fn().mockResolvedValue([{ enrollmentId: "1" }]);
  const route = createListEnrollmentsHandler({
    auth: {
      verifyToken: () => ({
        version: 1,
        userId: principal.userId,
        issuedAt: 100,
        lastSeenAt: 200,
        bootId: "test-boot-id",
      }),
      revalidate: vi.fn().mockResolvedValue(principal),
      rollToken: () => "rolled-token",
      production: false,
    },
    service: { listEnrollments } as never,
  });

  const response = await route(
    new NextRequest(`http://localhost/api/training-plan/enrollments?${query}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=valid-token` },
    }),
    undefined,
  );

  return { body: await response.json(), listEnrollments, status: response.status };
};

describe("employee enrollment list stays scoped to the caller", () => {
  it("returns nothing for an account with no employee link instead of the whole table", async () => {
    const { body, listEnrollments, status } = await listWith(employee());

    expect(status).toBe(200);
    expect(body.data.enrollments).toEqual([]);
    expect(listEnrollments).not.toHaveBeenCalled();
  });

  it("forces the caller's own durable key, ignoring a spoofed query string", async () => {
    const { listEnrollments } = await listWith(
      employee({ employeeId: "101", employeeUserId: "12900012" }),
      "employeeUserId=99999999&employeeId=999",
    );

    expect(listEnrollments).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: "101", employeeUserId: "12900012" }),
      null,
    );
  });

  it("still scopes an account that only carries the surrogate key", async () => {
    const { listEnrollments } = await listWith(employee({ employeeId: "101" }));

    expect(listEnrollments).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: "101", employeeUserId: null }),
      null,
    );
  });

  it("leaves an HRD_CENTER listing unscoped", async () => {
    const { listEnrollments } = await listWith(
      employee({ role: "HRD_CENTER", employeeId: null, employeeUserId: null }),
    );

    expect(listEnrollments).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: null, employeeUserId: null }),
      null,
    );
  });
});
