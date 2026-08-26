import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import type { EmployeeRepository } from "../../app/lib/employees/repository";
import { createEmployeeService } from "../../app/lib/employees/service";
import type { EmployeeRecord } from "../../app/lib/employees/types";

const principal: AuthenticatedPrincipal = {
  userId: "9",
  username: "center",
  role: "HRD_CENTER",
  companyId: null,
  employeeId: null,
  employeeUserId: null,
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

const current: EmployeeRecord = {
  employeeId: "1",

  companyId: "1",
  companyCode: "CENTER",
  employeeCode: "CENTER-001",
  userId: "CENTER-001-UID",
  functionId: null,
  functionCode: null,
  functionName: null,
  divisionId: null,
  divisionCode: null,
  divisionName: null,
  departmentId: null,
  departmentCode: null,
  departmentName: null,
  sectionId: null,
  sectionCode: null,
  sectionName: null,
  positionId: null,
  positionCode: null,
  positionName: null,
  levelId: null,
  levelCode: null,
  levelKey: null,
  titleTh: "นาย",
  titleEn: "Mr.",
  firstNameTh: "ทดสอบ",
  lastNameTh: "ระบบ",
  firstNameEn: "System",
  lastNameEn: "Test",
  birthDate: null,
  hireDate: null,
  telephone: null,
  email: null,
  employmentStatus: "ACTIVE",
  nationalIdMasked: "*************",
};

beforeAll(() => {
  process.env.NATIONAL_ID_HMAC_KEY = randomBytes(32).toString("base64");
  process.env.NATIONAL_ID_ACTIVE_KEY_VERSION = "1";
  process.env.NATIONAL_ID_ENCRYPTION_KEY_V1 = randomBytes(32).toString("base64");
});

const repository = () => {
  const update = vi.fn().mockResolvedValue(current);
  return {
    repo: {
      findById: vi.fn().mockResolvedValue(current),
      bundle: vi.fn().mockResolvedValue({
        employee_id: BigInt(1),
        company_id: BigInt(1),
        national_id_encrypted: null,
        national_id_key_version: null,
      }),
      referencesExist: vi.fn().mockResolvedValue(true),
      conflict: vi.fn().mockResolvedValue(null),
      update,
    } as unknown as EmployeeRepository,
    update,
  };
};

describe("legacy Employee National ID update", () => {
  it("accepts a new National ID when the old encryption bundle is missing", async () => {
    const { repo, update } = repository();

    await createEmployeeService(repo).update(principal, "1", {
      nationalId: "1101700207030",
    });

    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0]?.[2]).toMatchObject({
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      last4: "7030",
      keyVersion: 1,
    });
  });

  it("requests a National ID when editing a legacy record without one", async () => {
    const { repo } = repository();

    await expect(
      createEmployeeService(repo).update(principal, "1", {
        firstNameEn: "Updated",
      }),
    ).rejects.toMatchObject({ code: "NATIONAL_ID_REQUIRED", status: 400 });
  });
});
