import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../lib/api/response";
import { readJsonObject } from "../../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../lib/auth/guard";
import {
  trainingRecordService,
  type TrainingRecordService,
} from "../../../../../lib/trainingRecord/service";
import { parseSaveResults } from "../../../../../lib/trainingRecord/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingRecordService };

// Recording a result is HRD's job. An employee reads their own result on the record page and
// cannot write one.
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});

export const createSaveTrainingResultsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal, { params }: { params: Promise<{ planId: string }> }) => {
      const { planId } = await params;
      const input = parseSaveResults(await readJsonObject(request));

      const trainingRecord = await (
        dependencies.service ?? trainingRecordService
      ).saveTrainingResults(
        planId,
        input,
        principal.role === "HRD_FACTORY" ? principal.companyId : null,
      );

      return apiSuccess({ trainingRecord });
    },
    writeOptions(dependencies.auth),
  );

export const PUT = createSaveTrainingResultsHandler();
