import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import {
  sectionService,
  type SectionService,
} from "../../../lib/sections/service";
import {
  parseCreateSection,
  parseSectionListFilters,
} from "../../../lib/sections/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: SectionService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});

export const createListSectionsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const pagination = readPagination(request);
      const result = await (
        dependencies.service ?? sectionService
      ).listSections(
        parseSectionListFilters(request.nextUrl.searchParams, pagination),
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

export const createCreateSectionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) =>
      apiSuccess(
        {
          section: await (
            dependencies.service ?? sectionService
          ).createSection(parseCreateSection(await readJsonObject(request))),
        },
        201,
      ),
    writeOptions(dependencies.auth),
  );

export const GET = createListSectionsHandler();
export const POST = createCreateSectionHandler();
