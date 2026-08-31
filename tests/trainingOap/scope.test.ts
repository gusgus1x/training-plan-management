import { describe, expect, it, vi } from "vitest";
import { createOapPlanRepository } from "../../app/lib/trainingOap/repository";
import type { UpdateOapPlanInput } from "../../app/lib/trainingOap/types";

/**
 * The defect this covers: the OAP update and delete paths never received the caller's company at
 * all, so a factory HRD could rewrite — or cascade-delete, along with every batch, enrollment,
 * attendance row and result underneath — an OAP plan belonging to another factory. The sibling
 * module (trainingRolling) already guarded both operations; this one simply never did.
 */

const clientForOwner = (ownerCompanyId: bigint | null) => {
  const findUniqueOrThrow = vi.fn().mockResolvedValue({ company_id: ownerCompanyId });
  return {
    client: {
      training_plan_oap: { findUniqueOrThrow, update: vi.fn(), findMany: vi.fn() },
      course: {},
      $transaction: vi.fn(),
      training_plan: { findMany: vi.fn().mockResolvedValue([]) },
    },
    findUniqueOrThrow,
  };
};

const emptyUpdate = {} as UpdateOapPlanInput;

describe("OAP plan company scope", () => {
  it("refuses a factory user updating another company's plan", async () => {
    const { client } = clientForOwner(BigInt(5));
    const repository = createOapPlanRepository(client as never);

    await expect(repository.update("17", emptyUpdate, "1", "2")).rejects.toMatchObject({
      status: 403,
    });
    expect(client.training_plan_oap.update).not.toHaveBeenCalled();
  });

  it("refuses a factory user deleting another company's plan before anything cascades", async () => {
    const { client } = clientForOwner(BigInt(5));
    const repository = createOapPlanRepository(client as never);

    await expect(repository.delete("17", "2")).rejects.toMatchObject({ status: 403 });
    // The guard has to run before the transaction opens, or the cascade has already started.
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("allows a factory user on their own company's plan", async () => {
    const { client } = clientForOwner(BigInt(2));
    const repository = createOapPlanRepository(client as never);

    await repository.delete("17", "2");
    expect(client.$transaction).toHaveBeenCalled();
  });

  it("does not look up ownership for HRD_CENTER, which is unscoped", async () => {
    const { client, findUniqueOrThrow } = clientForOwner(BigInt(5));
    const repository = createOapPlanRepository(client as never);

    await repository.delete("17", null);
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
    expect(client.$transaction).toHaveBeenCalled();
  });
});
