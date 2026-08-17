import { ApiError } from "../api/errors";
import {
  readOptionalString,
  readRequiredString,
  type InputObject,
} from "../api/validation";
import {
  INSTITUTE_PROVIDER_STATUSES,
  type CreateInstituteProviderInput,
  type InstituteProviderListFilters,
  type InstituteProviderStatus,
  type UpdateInstituteProviderInput,
} from "./types";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
const hasOwn = (input: InputObject, field: string) =>
  Object.prototype.hasOwnProperty.call(input, field);
const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted institute/provider data is invalid",
    status: 400,
    details: { field, reason },
  });

const code = (input: InputObject) => {
  const value = readRequiredString(input, "instituteProviderCode", {
    maxLength: 30,
  }).toUpperCase();
  if (!CODE_PATTERN.test(value)) {
    throw invalid(
      "instituteProviderCode",
      "Use only letters, numbers, hyphens, and underscores",
    );
  }
  return value;
};

const status = (
  value: unknown,
  fallback?: InstituteProviderStatus,
): InstituteProviderStatus => {
  if (value === undefined && fallback) return fallback;
  if (
    typeof value !== "string" ||
    !INSTITUTE_PROVIDER_STATUSES.includes(value.toUpperCase() as InstituteProviderStatus)
  ) {
    throw invalid("status", "Status must be ACTIVE or INACTIVE");
  }
  return value.toUpperCase() as InstituteProviderStatus;
};

export const parseCreateInstituteProvider = (
  input: InputObject,
): CreateInstituteProviderInput => ({
  instituteProviderCode: code(input),
  instituteProviderName: readRequiredString(input, "instituteProviderName", {
    maxLength: 255,
  }),
  status: status(input.status, "ACTIVE"),
});

export const parseUpdateInstituteProvider = (
  input: InputObject,
): UpdateInstituteProviderInput => {
  const update: UpdateInstituteProviderInput = {};
  if (hasOwn(input, "instituteProviderCode")) update.instituteProviderCode = code(input);
  if (hasOwn(input, "instituteProviderName")) {
    update.instituteProviderName = readRequiredString(input, "instituteProviderName", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }
  return update;
};

export const parseInstituteProviderListFilters = (
  params: URLSearchParams,
  pagination: Pick<InstituteProviderListFilters, "skip" | "take">,
): InstituteProviderListFilters => {
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
