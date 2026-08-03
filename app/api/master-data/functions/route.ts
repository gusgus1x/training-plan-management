import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import {
  functionService,
  type FunctionService,
} from "../../../lib/functions/service";
import {
  parseCreateOrganizationFunction,
  parseFunctionListFilters,
} from "../../../lib/functions/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: FunctionService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});

export const createListFunctionsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const pagination = readPagination(request);
      const result = await (
        dependencies.service ?? functionService
      ).listFunctions(
        parseFunctionListFilters(request.nextUrl.searchParams, pagination),
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

export const createCreateFunctionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const record = await (
        dependencies.service ?? functionService
      ).createFunction(
        parseCreateOrganizationFunction(await readJsonObject(request)),
      );
      return apiSuccess({ function: record }, 201);
    },
    writeOptions(dependencies.auth),
  );

export const GET = createListFunctionsHandler();
export const POST = createCreateFunctionHandler();
