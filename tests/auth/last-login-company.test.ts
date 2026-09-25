import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COMPANY_PREFIX_MAP } from "../../app/components/LoginPage";
import {
  LAST_LOGIN_COMPANY_CODES,
  readLastLoginCompany,
  rememberLastLoginCompany,
  type LastLoginCompany,
} from "../../app/lib/auth/lastLoginCompany";

// The one place the login UI may touch browser storage (see tests/ui/login-ui-contract.test.ts).
// These tests pin it to a company code and nothing else.
// Code only: the module's comments explain that it never stores a password.
const moduleCode = readFileSync("app/lib/auth/lastLoginCompany.ts", "utf8").replace(/\/\/.*$/gm, "");

describe("last login company storage", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    };
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("stores only the company code under one key", () => {
    rememberLastLoginCompany("ATA");
    expect([...store.entries()]).toEqual([["attg.login.lastCompany", "ATA"]]);
    expect(readLastLoginCompany()).toBe("ATA");
  });

  it("forgets the company after a general sign-in", () => {
    rememberLastLoginCompany("TEP");
    rememberLastLoginCompany(null);
    expect(store.size).toBe(0);
    expect(readLastLoginCompany()).toBeNull();
  });

  it("refuses anything that is not a known company code", () => {
    rememberLastLoginCompany("1290-000017" as LastLoginCompany);
    expect(store.size).toBe(0);
    store.set("attg.login.lastCompany", "toString");
    expect(readLastLoginCompany()).toBeNull();
  });

  it("survives blocked storage", () => {
    (globalThis as { window?: unknown }).window = {
      get localStorage(): never {
        throw new Error("blocked");
      },
    };
    expect(readLastLoginCompany()).toBeNull();
    expect(() => rememberLastLoginCompany("ATA")).not.toThrow();
  });

  it("knows exactly the login page's companies", () => {
    expect([...LAST_LOGIN_COMPANY_CODES].sort()).toEqual(Object.keys(COMPANY_PREFIX_MAP).sort());
  });

  it("never mentions a password, username or employee ID", () => {
    expect(moduleCode).not.toMatch(/password|username|employeeDigits/);
    expect(moduleCode).not.toContain("sessionStorage");
  });
});
