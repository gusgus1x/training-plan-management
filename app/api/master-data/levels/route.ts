import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import { levelService, type LevelService } from "../../../lib/levels/service";
import {
  parseCreateLevel,
  parseLevelListFilters,
} from "../../../lib/levels/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: LevelService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});

export const createListLevelsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const pagination = readPagination(request);
      const result = await (
        dependencies.service ?? levelService
      ).listLevels(
        parseLevelListFilters(request.nextUrl.searchParams, pagination),
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
export const createCreateLevelHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) =>
      apiSuccess(
        {
          level: await (
            dependencies.service ?? levelService
          ).createLevel(parseCreateLevel(await readJsonObject(request))),
        },
        201,
      ),
    writeOptions(dependencies.auth),
  );

export const GET = createListLevelsHandler();
export const POST = createCreateLevelHandler();
