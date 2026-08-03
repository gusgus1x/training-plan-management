import { ApiError } from "../api/errors";
import {
  functionRepository,
  type FunctionRepository,
} from "./repository";
import type {
  CreateFunctionMappingInput,
  CreateOrganizationFunctionInput,
  FunctionListFilters,
  MappingListFilters,
  UpdateFunctionMappingInput,
  UpdateOrganizationFunctionInput,
} from "./types";

const notFound = (resource: "Function" | "Function mapping") =>
  new ApiError({
    code: resource === "Function" ? "FUNCTION_NOT_FOUND" : "MAPPING_NOT_FOUND",
    message: `${resource} not found`,
    status: 404,
  });

const conflict = (code: string, message: string) =>
  new ApiError({ code, message, status: 409 });

export type FunctionService = ReturnType<typeof createFunctionService>;

export const createFunctionService = (
  repository: FunctionRepository = functionRepository,
) => ({
  listFunctions: (filters: FunctionListFilters) =>
    repository.listFunctions(filters),

  async getFunction(functionId: string) {
    const record = await repository.findFunctionById(functionId);
    if (!record) throw notFound("Function");
    return record;
  },

  async createFunction(input: CreateOrganizationFunctionInput) {
    if (await repository.findFunctionByCode(input.functionCode)) {
      throw conflict("FUNCTION_CODE_CONFLICT", "Function code already exists");
    }
    return repository.createFunction(input);
  },

  async updateFunction(
    functionId: string,
    input: UpdateOrganizationFunctionInput,
  ) {
    if (!(await repository.findFunctionById(functionId))) {
      throw notFound("Function");
    }
    if (
      input.functionCode &&
      (await repository.findFunctionByCode(input.functionCode, functionId))
    ) {
      throw conflict("FUNCTION_CODE_CONFLICT", "Function code already exists");
    }
    return repository.updateFunction(functionId, input);
  },

  async deleteFunction(functionId: string) {
    if (!(await repository.findFunctionById(functionId))) {
      throw notFound("Function");
    }
    try {
      return await repository.deleteFunction(functionId);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "INVALID_REFERENCE") {
        throw conflict(
          "FUNCTION_IN_USE",
          "Function cannot be deleted because it is still in use",
        );
      }
      throw error;
    }
  },

  listMappings: (filters: MappingListFilters) =>
    repository.listMappings(filters),

  async getMapping(mappingId: string) {
    const record = await repository.findMappingById(mappingId);
    if (!record) throw notFound("Function mapping");
    return record;
  },

  async createMapping(
    input: CreateFunctionMappingInput & { companyId: string },
  ) {
    if (!(await repository.findFunctionById(input.functionId))) {
      throw notFound("Function");
    }
    if (
      await repository.findMappingByCode(
        input.companyId,
        input.plantFunctionCode,
      )
    ) {
      throw conflict(
        "MAPPING_CODE_CONFLICT",
        "Plant function code already exists for this company",
      );
    }
    return repository.createMapping(input);
  },

  async updateMapping(mappingId: string, input: UpdateFunctionMappingInput) {
    const current = await repository.findMappingById(mappingId);
    if (!current) throw notFound("Function mapping");
    if (
      input.functionId &&
      !(await repository.findFunctionById(input.functionId))
    ) {
      throw notFound("Function");
    }
    if (
      input.plantFunctionCode &&
      (await repository.findMappingByCode(
        current.companyId,
        input.plantFunctionCode,
        mappingId,
      ))
    ) {
      throw conflict(
        "MAPPING_CODE_CONFLICT",
        "Plant function code already exists for this company",
      );
    }
    return repository.updateMapping(mappingId, input);
  },

  async deleteMapping(mappingId: string) {
    if (!(await repository.findMappingById(mappingId))) {
      throw notFound("Function mapping");
    }
    return repository.deleteMapping(mappingId);
  },
});

export const functionService = createFunctionService();
