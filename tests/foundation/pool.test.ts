import type { ConnectionPool } from "mssql";
import { describe, expect, it, vi } from "vitest";
import { createPoolProvider } from "../../app/lib/database/pool";

describe("SQL Server pool provider", () => {
  it("reuses one connection promise", async () => {
    const pool = {} as ConnectionPool;
    const connect = vi.fn(async () => pool);
    const getPool = createPoolProvider(connect);

    const [firstPool, secondPool] = await Promise.all([getPool(), getPool()]);

    expect(firstPool).toBe(pool);
    expect(secondPool).toBe(pool);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("clears a failed promise so the next request can retry", async () => {
    const pool = {} as ConnectionPool;
    const connect = vi
      .fn<() => Promise<ConnectionPool>>()
      .mockRejectedValueOnce(new Error("connection failed"))
      .mockResolvedValue(pool);
    const getPool = createPoolProvider(connect);

    await expect(getPool()).rejects.toThrow("connection failed");
    await expect(getPool()).resolves.toBe(pool);
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
