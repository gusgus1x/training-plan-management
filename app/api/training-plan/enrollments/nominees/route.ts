import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { listNominees } from "../../../../lib/trainingEnrollment/nomination";

type Dependencies = { auth?: ProtectedRouteOptions };

/** The employees a head may send to one batch; with no planId, only whether they may send anyone. */
export const createListNomineesHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal) => {
      const planId = request.nextUrl.searchParams.get("planId")?.trim() || null;
      if (planId !== null && !/^\d+$/.test(planId)) return apiSuccess({ canNominate: false, nominees: [] });
      return apiSuccess(await listNominees(principal, planId));
    },
    { ...dependencies.auth, allowedRoles: ["EMPLOYEE"] as const },
  );

export const GET = createListNomineesHandler();
