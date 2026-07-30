import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildProfileItems,
  profileValue,
} from "../../app/components/AuthenticatedUserContext";
import type { ClientSessionUser } from "../../app/lib/auth/client";

const employee: ClientSessionUser = {
  userId: "1",
  username: "dev_employee_sati",
  roleCode: "EMPLOYEE",
  employeeId: "10",
  companyId: "5",
  email: "dev.employee.sati@example.invalid",
  employeeCode: "DEV-SATI-EMP-001",
  displayName: "ตัวอย่างซาติ พนักงานเดโม",
  companyCode: "SATI",
  companyName: "SATI Development Demo Company",
  functionCode: "DEV_PRODUCTION",
  functionName: "ฝ่ายผลิตสำหรับการพัฒนา",
  positionCode: "DEV_OPERATOR",
  positionName: "พนักงานฝ่ายผลิตตัวอย่าง",
  levelCode: "DEV_OPERATOR",
  levelName: "ระดับปฏิบัติการตัวอย่าง",
  pl: "DEV-PL1",
};

describe("database-backed profile display", () => {
  it("maps employee session fields to the profile card", () => {
    expect(buildProfileItems(employee)).toEqual([
      { label: "Employee Code", value: "DEV-SATI-EMP-001" },
      { label: "Position", value: "พนักงานฝ่ายผลิตตัวอย่าง" },
      { label: "Function", value: "ฝ่ายผลิตสำหรับการพัฒนา" },
      { label: "Company", value: "SATI Development Demo Company" },
      { label: "Level", value: "ระดับปฏิบัติการตัวอย่าง / DEV-PL1" },
      { label: "Email", value: "dev.employee.sati@example.invalid" },
    ]);
  });

  it("shows central scope and safe placeholders for HRD_CENTER", () => {
    expect(
      buildProfileItems({
        ...employee,
        roleCode: "HRD_CENTER",
        employeeId: null,
        companyId: null,
        email: null,
        employeeCode: null,
        companyCode: null,
        companyName: null,
        functionCode: null,
        functionName: null,
        positionCode: null,
        positionName: null,
        levelCode: null,
        levelName: null,
        pl: null,
      }),
    ).toContainEqual({ label: "Company", value: "All Companies" });
    expect(profileValue(null)).toBe("-");
  });

  it("removes the known mock identity values from active dashboard sources", () => {
    const sources = [
      "../../app/components/employee/UserDashboard.tsx",
      "../../app/components/employee/data.ts",
      "../../app/components/center_factory/CenterFactory_Dashboard.tsx",
      "../../app/components/Navbar.tsx",
    ]
      .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
      .join("\n");

    expect(sources).not.toContain("emp.user@company.com");
    expect(sources).not.toContain("hrd.center@company.com");
    expect(sources).not.toContain("hrd.factory@company.com");
    expect(sources).not.toContain("ATTG Training plan management");
    expect(sources).not.toContain('value: "EMP-001"');
    expect(sources).not.toContain('value: "HRD-001"');
    expect(sources).not.toContain("Somchai P.");
  });
});
