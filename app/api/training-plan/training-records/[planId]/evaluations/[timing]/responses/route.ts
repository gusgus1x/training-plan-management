import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../../../lib/auth/guard";
import { trainingFormsService, type TrainingFormsService } from "../../../../../../../lib/trainingForms/service";
import {
  parseEvaluationRespondentGroup,
  parseEvaluationTiming,
} from "../../../../../../../lib/trainingForms/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingFormsService };
type RouteContext = { params: Promise<{ planId: string; timing: string }> };

const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

/**
 * Individual evaluation replies for one plan, one paper per respondent. HRD only.
 *
 * Unlike the summary beside it, this one carries what a person said rather than how many people
 * said it. The name is dropped in the projection when the form is anonymous, so the promise the
 * employee was given holds no matter which screen reads this.
 */
export const createReadEvaluationResponsesHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (request: NextRequest, principal, { params }) => {
    const { planId, timing } = await params;
    const responses = await (dependencies.service ?? trainingFormsService).readEvaluationResponses(
      planId,
      parseEvaluationTiming(timing),
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
      parseEvaluationRespondentGroup(request.nextUrl.searchParams.get("respondents")),
    );
    return apiSuccess({ responses });
  }, options(dependencies.auth));

export const GET = createReadEvaluationResponsesHandler();
