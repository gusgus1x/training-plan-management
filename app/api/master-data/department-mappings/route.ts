import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import { requireCompanyScope } from "../../../lib/auth/authorization";
import { resolveMappingCompanyId } from "../../../lib/functions/scope";
import {
  departmentService,
  type DepartmentService,
} from "../../../lib/departments/service";
import {
  parseCreateDepartmentMapping,
  parseDepartmentListFilters,
} from "../../../lib/departments/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: DepartmentService };
const options = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});

export const createListMappingsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal) => {
      const pagination = readPagination(request);
      const companyId =
        principal.role === "HRD_FACTORY" ? principal.companyId : null;
      if (principal.role === "HRD_FACTORY") {
        requireCompanyScope(principal, companyId ?? "");
      }
      const result = await (
        dependencies.service ?? departmentService
      ).listMappings({
        ...parseDepartmentListFilters(request.nextUrl.searchParams, pagination),
        companyId,
      });
      return apiSuccess({
        items: result.items,
        pagination: createPaginationMeta(
          pagination.page,
          pagination.pageSize,
          result.totalItems,
        ),
      });
    },
    options(dependencies.auth),
  );

export const createCreateMappingHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal) => {
      const input = parseCreateDepartmentMapping(await readJsonObject(request));
      const mapping = await (
        dependencies.service ?? departmentService
      ).createMapping({
        ...input,
        companyId: resolveMappingCompanyId(principal, input.companyId),
      });
      return apiSuccess({ mapping }, 201);
    },
    options(dependencies.auth),
  );

export const GET = createListMappingsHandler();
export const POST = createCreateMappingHandler();
