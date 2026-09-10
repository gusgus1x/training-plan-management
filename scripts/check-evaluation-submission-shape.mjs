// Read-only diagnostics for "an employee submitted the 30-day evaluation but HRD sees nothing".
// Counts and ids only - no answer content, no names.
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const pool = await sql.connect({
  server: process.env.DB_INSTANCE ? `${required("DB_SERVER")}\\${process.env.DB_INSTANCE}` : required("DB_SERVER"),
  database: required("DB_DATABASE"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  options: { encrypt: false, trustServerCertificate: true },
});

const show = async (label, query) => {
  const result = await pool.request().query(query);
  console.log(`\n== ${label}`);
  console.table(result.recordset);
};

await show("evaluation_submission by form and status", `
  SELECT s.evaluation_form_id, f.form_code, f.timing,
         COUNT(*) AS rows_total,
         SUM(CASE WHEN s.submitted_at IS NOT NULL THEN 1 ELSE 0 END) AS submitted_rows
  FROM dbo.evaluation_submission s
  JOIN dbo.evaluation_form f ON f.evaluation_form_id = s.evaluation_form_id
  GROUP BY s.evaluation_form_id, f.form_code, f.timing`);

await show("submitted rows: is the respondent the enrollment owner", `
  SELECT f.timing,
         SUM(CASE WHEN s.respondent_user_id = e.employee_user_id THEN 1 ELSE 0 END) AS by_attendee,
         SUM(CASE WHEN s.respondent_user_id <> e.employee_user_id THEN 1 ELSE 0 END) AS by_someone_else
  FROM dbo.evaluation_submission s
  JOIN dbo.training_enrollment e ON e.enrollment_id = s.enrollment_id
  JOIN dbo.evaluation_form f ON f.evaluation_form_id = s.evaluation_form_id
  WHERE s.submitted_at IS NOT NULL
  GROUP BY f.timing`);

await show("does the plan or course still point at the form that was answered", `
  SELECT s.evaluation_form_id AS answered_form_id,
         p.plan_id,
         p.evaluation_form_id AS plan_after_training,
         p.evaluation_form_after_30day_id AS plan_30day,
         c.evaluation_form_id AS course_after_training,
         c.evaluation_form_after_30day_id AS course_30day,
         COUNT(*) AS submitted_rows
  FROM dbo.evaluation_submission s
  JOIN dbo.training_enrollment e ON e.enrollment_id = s.enrollment_id
  JOIN dbo.training_plan p ON p.plan_id = e.plan_id
  JOIN dbo.training_plan_oap o ON o.oap_plan_id = p.oap_plan_id
  JOIN dbo.course c ON c.course_id = o.course_id
  WHERE s.submitted_at IS NOT NULL
  GROUP BY s.evaluation_form_id, p.plan_id, p.evaluation_form_id, p.evaluation_form_after_30day_id,
           c.evaluation_form_id, c.evaluation_form_after_30day_id`);

await pool.close();
