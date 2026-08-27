import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createCreateNeedRequestHandler,
  createListNeedRequestsHandler,
} from "../../app/api/training-plan/need-requests/route";
import type { ProtectedRouteOptions } from "../../app/lib/auth/guard";
import { SESSION_COOKIE_NAME } from "../../app/lib/auth/session";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

const principalOf = (
  overrides: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal => ({
  userId: "42",
  username: "employee.test",
  role: "EMPLOYEE",
  employeeId: "4043",
  employeeUserId: "TEST0001",
  companyId: "1",
  email: null,
  employeeCode: null,
  displayName: "Test Trainee",
  companyCode: "ATA",
  companyName: "ATA",
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
  ...overrides,
});

const auth = (principal: AuthenticatedPrincipal): ProtectedRouteOptions => ({
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
});

const withSession = (url: string) =>
  new NextRequest(url, { headers: { cookie: `${SESSION_COOKIE_NAME}=valid-token` } });

const jsonRequest = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=valid-token`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("a training need request belongs to the employee who raised it", () => {
  it("forces the caller's own key onto the list, ignoring a spoofed query string", async () => {
    const listNeedRequests = vi.fn().mockResolvedValue([]);
    const route = createListNeedRequestsHandler({
      auth: auth(principalOf()),
      service: { listNeedRequests } as never,
    });

    await route(
      withSession("http://localhost/api/training-plan/need-requests?employeeUserId=99999999"),
      undefined,
    );

    expect(listNeedRequests).toHaveBeenCalledWith(
      expect.objectContaining({ employeeUserId: "TEST0001" }),
      null,
    );
  });

  it("returns nothing for an account with no employee link instead of every request", async () => {
    const listNeedRequests = vi.fn().mockResolvedValue([{ id: "1" }]);
    const route = createListNeedRequestsHandler({
      auth: auth(principalOf({ employeeUserId: null, employeeId: null })),
      service: { listNeedRequests } as never,
    });

    const response = await route(
      withSession("http://localhost/api/training-plan/need-requests"),
      undefined,
    );

    expect((await response.json()).data.needRequests).toEqual([]);
    expect(listNeedRequests).not.toHaveBeenCalled();
  });

  it("scopes a factory HRD to their own company and never to an employee", async () => {
    const listNeedRequests = vi.fn().mockResolvedValue([]);
    const route = createListNeedRequestsHandler({
      auth: auth(principalOf({ role: "HRD_FACTORY", companyId: "3" })),
      service: { listNeedRequests } as never,
    });

    await route(
      withSession("http://localhost/api/training-plan/need-requests"),
      undefined,
    );

    expect(listNeedRequests).toHaveBeenCalledWith(
      expect.objectContaining({ employeeUserId: null }),
      "3",
    );
  });

  it("files a new request against the signed-in employee, not against the body", async () => {
    const createNeedRequest = vi.fn().mockResolvedValue({ id: "1", requestNo: "REQ-2026-00001" });
    const route = createCreateNeedRequestHandler({
      auth: auth(principalOf()),
      service: { createNeedRequest } as never,
    });

    const response = await route(
      jsonRequest("http://localhost/api/training-plan/need-requests", {
        requestedCourseName: "Course",
        requestReason: "Reason",
        employeeUserId: "99999999",
      }),
      undefined,
    );

    expect(response.status).toBe(201);
    expect(createNeedRequest).toHaveBeenCalledWith(expect.anything(), "TEST0001");
  });

  it("refuses to file a request for an account with no employee record", async () => {
    const createNeedRequest = vi.fn();
    const route = createCreateNeedRequestHandler({
      auth: auth(principalOf({ employeeUserId: null })),
      service: { createNeedRequest } as never,
    });

    const response = await route(
      jsonRequest("http://localhost/api/training-plan/need-requests", {
        requestedCourseName: "Course",
        requestReason: "Reason",
      }),
      undefined,
    );

    expect(response.status).toBe(409);
    expect(createNeedRequest).not.toHaveBeenCalled();
  });

  it("does not let HRD raise a request on someone else's behalf", async () => {
    const createNeedRequest = vi.fn();
    const route = createCreateNeedRequestHandler({
      auth: auth(principalOf({ role: "HRD_CENTER" })),
      service: { createNeedRequest } as never,
    });

    const response = await route(
      jsonRequest("http://localhost/api/training-plan/need-requests", {
        requestedCourseName: "Course",
        requestReason: "Reason",
      }),
      undefined,
    );

    expect(response.status).toBe(403);
    expect(createNeedRequest).not.toHaveBeenCalled();
  });
});
