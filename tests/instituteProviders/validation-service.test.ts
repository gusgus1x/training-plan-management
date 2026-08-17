import { describe, expect, it, vi } from "vitest";
import type { InstituteProviderRepository } from "../../app/lib/instituteProviders/repository";
import { createInstituteProviderService } from "../../app/lib/instituteProviders/service";
import { parseCreateInstituteProvider } from "../../app/lib/instituteProviders/validation";

const record = {
  instituteProviderId: "1",
  instituteProviderCode: "ATA",
  instituteProviderName: "ATA",
  status: "ACTIVE" as const,
};

const repository = () =>
  ({
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(record),
    findByCode: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockImplementation(async (_id, input) => ({
      ...record,
      ...input,
    })),
    isReferenced: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue(record),
  }) as unknown as InstituteProviderRepository;

describe("institute provider validation and service", () => {
  it("normalizes a submitted Institute/Provider", () => {
    expect(
      parseCreateInstituteProvider({
        instituteProviderCode: " ata ",
        instituteProviderName: " ATA ",
      }),
    ).toEqual({
      instituteProviderCode: "ATA",
      instituteProviderName: "ATA",
      status: "ACTIVE",
    });
  });

  it("rejects a code with invalid characters", () => {
    try {
      parseCreateInstituteProvider({
        instituteProviderCode: "not valid!",
        instituteProviderName: "ATA",
      });
      expect.unreachable("expected parseCreateInstituteProvider to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: "INVALID_INPUT",
        details: { field: "instituteProviderCode" },
      });
    }
  });

  it("deactivates a referenced Institute/Provider instead of deleting it", async () => {
    const mock = repository();
    vi.mocked(mock.isReferenced).mockResolvedValue(true);

    await expect(
      createInstituteProviderService(mock).deleteInstituteProvider("1"),
    ).resolves.toMatchObject({
      outcome: "DEACTIVATED",
      instituteProvider: { status: "INACTIVE" },
    });
    expect(mock.update).toHaveBeenCalledWith("1", { status: "INACTIVE" });
    expect(mock.delete).not.toHaveBeenCalled();
  });

  it("hard-deletes an unreferenced Institute/Provider", async () => {
    const mock = repository();

    await expect(
      createInstituteProviderService(mock).deleteInstituteProvider("1"),
    ).resolves.toMatchObject({ outcome: "DELETED" });
    expect(mock.delete).toHaveBeenCalledWith("1");
  });
});
