import { ApiError } from "../api/errors";
import {
  departmentRepository,
  type DepartmentRepository,
} from "./repository";
import type {
  CreateDepartmentInput,
  DepartmentListFilters,
  UpdateDepartmentInput,
} from "./types";

const notFound = () =>
  new ApiError({
    code: "DEPARTMENT_NOT_FOUND",
    message: "Department not found",
    status: 404,
  });
const conflict = (code: string, message: string) =>
  new ApiError({ code, message, status: 409 });

export type DepartmentService = ReturnType<typeof createDepartmentService>;
export const createDepartmentService = (
  repository: DepartmentRepository = departmentRepository,
) => ({
  listDepartments: (filters: DepartmentListFilters) => repository.list(filters),
  async getDepartment(id: string) {
    const record = await repository.findById(id);
    if (!record) throw notFound();
    return record;
  },
  async createDepartment(input: CreateDepartmentInput) {
    if (await repository.findByCode(input.departmentCode)) {
      throw conflict("DEPARTMENT_CODE_CONFLICT", "Department code already exists");
    }
    return repository.create(input);
  },
  async updateDepartment(id: string, input: UpdateDepartmentInput) {
    if (!(await repository.findById(id))) throw notFound();
    if (
      input.departmentCode &&
      (await repository.findByCode(input.departmentCode, id))
    ) {
      throw conflict("DEPARTMENT_CODE_CONFLICT", "Department code already exists");
    }
    return repository.update(id, input);
  },
  async deleteDepartment(id: string) {
    if (!(await repository.findById(id))) throw notFound();
    try {
      return await repository.delete(id);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "INVALID_REFERENCE") {
        throw conflict(
          "DEPARTMENT_IN_USE",
          "Department cannot be deleted because it is still in use",
        );
      }
      throw error;
    }
  },
});

export const departmentService = createDepartmentService();
