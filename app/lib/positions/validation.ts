import { ApiError } from "../api/errors";
import {
  readOptionalString,
  readRequiredString,
  type InputObject,
} from "../api/validation";
import {
  POSITION_STATUSES,
  type CreatePositionInput,
  type PositionListFilters,
  type PositionStatus,
  type UpdatePositionInput,
} from "./types";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
const hasOwn = (input: InputObject, field: string) =>
  Object.prototype.hasOwnProperty.call(input, field);
const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted position data is invalid",
    status: 400,
    details: { field, reason },
  });

const code = (input: InputObject) => {
  const value = readRequiredString(input, "positionCode", {
    maxLength: 30,
  }).toUpperCase();
  if (!CODE_PATTERN.test(value)) {
    throw invalid(
      "positionCode",
      "Use only letters, numbers, hyphens, and underscores",
    );
  }
  return value;
};

const status = (
  value: unknown,
  fallback?: PositionStatus,
): PositionStatus => {
  if (value === undefined && fallback) return fallback;
  if (
    typeof value !== "string" ||
    !POSITION_STATUSES.includes(value.toUpperCase() as PositionStatus)
  ) {
    throw invalid("status", "Status must be ACTIVE or INACTIVE");
  }
  return value.toUpperCase() as PositionStatus;
};

export const parseCreatePosition = (
  input: InputObject,
): CreatePositionInput => ({
  positionCode: code(input),
  positionNameTh: readRequiredString(input, "positionNameTh", {
    maxLength: 255,
  }),
  positionNameEn: readOptionalString(input, "positionNameEn", {
    maxLength: 255,
  }),
  status: status(input.status, "ACTIVE"),
});

export const parseUpdatePosition = (
  input: InputObject,
): UpdatePositionInput => {
  const update: UpdatePositionInput = {};
  if (hasOwn(input, "positionCode")) update.positionCode = code(input);
  if (hasOwn(input, "positionNameTh")) {
    update.positionNameTh = readRequiredString(input, "positionNameTh", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "positionNameEn")) {
    update.positionNameEn = readOptionalString(input, "positionNameEn", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }
  return update;
};

export const parsePositionListFilters = (
  params: URLSearchParams,
  pagination: Pick<PositionListFilters, "skip" | "take">,
): PositionListFilters => {
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
