// One-shot: seeds Plant (dbo.organization_function), Division, Department, Section master data
// AND backfills employee.function_id/division_id/department_id/section_id — all from ONE live
// query against the source SF_SYNC.dbo.View_EmpInfoForTrainee, so master data and employee
// assignment can never drift apart (no file export/parse round-trip, no text-matching gaps).
// Supersedes scripts/import-org-hierarchy.mjs + scripts/backfill-org-hierarchy-for-employees.mjs.
// Safe to re-run: master rows are matched by exact (name_th, name_en) before inserting anything
// new; existing organization_function rows not yet claimed by a real Plant pair are reused
// in place (UPDATE) instead of left as orphaned mock rows, same as the original one-time import.
// Join key: EmpID (matched against employee.employee_code, scoped by company via ComCode).
// Does not touch position_id, level_id, or any PII field.
// Usage: node scripts/sync-org-hierarchy-from-source.mjs [--dry-run]
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

const sourcePool = await sql.connect(sourceConfig);
let sourceRows;
try {
  const result = await sourcePool.request().query(`
    SELECT EmpID, ComCode, Plant_TH, Plant_EN, Division_TH, Division_EN,
           Department_TH, Department_EN, Section_TH, Section_EN
    FROM dbo.View_EmpInfoForTrainee
    WHERE EmpID IS NOT NULL AND LTRIM(RTRIM(EmpID)) <> ''
  `);
  sourceRows = result.recordset;
} finally {
  await sourcePool.close();
}
console.log(`Source: ${sourceRows.length} rows read from View_EmpInfoForTrainee.`);

// Distinct (th, en) pairs in first-seen order, skipping fully-blank pairs.
const distinctPairs = (thField, enField) => {
  const seen = new Map();
  for (const row of sourceRows) {
    const th = trimOrNull(row[thField]) ?? "";
    const en = trimOrNull(row[enField]) ?? "";
    if (!th && !en) continue;
    const key = `${th}||${en}`;
    if (!seen.has(key)) seen.set(key, { th, en });
  }
  return [...seen.values()];
};

const plantPairs = distinctPairs("Plant_TH", "Plant_EN");
const divisionPairs = distinctPairs("Division_TH", "Division_EN");
const departmentPairs = distinctPairs("Department_TH", "Department_EN");
const sectionPairs = distinctPairs("Section_TH", "Section_EN");
console.log(`Distinct: ${plantPairs.length} Plant, ${divisionPairs.length} Division, ${departmentPairs.length} Department, ${sectionPairs.length} Section.`);

const pool = await sql.connect(targetConfig);
const transaction = new sql.Transaction(pool);
await transaction.begin();
const summary = {
  updated: 0,
  skippedBlankEmpId: 0,
  skippedUnknownCompany: 0,
  skippedNoMatchingEmployee: 0,
};

