import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isValidThaiNationalId,
  maskNationalId,
  protectNationalId,
  revealNationalId,
} from "../../app/lib/employees/nationalId";

const env = {
  NATIONAL_ID_HMAC_KEY: randomBytes(32).toString("base64"),
  NATIONAL_ID_ACTIVE_KEY_VERSION: "1",
  NATIONAL_ID_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
};

describe("National ID protection", () => {
  it("accepts any value containing exactly 13 digits", () => {
    expect(isValidThaiNationalId("1101700207030")).toBe(true);
    expect(isValidThaiNationalId("1101700207031")).toBe(true);
    expect(isValidThaiNationalId("1234567890123")).toBe(true);
    expect(isValidThaiNationalId("123456789012")).toBe(false);
    expect(isValidThaiNationalId("12345678901234")).toBe(false);
    expect(isValidThaiNationalId("MOCK-ATA-1001")).toBe(false);
  });
  it("round trips encrypted data without exposing it", () => {
    const protectedId = protectNationalId("1101700207030", env);
    expect(protectedId.hash).toHaveLength(64);
    expect(protectedId.last4).toBe("7030");
    expect(protectedId.encrypted.toString("utf8")).not.toContain("1101700207030");
    expect(revealNationalId(protectedId.encrypted, 1, env)).toBe("1101700207030");
    expect(maskNationalId(protectedId.last4)).toBe("*********7030");
  });
});
