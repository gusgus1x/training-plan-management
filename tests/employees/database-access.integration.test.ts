import { config as loadEnvironment } from "dotenv";
import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { createRevealNationalIdHandler } from "../../app/api/master-data/employee-national-ids/[employeeId]/route";
import { SESSION_COOKIE_NAME } from "../../app/lib/auth/session";
import type {
  AuthenticatedPrincipal,
  RoleCode,
} from "../../app/lib/auth/types";
import { isValidThaiNationalId } from "../../app/lib/employees/nationalId";

const run = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? it : it.skip;
const principal = (
  role: RoleCode,
  companyId: string | null,
  employeeId: string | null = null,
): AuthenticatedPrincipal => ({
  userId: "1",
  username: "test",
  role,
  companyId,
  employeeId,
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
});

run("reveals every encrypted National ID through center access", async () => {
  loadEnvironment({ path: ".env.local", quiet: true });
  const { employeeService } = await import("../../app/lib/employees/service");
  const { getPrismaClient, resetPrismaClient } = await import(
    "../../app/lib/database/prisma"
  );
  const employees = await getPrismaClient().employee.findMany({
    select: { employee_id: true },
    orderBy: { employee_id: "asc" },
  });

  try {
    expect(employees).toHaveLength(30);
    for (const employee of employees) {
      const revealed = await employeeService.reveal(
        principal("HRD_CENTER", null),
        String(employee.employee_id),
      );
      expect(revealed.nationalId).toMatch(/^\d{13}$/);
      expect(isValidThaiNationalId(revealed.nationalId)).toBe(true);
    }
  } finally {
    await resetPrismaClient();
  }
}, 30_000);

run("enforces employee and factory reveal scope", async () => {
  loadEnvironment({ path: ".env.local", quiet: true });
  const { employeeService } = await import("../../app/lib/employees/service");
  const { getPrismaClient, resetPrismaClient } = await import(
    "../../app/lib/database/prisma"
  );
  const first = await getPrismaClient().employee.findFirstOrThrow({
    orderBy: { employee_id: "asc" },
  });

  try {
    const id = String(first.employee_id);
    const center = await employeeService.reveal(
      principal("HRD_CENTER", null),
      id,
    );
    await expect(
      employeeService.reveal(
        principal("EMPLOYEE", String(first.company_id), id),
        id,
      ),
    ).resolves.toEqual(center);
    await expect(
      employeeService.reveal(
        principal("HRD_FACTORY", String(first.company_id)),
        id,
      ),
    ).resolves.toEqual(center);
  } finally {
    await resetPrismaClient();
  }
}, 30_000);

run("returns the full National ID through the protected dynamic route", async () => {
  loadEnvironment({ path: ".env.local", quiet: true });
  const { getPrismaClient, resetPrismaClient } = await import(
    "../../app/lib/database/prisma"
  );
  const first = await getPrismaClient().employee.findFirstOrThrow({
    orderBy: { employee_id: "asc" },
  });
  const center = principal("HRD_CENTER", null);
  const handler = createRevealNationalIdHandler({
    auth: {
      verifyToken: () => ({
        version: 1,
        userId: "1",
        issuedAt: 100,
        lastSeenAt: 200,
    bootId: "test-boot-id",
      }),
      revalidate: async () => center,
      rollToken: () => "rolled-token",
      production: false,
    },
  });
  const request = new NextRequest(
    `http://localhost/api/master-data/employee-national-ids/${first.employee_id}`,
    { headers: { cookie: `${SESSION_COOKIE_NAME}=valid-token` } },
  );

  try {
    const response = await handler(request, {
      params: Promise.resolve({ employeeId: String(first.employee_id) }),
    });
    const body = (await response.json()) as {
      ok: boolean;
      data?: { nationalId?: string };
    };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.nationalId).toMatch(/^\d{13}$/);
  } finally {
    await resetPrismaClient();
  }
}, 30_000);
