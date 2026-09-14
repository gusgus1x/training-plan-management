import { config as loadEnvironment } from "dotenv";
import sql from "mssql";

loadEnvironment({ path: ".env", quiet: true });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in .env`);
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
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
  },
};

export async function runPurge({ dryRun = false } = {}) {
  const pool = await sql.connect(config);
  try {
    const today = new Date().toISOString().slice(0, 10);
    console.log(`\n🔍 [Audit Log Purge] วันที่ตรวจสอบ: ${today}`);

    const countRes = await pool.request().query(`
      SELECT COUNT(1) AS count
      FROM dbo.audit_log
      WHERE retain_until < CAST(GETDATE() AS DATE)
    `);
    const count = countRes.recordset[0].count;

    if (dryRun) {
      console.log(`📊 [Dry Run] พบข้อมูล Audit Log ที่หมดอายุ: ${count.toLocaleString()} รายการ (ยังไม่ได้ลบจริง)`);
      return { count, deleted: 0 };
    }

    if (count === 0) {
      console.log("✨ [Audit Log Purge] ฐานข้อมูลสะอาด ไม่มีข้อมูล Audit Log ที่หมดอายุ (0 รายการ)");
      return { count: 0, deleted: 0 };
    }

    const delRes = await pool.request().query(`
      DELETE FROM dbo.audit_log
      WHERE retain_until < CAST(GETDATE() AS DATE)
    `);
    const deleted = delRes.rowsAffected[0] || 0;
    console.log(`✅ [Audit Log Purge] ลบข้อมูล Audit Log ที่หมดอายุแล้วจำนวน ${deleted.toLocaleString()} รายการ เรียบร้อย\n`);
    return { count, deleted };
  } finally {
    await pool.close();
  }
}

// CLI Execution
const isDryRun = process.argv.includes("--dry-run");
runPurge({ dryRun: isDryRun })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ [Audit Log Purge Error]:", err.message);
    process.exit(1);
  });
