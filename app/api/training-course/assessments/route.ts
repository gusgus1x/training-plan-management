import type { NextRequest } from "next/server";
import { createPaginationMeta, readPagination } from "../../../lib/api/pagination";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { assessmentService, type AssessmentService } from "../../../lib/assessments/service";
import { parseAssessmentListFilters, parseCreateAssessmentWriteInput } from "../../../lib/assessments/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: AssessmentService };
const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createListAssessmentsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const pagination = readPagination(request);
    const result = await (dependencies.service ?? assessmentService).listAssessments(
      parseAssessmentListFilters(request.nextUrl.searchParams, pagination),
      principal,
    );
    return apiSuccess({
      items: result.items,
      pagination: createPaginationMeta(pagination.page, pagination.pageSize, result.totalItems),
    });
  }, options(dependencies.auth));

export const createCreateAssessmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request, principal) => {
    const assessment = await (dependencies.service ?? assessmentService).createAssessment(
      parseCreateAssessmentWriteInput(await readJsonObject(request)),
      principal,
    );
    return apiSuccess({ assessment }, 201);
  }, options(dependencies.auth));

export const GET = createListAssessmentsHandler();
export const POST = createCreateAssessmentHandler();
