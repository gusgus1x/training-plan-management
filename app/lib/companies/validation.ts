import { ApiError } from "../api/errors";
import {
  readOptionalString,
  readRequiredString,
  type InputObject,
} from "../api/validation";
import {
  COMPANY_STATUSES,
  type CompanyListFilters,
  type CompanyStatus,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from "./types";

const COMPANY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

const invalidCompanyInput = (field: string, reason: string) =>
  new ApiError({
    code: "INVALID_INPUT",
    message: "The submitted company data is invalid",
    status: 400,
    details: { field, reason },
  });

const hasOwn = (input: InputObject, field: string) =>
  Object.prototype.hasOwnProperty.call(input, field);

const readCompanyCode = (input: InputObject) => {
  const companyCode = readRequiredString(input, "companyCode", {
    maxLength: 30,
  }).toUpperCase();

  if (!COMPANY_CODE_PATTERN.test(companyCode)) {
    throw invalidCompanyInput(
      "companyCode",
      "Use only letters, numbers, hyphens, and underscores",
    );
  }

  return companyCode;
};

const readCompanyStatus = (
  value: unknown,
  fallback?: CompanyStatus,
): CompanyStatus => {
  if (value === undefined && fallback) {
    return fallback;
  }

  if (
    typeof value !== "string" ||
    !COMPANY_STATUSES.includes(value.toUpperCase() as CompanyStatus)
  ) {
    throw invalidCompanyInput("status", "Status must be ACTIVE or INACTIVE");
  }

  return value.toUpperCase() as CompanyStatus;
};

export const parseCreateCompanyInput = (
  input: InputObject,
): CreateCompanyInput => ({
  companyCode: readCompanyCode(input),
  companyNameTh: readRequiredString(input, "companyNameTh", {
    maxLength: 255,
  }),
  companyNameEn: readOptionalString(input, "companyNameEn", {
    maxLength: 255,
  }),
  remark: readOptionalString(input, "remark", { maxLength: 500 }),
  status: readCompanyStatus(input.status, "ACTIVE"),
});

export const parseUpdateCompanyInput = (
  input: InputObject,
): UpdateCompanyInput => {
  const update: UpdateCompanyInput = {};

  if (hasOwn(input, "companyCode")) {
    update.companyCode = readCompanyCode(input);
  }

  if (hasOwn(input, "companyNameTh")) {
    update.companyNameTh = readRequiredString(input, "companyNameTh", {
      maxLength: 255,
    });
  }

  if (hasOwn(input, "companyNameEn")) {
    update.companyNameEn = readOptionalString(input, "companyNameEn", {
      maxLength: 255,
    });
  }

  if (hasOwn(input, "remark")) {
    update.remark = readOptionalString(input, "remark", { maxLength: 500 });
  }

  if (hasOwn(input, "status")) {
    update.status = readCompanyStatus(input.status);
  }

  if (Object.keys(update).length === 0) {
    throw invalidCompanyInput("body", "At least one company field is required");
  }

  return update;
};

export const parseCompanyListFilters = (
  searchParams: URLSearchParams,
  pagination: Pick<CompanyListFilters, "skip" | "take">,
): CompanyListFilters => {
  const rawSearch = searchParams.get("search");
  const rawStatus = searchParams.get("status");
  const search = rawSearch?.trim() || null;

  if (search && search.length > 100) {
    throw invalidCompanyInput(
      "search",
      "Search must contain no more than 100 characters",
    );
  }

  return {
    search,
    status: rawStatus ? readCompanyStatus(rawStatus) : null,
    skip: pagination.skip,
    take: pagination.take,
  };
};
