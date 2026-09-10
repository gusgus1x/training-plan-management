// End-to-end consistency check for the assessment and evaluation flow.
//
// Every query counts rows or compares stored values against what they are derived from. It never
// prints a person's answer, a name, or a mark.
//
// Usage: node scripts/audit-assessment-evaluation-wiring.mjs
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

/** Each check: a name, the question it answers, and a query returning one `n`. */
const CHECKS = [
  {
    name: "assessment_submission.score disagrees with its own answers",
    why: "score is the sum of assessment_answer.score_awarded; a gap means a conversion or a regrade left it stale",
    query: `
      WITH awarded AS (
        SELECT submission_id, SUM(ISNULL(score_awarded, 0)) AS marks
        FROM dbo.assessment_answer GROUP BY submission_id
      )
      SELECT COUNT(*) AS n
      FROM dbo.assessment_submission s
      LEFT JOIN awarded w ON w.submission_id = s.submission_id
      WHERE s.score IS NOT NULL AND ABS(s.score - ISNULL(w.marks, 0)) > 0.005`,
  },
  {
    name: "assessment_submission.score above the paper's full marks",
    why: "impossible; means the score is on a different scale from the questions",
    query: `
      WITH total AS (
        SELECT assessment_id, SUM(question_score) AS possible
        FROM dbo.assessment_question
        WHERE question_type NOT IN (N'SECTION_BREAK', N'TEXT_BLOCK')
        GROUP BY assessment_id
      )
      SELECT COUNT(*) AS n
      FROM dbo.assessment_submission s
      JOIN total t ON t.assessment_id = s.assessment_id
      WHERE s.score IS NOT NULL AND s.score > t.possible`,
  },
  {
    name: "submitted assessment attempts with no answer rows at all",
    why: "the paper was accepted and nothing was stored - the shape the grid bug had",
    query: `
      SELECT COUNT(*) AS n FROM dbo.assessment_submission s
      WHERE s.submitted_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM dbo.assessment_answer a WHERE a.submission_id = s.submission_id)`,
  },
  {
    name: "submitted evaluations with no answer rows at all",
    why: "same shape, on the evaluation side",
    query: `
      SELECT COUNT(*) AS n FROM dbo.evaluation_submission s
      WHERE s.submitted_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM dbo.evaluation_answer a WHERE a.evaluation_submission_id = s.evaluation_submission_id)`,
  },
  {
    name: "grid questions (assessment) that no attempt ever stored a row link for",
    why: "a grid answered through the API but written without row_choice_id collapses into a flat pick",
    query: `
      SELECT COUNT(*) AS n FROM dbo.assessment_question q
      WHERE q.question_type IN (N'MULTIPLE_CHOICE_GRID', N'CHECKBOX_GRID')
        AND EXISTS (SELECT 1 FROM dbo.assessment_answer a WHERE a.question_id = q.question_id)
        AND NOT EXISTS (
          SELECT 1 FROM dbo.assessment_answer a
          WHERE a.question_id = q.question_id AND a.row_choice_id IS NOT NULL)`,
  },
  {
    name: "grid questions (evaluation) that no reply ever stored a row link for",
    why: "the bug fixed on 2026-09-10: the API parser dropped grid picks, so these were never written",
    query: `
      SELECT COUNT(*) AS n FROM dbo.evaluation_question q
      WHERE q.question_type IN (N'MULTIPLE_CHOICE_GRID', N'CHECKBOX_GRID')
        AND EXISTS (SELECT 1 FROM dbo.evaluation_answer a WHERE a.evaluation_question_id = q.evaluation_question_id)
        AND NOT EXISTS (
          SELECT 1 FROM dbo.evaluation_answer a
          WHERE a.evaluation_question_id = q.evaluation_question_id AND a.row_option_id IS NOT NULL)`,
  },
  {
    name: "grid questions sat by somebody that stored nothing at all (assessment)",
    why: "the shape a dropped payload leaves: the paper has answers for its other questions and none for this one",
    query: `
      SELECT COUNT(*) AS n FROM dbo.assessment_question q
      WHERE q.question_type IN (N'MULTIPLE_CHOICE_GRID', N'CHECKBOX_GRID')
        AND EXISTS (
          SELECT 1 FROM dbo.assessment_submission s
          WHERE s.assessment_id = q.assessment_id AND s.submitted_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM dbo.assessment_answer a WHERE a.question_id = q.question_id)`,
  },
  {
    name: "grid questions replied to by somebody that stored nothing at all (evaluation)",
    why: "same shape on the evaluation side - this is what the dropped grid payload actually looks like",
    query: `
      SELECT COUNT(*) AS n FROM dbo.evaluation_question q
      WHERE q.question_type IN (N'MULTIPLE_CHOICE_GRID', N'CHECKBOX_GRID')
        AND EXISTS (
          SELECT 1 FROM dbo.evaluation_submission s
          WHERE s.evaluation_form_id = q.evaluation_form_id AND s.submitted_at IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM dbo.evaluation_answer a WHERE a.evaluation_question_id = q.evaluation_question_id)`,
  },
  {
    name: "answers pointing at a question that is not on their submission's assessment",
    why: "a cross-wired foreign key; the grader skips these and the marks quietly vanish",
    query: `
      SELECT COUNT(*) AS n
      FROM dbo.assessment_answer a
      JOIN dbo.assessment_submission s ON s.submission_id = a.submission_id
      JOIN dbo.assessment_question q ON q.question_id = a.question_id
      WHERE q.assessment_id <> s.assessment_id`,
  },
  {
    name: "evaluation answers pointing at a question outside their own form",
    why: "same cross-wiring, on the evaluation side",
    query: `
      SELECT COUNT(*) AS n
      FROM dbo.evaluation_answer a
      JOIN dbo.evaluation_submission s ON s.evaluation_submission_id = a.evaluation_submission_id
      JOIN dbo.evaluation_question q ON q.evaluation_question_id = a.evaluation_question_id
      WHERE q.evaluation_form_id <> s.evaluation_form_id`,
  },
  {
    name: "released attempts still carrying an ungraded written answer",
    why: "a score went out while part of the paper had never been read",
    query: `
      SELECT COUNT(*) AS n FROM dbo.assessment_submission s
      WHERE s.publication_status = 'PUBLISHED'
        AND EXISTS (
          SELECT 1 FROM dbo.assessment_answer a
          WHERE a.submission_id = s.submission_id AND a.review_status = 'PENDING_REVIEW')`,
  },
  {
    name: "training_result rows whose pre_score is not the official submission's score",
    why: "the recorded result and the attempt it names should agree unless HRD typed over it",
    query: `
      SELECT COUNT(*) AS n
      FROM dbo.training_result r
      JOIN dbo.assessment_submission s ON s.submission_id = r.official_pre_submission_id
      WHERE r.pre_score IS NOT NULL AND s.score IS NOT NULL AND ABS(r.pre_score - s.score) > 0.005`,
  },
  {
    name: "training_result rows whose post_score is not the official submission's score",
    why: "same, for the post-test",
    query: `
      SELECT COUNT(*) AS n
      FROM dbo.training_result r
      JOIN dbo.assessment_submission s ON s.submission_id = r.official_post_submission_id
      WHERE r.post_score IS NOT NULL AND s.score IS NOT NULL AND ABS(r.post_score - s.score) > 0.005`,
  },
  {
    name: "link-mode full marks recorded for a course that has an in-system form",
    why: "pre/post_link_score_max is only for a test this system cannot see",
    query: `
      SELECT COUNT(*) AS n FROM dbo.training_result r
      WHERE (r.pre_link_score_max IS NOT NULL AND r.official_pre_submission_id IS NOT NULL)
         OR (r.post_link_score_max IS NOT NULL AND r.official_post_submission_id IS NOT NULL)`,
  },
  {
    name: "evaluation replies whose respondent is neither the attendee nor an assigned reviewer",
    why: "the summary splits its two audiences on exactly this; a third kind of respondent lands in the supervisors' pile",
    query: `
      SELECT COUNT(*) AS n
      FROM dbo.evaluation_submission s
      JOIN dbo.training_enrollment e ON e.enrollment_id = s.enrollment_id
      WHERE s.respondent_user_id <> e.employee_user_id
        AND NOT EXISTS (
          SELECT 1 FROM dbo.training_evaluation_reviewer v
          WHERE v.enrollment_id = s.enrollment_id AND v.reviewer_user_id = s.respondent_user_id)`,
  },
  {
    name: "plans pointing at an assessment that has no questions",
    why: "the employee opens an empty paper and the report divides by zero marks",
    query: `
      WITH used AS (
        SELECT pre_assessment_id AS assessment_id FROM dbo.training_plan WHERE pre_assessment_id IS NOT NULL
        UNION ALL
        SELECT post_assessment_id FROM dbo.training_plan WHERE post_assessment_id IS NOT NULL
        UNION ALL
        SELECT pre_assessment_id FROM dbo.course WHERE pre_assessment_id IS NOT NULL
        UNION ALL
        SELECT post_assessment_id FROM dbo.course WHERE post_assessment_id IS NOT NULL
      )
      SELECT COUNT(DISTINCT u.assessment_id) AS n
      FROM used u
      WHERE NOT EXISTS (
        SELECT 1 FROM dbo.assessment_question q
        WHERE q.assessment_id = u.assessment_id
          AND q.question_type NOT IN (N'SECTION_BREAK', N'TEXT_BLOCK'))`,
  },
  {
    name: "grid rows with no answer key (assessment)",
    why: "a scored grid row with no correct column can never award its marks",
    query: `
      SELECT COUNT(*) AS n
      FROM dbo.assessment_choice c
      JOIN dbo.assessment_question q ON q.question_id = c.question_id
      WHERE c.axis = 'ROW' AND q.question_type IN (N'MULTIPLE_CHOICE_GRID', N'CHECKBOX_GRID')
        AND (c.correct_columns IS NULL OR LTRIM(RTRIM(c.correct_columns)) = '')`,
  },
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
    let problems = 0;
    for (const check of CHECKS) {
      const { recordset } = await pool.request().query(check.query);
      const n = recordset[0].n ?? 0;
      if (n > 0) problems += 1;
      console.log(`${n > 0 ? "FOUND " : "clean "} ${String(n).padStart(4)}  ${check.name}`);
      if (n > 0) console.log(`                 why: ${check.why}`);
    }
    console.log(`\n${CHECKS.length} checks, ${problems} with something to look at`);
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
