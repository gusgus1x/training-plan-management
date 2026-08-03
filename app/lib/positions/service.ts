import { ApiError } from "../api/errors";
import {
  positionRepository,
  type PositionRepository,
} from "./repository";
import type {
  CreatePositionInput,
  PositionListFilters,
  UpdatePositionInput,
} from "./types";

const notFound = () =>
  new ApiError({
    code: "POSITION_NOT_FOUND",
    message: "Position not found",
    status: 404,
  });
const conflict = (code: string, message: string) =>
  new ApiError({ code, message, status: 409 });

export type PositionService = ReturnType<typeof createPositionService>;
export const createPositionService = (
  repository: PositionRepository = positionRepository,
) => ({
  listPositions: (filters: PositionListFilters) => repository.list(filters),
  async getPosition(id: string) {
    const record = await repository.findById(id);
    if (!record) throw notFound();
    return record;
  },
  async createPosition(input: CreatePositionInput) {
    if (await repository.findByCode(input.positionCode)) {
      throw conflict("POSITION_CODE_CONFLICT", "Position code already exists");
    }
    return repository.create(input);
  },
  async updatePosition(id: string, input: UpdatePositionInput) {
    if (!(await repository.findById(id))) throw notFound();
    if (
      input.positionCode &&
      (await repository.findByCode(input.positionCode, id))
    ) {
      throw conflict("POSITION_CODE_CONFLICT", "Position code already exists");
    }
    return repository.update(id, input);
  },
  async deletePosition(id: string) {
    if (!(await repository.findById(id))) throw notFound();
    try {
      return await repository.delete(id);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "INVALID_REFERENCE") {
        throw conflict(
          "POSITION_IN_USE",
          "Position cannot be deleted because it is still in use",
        );
      }
      throw error;
    }
  },
});

export const positionService = createPositionService();
