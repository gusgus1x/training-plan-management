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
  levelService,
  type LevelService,
} from "../../../../lib/levels/service";
import { parseUpdateLevel } from "../../../../lib/levels/validation";

type Context = { params: Promise<{ levelId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: LevelService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});
const id = async (context: Context) =>
  readPositiveId((await context.params).levelId, "levelId");

export const createGetLevelHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, principal, context) => {
      const entityId = await id(context);
      const payload = {
        level: await (
          dependencies.service ?? levelService
        ).getLevel(entityId),
      };
      await recordDeleteAudit(request, principal, "level", entityId);
      return apiSuccess(payload);
    },
    readOptions(dependencies.auth),
  );
export const createUpdateLevelHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, _principal, context) =>
      apiSuccess({
        level: await (
          dependencies.service ?? levelService
        ).updateLevel(
          await id(context),
          parseUpdateLevel(await readJsonObject(request)),
        ),
      }),
    writeOptions(dependencies.auth),
  );
export const createDeleteLevelHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess({
        level: await (
          dependencies.service ?? levelService
        ).deleteLevel(await id(context)),
      }),
    writeOptions(dependencies.auth),
  );

export const GET = createGetLevelHandler();
export const PATCH = createUpdateLevelHandler();
export const DELETE = createDeleteLevelHandler();
