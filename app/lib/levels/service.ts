import { ApiError } from "../api/errors";
import { levelRepository, type LevelRepository } from "./repository";
import type {
  CreateLevelInput,
  LevelListFilters,
  LevelRecord,
  PersistLevelInput,
  UpdateLevelInput,
} from "./types";

const notFound = () =>
  new ApiError({
    code: "LEVEL_NOT_FOUND",
    message: "Level not found",
    status: 404,
  });
const conflict = (code: string, message: string) =>
  new ApiError({ code, message, status: 409 });
const persisted = (input: CreateLevelInput): PersistLevelInput => {
  const levelCode = `${input.levelCodeEn}${input.pl}`.toUpperCase();
  if (levelCode.length > 30) {
    throw new ApiError({
      code: "INVALID_INPUT",
      message: "Level Code (EN) and PL are too long when combined",
      status: 400,
    });
  }
  return { ...input, levelCode };
};
const fromRecord = (record: LevelRecord): CreateLevelInput => ({
  levelCodeTh: record.levelCodeTh,
  levelCodeEn: record.levelCodeEn,
  levelNameTh: record.levelNameTh,
  levelNameEn: record.levelNameEn,
  pl: record.pl ?? "",
  levelKey: record.levelKey,
  remark: record.remark,
  status: record.status,
});

export type LevelService = ReturnType<typeof createLevelService>;
export const createLevelService = (
  repository: LevelRepository = levelRepository,
) => ({
  listLevels: (filters: LevelListFilters) => repository.list(filters),
  async getLevel(id: string) {
    const record = await repository.findById(id);
    if (!record) throw notFound();
    return record;
  },
  async createLevel(input: CreateLevelInput) {
    const data = persisted(input);
    if (await repository.findConflict(data.levelCode, data.levelKey)) {
      throw conflict(
        "LEVEL_CODE_CONFLICT",
        "Level code or level key already exists",
      );
    }
    return repository.create(data);
  },
  async updateLevel(id: string, input: UpdateLevelInput) {
    const current = await repository.findById(id);
    if (!current) throw notFound();
    const data = persisted({ ...fromRecord(current), ...input });
    if (await repository.findConflict(data.levelCode, data.levelKey, id)) {
      throw conflict(
        "LEVEL_CODE_CONFLICT",
        "Level code or level key already exists",
      );
    }
    return repository.update(id, data);
  },
  async deleteLevel(id: string) {
    if (!(await repository.findById(id))) throw notFound();
    try {
      return await repository.delete(id);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "INVALID_REFERENCE") {
        throw conflict(
          "LEVEL_IN_USE",
          "Level cannot be deleted because it is still in use",
        );
      }
      throw error;
    }
  },
});

export const levelService = createLevelService();
