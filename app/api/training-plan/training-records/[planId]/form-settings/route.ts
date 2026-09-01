import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../lib/api/response";
import { readJsonObject } from "../../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../lib/auth/guard";
import { trainingFormsService, type TrainingFormsService } from "../../../../../lib/trainingForms/service";
import { parseGradedStage, parseSetStageClosed } from "../../../../../lib/trainingForms/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingFormsService };
type RouteContext = { params: Promise<{ planId: string }> };

const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createListFormSettingsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (_request: NextRequest, principal, { params }) => {
    const { planId } = await params;
    const settings = await (dependencies.service ?? trainingFormsService).listPlanStageSettings(
      planId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess({ settings });
  }, options(dependencies.auth));

export const createSetFormSettingHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (request: NextRequest, principal, { params }) => {
    const { planId } = await params;
    const body = await readJsonObject(request);
    const stage = parseGradedStage(String(body.stage ?? ""));
    const input = parseSetStageClosed(stage, body);
    const result = await (dependencies.service ?? trainingFormsService).setStageClosed(
      planId,
      input,
      principal.userId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess(result);
  }, options(dependencies.auth));

export const GET = createListFormSettingsHandler();
export const PUT = createSetFormSettingHandler();
