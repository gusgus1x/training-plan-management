import type { config as SqlServerConfig } from "mssql";

type DatabaseEnvironment = Record<string, string | undefined>;

const requiredDatabaseEnvironmentKeys = [
  "DB_SERVER",
  "DB_DATABASE",
  "DB_USER",
  "DB_PASSWORD",
] as const;

const prohibitedDatabaseUsers = new Set(["sa", "sysadmin"]);

export class DatabaseEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseEnvironmentError";
  }
}

const readRequiredValue = (
  environment: DatabaseEnvironment,
  key: (typeof requiredDatabaseEnvironmentKeys)[number],
) => {
  const value = environment[key]?.trim();

  if (!value) {
    throw new DatabaseEnvironmentError(`Missing required environment variable: ${key}`);
  }

  return value;
};

const readBoolean = (
  environment: DatabaseEnvironment,
  key: string,
  fallback: boolean,
) => {
  const value = environment[key]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes"].includes(value)) {
    return true;
  }

  if (["0", "false", "no"].includes(value)) {
    return false;
  }

  throw new DatabaseEnvironmentError(`${key} must be a boolean value`);
};

const readPositiveInteger = (
  environment: DatabaseEnvironment,
  key: string,
  fallback: number,
) => {
  const value = environment[key]?.trim();

  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new DatabaseEnvironmentError(`${key} must be a positive integer`);
  }

  return parsedValue;
};

const readOptionalPositiveInteger = (
  environment: DatabaseEnvironment,
  key: string,
) => {
  const value = environment[key]?.trim();

  if (!value) {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new DatabaseEnvironmentError(`${key} must be a positive integer`);
  }

  return parsedValue;
};

export const getMissingDatabaseEnvironmentKeys = (
  environment: DatabaseEnvironment = process.env,
) =>
  requiredDatabaseEnvironmentKeys.filter(
    (key) => !environment[key]?.trim(),
  );

export const getSqlServerConfig = (
  environment: DatabaseEnvironment = process.env,
): SqlServerConfig => {
  const server = readRequiredValue(environment, "DB_SERVER");
  const instanceName = environment.DB_INSTANCE?.trim();
  const port = readOptionalPositiveInteger(environment, "DB_PORT");
  const database = readRequiredValue(environment, "DB_DATABASE");
  const user = readRequiredValue(environment, "DB_USER");
  const password = readRequiredValue(environment, "DB_PASSWORD");

  if (prohibitedDatabaseUsers.has(user.toLowerCase())) {
    throw new DatabaseEnvironmentError(
      "DB_USER must be a least-privilege application account",
    );
  }

  return {
    server,
    ...(port ? { port } : {}),
    database,
    user,
    password,
    connectionTimeout: readPositiveInteger(
      environment,
      "DB_CONNECTION_TIMEOUT_MS",
      15_000,
    ),
    requestTimeout: readPositiveInteger(
      environment,
      "DB_REQUEST_TIMEOUT_MS",
      15_000,
    ),
    pool: {
      max: readPositiveInteger(environment, "DB_POOL_MAX", 10),
      min: 0,
      idleTimeoutMillis: readPositiveInteger(
        environment,
        "DB_POOL_IDLE_TIMEOUT_MS",
        30_000,
      ),
    },
    options: {
      ...(instanceName ? { instanceName } : {}),
      encrypt: readBoolean(environment, "DB_ENCRYPT", false),
      trustServerCertificate: readBoolean(
        environment,
        "DB_TRUST_SERVER_CERTIFICATE",
        true,
      ),
      enableArithAbort: true,
    },
  };
};
