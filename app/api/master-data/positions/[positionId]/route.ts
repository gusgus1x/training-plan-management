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
  positionService,
  type PositionService,
} from "../../../../lib/positions/service";
import { parseUpdatePosition } from "../../../../lib/positions/validation";

type Context = { params: Promise<{ positionId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: PositionService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});
const id = async (context: Context) =>
  readPositiveId((await context.params).positionId, "positionId");

export const createGetPositionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, principal, context) => {
      const entityId = await id(context);
      const payload = {
        position: await (
          dependencies.service ?? positionService
        ).getPosition(entityId),
      };
      await recordDeleteAudit(request, principal, "position", entityId);
      return apiSuccess(payload);
    },
    readOptions(dependencies.auth),
  );

export const createUpdatePositionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, _principal, context) =>
      apiSuccess({
        position: await (
          dependencies.service ?? positionService
        ).updatePosition(
          await id(context),
          parseUpdatePosition(await readJsonObject(request)),
        ),
      }),
    writeOptions(dependencies.auth),
  );

export const createDeletePositionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess({
        position: await (
          dependencies.service ?? positionService
        ).deletePosition(await id(context)),
      }),
    writeOptions(dependencies.auth),
  );

export const GET = createGetPositionHandler();
export const PATCH = createUpdatePositionHandler();
export const DELETE = createDeletePositionHandler();
