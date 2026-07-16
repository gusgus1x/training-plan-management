import { pathToFileURL } from "node:url";
import mssql from "mssql";
import { hashPassword, verifyPassword } from "../app/lib/auth/password.ts";
import { validateDevelopmentPassword } from "./seed-development-account.mjs";

export const ACTIVE_STATUS = "ACTIVE";
export const APPROVED_ROLE_CODES = ["HRD_FACTORY", "EMPLOYEE"];

export const COMPANIES = ["ATA", "TEP", "ATFB", "NIC", "SATI", "SNF"].map(
  (code) => ({
    code,
    nameTh: `บริษัทตัวอย่างสำหรับการพัฒนา ${code}`,
    nameEn: `${code} Development Demo Company`,
  }),
);

export const FUNCTIONS = [
  {
    code: "DEV_HR",
    nameTh: "ทรัพยากรบุคคลสำหรับการพัฒนา",
    nameEn: "Development Human Resources",
  },
  {
    code: "DEV_PRODUCTION",
    nameTh: "ฝ่ายผลิตสำหรับการพัฒนา",
    nameEn: "Development Production",
  },
];

export const POSITIONS = [
  {
    code: "DEV_HRD_OFFICER",
    nameTh: "เจ้าหน้าที่พัฒนาทรัพยากรบุคคลตัวอย่าง",
    nameEn: "Development HRD Officer",
  },
  {
    code: "DEV_OPERATOR",
    nameTh: "พนักงานฝ่ายผลิตตัวอย่าง",
    nameEn: "Development Operator",
  },
];

export const LEVELS = [
  {
    code: "DEV_STAFF",
    nameTh: "ระดับเจ้าหน้าที่ตัวอย่าง",
    nameEn: "Development Staff",
    pl: "DEV-PL3",
  },
  {
    code: "DEV_OPERATOR",
    nameTh: "ระดับปฏิบัติการตัวอย่าง",
    nameEn: "Development Operator",
    pl: "DEV-PL1",
  },
];

export const FUNCTION_MAPPINGS = COMPANIES.flatMap(({ code }) => [
  {
    companyCode: code,
    plantCode: `${code}-HRD-DEV`,
    plantName: `HRD Development (${code})`,
    functionCode: "DEV_HR",
  },
  {
    companyCode: code,
    plantCode: `${code}-PROD-DEV`,
    plantName: `Production Development (${code})`,
    functionCode: "DEV_PRODUCTION",
  },
]);

const PROFILE_VALUES = {
  ATA: ["เอทีเอ", "Ata", "01", "11", "21"],
  TEP: ["ทีอีพี", "Tep", "02", "12", "22"],
  ATFB: ["เอทีเอฟบี", "Atfb", "03", "13", "23"],
  NIC: ["เอ็นไอซี", "Nic", "04", "14", "24"],
  SATI: ["ซาติ", "Sati", "05", "15", "25"],
  SNF: ["เอสเอ็นเอฟ", "Snf", "06", "16", "26"],
};

const createProfile = (companyCode, roleCode, index) => {
  const [thaiCode, englishCode, month, factoryDay, employeeDay] =
    PROFILE_VALUES[companyCode];
  const factory = roleCode === "HRD_FACTORY";

  return {
    username: `dev_${factory ? "factory" : "employee"}_${companyCode.toLowerCase()}`,
    roleCode,
    companyCode,
    employeeCode: `DEV-${companyCode}-${factory ? "HRD" : "EMP"}-001`,
    functionCode: factory ? "DEV_HR" : "DEV_PRODUCTION",
    positionCode: factory ? "DEV_HRD_OFFICER" : "DEV_OPERATOR",
    levelCode: factory ? "DEV_STAFF" : "DEV_OPERATOR",
    titleTh: "คุณ",
    titleEn: "Mx.",
    firstNameTh: `${factory ? "ทดสอบ" : "ตัวอย่าง"}${thaiCode}`,
    lastNameTh: factory ? "แฟคทอรีเดโม" : "พนักงานเดโม",
    firstNameEn: `${factory ? "Test" : "Sample"}${englishCode}`,
    lastNameEn: factory ? "FactoryDemo" : "EmployeeDemo",
    birthDate: `${factory ? "1990" : "1995"}-${month}-${factory ? factoryDay : employeeDay}`,
    telephone: `000-000-${factory ? "1" : "2"}${String(index + 1).padStart(3, "0")}`,
    email: `dev.${factory ? "factory" : "employee"}.${companyCode.toLowerCase()}@example.invalid`,
    hireDate: `${factory ? "2020" : "2022"}-${month}-${factory ? factoryDay : employeeDay}`,
  };
};

