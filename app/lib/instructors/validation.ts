import { ApiError } from "../api/errors";
import {
  readOptionalString,
  readRequiredString,
  type InputObject,
} from "../api/validation";
import {
  INSTRUCTOR_STATUSES,
  type CreateInstructorInput,
  type InstructorListFilters,
  type InstructorStatus,
  type UpdateInstructorInput,
} from "./types";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasOwn = (input: InputObject, field: string) =>
  Object.prototype.hasOwnProperty.call(input, field);
const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted instructor data is invalid",
    status: 400,
    details: { field, reason },
  });

const code = (input: InputObject) => {
  const value = readRequiredString(input, "instructorCode", {
    maxLength: 30,
  }).toUpperCase();
  if (!CODE_PATTERN.test(value)) {
    throw invalid(
      "instructorCode",
      "Use only letters, numbers, hyphens, and underscores",
    );
  }
  return value;
};

const email = (input: InputObject) => {
  const value = readOptionalString(input, "email", { maxLength: 255 });
  if (value && !EMAIL_PATTERN.test(value)) {
    throw invalid("email", "Email address has an invalid format");
  }
  return value;
};

const status = (
  value: unknown,
  fallback?: InstructorStatus,
): InstructorStatus => {
  if (value === undefined && fallback) return fallback;
  if (
    typeof value !== "string" ||
    !INSTRUCTOR_STATUSES.includes(value.toUpperCase() as InstructorStatus)
  ) {
    throw invalid("status", "Status must be ACTIVE or INACTIVE");
  }
  return value.toUpperCase() as InstructorStatus;
};

export const parseCreateInstructor = (
  input: InputObject,
): CreateInstructorInput => ({
  instructorCode: code(input),
  firstName: readRequiredString(input, "firstName", { maxLength: 150 }),
  lastName: readRequiredString(input, "lastName", { maxLength: 150 }),
  telephone: readOptionalString(input, "telephone", { maxLength: 30 }),
  email: email(input),
  education: readOptionalString(input, "education", { maxLength: 500 }),
  university: readOptionalString(input, "university", { maxLength: 255 }),
  organizationName: readOptionalString(input, "organizationName", {
    maxLength: 255,
  }),
  status: status(input.status, "ACTIVE"),
});

export const parseUpdateInstructor = (
  input: InputObject,
): UpdateInstructorInput => {
  const update: UpdateInstructorInput = {};
  if (hasOwn(input, "instructorCode")) update.instructorCode = code(input);
  if (hasOwn(input, "firstName")) {
    update.firstName = readRequiredString(input, "firstName", {
      maxLength: 150,
    });
  }
  if (hasOwn(input, "lastName")) {
    update.lastName = readRequiredString(input, "lastName", {
      maxLength: 150,
    });
  }
  if (hasOwn(input, "telephone")) {
    update.telephone = readOptionalString(input, "telephone", {
      maxLength: 30,
    });
  }
  if (hasOwn(input, "email")) update.email = email(input);
  if (hasOwn(input, "education")) {
    update.education = readOptionalString(input, "education", {
      maxLength: 500,
    });
  }
  if (hasOwn(input, "university")) {
    update.university = readOptionalString(input, "university", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "organizationName")) {
    update.organizationName = readOptionalString(input, "organizationName", {
      maxLength: 255,
    });
  }
  if (hasOwn(input, "status")) update.status = status(input.status);
  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }
  return update;
};

export const parseInstructorListFilters = (
  params: URLSearchParams,
  pagination: Pick<InstructorListFilters, "skip" | "take">,
): InstructorListFilters => {
  const search = params.get("search")?.trim() || null;
  const rawStatus = params.get("status");
  if (search && search.length > 100) {
    throw invalid("search", "Search must contain no more than 100 characters");
  }
  return {
    search,
    status: rawStatus ? status(rawStatus) : null,
    skip: pagination.skip,
    take: pagination.take,
  };
};
