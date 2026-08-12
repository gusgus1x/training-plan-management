import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { trainingRecordService, type TrainingRecordService } from "../../../lib/trainingRecord/service";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingRecordService };

const readOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createListTrainingRecordsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const trainingRecords = await (dependencies.service ?? trainingRecordService).listTrainingRecords(
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    );
    return apiSuccess({ trainingRecords });
  }, readOptions(dependencies.auth));

export const GET = createListTrainingRecordsHandler();
