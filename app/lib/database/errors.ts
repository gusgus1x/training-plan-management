import { ApiError } from "../api/errors";

const knownInputErrorCodes = new Set([
  "P2000",
  "P2005",
  "P2006",
  "P2011",
  "P2012",
  "P2019",
  "P2020",
]);

const unavailableErrorCodes = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
]);

const readPrismaErrorCode = (error: unknown) => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : null;
};

export const translateDatabaseError = (error: unknown): ApiError | null => {
  const code = readPrismaErrorCode(error);

  if (code === "P2002") {
    return new ApiError({
      code: "RESOURCE_CONFLICT",
      message: "A record with the same unique value already exists",
      status: 409,
    });
  }

  if (code === "P2003" || code === "P2014") {
    return new ApiError({
      code: "INVALID_REFERENCE",
      message: "The referenced record is invalid or still in use",
      status: 409,
    });
  }

  if (code === "P2025") {
    return new ApiError({
      code: "RESOURCE_NOT_FOUND",
      message: "The requested record was not found",
      status: 404,
    });
  }

  if (code && knownInputErrorCodes.has(code)) {
    return new ApiError({
      code: "INVALID_INPUT",
      message: "The submitted data is invalid",
      status: 400,
    });
  }

  if (code && unavailableErrorCodes.has(code)) {
    return new ApiError({
      code: "DATABASE_UNAVAILABLE",
      message: "Database unavailable",
      status: 503,
    });
  }

  return null;
};

export const withDatabaseErrorMapping = async <Result>(
  operation: () => Promise<Result>,
) => {
  try {
    return await operation();
  } catch (error: unknown) {
    throw translateDatabaseError(error) ?? error;
  }
};
