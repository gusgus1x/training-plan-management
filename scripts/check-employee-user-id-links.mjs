// Phase 20 Stage 2 verification: does every child row that points at an employee by the old
// surrogate id also point at the same employee by the durable business key?
//
// Counts and constraint metadata only — never row values.
// Usage: node scripts/check-employee-user-id-links.mjs
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const TABLES = [
  "training_enrollment",
  "training_need_request",
  "training_record_request",
  "training_certificate_file",
  "user_account",
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
    const blockers = [];
    console.log("child table links to employee.user_id\n");

    for (const table of TABLES) {
      const one = async (query) => (await pool.request().query(query)).recordset[0].n;

      const rows = await one(`SELECT COUNT(*) AS n FROM dbo.${table}`);
      const withOldKey = await one(
        `SELECT COUNT(*) AS n FROM dbo.${table} WHERE employee_id IS NOT NULL`,
      );
      const withNewKey = await one(
        `SELECT COUNT(*) AS n FROM dbo.${table} WHERE employee_user_id IS NOT NULL`,
      );
      // The pair must agree for every row, not merely match in total.
      const disagreeing = await one(`
        SELECT COUNT(*) AS n
        FROM dbo.${table} AS t
        LEFT JOIN dbo.employee AS e ON e.employee_id = t.employee_id
        WHERE t.employee_id IS NOT NULL
          AND (t.employee_user_id IS NULL OR t.employee_user_id <> e.user_id)`);
      const foreignKey = await one(`
        SELECT COUNT(*) AS n FROM sys.foreign_keys
        WHERE name = N'FK_${table}_employee_user_id'`);

      console.log(
        `  ${table.padEnd(26)} rows=${String(rows).padStart(5)}` +
          ` old=${String(withOldKey).padStart(5)}` +
          ` new=${String(withNewKey).padStart(5)}` +
          ` mismatched=${String(disagreeing).padStart(4)}` +
          ` fk=${foreignKey ? "yes" : "NO"}`,
      );

      if (disagreeing > 0) blockers.push(`${table}: ${disagreeing} rows disagree between the two keys`);
      if (foreignKey === 0) blockers.push(`${table}: foreign key on employee_user_id is missing`);
    }

    console.log("");
    if (blockers.length === 0) {
      console.log("VERDICT: LINKED — both keys agree on every row and every foreign key is in place.");
    } else {
      console.log("VERDICT: NOT LINKED");
      for (const blocker of blockers) console.log(`  - ${blocker}`);
    }

    process.exitCode = blockers.length === 0 ? 0 : 1;
  } finally {
    await pool.close();
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
