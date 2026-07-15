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

export const apiSuccess = <T>(data: T, status = 200) =>
  NextResponse.json<ApiSuccessBody<T>>(
    {
      ok: true,
      data,
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
