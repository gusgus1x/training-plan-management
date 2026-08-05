import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { evaluationService, type EvaluationService } from "../../../lib/evaluations/service";
import { parseCreateEvaluationWriteInput, parseEvaluationListFilters } from "../../../lib/evaluations/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: EvaluationService };
const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createListEvaluationsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const pagination = readPagination(request);
    const result = await (dependencies.service ?? evaluationService).listEvaluations(
      parseEvaluationListFilters(request.nextUrl.searchParams, pagination), principal,
    );
    return apiSuccess({
      items: result.items,
      pagination: createPaginationMeta(pagination.page, pagination.pageSize, result.totalItems),
    });
  }, options(dependencies.auth));

export const createCreateEvaluationHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request, principal) => {
    const evaluation = await (dependencies.service ?? evaluationService).createEvaluation(
      parseCreateEvaluationWriteInput(await readJsonObject(request)), principal,
    );
    return apiSuccess({ evaluation }, 201);
  }, options(dependencies.auth));

export const GET = createListEvaluationsHandler();
export const POST = createCreateEvaluationHandler();
