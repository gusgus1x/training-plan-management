// Phase 1 of preserving the source system's stable UserID on dbo.employee.user_id.
// employee_code was originally set to UserID on import (import-employees-from-source.mjs), then
// overwritten to EmpID for most employees (update-employee-code-to-empid.mjs) — UserID was never
// kept anywhere after that. This backfills it from the live source, matching each employee by
// whichever value is CURRENTLY its employee_code: EmpID (the common case today) or, failing
// that, UserID (the 11 employees update-employee-code-to-empid.mjs couldn't migrate).
// Only ever fills user_id where it's still NULL — never overwrites, always safe to re-run.
// Usage: node scripts/backfill-employee-user-id.mjs [--dry-run]
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });
const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const dryRun = process.argv.includes("--dry-run");

const COMCODE_TO_COMPANY_CODE = { "1120": "SATI", "1290": "ATA", "1510": "ATFB", "0420": "NIC", "0430": "SNF", "0450": "TEP" };

const targetConfig = {
  server: process.env.DB_INSTANCE ? `${required("DB_SERVER")}\\${process.env.DB_INSTANCE}` : required("DB_SERVER"),
  database: required("DB_DATABASE"), user: required("DB_USER"), password: required("DB_PASSWORD"),
  options: { encrypt: process.env.DB_ENCRYPT === "true", trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false" },
};
const sourceConfig = {
  server: required("SOURCE_DB_SERVER_HOST"), database: required("SOURCE_DB_DATABASE"),
  user: required("SOURCE_DB_USER"), password: required("SOURCE_DB_PASSWORD"),
  options: { encrypt: process.env.DB_ENCRYPT === "true", trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false" },
};
const trimOrNull = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

const sourcePool = await sql.connect(sourceConfig);
let sourceRows;
try {
  sourceRows = (await sourcePool.request().query("SELECT UserID, EmpID, ComCode FROM dbo.View_EmpInfoForTrainee")).recordset;
} finally { await sourcePool.close(); }
console.log(`Source: ${sourceRows.length} rows read.`);

const targetPool = await sql.connect(targetConfig);
const transaction = new sql.Transaction(targetPool);
await transaction.begin();
const summary = { updated: 0, skippedAlreadySet: 0, skippedBlankUserId: 0, skippedNoMatchingEmployee: 0, skippedUnknownCompany: 0 };
try {
  const companies = (await new sql.Request(transaction).query("SELECT company_id, company_code FROM dbo.company")).recordset;
  const companyMap = new Map(companies.map((c) => [c.company_code, c.company_id]));

  const employees = (await new sql.Request(transaction).query("SELECT employee_id, company_id, employee_code, user_id FROM dbo.employee")).recordset;
  const byCode = new Map(employees.map((e) => [`${e.company_id}|${e.employee_code}`, e]));

  for (const row of sourceRows) {
    const userId = trimOrNull(row.UserID);
    if (!userId) { summary.skippedBlankUserId++; continue; }

    const companyCode = COMCODE_TO_COMPANY_CODE[trimOrNull(row.ComCode) ?? ""];
    const companyId = companyCode ? companyMap.get(companyCode) : undefined;
    if (!companyId) { summary.skippedUnknownCompany++; continue; }

    const empId = trimOrNull(row.EmpID);
    // Try EmpID first (the common, already-migrated case), then UserID (the never-migrated 11).
    const employee =
      (empId && byCode.get(`${companyId}|${empId}`)) ||
      byCode.get(`${companyId}|${userId}`);
    if (!employee) { summary.skippedNoMatchingEmployee++; continue; }

    if (employee.user_id) { summary.skippedAlreadySet++; continue; }

    if (!dryRun) {
      const req = new sql.Request(transaction);
      req.input("employeeId", sql.BigInt, employee.employee_id);
      req.input("userId", sql.NVarChar(50), userId);
      await req.query("UPDATE dbo.employee SET user_id=@userId WHERE employee_id=@employeeId AND user_id IS NULL");
    }
    employee.user_id = userId; // guard against duplicate source rows re-matching
    summary.updated++;
  }

  if (dryRun) { await transaction.rollback(); console.log("DRY RUN — no changes committed."); }
  else { await transaction.commit(); }

  console.log(`Done. Updated: ${summary.updated}, Skipped (already set): ${summary.skippedAlreadySet}, Skipped (blank UserID): ${summary.skippedBlankUserId}, Skipped (no matching employee): ${summary.skippedNoMatchingEmployee}, Skipped (unknown company): ${summary.skippedUnknownCompany}.`);
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await targetPool.close();
}

const checkPool = await sql.connect(targetConfig);
try {
  const { recordset } = await checkPool.request().query("SELECT COUNT(*) AS total, SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) AS stillNull FROM dbo.employee");
  const { total, stillNull } = recordset[0];
  console.log(`Coverage: ${total - stillNull} / ${total} employees now have user_id (${stillNull} still NULL).`);
} finally {
  await checkPool.close();
}
