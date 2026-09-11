// Looks for rows left behind by the live cascade integration tests.
//
// Those tests create courses, OAPs and plans whose codes start with TEST_, and they delete them at
// the end of the test body rather than in a finally block - so a run that fails halfway leaves the
// rows in the database.
//
// Read only. COUNT(*) and MAX(created_at) per table, never a row value.
// Usage: node scripts/check-test-leftovers.mjs
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const TARGETS = [
  { table: "course", column: "course_code" },
  { table: "training_plan_oap", column: "oap_code" },
  { table: "training_plan", column: "plan_code" },
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
    console.log("=== rows whose code starts with TEST_ ===");
    for (const { table, column } of TARGETS) {
      const result = await pool.request().query(`
        SELECT COUNT(*) AS leftovers, MAX(created_at) AS newest
        FROM dbo.[${table}]
        WHERE [${column}] LIKE 'TEST!_%' ESCAPE '!'`);
      const { leftovers, newest } = result.recordset[0];
      console.log(`${table}: ${leftovers}${leftovers > 0 ? ` (newest created_at ${newest?.toISOString?.() ?? newest})` : ""}`);
    }
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
