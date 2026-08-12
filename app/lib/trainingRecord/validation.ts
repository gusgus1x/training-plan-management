import { ApiError } from "../api/errors";
import type { InputObject } from "../api/validation";
import type { SaveExpensesInput } from "./types";

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
