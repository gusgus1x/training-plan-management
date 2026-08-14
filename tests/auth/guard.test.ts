import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { apiSuccess } from "../../app/lib/api/response";
import { createProtectedRoute } from "../../app/lib/auth/guard";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../app/lib/auth/session";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

const principal: AuthenticatedPrincipal = {
  userId: "42",
  username: "factory.test",
  role: "HRD_FACTORY",
  employeeId: null,
  companyId: "7",
  email: null,
  employeeCode: null,
  displayName: "Factory Test",
  companyCode: "ATA",
  companyName: "ATA Development Demo Company",
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
};

const requestWithSession = () =>
  new NextRequest("http://localhost/api/protected", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=valid-token` },
  });

describe("protected API route foundation", () => {
  it("uses the server session principal, enforces roles, and rolls the cookie", async () => {
    const handler = vi.fn(async (_request, authenticatedUser) =>
      apiSuccess({
        userId: authenticatedUser.userId,
        companyId: authenticatedUser.companyId,
      }),
    );
    const route = createProtectedRoute(handler, {
      allowedRoles: ["HRD_FACTORY"],
      verifyToken: () => ({
        version: 1,
        userId: "42",
        issuedAt: 100,
        lastSeenAt: 200,
      }),
      revalidate: vi.fn().mockResolvedValue(principal),
      rollToken: () => "rolled-token",
      production: false,
    });
    const request = requestWithSession();
    const response = await route(request, undefined);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(request, principal, undefined);
    expect(response.headers.get("set-cookie")).toContain("rolled-token");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("rolls the cookie to a version-2 token carrying the principal by default (regression: used to roll to a bare version-1 token, silently logging every user out on their next server-rendered navigation)", async () => {
    const previousSecret = process.env.AUTH_SESSION_SECRET;
    process.env.AUTH_SESSION_SECRET = "test-only-session-secret-with-32-characters";

    try {
      const now = Math.floor(Date.now() / 1000);
      const handler = vi.fn(async (_request, authenticatedUser) =>
        apiSuccess({ userId: authenticatedUser.userId }),
      );
      const route = createProtectedRoute(handler, {
        verifyToken: () => ({
          version: 1,
          userId: "42",
          issuedAt: now - 60,
          lastSeenAt: now - 60,
        }),
        revalidate: vi.fn().mockResolvedValue(principal),
        production: false,
      });
      const response = await route(requestWithSession(), undefined);

      const setCookie = response.headers.get("set-cookie") ?? "";
      const token = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
      const rolledPayload = token ? verifySessionToken(decodeURIComponent(token)) : null;

      expect(rolledPayload?.version).toBe(2);
      if (rolledPayload?.version === 2) {
        expect(rolledPayload.principal).toEqual(principal);
      }
    } finally {
      process.env.AUTH_SESSION_SECRET = previousSecret;
    }
  });

  it("rejects a missing session before calling business logic", async () => {
    const handler = vi.fn(async () => apiSuccess({ unreachable: true }));
    const route = createProtectedRoute(handler, {
      verifyToken: () => null,
      production: false,
    });
    const response = await route(
      new NextRequest("http://localhost/api/protected"),
      undefined,
    );

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects a valid user whose role is outside the route allow-list", async () => {
    const handler = vi.fn(async () => apiSuccess({ unreachable: true }));
    const route = createProtectedRoute(handler, {
      allowedRoles: ["HRD_CENTER"],
      verifyToken: () => ({
        version: 1,
        userId: "42",
        issuedAt: 100,
        lastSeenAt: 200,
      }),
      revalidate: vi.fn().mockResolvedValue(principal),
      rollToken: () => "rolled-token",
      production: false,
    });
    const response = await route(requestWithSession(), undefined);

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes Next.js dynamic route context to protected business logic", async () => {
    const routeContext = {
      params: Promise.resolve({ companyId: "7" }),
    };
    const handler = vi.fn(async (_request, _principal, context) =>
      apiSuccess({ companyId: (await context.params).companyId }),
    );
    const route = createProtectedRoute(handler, {
      verifyToken: () => ({
        version: 1,
        userId: "42",
        issuedAt: 100,
        lastSeenAt: 200,
      }),
      revalidate: vi.fn().mockResolvedValue(principal),
      rollToken: () => "rolled-token",
      production: false,
    });
    const request = requestWithSession();
    const response = await route(request, routeContext);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(request, principal, routeContext);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { companyId: "7" },
    });
  });
});
