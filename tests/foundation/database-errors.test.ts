import { describe, expect, it } from "vitest";
import {
  translateDatabaseError,
  withDatabaseErrorMapping,
} from "../../app/lib/database/errors";

describe("database error mapping", () => {
  it.each([
    ["P2002", "RESOURCE_CONFLICT", 409],
    ["P2003", "INVALID_REFERENCE", 409],
    ["P2025", "RESOURCE_NOT_FOUND", 404],
    ["P2000", "INVALID_INPUT", 400],
    ["P2024", "DATABASE_UNAVAILABLE", 503],
  ])("maps %s to the stable API error %s", (prismaCode, apiCode, status) => {
    const mapped = translateDatabaseError({
      code: prismaCode,
      meta: { confidentialDatabaseDetail: "must-not-be-returned" },
    });

    expect(mapped).toMatchObject({ code: apiCode, status });
    expect(JSON.stringify(mapped)).not.toContain("confidentialDatabaseDetail");
  });

  it("does not misclassify an unknown application error", () => {
    expect(translateDatabaseError(new Error("application failure"))).toBeNull();
  });

  it("rethrows a translated error without raw database metadata", async () => {
    await expect(
      withDatabaseErrorMapping(async () => {
        throw { code: "P2002", meta: { target: "secret_index_name" } };
      }),
    ).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
      status: 409,
    });
  });
});
