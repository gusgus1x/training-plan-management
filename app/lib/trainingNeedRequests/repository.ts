import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type {
  CreateNeedRequestInput,
  NeedRequestAction,
  NeedRequestListFilters,
  NeedRequestStatus,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "training_need_request" | "employee"> &
  Pick<PrismaClient, "$transaction">;

const notFound = () =>
  new ApiError({ code: "NEED_REQUEST_NOT_FOUND", message: "Training need request not found", status: 404 });

const conflict = (message: string) =>
  new ApiError({ code: "NEED_REQUEST_CONFLICT", message, status: 409 });

const requestInclude = {
  employee: {
    include: { company: true, organization_function: true },
  },
} satisfies Prisma.training_need_requestInclude;

type RequestWithRelations = Prisma.training_need_requestGetPayload<{
  include: typeof requestInclude;
}>;

const employeeName = (employee: RequestWithRelations["employee"]) => {
  const prefix = employee.title_th || employee.title_en || "";
  const name =
    `${employee.first_name_th} ${employee.last_name_th}`.trim() ||
    `${employee.first_name_en ?? ""} ${employee.last_name_en ?? ""}`.trim();
  return prefix ? `${prefix} ${name}` : name;
};

const mapRequest = (row: RequestWithRelations) => ({
  id: row.training_need_request_id.toString(),
  requestNo: row.request_no,
  employeeUserId: row.employee_user_id,
  employeeCode: row.employee.employee_code ?? "",
  employeeName: employeeName(row.employee),
  companyId: row.company_id.toString(),
  companyCode: row.employee.company.company_code,
  functionId: row.function_id?.toString() ?? null,
  functionName:
    row.employee.organization_function?.function_name_en ||
    row.employee.organization_function?.function_name_th ||
    "",
  requestedCourseName: row.requested_course_name ?? "",
  requestReason: row.request_reason,
  preferredStartDate: row.preferred_start_date?.toISOString().slice(0, 10) ?? null,
  preferredEndDate: row.preferred_end_date?.toISOString().slice(0, 10) ?? null,
  status: row.status.trim() as NeedRequestStatus,
  requestedAt: row.requested_at.toISOString(),
  reviewedBy: row.reviewed_by?.toString() ?? null,
  reviewedAt: row.reviewed_at?.toISOString() ?? null,
  reviewNote: row.review_note ?? "",
  rejectionReason: row.rejection_reason ?? "",
  trainingPlanId: row.training_plan_id?.toString() ?? null,
  plannedAt: row.planned_at?.toISOString() ?? null,
});

const STATUS_FOR_ACTION: Record<NeedRequestAction, NeedRequestStatus> = {
  approve: "APPROVED",
  reject: "REJECTED",
};

// A decided request is final. Reopening one would silently change what the employee was told.
// PLANNED is past decided: the request is already a training plan.
const DECIDED: readonly NeedRequestStatus[] = ["APPROVED", "REJECTED", "PLANNED"];

export type NeedRequestRepository = ReturnType<typeof createNeedRequestRepository>;

export const createNeedRequestRepository = (client?: DatabaseClient) => {
  const db = () => (client ?? getPrismaClient()) as unknown as DatabaseClient & PrismaClient;

  return {
    async list(filters: NeedRequestListFilters, companyId: string | null) {
      const where: Prisma.training_need_requestWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.employeeUserId) where.employee_user_id = filters.employeeUserId;
      if (companyId) where.company_id = BigInt(companyId);

      return withDatabaseErrorMapping(async () => {
        const rows = await db().training_need_request.findMany({
          where,
          include: requestInclude,
          orderBy: { requested_at: "desc" },
        });
        return rows.map(mapRequest);
      });
    },

    async create(input: CreateNeedRequestInput, employeeUserId: string) {
      return withDatabaseErrorMapping(async () => {
        const employee = await db().employee.findUnique({
          where: { user_id: employeeUserId },
          select: { company_id: true, function_id: true },
        });
        if (!employee) throw notFound();

        // request_no is unique and derived from the row's own id, so two people submitting in the
        // same millisecond cannot collide. A timestamp-derived number could, and the failure would
        // land on whichever request arrived second.
        const created = await db().$transaction(async (tx) => {
          const placeholder = `TMP-${crypto.randomUUID()}`;
          const row = await tx.training_need_request.create({
            data: {
              request_no: placeholder,
              company_id: employee.company_id,
              function_id: employee.function_id,
              employee_user_id: employeeUserId,
              requested_course_name: input.requestedCourseName,
              request_reason: input.requestReason,
              preferred_start_date: input.preferredStartDate
                ? new Date(`${input.preferredStartDate}T00:00:00Z`)
                : null,
              preferred_end_date: input.preferredEndDate
                ? new Date(`${input.preferredEndDate}T00:00:00Z`)
                : null,
              status: "PENDING",
            },
          });

          // TN-YYYYMM-000001, the format the data dictionary specifies for this table.
          const yearMonth = `${row.requested_at.getFullYear()}${String(
            row.requested_at.getMonth() + 1,
          ).padStart(2, "0")}`;
          const requestNo = `TN-${yearMonth}-${row.training_need_request_id
            .toString()
            .padStart(6, "0")}`;

          return tx.training_need_request.update({
            where: { training_need_request_id: row.training_need_request_id },
            data: { request_no: requestNo },
            include: requestInclude,
          });
        });

        return mapRequest(created);
      });
    },

    async updateStatus(
      id: string,
      action: NeedRequestAction,
      note: string | null,
      reviewerUserId: string,
      companyId: string | null,
    ) {
      return withDatabaseErrorMapping(async () => {
        const current = await db().training_need_request.findUnique({
          where: { training_need_request_id: BigInt(id) },
          include: requestInclude,
        });
        if (!current) throw notFound();

        // A factory HRD may only act on requests from their own company.
        if (companyId && current.company_id !== BigInt(companyId)) {
          throw new ApiError({ code: "FORBIDDEN", message: "Access denied", status: 403 });
        }

        if (DECIDED.includes(current.status.trim() as NeedRequestStatus)) {
          throw conflict("This request has already been decided");
        }

        const status = STATUS_FOR_ACTION[action];
        const updated = await db().training_need_request.update({
          where: { training_need_request_id: current.training_need_request_id },
          data: {
            status,
            reviewed_by: BigInt(reviewerUserId),
            reviewed_at: new Date(),
            review_note: action === "reject" ? current.review_note : note,
            rejection_reason: action === "reject" ? note : current.rejection_reason,
          },
          include: requestInclude,
        });

        return mapRequest(updated);
      });
    },
  };
};

export const needRequestRepository = createNeedRequestRepository();
