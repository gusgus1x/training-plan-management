import { ApiError } from "../api/errors";
import {
  companyRepository,
  type CompanyRepository,
} from "./repository";
import type {
  CompanyListFilters,
  CreateCompanyInput,
  UpdateCompanyInput,
} from "./types";

const companyNotFound = () =>
  new ApiError({
    code: "COMPANY_NOT_FOUND",
    message: "Company not found",
    status: 404,
  });

const companyCodeConflict = () =>
  new ApiError({
    code: "COMPANY_CODE_CONFLICT",
    message: "Company code already exists",
    status: 409,
  });

export type CompanyService = ReturnType<typeof createCompanyService>;

export const createCompanyService = (
  repository: CompanyRepository = companyRepository,
) => ({
  listCompanies(filters: CompanyListFilters) {
    return repository.list(filters);
  },

  async getCompany(companyId: string) {
    const company = await repository.findById(companyId);

    if (!company) {
      throw companyNotFound();
    }

    return company;
  },

  async createCompany(input: CreateCompanyInput) {
    if (await repository.findByCode(input.companyCode)) {
      throw companyCodeConflict();
    }

    return repository.create(input);
  },

  async updateCompany(companyId: string, input: UpdateCompanyInput) {
    if (!(await repository.findById(companyId))) {
      throw companyNotFound();
    }

    if (
      input.companyCode &&
      (await repository.findByCode(input.companyCode, companyId))
    ) {
      throw companyCodeConflict();
    }

    return repository.update(companyId, input);
  },

  async deleteCompany(companyId: string) {
    if (!(await repository.findById(companyId))) {
      throw companyNotFound();
    }

    try {
      return await repository.delete(companyId);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === "INVALID_REFERENCE") {
        throw new ApiError({
          code: "COMPANY_IN_USE",
          message: "Company cannot be deleted because it is still in use",
          status: 409,
        });
      }

      throw error;
    }
  },
});

export const companyService = createCompanyService();
