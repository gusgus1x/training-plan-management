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
    console.log("Checking dbo.evaluation_form records...");
    const rows = (await pool.request().query("SELECT evaluation_form_id, form_code, form_name, timing FROM dbo.evaluation_form")).recordset;
    console.log("Current evaluation forms:", rows);

    for (const row of rows) {
      if (!row.form_code || row.form_code.startsWith("EVA-") || row.form_code === "AUTO") {
        const prefix = row.timing === "AFTER_TRAINING" ? "EVL-AFTER" : "EVL-30DAY";
        const newCode = `${prefix}-000001`;
        console.log(`Updating form ${row.evaluation_form_id} code from '${row.form_code}' to '${newCode}'`);
        await pool.request().query(`
          UPDATE dbo.evaluation_form
          SET form_code = '${newCode}'
          WHERE evaluation_form_id = ${row.evaluation_form_id}
        `);
      }
    }

    console.log("✅ Updated evaluation_form codes!");
  } finally {
    await pool.close();
  }
}

main().catch(console.error);
