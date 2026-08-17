import { describe, expect, it } from "vitest";
import { normalizeEmployeeLevel } from "../../app/lib/employeeMasterData";

describe("Employee Master training flow", () => {
  it("normalizes Thai and legacy level keys for Course Standard matching", () => {
    expect(normalizeEmployeeLevel("จ2")).toBe("M2");
    expect(normalizeEmployeeLevel("บ3")).toBe("S3");
    expect(normalizeEmployeeLevel("ป1")).toBe("O1");
    expect(normalizeEmployeeLevel("L2")).toBe("O2");
  });
});
