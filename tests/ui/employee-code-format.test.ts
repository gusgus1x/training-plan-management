import { describe, expect, it } from "vitest";
import {
  isLegacyEmployeeCode,
  joinEmployeeCode,
  padEmployeeCodeDigits,
  splitEmployeeCode,
} from "../../app/components/center_factory/MasterDataManagement/modules/EmployeeData";

describe("employee code format", () => {
  it("splits a standard code into the company prefix and the staff number", () => {
    expect(splitEmployeeCode("1290-000162")).toEqual({ prefix: "1290", digits: "000162" });
  });

  it("pads a short number so 162 and 000162 mean the same employee", () => {
    expect(padEmployeeCodeDigits("162")).toBe("000162");
    expect(joinEmployeeCode("1290", "162")).toBe("1290-000162");
  });

  it("keeps an empty field empty rather than inventing 000000", () => {
    expect(padEmployeeCodeDigits("")).toBe("");
    expect(joinEmployeeCode("1290", "")).toBeNull();
  });

  it("ignores anything that is not a digit and never exceeds six", () => {
    expect(padEmployeeCodeDigits("1a2b3")).toBe("000123");
    expect(padEmployeeCodeDigits("1234567890")).toBe("123456");
  });

  it("treats a code that does not match the shape as legacy, to be left alone", () => {
    // The eleven employees who arrived without a real code carried their 8-digit UserID here.
    expect(isLegacyEmployeeCode("15100001")).toBe(true);
    expect(isLegacyEmployeeCode("1290-000162")).toBe(false);
    // No code at all is not a legacy code — it is simply absent.
    expect(isLegacyEmployeeCode(null)).toBe(false);
  });

  it("falls back to the bare number when the company has no known prefix", () => {
    expect(joinEmployeeCode("", "162")).toBe("000162");
  });
});
