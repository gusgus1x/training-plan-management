import { pathToFileURL } from "node:url";
import mssql from "mssql";
import { hashPassword } from "../app/lib/auth/password.ts";

export const ROLE_CODE = "HRD_CENTER";
export const ACTIVE_STATUS = "ACTIVE";
export const DEVELOPMENT_PASSWORD_MIN_LENGTH = 12;
export const DEVELOPMENT_PASSWORD_MAX_LENGTH = 1024;
export const DEVELOPMENT_PASSWORD_VALIDATION_MESSAGE =
  "Development account password must be 12 to 1024 characters and match confirmation.";

export const VERIFY_PROVISIONING_LOGIN_QUERY = `
  SELECT IS_SRVROLEMEMBER(N'sysadmin') AS is_sysadmin`;

export const RESOLVE_ROLE_QUERY = `
  SELECT r.role_id, r.status
  FROM dbo.role AS r WITH (UPDLOCK, HOLDLOCK)
  WHERE r.role_code = @roleCode`;

export const FIND_USERNAME_QUERY = `
  SELECT ua.user_id
  FROM dbo.user_account AS ua WITH (UPDLOCK, HOLDLOCK)
  WHERE ua.username = @username`;

export const INSERT_ACCOUNT_QUERY = `
  INSERT INTO dbo.user_account (
    role_id,
    employee_id,
    company_id,
    username,
    password_hash,
    status
  )
  VALUES (
    @roleId,
    NULL,
    NULL,
    @username,
    @passwordHash,
    @accountStatus
  )`;

class SeedValidationError extends Error {}

export const validateDevelopmentPassword = (password, confirmation) => {
  if (
    password.length < DEVELOPMENT_PASSWORD_MIN_LENGTH ||
    password.length > DEVELOPMENT_PASSWORD_MAX_LENGTH ||
    password !== confirmation
  ) {
    throw new SeedValidationError(DEVELOPMENT_PASSWORD_VALIDATION_MESSAGE);
  }
};

const parseUsernameArgument = (argumentsList) => {
  const usernameIndex = argumentsList.indexOf("--username");
  const username =
    usernameIndex >= 0 ? argumentsList[usernameIndex + 1]?.trim() : "";

  if (!username || username.length > 100) {
    throw new SeedValidationError(
      "A username between 1 and 100 characters is required.",
    );
  }

  return username;
};

const readRequiredEnvironment = (key) => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new SeedValidationError(`Missing required environment setting: ${key}`);
  }

  return value;
};

const readBooleanEnvironment = (key, fallback) => {
  const value = process.env[key]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes"].includes(value)) {
    return true;
  }

  if (["0", "false", "no"].includes(value)) {
    return false;
  }

  throw new SeedValidationError(`${key} must be a boolean value.`);
};

const readHidden = (prompt) => {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new SeedValidationError("An interactive terminal is required.");
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
        if (character === "\u0003") {
          finish(new SeedValidationError("Seed cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          finish();
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };

    process.stdin.on("data", onData);
  });
};

const validateProvisioningLogin = (login) => {
  const normalizedLogin = login.trim().toLowerCase();

  if (
    !normalizedLogin ||
    ["training_plan_app", "sa", "sysadmin"].includes(normalizedLogin)
  ) {
    throw new SeedValidationError("The provisioning login is not permitted.");
  }

  return login.trim();
};

const getConnectionConfig = (user, password) => ({
  server: readRequiredEnvironment("DB_SERVER"),
  database: readRequiredEnvironment("DB_DATABASE"),
  user,
  password,
  connectionTimeout: 15_000,
  requestTimeout: 15_000,
  pool: { max: 1, min: 0, idleTimeoutMillis: 5_000 },
  options: {
    instanceName: readRequiredEnvironment("DB_INSTANCE"),
    encrypt: readBooleanEnvironment("DB_ENCRYPT", false),
    trustServerCertificate: readBooleanEnvironment(
      "DB_TRUST_SERVER_CERTIFICATE",
      true,
    ),
    enableArithAbort: true,
  },
});

export const seedDevelopmentAccount = async ({
  username,
  accountPassword,
  provisioningLogin,
  provisioningPassword,
  createPool = (config) => new mssql.ConnectionPool(config),
}) => {
  const pool = createPool(
    getConnectionConfig(provisioningLogin, provisioningPassword),
  );
  let transaction;
  let transactionOpen = false;
  let passwordHash = "";

  try {
    passwordHash = await hashPassword(accountPassword);
    await pool.connect();
    transaction = new mssql.Transaction(pool);
    await transaction.begin(mssql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionOpen = true;

    const provisioningResult = await transaction
      .request()
      .query(VERIFY_PROVISIONING_LOGIN_QUERY);

    if (provisioningResult.recordset[0]?.is_sysadmin !== 0) {
      throw new SeedValidationError("The provisioning login is not permitted.");
    }

    const roleResult = await transaction
      .request()
      .input("roleCode", mssql.NVarChar(30), ROLE_CODE)
      .query(RESOLVE_ROLE_QUERY);

    if (
      roleResult.recordset.length !== 1 ||
      roleResult.recordset[0]?.status !== ACTIVE_STATUS
    ) {
      throw new SeedValidationError("The required active role was not found.");
    }

    const usernameResult = await transaction
      .request()
      .input("username", mssql.NVarChar(100), username)
      .query(FIND_USERNAME_QUERY);

    if (usernameResult.recordset.length !== 0) {
      throw new SeedValidationError("The development username already exists.");
    }

    const insertResult = await transaction
      .request()
      .input("roleId", mssql.Int, roleResult.recordset[0].role_id)
      .input("username", mssql.NVarChar(100), username)
      .input("passwordHash", mssql.NVarChar(255), passwordHash)
      .input("accountStatus", mssql.NVarChar(20), ACTIVE_STATUS)
      .query(INSERT_ACCOUNT_QUERY);

    if (insertResult.rowsAffected[0] !== 1) {
      throw new SeedValidationError("The account insert did not affect one row.");
    }

    await transaction.commit();
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen && transaction) {
      await transaction.rollback().catch(() => undefined);
      transactionOpen = false;
    }

    if (error instanceof SeedValidationError) {
      throw error;
    }

    throw new SeedValidationError("Seed failed and was rolled back.");
  } finally {
    passwordHash = "";
    await pool.close().catch(() => undefined);
  }
};

const main = async () => {
  const username = parseUsernameArgument(process.argv.slice(2));
  let accountPassword = "";
  let accountPasswordConfirmation = "";
  let provisioningLogin = "";
  let provisioningPassword = "";

  try {
    accountPassword = await readHidden("Development account password: ");
    accountPasswordConfirmation = await readHidden("Confirm account password: ");

    validateDevelopmentPassword(
      accountPassword,
      accountPasswordConfirmation,
    );

    provisioningLogin = validateProvisioningLogin(
      await readHidden("Provisioning SQL login: "),
    );
    provisioningPassword = await readHidden("Provisioning SQL password: ");

    if (!provisioningPassword) {
      throw new SeedValidationError("A provisioning password is required.");
    }

    await seedDevelopmentAccount({
      username,
      accountPassword,
      provisioningLogin,
      provisioningPassword,
    });

    process.stdout.write("Seed completed: one development account created.\n");
  } finally {
    accountPassword = "";
    accountPasswordConfirmation = "";
    provisioningLogin = "";
    provisioningPassword = "";
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    const message =
      error instanceof SeedValidationError
        ? error.message
        : "Seed failed and was rolled back.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
