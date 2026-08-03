import { apiSuccess } from "../../../../lib/api/response";
import { readPositiveId } from "../../../../lib/api/validation";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../../lib/auth/guard";
import {
  employeeService,
  type EmployeeService,
} from "../../../../lib/employees/service";

type Context = { params: Promise<{ employeeId: string }> };
type Dependencies = {
  auth?: ProtectedRouteOptions;
  service?: EmployeeService;
};

export const createRevealNationalIdHandler = (
  dependencies: Dependencies = {},
) =>
  createProtectedRoute<Context>(
    async (_request, principal, context) =>
      apiSuccess(
        await (dependencies.service ?? employeeService).reveal(
          principal,
          readPositiveId((await context.params).employeeId, "employeeId"),
        ),
      ),
    {
      ...dependencies.auth,
      allowedRoles: ["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER"],
    },
  );

export const GET = createRevealNationalIdHandler();
