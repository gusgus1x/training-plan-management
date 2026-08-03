import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import {
  positionService,
  type PositionService,
} from "../../../lib/positions/service";
import {
  parseCreatePosition,
  parsePositionListFilters,
} from "../../../lib/positions/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: PositionService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});

export const createListPositionsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const pagination = readPagination(request);
      const result = await (
        dependencies.service ?? positionService
      ).listPositions(
        parsePositionListFilters(request.nextUrl.searchParams, pagination),
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

export const createCreatePositionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) =>
      apiSuccess(
        {
          position: await (
            dependencies.service ?? positionService
          ).createPosition(parseCreatePosition(await readJsonObject(request))),
        },
        201,
      ),
    writeOptions(dependencies.auth),
  );

export const GET = createListPositionsHandler();
export const POST = createCreatePositionHandler();
