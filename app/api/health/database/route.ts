import type { ConnectionPool } from "mssql";
import { ApiError } from "../../../lib/api/errors";
import { apiFailure, apiSuccess } from "../../../lib/api/response";
import { getSqlServerPool } from "../../../lib/database/pool";

export const dynamic = "force-dynamic";

export const DATABASE_HEALTH_QUERY = "SELECT 1 AS ok";

type HealthDatabasePool = Pick<ConnectionPool, "request">;
type HealthDatabasePoolProvider = () => Promise<HealthDatabasePool>;

export const createDatabaseHealthHandler = (
  getPool: HealthDatabasePoolProvider = getSqlServerPool,
) =>
  async function databaseHealthHandler() {
    try {
      const pool = await getPool();
      const result = await pool
        .request()
        .query<{ ok: number }>(DATABASE_HEALTH_QUERY);

      if (result.recordset[0]?.ok !== 1) {
        throw new Error("Unexpected database health result");
      }

      return apiSuccess({ status: "reachable" as const });
    } catch {
      return apiFailure(
        new ApiError({
          code: "DATABASE_UNAVAILABLE",
          message: "Database unavailable",
          status: 503,
        }),
      );
    }
  };

export const GET = createDatabaseHealthHandler();
