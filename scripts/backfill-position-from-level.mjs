// One-time backfill: dbo.employee.position_id from source PositionLevel <-> dbo.position.position_name_en
// Matches source rows to employee via (company_id, user_id) — stable regardless of employee_code.
// Position match is case-insensitive + trimmed (values are the same, just different casing/spacing).
// Only touches employees where position_id IS NULL — never overwrites an existing value.
// Usage: node scripts/backfill-position-from-level.mjs [--dry-run]
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
const normalize = (v) => (typeof v === "string" ? v.trim().toLowerCase() : null);

const sourcePool = await sql.connect(sourceConfig);
let sourceRows;
try {
  sourceRows = (await sourcePool.request().query("SELECT UserID, ComCode, PositionLevel FROM dbo.View_EmpInfoForTrainee")).recordset;
} finally { await sourcePool.close(); }
console.log(`Source: ${sourceRows.length} rows read.`);

const targetPool = await sql.connect(targetConfig);
const transaction = new sql.Transaction(targetPool);
await transaction.begin();
const summary = { updated: 0, skippedBlankUserId: 0, skippedAlreadySet: 0, skippedNoPositionLevel: 0, skippedNoMatchingPosition: 0, skippedNoMatchingEmployee: 0, skippedUnknownCompany: 0 };
const unmatchedLevels = new Set();
try {
  const companies = (await new sql.Request(transaction).query("SELECT company_id, company_code FROM dbo.company")).recordset;
  const companyMap = new Map(companies.map((c) => [c.company_code, c.company_id]));

  const positions = (await new sql.Request(transaction).query("SELECT position_id, position_name_en FROM dbo.position")).recordset;
  const positionByName = new Map(positions.filter((p) => p.position_name_en).map((p) => [normalize(p.position_name_en), p.position_id]));

  const employees = (await new sql.Request(transaction).query("SELECT employee_id, company_id, user_id, position_id FROM dbo.employee")).recordset;
  const employeeByKey = new Map(employees.filter((e) => e.user_id).map((e) => [`${e.company_id}|${e.user_id}`, e]));

  for (const row of sourceRows) {
    const userId = trimOrNull(row.UserID);
    if (!userId) { summary.skippedBlankUserId++; continue; }
    const companyCode = COMCODE_TO_COMPANY_CODE[trimOrNull(row.ComCode) ?? ""];
    const companyId = companyCode ? companyMap.get(companyCode) : undefined;
    if (!companyId) { summary.skippedUnknownCompany++; continue; }

    const employee = employeeByKey.get(`${companyId}|${userId}`);
    if (!employee) { summary.skippedNoMatchingEmployee++; continue; }
    if (employee.position_id) { summary.skippedAlreadySet++; continue; }

    const positionLevel = trimOrNull(row.PositionLevel);
    if (!positionLevel) { summary.skippedNoPositionLevel++; continue; }

    const positionId = positionByName.get(normalize(positionLevel));
    if (!positionId) { summary.skippedNoMatchingPosition++; unmatchedLevels.add(positionLevel); continue; }

    if (!dryRun) {
      const req = new sql.Request(transaction);
      req.input("employeeId", sql.BigInt, employee.employee_id);
      req.input("positionId", sql.BigInt, positionId);
      await req.query("UPDATE dbo.employee SET position_id=@positionId WHERE employee_id=@employeeId");
    }
    employee.position_id = positionId; // guard against duplicate source rows re-matching
    summary.updated++;
  }

  if (dryRun) { await transaction.rollback(); console.log("DRY RUN — no changes committed."); }
  else { await transaction.commit(); }

  console.log(`Done. Updated: ${summary.updated}, Skipped (blank UserID): ${summary.skippedBlankUserId}, Skipped (already set): ${summary.skippedAlreadySet}, Skipped (blank PositionLevel): ${summary.skippedNoPositionLevel}, Skipped (no matching position): ${summary.skippedNoMatchingPosition}, Skipped (no matching employee): ${summary.skippedNoMatchingEmployee}, Skipped (unknown company): ${summary.skippedUnknownCompany}.`);
  if (unmatchedLevels.size) console.warn(`PositionLevel values with no matching position_name_en (add/fix master data in dbo.position): ${[...unmatchedLevels].join(", ")}`);
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await targetPool.close();
}
