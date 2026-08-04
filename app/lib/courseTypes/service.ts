import { ApiError } from "../api/errors";
import { courseTypeRepository, normalizeCourseTypeName, type CourseTypeRepository } from "./repository";
import type { CourseTypeListFilters, CreateCourseTypeInput, UpdateCourseTypeInput } from "./types";

const error = (code: string, message: string, status: number) => new ApiError({ code, message, status });
export type CourseTypeService = ReturnType<typeof createCourseTypeService>;
export const createCourseTypeService = (repository: CourseTypeRepository = courseTypeRepository) => ({
  listCourseTypes: (filters: CourseTypeListFilters) => repository.list(filters),
  async getCourseType(id: string) { const row = await repository.findById(id); if (!row) throw error("COURSE_TYPE_NOT_FOUND", "Course type not found", 404); return row; },
  async createCourseType(input: CreateCourseTypeInput, userId: string) { if (await repository.findConflict(input.code, normalizeCourseTypeName(input.name))) throw error("COURSE_TYPE_CONFLICT", "Course type code or name already exists", 409); return repository.create(input, userId); },
  async updateCourseType(id: string, input: UpdateCourseTypeInput, userId: string) {
    const current = await repository.findById(id); if (!current) throw error("COURSE_TYPE_NOT_FOUND", "Course type not found", 404);
    if (input.code && input.code !== current.code && current.hasBeenUsed) throw error("COURSE_TYPE_CODE_LOCKED", "Course type code cannot be changed after use", 409);
    if (input.status === "INACTIVE" && current.status !== "INACTIVE" && await repository.activeCourseCount(id)) throw error("COURSE_TYPE_IN_USE", "Course type cannot be inactivated while active courses use it", 409);
    const nextCode = input.code ?? current.code; const nextName = input.name ?? current.name;
    if (await repository.findConflict(nextCode, normalizeCourseTypeName(nextName), id)) throw error("COURSE_TYPE_CONFLICT", "Course type code or name already exists", 409);
    return repository.update(id, input, userId);
  },
  async deleteCourseType(id: string) { const current = await repository.findById(id); if (!current) throw error("COURSE_TYPE_NOT_FOUND", "Course type not found", 404); if (current.hasBeenUsed || await repository.courseCount(id)) throw error("COURSE_TYPE_IN_USE", "Used course types cannot be deleted; set status to INACTIVE instead", 409); return { courseType: await repository.delete(id), outcome: "DELETED" as const }; },
});
export const courseTypeService = createCourseTypeService();
