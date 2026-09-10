// Compares training_plan.batch_no with training_plan.batch_name for every batch of every course.
//
// The supervisor's assigned-evaluation card prints batch_no while the employee's own screens print
// batch_name; this says whether the two ever disagree, and how the numbering is scoped.
//
// Structure only: plan code, batch number, batch name, and the OAP each belongs to. No people.
// Usage: node scripts/check-plan-batch-numbering.mjs
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
      SELECT p.plan_id, p.plan_code, p.oap_plan_id, p.batch_no, p.batch_name,
             o.oap_code, o.course_id
      FROM dbo.training_plan AS p
      JOIN dbo.training_plan_oap AS o ON o.oap_plan_id = p.oap_plan_id
      ORDER BY o.course_id, p.plan_id`);

    let disagreements = 0;
    for (const row of recordset) {
      const nameHasNumber = /(\d+)/.exec(row.batch_name ?? "");
      const disagrees = nameHasNumber !== null && Number(nameHasNumber[1]) !== row.batch_no;
      if (disagrees) disagreements += 1;
      console.log(
        `plan ${row.plan_id} ${row.plan_code}  course ${row.course_id} oap ${row.oap_code}` +
          `  batch_no=${row.batch_no}  batch_name=${JSON.stringify(row.batch_name)}` +
          (disagrees ? "   <- disagree" : ""),
      );
    }
    console.log(`\n${recordset.length} plans, ${disagreements} where the name's number is not batch_no`);
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
