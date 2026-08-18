import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../lib/auth/guard";
import { trainingRecordService, type TrainingRecordService } from "../../../../../lib/trainingRecord/service";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingRecordService };

const readOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createGetCostBreakdownHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ planId: string }> }) => {
    const { planId } = await params;
    const costBreakdown = await (dependencies.service ?? trainingRecordService).getCostBreakdown(planId, principal);
    return apiSuccess({ costBreakdown });
  }, readOptions(dependencies.auth));

export const GET = createGetCostBreakdownHandler();
