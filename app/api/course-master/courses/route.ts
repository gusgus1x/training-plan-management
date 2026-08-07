import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { courseService, type CourseService } from "../../../lib/courses/service";
import { parseCourseListFilters, parseCreateCourse } from "../../../lib/courses/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: CourseService };

const readOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });
const writeOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createListCoursesHandler = (dependencies: Dependencies = {}) => 
  createProtectedRoute(async (request: NextRequest, principal) => { 
    const result = await (dependencies.service ?? courseService).listCourses(
      parseCourseListFilters(request.nextUrl.searchParams),
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    ); 
    return apiSuccess({ courses: result.courses, standards: result.standards }); 
  }, readOptions(dependencies.auth));

export const createCreateCourseHandler = (dependencies: Dependencies = {}) => 
  createProtectedRoute(async (request, principal) => {
    const input = parseCreateCourse(await readJsonObject(request));
    const result = await (dependencies.service ?? courseService).createCourse(
      input, 
      principal.userId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    );
    return apiSuccess(result, 201);
  }, writeOptions(dependencies.auth));




export const GET = createListCoursesHandler(); 
export const POST = createCreateCourseHandler();
