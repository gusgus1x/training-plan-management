import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../../../lib/auth/guard";
import { trainingFormsService, type TrainingFormsService } from "../../../../../../../lib/trainingForms/service";
import { parseGradedStage } from "../../../../../../../lib/trainingForms/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingFormsService };
type RouteContext = { params: Promise<{ enrollmentId: string; stage: string }> };

// Same owner-only rule as taking the test: an employee reads their own marked paper and nobody
// else's. The repository proves ownership from the enrollment, not from this route.
const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["EMPLOYEE"] as const });

export const createReadAssessmentReviewHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (_request: NextRequest, principal, { params }) => {
    const { enrollmentId, stage } = await params;
    const review = await (dependencies.service ?? trainingFormsService).readAssessmentReview(
      enrollmentId,
      parseGradedStage(stage),
      principal.employeeId,
      principal.employeeUserId,
    );
    return apiSuccess({ review });
  }, options(dependencies.auth));

export const GET = createReadAssessmentReviewHandler();
