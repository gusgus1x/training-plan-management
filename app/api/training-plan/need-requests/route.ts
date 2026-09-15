import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { ApiError } from "../../../lib/api/errors";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import {
  actorOf,
  needRequestService,
  type NeedRequestService,
} from "../../../lib/trainingNeedRequests/service";
import {
  parseBulkNeedRequest,
  parseCreateNeedRequest,
  parseNeedRequestListFilters,
  parseNeedRequestView,
} from "../../../lib/trainingNeedRequests/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: NeedRequestService };

const allRoles = ["HRD_CENTER", "HRD_FACTORY", "EMPLOYEE"] as const;
const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: allRoles });

export const createListNeedRequestsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const filters = parseNeedRequestListFilters(request.nextUrl.searchParams);

    if (principal.role === "EMPLOYEE") {
      // Fail closed, the same way the enrollment list does: a null filter means "no filter" in the
      // repository, so an account with no employee link would otherwise receive every request.
      if (principal.employeeUserId === null) {
        return apiSuccess({ needRequests: [] });
      }
      // An employee reads either their own requests or the ones waiting on them as a head - both
      // keyed to the session, never to the query string.
      if (parseNeedRequestView(request.nextUrl.searchParams) === "approvals") {
        filters.employeeUserId = null;
        filters.approverUserId = principal.employeeUserId;
      } else {
        filters.employeeUserId = principal.employeeUserId;
      }
    }

    const needRequests = await (dependencies.service ?? needRequestService).listNeedRequests(
      filters,
      actorOf(principal),
    );
    return apiSuccess({ needRequests });
  }, options(dependencies.auth));

export const createCreateNeedRequestHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    if (principal.role !== "EMPLOYEE") {
      throw new ApiError({
        code: "FORBIDDEN",
        message: "Only an employee can raise their own training need",
        status: 403,
      });
    }
    // The request is filed against the signed-in employee, never against an id from the body.
    if (principal.employeeUserId === null) {
      throw new ApiError({
        code: "EMPLOYEE_NOT_LINKED",
        message: "This account is not linked to an employee record",
        status: 409,
      });
    }

    const input = parseCreateNeedRequest(await readJsonObject(request));
    const needRequest = await (dependencies.service ?? needRequestService).createNeedRequest(
      input,
      principal.employeeUserId,
    );
    return apiSuccess({ needRequest }, 201);
  }, options(dependencies.auth));

/** HRD approving or rejecting a selection in one go. */
export const createBulkNeedRequestHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const input = parseBulkNeedRequest(await readJsonObject(request));
    const needRequests = await (dependencies.service ?? needRequestService).bulkDecide(input, actorOf(principal));
    return apiSuccess({ needRequests });
  }, { ...dependencies.auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const GET = createListNeedRequestsHandler();
export const POST = createCreateNeedRequestHandler();
export const PUT = createBulkNeedRequestHandler();
