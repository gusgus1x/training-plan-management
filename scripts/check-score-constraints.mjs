// Reads the CHECK constraints on the score columns before migration 42 moves them from percentages
// to marks. A constraint asserting 0-100 would refuse a mark out of 200 and has to be replaced.
//
// Metadata only - sys.check_constraints and sys.columns. Never row values.
// Usage: node scripts/check-score-constraints.mjs
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const TABLES = ["assessment_submission", "training_result", "assessment_answer", "assessment_question"];

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
    const checks = await pool.request().query(`
      SELECT OBJECT_NAME(parent_object_id) AS table_name, name, definition, is_disabled
      FROM sys.check_constraints
      WHERE parent_object_id IN (${TABLES.map((t) => `OBJECT_ID(N'dbo.${t}')`).join(", ")})
      ORDER BY table_name, name`);
    console.log("=== CHECK constraints ===");
    for (const row of checks.recordset) {
      console.log(`  ${row.table_name}.${row.name}${row.is_disabled ? "  [DISABLED]" : ""}`);
      console.log(`    ${row.definition}`);
    }

    const columns = await pool.request().query(`
      SELECT OBJECT_NAME(object_id) AS table_name, name, TYPE_NAME(system_type_id) AS type_name,
             precision, scale, is_nullable
      FROM sys.columns
      WHERE object_id IN (${TABLES.map((t) => `OBJECT_ID(N'dbo.${t}')`).join(", ")})
        AND name LIKE '%score%'
      ORDER BY table_name, name`);
    console.log("\n=== score columns ===");
    for (const row of columns.recordset) {
      console.log(
        `  ${row.table_name}.${row.name}  ${row.type_name}(${row.precision},${row.scale})  ${row.is_nullable ? "NULL" : "NOT NULL"}`,
      );
    }

    // Counts only, so the migration knows how much it will touch.
    const counts = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.assessment_submission WHERE score IS NOT NULL) AS submissions_with_score,
        (SELECT COUNT(*) FROM dbo.training_result WHERE pre_score IS NOT NULL OR post_score IS NOT NULL) AS results_with_score,
        (SELECT COUNT(*) FROM dbo.training_result WHERE official_pre_submission_id IS NOT NULL) AS results_with_official_pre,
        (SELECT COUNT(*) FROM dbo.training_result WHERE official_post_submission_id IS NOT NULL) AS results_with_official_post`);
    const row = counts.recordset[0];
    console.log("\n=== How much migration 42 would convert ===");
    console.log(`  assessment_submission with a score   ${row.submissions_with_score}`);
    console.log(`  training_result with a score         ${row.results_with_score}`);
    console.log(`  ... of which name an official pre    ${row.results_with_official_pre}`);
    console.log(`  ... of which name an official post   ${row.results_with_official_post}`);
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
