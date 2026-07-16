import { describe, expect, it, vi } from "vitest";
import {
  authenticateCredentials,
  resolveActivePrincipal,
} from "../../app/lib/auth/authentication";
import type { AuthenticationRepository } from "../../app/lib/auth/repository";
import type { AuthenticationAccount } from "../../app/lib/auth/types";

const activeEmployeeAccount = (
  overrides: Partial<AuthenticationAccount> = {},
): AuthenticationAccount => ({
  userId: "9007199254740993",
  username: "employee.test",
  passwordHash: "test-hash",
  accountStatus: "ACTIVE",
  roleCode: "EMPLOYEE",
  roleStatus: "ACTIVE",
  employeeId: "101",
  employeeStatus: "ACTIVE",
  employeeCompanyId: "10",
  employeeCompanyStatus: "ACTIVE",
  accountCompanyId: null,
  accountCompanyStatus: null,
  accountEmail: "employee.test@example.invalid",
  employeeCode: "DEV-EMP-001",
  employeeFirstNameTh: "พนักงาน",
  employeeLastNameTh: "ทดสอบ",
  employeeFirstNameEn: "Employee",
  employeeLastNameEn: "Test",
  employeeEmail: "employee.test@example.invalid",
  companyCode: "ATA",
  companyNameTh: "บริษัททดสอบ ATA",
  companyNameEn: "ATA Test Company",
  functionCode: "DEV_PRODUCTION",
  functionNameTh: "ฝ่ายผลิต",
  functionNameEn: "Production",
  positionCode: "DEV_OPERATOR",
  positionNameTh: "พนักงานฝ่ายผลิต",
  positionNameEn: "Operator",
  levelCode: "DEV_OPERATOR",
  levelNameTh: "ระดับปฏิบัติการ",
  levelNameEn: "Operator Level",
  pl: "DEV-PL1",
  ...overrides,
});

const repositoryWith = (
  account: AuthenticationAccount | null,
): AuthenticationRepository => ({
  findByUsername: vi.fn().mockResolvedValue(account),
  findByUserId: vi.fn().mockResolvedValue(account),
});

const expectInvalidCredentials = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toMatchObject({
    code: "INVALID_CREDENTIALS",
    message: "Invalid username or password",
    status: 401,
  });
};

describe("authentication service", () => {
  it("returns a server-resolved employee principal for valid credentials", async () => {
    const principal = await authenticateCredentials(
      "employee.test",
      "correct-password",
      {
        repository: repositoryWith(activeEmployeeAccount()),
        verify: vi.fn().mockResolvedValue(true),
      },
    );

    expect(principal).toMatchObject({
      userId: "9007199254740993",
      username: "employee.test",
      role: "EMPLOYEE",
      employeeId: "101",
      companyId: "10",
      email: "employee.test@example.invalid",
      employeeCode: "DEV-EMP-001",
      companyCode: "ATA",
      functionCode: "DEV_PRODUCTION",
      positionCode: "DEV_OPERATOR",
      levelCode: "DEV_OPERATOR",
      pl: "DEV-PL1",
    });
    expect(principal).not.toHaveProperty("passwordHash");
  });

  it("uses the same generic failure for wrong password and unknown username", async () => {
    await expectInvalidCredentials(
      authenticateCredentials("employee.test", "wrong", {
        repository: repositoryWith(activeEmployeeAccount()),
        verify: vi.fn().mockResolvedValue(false),
      }),
    );

    const verify = vi.fn().mockResolvedValue(false);
    await expectInvalidCredentials(
      authenticateCredentials("unknown", "wrong", {
        repository: repositoryWith(null),
        verify,
        getDummyHash: async () => "dummy-hash",
      }),
    );
    expect(verify).toHaveBeenCalledWith("dummy-hash", "wrong");
  });

  it.each([
    ["INACTIVE account", { accountStatus: "INACTIVE" }],
    ["LOCKED account", { accountStatus: "LOCKED" }],
    ["inactive role", { roleStatus: "INACTIVE" }],
    ["inactive employee", { employeeStatus: "INACTIVE" }],
    ["inactive employee company", { employeeCompanyStatus: "INACTIVE" }],
    ["missing employee", { employeeId: null, employeeStatus: null }],
    [
      "missing employee company",
      { employeeCompanyId: null, employeeCompanyStatus: null },
    ],
  ])("rejects %s without disclosing status", async (_name, overrides) => {
    await expectInvalidCredentials(
      authenticateCredentials("employee.test", "correct-password", {
        repository: repositoryWith(activeEmployeeAccount(overrides)),
        verify: vi.fn().mockResolvedValue(true),
      }),
    );
  });

  it("requires an active company for HRD_FACTORY", () => {
    const factory = activeEmployeeAccount({
      roleCode: "HRD_FACTORY",
      employeeId: null,
      employeeStatus: null,
      employeeCompanyId: null,
      employeeCompanyStatus: null,
      accountCompanyId: "20",
      accountCompanyStatus: "ACTIVE",
    });

    expect(resolveActivePrincipal(factory)).toMatchObject({
      role: "HRD_FACTORY",
      companyId: "20",
    });
    expect(
      resolveActivePrincipal({ ...factory, accountCompanyStatus: "INACTIVE" }),
    ).toBeNull();
    expect(
      resolveActivePrincipal({
        ...factory,
        accountCompanyId: null,
        accountCompanyStatus: null,
      }),
    ).toBeNull();
    expect(
      resolveActivePrincipal({
        ...factory,
        employeeId: "101",
        employeeStatus: "ACTIVE",
        employeeCompanyId: "20",
        employeeCompanyStatus: "INACTIVE",
      }),
    ).toBeNull();
  });

  it("allows HRD_CENTER without employee or company scope", () => {
    expect(
      resolveActivePrincipal(
        activeEmployeeAccount({
          roleCode: "HRD_CENTER",
          employeeId: null,
          employeeStatus: null,
          employeeCompanyId: null,
          employeeCompanyStatus: null,
          accountCompanyId: null,
          accountCompanyStatus: null,
        }),
      ),
    ).toMatchObject({
      role: "HRD_CENTER",
      employeeId: null,
      companyId: null,
    });
  });
});
