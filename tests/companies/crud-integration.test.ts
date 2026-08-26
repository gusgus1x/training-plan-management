import { config as loadEnvironment } from "dotenv";
import { expect, it } from "vitest";

const databaseMutationTest =
  process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

databaseMutationTest(
  "creates, updates, and deletes an unreferenced company through the app login",
  async () => {
    loadEnvironment({ path: ".env.local", quiet: true });
    loadEnvironment({ path: ".env", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const companyCode = `ZZCRUD${Date.now().toString().slice(-10)}`;
    const prisma = getPrismaClient();

    try {
      const created = await prisma.company.create({
        data: {
          company_code: companyCode,
          company_name_th: "CRUD permission test",
          company_name_en: "CRUD permission test",
          remark: null,
          status: "ACTIVE",
        },
      });
      const updated = await prisma.company.update({
        where: { company_id: created.company_id },
        data: { remark: "updated" },
      });
      const deleted = await prisma.company.delete({
        where: { company_id: created.company_id },
      });

      expect(updated.remark).toBe("updated");
      expect(deleted.company_code).toBe(companyCode);
      await expect(
        prisma.company.count({ where: { company_code: companyCode } }),
      ).resolves.toBe(0);
    } finally {
      await prisma.company
        .deleteMany({ where: { company_code: companyCode } })
        .catch(() => undefined);
      await resetPrismaClient();
    }
  },
);
