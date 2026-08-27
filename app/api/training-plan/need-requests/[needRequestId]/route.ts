import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { readJsonObject } from "../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import {
  needRequestService,
  type NeedRequestService,
} from "../../../../lib/trainingNeedRequests/service";
import { parseUpdateNeedRequest } from "../../../../lib/trainingNeedRequests/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: NeedRequestService };

// Deciding on a request is HRD's job. An employee raises one and then waits.
const options = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});

export const createUpdateNeedRequestHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (
      request: NextRequest,
      principal,
      { params }: { params: Promise<{ needRequestId: string }> },
    ) => {
      const { needRequestId } = await params;
      const input = parseUpdateNeedRequest(await readJsonObject(request));

      const needRequest = await (
        dependencies.service ?? needRequestService
      ).updateNeedRequestStatus(
        needRequestId,
        input.action,
        input.note,
        principal.userId,
        principal.role === "HRD_FACTORY" ? principal.companyId : null,
      );

      return apiSuccess({ needRequest });
    },
    options(dependencies.auth),
  );

export const PUT = createUpdateNeedRequestHandler();
