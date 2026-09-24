import type { NextRequest } from "next/server";
import { ApiError } from "../../../../lib/api/errors";
import { apiSuccess } from "../../../../lib/api/response";
import { readJsonObject } from "../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { trainingRecordRequestRepository } from "../../../../lib/trainingRecordRequests/repository";
import { publish } from "../../../../lib/realtime/bus";

type Dependencies = {
  auth?: ProtectedRouteOptions;
  repository?: typeof trainingRecordRequestRepository;
};

export const createDecideRecordRequestHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal, context?: { params?: Promise<{ requestId?: string }> | { requestId?: string } }) => {
      const repo = dependencies.repository ?? trainingRecordRequestRepository;

      const rawParams = context?.params;
      const resolvedParams = rawParams instanceof Promise ? await rawParams : rawParams;
      const requestId = resolvedParams?.requestId;

      if (!requestId) {
        throw new ApiError({ code: "REQUEST_ID_REQUIRED", message: "Request ID is missing", status: 400 });
      }

      const body = await readJsonObject(request);
      const action = String(body.action || "").toLowerCase();
      if (action !== "approve" && action !== "reject") {
        throw new ApiError({
          code: "INVALID_ACTION",
          message: "Action must be either 'approve' or 'reject'",
          status: 400,
        });
      }

      const note = body.note ? String(body.note).trim() : null;

      const updated = await repo.decide(requestId, principal.userId, {
        action: action as "approve" | "reject",
        note,
      });

      publish({ type: "recordRequest.changed" }, { employees: [updated?.employeeUserId], accounts: [principal.userId] });
      return apiSuccess({ request: updated });
    },
    { ...dependencies.auth, allowedRoles: ["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER", "ADMIN"] as const },
  );

export const PATCH = createDecideRecordRequestHandler();
