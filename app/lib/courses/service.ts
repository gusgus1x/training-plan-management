import { ApiError } from "../api/errors";
import { courseRepository, type CourseRepository } from "./repository";
import type { CourseListFilters, CreateCourseInput, UpdateCourseInput } from "./types";

const error = (code: string, message: string, status: number) => new ApiError({ code, message, status });

export type CourseService = ReturnType<typeof createCourseService>;
export const createCourseService = (repository: CourseRepository = courseRepository) => ({
  listCourses: (filters: CourseListFilters, companyId: string | null) => repository.list(filters, companyId),
  async createCourse(input: CreateCourseInput, userId: string, companyId: string | null) {
    return repository.create(input, userId, companyId);
  },
  async updateCourse(id: string, input: UpdateCourseInput, userId: string) {
    return repository.update(id, input, userId);
  },
  async deleteCourse(id: string, userId: string) {
    return repository.delete(id);
  }
});

export const courseService = createCourseService();