export const DEVELOPMENT_PROFILES = COMPANIES.flatMap(({ code }, index) => [
  createProfile(code, "HRD_FACTORY", index),
  createProfile(code, "EMPLOYEE", index),
]);

export const SQL = {
  verifyProvisioner:
    "SELECT IS_SRVROLEMEMBER(N'sysadmin') AS is_sysadmin",
  findRole: `SELECT role_id, role_code, status FROM dbo.role WITH (UPDLOCK, HOLDLOCK) WHERE role_code = @roleCode`,
  findCompany: `SELECT company_id, company_code, company_name_th, company_name_en, status FROM dbo.company WITH (UPDLOCK, HOLDLOCK) WHERE company_code = @code`,
  insertCompany: `INSERT INTO dbo.company (company_code, company_name_th, company_name_en, status) OUTPUT INSERTED.company_id VALUES (@code, @nameTh, @nameEn, @status)`,
  findFunction: `SELECT function_id, function_code, function_name_th, function_name_en, status FROM dbo.organization_function WITH (UPDLOCK, HOLDLOCK) WHERE function_code = @code`,
  insertFunction: `INSERT INTO dbo.organization_function (function_code, function_name_th, function_name_en, status) OUTPUT INSERTED.function_id VALUES (@code, @nameTh, @nameEn, @status)`,
  findPosition: `SELECT position_id, position_code, position_name_th, position_name_en, status FROM dbo.position WITH (UPDLOCK, HOLDLOCK) WHERE position_code = @code`,
  insertPosition: `INSERT INTO dbo.position (position_code, position_name_th, position_name_en, status) OUTPUT INSERTED.position_id VALUES (@code, @nameTh, @nameEn, @status)`,
  findLevel: `SELECT level_id, level_code, level_name_th, level_name_en, pl, status FROM dbo.employee_level WITH (UPDLOCK, HOLDLOCK) WHERE level_code = @code`,
  insertLevel: `INSERT INTO dbo.employee_level (level_code, level_name_th, level_name_en, pl, status) OUTPUT INSERTED.level_id VALUES (@code, @nameTh, @nameEn, @pl, @status)`,
  findMapping: `SELECT m.function_mapping_id, m.plant_function_name, m.status, f.function_code FROM dbo.company_function_mapping AS m WITH (UPDLOCK, HOLDLOCK) INNER JOIN dbo.organization_function AS f ON f.function_id = m.function_id WHERE m.company_id = @companyId AND m.plant_function_code = @plantCode`,
  insertMapping: `INSERT INTO dbo.company_function_mapping (company_id, plant_function_code, plant_function_name, function_id, status) VALUES (@companyId, @plantCode, @plantName, @functionId, @status)`,
  findEmployee: `SELECT e.employee_id, e.function_id, e.position_id, e.level_id, e.national_id_hash, e.birth_date, e.title_th, e.title_en, e.first_name_th, e.last_name_th, e.first_name_en, e.last_name_en, e.telephone, e.email, e.hire_date, e.employment_status FROM dbo.employee AS e WITH (UPDLOCK, HOLDLOCK) WHERE e.company_id = @companyId AND e.employee_code = @employeeCode`,
  insertEmployee: `INSERT INTO dbo.employee (company_id, function_id, position_id, level_id, employee_code, national_id_hash, birth_date, title_th, title_en, first_name_th, last_name_th, first_name_en, last_name_en, telephone, email, hire_date, employment_status) OUTPUT INSERTED.employee_id VALUES (@companyId, @functionId, @positionId, @levelId, @employeeCode, NULL, @birthDate, @titleTh, @titleEn, @firstNameTh, @lastNameTh, @firstNameEn, @lastNameEn, @telephone, @email, @hireDate, @status)`,
  findAccount: `SELECT ua.user_id, ua.role_id, ua.employee_id, ua.company_id, ua.email, ua.status, ua.password_hash FROM dbo.user_account AS ua WITH (UPDLOCK, HOLDLOCK) WHERE ua.username = @username`,
  insertAccount: `INSERT INTO dbo.user_account (role_id, employee_id, company_id, username, password_hash, email, status) VALUES (@roleId, @employeeId, @companyId, @username, @passwordHash, @email, @status)`,
};

