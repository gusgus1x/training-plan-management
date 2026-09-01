import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createCreateEnrollmentHandler } from "../../app/api/training-plan/enrollments/route";
import type { EnrollmentService } from "../../app/lib/trainingEnrollment/service";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

/**
 * Only HRD confirming the "not completed yet" prompt should set acknowledgePrerequisite. An
 * EMPLOYEE caller cannot wave their own condition through by sending it in the body - the route
 * must pin it to false regardless of what was sent, the same way it already pins the employee
 * identity keys (see create-scope.test.ts).
 */

const employee: AuthenticatedPrincipal = {
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

const hrdFactory: AuthenticatedPrincipal = {
  ...employee,
  userId: "2",
  role: "HRD_FACTORY",
  employeeId: null,
  employeeUserId: null,
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

describe("prerequisite override is pinned by role", () => {
  it("forces acknowledgePrerequisite to false for an EMPLOYEE caller, even if the body says true", async () => {
    const service = createService();
    const handler = createCreateEnrollmentHandler({ service, auth: auth(employee) });

    const response = await handler(
      post({ planId: "9", employeeId: "101", employeeUserId: null, source: "EMPLOYEE", acknowledgePrerequisite: true }),
    );

    expect(response.status).toBe(201);
    expect(inputOf(service).acknowledgePrerequisite).toBe(false);
  });

  it("defaults an EMPLOYEE caller to false when the body omits it", async () => {
    const service = createService();
    const handler = createCreateEnrollmentHandler({ service, auth: auth(employee) });

    await handler(post({ planId: "9", employeeId: "101", employeeUserId: null, source: "EMPLOYEE" }));

    expect(inputOf(service).acknowledgePrerequisite).toBe(false);
  });

  it("lets an HRD caller's acknowledgePrerequisite through unchanged", async () => {
    const service = createService();
    const handler = createCreateEnrollmentHandler({ service, auth: auth(hrdFactory) });

    await handler(
      post({ planId: "9", employeeId: "101", employeeUserId: null, source: "HRD_FACTORY", acknowledgePrerequisite: true }),
    );

    expect(inputOf(service).acknowledgePrerequisite).toBe(true);
  });
});
