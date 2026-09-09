import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createListAssignedEvaluationsHandler,
  createMarkAssignedEvaluationOpenedHandler,
} from "../../app/api/training-plan/assigned-evaluations/route";
import type { TrainingFormsService } from "../../app/lib/trainingForms/service";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

/**
 * The rule these cover: what a supervisor may see and stamp is decided by the durable employee key
 * on their own session, never by anything the request carries. An account with no employee link has
 * no key to match assignments against, so it must get nothing rather than a match on null.
 */

const base: AuthenticatedPrincipal = {
  userId: "1",
  username: "head.test",
  role: "EMPLOYEE",
  employeeId: "101",
  employeeUserId: "USER-101",
  companyId: "1",
  email: null,
  employeeCode: "E101",
  displayName: "Head Test",
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
    listAssignedEvaluations: vi.fn().mockResolvedValue([]),
    markAssignedEvaluationOpened: vi.fn().mockResolvedValue({ opened: true }),
  }) as unknown as TrainingFormsService;

const get = () =>
  new NextRequest("http://localhost/api/training-plan/assigned-evaluations", {
    headers: { cookie: "tpm_session=valid-token" },
  });

const post = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/training-plan/assigned-evaluations", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { cookie: "tpm_session=valid-token", "content-type": "application/json" },
  });

describe("assigned evaluations", () => {
  it("lists by the caller's own durable key", async () => {
    const service = createService();
    const handler = createListAssignedEvaluationsHandler({ service, auth: auth(base) });

    const response = await handler(get());

    expect(response.status).toBe(200);
    expect(vi.mocked(service.listAssignedEvaluations)).toHaveBeenCalledWith("USER-101");
  });

  it("returns nothing for an account with no employee link, rather than querying on null", async () => {
    const service = createService();
    const handler = createListAssignedEvaluationsHandler({
      service,
      auth: auth({ ...base, employeeUserId: null }),
    });

    const response = await handler(get());

    expect(response.status).toBe(200);
    expect(vi.mocked(service.listAssignedEvaluations)).not.toHaveBeenCalled();
  });

  it("stamps the open against the caller, not against anything the body could claim", async () => {
    const service = createService();
    const handler = createMarkAssignedEvaluationOpenedHandler({ service, auth: auth(base) });

    const response = await handler(post({ enrollmentId: "7", reviewerUserId: "USER-999" }));

    expect(response.status).toBe(200);
    expect(vi.mocked(service.markAssignedEvaluationOpened)).toHaveBeenCalledWith("7", "USER-101");
  });

  it("refuses an enrollment id that is not a positive identifier", async () => {
    const service = createService();
    const handler = createMarkAssignedEvaluationOpenedHandler({ service, auth: auth(base) });

    const response = await handler(post({ enrollmentId: "0" }));

    expect(response.status).toBe(400);
    expect(vi.mocked(service.markAssignedEvaluationOpened)).not.toHaveBeenCalled();
  });
});
