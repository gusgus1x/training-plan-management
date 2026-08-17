import { ApiError } from "../api/errors";
import {
  readOptionalString,
  readPositiveId,
  readRequiredString,
  type InputObject,
} from "../api/validation";
import {
  SECTION_STATUSES,
  type CreateSectionInput,
  type CreateSectionMappingInput,
  type SectionListFilters,
  type SectionStatus,
  type UpdateSectionInput,
  type UpdateSectionMappingInput,
} from "./types";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
const hasOwn = (input: InputObject, field: string) =>
  Object.prototype.hasOwnProperty.call(input, field);
const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted section data is invalid",
    status: 400,
    details: { field, reason },
  });

const code = (input: InputObject) => {
  const value = readRequiredString(input, "sectionCode", {
    maxLength: 30,
  }).toUpperCase();
  if (!CODE_PATTERN.test(value)) {
    throw invalid(
      "sectionCode",
      "Use only letters, numbers, hyphens, and underscores",
    );
  }
  return value;
};

const status = (
  value: unknown,
  fallback?: SectionStatus,
): SectionStatus => {
  if (value === undefined && fallback) return fallback;
  if (
    typeof value !== "string" ||
    !SECTION_STATUSES.includes(value.toUpperCase() as SectionStatus)
  ) {
    throw invalid("status", "Status must be ACTIVE or INACTIVE");
  }
  return value.toUpperCase() as SectionStatus;
};

export const parseCreateSection = (
  input: InputObject,
): CreateSectionInput => ({
  sectionCode: code(input),
  sectionNameTh: readRequiredString(input, "sectionNameTh", {
    maxLength: 255,
  }),
  sectionNameEn: readOptionalString(input, "sectionNameEn", {
    maxLength: 255,
  }),
  status: status(input.status, "ACTIVE"),
});

export const parseUpdateSection = (
  input: InputObject,
): UpdateSectionInput => {
  const update: UpdateSectionInput = {};
  if (hasOwn(input, "sectionCode")) update.sectionCode = code(input);
  if (hasOwn(input, "sectionNameTh")) {
    update.sectionNameTh = readRequiredString(input, "sectionNameTh", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "sectionNameEn")) {
    update.sectionNameEn = readOptionalString(input, "sectionNameEn", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }
  return update;
};

const plantSectionCode = (input: InputObject) => {
  const value = readRequiredString(input, "plantSectionCode", {
    maxLength: 50,
  }).toUpperCase();
  if (!CODE_PATTERN.test(value)) {
    throw invalid(
      "plantSectionCode",
      "Use only letters, numbers, hyphens, and underscores",
    );
  }
  return value;
};

export const parseCreateSectionMapping = (
  input: InputObject,
): CreateSectionMappingInput => ({
  companyId:
    input.companyId === undefined || input.companyId === null
      ? null
      : readPositiveId(input.companyId, "companyId"),
  plantSectionCode: plantSectionCode(input),
  plantSectionName: readRequiredString(input, "plantSectionName", {
    maxLength: 255,
  }),
  sectionId: readPositiveId(input.sectionId, "sectionId"),
  status: status(input.status, "ACTIVE"),
});

export const parseUpdateSectionMapping = (
  input: InputObject,
): UpdateSectionMappingInput => {
  const update: UpdateSectionMappingInput = {};
  if (hasOwn(input, "plantSectionCode")) {
    update.plantSectionCode = plantSectionCode(input);
  }
  if (hasOwn(input, "plantSectionName")) {
    update.plantSectionName = readRequiredString(input, "plantSectionName", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "sectionId")) {
    update.sectionId = readPositiveId(input.sectionId, "sectionId");
  }
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }
  return update;
};

export const parseSectionListFilters = (
  params: URLSearchParams,
  pagination: Pick<SectionListFilters, "skip" | "take">,
): SectionListFilters => {
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
