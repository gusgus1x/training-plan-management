import { apiSuccess } from "../../../../../lib/api/response";
import { readJsonObject, readPositiveId } from "../../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../lib/auth/guard";
import { assessmentService, type AssessmentService } from "../../../../../lib/assessments/service";
import { parseAssessmentWriteInput } from "../../../../../lib/assessments/validation";

type Context = { params: Promise<{ assessmentId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: AssessmentService };
const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createAssessmentVersionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(async (request, principal, context) => {
    const assessmentId = readPositiveId((await context.params).assessmentId, "assessmentId");
    const assessment = await (dependencies.service ?? assessmentService).createAssessmentVersion(
      assessmentId,
      parseAssessmentWriteInput(await readJsonObject(request)),
      principal,
    );
    return apiSuccess({ assessment }, 201);
  }, options(dependencies.auth));

export const POST = createAssessmentVersionHandler();
