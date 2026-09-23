import type { NextRequest } from "next/server";
import { ApiError } from "../../../../lib/api/errors";
import { apiSuccess } from "../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { getCourseCoverage } from "../../../../lib/trainingEnrollment/coverage";

type Dependencies = { auth?: ProtectedRouteOptions; getCourseCoverage?: typeof getCourseCoverage };

/**
 * Who in the caller's scope has trained on the course behind a batch. An HRD factory only ever sees
 * its own company; the center sees every company.
 */
export const createGetCourseCoverageHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal) => {
      const planId = request.nextUrl.searchParams.get("planId")?.trim() ?? "";
      if (!/^\d+$/.test(planId)) {
        throw new ApiError({ code: "BAD_REQUEST", message: "planId is required", status: 400 });
      }
      const isFactory = principal.role === "HRD_FACTORY";
      // Fail closed: a factory account without a company must not fall through to "every company".
      if (isFactory && !principal.companyId) return apiSuccess({ employees: [] });
      const employees = await (dependencies.getCourseCoverage ?? getCourseCoverage)(planId, isFactory ? principal.companyId : null);
      return apiSuccess({ employees });
    },
    { ...dependencies.auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const },
  );

export const GET = createGetCourseCoverageHandler();
