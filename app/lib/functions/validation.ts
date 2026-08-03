import { ApiError } from "../api/errors";
import {
  readOptionalString,
  readPositiveId,
  readRequiredString,
  type InputObject,
} from "../api/validation";
import type {
  CreateFunctionMappingInput,
  CreateOrganizationFunctionInput,
  FunctionListFilters,
  MasterStatus,
  UpdateFunctionMappingInput,
  UpdateOrganizationFunctionInput,
} from "./types";
import { MASTER_STATUSES } from "./types";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
const hasOwn = (input: InputObject, field: string) =>
  Object.prototype.hasOwnProperty.call(input, field);

const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted function data is invalid",
    status: 400,
    details: { field, reason },
  });

const readCode = (input: InputObject, field: string, maxLength: number) => {
  const code = readRequiredString(input, field, { maxLength }).toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    throw invalid(field, "Use only letters, numbers, hyphens, and underscores");
  }
  return code;
};

const readStatus = (
  value: unknown,
  fallback?: MasterStatus,
): MasterStatus => {
  if (value === undefined && fallback) return fallback;
  if (
    typeof value !== "string" ||
    !MASTER_STATUSES.includes(value.toUpperCase() as MasterStatus)
  ) {
    throw invalid("status", "Status must be ACTIVE or INACTIVE");
  }
  return value.toUpperCase() as MasterStatus;
};

const ensureUpdate = (update: object) => {
  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }
};

export const parseCreateOrganizationFunction = (
  input: InputObject,
): CreateOrganizationFunctionInput => ({
  functionCode: readCode(input, "functionCode", 30),
  functionNameTh: readRequiredString(input, "functionNameTh", {
    maxLength: 255,
  }),
  functionNameEn: readOptionalString(input, "functionNameEn", {
    maxLength: 255,
  }),
  status: readStatus(input.status, "ACTIVE"),
});

export const parseUpdateOrganizationFunction = (
  input: InputObject,
): UpdateOrganizationFunctionInput => {
  const update: UpdateOrganizationFunctionInput = {};
  if (hasOwn(input, "functionCode")) {
    update.functionCode = readCode(input, "functionCode", 30);
  }
  if (hasOwn(input, "functionNameTh")) {
    update.functionNameTh = readRequiredString(input, "functionNameTh", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "functionNameEn")) {
    update.functionNameEn = readOptionalString(input, "functionNameEn", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "status")) update.status = readStatus(input.status);
  ensureUpdate(update);
  return update;
};

export const parseCreateFunctionMapping = (
  input: InputObject,
): CreateFunctionMappingInput => ({
  companyId:
    input.companyId === undefined || input.companyId === null
      ? null
      : readPositiveId(input.companyId, "companyId"),
  plantFunctionCode: readCode(input, "plantFunctionCode", 50),
  plantFunctionName: readRequiredString(input, "plantFunctionName", {
    maxLength: 255,
  }),
  functionId: readPositiveId(input.functionId, "functionId"),
  status: readStatus(input.status, "ACTIVE"),
});

export const parseUpdateFunctionMapping = (
  input: InputObject,
): UpdateFunctionMappingInput => {
  const update: UpdateFunctionMappingInput = {};
  if (hasOwn(input, "plantFunctionCode")) {
    update.plantFunctionCode = readCode(input, "plantFunctionCode", 50);
  }
  if (hasOwn(input, "plantFunctionName")) {
    update.plantFunctionName = readRequiredString(input, "plantFunctionName", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "functionId")) {
    update.functionId = readPositiveId(input.functionId, "functionId");
  }
  if (hasOwn(input, "status")) update.status = readStatus(input.status);
  ensureUpdate(update);
  return update;
};

export const parseFunctionListFilters = (
  searchParams: URLSearchParams,
  pagination: Pick<FunctionListFilters, "skip" | "take">,
): FunctionListFilters => {
  const search = searchParams.get("search")?.trim() || null;
  const rawStatus = searchParams.get("status");
  if (search && search.length > 100) {
    throw invalid("search", "Search must contain no more than 100 characters");
  }
  return {
    search,
    status: rawStatus ? readStatus(rawStatus) : null,
    skip: pagination.skip,
    take: pagination.take,
  };
};
