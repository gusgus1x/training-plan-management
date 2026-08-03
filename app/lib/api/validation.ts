import { ApiError } from "./errors";

export type InputObject = Record<string, unknown>;

const MAX_SQL_SERVER_BIGINT = BigInt("9223372036854775807");

type StringOptions = {
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
};

const invalidInput = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted data is invalid",
    status: 400,
    details: { field, reason },
  });

const isInputObject = (value: unknown): value is InputObject =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const readJsonObject = async (request: Request) => {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    throw invalidInput("body", "Content-Type must be application/json");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw invalidInput("body", "Body must contain valid JSON");
  }

  if (!isInputObject(body)) {
    throw invalidInput("body", "Body must be a JSON object");
  }

  return body;
};

const validateString = (
  field: string,
  value: unknown,
  options: StringOptions,
) => {
  if (typeof value !== "string") {
    throw invalidInput(field, "Value must be a string");
  }

  const normalized = value.trim();
  const minLength = options.minLength ?? 1;

  if (normalized.length < minLength) {
    throw invalidInput(field, `Value must contain at least ${minLength} characters`);
  }

  if (options.maxLength && normalized.length > options.maxLength) {
    throw invalidInput(
      field,
      `Value must contain no more than ${options.maxLength} characters`,
    );
  }

  if (options.pattern) {
    options.pattern.lastIndex = 0;

    if (!options.pattern.test(normalized)) {
      throw invalidInput(field, "Value has an invalid format");
    }
  }

  return normalized;
};

export const readRequiredString = (
  input: InputObject,
  field: string,
  options: StringOptions = {},
) => validateString(field, input[field], options);

export const readOptionalString = (
  input: InputObject,
  field: string,
  options: StringOptions = {},
) => {
  const value = input[field];

  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  return validateString(field, value, options);
};

export const readOptionalBoolean = (input: InputObject, field: string) => {
  const value = input[field];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw invalidInput(field, "Value must be a boolean");
  }

  return value;
};

export const readPositiveId = (value: unknown, field = "id") => {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw invalidInput(field, "Value must be a positive integer identifier");
  }

  if (BigInt(value) > MAX_SQL_SERVER_BIGINT) {
    throw invalidInput(field, "Value exceeds the supported identifier range");
  }

  return value;
};
