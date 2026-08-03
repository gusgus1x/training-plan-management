import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../app/lib/api/errors";
import type { PositionRepository } from "../../app/lib/positions/repository";
import { createPositionService } from "../../app/lib/positions/service";
import { parseCreatePosition } from "../../app/lib/positions/validation";

const record = {
  positionId: "1",
  positionCode: "OFFICE",
  positionNameTh: "เจ้าหน้าที่",
  positionNameEn: "Supervisor",
  status: "ACTIVE" as const,
};

const repository = () =>
  ({
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(record),
    findByCode: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockResolvedValue(record),
    delete: vi.fn().mockResolvedValue(record),
  }) as unknown as PositionRepository;

describe("position validation and service", () => {
  it("normalizes mock-compatible input", () => {
    expect(
      parseCreatePosition({
        positionCode: " office ",
        positionNameTh: " เจ้าหน้าที่ ",
        positionNameEn: " Supervisor ",
      }),
    ).toEqual({
      positionCode: "OFFICE",
      positionNameTh: "เจ้าหน้าที่",
      positionNameEn: "Supervisor",
      status: "ACTIVE",
    });
  });

  it("returns POSITION_IN_USE for foreign-key conflicts", async () => {
    const mock = repository();
    vi.mocked(mock.delete).mockRejectedValue(
      new ApiError({
        code: "INVALID_REFERENCE",
        message: "In use",
        status: 409,
      }),
    );
    await expect(
      createPositionService(mock).deletePosition("1"),
    ).rejects.toMatchObject({ code: "POSITION_IN_USE", status: 409 });
  });
});
