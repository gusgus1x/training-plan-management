import { config as loadEnvironment } from "dotenv";
import { expect, it } from "vitest";

const databaseMutationTest =
  process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

databaseMutationTest(
  "performs Position CRUD through the application login",
  async () => {
    loadEnvironment({ path: ".env.local", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const prisma = getPrismaClient();
    const suffix = Date.now().toString().slice(-9);
    const positionCode = `ZZPOS${suffix}`;

    try {
      const created = await prisma.position.create({
        data: {
          position_code: positionCode,
          position_name_th: "Position CRUD test",
          position_name_en: "Position CRUD test",
          status: "ACTIVE",
        },
      });
      const updated = await prisma.position.update({
        where: { position_id: created.position_id },
        data: {
          position_name_th: "Position CRUD updated",
          status: "INACTIVE",
        },
      });
      await prisma.position.delete({
        where: { position_id: created.position_id },
      });

      expect(updated.position_name_th).toBe("Position CRUD updated");
      expect(updated.status).toBe("INACTIVE");
      await expect(
        prisma.position.count({ where: { position_code: positionCode } }),
      ).resolves.toBe(0);
    } finally {
      await prisma.position
        .deleteMany({ where: { position_code: positionCode } })
        .catch(() => undefined);
      await resetPrismaClient();
    }
  },
);