try {
  // Seeds one master table from its distinct pairs: reuse an exact (th,en) match as-is, reuse a
  // not-yet-claimed existing row in place (UPDATE) before falling back to INSERT. Returns a
  // `${th}||${en}` -> id lookup covering every pair (used immediately below for the backfill).
  const seedMasterList = async (pairs, table, idColumn, codeColumn, thColumn, enColumn, prefix, existingRows) => {
    const byPair = new Map(existingRows.map((r) => [`${r[thColumn]}||${r[enColumn] ?? ""}`, r]));
    const claimedIds = new Set();
    const lookup = new Map();

    for (const pair of pairs) {
      const key = `${pair.th}||${pair.en}`;
      const existing = byPair.get(key);
      if (existing) {
        lookup.set(key, existing[idColumn]);
        claimedIds.add(existing[idColumn]);
      }
    }

    const existingCodes = new Set(existingRows.map((r) => r[codeColumn]));
    const reusableRows = existingRows.filter((r) => !claimedIds.has(r[idColumn]));
    let reuseIdx = 0;
    let seq = 1;
    let reused = 0;
    let inserted = 0;
    const nextCode = () => {
      let code;
      do { code = `${prefix}${String(seq++).padStart(4, "0")}`; } while (existingCodes.has(code));
      existingCodes.add(code);
      return code;
    };

    for (const pair of pairs) {
      const key = `${pair.th}||${pair.en}`;
      if (lookup.has(key)) continue;

      const code = nextCode();
      if (reuseIdx < reusableRows.length) {
        const target = reusableRows[reuseIdx++];
        if (!dryRun) {
          const req = new sql.Request(transaction);
          req.input("id", sql.BigInt, target[idColumn]);
          req.input("code", sql.NVarChar(30), code);
          req.input("th", sql.NVarChar(255), pair.th || pair.en);
          req.input("en", sql.NVarChar(255), pair.en || null);
          await req.query(`
            UPDATE dbo.${table} SET ${codeColumn} = @code, ${thColumn} = @th, ${enColumn} = @en, status = N'ACTIVE'
            WHERE ${idColumn} = @id
          `);
        }
        lookup.set(key, target[idColumn]);
        reused++;
      } else {
        let newId = -seq;
        if (!dryRun) {
          const req = new sql.Request(transaction);
          req.input("code", sql.NVarChar(30), code);
          req.input("th", sql.NVarChar(255), pair.th || pair.en);
          req.input("en", sql.NVarChar(255), pair.en || null);
          const result = await req.query(`
            INSERT INTO dbo.${table} (${codeColumn}, ${thColumn}, ${enColumn}, status)
            OUTPUT INSERTED.${idColumn} AS id
            VALUES (@code, @th, @en, N'ACTIVE')
          `);
          newId = result.recordset[0].id;
        }
        lookup.set(key, newId);
        inserted++;
      }
    }

    console.log(`${table}: ${lookup.size - reused - inserted} reused as-is, ${reused} ${dryRun ? "would update" : "updated"} in place, ${inserted} ${dryRun ? "would insert" : "inserted"}.`);
    return lookup;
  };

  const existingFunctions = (await new sql.Request(transaction).query("SELECT function_id, function_code, function_name_th, function_name_en FROM dbo.organization_function ORDER BY function_id ASC")).recordset;
  const existingDivisions = (await new sql.Request(transaction).query("SELECT division_id, division_code, division_name_th, division_name_en FROM dbo.division ORDER BY division_id ASC")).recordset;
  const existingDepartments = (await new sql.Request(transaction).query("SELECT department_id, department_code, department_name_th, department_name_en FROM dbo.department ORDER BY department_id ASC")).recordset;
  const existingSections = (await new sql.Request(transaction).query("SELECT section_id, section_code, section_name_th, section_name_en FROM dbo.section ORDER BY section_id ASC")).recordset;

  const functionLookup = await seedMasterList(plantPairs, "organization_function", "function_id", "function_code", "function_name_th", "function_name_en", "PLT", existingFunctions);
  const divisionLookup = await seedMasterList(divisionPairs, "division", "division_id", "division_code", "division_name_th", "division_name_en", "DIV", existingDivisions);
  const departmentLookup = await seedMasterList(departmentPairs, "department", "department_id", "department_code", "department_name_th", "department_name_en", "DEP", existingDepartments);
  const sectionLookup = await seedMasterList(sectionPairs, "section", "section_id", "section_code", "section_name_th", "section_name_en", "SEC", existingSections);

  const companies = (await new sql.Request(transaction).query("SELECT company_id, company_code FROM dbo.company")).recordset;
  const companyMap = new Map(companies.map((c) => [c.company_code, c.company_id]));
  const employees = (await new sql.Request(transaction).query("SELECT employee_id, company_id, employee_code FROM dbo.employee")).recordset;
  const employeeByKey = new Map(employees.map((e) => [`${e.company_id}|${e.employee_code}`, e.employee_id]));

  const pairKey = (th, en) => `${trimOrNull(th) ?? ""}||${trimOrNull(en) ?? ""}`;

  for (const row of sourceRows) {
    const empId = trimOrNull(row.EmpID);
    if (!empId) { summary.skippedBlankEmpId++; continue; }

    const companyCode = COMCODE_TO_COMPANY_CODE[trimOrNull(row.ComCode) ?? ""];
    const companyId = companyCode ? companyMap.get(companyCode) : undefined;
    if (!companyId) { summary.skippedUnknownCompany++; continue; }

    const employeeId = employeeByKey.get(`${companyId}|${empId}`);
    if (!employeeId) { summary.skippedNoMatchingEmployee++; continue; }

    const functionId = functionLookup.get(pairKey(row.Plant_TH, row.Plant_EN)) ?? null;
    const divisionId = divisionLookup.get(pairKey(row.Division_TH, row.Division_EN)) ?? null;
    const departmentId = departmentLookup.get(pairKey(row.Department_TH, row.Department_EN)) ?? null;
    const sectionId = sectionLookup.get(pairKey(row.Section_TH, row.Section_EN)) ?? null;

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

  console.log(`Done. Updated: ${summary.updated}, Skipped (blank EmpID): ${summary.skippedBlankEmpId}, Skipped (unknown company): ${summary.skippedUnknownCompany}, Skipped (no matching employee): ${summary.skippedNoMatchingEmployee}.`);
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await pool.close();
}
