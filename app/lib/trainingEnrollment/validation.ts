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

export const parseCreateEnrollment = (input: InputObject): CreateEnrollmentInput => ({
  planId: readRequiredString(input, "planId"),
  employeeId: readRequiredString(input, "employeeId"),
  source: source(input.source),
});

export const parseUpdateEnrollment = (input: InputObject): UpdateEnrollmentInput => ({
  action: action(input.action),
  reason: readOptionalString(input, "reason") || undefined,
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
});
