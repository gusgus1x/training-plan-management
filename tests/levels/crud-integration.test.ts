import { config as loadEnvironment } from "dotenv";
import { expect, it } from "vitest";

const databaseMutationTest =
  process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

databaseMutationTest(
  "performs Level CRUD through the application login",
  async () => {
    loadEnvironment({ path: ".env.local", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const prisma = getPrismaClient();
    const suffix = Date.now().toString().slice(-8);
    const code = `Z${suffix}`;
    const key = `ท${suffix}`;
    try {
      const created = await prisma.employee_level.create({
        data: {
          level_code: code,
          level_code_th: "ท",
          level_code_en: "Z",
          level_name_th: "Level CRUD test",
          level_name_en: "Level CRUD test",
          pl: suffix,
          level_key: key,
          remark: "created",
          status: "ACTIVE",
        },
      });
      const updated = await prisma.employee_level.update({
        where: { level_id: created.level_id },
        data: { remark: "updated", status: "INACTIVE" },
      });
      await prisma.employee_level.delete({
        where: { level_id: created.level_id },
      });
      expect(updated.remark).toBe("updated");
      expect(updated.status).toBe("INACTIVE");
      await expect(
        prisma.employee_level.count({ where: { level_code: code } }),
      ).resolves.toBe(0);
    } finally {
      await prisma.employee_level
        .deleteMany({ where: { level_code: code } })
        .catch(() => undefined);
      await resetPrismaClient();
    }
  },
);
