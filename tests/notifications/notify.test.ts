import { describe, expect, it, vi } from "vitest";
import { notifyEmployees } from "../../app/lib/notifications/notify";

const payload = () => ({ title: "t", message: "m", relatedType: "TEST", relatedId: BigInt(7) });

const fakeDb = (accounts: Array<{ user_id: bigint }>) => {
  const findMany = vi.fn().mockResolvedValue(accounts);
  const createMany = vi.fn().mockResolvedValue({ count: accounts.length });
  return { db: { user_account: { findMany }, notification: { createMany } } as never, findMany, createMany };
};

describe("notifyEmployees", () => {
  it("writes one row per active account of each person, asking once per person", async () => {
    const { db, findMany, createMany } = fakeDb([{ user_id: BigInt(1) }, { user_id: BigInt(2) }]);
    await notifyEmployees(db, ["E1", "E1", null, "E2"], payload);
    expect(findMany.mock.calls[0][0].where).toEqual({ employee_user_id: { in: ["E1", "E2"] }, status: "ACTIVE" });
    expect(createMany.mock.calls[0][0].data).toEqual([
      { user_id: BigInt(1), title: "t", message: "m", related_type: "TEST", related_id: BigInt(7) },
      { user_id: BigInt(2), title: "t", message: "m", related_type: "TEST", related_id: BigInt(7) },
    ]);
  });

  it("touches nothing when nobody is named or nobody has an account", async () => {
    const none = fakeDb([]);
    await notifyEmployees(none.db, [null, undefined], payload);
    expect(none.findMany).not.toHaveBeenCalled();
    await notifyEmployees(none.db, ["E1"], payload);
    expect(none.createMany).not.toHaveBeenCalled();
  });

  it("never fails the action that caused it", async () => {
    const { db, createMany } = fakeDb([{ user_id: BigInt(1) }]);
    createMany.mockRejectedValue(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(notifyEmployees(db, ["E1"], payload)).resolves.toBeUndefined();
    // Nor does wording that cannot be built from a half-loaded row.
    await expect(
      notifyEmployees(db, ["E1"], () => {
        throw new TypeError("no plan");
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