export class DatasetConflictError extends Error {}

const same = (actual, expected) =>
  Object.entries(expected).every(([key, value]) => {
    const actualValue = actual[key];
    if (value instanceof Date) {
      return new Date(actualValue).toISOString().slice(0, 10) ===
        value.toISOString().slice(0, 10);
    }
    return actualValue === value;
  });

const requireSingleOrEmpty = (rows, label) => {
  if (rows.length > 1) throw new DatasetConflictError(`${label} is not unique.`);
  return rows[0] ?? null;
};

const assertMatching = (row, expected, label) => {
  if (!same(row, expected)) {
    throw new DatasetConflictError(`${label} conflicts with the approved dataset.`);
  }
};

const inputCommonMaster = (request, item) =>
  request
    .input("code", mssql.NVarChar(30), item.code)
    .input("nameTh", mssql.NVarChar(255), item.nameTh)
    .input("nameEn", mssql.NVarChar(255), item.nameEn)
    .input("status", mssql.NVarChar(20), ACTIVE_STATUS);

const ensureMaster = async ({ transaction, item, queries, fields, idField }) => {
  const result = await transaction
    .request()
    .input("code", mssql.NVarChar(30), item.code)
    .query(queries.find);
  const row = requireSingleOrEmpty(result.recordset, item.code);

  if (row) {
    assertMatching(row, fields(item), item.code);
    return String(row[idField]);
  }

  const inserted = await inputCommonMaster(transaction.request(), item).query(
    queries.insert,
  );
  if (inserted.rowsAffected[0] !== 1) {
    throw new DatasetConflictError(`${item.code} insert did not affect one row.`);
  }
  return String(inserted.recordset[0][idField]);
};

const readHidden = (prompt) => {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new DatasetConflictError("An interactive terminal is required.");
  }
  process.stdout.write(prompt);
  process.stdin.setEncoding("utf8");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");

      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") return finish(new DatasetConflictError("Seed cancelled."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on("data", onData);
  });
};

const requiredEnvironment = (key) => {
  const value = process.env[key]?.trim();
  if (!value) throw new DatasetConflictError(`Missing environment setting: ${key}`);
  return value;
};

const booleanEnvironment = (key, fallback) => {
  const value = process.env[key]?.trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes"].includes(value)) return true;
  if (["0", "false", "no"].includes(value)) return false;
  throw new DatasetConflictError(`${key} must be boolean.`);
};

const connectionConfig = (user, password) => ({
  server: requiredEnvironment("DB_SERVER"),
  database: requiredEnvironment("DB_DATABASE"),
  user,
  password,
  connectionTimeout: 15_000,
  requestTimeout: 15_000,
  pool: { max: 1, min: 0, idleTimeoutMillis: 5_000 },
  options: {
    instanceName: requiredEnvironment("DB_INSTANCE"),
    encrypt: booleanEnvironment("DB_ENCRYPT", false),
    trustServerCertificate: booleanEnvironment("DB_TRUST_SERVER_CERTIFICATE", true),
    enableArithAbort: true,
  },
});

