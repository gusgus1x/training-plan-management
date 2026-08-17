import { ApiError } from "../api/errors";
import {
  divisionRepository,
  type DivisionRepository,
} from "./repository";
import type {
  CreateDivisionInput,
  CreateDivisionMappingInput,
  DivisionListFilters,
  MappingListFilters,
  UpdateDivisionInput,
  UpdateDivisionMappingInput,
} from "./types";

const notFound = (resource: "Division" | "Division mapping" = "Division") =>
  new ApiError({
    code:
      resource === "Division" ? "DIVISION_NOT_FOUND" : "MAPPING_NOT_FOUND",
    message: `${resource} not found`,
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

  listMappings: (filters: MappingListFilters) => repository.listMappings(filters),

  async getMapping(mappingId: string) {
    const record = await repository.findMappingById(mappingId);
    if (!record) throw notFound("Division mapping");
    return record;
  },

  async createMapping(input: CreateDivisionMappingInput & { companyId: string }) {
    if (!(await repository.findById(input.divisionId))) {
      throw notFound("Division");
    }
    if (
      await repository.findMappingByCode(input.companyId, input.plantDivisionCode)
    ) {
      throw conflict(
        "MAPPING_CODE_CONFLICT",
        "Plant division code already exists for this company",
      );
    }
    return repository.createMapping(input);
  },

  async updateMapping(mappingId: string, input: UpdateDivisionMappingInput) {
    const current = await repository.findMappingById(mappingId);
    if (!current) throw notFound("Division mapping");
    if (input.divisionId && !(await repository.findById(input.divisionId))) {
      throw notFound("Division");
    }
    if (
      input.plantDivisionCode &&
      (await repository.findMappingByCode(
        current.companyId,
        input.plantDivisionCode,
        mappingId,
      ))
    ) {
      throw conflict(
        "MAPPING_CODE_CONFLICT",
        "Plant division code already exists for this company",
      );
    }
    return repository.updateMapping(mappingId, input);
  },

  async deleteMapping(mappingId: string) {
    if (!(await repository.findMappingById(mappingId))) {
      throw notFound("Division mapping");
    }
    return repository.deleteMapping(mappingId);
  },
});

export const divisionService = createDivisionService();
