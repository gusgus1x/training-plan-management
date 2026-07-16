import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUS,
  DEVELOPMENT_PASSWORD_MAX_LENGTH,
  DEVELOPMENT_PASSWORD_MIN_LENGTH,
  DEVELOPMENT_PASSWORD_VALIDATION_MESSAGE,
  FIND_USERNAME_QUERY,
  INSERT_ACCOUNT_QUERY,
  RESOLVE_ROLE_QUERY,
  ROLE_CODE,
  validateDevelopmentPassword,
  VERIFY_PROVISIONING_LOGIN_QUERY,
} from "../../scripts/seed-development-account.mjs";

describe("development account seed contract", () => {
  it("accepts development passwords from 12 characters including 64 characters", () => {
    const minimumPassword = "a".repeat(12);
    const sixtyFourCharacterPassword = "b".repeat(64);

    expect(DEVELOPMENT_PASSWORD_MIN_LENGTH).toBe(12);
    expect(DEVELOPMENT_PASSWORD_MAX_LENGTH).toBeGreaterThanOrEqual(64);
    expect(() =>
      validateDevelopmentPassword(minimumPassword, minimumPassword),
    ).not.toThrow();
    expect(() =>
      validateDevelopmentPassword(
        sixtyFourCharacterPassword,
        sixtyFourCharacterPassword,
      ),
    ).not.toThrow();
  });

  it("rejects passwords shorter than 12 characters and mismatched confirmation", () => {
    expect(() =>
      validateDevelopmentPassword("a".repeat(11), "a".repeat(11)),
    ).toThrow(DEVELOPMENT_PASSWORD_VALIDATION_MESSAGE);
    expect(() =>
      validateDevelopmentPassword("a".repeat(12), "b".repeat(12)),
    ).toThrow(DEVELOPMENT_PASSWORD_VALIDATION_MESSAGE);
    expect(DEVELOPMENT_PASSWORD_VALIDATION_MESSAGE).toBe(
      "Development account password must be 12 to 1024 characters and match confirmation.",
    );
  });

  it("uses the confirmed role and account status without a hardcoded role id", () => {
    expect(ROLE_CODE).toBe("HRD_CENTER");
    expect(ACTIVE_STATUS).toBe("ACTIVE");
    expect(RESOLVE_ROLE_QUERY).toContain("r.role_code = @roleCode");
    expect(INSERT_ACCOUNT_QUERY).toContain("@roleId");
    expect(INSERT_ACCOUNT_QUERY).not.toMatch(/role_id\s*[,)]?\s*VALUES\s*\(\s*\d/i);
  });

  it("forces employee and company scope to NULL", () => {
    expect(INSERT_ACCOUNT_QUERY).toMatch(
      /employee_id,[\s\S]*company_id,[\s\S]*VALUES\s*\([\s\S]*@roleId,[\s\S]*NULL,[\s\S]*NULL,/i,
    );
  });

  it("parameterizes username, hash, status, and duplicate checks", () => {
    expect(FIND_USERNAME_QUERY).toContain("ua.username = @username");
    expect(INSERT_ACCOUNT_QUERY).toContain("@username");
    expect(INSERT_ACCOUNT_QUERY).toContain("@passwordHash");
    expect(INSERT_ACCOUNT_QUERY).toContain("@accountStatus");
  });

  it("contains only the approved single insert and read-only validation queries", () => {
    const validationQueries = [
      VERIFY_PROVISIONING_LOGIN_QUERY,
      RESOLVE_ROLE_QUERY,
      FIND_USERNAME_QUERY,
    ].join("\n");

    expect(validationQueries).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i,
    );
    expect(INSERT_ACCOUNT_QUERY.match(/\bINSERT\b/gi)).toHaveLength(1);
    expect(INSERT_ACCOUNT_QUERY).not.toMatch(
      /\b(UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i,
    );
  });
});
