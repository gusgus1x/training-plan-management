import { ApiError } from "../api/errors";
import { readOptionalString, readRequiredString, type InputObject } from "../api/validation";
import { COURSE_TYPE_STATUSES, type CourseTypeListFilters, type CourseTypeStatus, type CreateCourseTypeInput, type UpdateCourseTypeInput } from "./types";

const CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const hasOwn = (input: InputObject, field: string) => Object.prototype.hasOwnProperty.call(input, field);
const invalid = (field: string, reason: string) => new ApiError({ code: "INVALID_INPUT", message: "The submitted course type data is invalid", status: 400, details: { field, reason } });

const code = (input: InputObject) => {
  const value = readRequiredString(input, "code", { maxLength: 30 }).toUpperCase();
  if (value.length < 2 || !/^[A-Z]/.test(value) || !CODE_PATTERN.test(value)) {
    throw invalid("code", "Use 2-30 uppercase letters, numbers, and single hyphens; start with a letter");
  }
  return value;
};
const name = (input: InputObject) => readRequiredString(input, "name", { maxLength: 150 });
const status = (value: unknown, fallback?: CourseTypeStatus): CourseTypeStatus => {
  if (value === undefined && fallback) return fallback;
  if (typeof value !== "string" || !COURSE_TYPE_STATUSES.includes(value.toUpperCase() as CourseTypeStatus)) throw invalid("status", "Status must be ACTIVE or INACTIVE");
  return value.toUpperCase() as CourseTypeStatus;
};

export const parseCreateCourseType = (input: InputObject): CreateCourseTypeInput => ({
  code: code(input), name: name(input), description: readOptionalString(input, "description", { maxLength: 500 }), status: status(input.status, "ACTIVE"),
});
export const parseUpdateCourseType = (input: InputObject): UpdateCourseTypeInput => {
  const update: UpdateCourseTypeInput = {};
  if (hasOwn(input, "code")) update.code = code(input);
  if (hasOwn(input, "name")) update.name = name(input);
  if (hasOwn(input, "description")) update.description = readOptionalString(input, "description", { maxLength: 500 });
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (!Object.keys(update).length) throw invalid("body", "At least one editable field is required");
  return update;
};
export const parseCourseTypeListFilters = (params: URLSearchParams, pagination: Pick<CourseTypeListFilters, "skip" | "take">): CourseTypeListFilters => {
  const search = params.get("search")?.trim() || null;
  if (search && search.length > 100) throw invalid("search", "Search must contain no more than 100 characters");
  const rawStatus = params.get("status");
  return { search, status: rawStatus ? status(rawStatus) : null, ...pagination };
};
