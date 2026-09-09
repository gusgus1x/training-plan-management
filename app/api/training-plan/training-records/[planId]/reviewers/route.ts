import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../lib/api/response";
import { readJsonObject } from "../../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../lib/auth/guard";
import {
  trainingRecordService,
  type TrainingRecordService,
} from "../../../../../lib/trainingRecord/service";
import { parseReviewerSearch, parseSaveReviewers } from "../../../../../lib/trainingRecord/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingRecordService };

// Choosing who evaluates an attendee is HRD's job. The supervisor being chosen is an EMPLOYEE and
// has no say in it, so both verbs are HRD-only.
const options = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});

// The candidate search sits under the plan rather than in master-data because it answers a question
// about this plan's roster, and returns only the handful of fields the picker shows - never the
// employee record itself.
export const createListReviewerCandidatesHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const search = parseReviewerSearch(request.nextUrl.searchParams);
    const candidates = await (dependencies.service ?? trainingRecordService).listReviewerCandidates(
      search,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess({ candidates });
  }, options(dependencies.auth));

export const createSaveTrainingReviewersHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal, { params }: { params: Promise<{ planId: string }> }) => {
      const { planId } = await params;
      const input = parseSaveReviewers(await readJsonObject(request));

      const trainingRecord = await (
        dependencies.service ?? trainingRecordService
      ).saveTrainingReviewers(
        planId,
        input,
        principal.userId,
        principal.role === "HRD_FACTORY" ? principal.companyId : null,
      );

      return apiSuccess({ trainingRecord });
    },
    options(dependencies.auth),
  );

export const GET = createListReviewerCandidatesHandler();
export const PUT = createSaveTrainingReviewersHandler();
