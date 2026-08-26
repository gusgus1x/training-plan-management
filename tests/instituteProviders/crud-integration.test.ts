import { config as loadEnvironment } from "dotenv";
import { expect, it } from "vitest";

const databaseMutationTest =
  process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

databaseMutationTest(
  "performs Institute/Provider CRUD through the application login",
  async () => {
    loadEnvironment({ path: ".env.local", quiet: true });
    loadEnvironment({ path: ".env", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const prisma = getPrismaClient();
    const suffix = Date.now().toString().slice(-9);
    const instituteProviderCode = `ZZIP${suffix}`;

    try {
      const created = await prisma.institute_provider.create({
        data: {
          institute_provider_code: instituteProviderCode,
          institute_provider_name: "Institute/Provider CRUD test",
          status: "ACTIVE",
        },
      });
      const updated = await prisma.institute_provider.update({
        where: { institute_provider_id: created.institute_provider_id },
        data: {
          institute_provider_name: "Institute/Provider CRUD updated",
          status: "INACTIVE",
        },
      });
      await prisma.institute_provider.delete({
        where: { institute_provider_id: created.institute_provider_id },
      });

      expect(updated.institute_provider_name).toBe(
        "Institute/Provider CRUD updated",
      );
      expect(updated.status).toBe("INACTIVE");
      await expect(
        prisma.institute_provider.count({
          where: { institute_provider_code: instituteProviderCode },
        }),
      ).resolves.toBe(0);
    } finally {
      await prisma.institute_provider
        .deleteMany({ where: { institute_provider_code: instituteProviderCode } })
        .catch(() => undefined);
      await resetPrismaClient();
    }
  },
);
