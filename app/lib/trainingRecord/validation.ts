import { ApiError } from "../api/errors";
import type { InputObject } from "../api/validation";
import {
  COMPLETION_STATUSES,
  type CompletionStatus,
  type SaveExpensesInput,
  type SaveResultsInput,
} from "./types";

const invalid = (field: string, reason: string) =>
  new ApiError({ code: "INVALID_INPUT", message: "The submitted expense data is invalid", status: 400, details: { field, reason } });

const readNonNegativeNumber = (input: InputObject, field: string): number => {
  const value = input[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw invalid(field, "Value must be a non-negative number");
  }
  return value;
};

export const parseSaveExpenses = (input: InputObject): SaveExpensesInput => ({
  accommodation: readNonNegativeNumber(input, "accommodation"),
  foodBeverage: readNonNegativeNumber(input, "foodBeverage"),
  instructor: readNonNegativeNumber(input, "instructor"),
  material: readNonNegativeNumber(input, "material"),
  seminarRoom: readNonNegativeNumber(input, "seminarRoom"),
  traveling: readNonNegativeNumber(input, "traveling"),
});

const invalidResult = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted training result is invalid",
    status: 400,
    details: { field, reason },
  });

// The database check constraint allows pre_score/post_score to be NULL or >= 0. A blank cell in
// the UI must arrive as null rather than 0, or "not graded" and "scored zero" become the same
// thing on a record the employee downloads as evidence.
const readOptionalScore = (value: unknown, field: string): number | null => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw invalidResult(field, "Score must be a non-negative number, or empty");
  }
  return value;
};

const readCompletionStatus = (value: unknown): CompletionStatus => {
  if (typeof value !== "string" || !COMPLETION_STATUSES.includes(value as CompletionStatus)) {
    throw invalidResult("completionStatus", `Status must be one of ${COMPLETION_STATUSES.join(", ")}`);
  }
  return value as CompletionStatus;
};

const readOptionalDate = (value: unknown, field: string): string | null => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw invalidResult(field, "Date must be formatted as YYYY-MM-DD");
  }
  // Date.parse rolls 2026-02-31 forward to 3 March instead of refusing it.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw invalidResult(field, "Date is not a real calendar date");
  }
  return value;
};

export const parseSaveResults = (input: InputObject): SaveResultsInput => {
  const rows = input.results;
  if (!Array.isArray(rows)) {
    throw invalidResult("results", "Value must be an array of results");
  }

  const seen = new Set<string>();
  const results = rows.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw invalidResult(`results[${index}]`, "Each result must be an object");
    }
    const row = raw as InputObject;
    const enrollmentId = row.enrollmentId;
    if (typeof enrollmentId !== "string" || !/^[1-9]\d*$/.test(enrollmentId)) {
      throw invalidResult(`results[${index}].enrollmentId`, "Value must be a positive identifier");
    }
    // training_result.enrollment_id is unique. Two rows for one person in the same payload would
    // make the saved result depend on which one the writer happened to apply last.
    if (seen.has(enrollmentId)) {
      throw invalidResult(`results[${index}].enrollmentId`, "The same enrollment appears twice");
    }
    seen.add(enrollmentId);

    const certificateNo =
      row.certificateNo === undefined || row.certificateNo === null || row.certificateNo === ""
        ? null
        : String(row.certificateNo).trim() || null;
    if (certificateNo && certificateNo.length > 100) {
      throw invalidResult(`results[${index}].certificateNo`, "Certificate number is too long");
    }

    return {
      enrollmentId,
      preScore: readOptionalScore(row.preScore, `results[${index}].preScore`),
      postScore: readOptionalScore(row.postScore, `results[${index}].postScore`),
      completionStatus: readCompletionStatus(row.completionStatus),
      validUntil: readOptionalDate(row.validUntil, `results[${index}].validUntil`),
      certificateNo,
    };
  });

  return { results };
};
