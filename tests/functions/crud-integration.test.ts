import { config as loadEnvironment } from "dotenv";
import { expect, it } from "vitest";

const databaseMutationTest =
  process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

databaseMutationTest(
  "performs Function and Mapping CRUD through the application login",
  async () => {
    loadEnvironment({ path: ".env", quiet: true });
    loadEnvironment({ path: ".env.local", quiet: true });
    const { getPrismaClient, resetPrismaClient } = await import(
      "../../app/lib/database/prisma"
    );
    const prisma = getPrismaClient();
    const suffix = Date.now().toString().slice(-9);
    const functionCode = `ZZFN${suffix}`;
    const plantCode = `ZZMAP${suffix}`;

    try {
      const company = await prisma.company.findFirstOrThrow({
        orderBy: { company_id: "asc" },
      });
      const central = await prisma.organization_function.create({
        data: {
          function_code: functionCode,
          function_name_th: "Function CRUD test",
          function_name_en: "Function CRUD test",
          status: "ACTIVE",
        },
      });
      const mapping = await prisma.company_function_mapping.create({
        data: {
          company_id: company.company_id,
          plant_function_code: plantCode,
          plant_function_name: "Mapping CRUD test",
          function_id: central.function_id,
          status: "ACTIVE",
        },
      });
      const updated = await prisma.company_function_mapping.update({
        where: { function_mapping_id: mapping.function_mapping_id },
        data: { plant_function_name: "Mapping updated" },
      });
      await prisma.company_function_mapping.delete({
        where: { function_mapping_id: mapping.function_mapping_id },
      });
      await prisma.organization_function.delete({
        where: { function_id: central.function_id },
      });

      expect(updated.plant_function_name).toBe("Mapping updated");
      await expect(
        prisma.organization_function.count({
          where: { function_code: functionCode },
        }),
      ).resolves.toBe(0);
    } finally {
      await prisma.company_function_mapping
        .deleteMany({ where: { plant_function_code: plantCode } })
        .catch(() => undefined);
      await prisma.organization_function
        .deleteMany({ where: { function_code: functionCode } })
        .catch(() => undefined);
      await resetPrismaClient();
    }
  },
);
