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
 * Section heads an employee can name as the approver of their request, never themselves. An empty
 * search is the section-head list.
 *
 * TEMPORARY (asked for on 2026-09-17): every company's section heads are listed, not just the
 * employee's own. Pass `principal.companyId` here again, and restore the company check in
 * `repository.create`, to put the own-company rule back.
 */
export const createListApproversHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const search = parseReviewerSearch(request.nextUrl.searchParams);
    const candidates = await (dependencies.service ?? needRequestService).listApprovers(search, null);
    return apiSuccess({
      candidates: candidates.filter((candidate) => candidate.reviewerUserId !== principal.employeeUserId),
    });
  }, { ...dependencies.auth, allowedRoles: ["EMPLOYEE"] as const });

export const GET = createListApproversHandler();
