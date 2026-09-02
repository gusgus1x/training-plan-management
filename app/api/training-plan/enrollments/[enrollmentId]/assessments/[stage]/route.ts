import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../../lib/api/response";
import { readJsonObject } from "../../../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../../lib/auth/guard";
import { trainingFormsService, type TrainingFormsService } from "../../../../../../lib/trainingForms/service";
import { parseGradedStage, parseSubmitAssessment } from "../../../../../../lib/trainingForms/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingFormsService };
type RouteContext = { params: Promise<{ enrollmentId: string; stage: string }> };

// Only the employee who owns the enrollment ever takes their own pre/post test - HRD's view of
// submissions goes through the separate training-records/[planId]/submissions endpoints instead.
const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["EMPLOYEE"] as const });

export const createGetAssessmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (_request: NextRequest, principal, { params }) => {
    const { enrollmentId, stage } = await params;
    const assessment = await (dependencies.service ?? trainingFormsService).readAssessment(
      enrollmentId,
      parseGradedStage(stage),
      principal.employeeId,
      principal.employeeUserId,
    );
    return apiSuccess(assessment);
  }, options(dependencies.auth));

export const createSubmitAssessmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (request: NextRequest, principal, { params }) => {
    const { enrollmentId, stage } = await params;
    const input = parseSubmitAssessment(await readJsonObject(request));
    const submission = await (dependencies.service ?? trainingFormsService).submitAssessment(
      enrollmentId,
      parseGradedStage(stage),
      input,
      principal.employeeId,
      principal.employeeUserId,
    );
    return apiSuccess(submission, 201);
  }, options(dependencies.auth));

export const GET = createGetAssessmentHandler();
export const POST = createSubmitAssessmentHandler();
