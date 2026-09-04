import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import {
  companyService,
  type CompanyService,
} from "../../../lib/companies/service";
import {
  parseCompanyListFilters,
  parseCreateCompanyInput,
} from "../../../lib/companies/validation";

type CompanyCollectionDependencies = {
  auth?: ProtectedRouteOptions;
  service?: CompanyService;
};

const protectedOptions = (auth: ProtectedRouteOptions | undefined) => ({
  ...auth,
  allowedRoles: ["ADMIN", "HRD_CENTER", "HRD_FACTORY"] as const,
});

const centerOnlyOptions = (auth: ProtectedRouteOptions | undefined) => ({
  ...auth,
  allowedRoles: ["ADMIN", "HRD_CENTER"] as const,
});

export const createListCompaniesHandler = (
  dependencies: CompanyCollectionDependencies = {},
) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const pagination = readPagination(request);
      const filters = parseCompanyListFilters(
        request.nextUrl.searchParams,
        pagination,
      );
      const result = await (
        dependencies.service ?? companyService
      ).listCompanies(filters);

      return apiSuccess({
        items: result.items,
        pagination: createPaginationMeta(
          pagination.page,
          pagination.pageSize,
          result.totalItems,
        ),
      });
    },
    protectedOptions(dependencies.auth),
  );

export const createCreateCompanyHandler = (
  dependencies: CompanyCollectionDependencies = {},
) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const input = parseCreateCompanyInput(await readJsonObject(request));
      const company = await (
        dependencies.service ?? companyService
      ).createCompany(input);

      return apiSuccess({ company }, 201);
    },
    centerOnlyOptions(dependencies.auth),
  );

export const GET = createListCompaniesHandler();
export const POST = createCreateCompanyHandler();