export const validateDataset = () => {
  const usernames = new Set(DEVELOPMENT_PROFILES.map((item) => item.username));
  const employeeKeys = new Set(
    DEVELOPMENT_PROFILES.map((item) => `${item.companyCode}:${item.employeeCode}`),
  );
  if (DEVELOPMENT_PROFILES.length !== 12 || usernames.size !== 12 || employeeKeys.size !== 12) {
    throw new DatasetConflictError("Dataset identities are not unique.");
  }
  if (DEVELOPMENT_PROFILES.some((item) => item.username === "dev_hrd_center")) {
    throw new DatasetConflictError("Protected HRD Center account is in the dataset.");
  }
};

export const seedDevelopmentDataset = async ({
  developmentPassword,
  provisioningLogin,
  provisioningPassword,
  createPool = (config) => new mssql.ConnectionPool(config),
}) => {
  validateDataset();
  if (["training_plan_app", "sa", "sysadmin"].includes(provisioningLogin.toLowerCase())) {
    throw new DatasetConflictError("Provisioning login is not permitted.");
  }
  const pool = createPool(connectionConfig(provisioningLogin, provisioningPassword));
  let transaction;
  let open = false;
  const hashes = [];
  try {
    for (const profile of DEVELOPMENT_PROFILES) {
      hashes.push([profile.username, await hashPassword(developmentPassword)]);
    }
    const hashByUsername = new Map(hashes);
    await pool.connect();
    transaction = new mssql.Transaction(pool);
    await transaction.begin(mssql.ISOLATION_LEVEL.SERIALIZABLE);
    open = true;

    const provisioner = await transaction.request().query(SQL.verifyProvisioner);
    if (provisioner.recordset[0]?.is_sysadmin !== 0) {
      throw new DatasetConflictError("Provisioning login is not permitted.");
    }

    const roles = new Map();
    for (const roleCode of APPROVED_ROLE_CODES) {
      const result = await transaction.request()
        .input("roleCode", mssql.NVarChar(30), roleCode).query(SQL.findRole);
      const role = requireSingleOrEmpty(result.recordset, roleCode);
      if (!role || role.status !== ACTIVE_STATUS) {
        throw new DatasetConflictError(`${roleCode} is missing or inactive.`);
      }
      roles.set(roleCode, String(role.role_id));
    }

    const companies = new Map();
    for (const item of COMPANIES) {
      companies.set(item.code, await ensureMaster({
        transaction, item, idField: "company_id",
        queries: { find: SQL.findCompany, insert: SQL.insertCompany },
        fields: (value) => ({ company_code: value.code, company_name_th: value.nameTh, company_name_en: value.nameEn, status: ACTIVE_STATUS }),
      }));
    }
    const functions = new Map();
    for (const item of FUNCTIONS) {
      functions.set(item.code, await ensureMaster({
        transaction, item, idField: "function_id",
        queries: { find: SQL.findFunction, insert: SQL.insertFunction },
        fields: (value) => ({ function_code: value.code, function_name_th: value.nameTh, function_name_en: value.nameEn, status: ACTIVE_STATUS }),
      }));
    }
    const positions = new Map();
    for (const item of POSITIONS) {
      positions.set(item.code, await ensureMaster({
        transaction, item, idField: "position_id",
        queries: { find: SQL.findPosition, insert: SQL.insertPosition },
        fields: (value) => ({ position_code: value.code, position_name_th: value.nameTh, position_name_en: value.nameEn, status: ACTIVE_STATUS }),
      }));
    }
    const levels = new Map();
    for (const item of LEVELS) {
      const result = await transaction.request().input("code", mssql.NVarChar(30), item.code).query(SQL.findLevel);
      const row = requireSingleOrEmpty(result.recordset, item.code);
      if (row) {
        assertMatching(row, { level_code: item.code, level_name_th: item.nameTh, level_name_en: item.nameEn, pl: item.pl, status: ACTIVE_STATUS }, item.code);
        levels.set(item.code, String(row.level_id));
      } else {
        const inserted = await inputCommonMaster(transaction.request(), item)
          .input("pl", mssql.NVarChar(30), item.pl).query(SQL.insertLevel);
        if (inserted.rowsAffected[0] !== 1) throw new DatasetConflictError(`${item.code} insert failed.`);
        levels.set(item.code, String(inserted.recordset[0].level_id));
      }
    }

    for (const item of FUNCTION_MAPPINGS) {
      const companyId = companies.get(item.companyCode);
      const functionId = functions.get(item.functionCode);
      const result = await transaction.request()
        .input("companyId", mssql.BigInt, companyId)
        .input("plantCode", mssql.NVarChar(50), item.plantCode)
        .query(SQL.findMapping);
      const row = requireSingleOrEmpty(result.recordset, `${item.companyCode}:${item.plantCode}`);
      if (row) {
        assertMatching(row, { plant_function_name: item.plantName, function_code: item.functionCode, status: ACTIVE_STATUS }, item.plantCode);
      } else {
        const inserted = await transaction.request()
          .input("companyId", mssql.BigInt, companyId)
          .input("plantCode", mssql.NVarChar(50), item.plantCode)
          .input("plantName", mssql.NVarChar(255), item.plantName)
          .input("functionId", mssql.BigInt, functionId)
          .input("status", mssql.NVarChar(20), ACTIVE_STATUS)
          .query(SQL.insertMapping);
        if (inserted.rowsAffected[0] !== 1) throw new DatasetConflictError(`${item.plantCode} insert failed.`);
      }
    }

    const employees = new Map();
    for (const profile of DEVELOPMENT_PROFILES) {
      const companyId = companies.get(profile.companyCode);
      const functionId = functions.get(profile.functionCode);
      const positionId = positions.get(profile.positionCode);
      const levelId = levels.get(profile.levelCode);
      const result = await transaction.request()
        .input("companyId", mssql.BigInt, companyId)
        .input("employeeCode", mssql.NVarChar(50), profile.employeeCode)
        .query(SQL.findEmployee);
      const row = requireSingleOrEmpty(result.recordset, profile.employeeCode);
      const expected = {
        function_id: String(functionId), position_id: String(positionId), level_id: String(levelId), national_id_hash: null,
        birth_date: new Date(`${profile.birthDate}T00:00:00Z`), title_th: profile.titleTh, title_en: profile.titleEn,
        first_name_th: profile.firstNameTh, last_name_th: profile.lastNameTh, first_name_en: profile.firstNameEn,
        last_name_en: profile.lastNameEn, telephone: profile.telephone, email: profile.email,
        hire_date: new Date(`${profile.hireDate}T00:00:00Z`), employment_status: ACTIVE_STATUS,
      };
      if (row) {
        const normalized = { ...row, function_id: String(row.function_id), position_id: String(row.position_id), level_id: String(row.level_id) };
        assertMatching(normalized, expected, profile.employeeCode);
        employees.set(profile.username, String(row.employee_id));
      } else {
        const inserted = await transaction.request()
          .input("companyId", mssql.BigInt, companyId).input("functionId", mssql.BigInt, functionId)
          .input("positionId", mssql.BigInt, positionId).input("levelId", mssql.BigInt, levelId)
          .input("employeeCode", mssql.NVarChar(50), profile.employeeCode)
          .input("birthDate", mssql.Date, profile.birthDate).input("titleTh", mssql.NVarChar(50), profile.titleTh)
          .input("titleEn", mssql.NVarChar(50), profile.titleEn).input("firstNameTh", mssql.NVarChar(150), profile.firstNameTh)
          .input("lastNameTh", mssql.NVarChar(150), profile.lastNameTh).input("firstNameEn", mssql.NVarChar(150), profile.firstNameEn)
          .input("lastNameEn", mssql.NVarChar(150), profile.lastNameEn).input("telephone", mssql.NVarChar(30), profile.telephone)
          .input("email", mssql.NVarChar(255), profile.email).input("hireDate", mssql.Date, profile.hireDate)
          .input("status", mssql.NVarChar(20), ACTIVE_STATUS).query(SQL.insertEmployee);
        if (inserted.rowsAffected[0] !== 1) throw new DatasetConflictError(`${profile.employeeCode} insert failed.`);
        employees.set(profile.username, String(inserted.recordset[0].employee_id));
      }
    }

    for (const profile of DEVELOPMENT_PROFILES) {
      const roleId = roles.get(profile.roleCode);
      const employeeId = employees.get(profile.username);
      const companyId = companies.get(profile.companyCode);
      const result = await transaction.request().input("username", mssql.NVarChar(100), profile.username).query(SQL.findAccount);
      const row = requireSingleOrEmpty(result.recordset, profile.username);
      if (row) {
        const matches = String(row.role_id) === roleId && String(row.employee_id) === employeeId &&
          String(row.company_id) === companyId && row.email === profile.email && row.status === ACTIVE_STATUS &&
          await verifyPassword(row.password_hash, developmentPassword);
        if (!matches) throw new DatasetConflictError(`${profile.username} conflicts with the approved dataset.`);
      } else {
        const inserted = await transaction.request()
          .input("roleId", mssql.Int, roleId).input("employeeId", mssql.BigInt, employeeId)
          .input("companyId", mssql.BigInt, companyId).input("username", mssql.NVarChar(100), profile.username)
          .input("passwordHash", mssql.NVarChar(255), hashByUsername.get(profile.username))
          .input("email", mssql.NVarChar(255), profile.email).input("status", mssql.NVarChar(20), ACTIVE_STATUS)
          .query(SQL.insertAccount);
        if (inserted.rowsAffected[0] !== 1) throw new DatasetConflictError(`${profile.username} insert failed.`);
      }
    }

    await transaction.commit();
    open = false;
  } catch (error) {
    if (open && transaction) await transaction.rollback().catch(() => undefined);
    open = false;
    if (error instanceof DatasetConflictError) throw error;
    throw new DatasetConflictError("Dataset seed failed and was rolled back.");
  } finally {
    hashes.splice(0, hashes.length);
    await pool.close().catch(() => undefined);
  }
};

