import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../lib/api/response";
import { readJsonObject } from "../../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../lib/auth/guard";
import { enrollmentService, type EnrollmentService } from "../../../../../lib/trainingEnrollment/service";
import { parseSetAttendance } from "../../../../../lib/trainingEnrollment/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: EnrollmentService };

const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createSetAttendanceHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ enrollmentId: string }> }) => {
    const { enrollmentId } = await params;
    const input = parseSetAttendance(await readJsonObject(request));
    const enrollment = await (dependencies.service ?? enrollmentService).setAttendance(
      enrollmentId,
      input.attended,
      principal.userId,
      principal.role,
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess({ enrollment });
  }, options(dependencies.auth));

export const PUT = createSetAttendanceHandler();
