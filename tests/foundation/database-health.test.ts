import type { ConnectionPool } from "mssql";
import { describe, expect, it, vi } from "vitest";
import {
  createDatabaseHealthHandler,
  DATABASE_HEALTH_QUERY,
} from "../../app/api/health/database/route";

describe("database health endpoint", () => {
  it("executes only SELECT 1 AS ok and reports reachable", async () => {
    const query = vi.fn().mockResolvedValue({ recordset: [{ ok: 1 }] });
    const pool = {
      request: () => ({ query }),
    } as unknown as Pick<ConnectionPool, "request">;
    const handler = createDatabaseHealthHandler(async () => pool);

    const response = await handler();

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith("SELECT 1 AS ok");
    expect(DATABASE_HEALTH_QUERY).toBe("SELECT 1 AS ok");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { status: "reachable" },
    });
  });

  it("returns 503 without exposing connection or SQL errors", async () => {
    const handler = createDatabaseHealthHandler(async () => {
      throw new Error(
        "Login failed for sa; password=secret; server=localhost\\SQLEXPRESS03",
      );
    });

    const response = await handler();
    const body = await response.json();
    const serializedBody = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database unavailable",
        requestId: expect.any(String),
      },
    });
    expect(serializedBody).not.toContain("secret");
    expect(serializedBody).not.toContain("localhost");
    expect(serializedBody).not.toContain("SQLEXPRESS03");
    expect(serializedBody).not.toContain("Login failed");
  });
});
