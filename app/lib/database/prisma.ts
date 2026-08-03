import { PrismaMssql } from "@prisma/adapter-mssql";
import type { config as SqlServerConfig } from "mssql";
import { PrismaClient } from "../../generated/prisma/client";
import { getSqlServerConfig } from "./sqlServer";

type PrismaClientProvider = (() => PrismaClient) & {
  reset?: () => Promise<void>;
};

type PrismaGlobal = typeof globalThis & {
  __trainingPlanManagementPrismaProvider?: PrismaClientProvider;
};

const assertServerOnly = () => {
  if (typeof window !== "undefined") {
    throw new Error("Prisma Client is available only on the server");
  }
};

export const createPrismaClient = (
  config: SqlServerConfig = getSqlServerConfig(),
) => {
  assertServerOnly();

  return new PrismaClient({
    adapter: new PrismaMssql(config),
    errorFormat: "minimal",
  });
};

export const createPrismaClientProvider = (
  createClient: () => PrismaClient,
): PrismaClientProvider => {
  let client: PrismaClient | undefined;

  const getClient = () => {
    client ??= createClient();
    return client;
  };

  getClient.reset = async () => {
    const currentClient = client;

    client = undefined;
    await currentClient?.$disconnect().catch(() => undefined);
  };

  return getClient;
};

const prismaGlobal = globalThis as PrismaGlobal;

export const getPrismaClient = () => {
  assertServerOnly();

  if (!prismaGlobal.__trainingPlanManagementPrismaProvider) {
    prismaGlobal.__trainingPlanManagementPrismaProvider =
      createPrismaClientProvider(createPrismaClient);
  }

  return prismaGlobal.__trainingPlanManagementPrismaProvider();
};

export const resetPrismaClient = async () => {
  assertServerOnly();
  await prismaGlobal.__trainingPlanManagementPrismaProvider?.reset?.();
};
