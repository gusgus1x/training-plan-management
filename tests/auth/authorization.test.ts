import { describe, expect, it } from "vitest";
import {
  requireCompanyScope,
  requireEmployeeOwnership,
  requireRole,
} from "../../app/lib/auth/authorization";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";

const employee: AuthenticatedPrincipal = {
  userId: "1",
  username: "employee.test",
  role: "EMPLOYEE",
  employeeId: "101",
  companyId: "10",
  email: null,
  employeeCode: "DEV-EMP-001",
  displayName: "Employee Test",
  companyCode: "ATA",
  companyName: "ATA Development Demo Company",
  functionCode: "DEV_PRODUCTION",
  functionName: "Development Production",
  positionCode: "DEV_OPERATOR",
  positionName: "Development Operator",
  levelCode: "DEV_OPERATOR",
  levelName: "Development Operator",
  pl: "DEV-PL1",
};

const factory: AuthenticatedPrincipal = {
  userId: "2",
  username: "factory.test",
  role: "HRD_FACTORY",
  employeeId: null,
  companyId: "10",
  email: null,
  employeeCode: "DEV-HRD-001",
  displayName: "Factory Test",
  companyCode: "ATA",
  companyName: "ATA Development Demo Company",
  functionCode: "DEV_HR",
  functionName: "Development Human Resources",
  positionCode: "DEV_HRD_OFFICER",
  positionName: "Development HRD Officer",
  levelCode: "DEV_STAFF",
  levelName: "Development Staff",
  pl: "DEV-PL3",
};

const center: AuthenticatedPrincipal = {
  userId: "3",
  username: "center.test",
  role: "HRD_CENTER",
  employeeId: null,
  companyId: null,
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
};

describe("authorization foundation", () => {
  it("denies a role outside the endpoint allow-list", () => {
    expect(() => requireRole(employee, ["HRD_FACTORY"])).toThrow("Access denied");
    expect(() => requireRole(factory, ["HRD_FACTORY"])).not.toThrow();
  });

  it("allows an employee to access only their own employee id", () => {
    expect(() => requireEmployeeOwnership(employee, "101")).not.toThrow();
    expect(() => requireEmployeeOwnership(employee, "102")).toThrow(
      "Access denied",
    );
    expect(() => requireEmployeeOwnership(factory, "101")).toThrow(
      "Access denied",
    );
  });

  it("denies HRD_FACTORY cross-company access", () => {
    expect(() => requireCompanyScope(factory, "10")).not.toThrow();
    expect(() => requireCompanyScope(factory, "11")).toThrow("Access denied");
  });

  it("allows HRD_CENTER cross-company only when the API opts in", () => {
    expect(() => requireCompanyScope(center, "11")).toThrow("Access denied");
    expect(() =>
      requireCompanyScope(center, "11", { allowHrdCenter: true }),
    ).not.toThrow();
  });
});
