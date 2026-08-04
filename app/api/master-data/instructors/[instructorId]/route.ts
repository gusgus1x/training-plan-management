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
  instructorService,
  type InstructorService,
} from "../../../../lib/instructors/service";
import { parseUpdateInstructor } from "../../../../lib/instructors/validation";

type Context = { params: Promise<{ instructorId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: InstructorService };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});
const id = async (context: Context) =>
  readPositiveId((await context.params).instructorId, "instructorId");

export const createGetInstructorHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess({
        instructor: await (
          dependencies.service ?? instructorService
        ).getInstructor(await id(context)),
      }),
    readOptions(dependencies.auth),
  );

export const createUpdateInstructorHandler = (
  dependencies: Dependencies = {},
) =>
  createProtectedRoute<Context>(
    async (request, _principal, context) =>
      apiSuccess({
        instructor: await (
          dependencies.service ?? instructorService
        ).updateInstructor(
          await id(context),
          parseUpdateInstructor(await readJsonObject(request)),
        ),
      }),
    writeOptions(dependencies.auth),
  );

export const createDeleteInstructorHandler = (
  dependencies: Dependencies = {},
) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess(
        await (
          dependencies.service ?? instructorService
        ).deleteInstructor(await id(context)),
      ),
    writeOptions(dependencies.auth),
  );

export const GET = createGetInstructorHandler();
export const PATCH = createUpdateInstructorHandler();
export const DELETE = createDeleteInstructorHandler();
