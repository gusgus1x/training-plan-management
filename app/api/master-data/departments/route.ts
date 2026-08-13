import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import {
  departmentService,
  type DepartmentService,
} from "../../../lib/departments/service";
import {
  parseCreateDepartment,
  parseDepartmentListFilters,
} from "../../../lib/departments/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: DepartmentService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});

export const createListDepartmentsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) => {
      const pagination = readPagination(request);
      const result = await (
        dependencies.service ?? departmentService
      ).listDepartments(
        parseDepartmentListFilters(request.nextUrl.searchParams, pagination),
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

export const createCreateDepartmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest) =>
      apiSuccess(
        {
          department: await (
            dependencies.service ?? departmentService
          ).createDepartment(parseCreateDepartment(await readJsonObject(request))),
        },
        201,
      ),
    writeOptions(dependencies.auth),
  );

export const GET = createListDepartmentsHandler();
export const POST = createCreateDepartmentHandler();
