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

// Match training_plan's column widths. Without these the value reached SQL Server unchecked and
// came back as a truncation error naming neither the field nor the limit.
const BATCH_NAME_MAX_LENGTH = 100;
const VENUE_MAX_LENGTH = 500;

export const parseCreateRollingPlan = (input: InputObject): CreateRollingPlanInput => ({
  oapPlanId: readRequiredString(input, "oapPlanId"),
  batchName: readOptionalString(input, "batchName", { maxLength: BATCH_NAME_MAX_LENGTH }),
  venue: readOptionalString(input, "venue", { maxLength: VENUE_MAX_LENGTH }) || "",
  trainingDate: readDate(input, "trainingDate"),
  endDate: hasOwn(input, "endDate") && input.endDate ? readDate(input, "endDate") : readDate(input, "trainingDate"),
  startTime: readTime(input, "startTime"),
  endTime: readTime(input, "endTime"),
  status: status(input.status, "Planning"),
  ...(hasOwn(input, "formOverrides") ? { formOverrides: formOverrides(input.formOverrides) } : {}),
});

export const parseUpdateRollingPlan = (input: InputObject): UpdateRollingPlanInput => {
  const update: UpdateRollingPlanInput = {};
  if (hasOwn(input, "oapPlanId")) update.oapPlanId = readRequiredString(input, "oapPlanId");
  if (hasOwn(input, "batchName")) update.batchName = readOptionalString(input, "batchName", { maxLength: BATCH_NAME_MAX_LENGTH });
  if (hasOwn(input, "venue")) update.venue = readOptionalString(input, "venue", { maxLength: VENUE_MAX_LENGTH }) || "";
  if (hasOwn(input, "trainingDate")) update.trainingDate = readDate(input, "trainingDate");
  if (hasOwn(input, "endDate")) update.endDate = readDate(input, "endDate");
  if (hasOwn(input, "startTime")) update.startTime = readTime(input, "startTime");
  if (hasOwn(input, "endTime")) update.endTime = readTime(input, "endTime");
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (hasOwn(input, "formOverrides")) update.formOverrides = formOverrides(input.formOverrides);

  if (!Object.keys(update).length) throw invalid("body", "At least one editable field is required");
  return update;
};

/** Each id is either a numeric string or "" (clear back to the course's form). Only the four known
 *  keys are read, so nothing else can ride along into the update. */
const formOverrides = (value: unknown): UpdateRollingPlanInput["formOverrides"] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("formOverrides", "formOverrides must be an object");
  }
  const raw = value as Record<string, unknown>;
  const parsed: NonNullable<UpdateRollingPlanInput["formOverrides"]> = {};
  const idKeys = ["preAssessmentId", "postAssessmentId", "evaluationFormId", "evaluationFormAfter30DayId"] as const;
  for (const key of idKeys) {
    if (!hasOwn(raw, key)) continue;
    const entry = raw[key];
    if (entry === null || entry === "") {
      parsed[key] = "";
      continue;
    }
    if (typeof entry !== "string" || !/^\d+$/.test(entry.trim())) {
      throw invalid(`formOverrides.${key}`, "Must be a numeric id or an empty string");
    }
    parsed[key] = entry.trim();
  }

  const linkKeys = ["preTestLink", "postTestLink", "evaluationLink", "evaluationAfter30DayLink"] as const;
  for (const key of linkKeys) {
    if (!hasOwn(raw, key)) continue;
    const entry = raw[key];
    if (entry === null || entry === "") {
      parsed[key] = "";
      continue;
    }
    if (typeof entry !== "string") throw invalid(`formOverrides.${key}`, "Must be a URL or an empty string");
    const trimmed = entry.trim();
    if (trimmed.length > FORM_LINK_MAX_LENGTH) {
      throw invalid(`formOverrides.${key}`, `Must contain no more than ${FORM_LINK_MAX_LENGTH} characters`);
    }
    // http/https only: an employee clicks this straight from their record, so a javascript: or
    // data: URL here would be a stored redirect aimed at them.
    if (!/^https?:\/\//i.test(trimmed)) {
      throw invalid(`formOverrides.${key}`, "Must start with http:// or https://");
    }
    parsed[key] = trimmed;
  }

  if (!Object.keys(parsed).length) throw invalid("formOverrides", "At least one form must be given");
  return parsed;
};

const FORM_LINK_MAX_LENGTH = 2048;

export const parseRollingPlanListFilters = (params: URLSearchParams): RollingPlanListFilters => {
  const search = params.get("search")?.trim() || null;
  if (search && search.length > 100) throw invalid("search", "Search must contain no more than 100 characters");
  const rawStatus = params.get("status");
  const oapPlanId = params.get("oapPlanId")?.trim() || null;
  return { search, status: rawStatus ? status(rawStatus) : null, oapPlanId };
};
