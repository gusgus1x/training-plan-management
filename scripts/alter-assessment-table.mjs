import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const config = {
  server: process.env.DB_INSTANCE ? `${required("DB_SERVER")}\\${process.env.DB_INSTANCE}` : required("DB_SERVER"),
  database: required("DB_DATABASE"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
  },
};

async function main() {
  console.log("Connecting to SQL Server...");
  const pool = await sql.connect(config);
  try {
    console.log("Checking and altering dbo.assessment table...");
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID('dbo.assessment') 
        AND name = 'assessment_code'
      )
      BEGIN
        ALTER TABLE dbo.assessment ADD assessment_code NVARCHAR(50) NULL;
        PRINT 'Added assessment_code column to dbo.assessment';
      END
    `);
    console.log("✅ Successfully ensured assessment_code column exists in dbo.assessment!");

    console.log("Backfilling assessment_code in dbo.assessment...");
    const result = await pool.request().query(`
      UPDATE a
      SET a.assessment_code = s.series_code
      FROM dbo.assessment a
      INNER JOIN dbo.assessment_series s ON a.assessment_series_id = s.assessment_series_id
      WHERE a.assessment_code IS NULL;
    `);
    console.log("✅ Successfully backfilled rows:", result.rowsAffected[0]);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error("❌ Failed to alter table:", err);
  process.exit(1);
});
