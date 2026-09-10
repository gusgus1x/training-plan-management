// Sizes up the damage from migration 41 running more than once, and checks that the repair source
// is intact.
//
// Each extra run multiplied every stored score by (total marks / 100) again. The marks awarded per
// answer were never touched, so assessment_answer.score_awarded is the authority the repair reads.
//
// Counts and comparisons only - it never prints anybody's score.
// Usage: node scripts/check-score-damage.mjs
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
    const state = await pool.request().query(`
      WITH assessment_total AS (
        SELECT q.assessment_id, SUM(q.question_score) AS total_score
        FROM dbo.assessment_question AS q
        WHERE q.question_type NOT IN (N'SECTION_BREAK', N'TEXT_BLOCK')
        GROUP BY q.assessment_id
      ),
      awarded AS (
        SELECT a.submission_id, SUM(ISNULL(a.score_awarded, 0)) AS marks
        FROM dbo.assessment_answer AS a
        GROUP BY a.submission_id
      )
      SELECT
        COUNT(*) AS scored_submissions,
        SUM(CASE WHEN s.score > t.total_score THEN 1 ELSE 0 END) AS score_above_full_marks,
        SUM(CASE WHEN ABS(s.score - ISNULL(w.marks, 0)) < 0.005 THEN 1 ELSE 0 END) AS score_matches_answers,
        SUM(CASE WHEN w.submission_id IS NULL THEN 1 ELSE 0 END) AS no_answer_rows
      FROM dbo.assessment_submission AS s
      JOIN assessment_total AS t ON t.assessment_id = s.assessment_id
      LEFT JOIN awarded AS w ON w.submission_id = s.submission_id
      WHERE s.score IS NOT NULL`);
    const row = state.recordset[0];
    console.log("=== assessment_submission ===");
    console.log(`  submissions carrying a score      ${row.scored_submissions}`);
    console.log(`  score ABOVE the paper's full marks ${row.score_above_full_marks}   <- impossible; damage`);
    console.log(`  score already equal to its answers ${row.score_matches_answers}   <- already correct`);
    console.log(`  no answer rows to rebuild from     ${row.no_answer_rows}   <- must be 0 to repair`);

    const results = await pool.request().query(`
      SELECT
        SUM(CASE WHEN r.pre_score IS NOT NULL AND r.official_pre_submission_id IS NOT NULL THEN 1 ELSE 0 END) AS pre_from_form,
        SUM(CASE WHEN r.pre_score IS NOT NULL AND r.official_pre_submission_id IS NULL THEN 1 ELSE 0 END) AS pre_typed_by_hand,
        SUM(CASE WHEN r.post_score IS NOT NULL AND r.official_post_submission_id IS NOT NULL THEN 1 ELSE 0 END) AS post_from_form,
        SUM(CASE WHEN r.post_score IS NOT NULL AND r.official_post_submission_id IS NULL THEN 1 ELSE 0 END) AS post_typed_by_hand
      FROM dbo.training_result AS r`);
    const r = results.recordset[0];
    console.log("\n=== training_result ===");
    console.log(`  pre  from an in-system form  ${r.pre_from_form}   <- repairable from the submission`);
    console.log(`  pre  typed by hand           ${r.pre_typed_by_hand}   <- never converted, untouched`);
    console.log(`  post from an in-system form  ${r.post_from_form}`);
    console.log(`  post typed by hand           ${r.post_typed_by_hand}`);
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
