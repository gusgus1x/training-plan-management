// One-time import: seeds the Plant (dbo.organization_function), Division, Department, and
// Section master lists from the SSMS "Results to Text" report exports in result-funtion/.
// - Plant reuses organization_function's existing mock rows in place (UPDATE, preserving their
//   function_id) for as many as line up, then INSERTs any remaining new Plant rows — avoids
//   leaving orphaned mock rows around. Confirmed safe: employee.function_id was NULL for every
//   employee until this pass, so nothing already references the old mock rows' identity.
// - Division/Department/Section are brand new empty tables (migration 18) — plain insert.
// Usage: node scripts/import-org-hierarchy.mjs [--dry-run]
import { config as loadEnvironment } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });
const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const dryRun = process.argv.includes("--dry-run");

const targetConfig = {
  server: process.env.DB_INSTANCE ? `${required("DB_SERVER")}\\${process.env.DB_INSTANCE}` : required("DB_SERVER"),
  database: required("DB_DATABASE"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  options: { encrypt: process.env.DB_ENCRYPT === "true", trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false" },
};

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

// Each of these files has exactly two columns: <Level>_TH, <Level>_EN.
const parseThEnPairs = (relativePath) => {
  const text = readFileSync(join("result-funtion", relativePath), "utf8");
  const { headers, rows } = parseFixedWidthReport(text);
  return rows
    .map((row) => ({ th: row[headers[0]] ?? "", en: row[headers[1]] ?? "" }))
    .filter((pair) => pair.th || pair.en);
};

const withCodes = (pairs, prefix) =>
  pairs.map((pair, index) => ({ ...pair, code: `${prefix}${String(index + 1).padStart(4, "0")}` }));

const plantRows = withCodes(parseThEnPairs("result-plant-th-en.rpt"), "PLT");
const divisionRows = withCodes(parseThEnPairs("result-division_th-en.rpt"), "DIV");
const departmentRows = withCodes(parseThEnPairs("result-department-th-en.rpt"), "DEP");
const sectionRows = withCodes(parseThEnPairs("result-section-th-en.rpt"), "SEC");

console.log(`Parsed: ${plantRows.length} Plant, ${divisionRows.length} Division, ${departmentRows.length} Department, ${sectionRows.length} Section rows.`);

const pool = await sql.connect(targetConfig);
const transaction = new sql.Transaction(pool);
await transaction.begin();
try {
  const insertRows = async (rows, table, codeColumn, thColumn, enColumn) => {
    let inserted = 0;
    for (const row of rows) {
      if (!dryRun) {
        const req = new sql.Request(transaction);
        req.input("code", sql.NVarChar(30), row.code);
        req.input("th", sql.NVarChar(255), row.th || row.en);
        req.input("en", sql.NVarChar(255), row.en || null);
        await req.query(`
          INSERT INTO dbo.${table} (${codeColumn}, ${thColumn}, ${enColumn}, status)
          VALUES (@code, @th, @en, N'ACTIVE')
        `);
      }
      inserted++;
    }
    console.log(`${table}: ${dryRun ? "would insert" : "inserted"} ${inserted} row(s).`);
  };

  // Plant: reuse existing organization_function rows in place, oldest (lowest function_id) first.
  const existingFunctions = (
    await new sql.Request(transaction).query("SELECT function_id, function_code, function_name_th FROM dbo.organization_function ORDER BY function_id ASC")
  ).recordset;
  console.log(`organization_function currently has ${existingFunctions.length} row(s) before this import.`);

  const reusable = Math.min(existingFunctions.length, plantRows.length);
  for (let i = 0; i < reusable; i++) {
    const target = existingFunctions[i];
    const row = plantRows[i];
    if (!dryRun) {
      const req = new sql.Request(transaction);
      req.input("id", sql.BigInt, target.function_id);
      req.input("code", sql.NVarChar(30), row.code);
      req.input("th", sql.NVarChar(255), row.th || row.en);
      req.input("en", sql.NVarChar(255), row.en || null);
      await req.query(`
        UPDATE dbo.organization_function
        SET function_code = @code, function_name_th = @th, function_name_en = @en, status = N'ACTIVE'
        WHERE function_id = @id
      `);
    }
    console.log(`  ${dryRun ? "would update" : "updated"} function_id ${target.function_id}: ${target.function_code} (${target.function_name_th}) -> ${row.code} (${row.th})`);
  }
  await insertRows(plantRows.slice(reusable), "organization_function", "function_code", "function_name_th", "function_name_en");
  console.log(`organization_function: ${dryRun ? "would update" : "updated"} ${reusable} row(s) in place, ${dryRun ? "would insert" : "inserted"} ${plantRows.length - reusable} new row(s).`);

  const leftoverFunctions = existingFunctions.slice(plantRows.length);
  if (leftoverFunctions.length) {
    console.warn(`organization_function has ${leftoverFunctions.length} pre-existing row(s) beyond the ${plantRows.length} Plant rows (not touched — review/remove by hand via the Function Data UI if leftover):`);
    leftoverFunctions.forEach((row) => console.warn(`  ${row.function_code}: ${row.function_name_th}`));
  }

  await insertRows(divisionRows, "division", "division_code", "division_name_th", "division_name_en");
  await insertRows(departmentRows, "department", "department_code", "department_name_th", "department_name_en");
  await insertRows(sectionRows, "section", "section_code", "section_name_th", "section_name_en");

  if (dryRun) { await transaction.rollback(); console.log("DRY RUN — no changes committed."); }
  else { await transaction.commit(); console.log("Committed."); }
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await pool.close();
}
