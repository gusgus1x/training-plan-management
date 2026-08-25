import { ApiError } from "../api/errors";
import {
  readOptionalString,
  readPositiveId,
  readRequiredString,
  type InputObject,
} from "../api/validation";
import { ROLE_CODES, type RoleCode } from "../auth/types";
import {
  USER_ACCOUNT_STATUSES,
  type CreateUserAccountInput,
  type UpdateUserAccountInput,
  type UserAccountListFilters,
  type UserAccountStatus,
} from "./types";

// Kept in step with DEVELOPMENT_PASSWORD_MIN_LENGTH in scripts/seed-development-account.mjs, so
// a password accepted by the seed script is also accepted here. Set to 6 at the owner's request.
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 1024;

const invalid = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted account data is invalid",
    status: 400,
    details: { field, reason },
  });

const hasOwn = (input: InputObject, field: string) =>
  Object.prototype.hasOwnProperty.call(input, field);

const readRoleCode = (value: unknown, field = "roleCode"): RoleCode => {
  if (typeof value !== "string" || !ROLE_CODES.some((code) => code === value)) {
    throw invalid(field, `Role must be one of ${ROLE_CODES.join(", ")}`);
  }
  return value as RoleCode;
};

const readStatus = (value: unknown, field = "status"): UserAccountStatus => {
  if (
    typeof value !== "string" ||
    !USER_ACCOUNT_STATUSES.some((status) => status === value)
  ) {
    throw invalid(field, `Status must be one of ${USER_ACCOUNT_STATUSES.join(", ")}`);
  }
  return value as UserAccountStatus;
};

/**
 * Length is the only rule enforced here. A minimum length is the one password requirement that
 * measurably helps; composition rules mostly push people towards predictable substitutions.
 */
export const readPassword = (input: InputObject, field = "password") => {
  const value = input[field];

  if (typeof value !== "string") {
    throw invalid(field, "Password is required");
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw invalid(field, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw invalid(field, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }

  return value;
};

const readOptionalReference = (input: InputObject, field: string) => {
  const value = input[field];
  if (value === undefined || value === null || value === "") return null;
  return readPositiveId(value, field);
};

export const parseCreateUserAccount = (input: InputObject): CreateUserAccountInput => ({
  username: readRequiredString(input, "username", { maxLength: 100 }),
  password: readPassword(input),
  roleCode: readRoleCode(input.roleCode),
  companyId: readOptionalReference(input, "companyId"),
  employeeId: readOptionalReference(input, "employeeId"),
  email: readOptionalString(input, "email", { maxLength: 255 }),
  status: input.status === undefined ? "ACTIVE" : readStatus(input.status),
});

export const parseUpdateUserAccount = (input: InputObject): UpdateUserAccountInput => {
  const update: UpdateUserAccountInput = {};

  if (hasOwn(input, "roleCode")) update.roleCode = readRoleCode(input.roleCode);
  if (hasOwn(input, "companyId")) update.companyId = readOptionalReference(input, "companyId");
  if (hasOwn(input, "employeeId")) update.employeeId = readOptionalReference(input, "employeeId");
  if (hasOwn(input, "email")) update.email = readOptionalString(input, "email", { maxLength: 255 });
  if (hasOwn(input, "status")) update.status = readStatus(input.status);

  if (Object.keys(update).length === 0) {
    throw invalid("body", "At least one editable field is required");
  }

  return update;
};

export const parseUserAccountListFilters = (
  params: URLSearchParams,
): UserAccountListFilters => {
  const search = params.get("search")?.trim() || null;
  if (search && search.length > 100) {
    throw invalid("search", "Search must contain no more than 100 characters");
  }

  const status = params.get("status");
  const roleCode = params.get("roleCode");

  return {
    search,
    status: status ? readStatus(status) : null,
    roleCode: roleCode ? readRoleCode(roleCode) : null,
  };
};
