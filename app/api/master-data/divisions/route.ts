import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import {
  divisionService,
  type DivisionService,
} from "../../../lib/divisions/service";
import {
  parseCreateDivision,
  parseDivisionListFilters,
} from "../../../lib/divisions/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: DivisionService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});

export const createListDivisionsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const pagination = readPagination(request);
      const result = await (
        dependencies.service ?? divisionService
      ).listDivisions(
        parseDivisionListFilters(request.nextUrl.searchParams, pagination),
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

export const createCreateDivisionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) =>
      apiSuccess(
        {
          division: await (
            dependencies.service ?? divisionService
          ).createDivision(parseCreateDivision(await readJsonObject(request))),
        },
        201,
      ),
    writeOptions(dependencies.auth),
  );

export const GET = createListDivisionsHandler();
export const POST = createCreateDivisionHandler();
