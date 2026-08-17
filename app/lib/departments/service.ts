import { ApiError } from "../api/errors";
import {
  departmentRepository,
  type DepartmentRepository,
} from "./repository";
import type {
  CreateDepartmentInput,
  CreateDepartmentMappingInput,
  DepartmentListFilters,
  MappingListFilters,
  UpdateDepartmentInput,
  UpdateDepartmentMappingInput,
} from "./types";

const notFound = (resource: "Department" | "Department mapping" = "Department") =>
  new ApiError({
    code:
      resource === "Department" ? "DEPARTMENT_NOT_FOUND" : "MAPPING_NOT_FOUND",
    message: `${resource} not found`,
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

  listMappings: (filters: MappingListFilters) => repository.listMappings(filters),

  async getMapping(mappingId: string) {
    const record = await repository.findMappingById(mappingId);
    if (!record) throw notFound("Department mapping");
    return record;
  },

  async createMapping(
    input: CreateDepartmentMappingInput & { companyId: string },
  ) {
    if (!(await repository.findById(input.departmentId))) {
      throw notFound("Department");
    }
    if (
      await repository.findMappingByCode(
        input.companyId,
        input.plantDepartmentCode,
      )
    ) {
      throw conflict(
        "MAPPING_CODE_CONFLICT",
        "Plant department code already exists for this company",
      );
    }
    return repository.createMapping(input);
  },

  async updateMapping(mappingId: string, input: UpdateDepartmentMappingInput) {
    const current = await repository.findMappingById(mappingId);
    if (!current) throw notFound("Department mapping");
    if (
      input.departmentId &&
      !(await repository.findById(input.departmentId))
    ) {
      throw notFound("Department");
    }
    if (
      input.plantDepartmentCode &&
      (await repository.findMappingByCode(
        current.companyId,
        input.plantDepartmentCode,
        mappingId,
      ))
    ) {
      throw conflict(
        "MAPPING_CODE_CONFLICT",
        "Plant department code already exists for this company",
      );
    }
    return repository.updateMapping(mappingId, input);
  },

  async deleteMapping(mappingId: string) {
    if (!(await repository.findMappingById(mappingId))) {
      throw notFound("Department mapping");
    }
    return repository.deleteMapping(mappingId);
  },
});

export const departmentService = createDepartmentService();
