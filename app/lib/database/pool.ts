import { ConnectionPool, type config as SqlServerConfig } from "mssql";
import { getSqlServerConfig } from "./sqlServer";

type PoolConnector = () => Promise<ConnectionPool>;
type PoolProvider = (() => Promise<ConnectionPool>) & {
  reset?: () => Promise<void>;
};

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

  const getPool = async () => {
    if (!poolPromise) {
      poolPromise = connect().catch((error: unknown) => {
        poolPromise = undefined;
        throw error;
      });
    }

    const pool = await poolPromise;

    if ("connected" in pool && pool.connected === false) {
      await pool.close().catch(() => undefined);
      poolPromise = undefined;
      return getPool();
    }

    return pool;
  };

  getPool.reset = async () => {
    const pool = await poolPromise?.catch(() => undefined);

    poolPromise = undefined;
    await pool?.close().catch(() => undefined);
  };

  return getPool;
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

export const resetSqlServerPool = async () => {
  assertServerOnly();
  await sqlServerGlobal.__trainingPlanManagementSqlPoolProvider?.reset?.();
};
