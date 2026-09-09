import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const pool = await sql.connect({
  server: process.env.DB_INSTANCE ? `${required("DB_SERVER")}\\${process.env.DB_INSTANCE}` : required("DB_SERVER"),
  database: required("DB_DATABASE"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  options: { encrypt: false, trustServerCertificate: true },
});

const show = async (label, query) => {
  const result = await pool.request().query(query);
  console.log(`\n== ${label}`);
  console.table(result.recordset);
};

await show("table exists", `
  SELECT name FROM sys.tables WHERE name = 'training_evaluation_reviewer'`);

await show("reviewer columns", `
  SELECT c.name, t.name AS type, c.max_length, c.is_nullable
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.training_evaluation_reviewer') ORDER BY c.column_id`);

await show("reviewer keys/indexes", `
  SELECT name, type_desc, is_primary_key, is_unique
  FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.training_evaluation_reviewer') AND name IS NOT NULL`);

await show("reviewer foreign keys", `
  SELECT name FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('dbo.training_evaluation_reviewer')`);

await show("respondent_user_id", `
  SELECT c.name, t.name AS type, c.is_nullable
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.evaluation_submission') AND c.name = 'respondent_user_id'`);

await show("submission unique indexes", `
  SELECT i.name, i.is_unique, COUNT(ic.column_id) AS column_count
  FROM sys.indexes i LEFT JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  WHERE i.object_id = OBJECT_ID('dbo.evaluation_submission') AND i.name IS NOT NULL
  GROUP BY i.name, i.is_unique`);

await show("rows still unbackfilled (must be 0)", `
  SELECT COUNT(*) AS unbackfilled FROM dbo.evaluation_submission WHERE respondent_user_id IS NULL`);

await pool.close();
