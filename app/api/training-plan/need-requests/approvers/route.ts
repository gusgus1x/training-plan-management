import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import {
  needRequestService,
  type NeedRequestService,
} from "../../../../lib/trainingNeedRequests/service";
import { parseReviewerSearch } from "../../../../lib/trainingRecord/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: NeedRequestService };

/**
 * Section heads an employee can name as the approver of their request: their own company only,
 * from the session, and never themselves. An empty search is the section-head list.
 */
export const createListApproversHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    if (principal.companyId === null) return apiSuccess({ candidates: [] });
    const search = parseReviewerSearch(request.nextUrl.searchParams);
    const candidates = await (dependencies.service ?? needRequestService).listApprovers(search, principal.companyId);
    return apiSuccess({
      candidates: candidates.filter((candidate) => candidate.reviewerUserId !== principal.employeeUserId),
    });
  }, { ...dependencies.auth, allowedRoles: ["EMPLOYEE"] as const });

export const GET = createListApproversHandler();
