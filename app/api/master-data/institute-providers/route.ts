import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import {
  instituteProviderService,
  type InstituteProviderService,
} from "../../../lib/instituteProviders/service";
import {
  parseCreateInstituteProvider,
  parseInstituteProviderListFilters,
} from "../../../lib/instituteProviders/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: InstituteProviderService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});

export const createListInstituteProvidersHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const pagination = readPagination(request);
      const result = await (
        dependencies.service ?? instituteProviderService
      ).listInstituteProviders(
        parseInstituteProviderListFilters(request.nextUrl.searchParams, pagination),
      );
      return apiSuccess({
        items: result.items,
        pagination: createPaginationMeta(
          pagination.page,
          pagination.pageSize,
          result.totalItems,
        ),
      });
    },
    readOptions(dependencies.auth),
  );

export const createCreateInstituteProviderHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) =>
      apiSuccess(
        {
          instituteProvider: await (
            dependencies.service ?? instituteProviderService
          ).createInstituteProvider(
            parseCreateInstituteProvider(await readJsonObject(request)),
          ),
        },
        201,
      ),
    writeOptions(dependencies.auth),
  );

export const GET = createListInstituteProvidersHandler();
export const POST = createCreateInstituteProviderHandler();
