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
  const pool = await sql.connect(config);
  try {
    console.log("Fixing 'AUTO' series_code in dbo.assessment_series...");
    await pool.request().query(`
      UPDATE dbo.assessment_series
      SET series_code = CASE 
        WHEN purpose = 'PRE_TEST' THEN 'PRE-000001'
        WHEN purpose = 'POST_TEST' THEN 'POST-000001'
        ELSE 'ASM-000001'
      END
      WHERE series_code = 'AUTO' OR series_code IS NULL OR TRIM(series_code) = '';
    `);
    
    console.log("Fixing 'AUTO' assessment_code in dbo.assessment...");
    await pool.request().query(`
      UPDATE a
      SET a.assessment_code = s.series_code
      FROM dbo.assessment a
      INNER JOIN dbo.assessment_series s ON a.assessment_series_id = s.assessment_series_id
      WHERE a.assessment_code = 'AUTO' OR a.assessment_code IS NULL OR TRIM(a.assessment_code) = '';
    `);

    console.log("✅ Fixed all 'AUTO' assessment codes in database!");

    const seriesList = await pool.request().query("SELECT assessment_series_id, series_code, series_name, purpose FROM dbo.assessment_series");
    console.log("Current assessment_series:", seriesList.recordset);

    const assessmentList = await pool.request().query("SELECT assessment_id, assessment_series_id, assessment_code, version_no FROM dbo.assessment");
    console.log("Current assessment:", assessmentList.recordset);
  } finally {
    await pool.close();
  }
}

main().catch(console.error);
