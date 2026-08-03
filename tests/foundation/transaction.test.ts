import type { Prisma } from "../../app/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  runInTransaction,
  type TransactionRunner,
} from "../../app/lib/database/transaction";

describe("database transaction foundation", () => {
  it("runs related work in one transaction with bounded defaults", async () => {
    const transaction = { marker: "transaction-client" };
    const transactionMethod = vi.fn(
      async (
        operation: (client: typeof transaction) => Promise<string>,
        options: Record<string, unknown>,
      ) => {
        expect(options).toBeDefined();
        return operation(transaction);
      },
    );
    const runner = {
      $transaction: transactionMethod,
    } as unknown as TransactionRunner;
    const operation = vi.fn(
      async (client: Prisma.TransactionClient) =>
        (client as unknown as typeof transaction).marker,
    );

    await expect(runInTransaction(operation, {}, runner)).resolves.toBe(
      "transaction-client",
    );
    expect(operation).toHaveBeenCalledWith(transaction);
    expect(transactionMethod).toHaveBeenCalledWith(
      operation,
      expect.objectContaining({
        isolationLevel: "ReadCommitted",
        maxWait: 5_000,
        timeout: 10_000,
      }),
    );
  });
});
