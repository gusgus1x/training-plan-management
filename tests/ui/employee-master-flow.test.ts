import { describe, expect, it } from "vitest";
import {
  defaultEmployeeRows,
  normalizeEmployeeLevel,
} from "../../app/lib/employeeMasterData";

describe("Employee Master training flow", () => {
  it("provides a varied mock employee catalog for all companies", () => {
    expect(defaultEmployeeRows).toHaveLength(258);
    expect(new Set(defaultEmployeeRows.map((employee) => employee.company))).toEqual(
      new Set(["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"]),
    );
    expect(new Set(defaultEmployeeRows.map((employee) => employee.empCode)).size)
      .toBe(defaultEmployeeRows.length);
    expect(new Set(defaultEmployeeRows.map((employee) => employee.id)).size)
      .toBe(defaultEmployeeRows.length);
    ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"].forEach((company) => {
      const companyEmployeeCount = defaultEmployeeRows.filter(
        (employee) => employee.company === company,
      ).length;
      expect(companyEmployeeCount).toBe(43);
    });
    expect(new Set(defaultEmployeeRows.map((employee) => employee.positionName)).size)
      .toBeGreaterThanOrEqual(8);
    expect(
      new Set(
        defaultEmployeeRows.map((employee) =>
          normalizeEmployeeLevel(employee.levelKey),
        ),
      ),
    ).toEqual(
      new Set([
        "M1",
        "M2",
        "M3",
        "M4",
        "S1",
        "S2",
        "S3",
        "S4",
        "O1",
        "O2",
        "O3",
        "O4",
        "O5",
      ]),
    );
  });

  it("normalizes Thai and legacy level keys for Course Standard matching", () => {
    expect(normalizeEmployeeLevel("จ2")).toBe("M2");
    expect(normalizeEmployeeLevel("บ3")).toBe("S3");
    expect(normalizeEmployeeLevel("ป1")).toBe("O1");
    expect(normalizeEmployeeLevel("L2")).toBe("O2");
  });
});
