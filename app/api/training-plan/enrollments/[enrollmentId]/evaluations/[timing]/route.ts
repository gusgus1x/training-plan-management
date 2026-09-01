import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../../lib/api/response";
import { readJsonObject } from "../../../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../../lib/auth/guard";
import { trainingFormsService, type TrainingFormsService } from "../../../../../../lib/trainingForms/service";
import { parseEvaluationTiming, parseSubmitEvaluation } from "../../../../../../lib/trainingForms/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingFormsService };
type RouteContext = { params: Promise<{ enrollmentId: string; timing: string }> };

const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["EMPLOYEE"] as const });

export const createGetEvaluationHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (_request: NextRequest, principal, { params }) => {
    const { enrollmentId, timing } = await params;
    const evaluation = await (dependencies.service ?? trainingFormsService).readEvaluation(
      enrollmentId,
      parseEvaluationTiming(timing),
      principal.employeeId,
      principal.employeeUserId,
    );
    return apiSuccess(evaluation);
  }, options(dependencies.auth));

export const createSubmitEvaluationHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (request: NextRequest, principal, { params }) => {
    const { enrollmentId, timing } = await params;
    const input = parseSubmitEvaluation(await readJsonObject(request));
    const result = await (dependencies.service ?? trainingFormsService).submitEvaluation(
      enrollmentId,
      parseEvaluationTiming(timing),
      input,
      principal.employeeId,
      principal.employeeUserId,
    );
    return apiSuccess(result, 201);
  }, options(dependencies.auth));

export const GET = createGetEvaluationHandler();
export const POST = createSubmitEvaluationHandler();
