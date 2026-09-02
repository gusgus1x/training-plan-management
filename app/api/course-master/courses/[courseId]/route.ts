import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { readJsonObject } from "../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { courseService, type CourseService } from "../../../../lib/courses/service";
import { parseUpdateCourse } from "../../../../lib/courses/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: CourseService };

const writeOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createUpdateCourseHandler = (dependencies: Dependencies = {}) => 
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ courseId: string }> }) => {
    const { courseId } = await params;
    const input = parseUpdateCourse(await readJsonObject(request));
    const companyId = principal.role === "HRD_FACTORY" ? principal.companyId : null;
    const result = await (dependencies.service ?? courseService).updateCourse(courseId, input, principal.userId, companyId);
    return apiSuccess(result);
  }, writeOptions(dependencies.auth));

export const createDeleteCourseHandler = (dependencies: Dependencies = {}) => 
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ courseId: string }> }) => {
    const { courseId } = await params;
    const companyId = principal.role === "HRD_FACTORY" ? principal.companyId : null;
    const result = await (dependencies.service ?? courseService).deleteCourse(courseId, principal.userId, companyId, {
      userId: principal.userId,
      username: principal.username,
      role: principal.role,
    });
    return apiSuccess(result);
  }, writeOptions(dependencies.auth));

export const PUT = createUpdateCourseHandler();
export const DELETE = createDeleteCourseHandler();
