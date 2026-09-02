import type { NextRequest } from "next/server";
import { ApiError } from "../../../lib/api/errors";
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
      // Fail closed. An unlinked account carries neither key, and a null filter means "no filter"
      // downstream, so assigning it straight through handed every employee the whole table.
      // Every user_account.employee_user_id is NULL today, so that was all six EMPLOYEE logins.
      if (principal.employeeUserId === null && principal.employeeId === null) {
        return apiSuccess({ enrollments: [] });
      }
      filters.employeeUserId = principal.employeeUserId;
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
      requireEmployeeOwnership(principal, input.employeeId, input.employeeUserId);
      // Either key may PROVE ownership, but the repository RESOLVES the row by employeeUserId
      // first — so a caller proving themselves with employeeId while sending a colleague's
      // employeeUserId would enrol the colleague. Pin both keys to the principal instead of
      // trusting what was sent; an employee acting for themselves needs neither from the client.
      input.employeeId = principal.employeeId ?? input.employeeId;
      input.employeeUserId = principal.employeeUserId;
      input.source = "EMPLOYEE";
      // An employee cannot wave their own prerequisite condition through, no matter what the
      // client sent - only HRD sees the confirmation prompt and resubmits with this set.
      input.acknowledgePrerequisite = false;
    } else if (principal.role === "ADMIN") {
      // Enrolling people is HRD work, not system administration; allRoles already excludes ADMIN,
      // so this only fires if someone widens that list without revisiting the decision.
      throw new ApiError({
        code: "FORBIDDEN",
        message: "Administrators cannot enrol participants",
        status: 403,
      });
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
