import { ApiError } from "../api/errors";
import {
  divisionRepository,
  type DivisionRepository,
} from "./repository";
import type {
  CreateDivisionInput,
  DivisionListFilters,
  UpdateDivisionInput,
} from "./types";

const notFound = () =>
  new ApiError({
    code: "DIVISION_NOT_FOUND",
    message: "Division not found",
    status: 404,
  });
const conflict = (code: string, message: string) =>
  new ApiError({ code, message, status: 409 });

export type DivisionService = ReturnType<typeof createDivisionService>;
export const createDivisionService = (
  repository: DivisionRepository = divisionRepository,
) => ({
  listDivisions: (filters: DivisionListFilters) => repository.list(filters),
  async getDivision(id: string) {
    const record = await repository.findById(id);
    if (!record) throw notFound();
    return record;
  },
  async createDivision(input: CreateDivisionInput) {
    if (await repository.findByCode(input.divisionCode)) {
      throw conflict("DIVISION_CODE_CONFLICT", "Division code already exists");
    }
    return repository.create(input);
  },
  async updateDivision(id: string, input: UpdateDivisionInput) {
    if (!(await repository.findById(id))) throw notFound();
    if (
      input.divisionCode &&
      (await repository.findByCode(input.divisionCode, id))
    ) {
      throw conflict("DIVISION_CODE_CONFLICT", "Division code already exists");
    }
    return repository.update(id, input);
  },
  async deleteDivision(id: string) {
    if (!(await repository.findById(id))) throw notFound();
    try {
      return await repository.delete(id);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "INVALID_REFERENCE") {
        throw conflict(
          "DIVISION_IN_USE",
          "Division cannot be deleted because it is still in use",
        );
      }
      throw error;
    }
  },
});

export const divisionService = createDivisionService();
