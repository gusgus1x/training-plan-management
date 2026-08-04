import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import {
  instructorService,
  type InstructorService,
} from "../../../lib/instructors/service";
import {
  parseCreateInstructor,
  parseInstructorListFilters,
} from "../../../lib/instructors/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: InstructorService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});

export const createListInstructorsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const pagination = readPagination(request);
      const result = await (
        dependencies.service ?? instructorService
      ).listInstructors(
        parseInstructorListFilters(request.nextUrl.searchParams, pagination),
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

export const createCreateInstructorHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) =>
      apiSuccess(
        {
          instructor: await (
            dependencies.service ?? instructorService
          ).createInstructor(
            parseCreateInstructor(await readJsonObject(request)),
          ),
        },
        201,
      ),
    writeOptions(dependencies.auth),
  );

export const GET = createListInstructorsHandler();
export const POST = createCreateInstructorHandler();
