import { apiSuccess } from "../../../../lib/api/response";
import { readPositiveId } from "../../../../lib/api/validation";
import { auditRequestContext, recordAudit } from "../../../../lib/audit";
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
    async (request, principal, context) => {
      const employeeId = readPositiveId(
        (await context.params).employeeId,
        "employeeId",
      );
      const revealed = await (dependencies.service ?? employeeService).reveal(
        principal,
        employeeId,
      );

      // Decrypting a National ID is the most sensitive read in the system; a denied attempt
      // throws above this line, so only successful reveals are recorded for now.
      await recordAudit({
        category: "PII",
        action: "NATIONAL_ID_REVEALED",
        actor: {
          userId: principal.userId,
          username: principal.username,
          role: principal.role,
        },
        entityType: "employee",
        entityId: employeeId,
        ...auditRequestContext(request),
      });

      return apiSuccess(revealed);
    },
    {
      ...dependencies.auth,
      allowedRoles: ["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER"],
    },
  );

export const GET = createRevealNationalIdHandler();
