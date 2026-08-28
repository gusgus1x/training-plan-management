import { config as loadEnvironment } from "dotenv";
import { expect, it } from "vitest";
import { NEED_REQUEST_STATUSES } from "../../app/lib/trainingNeedRequests/labels";

// Needs a live database, so it runs on the same gate as the mutation tests.
const databaseTest = process.env.RUN_DATABASE_MUTATION_TESTS === "1" ? it : it.skip;

/**
 * The Phase 24 defect: the code wrote REVIEW and ACCEPTED, which
 * CK_RC2_training_need_request_status_enum refuses, and nothing caught it because the table has no
 * rows and the unit tests only cover the validation layer. This reads the constraint itself rather
 * than inserting, so it needs no fixture row and cannot leave one behind.
 */
databaseTest("every status the app can write is allowed by the check constraint", async () => {
  loadEnvironment({ path: ".env", quiet: true });
  const { getPrismaClient, resetPrismaClient } = await import("../../app/lib/database/prisma");
  const prisma = getPrismaClient();

  try {
    const [constraint] = await prisma.$queryRaw<{ definition: string }[]>`
      SELECT definition
      FROM sys.check_constraints
      WHERE name = 'CK_RC2_training_need_request_status_enum'
    `;

    expect(constraint?.definition).toBeTruthy();
    const definition = constraint.definition.toUpperCase();

    for (const status of NEED_REQUEST_STATUSES) {
      expect(definition, `${status} must be accepted by the constraint`).toContain(`'${status}'`);
    }
    for (const removed of ["REVIEW", "ACCEPTED"]) {
      expect(definition, `${removed} is refused by the database`).not.toContain(`'${removed}'`);
    }
  } finally {
    await resetPrismaClient();
  }
});