export const previewDataset = () => {
  validateDataset();
  return {
    companies: COMPANIES.length,
    functions: FUNCTIONS.length,
    mappings: FUNCTION_MAPPINGS.length,
    positions: POSITIONS.length,
    levels: LEVELS.length,
    hrdFactoryAccounts: DEVELOPMENT_PROFILES.filter((item) => item.roleCode === "HRD_FACTORY").length,
    employeeAccounts: DEVELOPMENT_PROFILES.filter((item) => item.roleCode === "EMPLOYEE").length,
  };
};

const main = async () => {
  const mode = process.argv[2];
  if (mode === "--preview") {
    const summary = previewDataset();
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\nPreview only: no database connection or write performed.\n`);
    return;
  }
  if (mode !== "--execute") {
    throw new DatasetConflictError("Use --preview or --execute explicitly.");
  }

  let developmentPassword = "";
  let confirmation = "";
  let provisioningLogin = "";
  let provisioningPassword = "";
  try {
    developmentPassword = await readHidden("Shared development account password: ");
    confirmation = await readHidden("Confirm shared development account password: ");
    validateDevelopmentPassword(developmentPassword, confirmation);
    provisioningLogin = (await readHidden("Provisioning SQL login: ")).trim();
    provisioningPassword = await readHidden("Provisioning SQL password: ");
    if (!provisioningLogin || !provisioningPassword) throw new DatasetConflictError("Provisioning credentials are required.");
    await seedDevelopmentDataset({ developmentPassword, provisioningLogin, provisioningPassword });
    process.stdout.write("Dataset seed completed successfully.\n");
  } finally {
    developmentPassword = "";
    confirmation = "";
    provisioningLogin = "";
    provisioningPassword = "";
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof DatasetConflictError ? error.message : "Dataset seed failed."}\n`);
    process.exitCode = 1;
  });
}
