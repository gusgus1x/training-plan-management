import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  APPROVED_ROLE_CODES,
  COMPANIES,
  DEVELOPMENT_PROFILES,
  FUNCTION_MAPPINGS,
  FUNCTIONS,
  LEVELS,
  POSITIONS,
  previewDataset,
  SQL,
  validateDataset,
} from "../../scripts/seed-development-dataset.mjs";

const source = readFileSync(
  new URL("../../scripts/seed-development-dataset.mjs", import.meta.url),
  "utf8",
);

describe("approved development dataset seed", () => {
  it("contains the approved masters and exactly twelve unique profiles", () => {
    expect(COMPANIES.map((item) => item.code)).toEqual([
      "ATA",
      "TEP",
      "ATFB",
      "NIC",
      "SATI",
      "SNF",
    ]);
    expect(FUNCTIONS.map((item) => item.code)).toEqual([
      "DEV_HR",
      "DEV_PRODUCTION",
    ]);
    expect(POSITIONS.map((item) => item.code)).toEqual([
      "DEV_HRD_OFFICER",
      "DEV_OPERATOR",
    ]);
    expect(LEVELS.map((item) => [item.code, item.pl])).toEqual([
      ["DEV_STAFF", "DEV-PL3"],
      ["DEV_OPERATOR", "DEV-PL1"],
    ]);
    expect(FUNCTION_MAPPINGS).toHaveLength(12);
    expect(DEVELOPMENT_PROFILES).toHaveLength(12);
    expect(
      new Set(DEVELOPMENT_PROFILES.map((item) => item.username)).size,
    ).toBe(12);
    expect(() => validateDataset()).not.toThrow();
  });

  it("creates six HRD_FACTORY and six EMPLOYEE proposals with complete scope", () => {
    expect(APPROVED_ROLE_CODES).toEqual(["HRD_FACTORY", "EMPLOYEE"]);
    expect(
      DEVELOPMENT_PROFILES.filter((item) => item.roleCode === "HRD_FACTORY"),
    ).toHaveLength(6);
    expect(
      DEVELOPMENT_PROFILES.filter((item) => item.roleCode === "EMPLOYEE"),
    ).toHaveLength(6);
    expect(
      DEVELOPMENT_PROFILES.every(
        (item) =>
          item.companyCode &&
          item.employeeCode &&
          item.functionCode &&
          item.positionCode &&
          item.levelCode &&
          item.email.endsWith("@example.invalid"),
      ),
    ).toBe(true);
    expect(
      DEVELOPMENT_PROFILES.some((item) => item.username === "dev_hrd_center"),
    ).toBe(false);
  });

  it("has a connection-free preview with the approved counts", () => {
    expect(previewDataset()).toEqual({
      companies: 6,
      functions: 2,
      mappings: 12,
      positions: 2,
      levels: 2,
      hrdFactoryAccounts: 6,
      employeeAccounts: 6,
    });
  });

  it("uses explicit parameterized SQL without primary-key updates or schema changes", () => {
    const queries = Object.values(SQL).join("\n");

    expect(queries).not.toMatch(/SELECT\s+\*/i);
    expect(queries).not.toMatch(/\b(UPDATE|DELETE|DROP|ALTER|TRUNCATE|MERGE)\b/i);
    expect(SQL.findCompany).toContain("company_code = @code");
    expect(SQL.findFunction).toContain("function_code = @code");
    expect(SQL.findPosition).toContain("position_code = @code");
    expect(SQL.findLevel).toContain("level_code = @code");
    expect(SQL.findEmployee).toContain("employee_code = @employeeCode");
    expect(SQL.findAccount).toContain("username = @username");
    expect(SQL.insertAccount).toContain("@roleId");
    expect(SQL.insertAccount).toContain("@employeeId");
    expect(SQL.insertAccount).toContain("@companyId");
    expect(queries).not.toMatch(/role_id\s*=\s*\d/i);
  });

  it("uses one SERIALIZABLE transaction and rolls back conflicts", () => {
    expect(source).toContain(
      "transaction.begin(mssql.ISOLATION_LEVEL.SERIALIZABLE)",
    );
    expect(source.match(/transaction\.begin\(/g)).toHaveLength(1);
    expect(source).toContain("transaction.rollback()");
    expect(source).toContain("throw new DatasetConflictError");
    expect(source).toContain('mode !== "--execute"');
  });

  it("uses one hidden password input to create separately salted hashes", () => {
    expect(source).toContain(
      'readHidden("Shared development account password: ")',
    );
    expect(source).toContain("await hashPassword(developmentPassword)");
    expect(source).toContain(
      "await verifyPassword(row.password_hash, developmentPassword)",
    );
    expect(source).not.toContain("console.log");
    expect(source).not.toMatch(
      /(?:developmentPassword|provisioningPassword)\s*=\s*["'][^"']+["']/,
    );
  });
});
