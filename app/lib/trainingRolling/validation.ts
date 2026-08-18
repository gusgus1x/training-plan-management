import { ApiError } from "../api/errors";
import { readOptionalString, readRequiredString, type InputObject } from "../api/validation";
import type { CreateRollingPlanInput, RollingPlanListFilters, RollingPlanStatus, UpdateRollingPlanInput } from "./types";

const invalid = (field: string, reason: string) =>
  new ApiError({ code: "INVALID_INPUT", message: "The submitted rolling plan data is invalid", status: 400, details: { field, reason } });

const hasOwn = (input: InputObject, field: string) => Object.prototype.hasOwnProperty.call(input, field);

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const readTime = (input: InputObject, field: string): string => {
  const value = readRequiredString(input, field);
  if (!TIME_PATTERN.test(value)) throw invalid(field, "Value must be a HH:mm time");
  return value;
};

const readDate = (input: InputObject, field: string): string => {
  const value = readRequiredString(input, field);
  if (!DATE_PATTERN.test(value)) throw invalid(field, "Value must be a YYYY-MM-DD date");
  return value;
};

const status = (value: unknown, fallback?: RollingPlanStatus): RollingPlanStatus => {
  if (value === undefined && fallback) return fallback;
  if (typeof value !== "string" || !["Planning", "Planned", "Cancel"].includes(value)) {
    throw invalid("status", "Status must be Planning, Planned, or Cancel");
  }
  return value as RollingPlanStatus;
};

export const parseCreateRollingPlan = (input: InputObject): CreateRollingPlanInput => ({
  oapPlanId: readRequiredString(input, "oapPlanId"),
  batchName: readOptionalString(input, "batchName"),
  venue: readOptionalString(input, "venue") || "",
  trainingDate: readDate(input, "trainingDate"),
  endDate: hasOwn(input, "endDate") && input.endDate ? readDate(input, "endDate") : readDate(input, "trainingDate"),
  startTime: readTime(input, "startTime"),
  endTime: readTime(input, "endTime"),
  status: status(input.status, "Planning"),
});

export const parseUpdateRollingPlan = (input: InputObject): UpdateRollingPlanInput => {
  const update: UpdateRollingPlanInput = {};
  if (hasOwn(input, "oapPlanId")) update.oapPlanId = readRequiredString(input, "oapPlanId");
  if (hasOwn(input, "batchName")) update.batchName = readOptionalString(input, "batchName");
  if (hasOwn(input, "venue")) update.venue = readOptionalString(input, "venue") || "";
  if (hasOwn(input, "trainingDate")) update.trainingDate = readDate(input, "trainingDate");
  if (hasOwn(input, "endDate")) update.endDate = readDate(input, "endDate");
  if (hasOwn(input, "startTime")) update.startTime = readTime(input, "startTime");
  if (hasOwn(input, "endTime")) update.endTime = readTime(input, "endTime");
  if (hasOwn(input, "status")) update.status = status(input.status);

  if (!Object.keys(update).length) throw invalid("body", "At least one editable field is required");
  return update;
};

export const parseRollingPlanListFilters = (params: URLSearchParams): RollingPlanListFilters => {
  const search = params.get("search")?.trim() || null;
  if (search && search.length > 100) throw invalid("search", "Search must contain no more than 100 characters");
  const rawStatus = params.get("status");
  const oapPlanId = params.get("oapPlanId")?.trim() || null;
  return { search, status: rawStatus ? status(rawStatus) : null, oapPlanId };
};
