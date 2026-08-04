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
  companyService,
  type CompanyService,
} from "../../../../lib/companies/service";
import { parseUpdateCompanyInput } from "../../../../lib/companies/validation";

type CompanyRouteContext = {
  params: Promise<{ companyId: string }>;
};

type CompanyItemDependencies = {
  auth?: ProtectedRouteOptions;
  service?: CompanyService;
};

const readOptions = (auth: ProtectedRouteOptions | undefined) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});
const writeOptions = (auth: ProtectedRouteOptions | undefined) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER"] as const,
});

const readCompanyId = async (context: CompanyRouteContext) =>
  readPositiveId((await context.params).companyId, "companyId");

export const createGetCompanyHandler = (
  dependencies: CompanyItemDependencies = {},
) =>
  createProtectedRoute<CompanyRouteContext>(
    async (_request, _principal, context) => {
      const companyId = await readCompanyId(context);
      const company = await (
        dependencies.service ?? companyService
      ).getCompany(companyId);

      return apiSuccess({ company });
    },
    readOptions(dependencies.auth),
  );

export const createUpdateCompanyHandler = (
  dependencies: CompanyItemDependencies = {},
) =>
  createProtectedRoute<CompanyRouteContext>(
    async (request, _principal, context) => {
      const companyId = await readCompanyId(context);
      const input = parseUpdateCompanyInput(await readJsonObject(request));
      const company = await (
        dependencies.service ?? companyService
      ).updateCompany(companyId, input);

      return apiSuccess({ company });
    },
    writeOptions(dependencies.auth),
  );

export const createDeleteCompanyHandler = (
  dependencies: CompanyItemDependencies = {},
) =>
  createProtectedRoute<CompanyRouteContext>(
    async (_request, _principal, context) => {
      const companyId = await readCompanyId(context);
      const company = await (
        dependencies.service ?? companyService
      ).deleteCompany(companyId);

      return apiSuccess({ company });
    },
    writeOptions(dependencies.auth),
  );

export const GET = createGetCompanyHandler();
export const PATCH = createUpdateCompanyHandler();
export const DELETE = createDeleteCompanyHandler();
