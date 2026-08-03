import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env.local", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const config = {
  server: process.env.DB_INSTANCE
    ? `${required("DB_SERVER")}\\${process.env.DB_INSTANCE}`
    : required("DB_SERVER"),
  database: required("DB_DATABASE"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate:
      process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
  },
};

const normalizedTitle =
  "UPPER(REPLACE(REPLACE(LTRIM(RTRIM(title_en)), N'.', N''), N' ', N''))";
const pool = await sql.connect(config);
const transaction = new sql.Transaction(pool);
await transaction.begin();

try {
  const validation = await new sql.Request(transaction).query(`
    SELECT
      COUNT(*) AS total_employees,
      SUM(CASE WHEN title_en IS NULL OR ${normalizedTitle} NOT IN (N'MR', N'MRS', N'MS', N'MISS') THEN 1 ELSE 0 END) AS unsupported_titles
    FROM dbo.employee;
  `);
  const before = validation.recordset[0];
  if (Number(before.unsupported_titles) !== 0) {
    throw new Error(
      `Cannot safely map ${before.unsupported_titles} employee title(s) from title_en`,
    );
  }

  const update = new sql.Request(transaction);
  update.input("mr", sql.NVarChar(50), "นาย");
  update.input("mrs", sql.NVarChar(50), "นาง");
  update.input("ms", sql.NVarChar(50), "นางสาว");
  const result = await update.query(`
    UPDATE dbo.employee
    SET title_th = CASE
      WHEN ${normalizedTitle} = N'MR' THEN @mr
      WHEN ${normalizedTitle} = N'MRS' THEN @mrs
      ELSE @ms
    END;

    SELECT
      COUNT(*) AS total_employees,
      SUM(CASE WHEN title_th IN (@mr, @mrs, @ms) THEN 1 ELSE 0 END) AS valid_thai_titles,
      SUM(CASE WHEN title_th IS NULL OR title_th NOT IN (@mr, @mrs, @ms) THEN 1 ELSE 0 END) AS invalid_thai_titles
    FROM dbo.employee;
  `);
  const verification = result.recordsets[0][0];
  if (Number(verification.invalid_thai_titles) !== 0) {
    throw new Error("Thai employee title verification failed");
  }

  await transaction.commit();
  process.stdout.write(
    `Thai title backfill completed: ${verification.valid_thai_titles}/${verification.total_employees} employees valid.\n`,
  );
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await pool.close();
}
