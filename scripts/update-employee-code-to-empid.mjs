// One-time follow-up to import-employees-from-source.mjs:
// employee_code was set to UserID on import; switch it to EmpID (the real employee number)
// once EmpID is confirmed as the correct identifier. Matches existing rows by their CURRENT
// employee_code (UserID) since that's what's in the DB right now.
// Usage: node scripts/update-employee-code-to-empid.mjs [--dry-run]
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env.local", quiet: true });
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
const summary = { updated: 0, skippedBlankEmpId: 0, skippedDuplicateEmpId: 0, skippedNoMatchingEmployee: 0, skippedUnknownCompany: 0 };
const duplicateLog = [];
try {
  const companies = (await new sql.Request(transaction).query("SELECT company_id, company_code FROM dbo.company")).recordset;
  const companyMap = new Map(companies.map((c) => [c.company_code, c.company_id]));

  const employees = (await new sql.Request(transaction).query("SELECT employee_id, company_id, employee_code FROM dbo.employee")).recordset;
  const byUserIdKey = new Map(employees.map((e) => [`${e.company_id}|${e.employee_code}`, e.employee_id]));
  const codesInUseByCompany = new Map(); // company_id -> Set(employee_code currently in use, updated live as we go)
  for (const e of employees) {
    if (!codesInUseByCompany.has(String(e.company_id))) codesInUseByCompany.set(String(e.company_id), new Set());
    codesInUseByCompany.get(String(e.company_id)).add(e.employee_code);
  }

  for (const row of sourceRows) {
    const userId = trimOrNull(row.UserID);
    if (!userId) continue;
    const companyCode = COMCODE_TO_COMPANY_CODE[trimOrNull(row.ComCode) ?? ""];
    const companyId = companyCode ? companyMap.get(companyCode) : undefined;
    if (!companyId) { summary.skippedUnknownCompany++; continue; }

    const employeeId = byUserIdKey.get(`${companyId}|${userId}`);
    if (!employeeId) { summary.skippedNoMatchingEmployee++; continue; }

    const empId = trimOrNull(row.EmpID);
    if (!empId) { summary.skippedBlankEmpId++; continue; }

    const inUse = codesInUseByCompany.get(String(companyId));
    if (inUse.has(empId)) {
      summary.skippedDuplicateEmpId++;
      duplicateLog.push(`${userId} -> ${empId} (company ${companyCode}): code already in use, kept UserID`);
      continue;
    }

    if (!dryRun) {
      const req = new sql.Request(transaction);
      req.input("employeeId", sql.BigInt, employeeId);
      req.input("code", sql.NVarChar(50), empId);
      await req.query("UPDATE dbo.employee SET employee_code=@code WHERE employee_id=@employeeId");
    }
    inUse.delete(userId);
    inUse.add(empId);
    summary.updated++;
  }

  if (dryRun) { await transaction.rollback(); console.log("DRY RUN — no changes committed."); }
  else { await transaction.commit(); }

  console.log(`Done. Updated to EmpID: ${summary.updated}, Skipped (blank EmpID, kept UserID): ${summary.skippedBlankEmpId}, Skipped (duplicate EmpID in company, kept UserID): ${summary.skippedDuplicateEmpId}, Skipped (no matching employee row): ${summary.skippedNoMatchingEmployee}, Skipped (unknown company): ${summary.skippedUnknownCompany}.`);
  if (duplicateLog.length) { console.warn("Duplicate EmpID details:"); duplicateLog.forEach((l) => console.warn("  " + l)); }
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await targetPool.close();
}
