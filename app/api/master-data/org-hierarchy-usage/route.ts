import { apiSuccess } from "../../../lib/api/response";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../lib/auth/guard";
import {
  orgHierarchyRepository,
  type OrgHierarchyRepository,
} from "../../../lib/orgHierarchy/repository";

type Dependencies = { auth?: ProtectedRouteOptions; repository?: OrgHierarchyRepository };
const readOptions = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});

export const createListOrgHierarchyUsageHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async () =>
      apiSuccess({
        items: await (dependencies.repository ?? orgHierarchyRepository).listUsage(),
      }),
    readOptions(dependencies.auth),
  );

export const GET = createListOrgHierarchyUsageHandler();
