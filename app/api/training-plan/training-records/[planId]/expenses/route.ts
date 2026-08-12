import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../lib/api/response";
import { readJsonObject } from "../../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../lib/auth/guard";
import { trainingRecordService, type TrainingRecordService } from "../../../../../lib/trainingRecord/service";
import { parseSaveExpenses } from "../../../../../lib/trainingRecord/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingRecordService };

const writeOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createSaveTrainingRecordExpensesHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ planId: string }> }) => {
    const { planId } = await params;
    const input = parseSaveExpenses(await readJsonObject(request));
    const trainingRecord = await (dependencies.service ?? trainingRecordService).saveTrainingRecordExpenses(
      planId,
      input,
      principal.userId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    );
    return apiSuccess({ trainingRecord });
  }, writeOptions(dependencies.auth));

export const PUT = createSaveTrainingRecordExpensesHandler();
