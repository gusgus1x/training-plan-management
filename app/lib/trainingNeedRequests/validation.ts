import { ApiError } from "../api/errors";
import { readOptionalString, readRequiredString, type InputObject } from "../api/validation";
import type {
  CreateNeedRequestInput,
  NeedRequestAction,
  NeedRequestListFilters,
  NeedRequestStatus,
  UpdateNeedRequestInput,
} from "./types";

const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted training need request is invalid",
    status: 400,
    details: { field, reason },
  });

const STATUSES: readonly NeedRequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "PLANNED"];

// request_reason, review_note and rejection_reason are all NVARCHAR(1000). Refusing here beats
// letting SQL Server truncate the text the employee or the reviewer actually wrote.
const REASON_MAX_LENGTH = 1000;

// A date-only column. Anything else would be silently coerced by the driver, so it is refused here.
const isoDate = (value: string | null, field: string) => {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw invalid(field, "Date must be formatted as YYYY-MM-DD");
  }
  // Date.parse alone is not enough: it rolls 2026-02-31 forward to 3 March rather than rejecting
  // it, so the request would be filed against a day the employee never chose.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw invalid(field, "Date is not a real calendar date");
  }
  return value;
};

export const parseCreateNeedRequest = (input: InputObject): CreateNeedRequestInput => {
  const start = isoDate(readOptionalString(input, "preferredStartDate"), "preferredStartDate");
  const end = isoDate(readOptionalString(input, "preferredEndDate"), "preferredEndDate");

  if (start && end && end < start) {
    throw invalid("preferredEndDate", "The end date cannot fall before the start date");
  }

  return {
    requestedCourseName: readRequiredString(input, "requestedCourseName", { maxLength: 255 }),
    requestReason: readRequiredString(input, "requestReason", { maxLength: REASON_MAX_LENGTH }),
    preferredStartDate: start,
    preferredEndDate: end,
  };
};

const action = (value: unknown): NeedRequestAction => {
  if (typeof value !== "string" || !["approve", "reject", "reset"].includes(value)) {
    throw invalid("action", "Action must be approve, reject, or reset");
  }
  return value as NeedRequestAction;
};

export const parseUpdateNeedRequest = (input: InputObject): UpdateNeedRequestInput => {
  const parsed = {
    action: action(input.action),
    note: readOptionalString(input, "note", { maxLength: REASON_MAX_LENGTH }),
  };

  // Rejecting without saying why leaves the employee with no way to fix the request.
  if (parsed.action === "reject" && !parsed.note) {
    throw invalid("note", "A reason is required when rejecting a request");
  }

  return parsed;
};

export const parseNeedRequestListFilters = (params: URLSearchParams): NeedRequestListFilters => {
  const status = params.get("status")?.trim() || null;
  if (status !== null && !STATUSES.includes(status as NeedRequestStatus)) {
    throw invalid("status", `Status must be one of ${STATUSES.join(", ")}`);
  }

  return {
    status: status as NeedRequestStatus | null,
    employeeUserId: params.get("employeeUserId")?.trim() || null,
  };
};
