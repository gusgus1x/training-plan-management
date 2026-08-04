import { ApiError } from "../api/errors";
import {
  instructorRepository,
  type InstructorRepository,
} from "./repository";
import type {
  CreateInstructorInput,
  InstructorListFilters,
  UpdateInstructorInput,
} from "./types";

const notFound = () =>
  new ApiError({
    code: "INSTRUCTOR_NOT_FOUND",
    message: "Instructor not found",
    status: 404,
  });
const conflict = (code: string, message: string) =>
  new ApiError({ code, message, status: 409 });

export type InstructorService = ReturnType<typeof createInstructorService>;
export const createInstructorService = (
  repository: InstructorRepository = instructorRepository,
) => ({
  listInstructors: (filters: InstructorListFilters) => repository.list(filters),
  async getInstructor(id: string) {
    const record = await repository.findById(id);
    if (!record) throw notFound();
    return record;
  },
  async createInstructor(input: CreateInstructorInput) {
    if (await repository.findByCode(input.instructorCode)) {
      throw conflict("INSTRUCTOR_CODE_CONFLICT", "Instructor code already exists");
    }
    return repository.create(input);
  },
  async updateInstructor(id: string, input: UpdateInstructorInput) {
    if (!(await repository.findById(id))) throw notFound();
    if (
      input.instructorCode &&
      (await repository.findByCode(input.instructorCode, id))
    ) {
      throw conflict("INSTRUCTOR_CODE_CONFLICT", "Instructor code already exists");
    }
    return repository.update(id, input);
  },
  async deleteInstructor(id: string) {
    const current = await repository.findById(id);
    if (!current) throw notFound();

    if (await repository.isReferenced(id)) {
      return {
        instructor:
          current.status === "INACTIVE"
            ? current
            : await repository.update(id, { status: "INACTIVE" }),
        outcome: "DEACTIVATED" as const,
      };
    }

    try {
      return {
        instructor: await repository.delete(id),
        outcome: "DELETED" as const,
      };
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "INVALID_REFERENCE") {
        return {
          instructor: await repository.update(id, { status: "INACTIVE" }),
          outcome: "DEACTIVATED" as const,
        };
      }
      throw error;
    }
  },
});

export const instructorService = createInstructorService();
