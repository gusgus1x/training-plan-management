import { apiSuccess } from "../../../../lib/api/response";
import { recordDeleteAudit } from "../../../../lib/audit";
import {
  readJsonObject,
  readPositiveId,
} from "../../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../../lib/auth/guard";
import {
  departmentService,
  type DepartmentService,
} from "../../../../lib/departments/service";
import { parseUpdateDepartment } from "../../../../lib/departments/validation";

type Context = { params: Promise<{ departmentId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: DepartmentService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});
const id = async (context: Context) =>
  readPositiveId((await context.params).departmentId, "departmentId");

export const createGetDepartmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, principal, context) => {
      const entityId = await id(context);
      const payload = {
        department: await (
          dependencies.service ?? departmentService
        ).getDepartment(entityId),
      };
      await recordDeleteAudit(request, principal, "department", entityId);
      return apiSuccess(payload);
    },
    readOptions(dependencies.auth),
  );

export const createUpdateDepartmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, _principal, context) =>
      apiSuccess({
        department: await (
          dependencies.service ?? departmentService
        ).updateDepartment(
          await id(context),
          parseUpdateDepartment(await readJsonObject(request)),
        ),
      }),
    writeOptions(dependencies.auth),
  );

export const createDeleteDepartmentHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess({
        department: await (
          dependencies.service ?? departmentService
        ).deleteDepartment(await id(context)),
      }),
    writeOptions(dependencies.auth),
  );

export const GET = createGetDepartmentHandler();
export const PATCH = createUpdateDepartmentHandler();
export const DELETE = createDeleteDepartmentHandler();
