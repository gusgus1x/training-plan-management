// Creates one obviously-fake employee and links an existing EMPLOYEE login to it, so the employee
// portal has someone to be. Every user_account.employee_user_id is NULL today, which is why those
// pages cannot query anything.
//
// The account is named on the command line and never printed back.
//
// Usage:
//   node scripts/seed-test-employee.mjs --company ATA --username <login>
//   node scripts/seed-test-employee.mjs --company ATA --username <login> --relink
//   node scripts/seed-test-employee.mjs --remove
//   node scripts/seed-test-employee.mjs --set-login --username <login>   (password read from stdin)
import { config as loadEnvironment } from "dotenv";
import mssql from "mssql";
import { hashPassword } from "../app/lib/auth/password.ts";

loadEnvironment({ path: ".env", quiet: true });

// A non-numeric user_id cannot collide with a real one: every user_id in this database is eight
// digits. It also makes the row unmistakable in any query, which matters for a row we plan to delete.
const TEST_USER_ID = "TEST0001";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const readArgument = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
};

const hasFlag = (flag) => process.argv.includes(flag);

const connect = () =>
  mssql.connect({
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
  });

// Rewrites the login of the account already linked to the test employee, and only that one. It
// takes no account id: the link is the target, so this cannot be pointed at a real person's login
// by a mistyped argument. The password arrives on stdin so it never reaches argv, where any other
// process on this machine could read it.
const setLogin = async (pool, username, password) => {
  const transaction = new mssql.Transaction(pool);
  await transaction.begin();
  try {
    const linked = await transaction
      .request()
      .input("userId", mssql.NVarChar(50), TEST_USER_ID).query(`
        SELECT ua.user_id, r.role_code
        FROM dbo.user_account AS ua
        JOIN dbo.role AS r ON r.role_id = ua.role_id
        WHERE ua.employee_user_id = @userId`);

    if (linked.recordset.length === 0) {
      throw new Error(`No account is linked to ${TEST_USER_ID}. Run the link step first.`);
    }
    if (linked.recordset.length > 1) {
      throw new Error(
        `${linked.recordset.length} accounts are linked to ${TEST_USER_ID}; refusing to guess.`,
      );
    }

    const { user_id: accountId, role_code: roleCode } = linked.recordset[0];
    if (roleCode !== "EMPLOYEE") {
      throw new Error(`The linked account has role ${roleCode}; refusing to touch it.`);
    }

    const taken = await transaction
      .request()
      .input("username", mssql.NVarChar(100), username)
      .input("accountId", mssql.BigInt, accountId)
      .query(
        "SELECT TOP 1 1 AS hit FROM dbo.user_account WHERE username = @username AND user_id <> @accountId",
      );
    if (taken.recordset.length > 0) {
      throw new Error("That username already belongs to a different account.");
    }

    await transaction
      .request()
      .input("accountId", mssql.BigInt, accountId)
      .input("username", mssql.NVarChar(100), username)
      .input("passwordHash", mssql.NVarChar(255), await hashPassword(password))
      .query(
        "UPDATE dbo.user_account SET username = @username, password_hash = @passwordHash WHERE user_id = @accountId",
      );

    await transaction.commit();
    console.log(`Updated the login for the account linked to ${TEST_USER_ID}.`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  // Trailing newline only - a password may legitimately start or end with a space.
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
};

const remove = async (pool) => {
  const transaction = new mssql.Transaction(pool);
  await transaction.begin();
  try {
    const unlinked = await transaction
      .request()
      .input("userId", mssql.NVarChar(50), TEST_USER_ID)
      .query(
        "UPDATE dbo.user_account SET employee_user_id = NULL WHERE employee_user_id = @userId",
      );

    // Refuse to orphan training history: the foreign keys would stop us anyway, but a clear
    // message beats a constraint violation.
    const used = await transaction
      .request()
      .input("userId", mssql.NVarChar(50), TEST_USER_ID)
      .query(
        `SELECT (SELECT COUNT(*) FROM dbo.training_enrollment WHERE employee_user_id = @userId)
              + (SELECT COUNT(*) FROM dbo.training_need_request WHERE employee_user_id = @userId) AS c`,
      );
    if (used.recordset[0].c > 0) {
      throw new Error(
        `The test employee has ${used.recordset[0].c} training rows. Delete those first.`,
      );
    }

    const deleted = await transaction
      .request()
      .input("userId", mssql.NVarChar(50), TEST_USER_ID)
      .query("DELETE FROM dbo.employee WHERE user_id = @userId");

    await transaction.commit();
    console.log(`Unlinked accounts: ${unlinked.rowsAffected[0]}`);
    console.log(`Deleted employees: ${deleted.rowsAffected[0]}`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Borrow the org hierarchy slot that the most colleagues at this company already sit in, rather
// than hardcoding ids. Training plans match their targets on function/position/level, so a made-up
// combination would exercise a path no real employee takes - and hardcoded ids rot when master
// data moves. Nothing personal is read: this is a GROUP BY over master-data ids.
const MODAL_ORG_SLOT = `
  SELECT TOP 1 e.function_id, e.division_id, e.department_id,
               e.section_id, e.position_id, e.level_id
  FROM dbo.employee AS e
  WHERE e.company_id = (SELECT company_id FROM dbo.company WHERE company_code = @code)
    AND e.user_id <> @userId
    AND e.function_id IS NOT NULL AND e.division_id IS NOT NULL
    AND e.department_id IS NOT NULL AND e.section_id IS NOT NULL
    AND e.position_id IS NOT NULL AND e.level_id IS NOT NULL
  GROUP BY e.function_id, e.division_id, e.department_id,
           e.section_id, e.position_id, e.level_id
  ORDER BY COUNT(*) DESC`;

const fillProfile = async (transaction, companyCode) => {
  const slot = await transaction
    .request()
    .input("code", mssql.NVarChar(20), companyCode)
    .input("userId", mssql.NVarChar(50), TEST_USER_ID)
    .query(MODAL_ORG_SLOT);

  if (slot.recordset.length === 0) {
    console.warn(
      `No ${companyCode} employee has a complete org hierarchy; leaving those fields NULL.`,
    );
    return;
  }

  const org = slot.recordset[0];
  // example.com is reserved by RFC 2606, so this address can never reach a real mailbox.
  await transaction
    .request()
    .input("userId", mssql.NVarChar(50), TEST_USER_ID)
    .input("functionId", mssql.BigInt, org.function_id)
    .input("divisionId", mssql.BigInt, org.division_id)
    .input("departmentId", mssql.BigInt, org.department_id)
    .input("sectionId", mssql.BigInt, org.section_id)
    .input("positionId", mssql.BigInt, org.position_id)
    .input("levelId", mssql.BigInt, org.level_id).query(`
      UPDATE dbo.employee
      SET function_id = @functionId,
          division_id = @divisionId,
          department_id = @departmentId,
          section_id = @sectionId,
          position_id = @positionId,
          level_id = @levelId,
          email = N'test.trainee@example.com',
          telephone = N'0800000000',
          birth_date = '1995-01-15',
          hire_date = '2020-06-01'
      WHERE user_id = @userId`);

  console.log(
    `Filled profile: function ${org.function_id}, division ${org.division_id}, ` +
      `department ${org.department_id}, section ${org.section_id}, ` +
      `position ${org.position_id}, level ${org.level_id}.`,
  );
};

const seed = async (pool, companyCode, username) => {
  const transaction = new mssql.Transaction(pool);
  await transaction.begin();
  try {
    const company = await transaction
      .request()
      .input("code", mssql.NVarChar(20), companyCode)
      .query("SELECT company_id FROM dbo.company WHERE company_code = @code");
    if (company.recordset.length === 0) {
      throw new Error(`No company with code ${companyCode}`);
    }
    const companyId = company.recordset[0].company_id;

    const existing = await transaction
      .request()
      .input("userId", mssql.NVarChar(50), TEST_USER_ID)
      .query("SELECT employee_id FROM dbo.employee WHERE user_id = @userId");

    if (existing.recordset.length === 0) {
      // employee_code stays NULL - migration 30 made it optional, and a NULL keeps this row out of
      // the company's real code sequence. national_id stays NULL like all 4010 existing rows.
      await transaction
        .request()
        .input("companyId", mssql.BigInt, companyId)
        .input("userId", mssql.NVarChar(50), TEST_USER_ID).query(`
          INSERT INTO dbo.employee
            (company_id, user_id, employee_code, title_th, title_en,
             first_name_th, last_name_th, first_name_en, last_name_en, employment_status)
          VALUES
            (@companyId, @userId, NULL, N'นาย', N'Mr.',
             N'ทดสอบ', N'ระบบอบรม', N'Test', N'Trainee', N'ACTIVE')`);
      console.log(`Created employee ${TEST_USER_ID} at ${companyCode}.`);
    } else {
      console.log(`Employee ${TEST_USER_ID} already exists; reusing it.`);
    }

    await fillProfile(transaction, companyCode);

    const account = await transaction
      .request()
      .input("username", mssql.NVarChar(100), username).query(`
        SELECT ua.user_id, ua.employee_user_id, r.role_code
        FROM dbo.user_account AS ua
        JOIN dbo.role AS r ON r.role_id = ua.role_id
        WHERE ua.username = @username`);

    if (account.recordset.length === 0) {
      throw new Error("No account with that username.");
    }
    const { employee_user_id: linkedTo, role_code: roleCode } = account.recordset[0];

    if (roleCode !== "EMPLOYEE") {
      throw new Error(
        `That account has role ${roleCode}. Only an EMPLOYEE account should point at an employee record.`,
      );
    }
    if (linkedTo !== null && linkedTo !== TEST_USER_ID && !hasFlag("--relink")) {
      throw new Error(
        "That account is already linked to another employee. Pass --relink to move it.",
      );
    }

    const linked = await transaction
      .request()
      .input("username", mssql.NVarChar(100), username)
      .input("userId", mssql.NVarChar(50), TEST_USER_ID)
      .query(
        "UPDATE dbo.user_account SET employee_user_id = @userId WHERE username = @username",
      );

    await transaction.commit();
    console.log(`Linked accounts: ${linked.rowsAffected[0]}`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const pool = await connect();
try {
  if (hasFlag("--remove")) {
    await remove(pool);
  } else if (hasFlag("--set-login")) {
    const username = readArgument("--username");
    if (!username) throw new Error("Usage: --set-login --username <login>  (password on stdin)");
    const password = await readStdin();
    if (password.length === 0) throw new Error("A password is required on stdin.");
    await setLogin(pool, username, password);
  } else if (hasFlag("--fill-only")) {
    // Tops up an already-linked test employee without asking for the login again.
    const companyCode = readArgument("--company");
    if (!companyCode) throw new Error("Usage: --fill-only --company <CODE>");
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();
    try {
      await fillProfile(transaction, companyCode);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } else {
    const companyCode = readArgument("--company");
    const username = readArgument("--username");
    if (!companyCode || !username) {
      throw new Error(
        "Usage: --company <CODE> --username <login>  (or --fill-only --company <CODE>, or --remove)",
      );
    }
    await seed(pool, companyCode, username);
  }
} finally {
  await pool.close();
}
