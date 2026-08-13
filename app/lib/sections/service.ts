import { ApiError } from "../api/errors";
import {
  sectionRepository,
  type SectionRepository,
} from "./repository";
import type {
  CreateSectionInput,
  SectionListFilters,
  UpdateSectionInput,
} from "./types";

const notFound = () =>
  new ApiError({
    code: "SECTION_NOT_FOUND",
    message: "Section not found",
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
});

export const sectionService = createSectionService();
