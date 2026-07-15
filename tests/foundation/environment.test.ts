import { describe, expect, it } from "vitest";
import {
  DatabaseEnvironmentError,
  getMissingDatabaseEnvironmentKeys,
  getSqlServerConfig,
} from "../../app/lib/database/sqlServer";

const validEnvironment = {
  DB_SERVER: "localhost",
  DB_INSTANCE: "SQLEXPRESS03",
  DB_DATABASE: "TrainingPlanManagementDB",
  DB_USER: "training_plan_app",
  DB_PASSWORD: "test-only-password",
};

describe("database environment validation", () => {
  it("creates the expected SQL Server configuration", () => {
    const config = getSqlServerConfig(validEnvironment);

    expect(config).toMatchObject({
      server: "localhost",
      database: "TrainingPlanManagementDB",
      user: "training_plan_app",
      password: "test-only-password",
      options: {
        instanceName: "SQLEXPRESS03",
        encrypt: false,
        trustServerCertificate: true,
      },
      pool: {
        max: 10,
        min: 0,
      },
    });
  });

  it("reports missing required keys without using fallback credentials", () => {
    expect(getMissingDatabaseEnvironmentKeys({})).toEqual([
      "DB_SERVER",
      "DB_INSTANCE",
      "DB_DATABASE",
      "DB_USER",
      "DB_PASSWORD",
    ]);
    expect(() => getSqlServerConfig({})).toThrow(DatabaseEnvironmentError);
  });

  it.each(["sa", "SA", "sysadmin"])(
    "rejects prohibited database user %s",
    (user) => {
      expect(() =>
        getSqlServerConfig({ ...validEnvironment, DB_USER: user }),
      ).toThrow("least-privilege application account");
    },
  );

  it("rejects invalid boolean and timeout values", () => {
    expect(() =>
      getSqlServerConfig({ ...validEnvironment, DB_ENCRYPT: "sometimes" }),
    ).toThrow("DB_ENCRYPT must be a boolean value");
    expect(() =>
      getSqlServerConfig({
        ...validEnvironment,
        DB_REQUEST_TIMEOUT_MS: "0",
      }),
    ).toThrow("DB_REQUEST_TIMEOUT_MS must be a positive integer");
  });
});
