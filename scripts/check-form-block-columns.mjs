// Reads the CHECK constraints and new-column state for migration
// 37_Add_Form_Sections_And_Text_Blocks.sql.
//
// Step 1 of the section/text-block work needs the CURRENT definition of the question_type CHECK
// constraint on assessment_question, because that definition is not in the repo (it came from the
// base schema) and the migration has to recreate it with two extra members. Guessing its text
// would silently drop whatever else it asserts.
//
// Metadata only — sys.check_constraints and sys.columns. Never row values.
// Usage: node scripts/check-form-block-columns.mjs
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const NEW_COLUMNS = [
  // migration 37 - sections and text blocks
  ["evaluation_question", "question_description"],
  ["evaluation_question", "next_section"],
  ["evaluation_option", "next_section"],
  ["assessment_question", "question_description"],
  ["assessment_question", "next_section"],
  ["assessment_choice", "next_section"],
  // migration 38 - grid questions
  ["evaluation_option", "axis"],
  ["assessment_choice", "axis"],
  ["evaluation_answer", "row_option_id"],
  ["assessment_answer", "row_choice_id"],
];

const CONSTRAINT_TABLES = [
  "assessment_question", "assessment_choice", "assessment_answer",
  "evaluation_question", "evaluation_option", "evaluation_answer",
];

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
    console.log("=== CHECK constraints on the four question/option tables ===");
    const checks = await pool.request().query(`
      SELECT OBJECT_NAME(cc.parent_object_id) AS table_name, cc.name, cc.definition, cc.is_disabled
      FROM sys.check_constraints cc
      WHERE cc.parent_object_id IN (${CONSTRAINT_TABLES.map((t) => `OBJECT_ID(N'dbo.${t}')`).join(", ")})
      ORDER BY table_name, cc.name`);
    if (!checks.recordset.length) console.log("  (none)");
    for (const row of checks.recordset) {
      console.log(`\n  ${row.table_name}.${row.name}${row.is_disabled ? "  [DISABLED]" : ""}`);
      console.log(`    ${row.definition}`);
    }

    console.log("\n=== Migration 37 column state ===");
    for (const [table, column] of NEW_COLUMNS) {
      const { recordset } = await pool.request().query(`
        SELECT COUNT(*) AS n FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.${table}') AND name = N'${column}'`);
      console.log(`  ${recordset[0].n ? "present " : "MISSING "} ${table}.${column}`);
    }

    // A legacy-section conversion only matters if real forms actually populated section_name.
    const legacy = await pool.request().query(`
      SELECT COUNT(*) AS rows_with_section, COUNT(DISTINCT evaluation_form_id) AS forms
      FROM dbo.evaluation_question WHERE section_name IS NOT NULL`);
    const { rows_with_section, forms } = legacy.recordset[0];
    console.log(`\n=== Legacy section_name ===\n  ${rows_with_section} question rows across ${forms} forms`);
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
