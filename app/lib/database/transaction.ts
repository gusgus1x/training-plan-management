import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "./errors";
import { getPrismaClient } from "./prisma";

export type TransactionOptions = {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait?: number;
  timeout?: number;
};

export type TransactionRunner = Pick<PrismaClient, "$transaction">;

const defaultTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 5_000,
  timeout: 10_000,
} satisfies Required<TransactionOptions>;

export const runInTransaction = <Result>(
  operation: (transaction: Prisma.TransactionClient) => Promise<Result>,
  options: TransactionOptions = {},
  client: TransactionRunner = getPrismaClient(),
) =>
  withDatabaseErrorMapping(() =>
    client.$transaction(operation, {
      ...defaultTransactionOptions,
      ...options,
    }),
  );
