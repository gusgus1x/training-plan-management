import { ApiError } from "../api/errors";
import {
  readOptionalString,
  readRequiredString,
  type InputObject,
} from "../api/validation";
import {
  DIVISION_STATUSES,
  type CreateDivisionInput,
  type DivisionListFilters,
  type DivisionStatus,
  type UpdateDivisionInput,
} from "./types";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
const hasOwn = (input: InputObject, field: string) =>
  Object.prototype.hasOwnProperty.call(input, field);
const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted division data is invalid",
    status: 400,
    details: { field, reason },
  });

const code = (input: InputObject) => {
  const value = readRequiredString(input, "divisionCode", {
    maxLength: 30,
  }).toUpperCase();
  if (!CODE_PATTERN.test(value)) {
    throw invalid(
      "divisionCode",
      "Use only letters, numbers, hyphens, and underscores",
    );
  }
  return value;
};

const status = (
  value: unknown,
  fallback?: DivisionStatus,
): DivisionStatus => {
  if (value === undefined && fallback) return fallback;
  if (
    typeof value !== "string" ||
    !DIVISION_STATUSES.includes(value.toUpperCase() as DivisionStatus)
  ) {
    throw invalid("status", "Status must be ACTIVE or INACTIVE");
  }
  return value.toUpperCase() as DivisionStatus;
};

export const parseCreateDivision = (
  input: InputObject,
): CreateDivisionInput => ({
  divisionCode: code(input),
  divisionNameTh: readRequiredString(input, "divisionNameTh", {
    maxLength: 255,
  }),
  divisionNameEn: readOptionalString(input, "divisionNameEn", {
    maxLength: 255,
  }),
  status: status(input.status, "ACTIVE"),
});

export const parseUpdateDivision = (
  input: InputObject,
): UpdateDivisionInput => {
  const update: UpdateDivisionInput = {};
  if (hasOwn(input, "divisionCode")) update.divisionCode = code(input);
  if (hasOwn(input, "divisionNameTh")) {
    update.divisionNameTh = readRequiredString(input, "divisionNameTh", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "divisionNameEn")) {
    update.divisionNameEn = readOptionalString(input, "divisionNameEn", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }
  return update;
};

export const parseDivisionListFilters = (
  params: URLSearchParams,
  pagination: Pick<DivisionListFilters, "skip" | "take">,
): DivisionListFilters => {
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
