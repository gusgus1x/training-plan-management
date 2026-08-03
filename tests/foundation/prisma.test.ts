import type { PrismaClient } from "../../app/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createPrismaClientProvider } from "../../app/lib/database/prisma";

describe("Prisma Client provider", () => {
  it("reuses one server client and disconnects it on reset", async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const client = { $disconnect: disconnect } as unknown as PrismaClient;
    const createClient = vi.fn(() => client);
    const getClient = createPrismaClientProvider(createClient);

    expect(getClient()).toBe(client);
    expect(getClient()).toBe(client);
    expect(createClient).toHaveBeenCalledTimes(1);

    await getClient.reset?.();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(getClient()).toBe(client);
    expect(createClient).toHaveBeenCalledTimes(2);
  });
});
