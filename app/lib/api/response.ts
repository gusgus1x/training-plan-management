import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeApiError } from "./errors";

type ApiSuccessBody<T> = {
  ok: true;
  data: T;
};

type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, string | number | boolean>;
  };
};

const serializeApiData = (value: unknown): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    value &&
    typeof value === "object" &&
    "toJSON" in value &&
    typeof value.toJSON === "function"
  ) {
    return serializeApiData(value.toJSON());
  }

  if (Array.isArray(value)) {
    return value.map(serializeApiData);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        serializeApiData(nestedValue),
      ]),
    );
  }

  return value;
};

export const apiSuccess = <T>(data: T, status = 200) =>
  NextResponse.json<ApiSuccessBody<T>>(
    {
      ok: true,
      data: serializeApiData(data) as T,
    },
    { status },
  );

export const apiFailure = (
  error: unknown,
  requestId: string = randomUUID(),
) => {
  const normalizedError = normalizeApiError(error);

  return NextResponse.json<ApiErrorBody>(
    {
      ok: false,
      error: {
        code: normalizedError.code,
        message: normalizedError.message,
        requestId,
        ...(normalizedError.details
          ? { details: normalizedError.details }
          : {}),
      },
    },
    { status: normalizedError.status },
  );
};
