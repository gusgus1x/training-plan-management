import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { readJsonObject } from "../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { enrollmentService, type EnrollmentService } from "../../../../lib/trainingEnrollment/service";
import { parseUpdateEnrollment } from "../../../../lib/trainingEnrollment/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: EnrollmentService };

const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY", "EMPLOYEE"] as const });

export const createUpdateEnrollmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ enrollmentId: string }> }) => {
    const { enrollmentId } = await params;
    const input = parseUpdateEnrollment(await readJsonObject(request));
    const enrollment = await (dependencies.service ?? enrollmentService).updateEnrollmentStatus(
      enrollmentId,
      input.action,
      input.reason,
      principal.userId,
      principal.role,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
      principal.employeeId,
    );
    return apiSuccess({ enrollment });
  }, options(dependencies.auth));

export const PUT = createUpdateEnrollmentHandler();
