import type { NextRequest } from "next/server";
import { ApiError } from "../../../../lib/api/errors";
import { apiSuccess } from "../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { enrollmentService, type EnrollmentService } from "../../../../lib/trainingEnrollment/service";

type Dependencies = { auth?: ProtectedRouteOptions; service?: EnrollmentService };

const allRoles = ["HRD_CENTER", "HRD_FACTORY", "EMPLOYEE"] as const;
const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: allRoles });

export const createGetCourseHistoryHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest) => {
    const planId = request.nextUrl.searchParams.get("planId");
    if (!planId) {
      throw new ApiError({
        code: "BAD_REQUEST",
        message: "planId is required",
        status: 400,
      });
    }

    const history = await (dependencies.service ?? enrollmentService).getCourseHistory(planId);
    return apiSuccess({ history });
  }, options(dependencies.auth));

export const GET = createGetCourseHistoryHandler();
