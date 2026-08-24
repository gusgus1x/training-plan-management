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
  sectionService,
  type SectionService,
} from "../../../../lib/sections/service";
import { parseUpdateSection } from "../../../../lib/sections/validation";

type Context = { params: Promise<{ sectionId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: SectionService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});
const id = async (context: Context) =>
  readPositiveId((await context.params).sectionId, "sectionId");

export const createGetSectionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, principal, context) => {
      const entityId = await id(context);
      const payload = {
        section: await (
          dependencies.service ?? sectionService
        ).getSection(entityId),
      };
      await recordDeleteAudit(request, principal, "section", entityId);
      return apiSuccess(payload);
    },
    readOptions(dependencies.auth),
  );

export const createUpdateSectionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request, _principal, context) =>
      apiSuccess({
        section: await (
          dependencies.service ?? sectionService
        ).updateSection(
          await id(context),
          parseUpdateSection(await readJsonObject(request)),
        ),
      }),
    writeOptions(dependencies.auth),
  );

export const createDeleteSectionHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess({
        section: await (
          dependencies.service ?? sectionService
        ).deleteSection(await id(context)),
      }),
    writeOptions(dependencies.auth),
  );

export const GET = createGetSectionHandler();
export const PATCH = createUpdateSectionHandler();
export const DELETE = createDeleteSectionHandler();
