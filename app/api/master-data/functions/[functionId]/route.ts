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
  functionService,
  type FunctionService,
} from "../../../../lib/functions/service";
import { parseUpdateOrganizationFunction } from "../../../../lib/functions/validation";

type Context = { params: Promise<{ functionId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: FunctionService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});
const id = async (context: Context) =>
  readPositiveId((await context.params).functionId, "functionId");

export const createGetFunctionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, principal, context) => {
      const entityId = await id(context);
      const payload = {
        function: await (
          dependencies.service ?? functionService
        ).getFunction(entityId),
      };
      await recordDeleteAudit(request, principal, "function", entityId);
      return apiSuccess(payload);
    },
    readOptions(dependencies.auth),
  );

export const createUpdateFunctionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, _principal, context) =>
      apiSuccess({
        function: await (
          dependencies.service ?? functionService
        ).updateFunction(
          await id(context),
          parseUpdateOrganizationFunction(await readJsonObject(request)),
        ),
      }),
    writeOptions(dependencies.auth),
  );

export const createDeleteFunctionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess({
        function: await (
          dependencies.service ?? functionService
        ).deleteFunction(await id(context)),
      }),
    writeOptions(dependencies.auth),
  );

export const GET = createGetFunctionHandler();
export const PATCH = createUpdateFunctionHandler();
export const DELETE = createDeleteFunctionHandler();
