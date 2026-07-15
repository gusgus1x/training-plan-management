import { ConnectionPool, type config as SqlServerConfig } from "mssql";
import { getSqlServerConfig } from "./sqlServer";

type PoolConnector = () => Promise<ConnectionPool>;
type PoolProvider = () => Promise<ConnectionPool>;

type SqlServerGlobal = typeof globalThis & {
  __trainingPlanManagementSqlPoolProvider?: PoolProvider;
};

const assertServerOnly = () => {
  if (typeof window !== "undefined") {
    throw new Error("SQL Server pool is available only on the server");
  }
};

export const createPoolProvider = (connect: PoolConnector): PoolProvider => {
  let poolPromise: Promise<ConnectionPool> | undefined;

  return () => {
    if (!poolPromise) {
      poolPromise = connect().catch((error: unknown) => {
        poolPromise = undefined;
        throw error;
      });
    }

    return poolPromise;
  };
};

export const connectSqlServerPool = async (
  config: SqlServerConfig = getSqlServerConfig(),
) => {
  assertServerOnly();

  const pool = new ConnectionPool(config);

  try {
    return await pool.connect();
  } catch (error: unknown) {
    await pool.close().catch(() => undefined);
    throw error;
  }
};

const sqlServerGlobal = globalThis as SqlServerGlobal;

export const getSqlServerPool = () => {
  assertServerOnly();

  if (!sqlServerGlobal.__trainingPlanManagementSqlPoolProvider) {
    sqlServerGlobal.__trainingPlanManagementSqlPoolProvider = createPoolProvider(
      () => connectSqlServerPool(),
    );
  }

  return sqlServerGlobal.__trainingPlanManagementSqlPoolProvider();
};
