// One-time import: dbo.View_EmpInfoForTrainee (source SF_SYNC) -> dbo.employee (target TrainingPlanManagementDB)
// Usage: node scripts/import-employees-from-source.mjs [--dry-run]
// National ID is not available from this source view; national_id_* fields are left NULL.
// function_id/position_id are left NULL too: source Plant_TH/Position_EN have hundreds of
// inconsistent spellings/abbreviations for the same real org unit/job title (verified 2026-08-10,
// e.g. "Operator-Grinding" vs "Opertor-PD2", "สำนักงานผู้จัดการโรงงาน" in 5+ spelling variants) —
// auto-creating master data from this text would produce a messy, duplicate-ridden position/function
// list. Master data is curated by hand afterward, then employees backfilled.
// Re-runnable: upserts by (company_id, employee_code).
import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env.local", quiet: true });
const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const dryRun = process.argv.includes("--dry-run");

// ComCode (source, numeric) -> company_code (target, alpha). Confirmed 2026-08-10 via Com-result.rpt
// name-matching + elimination, cross-checked against a real sample row (0430 -> SNF).
const COMCODE_TO_COMPANY_CODE = {
  "1120": "SATI",
  "1290": "ATA",
  "1510": "ATFB",
  "0420": "NIC",
  "0430": "SNF",
  "0450": "TEP",
};

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
const toDateOnly = (v) => (v instanceof Date ? new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())) : null);

const sourcePool = await sql.connect(sourceConfig);
let sourceRows;
try {
  const result = await sourcePool.request().query(`
    SELECT UserID, ComCode, ComName, Plant_TH, Plant_EN, Position_TH, Position_EN, EmpSubgroup,
           Title_TH, Title_EN, Fname_TH, Lname_TH, Fname_EN, Lname_EN, MobilePhone, Email, HireDate, DOB
    FROM dbo.View_EmpInfoForTrainee
  `);
  sourceRows = result.recordset;
} finally {
  await sourcePool.close();
}
console.log(`Source: ${sourceRows.length} rows read from View_EmpInfoForTrainee.`);

const targetPool = await sql.connect(targetConfig);
const transaction = new sql.Transaction(targetPool);
await transaction.begin();
const summary = { inserted: 0, updated: 0, skippedUnknownCompany: 0, skippedNoEmployeeCode: 0, levelUnmatched: new Set() };
try {
  const companies = (await new sql.Request(transaction).query("SELECT company_id, company_code FROM dbo.company")).recordset;
  const companyMap = new Map(companies.map((c) => [c.company_code, c.company_id]));

  const levels = (await new sql.Request(transaction).query("SELECT level_id, level_key FROM dbo.employee_level")).recordset;
  const levelByKey = new Map(levels.map((l) => [l.level_key, l.level_id]));

  const existingEmployees = (await new sql.Request(transaction).query("SELECT employee_id, company_id, employee_code FROM dbo.employee")).recordset;
  const employeeKey = (companyId, code) => `${companyId}|${code}`;
  const existingByKey = new Map(existingEmployees.map((e) => [employeeKey(String(e.company_id), e.employee_code), e.employee_id]));

  for (const row of sourceRows) {
    const employeeCode = trimOrNull(row.UserID);
    if (!employeeCode) { summary.skippedNoEmployeeCode++; continue; }

    const companyCode = COMCODE_TO_COMPANY_CODE[trimOrNull(row.ComCode) ?? ""];
    const companyId = companyCode ? companyMap.get(companyCode) : undefined;
    if (!companyId) { summary.skippedUnknownCompany++; console.warn(`Skip ${employeeCode}: unrecognized ComCode "${row.ComCode}" (${row.ComName ?? "?"})`); continue; }

    // function_id / position_id intentionally left NULL — see file header comment.
    const functionId = null;
    const positionId = null;

    const empSubgroup = trimOrNull(row.EmpSubgroup);
    const levelId = empSubgroup ? levelByKey.get(empSubgroup) : undefined;
    if (empSubgroup && !levelId) summary.levelUnmatched.add(empSubgroup);

    const existingId = existingByKey.get(employeeKey(String(companyId), employeeCode));
    if (dryRun) { existingId ? summary.updated++ : summary.inserted++; continue; }

    const req = new sql.Request(transaction);
    req.input("companyId", sql.BigInt, companyId);
    req.input("functionId", sql.BigInt, functionId ?? null);
    req.input("positionId", sql.BigInt, positionId ?? null);
    req.input("levelId", sql.BigInt, levelId ?? null);
    req.input("employeeCode", sql.NVarChar(50), employeeCode);
    req.input("titleTh", sql.NVarChar(50), trimOrNull(row.Title_TH));
    req.input("titleEn", sql.NVarChar(50), trimOrNull(row.Title_EN));
    req.input("firstNameTh", sql.NVarChar(150), trimOrNull(row.Fname_TH) ?? "");
    req.input("lastNameTh", sql.NVarChar(150), trimOrNull(row.Lname_TH) ?? "");
    req.input("firstNameEn", sql.NVarChar(150), trimOrNull(row.Fname_EN));
    req.input("lastNameEn", sql.NVarChar(150), trimOrNull(row.Lname_EN));
    req.input("telephone", sql.NVarChar(30), trimOrNull(row.MobilePhone));
    req.input("email", sql.NVarChar(255), trimOrNull(row.Email));
    req.input("hireDate", sql.Date, toDateOnly(row.HireDate));
    req.input("birthDate", sql.Date, toDateOnly(row.DOB));

    if (existingId) {
      req.input("employeeId", sql.BigInt, existingId);
      await req.query(`
        UPDATE dbo.employee SET function_id=@functionId, position_id=@positionId, level_id=@levelId,
          title_th=@titleTh, title_en=@titleEn, first_name_th=@firstNameTh, last_name_th=@lastNameTh,
          first_name_en=@firstNameEn, last_name_en=@lastNameEn, telephone=@telephone, email=@email,
          hire_date=@hireDate, birth_date=@birthDate
        WHERE employee_id=@employeeId`);
      summary.updated++;
    } else {
      await req.query(`
        INSERT INTO dbo.employee(company_id, function_id, position_id, level_id, employee_code,
          title_th, title_en, first_name_th, last_name_th, first_name_en, last_name_en,
          telephone, email, hire_date, birth_date, employment_status)
        VALUES(@companyId, @functionId, @positionId, @levelId, @employeeCode,
          @titleTh, @titleEn, @firstNameTh, @lastNameTh, @firstNameEn, @lastNameEn,
          @telephone, @email, @hireDate, @birthDate, N'ACTIVE')`);
      summary.inserted++;
    }
  }

  if (dryRun) { await transaction.rollback(); console.log("DRY RUN — no changes committed."); }
  else { await transaction.commit(); }

  console.log(`Done. Inserted: ${summary.inserted}, Updated: ${summary.updated}, Skipped (unknown company): ${summary.skippedUnknownCompany}, Skipped (no employee code): ${summary.skippedNoEmployeeCode}.`);
  if (summary.levelUnmatched.size) console.warn(`EmpSubgroup values with no matching employee_level.level_key (level_id left NULL): ${[...summary.levelUnmatched].join(", ")}`);
  console.log("National ID, function_id, and position_id were not set on any row (not available/curated yet) — see file header comment.");
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await targetPool.close();
}
