import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { requireEmployeeOwnership } from "../../../lib/auth/authorization";
import { enrollmentService, type EnrollmentService } from "../../../lib/trainingEnrollment/service";
import { parseCreateEnrollment, parseEnrollmentListFilters } from "../../../lib/trainingEnrollment/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: EnrollmentService };

const allRoles = ["HRD_CENTER", "HRD_FACTORY", "EMPLOYEE"] as const;
const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: allRoles });

export const createListEnrollmentsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const filters = parseEnrollmentListFilters(request.nextUrl.searchParams);
    if (principal.role === "EMPLOYEE") {
      filters.employeeId = principal.employeeId;
    }
    const result = await (dependencies.service ?? enrollmentService).listEnrollments(
      filters,
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    );
    return apiSuccess({ enrollments: result });
  }, options(dependencies.auth));

export const createCreateEnrollmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request, principal) => {
    const input = parseCreateEnrollment(await readJsonObject(request));

    if (principal.role === "EMPLOYEE") {
      requireEmployeeOwnership(principal, input.employeeId);
      input.source = "EMPLOYEE";
    } else {
      input.source = principal.role;
    }

    const enrollment = await (dependencies.service ?? enrollmentService).createEnrollment(
      input,
      principal.userId,
      principal.role,
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    );
    return apiSuccess({ enrollment }, 201);
  }, options(dependencies.auth));

export const GET = createListEnrollmentsHandler();
export const POST = createCreateEnrollmentHandler();
