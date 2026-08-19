// One-time backfill for the small residual set of employees whose EmpID is blank in the source
// system (~11 people) — sync-org-hierarchy-from-source.mjs can't reach them since it matches by
// EmpID. These employees still have employee_code = UserID (update-employee-code-to-empid.mjs
// left it that way whenever EmpID was blank), so match by UserID instead here.
// Reuses whatever Plant/Division/Department/Section master rows sync-org-hierarchy-from-source.mjs
// already seeded — does not create or change any master row, read-only lookup against them.
// Usage: node scripts/backfill-org-hierarchy-by-userid.mjs [--dry-run]
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
  database: required("DB_DATABASE"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  options: { encrypt: process.env.DB_ENCRYPT === "true", trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false" },
};
const sourceConfig = {
  server: required("SOURCE_DB_SERVER_HOST"),
  database: required("SOURCE_DB_DATABASE"),
  user: required("SOURCE_DB_USER"),
  password: required("SOURCE_DB_PASSWORD"),
  options: { encrypt: process.env.DB_ENCRYPT === "true", trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false" },
};

const trimOrNull = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const pairKey = (th, en) => `${trimOrNull(th) ?? ""}||${trimOrNull(en) ?? ""}`;

const sourcePool = await sql.connect(sourceConfig);
let sourceRows;
try {
  const result = await sourcePool.request().query(`
    SELECT UserID, ComCode, Plant_TH, Plant_EN, Division_TH, Division_EN,
           Department_TH, Department_EN, Section_TH, Section_EN
    FROM dbo.View_EmpInfoForTrainee
    WHERE EmpID IS NULL OR LTRIM(RTRIM(EmpID)) = ''
  `);
  sourceRows = result.recordset;
} finally {
  await sourcePool.close();
}
console.log(`Source: ${sourceRows.length} blank-EmpID rows read from View_EmpInfoForTrainee.`);

const pool = await sql.connect(targetConfig);
const transaction = new sql.Transaction(pool);
await transaction.begin();
const summary = { updated: 0, skippedUnknownCompany: 0, skippedNoMatchingEmployee: 0 };
const unmatchedText = { plant: new Set(), division: new Set(), department: new Set(), section: new Set() };

try {
  const buildLookup = async (table, idColumn, thColumn, enColumn) => {
    const rows = (await new sql.Request(transaction).query(`SELECT ${idColumn}, ${thColumn}, ${enColumn} FROM dbo.${table}`)).recordset;
    const lookup = new Map();
    for (const row of rows) lookup.set(pairKey(row[thColumn], row[enColumn]), row[idColumn]);
    return lookup;
  };

  const functionLookup = await buildLookup("organization_function", "function_id", "function_name_th", "function_name_en");
  const divisionLookup = await buildLookup("division", "division_id", "division_name_th", "division_name_en");
  const departmentLookup = await buildLookup("department", "department_id", "department_name_th", "department_name_en");
  const sectionLookup = await buildLookup("section", "section_id", "section_name_th", "section_name_en");

  const companies = (await new sql.Request(transaction).query("SELECT company_id, company_code FROM dbo.company")).recordset;
  const companyMap = new Map(companies.map((c) => [c.company_code, c.company_id]));
  const employees = (await new sql.Request(transaction).query("SELECT employee_id, company_id, employee_code FROM dbo.employee")).recordset;
  const employeeByKey = new Map(employees.map((e) => [`${e.company_id}|${e.employee_code}`, e.employee_id]));

  for (const row of sourceRows) {
    const userId = trimOrNull(row.UserID);
    if (!userId) continue;

    const companyCode = COMCODE_TO_COMPANY_CODE[trimOrNull(row.ComCode) ?? ""];
    const companyId = companyCode ? companyMap.get(companyCode) : undefined;
    if (!companyId) { summary.skippedUnknownCompany++; continue; }

    const employeeId = employeeByKey.get(`${companyId}|${userId}`);
    if (!employeeId) { summary.skippedNoMatchingEmployee++; continue; }

    const functionId = functionLookup.get(pairKey(row.Plant_TH, row.Plant_EN)) ?? null;
    const divisionId = divisionLookup.get(pairKey(row.Division_TH, row.Division_EN)) ?? null;
    const departmentId = departmentLookup.get(pairKey(row.Department_TH, row.Department_EN)) ?? null;
    const sectionId = sectionLookup.get(pairKey(row.Section_TH, row.Section_EN)) ?? null;

    if ((row.Plant_TH || row.Plant_EN) && !functionId) unmatchedText.plant.add(`${row.Plant_TH} / ${row.Plant_EN}`);
    if ((row.Division_TH || row.Division_EN) && !divisionId) unmatchedText.division.add(`${row.Division_TH} / ${row.Division_EN}`);
    if ((row.Department_TH || row.Department_EN) && !departmentId) unmatchedText.department.add(`${row.Department_TH} / ${row.Department_EN}`);
    if ((row.Section_TH || row.Section_EN) && !sectionId) unmatchedText.section.add(`${row.Section_TH} / ${row.Section_EN}`);

    if (!dryRun) {
      const req = new sql.Request(transaction);
      req.input("employeeId", sql.BigInt, employeeId);
      req.input("functionId", sql.BigInt, functionId);
      req.input("divisionId", sql.BigInt, divisionId);
      req.input("departmentId", sql.BigInt, departmentId);
      req.input("sectionId", sql.BigInt, sectionId);
      await req.query(`
        UPDATE dbo.employee
        SET function_id = @functionId, division_id = @divisionId, department_id = @departmentId, section_id = @sectionId
        WHERE employee_id = @employeeId
      `);
    }
    summary.updated++;
  }

  if (dryRun) { await transaction.rollback(); console.log("DRY RUN — no changes committed."); }
  else { await transaction.commit(); console.log("Committed."); }

  console.log(`Done. Updated: ${summary.updated}, Skipped (unknown company): ${summary.skippedUnknownCompany}, Skipped (no matching employee): ${summary.skippedNoMatchingEmployee}.`);
  for (const [level, set] of Object.entries(unmatchedText)) {
    if (set.size) {
      console.warn(`Unmatched ${level} text (no exact match in master list, left NULL):`);
      [...set].forEach((text) => console.warn(`  ${text}`));
    }
  }
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await pool.close();
}
