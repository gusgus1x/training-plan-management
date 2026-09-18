import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

// No DB: audit is replaced and the store is in memory.
vi.mock("../../app/lib/audit", () => ({
  recordAuditQuietly: vi.fn(async () => undefined),
  auditRequestContext: () => ({ ipAddress: null, userAgent: null }),
}));

import {
  createListLoginOtpHandler,
  createSetLoginOtpHandler,
} from "../../app/api/master-data/login-otp/route";
import {
  canManageCompany,
  suspensionEndsAt,
  type CompanyOtpStatus,
  type OtpSuspensionStore,
} from "../../app/lib/auth/loginOtpSuspension";
import type { AuthenticatedPrincipal, RoleCode } from "../../app/lib/auth/types";

const principal = (role: RoleCode, companyId: string | null): AuthenticatedPrincipal => ({
  userId: "9",
  username: `hrd-${role}`,
  role,
  employeeUserId: null,
  employeeId: null,
  companyId,
  email: null,
  employeeCode: null,
  displayName: null,
  companyCode: null,
  companyName: null,
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
});

const now = new Date("2026-09-18T08:00:00Z");

const memoryStore = () => {
  const suspended = new Map<string, Date>();
  const companies = ["1", "2"];
  const store: OtpSuspensionStore = {
    isSuspended: async (companyId, at) => (suspended.get(companyId)?.getTime() ?? 0) > at.getTime(),
    list: async (ids, at): Promise<CompanyOtpStatus[]> =>
      companies
        .filter((id) => ids === null || ids.includes(id))
        .map((id) => {
          const until = suspended.get(id);
          const active = until && until.getTime() > at.getTime() ? until : null;
          return { companyId: id, companyCode: `C${id}`, companyName: `Company ${id}`, suspendedUntil: active, suspendedBy: active ? "hrd" : null };
        }),
    suspend: async (companyId, _userId, at) => {
      const until = suspensionEndsAt(at);
      suspended.set(companyId, until);
      return until;
    },
    resume: async (companyId) => {
      suspended.delete(companyId);
    },
    companyCode: async (companyId) => `C${companyId}`,
  };
  return { store, suspended };
};

const handlers = (who: AuthenticatedPrincipal, store: OtpSuspensionStore) => {
  const auth = {
    verifyToken: () => ({ version: 1 as const, userId: who.userId, issuedAt: 1, lastSeenAt: 1, bootId: "b" }),
    revalidate: async () => who,
    rollToken: () => "rolled",
    production: false,
  };
  return {
    list: createListLoginOtpHandler({ auth, store, now: () => now }),
    set: createSetLoginOtpHandler({ auth, store, now: () => now }),
  };
};

const request = (body?: unknown) =>
  new NextRequest("http://localhost/api/master-data/login-otp", {
    method: body ? "POST" : "GET",
    headers: { cookie: "tpm_session=x", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("Master Data > System: switching the employee email code off", () => {
  it("lets HRD Center manage every company and HRD Factory only its own", () => {
    expect(canManageCompany(principal("HRD_CENTER", null), "2")).toBe(true);
    expect(canManageCompany(principal("HRD_FACTORY", "1"), "1")).toBe(true);
    expect(canManageCompany(principal("HRD_FACTORY", "1"), "2")).toBe(false);
  });

  it("switches off for exactly 24 hours", async () => {
    const { store, suspended } = memoryStore();
    const response = await handlers(principal("HRD_FACTORY", "1"), store).set(request({ companyId: "1", enabled: false }));
    expect(response.status).toBe(200);
    expect(suspended.get("1")).toEqual(new Date("2026-09-19T08:00:00Z"));
    expect(await store.isSuspended("1", new Date("2026-09-19T07:59:59Z"))).toBe(true);
    expect(await store.isSuspended("1", new Date("2026-09-19T08:00:00Z"))).toBe(false);
  });

  it("names the company by its code in the audit row Admin reads", async () => {
    const { recordAuditQuietly } = await import("../../app/lib/audit");
    const { store } = memoryStore();
    await handlers(principal("HRD_CENTER", null), store).set(request({ companyId: "2", enabled: false }));
    expect(recordAuditQuietly).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "LOGIN_OTP_SUSPENDED", entityType: "company", entityId: "2", entityLabel: "C2" }),
    );
  });

  it("switches back on early", async () => {
    const { store, suspended } = memoryStore();
    const { set } = handlers(principal("HRD_CENTER", null), store);
    await set(request({ companyId: "2", enabled: false }));
    await set(request({ companyId: "2", enabled: true }));
    expect(suspended.has("2")).toBe(false);
  });

  it("refuses HRD Factory touching another company", async () => {
    const { store, suspended } = memoryStore();
    const response = await handlers(principal("HRD_FACTORY", "1"), store).set(request({ companyId: "2", enabled: false }));
    expect(response.status).toBe(403);
    expect(suspended.size).toBe(0);
  });

  it("refuses employees", async () => {
    const { store } = memoryStore();
    const response = await handlers(principal("EMPLOYEE", "1"), store).set(request({ companyId: "1", enabled: false }));
    expect(response.status).toBe(403);
  });

  it("lists only the factory's own company", async () => {
    const { store } = memoryStore();
    const response = await handlers(principal("HRD_FACTORY", "1"), store).list(request());
    const body = await response.json();
    expect(body.data.companies.map((company: CompanyOtpStatus) => company.companyId)).toEqual(["1"]);
  });
});
