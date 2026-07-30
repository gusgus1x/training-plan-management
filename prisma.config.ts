import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ path: ".env", quiet: true });

const readRequiredEnvironment = (key: string) => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const readBooleanEnvironment = (key: string, fallback: boolean) => {
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

  throw new Error(`${key} must be a boolean value`);
};

const readOptionalPort = () => {
  const value = process.env.DB_PORT?.trim();

  if (!value) {
    return null;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("DB_PORT must be an integer between 1 and 65535");
  }

  return port;
};

const escapeConnectionValue = (value: string) =>
  /[:\\=;\/\[\]{}]/.test(value)
    ? `{${value.replaceAll("}", "}}")}}`
    : value;

const server = readRequiredEnvironment("DB_SERVER");
const instanceName = process.env.DB_INSTANCE?.trim();
const port = readOptionalPort();
const database = readRequiredEnvironment("DB_DATABASE");
const user = readRequiredEnvironment("DB_USER");
const password = readRequiredEnvironment("DB_PASSWORD");

if (database !== "TrainingPlanManagementDB") {
  throw new Error("DB_DATABASE must be TrainingPlanManagementDB");
}

if (user.toLowerCase() !== "training_plan_app") {
  throw new Error("DB_USER must be the least-privilege training_plan_app login");
}

const address = port
  ? `${server}:${port}`
  : instanceName
    ? `${server}\\${instanceName}`
    : server;
const connectionUrl = [
  `sqlserver://${address}`,
  `database=${escapeConnectionValue(database)}`,
  `user=${escapeConnectionValue(user)}`,
  `password=${escapeConnectionValue(password)}`,
  `encrypt=${readBooleanEnvironment("DB_ENCRYPT", false)}`,
  `trustServerCertificate=${readBooleanEnvironment(
    "DB_TRUST_SERVER_CERTIFICATE",
    true,
  )}`,
  "schema=dbo",
].join(";");

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: connectionUrl,
  },
});
