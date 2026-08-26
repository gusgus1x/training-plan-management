import { randomInt } from "node:crypto";
import { config as loadEnvironment } from "dotenv";
import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { createUpdateEmployeeHandler } from "../../app/api/master-data/employees/[employeeId]/route";
import { createSessionToken } from "../../app/lib/auth/session";
import {
  protectNationalId,
  revealNationalId,
} from "../../app/lib/employees/nationalId";

const run = process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

const withChecksum = (firstTwelveDigits: string) => {
  const sum = [...firstTwelveDigits].reduce(
    (total, digit, index) => total + Number(digit) * (13 - index),
    0,
  );
  return `${firstTwelveDigits}${(11 - (sum % 11)) % 10}`;
};

const withoutMatchingChecksum = (firstTwelveDigits: string) => {
  const validValue = withChecksum(firstTwelveDigits);
  const differentLastDigit = (Number(validValue.at(-1)) + 1) % 10;
  return `${firstTwelveDigits}${differentLastDigit}`;
};

const patchNationalId = (
  employeeId: string,
  token: string,
  nationalId: string,
) =>
  createUpdateEmployeeHandler()(
    new NextRequest(
      `http://localhost/api/master-data/employees/${employeeId}`,
      {
        method: "PATCH",
        headers: {
          cookie: `tpm_session=${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ nationalId }),
      },
    ),
    { params: Promise.resolve({ employeeId }) },
  );

run(
  "changes and re-encrypts a National ID through an HRD_CENTER session",
  async () => {
    loadEnvironment({ path: ".env.local", quiet: true });
    loadEnvironment({ path: ".env", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const prisma = getPrismaClient();
    const [account, employee] = await Promise.all([
      prisma.user_account.findFirst({
        where: {
          status: "ACTIVE",
          role: { role_code: "HRD_CENTER", status: "ACTIVE" },
        },
        select: { user_id: true },
      }),
      prisma.employee.findFirst({
        where: {
          national_id_encrypted: { not: null },
          national_id_key_version: { not: null },
        },
        orderBy: { employee_id: "asc" },
        select: {
          employee_id: true,
          national_id_encrypted: true,
          national_id_key_version: true,
        },
      }),
    ]);

    expect(account).not.toBeNull();
    expect(employee).not.toBeNull();
    if (
      !account ||
      !employee?.national_id_encrypted ||
      !employee.national_id_key_version
    ) {
      return;
    }

    const employeeId = employee.employee_id.toString();
    const originalNationalId = revealNationalId(
      employee.national_id_encrypted,
      employee.national_id_key_version,
    );
    let replacementNationalId = "";
    let replacementHash = "";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const firstTwelveDigits = `8${randomInt(100_000_000_000)
        .toString()
        .padStart(11, "0")}`;
      const candidate = withoutMatchingChecksum(firstTwelveDigits);
      const candidateHash = protectNationalId(candidate).hash;
      const conflict = await prisma.employee.findFirst({
        where: { national_id_hash: candidateHash },
        select: { employee_id: true },
      });
      if (!conflict) {
        replacementNationalId = candidate;
        replacementHash = candidateHash;
        break;
      }
    }
    expect(replacementNationalId).toHaveLength(13);

    const token = createSessionToken(account.user_id.toString());
    try {
      const response = await patchNationalId(
        employeeId,
        token,
        replacementNationalId,
      );
      expect(response.status).toBe(200);

      const updated = await prisma.employee.findUnique({
        where: { employee_id: employee.employee_id },
        select: {
          national_id_hash: true,
          national_id_last4: true,
          national_id_encrypted: true,
        },
      });
      expect(updated?.national_id_hash).toBe(replacementHash);
      expect(updated?.national_id_last4).toBe(replacementNationalId.slice(-4));
      expect(Buffer.from(updated?.national_id_encrypted ?? []).includes(
        Buffer.from(replacementNationalId),
      )).toBe(false);
    } finally {
      await patchNationalId(employeeId, token, originalNationalId);
      await resetPrismaClient();
    }
  },
  30_000,
);

run(
  "saves Employee 1 with the same payload sent by the Edit form",
  async () => {
    loadEnvironment({ path: ".env.local", quiet: true });
    loadEnvironment({ path: ".env", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const prisma = getPrismaClient();
    const [account, employee] = await Promise.all([
      prisma.user_account.findFirst({
        where: {
          status: "ACTIVE",
          role: { role_code: "HRD_CENTER", status: "ACTIVE" },
        },
        select: { user_id: true },
      }),
      prisma.employee.findUnique({ where: { employee_id: BigInt(1) } }),
    ]);
    expect(account).not.toBeNull();
    expect(employee).not.toBeNull();
    if (!account || !employee) return;

    const originalNationalIdBundle = {
      national_id_hash: employee.national_id_hash,
      national_id_encrypted: employee.national_id_encrypted,
      national_id_last4: employee.national_id_last4,
      national_id_key_version: employee.national_id_key_version,
    };
    const firstTwelveDigits = `8${randomInt(100_000_000_000)
      .toString()
      .padStart(11, "0")}`;
    const replacementNationalId = withoutMatchingChecksum(firstTwelveDigits);
    const token = createSessionToken(account.user_id.toString());

    try {
      const response = await createUpdateEmployeeHandler()(
        new NextRequest("http://localhost/api/master-data/employees/1", {
          method: "PATCH",
          headers: {
            cookie: `tpm_session=${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            companyId: employee.company_id.toString(),
            employeeCode: employee.employee_code,
            functionId: employee.function_id?.toString() ?? null,
            positionId: employee.position_id?.toString() ?? null,
            levelId: employee.level_id?.toString() ?? null,
            nationalId: replacementNationalId,
            titleTh: employee.title_th,
            titleEn: employee.title_en,
            firstNameTh: employee.first_name_th,
            lastNameTh: employee.last_name_th,
            firstNameEn: employee.first_name_en,
            lastNameEn: employee.last_name_en,
            birthDate: employee.birth_date?.toISOString().slice(0, 10) ?? null,
            hireDate: employee.hire_date?.toISOString().slice(0, 10) ?? null,
            telephone: employee.telephone,
            email: employee.email,
            employmentStatus: employee.employment_status,
          }),
        }),
        { params: Promise.resolve({ employeeId: "1" }) },
      );
      const body = await response.clone().json();
      expect(response.status, JSON.stringify(body)).toBe(200);
    } finally {
      await prisma.employee.update({
        where: { employee_id: employee.employee_id },
        data: originalNationalIdBundle,
      });
      await resetPrismaClient();
    }
  },
  30_000,
);
