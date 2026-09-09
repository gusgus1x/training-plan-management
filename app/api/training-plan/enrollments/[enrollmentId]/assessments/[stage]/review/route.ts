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

const parseAttemptNo = (value: string | null) => {
  const attempt = Number(value);
  return Number.isInteger(attempt) && attempt > 0 ? attempt : null;
};

export const createReadAssessmentReviewHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (request: NextRequest, principal, { params }) => {
    const { enrollmentId, stage } = await params;
    const review = await (dependencies.service ?? trainingFormsService).readAssessmentReview(
      enrollmentId,
      parseGradedStage(stage),
      principal.employeeId,
      principal.employeeUserId,
      // Which attempt to open. Anything that is not a positive whole number is treated as "not
      // asked" rather than refused: the repository falls back to the best attempt, which is what
      // the screen wants anyway.
      parseAttemptNo(request.nextUrl.searchParams.get("attempt")),
    );
    return apiSuccess({ review });
  }, options(dependencies.auth));

export const GET = createReadAssessmentReviewHandler();
