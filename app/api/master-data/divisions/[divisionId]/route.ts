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
  divisionService,
  type DivisionService,
} from "../../../../lib/divisions/service";
import { parseUpdateDivision } from "../../../../lib/divisions/validation";

type Context = { params: Promise<{ divisionId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: DivisionService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});
const id = async (context: Context) =>
  readPositiveId((await context.params).divisionId, "divisionId");

export const createGetDivisionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess({
        division: await (
          dependencies.service ?? divisionService
        ).getDivision(await id(context)),
      }),
    readOptions(dependencies.auth),
  );

export const createUpdateDivisionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, _principal, context) =>
      apiSuccess({
        division: await (
          dependencies.service ?? divisionService
        ).updateDivision(
          await id(context),
          parseUpdateDivision(await readJsonObject(request)),
        ),
      }),
    writeOptions(dependencies.auth),
  );

export const createDeleteDivisionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess({
        division: await (
          dependencies.service ?? divisionService
        ).deleteDivision(await id(context)),
      }),
    writeOptions(dependencies.auth),
  );

export const GET = createGetDivisionHandler();
export const PATCH = createUpdateDivisionHandler();
export const DELETE = createDeleteDivisionHandler();
