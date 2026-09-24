import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createEventsHandler } from "../../app/api/events/route";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import { audienceIncludes, listenerCount, publish } from "../../app/lib/realtime/bus";

const principal = (overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal => ({
  userId: "42",
  username: "someone",
  role: "EMPLOYEE",
  employeeId: "7",
  employeeUserId: "10000042",
  companyId: "3",
  email: null,
  employeeCode: null,
  displayName: null,
  companyCode: "ATA",
  companyName: null,
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
  ...overrides,
});

describe("audienceIncludes", () => {
  it("matches by person, account, role, or a factory's own company", () => {
    expect(audienceIncludes({ employees: ["10000042"] }, principal())).toBe(true);
    expect(audienceIncludes({ accounts: [BigInt(42)] }, principal())).toBe(true);
    expect(audienceIncludes({ roles: ["HRD_CENTER"] }, principal({ role: "HRD_CENTER" }))).toBe(true);
    expect(audienceIncludes({ factoryCompanies: [BigInt(3)] }, principal({ role: "HRD_FACTORY" }))).toBe(true);
    expect(audienceIncludes({ all: true }, principal())).toBe(true);
  });

  it("does not reach another company's factory HRD, or an employee by their company", () => {
    expect(audienceIncludes({ factoryCompanies: ["9"] }, principal({ role: "HRD_FACTORY" }))).toBe(false);
    expect(audienceIncludes({ factoryCompanies: ["3"] }, principal())).toBe(false);
    expect(audienceIncludes({ employees: ["10000099"], roles: ["HRD_CENTER"] }, principal())).toBe(false);
    expect(audienceIncludes({ employees: ["10000042"] }, principal({ employeeUserId: null }))).toBe(false);
  });
});

const auth = (user: AuthenticatedPrincipal | null) => ({
  verifyToken: () =>
    user ? { version: 1 as const, userId: user.userId, issuedAt: 100, lastSeenAt: 200, bootId: "test-boot-id" } : null,
  revalidate: vi.fn().mockResolvedValue(user),
  rollToken: () => "rolled-token",
  production: false,
});

const open = (user: AuthenticatedPrincipal | null) => {
  const controller = new AbortController();
  const handler = createEventsHandler({ auth: auth(user) });
  const request = new NextRequest("http://localhost/api/events", {
    headers: { cookie: "tpm_session=valid-token" },
    signal: controller.signal,
  });
  return { response: handler(request), abort: () => controller.abort() };
};

const readUntil = async (body: ReadableStream<Uint8Array>, needle: string) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (!text.includes(needle)) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  reader.releaseLock();
  return text;
};

describe("GET /api/events", () => {
  it("refuses without a session", async () => {
    const { response } = open(null);
    expect((await response).status).toBe(401);
  });

  it("streams events meant for the caller, without rolling the session cookie", async () => {
    const { response, abort } = open(principal());
    const res = await response;
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("set-cookie")).toBeNull();

    publish({ type: "enrollment.changed", planId: "5" }, { employees: ["10000099"] });
    publish({ type: "notification.created" }, { employees: ["10000042"] });
    const text = await readUntil(res.body!, "notification.created");

    expect(text).toContain("event: notification.created");
    expect(text).not.toContain("enrollment.changed");
    // Only a broadcast is marked for spreading, so a personal notice still lands at once.
    expect(text).not.toContain('"spread"');
    publish({ type: "plan.changed", planId: "5" }, { all: true });
    expect(await readUntil(res.body!, "plan.changed")).toContain('"spread":true');
    abort();
    await vi.waitFor(() => expect(listenerCount()).toBe(0));
  });
});
