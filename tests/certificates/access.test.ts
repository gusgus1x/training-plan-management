import { describe, expect, it } from "vitest";
import { createCertificateRepository } from "../../app/lib/certificates/repository";

/**
 * Who is allowed to read a certificate's bytes. This is the whole privacy story of the feature:
 * the files sit outside public/ precisely so that this check is the only way in.
 */

type FileRow = {
  status?: string;
  mapping_status?: string;
  enrollmentEmployeeUserId?: string | null;
  enrollmentEmployeeId?: string;
  planCompanyId?: string | null;
  unlinked?: boolean;
};

const buildRepository = (row: FileRow = {}) => {
  const file = {
    certificate_file_id: BigInt(1),
    storage_path: "42/cert.pdf",
    original_file_name_masked: "12345_x.pdf",
    file_size_bytes: BigInt(1024),
    status: row.status ?? "ACTIVE",
    mapping_status: row.mapping_status ?? "CONFIRMED",
    training_enrollment: row.unlinked
      ? null
      : {
          employee_user_id: row.enrollmentEmployeeUserId === undefined ? "u-1" : row.enrollmentEmployeeUserId,
          employee: { employee_id: BigInt(row.enrollmentEmployeeId ?? "500") },
          training_plan: {
            training_plan_oap: {
              company_id: row.planCompanyId === undefined ? BigInt(7) : row.planCompanyId === null ? null : BigInt(row.planCompanyId),
            },
          },
        },
  };

  const db = { training_certificate_file: { findUnique: async () => file } };
  return createCertificateRepository(db as unknown as Parameters<typeof createCertificateRepository>[0]);
};

const employee = (overrides: Partial<{ employeeId: string | null; employeeUserId: string | null }> = {}) => ({
  role: "EMPLOYEE",
  companyId: null,
  employeeId: overrides.employeeId === undefined ? "500" : overrides.employeeId,
  employeeUserId: overrides.employeeUserId === undefined ? "u-1" : overrides.employeeUserId,
});

describe("employee access", () => {
  it("allows the owner proven by employee_user_id alone", async () => {
    const repository = buildRepository();
    await expect(
      repository.loadFileForPrincipal("1", employee({ employeeId: null })),
    ).resolves.toMatchObject({ fileName: "12345_x.pdf" });
  });

  it("allows the owner proven by employee_id alone", async () => {
    const repository = buildRepository();
    await expect(
      repository.loadFileForPrincipal("1", employee({ employeeUserId: "someone-else" })),
    ).resolves.toMatchObject({ fileName: "12345_x.pdf" });
  });

  it("refuses when neither key matches", async () => {
    const repository = buildRepository();
    await expect(
      repository.loadFileForPrincipal("1", employee({ employeeId: "999", employeeUserId: "other" })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses an account with no keys against an enrollment with a null user id", async () => {
    // The null-equals-null trap: two absent values are not a proof of ownership.
    const repository = buildRepository({ enrollmentEmployeeUserId: null });
    await expect(
      repository.loadFileForPrincipal("1", employee({ employeeId: null, employeeUserId: null })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a draft certificate even to the person it is mapped to", async () => {
    // A draft is HRD's working copy and may still name the wrong person.
    const repository = buildRepository({ mapping_status: "MATCHED" });
    await expect(repository.loadFileForPrincipal("1", employee())).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a superseded certificate", async () => {
    const repository = buildRepository({ status: "SUPERSEDED" });
    await expect(repository.loadFileForPrincipal("1", employee())).rejects.toMatchObject({ status: 403 });
  });

  it("refuses one that is not linked to any enrollment", async () => {
    const repository = buildRepository({ unlinked: true });
    await expect(repository.loadFileForPrincipal("1", employee())).rejects.toMatchObject({ status: 403 });
  });
});

describe("HRD access", () => {
  const hrd = (role: string, companyId: string | null) => ({
    role,
    companyId,
    employeeId: null,
    employeeUserId: null,
  });

  it("allows a factory user inside their own company", async () => {
    const repository = buildRepository({ planCompanyId: "7" });
    await expect(repository.loadFileForPrincipal("1", hrd("HRD_FACTORY", "7"))).resolves.toBeTruthy();
  });

  it("refuses a factory user reaching into another company", async () => {
    const repository = buildRepository({ planCompanyId: "7" });
    await expect(repository.loadFileForPrincipal("1", hrd("HRD_FACTORY", "8"))).rejects.toMatchObject({
      status: 403,
    });
  });

  it("refuses a factory user when the plan is centre-owned and has no company", async () => {
    const repository = buildRepository({ planCompanyId: null });
    await expect(repository.loadFileForPrincipal("1", hrd("HRD_FACTORY", "7"))).rejects.toMatchObject({
      status: 403,
    });
  });

  it("allows centre to open any certificate, including a draft, for the eye preview", async () => {
    const repository = buildRepository({ mapping_status: "MATCHED", planCompanyId: "7" });
    await expect(repository.loadFileForPrincipal("1", hrd("HRD_CENTER", null))).resolves.toBeTruthy();
  });
});
