import { ApiError } from "../../../lib/api/errors";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { trainingFormsService, type TrainingFormsService } from "../../../lib/trainingForms/service";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingFormsService };

const forbidden = () =>
  new ApiError({ code: "FORBIDDEN", message: "This account is not linked to an employee", status: 403 });

const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["EMPLOYEE"] as const });

// A supervisor is an EMPLOYEE account like any other. What they may see is decided by the
// assignments naming them, never by their job title - a section head with nothing assigned gets an
// empty list.
export const createListAssignedEvaluationsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (_request, principal) => {
    // Fail closed, the same way the enrollment list does: an account with no employee link has no
    // durable key to match assignments against, and matching on null would be matching on nothing.
    if (principal.employeeUserId === null) return apiSuccess({ assignedEvaluations: [] });

    const assignedEvaluations = await (
      dependencies.service ?? trainingFormsService
    ).listAssignedEvaluations(principal.employeeUserId);
    return apiSuccess({ assignedEvaluations });
  }, options(dependencies.auth));

// Sent when the supervisor follows an external evaluation link. It records that they opened it and
// nothing more - an external form's answers are not visible to this system, so there is no
// completion to record here, ever.
export const createMarkAssignedEvaluationOpenedHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request, principal) => {
    if (principal.employeeUserId === null) throw forbidden();
    const body = await readJsonObject(request);
    const enrollmentId = body.enrollmentId;
    if (typeof enrollmentId !== "string" || !/^[1-9]\d*$/.test(enrollmentId)) {
      throw new ApiError({
        code: "INVALID_INPUT",
        message: "The submitted enrollment is invalid",
        status: 400,
        details: { field: "enrollmentId", reason: "Value must be a positive identifier" },
      });
    }
    const result = await (dependencies.service ?? trainingFormsService).markAssignedEvaluationOpened(
      enrollmentId,
      principal.employeeUserId,
    );
    return apiSuccess(result);
  }, options(dependencies.auth));

export const GET = createListAssignedEvaluationsHandler();
export const POST = createMarkAssignedEvaluationOpenedHandler();
