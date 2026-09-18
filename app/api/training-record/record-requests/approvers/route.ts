import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { trainingRecordRequestRepository } from "../../../../lib/trainingRecordRequests/repository";

type Dependencies = {
  auth?: ProtectedRouteOptions;
  repository?: typeof trainingRecordRequestRepository;
};

export const createListRecordRequestApproversHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (_request: NextRequest, principal) => {
      const companyId = principal.companyId;
      if (!companyId) {
        return apiSuccess({ candidates: [] });
      }

      const repo = dependencies.repository ?? trainingRecordRequestRepository;
      const candidates = await repo.listApprovers(companyId, principal.employeeUserId ?? undefined);

      return apiSuccess({ candidates });
    },
    { ...dependencies.auth, allowedRoles: ["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER", "ADMIN"] as const },
  );

export const GET = createListRecordRequestApproversHandler();
