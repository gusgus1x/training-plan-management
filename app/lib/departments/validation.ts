import { ApiError } from "../api/errors";
import {
  readOptionalString,
  readPositiveId,
  readRequiredString,
  type InputObject,
} from "../api/validation";
import {
  DEPARTMENT_STATUSES,
  type CreateDepartmentInput,
  type CreateDepartmentMappingInput,
  type DepartmentListFilters,
  type DepartmentStatus,
  type UpdateDepartmentInput,
  type UpdateDepartmentMappingInput,
} from "./types";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
const hasOwn = (input: InputObject, field: string) =>
  Object.prototype.hasOwnProperty.call(input, field);
const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted department data is invalid",
    status: 400,
    details: { field, reason },
  });

const code = (input: InputObject) => {
  const value = readRequiredString(input, "departmentCode", {
    maxLength: 30,
  }).toUpperCase();
  if (!CODE_PATTERN.test(value)) {
    throw invalid(
      "departmentCode",
      "Use only letters, numbers, hyphens, and underscores",
    );
  }
  return value;
};

const status = (
  value: unknown,
  fallback?: DepartmentStatus,
): DepartmentStatus => {
  if (value === undefined && fallback) return fallback;
  if (
    typeof value !== "string" ||
    !DEPARTMENT_STATUSES.includes(value.toUpperCase() as DepartmentStatus)
  ) {
    throw invalid("status", "Status must be ACTIVE or INACTIVE");
  }
  return value.toUpperCase() as DepartmentStatus;
};

export const parseCreateDepartment = (
  input: InputObject,
): CreateDepartmentInput => ({
  departmentCode: code(input),
  departmentNameTh: readRequiredString(input, "departmentNameTh", {
    maxLength: 255,
  }),
  departmentNameEn: readOptionalString(input, "departmentNameEn", {
    maxLength: 255,
  }),
  status: status(input.status, "ACTIVE"),
});

export const parseUpdateDepartment = (
  input: InputObject,
): UpdateDepartmentInput => {
  const update: UpdateDepartmentInput = {};
  if (hasOwn(input, "departmentCode")) update.departmentCode = code(input);
  if (hasOwn(input, "departmentNameTh")) {
    update.departmentNameTh = readRequiredString(input, "departmentNameTh", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "departmentNameEn")) {
    update.departmentNameEn = readOptionalString(input, "departmentNameEn", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }
  return update;
};

const plantDepartmentCode = (input: InputObject) => {
  const value = readRequiredString(input, "plantDepartmentCode", {
    maxLength: 50,
  }).toUpperCase();
  if (!CODE_PATTERN.test(value)) {
    throw invalid(
      "plantDepartmentCode",
      "Use only letters, numbers, hyphens, and underscores",
    );
  }
  return value;
};

export const parseCreateDepartmentMapping = (
  input: InputObject,
): CreateDepartmentMappingInput => ({
  companyId:
    input.companyId === undefined || input.companyId === null
      ? null
      : readPositiveId(input.companyId, "companyId"),
  plantDepartmentCode: plantDepartmentCode(input),
  plantDepartmentName: readRequiredString(input, "plantDepartmentName", {
    maxLength: 255,
  }),
  departmentId: readPositiveId(input.departmentId, "departmentId"),
  status: status(input.status, "ACTIVE"),
});

export const parseUpdateDepartmentMapping = (
  input: InputObject,
): UpdateDepartmentMappingInput => {
  const update: UpdateDepartmentMappingInput = {};
  if (hasOwn(input, "plantDepartmentCode")) {
    update.plantDepartmentCode = plantDepartmentCode(input);
  }
  if (hasOwn(input, "plantDepartmentName")) {
    update.plantDepartmentName = readRequiredString(
      input,
      "plantDepartmentName",
      { maxLength: 255 },
    );
  }
  if (hasOwn(input, "departmentId")) {
    update.departmentId = readPositiveId(input.departmentId, "departmentId");
  }
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }
  return update;
};

export const parseDepartmentListFilters = (
  params: URLSearchParams,
  pagination: Pick<DepartmentListFilters, "skip" | "take">,
): DepartmentListFilters => {
  const search = params.get("search")?.trim() || null;
  const rawStatus = params.get("status");
  if (search && search.length > 100) {
    throw invalid("search", "Search must contain no more than 100 characters");
  }
  return {
    search,
    status: rawStatus ? status(rawStatus) : null,
    skip: pagination.skip,
    take: pagination.take,
  };
};
