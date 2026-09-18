import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Never touch the shared DB from these tests: the audit writer is replaced, the store is in memory.
vi.mock("../../app/lib/audit", () => ({
  recordAuditQuietly: vi.fn(async () => undefined),
  auditRequestContext: () => ({ ipAddress: null, userAgent: null }),
}));

import { createLoginHandler } from "../../app/api/auth/login/route";
import {
  OTP_MAX_ATTEMPTS,
  OTP_PENDING_COOKIE_NAME,
  createPendingToken,
  hashOtpCode,
  isOtpVerificationCurrent,
  maskEmail,
  verifyPendingToken,
  type LoginOtpStore,
  type OtpRow,
} from "../../app/lib/auth/loginOtp";
import { createOtpRequestHandler, createOtpVerifyHandler } from "../../app/lib/auth/loginOtpHandlers";
import { otpEmailContent, readSmtpConfig } from "../../app/lib/auth/mailer";
import { SESSION_COOKIE_NAME } from "../../app/lib/auth/session";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
let previousSecret: string | undefined;
beforeAll(() => {
  previousSecret = process.env.AUTH_SESSION_SECRET;
  process.env.AUTH_SESSION_SECRET = SECRET;
});
afterAll(() => {
  if (previousSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
  else process.env.AUTH_SESSION_SECRET = previousSecret;
});

const employee: AuthenticatedPrincipal = {
  userId: "7",
  username: "1290-000017",
  role: "EMPLOYEE",
  employeeUserId: "E7",
  employeeId: "70",
  companyId: "1",
  email: null,
  employeeCode: "1290-000017",
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
};

type Account = { email: string | null; otpVerifiedUntil: Date | null };

const memoryStore = (accounts: Record<string, Account>) => {
  const rows: Array<OtpRow & { userId: string; consumedAt: Date | null }> = [];
  const store: LoginOtpStore = {
    getAccountState: async (userId) => accounts[userId] ?? null,
    isEmailTakenByOther: async (email, userId) =>
      Object.entries(accounts).some(([id, account]) => id !== userId && account.email === email),
    listSentSince: async (userId, since) =>
      rows
        .filter((row) => row.userId === userId && row.createdAt >= since)
        .map((row) => row.createdAt)
        .sort((a, b) => b.getTime() - a.getTime()),
    createOtp: async ({ userId, email, codeHash, expiresAt }) => {
      rows.push({
        otpId: String(rows.length + 1),
        userId,
        email,
        codeHash,
        expiresAt,
        attemptCount: 0,
        createdAt: clock.now,
        consumedAt: null,
      });
    },
    latestUnconsumed: async (userId) => {
      const row = rows.filter((candidate) => candidate.userId === userId && !candidate.consumedAt).at(-1);
      return row ? { ...row } : null; // a copy, like a DB read
    },
    recordFailedAttempt: async (otpId) => {
      const row = rows.find((candidate) => candidate.otpId === otpId);
      if (row) row.attemptCount += 1;
    },
    confirm: async ({ userId, otpId, email, now, verifiedUntil }) => {
      const row = rows.find((candidate) => candidate.otpId === otpId);
      if (!row || row.consumedAt) return false;
      row.consumedAt = now;
      accounts[userId] = { email, otpVerifiedUntil: verifiedUntil };
      return true;
    },
  };
  return { store, rows };
};

const clock = { now: new Date("2026-09-18T08:00:00Z") };
let sent: Array<{ to: string; code: string }>;
beforeEach(() => {
  clock.now = new Date("2026-09-18T08:00:00Z");
  sent = [];
});

// Real time, not `clock`: the handlers check the pending cookie against the wall clock, so a token
// minted at the fixed test time expired 10 minutes after it and failed every run from then on.
const pendingCookie = (userId = "7") =>
  `${OTP_PENDING_COOKIE_NAME}=${createPendingToken(userId, { secret: SECRET })}`;

const post = (url: string, body: unknown, cookie?: string) =>
  new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const handlers = (store: LoginOtpStore) => {
  const deps = {
    store,
    send: async (to: string, code: string) => {
      sent.push({ to, code });
    },
    revalidate: async () => employee,
    createToken: () => "session-token",
    now: () => clock.now,
    production: false,
  };
  return { request: createOtpRequestHandler(deps), verify: createOtpVerifyHandler(deps) };
};

describe("OTP mailer settings", () => {
  it("reads SMTP from the environment and strips the spaces Gmail shows in App Passwords", () => {
    expect(
      readSmtpConfig({
        SMTP_HOST: "smtp.gmail.com",
        SMTP_PORT: "587",
        SMTP_USER: "sender@gmail.com",
        SMTP_PASS: "abcd efgh ijkl mnop",
      }),
    ).toEqual({ host: "smtp.gmail.com", port: 587, user: "sender@gmail.com", pass: "abcdefghijklmnop", from: "sender@gmail.com" });
  });

  it("treats missing settings as not configured", () => {
    expect(readSmtpConfig({ SMTP_HOST: "smtp.gmail.com" })).toBeNull();
  });

  it("puts the code and its lifetime in the email", () => {
    const mail = otpEmailContent("123456");
    expect(mail.subject).toContain("123456");
    expect(mail.text).toContain("5");
  });
});

describe("login OTP helpers", () => {
  it("masks an email without revealing the whole local part", () => {
    expect(maskEmail("somchai@gmail.com")).toBe("so*****@gmail.com");
    expect(maskEmail("a@x.co")).toBe("a***@x.co");
    expect(maskEmail(null)).toBeNull();
  });

  it("accepts a pending token only while it is fresh and unmodified", () => {
    const token = createPendingToken("7", { secret: SECRET, now: 0 });
    expect(verifyPendingToken(token, { secret: SECRET, now: 60_000 })).toBe("7");
    expect(verifyPendingToken(token, { secret: SECRET, now: 11 * 60_000 })).toBeNull();
    expect(verifyPendingToken(`${token}x`, { secret: SECRET, now: 0 })).toBeNull();
  });

  it("treats a missing or past verification as owed", () => {
    expect(isOtpVerificationCurrent(null, clock.now)).toBe(false);
    expect(isOtpVerificationCurrent(new Date(clock.now.getTime() - 1), clock.now)).toBe(false);
    expect(isOtpVerificationCurrent(new Date(clock.now.getTime() + 1), clock.now)).toBe(true);
  });
});

describe("login gives an EMPLOYEE no session until the email code is confirmed", () => {
  const login = (principal: AuthenticatedPrincipal, account: Account | null, suspended = false) =>
    createLoginHandler({
      authenticate: async () => principal,
      createToken: () => "session-token",
      production: false,
      otpStore: { getAccountState: async () => account },
      isOtpSuspended: async () => suspended,
    })(post("/api/auth/login", { username: "1290-000017", password: "11051972" }));

  it("skips the code while HRD has switched it off for the employee's company", async () => {
    const response = await login(employee, { email: null, otpVerifiedUntil: null }, true);
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it("asks for the code on the first login", async () => {
    const response = await login(employee, { email: null, otpVerifiedUntil: null });
    const body = await response.json();
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(body.data).toEqual({ otpRequired: true, maskedEmail: null });
    expect(cookies).toContain(`${OTP_PENDING_COOKIE_NAME}=`);
    expect(cookies).not.toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it("asks again once the 2 days have passed, showing the bound address masked", async () => {
    const response = await login(employee, {
      email: "somchai@gmail.com",
      otpVerifiedUntil: new Date(Date.now() - 1000),
    });
    expect((await response.json()).data).toEqual({ otpRequired: true, maskedEmail: "so*****@gmail.com" });
  });

  it("signs in directly while the confirmation is still current", async () => {
    const response = await login(employee, {
      email: "somchai@gmail.com",
      otpVerifiedUntil: new Date(Date.now() + 60_000),
    });
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it("never asks HRD or Admin", async () => {
    const response = await login({ ...employee, role: "HRD_FACTORY" }, null);
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
  });
});

describe("POST /api/auth/otp/request", () => {
  it("refuses without a pending login", async () => {
    const { store } = memoryStore({ "7": { email: null, otpVerifiedUntil: null } });
    const response = await handlers(store).request(post("/api/auth/otp/request", { email: "a@b.co" }));
    expect(response.status).toBe(401);
  });

  it("sends to the typed email when none is bound yet", async () => {
    const { store } = memoryStore({ "7": { email: null, otpVerifiedUntil: null } });
    const response = await handlers(store).request(
      post("/api/auth/otp/request", { email: " Somchai@Gmail.com " }, pendingCookie()),
    );
    expect(response.status).toBe(200);
    expect(sent).toEqual([{ to: "somchai@gmail.com", code: expect.stringMatching(/^\d{6}$/) }]);
  });

  it("ignores a typed email once one is bound", async () => {
    const { store } = memoryStore({ "7": { email: "owner@gmail.com", otpVerifiedUntil: null } });
    await handlers(store).request(post("/api/auth/otp/request", { email: "intruder@gmail.com" }, pendingCookie()));
    expect(sent.map((mail) => mail.to)).toEqual(["owner@gmail.com"]);
  });

  it("rejects an address another account already uses", async () => {
    const { store } = memoryStore({
      "7": { email: null, otpVerifiedUntil: null },
      "8": { email: "taken@gmail.com", otpVerifiedUntil: null },
    });
    const response = await handlers(store).request(
      post("/api/auth/otp/request", { email: "taken@gmail.com" }, pendingCookie()),
    );
    expect(response.status).toBe(409);
    expect(sent).toHaveLength(0);
  });

  it("limits resends to one per minute and five per hour", async () => {
    const { store } = memoryStore({ "7": { email: "owner@gmail.com", otpVerifiedUntil: null } });
    const { request } = handlers(store);
    const ask = () => request(post("/api/auth/otp/request", {}, pendingCookie()));

    expect((await ask()).status).toBe(200);
    expect((await ask()).status).toBe(429);
    for (let i = 0; i < 4; i += 1) {
      clock.now = new Date(clock.now.getTime() + 61_000);
      expect((await ask()).status).toBe(200);
    }
    clock.now = new Date(clock.now.getTime() + 61_000);
    const limited = await ask();
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("OTP_RATE_LIMITED");
  });
});

describe("POST /api/auth/otp/verify", () => {
  const setup = async () => {
    const accounts: Record<string, Account> = { "7": { email: null, otpVerifiedUntil: null } };
    const { store, rows } = memoryStore(accounts);
    const h = handlers(store);
    await h.request(post("/api/auth/otp/request", { email: "somchai@gmail.com" }, pendingCookie()));
    return { accounts, rows, h, code: sent[0].code };
  };

  it("binds the email, starts the 2 days and signs in", async () => {
    const { accounts, h, code } = await setup();
    const response = await h.verify(post("/api/auth/otp/verify", { code }, pendingCookie()));
    const cookies = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookies).toContain(`${SESSION_COOKIE_NAME}=session-token`);
    expect(cookies).toContain(`${OTP_PENDING_COOKIE_NAME}=;`);
    expect(accounts["7"]).toEqual({
      email: "somchai@gmail.com",
      otpVerifiedUntil: new Date(clock.now.getTime() + 2 * 24 * 60 * 60 * 1000),
    });
  });

  it("uses a code only once", async () => {
    const { h, code } = await setup();
    await h.verify(post("/api/auth/otp/verify", { code }, pendingCookie()));
    const again = await h.verify(post("/api/auth/otp/verify", { code }, pendingCookie()));
    expect(again.status).toBe(400);
  });

  it("counts wrong guesses and kills the code after the limit", async () => {
    const { h, code } = await setup();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 1; i <= OTP_MAX_ATTEMPTS; i += 1) {
      const response = await h.verify(post("/api/auth/otp/verify", { code: wrong }, pendingCookie()));
      expect((await response.json()).error.details.attemptsLeft).toBe(OTP_MAX_ATTEMPTS - i);
    }
    const late = await h.verify(post("/api/auth/otp/verify", { code }, pendingCookie()));
    expect((await late.json()).error.code).toBe("OTP_EXPIRED");
  });

  it("refuses an expired code", async () => {
    const { h, code } = await setup();
    clock.now = new Date(clock.now.getTime() + 5 * 60 * 1000);
    const response = await h.verify(post("/api/auth/otp/verify", { code }, pendingCookie()));
    expect((await response.json()).error.code).toBe("OTP_EXPIRED");
  });

  it("stores only a keyed hash of the code", async () => {
    const { rows, code } = await setup();
    expect(rows[0].codeHash).not.toContain(code);
    expect(rows[0].codeHash).toBe(hashOtpCode("7", code, SECRET));
  });
});
