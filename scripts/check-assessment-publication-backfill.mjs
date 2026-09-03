// Verifies migration 34_Backfill_Assessment_Publication_Status.sql landed.
//
// The backfill releases every submission that was already graded before the release-grades feature
// existed. What proves it ran: no submission is left GRADED-but-UNPUBLISHED. Rows that are still
// unpublished are fine ONLY if they are still waiting on a human to grade a written answer.
//
// Counts and column metadata only — never row values.
// Usage: node scripts/check-assessment-publication-backfill.mjs
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const run = async () => {
  const pool = await sql.connect({
    server: process.env.DB_INSTANCE
      ? `${required("DB_SERVER")}\\${process.env.DB_INSTANCE}`
      : required("DB_SERVER"),
    database: required("DB_DATABASE"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    options: {
      encrypt: process.env.DB_ENCRYPT === "true",
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
    },
  });

  try {
    const one = async (query) => (await pool.request().query(query)).recordset[0].n;

    const columnExists = await one(`
      SELECT COUNT(*) AS n FROM sys.columns
      WHERE object_id = OBJECT_ID(N'dbo.assessment_submission') AND name = N'publication_status'`);
    if (!columnExists) {
      console.log("publication_status column is missing — the schema itself is behind.");
      process.exitCode = 1;
      return;
    }

    const total = await one("SELECT COUNT(*) AS n FROM dbo.assessment_submission");
    const published = await one(`
      SELECT COUNT(*) AS n FROM dbo.assessment_submission WHERE publication_status = 'PUBLISHED'`);
    const submitted = await one(`
      SELECT COUNT(*) AS n FROM dbo.assessment_submission WHERE submitted_at IS NOT NULL`);
    // The exact set the migration targets. Zero means it ran (or there was nothing to fix).
    const stillPending = await one(`
      SELECT COUNT(*) AS n FROM dbo.assessment_submission
      WHERE publication_status <> 'PUBLISHED'
        AND grading_status = 'REVIEWED'
        AND submitted_at IS NOT NULL`);
    const awaitingGrading = await one(`
      SELECT COUNT(*) AS n FROM dbo.assessment_submission
      WHERE publication_status <> 'PUBLISHED' AND grading_status = 'PENDING_REVIEW'`);

    console.log("assessment_submission publication state\n");
    console.log(`  submissions total        ${total}`);
    console.log(`  submitted                ${submitted}`);
    console.log(`  published                ${published}`);
    console.log(`  awaiting HRD grading     ${awaitingGrading}   (correctly unpublished)`);
    console.log(`  graded but NOT released  ${stillPending}   <- migration target, must be 0\n`);

    if (stillPending > 0) {
      console.log(`NOT APPLIED: ${stillPending} graded submissions would have their score hidden from employees.`);
      process.exitCode = 1;
    } else {
      console.log("APPLIED: no graded submission is left unreleased.");
    }
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
