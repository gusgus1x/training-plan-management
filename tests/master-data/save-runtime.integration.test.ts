import { config as loadEnvironment } from "dotenv";
import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { createUpdateCompanyHandler } from "../../app/api/master-data/companies/[companyId]/route";
import { createUpdateEmployeeHandler } from "../../app/api/master-data/employees/[employeeId]/route";
import { createUpdateFunctionHandler } from "../../app/api/master-data/functions/[functionId]/route";
import { createUpdateLevelHandler } from "../../app/api/master-data/levels/[levelId]/route";
import { createUpdatePositionHandler } from "../../app/api/master-data/positions/[positionId]/route";
import { createSessionToken } from "../../app/lib/auth/session";

const run = process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

const patchRequest = (path: string, token: string, body: unknown) =>
  new NextRequest(`http://localhost${path}`, {
    method: "PATCH",
    headers: {
      cookie: `tpm_session=${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

run(
  "updates all API-backed Master Data through a real HRD_CENTER session",
  async () => {
    loadEnvironment({ path: ".env.local", quiet: true });
    loadEnvironment({ path: ".env", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const prisma = getPrismaClient();
    const [account, company, fn, position, level, employee] = await Promise.all([
      prisma.user_account.findFirst({
        where: {
          status: "ACTIVE",
          role: { role_code: "HRD_CENTER", status: "ACTIVE" },
        },
        select: { user_id: true },
      }),
      prisma.company.findFirst({ orderBy: { company_id: "asc" } }),
      prisma.organization_function.findFirst({
        orderBy: { function_id: "asc" },
      }),
      prisma.position.findFirst({ orderBy: { position_id: "asc" } }),
      prisma.employee_level.findFirst({ orderBy: { level_id: "asc" } }),
      prisma.employee.findFirst({ orderBy: { employee_id: "asc" } }),
    ]);

    expect(account).not.toBeNull();
    expect(company).not.toBeNull();
    expect(fn).not.toBeNull();
    expect(position).not.toBeNull();
    expect(level).not.toBeNull();
    expect(employee).not.toBeNull();
    if (!account || !company || !fn || !position || !level || !employee) return;

    const token = createSessionToken(account.user_id.toString());

    try {
      const responses = [
        await createUpdateCompanyHandler()(
          patchRequest(
            `/api/master-data/companies/${company.company_id}`,
            token,
            { remark: company.remark },
          ),
          { params: Promise.resolve({ companyId: company.company_id.toString() }) },
        ),
        await createUpdateFunctionHandler()(
          patchRequest(
            `/api/master-data/functions/${fn.function_id}`,
            token,
            { functionNameEn: fn.function_name_en },
          ),
          { params: Promise.resolve({ functionId: fn.function_id.toString() }) },
        ),
        await createUpdatePositionHandler()(
          patchRequest(
            `/api/master-data/positions/${position.position_id}`,
            token,
            { positionNameEn: position.position_name_en },
          ),
          { params: Promise.resolve({ positionId: position.position_id.toString() }) },
        ),
        await createUpdateLevelHandler()(
          patchRequest(
            `/api/master-data/levels/${level.level_id}`,
            token,
            { remark: level.remark },
          ),
          { params: Promise.resolve({ levelId: level.level_id.toString() }) },
        ),
        await createUpdateEmployeeHandler()(
          patchRequest(
            `/api/master-data/employees/${employee.employee_id}`,
            token,
            { telephone: employee.telephone },
          ),
          { params: Promise.resolve({ employeeId: employee.employee_id.toString() }) },
        ),
      ];

      expect(responses.map((response) => response.status)).toEqual([
        200, 200, 200, 200, 200,
      ]);
    } finally {
      await resetPrismaClient();
    }
  },
  30_000,
);
