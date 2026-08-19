// One-time backfill: assigns function_id (Plant), division_id, department_id, section_id on
// dbo.employee from a per-employee export with unmasked EmpID (same 41-column shape as
// result-real-data-employee4010.rpt / real data employee.rpt).
// Must run AFTER scripts/import-org-hierarchy.mjs has seeded organization_function/division/
// department/section for real — matching is done by exact (name_th, name_en) lookup against
// those tables, since both come from the same source export.
// Join key: EmpID (matched against employee.employee_code, scoped by company via ComCode) —
// employee_code was already migrated from UserID to EmpID by update-employee-code-to-empid.mjs.
// Does not touch position_id, level_id, or any PII field.
// Source file path is NOT hardcoded — pass it explicitly so an unmasked export never has to sit
// at a filename/location already known to whoever is reading this script.
// Usage: node scripts/backfill-org-hierarchy-for-employees.mjs --source=<path-to-report> [--dry-run]
import { config as loadEnvironment } from "dotenv";
import { readFileSync } from "node:fs";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });
const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const dryRun = process.argv.includes("--dry-run");
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
if (!sourceArg) {
  throw new Error("Pass the report file path explicitly: --source=<path-to-report>");
}
const sourcePath = sourceArg.slice("--source=".length);

const COMCODE_TO_COMPANY_CODE = { "1120": "SATI", "1290": "ATA", "1510": "ATFB", "0420": "NIC", "0430": "SNF", "0450": "TEP" };

const targetConfig = {
  server: process.env.DB_INSTANCE ? `${required("DB_SERVER")}\\${process.env.DB_INSTANCE}` : required("DB_SERVER"),
  database: required("DB_DATABASE"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  options: { encrypt: process.env.DB_ENCRYPT === "true", trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false" },
};

const trimOrNull = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

const computeColumnRanges = (sepLine) => {
  const ranges = [];
  let start = null;
  for (let i = 0; i < sepLine.length; i++) {
    const isDash = sepLine[i] === "-";
    if (isDash && start === null) start = i;
    if (!isDash && start !== null) { ranges.push([start, i]); start = null; }
  }
  if (start !== null) ranges.push([start, sepLine.length]);
  return ranges;
};

const parseFixedWidthReport = (text) => {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const ranges = computeColumnRanges(lines[1] ?? "");
  const headers = ranges.map(([s, e]) => (lines[0] ?? "").slice(s, e).trim());
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\(\d+ rows? affected\)/.test(trimmed)) continue;
    if (trimmed.startsWith("Completion time:")) continue;
    const row = {};
    ranges.forEach(([s, e], idx) => { row[headers[idx]] = (line.slice(s, e) || "").trim(); });
    rows.push(row);
  }
  return { headers, rows };
};

const { rows: sourceRows } = parseFixedWidthReport(readFileSync(sourcePath, "utf8"));
console.log(`Source: ${sourceRows.length} employee rows read.`);

// Lookup keys, in priority order: exact (th,en) pair, then en-only, then th-only —
// covers the rare case where a master row's th was filled in from en (see import-org-hierarchy.mjs).
const buildLookup = (masterRows, idField, thField, enField) => {
  const byPair = new Map();
  const byEn = new Map();
  const byTh = new Map();
  for (const row of masterRows) {
    const th = row[thField] ?? "";
    const en = row[enField] ?? "";
    byPair.set(`${th}||${en}`, row[idField]);
    if (en) byEn.set(en, row[idField]);
    if (th) byTh.set(th, row[idField]);
  }
  return (th, en) => byPair.get(`${th}||${en}`) ?? (en && byEn.get(en)) ?? (th && byTh.get(th)) ?? null;
};

const pool = await sql.connect(targetConfig);
const transaction = new sql.Transaction(pool);
await transaction.begin();
const summary = {
  updated: 0,
  skippedBlankEmpId: 0,
  skippedUnknownCompany: 0,
  skippedNoMatchingEmployee: 0,
};
const unmatchedText = { plant: new Set(), division: new Set(), department: new Set(), section: new Set() };

