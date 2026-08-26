// Phase 20 verification: does every child row still resolve to a real employee?
//
// Before Stage 8 this compared the two parallel links row by row. The surrogate column is gone
// now, so what is left to prove is that the surviving link is complete and points at something:
// a value with no matching employee would be an orphan the foreign key should have prevented.
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

// The two nullable ones are optional links by design: a certificate file need not belong to an
// employee, and an account need not be tied to a person yet.
const TABLES = [
  { name: "training_enrollment", linkRequired: true },
  { name: "training_need_request", linkRequired: true },
  { name: "training_record_request", linkRequired: true },
  { name: "training_certificate_file", linkRequired: false },
  { name: "user_account", linkRequired: false },
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

    for (const { name, linkRequired } of TABLES) {
      const one = async (query) => (await pool.request().query(query)).recordset[0].n;

      const rows = await one(`SELECT COUNT(*) AS n FROM dbo.${name}`);
      const linked = await one(
        `SELECT COUNT(*) AS n FROM dbo.${name} WHERE employee_user_id IS NOT NULL`,
      );
      const orphaned = await one(`
        SELECT COUNT(*) AS n
        FROM dbo.${name} AS t
        LEFT JOIN dbo.employee AS e ON e.user_id = t.employee_user_id
        WHERE t.employee_user_id IS NOT NULL AND e.user_id IS NULL`);
      const foreignKey = await one(
        `SELECT COUNT(*) AS n FROM sys.foreign_keys WHERE name = N'FK_${name}_employee_user_id'`,
      );
      const surrogateGone = await one(`
        SELECT COUNT(*) AS n FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.${name}') AND name = N'employee_id'`);

      console.log(
        `  ${name.padEnd(26)} rows=${String(rows).padStart(5)}` +
          ` linked=${String(linked).padStart(5)}` +
          ` orphaned=${String(orphaned).padStart(4)}` +
          ` fk=${foreignKey ? "yes" : "NO"}` +
          ` old_column=${surrogateGone ? "STILL THERE" : "dropped"}`,
      );

      if (orphaned > 0) blockers.push(`${name}: ${orphaned} rows point at an employee that does not exist`);
      if (foreignKey === 0) blockers.push(`${name}: foreign key on employee_user_id is missing`);
      if (linkRequired && linked !== rows) {
        blockers.push(`${name}: ${rows - linked} rows have no employee link but the link is required`);
      }
    }

    console.log("");
    if (blockers.length === 0) {
      console.log("VERDICT: LINKED — every row resolves to a real employee and every foreign key is in place.");
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
