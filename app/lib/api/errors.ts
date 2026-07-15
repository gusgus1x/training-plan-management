export type ApiErrorDetails = Record<string, string | number | boolean>;

type ApiErrorOptions = {
  code: string;
  message: string;
  status: number;
  details?: ApiErrorDetails;
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ApiErrorDetails;

  constructor({ code, message, status, details }: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const normalizeApiError = (error: unknown) => {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError({
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    status: 500,
  });
};
