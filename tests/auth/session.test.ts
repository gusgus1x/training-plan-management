import { createHmac } from "node:crypto";
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
  employeeUserId: null,
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

  it("stores a signed principal in a version 2 session token", () => {
    const token = createSessionToken("42", {
      secret,
      now: 1_000,
      principal,
    });
    const payload = verifySessionToken(token, { secret, now: 1_001 });

    expect(payload).toMatchObject({
      version: 2,
      userId: "42",
      validatedAt: 1_000,
      principal: { username: "factory.test", role: "HRD_FACTORY" },
    });
  });

  it("rejects a well-signed token issued by a different server process (stale boot id)", () => {
    // A restart must invalidate every previously-issued token even if the browser still holds a
    // validly-signed cookie — construct a token the same way createSessionToken would, but with
    // a boot id that couldn't have come from this process, and confirm it's still rejected.
    const forgedPayload = {
      version: 1,
      userId: "42",
      issuedAt: 1_000,
      lastSeenAt: 1_000,
      bootId: "boot-id-from-a-previous-server-process",
    };
    const encodedPayload = Buffer.from(JSON.stringify(forgedPayload)).toString("base64url");
    const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
    const forgedToken = `${encodedPayload}.${signature}`;

    expect(verifySessionToken(forgedToken, { secret, now: 1_001 })).toBeNull();
  });

  it("accepts its own tokens across calls (stable boot id within one process)", () => {
    const first = createSessionToken("42", { secret, now: 1_000 });
    const second = createSessionToken("43", { secret, now: 1_000 });

    expect(verifySessionToken(first, { secret, now: 1_001 })).not.toBeNull();
    expect(verifySessionToken(second, { secret, now: 1_001 })).not.toBeNull();
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
    // Browser-session-only cookie by design: no Max-Age/Expires, so it clears when the browser
    // (or the computer) fully closes, rather than surviving as a persistent login.
    expect(cookie).not.toContain("Max-Age");
    expect(cookie).not.toContain("Expires");
    expect(cookie).not.toContain("not-returned");
  });

  it("revalidates a stale version 2 account and rolls a session", async () => {
    const revalidate = vi.fn().mockResolvedValue(principal);
    const handler = createSessionHandler({
      verifyToken: () => ({
        version: 2,
        userId: "42",
        issuedAt: 100,
        lastSeenAt: 500,
        bootId: "test-boot-id",
        validatedAt: 100,
        principal,
      }),
      revalidate,
      rollToken: () => "rolled-token",
      now: () => 501,
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

  it("expires a legacy session immediately without waiting for SQL", async () => {
    const revalidate = vi.fn().mockRejectedValue(new Error("must not query SQL"));
    const handler = createSessionHandler({
      verifyToken: () => ({
        version: 1,
        userId: "42",
        issuedAt: 100,
        lastSeenAt: 200,
        bootId: "test-boot-id",
      }),
      revalidate,
      production: false,
    });
    const response = await handler(
      new NextRequest("http://10.123.23.38:3000/api/auth/session", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=legacy-token` },
      }),
    );

    expect(response.status).toBe(401);
    expect(revalidate).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("restores a recently validated session without waiting for the database", async () => {
    const revalidate = vi.fn().mockRejectedValue(new Error("database should not run"));
    const rollToken = vi.fn().mockReturnValue("rolled-cached-token");
    const handler = createSessionHandler({
      verifyToken: () => ({
        version: 2,
        userId: "42",
        issuedAt: 100,
        lastSeenAt: 220,
        bootId: "test-boot-id",
        validatedAt: 200,
        principal,
      }),
      revalidate,
      rollToken,
      now: () => 250,
      production: false,
    });
    const response = await handler(
      new NextRequest("http://localhost/api/auth/session", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=valid-token` },
      }),
    );

    expect(response.status).toBe(200);
    expect(revalidate).not.toHaveBeenCalled();
    expect(rollToken).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      data: { user: { username: "factory.test" } },
    });
  });

  it("revalidates a cached principal after the short cache window", async () => {
    const refreshedPrincipal = { ...principal, displayName: "Factory Updated" };
    const revalidate = vi.fn().mockResolvedValue(refreshedPrincipal);
    const handler = createSessionHandler({
      verifyToken: () => ({
        version: 2,
        userId: "42",
        issuedAt: 100,
        lastSeenAt: 500,
        bootId: "test-boot-id",
        validatedAt: 200,
        principal,
      }),
      revalidate,
      rollToken: () => "rolled-refreshed-token",
      now: () => 501,
      revalidateAfterSeconds: 300,
      production: false,
    });
    const response = await handler(
      new NextRequest("http://localhost/api/auth/session", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=valid-token` },
      }),
    );

    expect(response.status).toBe(200);
    expect(revalidate).toHaveBeenCalledWith("42");
    await expect(response.json()).resolves.toMatchObject({
      data: { user: { displayName: "Factory Updated" } },
    });
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
    const response = await createLogoutHandler({ production: true })(
      new Request("http://localhost/api/auth/logout", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
});
