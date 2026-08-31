import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createCreateEnrollmentHandler } from "../../app/api/training-plan/enrollments/route";
import type { EnrollmentService } from "../../app/lib/trainingEnrollment/service";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

/**
 * The defect this covers: `requireEmployeeOwnership` accepts EITHER employee key as proof, but the
 * repository RESOLVES the row by `employeeUserId` first. An employee could therefore prove
 * themselves with their own `employeeId` while sending a colleague's `employeeUserId`, and the
 * colleague got enrolled. The route now pins both keys to the principal instead of trusting the
 * body, so what the client sends for either key cannot change who is enrolled.
 */

const base: AuthenticatedPrincipal = {
  userId: "1",
  username: "employee.test",
  role: "EMPLOYEE",
  employeeId: "101",
  employeeUserId: "USER-101",
  companyId: "1",
  email: null,
  employeeCode: "E101",
  displayName: "Employee Test",
  companyCode: "ATA",
  companyName: null,
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
};

const auth = (principal: AuthenticatedPrincipal) => ({
  verifyToken: () => ({
    version: 1 as const,
    userId: principal.userId,
    issuedAt: 100,
    lastSeenAt: 200,
    bootId: "test-boot-id",
  }),
  revalidate: vi.fn().mockResolvedValue(principal),
  rollToken: () => "rolled-token",
  production: false,
});

const createService = () =>
  ({
    createEnrollment: vi.fn().mockResolvedValue({ id: "1" }),
  }) as unknown as EnrollmentService;

const post = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/training-plan/enrollments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { cookie: "tpm_session=valid-token", "content-type": "application/json" },
  });

const inputOf = (service: EnrollmentService) =>
  vi.mocked(service.createEnrollment).mock.calls[0][0];

describe("enrollment creation scope", () => {
  it("enrolls the caller, not the employee named in the body", async () => {
    const service = createService();
    const handler = createCreateEnrollmentHandler({ service, auth: auth(base) });

    const response = await handler(
      // Own surrogate id (so the old guard passed) plus a colleague's durable key.
      post({ planId: "9", employeeId: "101", employeeUserId: "USER-999", source: "HRD_CENTER" }),
    );

    expect(response.status).toBe(201);
    const input = inputOf(service);
    expect(input.employeeUserId).toBe("USER-101");
    expect(input.employeeId).toBe("101");
    // The body also claimed a role it does not have.
    expect(input.source).toBe("EMPLOYEE");
  });

  it("lets an account carrying only the durable key enroll itself", async () => {
    // The Phase 20 direction: user_account.employee_id is NULL and the durable key is the link.
    // Before the fix this returned 403, because the guard was only ever given the surrogate id.
    const durableOnly = { ...base, employeeId: null };
    const service = createService();
    const handler = createCreateEnrollmentHandler({ service, auth: auth(durableOnly) });

    const response = await handler(
      post({ planId: "9", employeeId: "0", employeeUserId: "USER-101", source: "EMPLOYEE" }),
    );

    expect(response.status).toBe(201);
    expect(inputOf(service).employeeUserId).toBe("USER-101");
  });

  it("refuses an employee account linked to nobody", async () => {
    const unlinked = { ...base, employeeId: null, employeeUserId: null };
    const service = createService();
    const handler = createCreateEnrollmentHandler({ service, auth: auth(unlinked) });

    const response = await handler(
      post({ planId: "9", employeeId: "101", employeeUserId: "USER-101", source: "EMPLOYEE" }),
    );

    expect(response.status).toBe(403);
    expect(service.createEnrollment).not.toHaveBeenCalled();
  });
});
