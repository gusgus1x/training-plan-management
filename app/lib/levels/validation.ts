import { ApiError } from "../api/errors";
import {
  readOptionalString,
  readRequiredString,
  type InputObject,
} from "../api/validation";
import {
  LEVEL_STATUSES,
  type CreateLevelInput,
  type LevelListFilters,
  type LevelStatus,
  type UpdateLevelInput,
} from "./types";

const CODE_PATTERN = /^[A-Z0-9_-]+$/;
const hasOwn = (input: InputObject, field: string) =>
  Object.prototype.hasOwnProperty.call(input, field);
const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted level data is invalid",
    status: 400,
    details: { field, reason },
  });

const codeEn = (input: InputObject) => {
  const value = readRequiredString(input, "levelCodeEn", {
    maxLength: 30,
  }).toUpperCase();
  if (!CODE_PATTERN.test(value)) {
    throw invalid(
      "levelCodeEn",
      "Use only letters, numbers, hyphens, and underscores",
    );
  }
  return value;
};

const status = (value: unknown, fallback?: LevelStatus): LevelStatus => {
  if (value === undefined && fallback) return fallback;
  if (
    typeof value !== "string" ||
    !LEVEL_STATUSES.includes(value.toUpperCase() as LevelStatus)
  ) {
    throw invalid("status", "Status must be ACTIVE or INACTIVE");
  }
  return value.toUpperCase() as LevelStatus;
};

export const parseCreateLevel = (input: InputObject): CreateLevelInput => ({
  levelCodeTh: readRequiredString(input, "levelCodeTh", { maxLength: 30 }),
  levelCodeEn: codeEn(input),
  levelNameTh: readRequiredString(input, "levelNameTh", { maxLength: 255 }),
  levelNameEn: readOptionalString(input, "levelNameEn", { maxLength: 255 }),
  pl: readRequiredString(input, "pl", { maxLength: 30 }),
  levelKey: readRequiredString(input, "levelKey", { maxLength: 30 }),
  remark: readOptionalString(input, "remark", { maxLength: 500 }),
  status: status(input.status, "ACTIVE"),
});

export const parseUpdateLevel = (input: InputObject): UpdateLevelInput => {
  const update: UpdateLevelInput = {};
  if (hasOwn(input, "levelCodeTh")) {
    update.levelCodeTh = readRequiredString(input, "levelCodeTh", {
      maxLength: 30,
    });
  }
  if (hasOwn(input, "levelCodeEn")) update.levelCodeEn = codeEn(input);
  if (hasOwn(input, "levelNameTh")) {
    update.levelNameTh = readRequiredString(input, "levelNameTh", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "levelNameEn")) {
    update.levelNameEn = readOptionalString(input, "levelNameEn", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "pl")) {
    update.pl = readRequiredString(input, "pl", { maxLength: 30 });
  }
  if (hasOwn(input, "levelKey")) {
    update.levelKey = readRequiredString(input, "levelKey", {
      maxLength: 30,
    });
  }
  if (hasOwn(input, "remark")) {
    update.remark = readOptionalString(input, "remark", { maxLength: 500 });
  }
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }
  return update;
};

export const parseLevelListFilters = (
  params: URLSearchParams,
  pagination: Pick<LevelListFilters, "skip" | "take">,
): LevelListFilters => {
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
