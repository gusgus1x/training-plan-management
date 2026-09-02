import { config as loadEnvironment } from "dotenv";
import { expect, it } from "vitest";

const databaseTest = process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

/** Diagnostic: dump whatever permission state actually exists for training_plan_app on the new
 *  tables, plus role membership, since the plain CRUD check came back empty. Read-only. */
databaseTest("dump raw permission state for training_plan_app", async () => {
  loadEnvironment({ path: ".env", quiet: true });
  const { getPrismaClient, resetPrismaClient } = await import("../../app/lib/database/prisma");
  const prisma = getPrismaClient();

  try {
    const perms = await prisma.$queryRaw<unknown[]>`
      SELECT OBJECT_NAME(major_id) AS object_name, permission_name, state_desc
      FROM sys.database_permissions
      WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(N'training_plan_app')
        AND major_id IN (
            OBJECT_ID(N'dbo.assessment_submission'), OBJECT_ID(N'dbo.assessment_answer'),
            OBJECT_ID(N'dbo.evaluation_submission'), OBJECT_ID(N'dbo.evaluation_answer'),
            OBJECT_ID(N'dbo.training_plan_assessment_setting'),
            OBJECT_ID(N'dbo.assessment_question'), OBJECT_ID(N'dbo.assessment_choice'),
            OBJECT_ID(N'dbo.evaluation_question'), OBJECT_ID(N'dbo.evaluation_option')
        );
    `;
    // eslint-disable-next-line no-console
    console.log("permission rows:", JSON.stringify(perms, null, 2));

    const roles = await prisma.$queryRaw<unknown[]>`
      SELECT dp.name AS role_name
      FROM sys.database_role_members drm
      JOIN sys.database_principals dp ON dp.principal_id = drm.role_principal_id
      JOIN sys.database_principals m ON m.principal_id = drm.member_principal_id
      WHERE m.name = N'training_plan_app';
    `;
    // eslint-disable-next-line no-console
    console.log("roles:", JSON.stringify(roles, null, 2));

    expect(true).toBe(true);
  } finally {
    await resetPrismaClient();
  }
});
