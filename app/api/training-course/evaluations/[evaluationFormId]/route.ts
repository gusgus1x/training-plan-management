import { apiSuccess } from "../../../../lib/api/response";
import { recordDeleteAudit } from "../../../../lib/audit";
import { readJsonObject, readPositiveId } from "../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { evaluationService, type EvaluationService } from "../../../../lib/evaluations/service";
import { parseEvaluationStatusInput, parseEvaluationWriteInput } from "../../../../lib/evaluations/validation";

type Context = { params: Promise<{ evaluationFormId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: EvaluationService };
const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });
const id = async (context: Context) => readPositiveId((await context.params).evaluationFormId, "evaluationFormId");

export const createGetEvaluationHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(async (request, principal, context) => {
      const entityId = await id(context);
      const payload = { evaluation: await (dependencies.service ?? evaluationService).getEvaluation(entityId, principal) };
      await recordDeleteAudit(request, principal, "evaluation", entityId);
      return apiSuccess(payload);
    }, options(dependencies.auth));

export const createUpdateEvaluationHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(async (request, principal, context) =>
    apiSuccess({ evaluation: await (dependencies.service ?? evaluationService).updateEvaluation(
      await id(context), parseEvaluationWriteInput(await readJsonObject(request)), principal,
    ) }), options(dependencies.auth));

export const createDeleteEvaluationHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(async (_request, principal, context) =>
    apiSuccess(await (dependencies.service ?? evaluationService).deleteEvaluation(await id(context), principal)), options(dependencies.auth));

/** Status-only change - the one edit a form already in use still accepts (PATCH refuses those). */
export const createSetEvaluationStatusHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(async (request, principal, context) =>
    apiSuccess({ evaluation: await (dependencies.service ?? evaluationService).setEvaluationStatus(
      await id(context), parseEvaluationStatusInput(await readJsonObject(request)), principal,
    ) }), options(dependencies.auth));

export const GET = createGetEvaluationHandler();
export const PATCH = createUpdateEvaluationHandler();
export const POST = createSetEvaluationStatusHandler();
export const DELETE = createDeleteEvaluationHandler();
