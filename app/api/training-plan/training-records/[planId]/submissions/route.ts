import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../lib/auth/guard";
import { trainingFormsService, type TrainingFormsService } from "../../../../../lib/trainingForms/service";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingFormsService };
type RouteContext = { params: Promise<{ planId: string }> };

const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createListPendingGradingHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (_request: NextRequest, principal, { params }) => {
    const { planId } = await params;
    const submissions = await (dependencies.service ?? trainingFormsService).listPendingGrading(
      planId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess({ submissions });
  }, options(dependencies.auth));

export const GET = createListPendingGradingHandler();
