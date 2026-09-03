// Which assessment/evaluation structures the running system actually exercises.
//
// Row counts plus counts of non-default values per suspect column. A column that is written but
// never read still shows values here; a column nothing writes shows zero, which is the stronger
// signal that a feature exists in the schema and nowhere else.
//
// Counts and column metadata only - never row values.
// Usage: node scripts/audit-assessment-evaluation-usage.mjs
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const TABLES = [
  "assessment_series",
  "assessment",
  "assessment_question",
  "assessment_choice",
  "assessment_submission",
  "assessment_answer",
  "evaluation_form",
  "evaluation_question",
  "evaluation_option",
  "evaluation_submission",
  "evaluation_answer",
];

// [table, column, "predicate that means this column is carrying real information"]
const COLUMNS = [
  ["assessment", "instructions", "instructions IS NOT NULL AND LEN(instructions) > 0"],
  ["assessment", "time_limit_minutes", "time_limit_minutes IS NOT NULL"],
  ["assessment", "version_note", "version_note IS NOT NULL AND LEN(version_note) > 0"],
  ["assessment_question", "question_type <> SINGLE_CHOICE", "question_type <> 'SINGLE_CHOICE'"],
  ["assessment_choice", "option_score", "option_score <> 0"],
  ["assessment_submission", "publication_status = PUBLISHED", "publication_status = 'PUBLISHED'"],
  ["assessment_submission", "reopened_by", "reopened_by IS NOT NULL"],
  ["assessment_submission", "status = IN_PROGRESS", "status = 'IN_PROGRESS'"],
  ["assessment_answer", "review_comment", "review_comment IS NOT NULL AND LEN(review_comment) > 0"],
  ["assessment_answer", "answer_text", "answer_text IS NOT NULL AND LEN(answer_text) > 0"],
  ["evaluation_form", "description", "description IS NOT NULL AND LEN(description) > 0"],
  ["evaluation_question", "section_name", "section_name IS NOT NULL"],
  ["evaluation_question", "question_type <> RATING", "question_type <> 'RATING'"],
  ["evaluation_option", "option_value", "option_value IS NOT NULL"],
  ["evaluation_submission", "status = IN_PROGRESS", "status = 'IN_PROGRESS'"],
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
    const one = async (query) => (await pool.request().query(query)).recordset[0].n;

    console.log("row counts\n");
    const counts = {};
    for (const table of TABLES) {
      counts[table] = await one(`SELECT COUNT(*) AS n FROM dbo.${table}`);
      console.log(`  ${table.padEnd(24)} ${String(counts[table]).padStart(6)}`);
    }

    console.log("\ncolumns carrying real values\n");
    for (const [table, label, predicate] of COLUMNS) {
      if (counts[table] === 0) {
        console.log(`  ${`${table}.${label}`.padEnd(52)} (table empty)`);
        continue;
      }
      const n = await one(`SELECT COUNT(*) AS n FROM dbo.${table} WHERE ${predicate}`);
      console.log(`  ${`${table}.${label}`.padEnd(52)} ${String(n).padStart(5)} / ${counts[table]}`);
    }
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
