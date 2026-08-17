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
  instituteProviderService,
  type InstituteProviderService,
} from "../../../../lib/instituteProviders/service";
import { parseUpdateInstituteProvider } from "../../../../lib/instituteProviders/validation";

type Context = { params: Promise<{ instituteProviderId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: InstituteProviderService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});
const id = async (context: Context) =>
  readPositiveId((await context.params).instituteProviderId, "instituteProviderId");

export const createGetInstituteProviderHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess({
        instituteProvider: await (
          dependencies.service ?? instituteProviderService
        ).getInstituteProvider(await id(context)),
      }),
    readOptions(dependencies.auth),
  );

export const createUpdateInstituteProviderHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, _principal, context) =>
      apiSuccess({
        instituteProvider: await (
          dependencies.service ?? instituteProviderService
        ).updateInstituteProvider(
          await id(context),
          parseUpdateInstituteProvider(await readJsonObject(request)),
        ),
      }),
    writeOptions(dependencies.auth),
  );

export const createDeleteInstituteProviderHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess(
        await (
          dependencies.service ?? instituteProviderService
        ).deleteInstituteProvider(await id(context)),
      ),
    writeOptions(dependencies.auth),
  );

export const GET = createGetInstituteProviderHandler();
export const PATCH = createUpdateInstituteProviderHandler();
export const DELETE = createDeleteInstituteProviderHandler();