try {
  const companies = (await new sql.Request(transaction).query("SELECT company_id, company_code FROM dbo.company")).recordset;
  const companyMap = new Map(companies.map((c) => [c.company_code, c.company_id]));

  const employees = (await new sql.Request(transaction).query("SELECT employee_id, company_id, employee_code FROM dbo.employee")).recordset;
  const employeeByKey = new Map(employees.map((e) => [`${e.company_id}|${e.employee_code}`, e.employee_id]));

  const plants = (await new sql.Request(transaction).query("SELECT function_id, function_name_th, function_name_en FROM dbo.organization_function")).recordset;
  const divisions = (await new sql.Request(transaction).query("SELECT division_id, division_name_th, division_name_en FROM dbo.division")).recordset;
  const departments = (await new sql.Request(transaction).query("SELECT department_id, department_name_th, department_name_en FROM dbo.department")).recordset;
  const sections = (await new sql.Request(transaction).query("SELECT section_id, section_name_th, section_name_en FROM dbo.section")).recordset;

  const lookupPlant = buildLookup(plants, "function_id", "function_name_th", "function_name_en");
  const lookupDivision = buildLookup(divisions, "division_id", "division_name_th", "division_name_en");
  const lookupDepartment = buildLookup(departments, "department_id", "department_name_th", "department_name_en");
  const lookupSection = buildLookup(sections, "section_id", "section_name_th", "section_name_en");

  for (const row of sourceRows) {
    const empId = trimOrNull(row.EmpID);
    if (!empId) { summary.skippedBlankEmpId++; continue; }

    const companyCode = COMCODE_TO_COMPANY_CODE[trimOrNull(row.ComCode) ?? ""];
    const companyId = companyCode ? companyMap.get(companyCode) : undefined;
    if (!companyId) { summary.skippedUnknownCompany++; continue; }

    const employeeId = employeeByKey.get(`${companyId}|${empId}`);
    if (!employeeId) { summary.skippedNoMatchingEmployee++; continue; }

    const plantTh = row.Plant_TH ?? "";
    const plantEn = row.Plant_EN ?? "";
    const divisionTh = row.Division_TH ?? "";
    const divisionEn = row.Division_EN ?? "";
    const departmentTh = row.Department_TH ?? "";
    const departmentEn = row.Department_EN ?? "";
    const sectionTh = row.Section_TH ?? "";
    const sectionEn = row.Section_EN ?? "";

    const functionId = plantTh || plantEn ? lookupPlant(plantTh, plantEn) : null;
    const divisionId = divisionTh || divisionEn ? lookupDivision(divisionTh, divisionEn) : null;
    const departmentId = departmentTh || departmentEn ? lookupDepartment(departmentTh, departmentEn) : null;
    const sectionId = sectionTh || sectionEn ? lookupSection(sectionTh, sectionEn) : null;

    if ((plantTh || plantEn) && !functionId) unmatchedText.plant.add(`${plantTh} / ${plantEn}`);
    if ((divisionTh || divisionEn) && !divisionId) unmatchedText.division.add(`${divisionTh} / ${divisionEn}`);
    if ((departmentTh || departmentEn) && !departmentId) unmatchedText.department.add(`${departmentTh} / ${departmentEn}`);
    if ((sectionTh || sectionEn) && !sectionId) unmatchedText.section.add(`${sectionTh} / ${sectionEn}`);

    if (!dryRun) {
      const req = new sql.Request(transaction);
      req.input("employeeId", sql.BigInt, employeeId);
      req.input("functionId", sql.BigInt, functionId ?? null);
      req.input("divisionId", sql.BigInt, divisionId ?? null);
      req.input("departmentId", sql.BigInt, departmentId ?? null);
      req.input("sectionId", sql.BigInt, sectionId ?? null);
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
  for (const [level, set] of Object.entries(unmatchedText)) {
    if (set.size) {
      console.warn(`Unmatched ${level} text (no exact match in master list, left NULL for those employees):`);
      [...set].forEach((text) => console.warn(`  ${text}`));
    }
  }
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await pool.close();
}
