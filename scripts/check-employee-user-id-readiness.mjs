// Phase 20 Stage 1 gate: is dbo.employee.user_id ready to become the employee business key?
//
// Reports counts only — never row values. Prints a single VERDICT line so the decision to
// proceed is explicit rather than inferred from a wall of numbers.
// Usage: node scripts/check-employee-user-id-readiness.mjs
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const config = {
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
};

const QUERIES = {
  employees: "SELECT COUNT(*) AS n FROM dbo.employee",
  missingUserId: "SELECT COUNT(*) AS n FROM dbo.employee WHERE user_id IS NULL",
  blankUserId: "SELECT COUNT(*) AS n FROM dbo.employee WHERE user_id IS NOT NULL AND LTRIM(RTRIM(user_id)) = ''",
  // A duplicate would block the UNIQUE constraint even with zero NULLs.
  duplicateUserId: `
    SELECT COUNT(*) AS n FROM (
      SELECT user_id FROM dbo.employee
      WHERE user_id IS NOT NULL
      GROUP BY user_id HAVING COUNT(*) > 1
    ) AS duplicates`,
  // Child rows whose employee has no user_id would be orphaned by the repoint.
  enrollmentsAtRisk: `
    SELECT COUNT(*) AS n FROM dbo.training_enrollment AS t
    JOIN dbo.employee AS e ON e.employee_id = t.employee_id
    WHERE e.user_id IS NULL`,
  needRequestsAtRisk: `
    SELECT COUNT(*) AS n FROM dbo.training_need_request AS t
    JOIN dbo.employee AS e ON e.employee_id = t.employee_id
    WHERE e.user_id IS NULL`,
  recordRequestsAtRisk: `
    SELECT COUNT(*) AS n FROM dbo.training_record_request AS t
    JOIN dbo.employee AS e ON e.employee_id = t.employee_id
    WHERE e.user_id IS NULL`,
  certificatesAtRisk: `
    SELECT COUNT(*) AS n FROM dbo.training_certificate_file AS t
    JOIN dbo.employee AS e ON e.employee_id = t.employee_id
    WHERE e.user_id IS NULL`,
  accountsAtRisk: `
    SELECT COUNT(*) AS n FROM dbo.user_account AS t
    JOIN dbo.employee AS e ON e.employee_id = t.employee_id
    WHERE e.user_id IS NULL`,
};

const COLUMN_SHAPE = `
  SELECT is_nullable, max_length
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.employee') AND name = 'user_id'`;

const INDEX_SHAPE = `
  SELECT i.name, i.is_unique, i.has_filter, i.filter_definition
  FROM sys.indexes AS i
  JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  JOIN sys.columns AS c ON c.object_id = i.object_id AND c.column_id = ic.column_id
  WHERE i.object_id = OBJECT_ID('dbo.employee') AND c.name = 'user_id'`;

const run = async () => {
  const pool = await sql.connect(config);

  try {
    const counts = {};
    for (const [label, query] of Object.entries(QUERIES)) {
      counts[label] = (await pool.request().query(query)).recordset[0].n;
    }

    const column = (await pool.request().query(COLUMN_SHAPE)).recordset[0];
    const indexes = (await pool.request().query(INDEX_SHAPE)).recordset;

    console.log("dbo.employee.user_id readiness\n");
    console.log(`  employees total            : ${counts.employees}`);
    console.log(`  user_id IS NULL            : ${counts.missingUserId}`);
    console.log(`  user_id blank/whitespace   : ${counts.blankUserId}`);
    console.log(`  duplicate user_id values   : ${counts.duplicateUserId}`);
    console.log("\n  child rows whose employee has no user_id");
    console.log(`    training_enrollment      : ${counts.enrollmentsAtRisk}`);
    console.log(`    training_need_request    : ${counts.needRequestsAtRisk}`);
    console.log(`    training_record_request  : ${counts.recordRequestsAtRisk}`);
    console.log(`    training_certificate_file: ${counts.certificatesAtRisk}`);
    console.log(`    user_account             : ${counts.accountsAtRisk}`);
    console.log("\n  column   : " +
      `nullable=${column.is_nullable ? "YES" : "NO"}, nvarchar(${column.max_length / 2})`);
    for (const index of indexes) {
      console.log(
        `  index    : ${index.name} unique=${index.is_unique ? "YES" : "NO"} ` +
          `filtered=${index.has_filter ? index.filter_definition : "NO"}`,
      );
    }

    const blockers = [];
    if (counts.missingUserId > 0) blockers.push(`${counts.missingUserId} employees still have no user_id`);
    if (counts.blankUserId > 0) blockers.push(`${counts.blankUserId} employees have a blank user_id`);
    if (counts.duplicateUserId > 0) blockers.push(`${counts.duplicateUserId} user_id values are duplicated`);

    console.log("");
    if (blockers.length === 0) {
      console.log("VERDICT: READY — user_id can be made NOT NULL and uniquely constrained.");
    } else {
      console.log("VERDICT: NOT READY");
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
