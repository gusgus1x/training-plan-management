import { ApiError } from "../api/errors";
import {
  sectionRepository,
  type SectionRepository,
} from "./repository";
import type {
  CreateSectionInput,
  CreateSectionMappingInput,
  MappingListFilters,
  SectionListFilters,
  UpdateSectionInput,
  UpdateSectionMappingInput,
} from "./types";

const notFound = (resource: "Section" | "Section mapping" = "Section") =>
  new ApiError({
    code: resource === "Section" ? "SECTION_NOT_FOUND" : "MAPPING_NOT_FOUND",
    message: `${resource} not found`,
    status: 404,
  });
const conflict = (code: string, message: string) =>
  new ApiError({ code, message, status: 409 });

export type SectionService = ReturnType<typeof createSectionService>;
export const createSectionService = (
  repository: SectionRepository = sectionRepository,
) => ({
  listSections: (filters: SectionListFilters) => repository.list(filters),
  async getSection(id: string) {
    const record = await repository.findById(id);
    if (!record) throw notFound();
    return record;
  },
  async createSection(input: CreateSectionInput) {
    if (await repository.findByCode(input.sectionCode)) {
      throw conflict("SECTION_CODE_CONFLICT", "Section code already exists");
    }
    return repository.create(input);
  },
  async updateSection(id: string, input: UpdateSectionInput) {
    if (!(await repository.findById(id))) throw notFound();
    if (
      input.sectionCode &&
      (await repository.findByCode(input.sectionCode, id))
    ) {
      throw conflict("SECTION_CODE_CONFLICT", "Section code already exists");
    }
    return repository.update(id, input);
  },
  async deleteSection(id: string) {
    if (!(await repository.findById(id))) throw notFound();
    try {
      return await repository.delete(id);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "INVALID_REFERENCE") {
        throw conflict(
          "SECTION_IN_USE",
          "Section cannot be deleted because it is still in use",
        );
      }
      throw error;
    }
  },

  listMappings: (filters: MappingListFilters) => repository.listMappings(filters),

  async getMapping(mappingId: string) {
    const record = await repository.findMappingById(mappingId);
    if (!record) throw notFound("Section mapping");
    return record;
  },

  async createMapping(input: CreateSectionMappingInput & { companyId: string }) {
    if (!(await repository.findById(input.sectionId))) {
      throw notFound("Section");
    }
    if (
      await repository.findMappingByCode(input.companyId, input.plantSectionCode)
    ) {
      throw conflict(
        "MAPPING_CODE_CONFLICT",
        "Plant section code already exists for this company",
      );
    }
    return repository.createMapping(input);
  },

  async updateMapping(mappingId: string, input: UpdateSectionMappingInput) {
    const current = await repository.findMappingById(mappingId);
    if (!current) throw notFound("Section mapping");
    if (input.sectionId && !(await repository.findById(input.sectionId))) {
      throw notFound("Section");
    }
    if (
      input.plantSectionCode &&
      (await repository.findMappingByCode(
        current.companyId,
        input.plantSectionCode,
        mappingId,
      ))
    ) {
      throw conflict(
        "MAPPING_CODE_CONFLICT",
        "Plant section code already exists for this company",
      );
    }
    return repository.updateMapping(mappingId, input);
  },

  async deleteMapping(mappingId: string) {
    if (!(await repository.findMappingById(mappingId))) {
      throw notFound("Section mapping");
    }
    return repository.deleteMapping(mappingId);
  },
});

export const sectionService = createSectionService();
