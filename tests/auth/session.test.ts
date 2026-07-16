import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createLoginHandler } from "../../app/api/auth/login/route";
import { createLogoutHandler } from "../../app/api/auth/logout/route";
import { createSessionHandler } from "../../app/api/auth/session/route";
import {
  createSessionToken,
  getSessionSecret,
  SESSION_ABSOLUTE_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_SECONDS,
  SessionConfigurationError,
  verifySessionToken,
} from "../../app/lib/auth/session";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

const secret = "test-only-session-secret-with-32-characters";
const principal: AuthenticatedPrincipal = {
  userId: "42",
  username: "factory.test",
  role: "HRD_FACTORY",
  employeeId: null,
  companyId: "7",
  email: "factory.test@example.invalid",
  employeeCode: "DEV-FACTORY-001",
  displayName: "Factory Test",
  companyCode: "ATA",
  companyName: "ATA Development Demo Company",
  functionCode: "DEV_HR",
  functionName: "Development Human Resources",
  positionCode: "DEV_HRD_OFFICER",
  positionName: "Development HRD Officer",
  levelCode: "DEV_STAFF",
  levelName: "Development Staff",
  pl: "DEV-PL3",
};

describe("session tokens and auth cookies", () => {
  it("rejects missing or short session secrets", () => {
    expect(() => getSessionSecret({})).toThrow(SessionConfigurationError);
    expect(() => getSessionSecret({ AUTH_SESSION_SECRET: "short" })).toThrow(
      "at least 32 characters",
    );
  });

  it("does not hide a missing server secret as an invalid client token", () => {
    const previousSecret = process.env.AUTH_SESSION_SECRET;
    delete process.env.AUTH_SESSION_SECRET;

    try {
      expect(() => verifySessionToken("invalid-token")).toThrow(
        SessionConfigurationError,
      );
    } finally {
      if (previousSecret === undefined) {
        delete process.env.AUTH_SESSION_SECRET;
      } else {
        process.env.AUTH_SESSION_SECRET = previousSecret;
      }
    }
  });

  it("detects token tampering", () => {
    const token = createSessionToken("42", { secret, now: 1_000 });
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(verifySessionToken(tampered, { secret, now: 1_001 })).toBeNull();
  });

  it("enforces idle and absolute expiry", () => {
    const idleToken = createSessionToken("42", { secret, now: 1_000 });
    expect(
      verifySessionToken(idleToken, {
        secret,
        now: 1_000 + SESSION_IDLE_SECONDS,
      }),
    ).toBeNull();

    const absoluteToken = createSessionToken("42", {
      secret,
      issuedAt: 1_000,
      now: 1_000 + SESSION_ABSOLUTE_SECONDS - 1,
    });
    expect(
      verifySessionToken(absoluteToken, {
        secret,
        now: 1_000 + SESSION_ABSOLUTE_SECONDS,
      }),
    ).toBeNull();
  });

  it("sets the approved production cookie flags on login", async () => {
    const handler = createLoginHandler({
      authenticate: vi.fn().mockResolvedValue(principal),
      createToken: () => "signed-token-without-password-hash",
      production: true,
    });
    const response = await handler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "factory.test",
          password: "not-returned",
        }),
      }),
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${SESSION_IDLE_SECONDS}`);
    expect(cookie).not.toContain("not-returned");
  });

  it("revalidates the account from the database contract and rolls a session", async () => {
    const revalidate = vi.fn().mockResolvedValue(principal);
    const handler = createSessionHandler({
      verifyToken: () => ({
        version: 1,
        userId: "42",
        issuedAt: 100,
        lastSeenAt: 200,
      }),
      revalidate,
      rollToken: () => "rolled-token",
      production: false,
    });
    const request = new NextRequest("http://localhost/api/auth/session", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=valid-token` },
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    expect(revalidate).toHaveBeenCalledWith("42");
    expect(response.headers.get("set-cookie")).toContain("rolled-token");
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });

  it("clears an invalid session without exposing token details", async () => {
    const handler = createSessionHandler({
      verifyToken: () => null,
      production: false,
    });
    const response = await handler(
      new NextRequest("http://localhost/api/auth/session", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=tampered-secret-token` },
      }),
    );
    const serializedBody = JSON.stringify(await response.json());

    expect(response.status).toBe(401);
    expect(serializedBody).not.toContain("tampered-secret-token");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("clears the cookie on logout", async () => {
    const response = await createLogoutHandler({ production: true })();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
});
