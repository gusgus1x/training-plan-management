// For each training plan that has attendees, says which paper each stage actually runs and what it
// totals - the exact chain the Training Result screen reads to fill the "of" box.
//
// Structure only: plan code, stage mode, assessment id, question count, total marks. No answers,
// no scores, no names.
// Usage: node scripts/check-plan-assessment-totals.mjs
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
    const { recordset } = await pool.request().query(`
      WITH assessment_total AS (
        SELECT q.assessment_id,
               COUNT(*) AS scored_questions,
               SUM(q.question_score) AS total_score
        FROM dbo.assessment_question AS q
        WHERE q.question_type NOT IN (N'SECTION_BREAK', N'TEXT_BLOCK')
        GROUP BY q.assessment_id
      )
      SELECT
        p.plan_id,
        p.plan_code,
        (SELECT COUNT(*) FROM dbo.training_enrollment e WHERE e.plan_id = p.plan_id) AS attendees,
        p.pre_assessment_id  AS batch_pre_id,
        c.pre_assessment_id  AS course_pre_id,
        CASE WHEN p.pre_test_link IS NULL OR LTRIM(RTRIM(p.pre_test_link)) = '' THEN 0 ELSE 1 END AS batch_pre_link,
        pre_t.scored_questions AS pre_questions,
        pre_t.total_score      AS pre_total,
        p.post_assessment_id AS batch_post_id,
        c.post_assessment_id AS course_post_id,
        post_t.scored_questions AS post_questions,
        post_t.total_score      AS post_total
      FROM dbo.training_plan AS p
      JOIN dbo.training_plan_oap AS o ON o.oap_plan_id = p.oap_plan_id
      JOIN dbo.course AS c ON c.course_id = o.course_id
      LEFT JOIN assessment_total AS pre_t
        ON pre_t.assessment_id = COALESCE(p.pre_assessment_id, c.pre_assessment_id)
      LEFT JOIN assessment_total AS post_t
        ON post_t.assessment_id = COALESCE(p.post_assessment_id, c.post_assessment_id)
      WHERE EXISTS (SELECT 1 FROM dbo.training_enrollment e WHERE e.plan_id = p.plan_id)
      ORDER BY p.plan_id DESC`);

    if (!recordset.length) console.log("(no plan has attendees)");
    for (const r of recordset) {
      console.log(`\nplan ${r.plan_id} ${r.plan_code}  attendees ${r.attendees}`);
      console.log(
        `  PRE   batch_id=${r.batch_pre_id ?? "-"} batch_link=${r.batch_pre_link} course_id=${r.course_pre_id ?? "-"}` +
          `  questions=${r.pre_questions ?? "-"} total=${r.pre_total ?? "-"}`,
      );
      console.log(
        `  POST  batch_id=${r.batch_post_id ?? "-"} course_id=${r.course_post_id ?? "-"}` +
          `  questions=${r.post_questions ?? "-"} total=${r.post_total ?? "-"}`,
      );
    }
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
