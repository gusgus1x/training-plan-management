import type { NextRequest } from "next/server";
import { ApiError } from "../../../lib/api/errors";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { trainingRecordRequestRepository } from "../../../lib/trainingRecordRequests/repository";
import { RECORD_REQUEST_TYPES } from "../../../lib/trainingRecordRequests/types";

type Dependencies = {
  auth?: ProtectedRouteOptions;
  repository?: typeof trainingRecordRequestRepository;
};

export const createListRecordRequestsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (_request: NextRequest, principal) => {
      const repo = dependencies.repository ?? trainingRecordRequestRepository;
      const employeeUserId = principal.employeeUserId;
      if (!employeeUserId) {
        return apiSuccess({ myRequests: [], pendingApprovals: [] });
      }

      const result = await repo.list(employeeUserId, principal.userId);
      return apiSuccess(result);
    },
    { ...dependencies.auth, allowedRoles: ["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER", "ADMIN"] as const },
  );

export const createSubmitRecordRequestHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal) => {
      const repo = dependencies.repository ?? trainingRecordRequestRepository;
      const employeeUserId = principal.employeeUserId;
      const companyId = principal.companyId;

      if (!employeeUserId || !companyId) {
        throw new ApiError({
          code: "EMPLOYEE_RECORD_REQUIRED",
          message: "Signed-in account is not linked to an employee profile",
          status: 400,
        });
      }

      const body = await readJsonObject(request);
      const approverUserId = String(body.approverUserId || "").trim();
      const requestReason = String(body.requestReason || "").trim();
      const rawType = body.requestType ? String(body.requestType).trim().toUpperCase() : "DOCUMENT";
      const requestType = (RECORD_REQUEST_TYPES as readonly string[]).includes(rawType) ? rawType : "DOCUMENT";

      if (!approverUserId) {
        throw new ApiError({
          code: "APPROVER_REQUIRED",
          message: "Approver (Section Head) must be selected",
          status: 400,
        });
      }

      if (!requestReason) {
        throw new ApiError({
          code: "REASON_REQUIRED",
          message: "Request reason or purpose must be provided",
          status: 400,
        });
      }

      const created = await repo.create(employeeUserId, companyId, {
        approverUserId,
        requestReason,
        requestType,
        dateFrom: body.dateFrom ? String(body.dateFrom) : null,
        dateTo: body.dateTo ? String(body.dateTo) : null,
      });

      return apiSuccess({ request: created }, 201);
    },
    { ...dependencies.auth, allowedRoles: ["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER", "ADMIN"] as const },
  );

export const GET = createListRecordRequestsHandler();
export const POST = createSubmitRecordRequestHandler();
