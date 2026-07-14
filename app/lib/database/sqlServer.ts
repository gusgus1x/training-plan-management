type SqlServerEnv = Record<string, string | undefined>;

export type SqlServerExpressConfig = {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    instanceName?: string;
  };
};

export const sqlServerRequiredEnvKeys = [
  "SQLSERVER_HOST",
  "SQLSERVER_DATABASE",
  "SQLSERVER_USER",
  "SQLSERVER_PASSWORD",
] as const;

const readBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
};

const readPort = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : undefined;
};

export const getSqlServerExpressConfig = (
  env: SqlServerEnv = process.env,
): SqlServerExpressConfig => {
  const port = readPort(env.SQLSERVER_PORT);
  const instanceName = env.SQLSERVER_INSTANCE || "SQLEXPRESS";

  return {
    server: env.SQLSERVER_HOST || "localhost",
    database: env.SQLSERVER_DATABASE || "HRDTraining",
    user: env.SQLSERVER_USER || "sa",
    password: env.SQLSERVER_PASSWORD || "",
    ...(port ? { port } : {}),
    options: {
      encrypt: readBoolean(env.SQLSERVER_ENCRYPT, false),
      trustServerCertificate: readBoolean(env.SQLSERVER_TRUST_CERT, true),
      ...(port ? {} : { instanceName }),
    },
  };
};

export const getMissingSqlServerEnvKeys = (env: SqlServerEnv = process.env) =>
  sqlServerRequiredEnvKeys.filter((key) => !env[key]);
