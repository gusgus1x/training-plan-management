import { ApiError } from "../api/errors";
import { readOptionalString, readRequiredString, type InputObject } from "../api/validation";
import type { CreateOapPlanInput, OapPlanListFilters, OapPlanStatus, UpdateOapPlanInput } from "./types";

const invalid = (field: string, reason: string) =>
  new ApiError({ code: "INVALID_INPUT", message: "The submitted OAP plan data is invalid", status: 400, details: { field, reason } });

const hasOwn = (input: InputObject, field: string) => Object.prototype.hasOwnProperty.call(input, field);

const readNumber = (input: InputObject, field: string, { required = false } = {}): number => {
  const value = input[field];
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (isNaN(num) || num < 0) {
    if (required) throw invalid(field, "Value must be a non-negative number");
    return 0;
  }
  return num;
};

const status = (value: unknown, fallback?: OapPlanStatus): OapPlanStatus => {
  if (value === undefined && fallback) return fallback;
  if (typeof value !== "string" || !["Planning", "Planned", "Cancel"].includes(value)) {
    throw invalid("status", "Status must be Planning, Planned, or Cancel");
  }
  return value as OapPlanStatus;
};

const cleanBudgetString = (val: unknown): string => {
  if (typeof val === "number") return isNaN(val) ? "0" : String(val);
  if (typeof val === "string") return val.replace(/,/g, "").trim() || "0";
  return "0";
};

export const parseCreateOapPlan = (input: InputObject): CreateOapPlanInput => ({
  courseId: readRequiredString(input, "courseId"),
  planYear: readNumber(input, "planYear") || new Date().getFullYear(),
  participants: readNumber(input, "participants", { required: true }),
  hours: readNumber(input, "hours", { required: true }),
  budget: cleanBudgetString(input.budget),
  budgetInstructor: cleanBudgetString(input.budgetInstructor),
  budgetTraveling: cleanBudgetString(input.budgetTraveling),
  budgetSeminarRoom: cleanBudgetString(input.budgetSeminarRoom),
  budgetAccommodation: cleanBudgetString(input.budgetAccommodation),
  budgetMaterial: cleanBudgetString(input.budgetMaterial),
  budgetFoodBeverage: cleanBudgetString(input.budgetFoodBeverage),
  trainerName: readOptionalString(input, "trainerName") || "",
  instructorId: readOptionalString(input, "instructorId"),
  providerName: readOptionalString(input, "providerName") || "",
  providerId: readOptionalString(input, "providerId"),
  status: status(input.status, "Planning"),
});

export const parseUpdateOapPlan = (input: InputObject): UpdateOapPlanInput => {
  const update: UpdateOapPlanInput = {};
  if (hasOwn(input, "courseId")) update.courseId = readRequiredString(input, "courseId");
  if (hasOwn(input, "planYear")) update.planYear = readNumber(input, "planYear") || new Date().getFullYear();
  if (hasOwn(input, "participants")) update.participants = readNumber(input, "participants", { required: true });
  if (hasOwn(input, "hours")) update.hours = readNumber(input, "hours", { required: true });
  if (hasOwn(input, "budget")) update.budget = cleanBudgetString(input.budget);
  if (hasOwn(input, "budgetInstructor")) update.budgetInstructor = cleanBudgetString(input.budgetInstructor);
  if (hasOwn(input, "budgetTraveling")) update.budgetTraveling = cleanBudgetString(input.budgetTraveling);
  if (hasOwn(input, "budgetSeminarRoom")) update.budgetSeminarRoom = cleanBudgetString(input.budgetSeminarRoom);
  if (hasOwn(input, "budgetAccommodation")) update.budgetAccommodation = cleanBudgetString(input.budgetAccommodation);
  if (hasOwn(input, "budgetMaterial")) update.budgetMaterial = cleanBudgetString(input.budgetMaterial);
  if (hasOwn(input, "budgetFoodBeverage")) update.budgetFoodBeverage = cleanBudgetString(input.budgetFoodBeverage);
  if (hasOwn(input, "trainerName")) update.trainerName = readOptionalString(input, "trainerName") || "";
  if (hasOwn(input, "instructorId")) update.instructorId = readOptionalString(input, "instructorId");
  if (hasOwn(input, "providerName")) update.providerName = readOptionalString(input, "providerName") || "";
  if (hasOwn(input, "providerId")) update.providerId = readOptionalString(input, "providerId");
  if (hasOwn(input, "status")) update.status = status(input.status);

  if (!Object.keys(update).length) throw invalid("body", "At least one editable field is required");
  return update;
};

export const parseOapPlanListFilters = (params: URLSearchParams): OapPlanListFilters => {
  const search = params.get("search")?.trim() || null;
  if (search && search.length > 100) throw invalid("search", "Search must contain no more than 100 characters");
  const rawStatus = params.get("status");
  return { search, status: rawStatus ? status(rawStatus) : null };
};
