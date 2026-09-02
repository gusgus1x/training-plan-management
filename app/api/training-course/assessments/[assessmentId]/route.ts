import { apiSuccess } from "../../../../lib/api/response";
import { recordDeleteAudit } from "../../../../lib/audit";
import { readJsonObject, readPositiveId } from "../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { assessmentService, type AssessmentService } from "../../../../lib/assessments/service";
import { parseAssessmentWriteInput } from "../../../../lib/assessments/validation";

type Context = { params: Promise<{ assessmentId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: AssessmentService };
const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });
const id = async (context: Context) => readPositiveId((await context.params).assessmentId, "assessmentId");

export const createGetAssessmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(async (request, principal, context) => {
      const entityId = await id(context);
      const payload = { assessment: await (dependencies.service ?? assessmentService).getAssessment(entityId, principal) };
      await recordDeleteAudit(request, principal, "assessment", entityId);
      return apiSuccess(payload);
    }, options(dependencies.auth));

export const createUpdateAssessmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(async (request, principal, context) =>
    apiSuccess({ assessment: await (dependencies.service ?? assessmentService).updateAssessment(
      await id(context), parseAssessmentWriteInput(await readJsonObject(request)), principal,
    ) }), options(dependencies.auth));

export const createDeleteAssessmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(async (_request, principal, context) =>
    apiSuccess(await (dependencies.service ?? assessmentService).deleteAssessment(await id(context), principal)), options(dependencies.auth));

export const GET = createGetAssessmentHandler();
export const PATCH = createUpdateAssessmentHandler();
export const DELETE = createDeleteAssessmentHandler();
