// Confirms migration 40_Add_Result_Score_Max.sql actually landed.
//
// Metadata only - sys.columns and sys.check_constraints, plus counts of how many results carry a
// denominator. Never row values.
// Usage: node scripts/check-result-score-max.mjs
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
    const columns = await pool.request().query(`
      SELECT name, TYPE_NAME(system_type_id) AS type_name, precision, scale, is_nullable
      FROM sys.columns
      WHERE object_id = OBJECT_ID(N'dbo.training_result')
        AND name IN (N'pre_score', N'pre_link_score_max', N'post_score', N'post_link_score_max')
      ORDER BY name`);
    console.log("=== training_result score columns ===");
    for (const row of columns.recordset) {
      console.log(
        `  ${row.name}  ${row.type_name}(${row.precision},${row.scale})  ${row.is_nullable ? "NULL" : "NOT NULL"}`,
      );
    }

    const checks = await pool.request().query(`
      SELECT name, definition, is_disabled
      FROM sys.check_constraints
      WHERE parent_object_id = OBJECT_ID(N'dbo.training_result')
        AND name LIKE '%score_max%'
      ORDER BY name`);
    console.log("\n=== CHECK constraints ===");
    if (!checks.recordset.length) console.log("  (none)");
    for (const row of checks.recordset) {
      console.log(`  ${row.name}${row.is_disabled ? "  [DISABLED]" : ""}  ${row.definition}`);
    }

    // Counts only. Nothing here reads anybody's mark.
    const counts = await pool.request().query(`
      SELECT COUNT(*) AS results,
             SUM(CASE WHEN pre_score IS NOT NULL THEN 1 ELSE 0 END) AS with_pre_score,
             SUM(CASE WHEN pre_link_score_max IS NOT NULL THEN 1 ELSE 0 END) AS with_pre_max,
             SUM(CASE WHEN post_score IS NOT NULL THEN 1 ELSE 0 END) AS with_post_score,
             SUM(CASE WHEN post_link_score_max IS NOT NULL THEN 1 ELSE 0 END) AS with_post_max
      FROM dbo.training_result`);
    const row = counts.recordset[0];
    console.log("\n=== How many results carry a denominator ===");
    console.log(`  results         ${row.results}`);
    console.log(`  pre  score/max  ${row.with_pre_score} / ${row.with_pre_max}`);
    console.log(`  post score/max  ${row.with_post_score} / ${row.with_post_max}`);
    console.log("\n  A score with no max is expected: nothing backfills a denominator nobody recorded.");
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
