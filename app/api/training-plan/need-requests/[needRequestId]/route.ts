import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { readJsonObject } from "../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import {
  actorOf,
  needRequestService,
  type NeedRequestService,
} from "../../../../lib/trainingNeedRequests/service";
import { parseUpdateNeedRequest } from "../../../../lib/trainingNeedRequests/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: NeedRequestService };

// HRD decides, links and unlinks; an employee may only answer as the section head named on the
// request. The repository enforces which action each role may take.
const options = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY", "EMPLOYEE"] as const,
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

      const needRequest = await (dependencies.service ?? needRequestService).updateNeedRequest(
        needRequestId,
        input,
        actorOf(principal),
      );

      return apiSuccess({ needRequest });
    },
    options(dependencies.auth),
  );

export const PUT = createUpdateNeedRequestHandler();
