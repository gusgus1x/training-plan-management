import { apiSuccess } from "../../../../lib/api/response";
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
import { requireMappingScope } from "../../../../lib/functions/scope";
import { parseUpdateFunctionMapping } from "../../../../lib/functions/validation";

type Context = { params: Promise<{ mappingId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: FunctionService };
const options = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const id = async (context: Context) =>
  readPositiveId((await context.params).mappingId, "mappingId");

export const createGetMappingHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, principal, context) => {
      const mapping = await (
        dependencies.service ?? functionService
      ).getMapping(await id(context));
      requireMappingScope(principal, mapping);
      return apiSuccess({ mapping });
    },
    options(dependencies.auth),
  );

export const createUpdateMappingHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, principal, context) => {
      const mappingId = await id(context);
      const service = dependencies.service ?? functionService;
      const current = await service.getMapping(mappingId);
      requireMappingScope(principal, current);
      return apiSuccess({
        mapping: await service.updateMapping(
          mappingId,
          parseUpdateFunctionMapping(await readJsonObject(request)),
        ),
      });
    },
    options(dependencies.auth),
  );

export const createDeleteMappingHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, principal, context) => {
      const mappingId = await id(context);
      const service = dependencies.service ?? functionService;
      const current = await service.getMapping(mappingId);
      requireMappingScope(principal, current);
      return apiSuccess({
        mapping: await service.deleteMapping(mappingId),
      });
    },
    options(dependencies.auth),
  );

export const GET = createGetMappingHandler();
export const PATCH = createUpdateMappingHandler();
export const DELETE = createDeleteMappingHandler();
