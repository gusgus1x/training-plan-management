import { config as loadEnvironment } from "dotenv";
import { expect, it } from "vitest";

const databaseTest =
  process.env.RUN_DATABASE_TESTS === "1" ? it : it.skip;

databaseTest(
  "connects through the Prisma SQL Server adapter without mutating data",
  async () => {
    loadEnvironment({ path: ".env.local", quiet: true });
    loadEnvironment({ path: ".env", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );

    try {
      const companyCount = await getPrismaClient().company.count();

      expect(companyCount).toBeGreaterThanOrEqual(0);
    } finally {
      await resetPrismaClient();
    }
  },
);
