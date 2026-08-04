import { ApiError } from "../api/errors";
import { courseGroupRepository, normalizeCourseGroupName, type CourseGroupRepository } from "./repository";
import type { CourseGroupListFilters, CreateCourseGroupInput, UpdateCourseGroupInput } from "./types";
const error = (code: string, message: string, status: number) => new ApiError({ code, message, status });
export type CourseGroupService = ReturnType<typeof createCourseGroupService>;
export const createCourseGroupService = (repository: CourseGroupRepository = courseGroupRepository) => ({
  listCourseGroups: (filters: CourseGroupListFilters) => repository.list(filters),
  async getCourseGroup(id: string) { const row = await repository.findById(id); if (!row) throw error("COURSE_GROUP_NOT_FOUND", "Course group not found", 404); return row; },
  async createCourseGroup(input: CreateCourseGroupInput, userId: string) { if (await repository.findConflict(input.code, normalizeCourseGroupName(input.name))) throw error("COURSE_GROUP_CONFLICT", "Course group ID or name already exists", 409); return repository.create(input, userId); },
  async updateCourseGroup(id: string, input: UpdateCourseGroupInput, userId: string) { const current = await repository.findById(id); if (!current) throw error("COURSE_GROUP_NOT_FOUND", "Course group not found", 404); if (input.code && input.code !== current.code && current.lastCourseNumber > 0) throw error("COURSE_GROUP_CODE_LOCKED", "Group ID cannot be changed after a course number has been issued", 409); if (input.status === "INACTIVE" && current.status !== "INACTIVE" && await repository.activeCourseCount(id)) throw error("COURSE_GROUP_IN_USE", "Course group cannot be inactivated while active courses use it", 409); const nextCode = input.code ?? current.code; const nextName = input.name ?? current.name; if (await repository.findConflict(nextCode, normalizeCourseGroupName(nextName), id)) throw error("COURSE_GROUP_CONFLICT", "Course group ID or name already exists", 409); return repository.update(id, input, userId); },
  async deleteCourseGroup(id: string) { const current = await repository.findById(id); if (!current) throw error("COURSE_GROUP_NOT_FOUND", "Course group not found", 404); if (current.lastCourseNumber > 0 || await repository.courseCount(id)) throw error("COURSE_GROUP_IN_USE", "Used course groups cannot be deleted; set status to INACTIVE instead", 409); return { courseGroup: await repository.delete(id), outcome: "DELETED" as const }; },
});
export const courseGroupService = createCourseGroupService();
