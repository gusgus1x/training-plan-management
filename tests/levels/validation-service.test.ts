import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../app/lib/api/errors";
import type { LevelRepository } from "../../app/lib/levels/repository";
import { createLevelService } from "../../app/lib/levels/service";
import { parseCreateLevel } from "../../app/lib/levels/validation";

const record = {
  levelId: "1",
  levelCode: "S1",
  levelCodeTh: "บ",
  levelCodeEn: "S",
  levelNameTh: "บังคับบัญชา1",
  levelNameEn: "Supervisor1",
  pl: "1",
  levelKey: "บ1",
  remark: null,
  status: "ACTIVE" as const,
};
const repository = () =>
  ({
    list: vi.fn(),
    findById: vi.fn().mockResolvedValue(record),
    findConflict: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockResolvedValue(record),
    delete: vi.fn().mockResolvedValue(record),
  }) as unknown as LevelRepository;

describe("level validation and service", () => {
  it("normalizes the complete UI mock input", async () => {
    const input = parseCreateLevel({
      levelCodeTh: " บ ",
      levelCodeEn: " s ",
      levelNameTh: " บังคับบัญชา1 ",
      levelNameEn: " Supervisor1 ",
      pl: " 1 ",
      levelKey: " บ1 ",
      remark: " ",
    });
    expect(input).toEqual({
      levelCodeTh: "บ",
      levelCodeEn: "S",
      levelNameTh: "บังคับบัญชา1",
      levelNameEn: "Supervisor1",
      pl: "1",
      levelKey: "บ1",
      remark: null,
      status: "ACTIVE",
    });
    const mock = repository();
    await createLevelService(mock).createLevel(input);
    expect(mock.create).toHaveBeenCalledWith(
      expect.objectContaining({ levelCode: "S1" }),
    );
  });

  it("returns LEVEL_IN_USE for foreign-key conflicts", async () => {
    const mock = repository();
    vi.mocked(mock.delete).mockRejectedValue(
      new ApiError({
        code: "INVALID_REFERENCE",
        message: "In use",
        status: 409,
      }),
    );
    await expect(
      createLevelService(mock).deleteLevel("1"),
    ).rejects.toMatchObject({ code: "LEVEL_IN_USE", status: 409 });
  });
});
