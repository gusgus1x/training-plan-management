import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../../lib/api/response";
import { readJsonObject } from "../../../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../../lib/auth/guard";
import { trainingFormsService, type TrainingFormsService } from "../../../../../../lib/trainingForms/service";
import { parseGradeSubmission } from "../../../../../../lib/trainingForms/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingFormsService };
type RouteContext = { params: Promise<{ planId: string; submissionId: string }> };

const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createGradeSubmissionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (request: NextRequest, principal, { params }) => {
    const { submissionId } = await params;
    const input = parseGradeSubmission(await readJsonObject(request));
    const result = await (dependencies.service ?? trainingFormsService).gradeSubmission(
      submissionId,
      input,
      principal.userId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess(result);
  }, options(dependencies.auth));

export const PUT = createGradeSubmissionHandler();

/** Releasing a graded result to the employee. Separate verb from PUT because grading and releasing
 *  are separate decisions - HRD can finish marking a batch before any score goes out. */
export const createPublishSubmissionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (_request: NextRequest, principal, { params }) => {
    const { submissionId } = await params;
    const result = await (dependencies.service ?? trainingFormsService).publishSubmissionResults(
      submissionId,
      principal.userId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess(result);
  }, options(dependencies.auth));

export const POST = createPublishSubmissionHandler();
