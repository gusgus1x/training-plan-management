// Applies one .sql file to the configured database, splitting on GO the way sqlcmd does.
// Usage: node scripts/apply-sql-file.mjs prisma/migrations/27_Employee_UserId_Not_Null.sql
import { config as loadEnvironment } from "dotenv";
import { readFileSync } from "node:fs";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const file = process.argv[2];
if (!file) throw new Error("usage: node scripts/apply-sql-file.mjs <path-to.sql>");

const batches = readFileSync(file, "utf8")
  .split(/^\s*GO\s*$/gim)
  .map((batch) => batch.trim())
  .filter(Boolean);

const pool = await sql.connect({
  server: process.env.DB_INSTANCE
    ? `${required("DB_SERVER")}\${process.env.DB_INSTANCE}`
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
  for (const [index, batch] of batches.entries()) {
    await pool.request().batch(batch);
    console.log(`  batch ${index + 1}/${batches.length} ok`);
  }
  console.log(`applied ${file}`);
} finally {
  await pool.close();
}
