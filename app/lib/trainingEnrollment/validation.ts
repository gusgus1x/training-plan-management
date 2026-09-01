import { ApiError } from "../api/errors";
import { readOptionalString, readRequiredString, type InputObject } from "../api/validation";
import type { CreateEnrollmentInput, EnrollmentAction, EnrollmentListFilters, EnrollmentSource, SetAttendanceInput, UpdateEnrollmentInput } from "./types";

const invalid = (field: string, reason: string) =>
  new ApiError({ code: "INVALID_INPUT", message: "The submitted enrollment data is invalid", status: 400, details: { field, reason } });

const source = (value: unknown): EnrollmentSource => {
  if (typeof value !== "string" || !["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER"].includes(value)) {
    throw invalid("source", "Source must be EMPLOYEE, HRD_FACTORY, or HRD_CENTER");
  }
  return value as EnrollmentSource;
};

const action = (value: unknown): EnrollmentAction => {
  if (typeof value !== "string" || !["approve", "reject", "cancel"].includes(value)) {
    throw invalid("action", "Action must be approve, reject, or cancel");
  }
  return value as EnrollmentAction;
};

// Both employee keys are accepted while Phase 20 runs them in parallel, but the caller must say
// which one it is sending. Guessing from the value is not an option: every user_id in the database
// is an 8-digit number, so a sniffing rule would rest on employee_id never reaching 8 digits —
// a silent assumption on an authorization-relevant identifier.
export const parseCreateEnrollment = (input: InputObject): CreateEnrollmentInput => {
  const employeeUserId = readOptionalString(input, "employeeUserId");

  return {
    planId: readRequiredString(input, "planId"),
    // employeeId stays required so no existing caller breaks during the parallel window.
    employeeId: readRequiredString(input, "employeeId"),
    employeeUserId: employeeUserId || null,
    source: source(input.source),
    // Read as sent; the route pins this to false for EMPLOYEE callers regardless of this value.
    acknowledgePrerequisite: input.acknowledgePrerequisite === true,
  };
};

// training_enrollment.reject_reason is NVARCHAR(1000). Unbounded, a long rejection reason validated
// fine and then failed in SQL Server, so HRD saw a 500 on a rejection they believed had gone through.
const REJECT_REASON_MAX_LENGTH = 1000;

export const parseUpdateEnrollment = (input: InputObject): UpdateEnrollmentInput => ({
  action: action(input.action),
  reason: readOptionalString(input, "reason", { maxLength: REJECT_REASON_MAX_LENGTH }) || undefined,
});

export const parseSetAttendance = (input: InputObject): SetAttendanceInput => {
  if (typeof input.attended !== "boolean") {
    throw invalid("attended", "Value must be a boolean");
  }
  return { attended: input.attended };
};

export const parseEnrollmentListFilters = (params: URLSearchParams): EnrollmentListFilters => ({
  planId: params.get("planId")?.trim() || null,
  employeeId: params.get("employeeId")?.trim() || null,
  employeeUserId: params.get("employeeUserId")?.trim() || null,
});
