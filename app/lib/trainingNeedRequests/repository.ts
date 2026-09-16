import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import { isSectionHeadOrAbove } from "../employeeMasterData";
import type {
  ApproverDecision,
  BulkNeedRequestInput,
  CreateNeedRequestInput,
  NeedRequestActor,
  NeedRequestListFilters,
  NeedRequestStage,
  NeedRequestStatus,
  UpdateNeedRequestInput,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "training_need_request" | "employee" | "training_plan" | "course"> &
  Pick<PrismaClient, "$transaction">;

const notFound = () =>
  new ApiError({ code: "NEED_REQUEST_NOT_FOUND", message: "Training need request not found", status: 404 });

const conflict = (message: string) =>
  new ApiError({ code: "NEED_REQUEST_CONFLICT", message, status: 409 });

const forbidden = (message = "Access denied") => new ApiError({ code: "FORBIDDEN", message, status: 403 });

const personInclude = { position: true } satisfies Prisma.employeeInclude;

const requestInclude = {
  employee: {
    include: { company: true, organization_function: true },
  },
  approver: { include: personInclude },
  // Whose course this is: company_id null means the centre owns it.
  course: { select: { course_id: true, company_id: true, company: { select: { company_code: true } } } },
  training_plan: {
    select: { plan_id: true, plan_code: true, plan_name: true, start_datetime: true, end_datetime: true },
  },
} satisfies Prisma.training_need_requestInclude;

type RequestWithRelations = Prisma.training_need_requestGetPayload<{
  include: typeof requestInclude;
}>;

const employeeName = (employee: {
  title_th: string | null;
  title_en: string | null;
  first_name_th: string;
  last_name_th: string;
  first_name_en: string | null;
  last_name_en: string | null;
}) => {
  const prefix = employee.title_th || employee.title_en || "";
  const name =
    `${employee.first_name_th} ${employee.last_name_th}`.trim() ||
    `${employee.first_name_en ?? ""} ${employee.last_name_en ?? ""}`.trim();
  return prefix ? `${prefix} ${name}` : name;
};

/** Where a request stands. A head's rejection is stored as REJECTED with their decision beside it,
 *  so it is the decision, not the status, that says whose "no" it was. */
export const stageOf = (row: {
  status: string;
  approver_user_id: string | null;
  approver_decision: string | null;
}): NeedRequestStage => {
  const status = row.status.trim() as NeedRequestStatus;
  if (status === "PLANNED") return "PLANNED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return row.approver_decision === "REJECTED" ? "REJECTED_BY_HEAD" : "REJECTED";
  return row.approver_user_id !== null && row.approver_decision === null ? "WAITING_HEAD" : "WAITING_HRD";
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
  stage: stageOf(row),
  requestedAt: row.requested_at.toISOString(),
  reviewedBy: row.reviewed_by?.toString() ?? null,
  reviewedAt: row.reviewed_at?.toISOString() ?? null,
  reviewNote: row.review_note ?? "",
  rejectionReason: row.rejection_reason ?? "",
  approver: row.approver
    ? {
        userId: row.approver.user_id,
        employeeCode: row.approver.employee_code ?? "",
        name: employeeName(row.approver),
        position: row.approver.position?.position_name_th || row.approver.position?.position_name_en || "",
      }
    : null,
  courseId: row.course_id?.toString() ?? null,
  courseOwner: row.course ? (row.course.company ? "FACTORY" : "CENTER") : null,
  courseOwnerCompanyCode: row.course?.company?.company_code ?? null,
  courseCodeSnapshot: row.course_code_snapshot ?? null,
  courseNameSnapshot: row.course_name_snapshot ?? null,
  approverDecision: (row.approver_decision as ApproverDecision | null) ?? null,
  approverDecidedAt: row.approver_decided_at?.toISOString() ?? null,
  approverNote: row.approver_note ?? "",
  approverOpenedAt: row.approver_opened_at?.toISOString() ?? null,
  trainingPlanId: row.training_plan_id?.toString() ?? null,
  plan: row.training_plan
    ? {
        planId: row.training_plan.plan_id.toString(),
        planCode: row.training_plan.plan_code,
        planName: row.training_plan.plan_name,
        startAt: row.training_plan.start_datetime.toISOString(),
        endAt: row.training_plan.end_datetime.toISOString(),
      }
    : null,
  plannedAt: row.planned_at?.toISOString() ?? null,
});

/** HRD sees a request once its head has approved it, or when it predates the head step. */
const visibleToHrd: Prisma.training_need_requestWhereInput = {
  OR: [{ approver_user_id: null }, { approver_decision: "APPROVED" }],
};

const isHrd = (actor: NeedRequestActor) => actor.role === "HRD_CENTER" || actor.role === "HRD_FACTORY";

/**
 * A request belongs to whoever owns the course it names: a centre course is the centre's alone, a
 * factory's course is that factory's alone. Everyone else reads it. A request that names no course
 * yet has no owner, so it stays with the requester's company HRD, with the centre able to stand in.
 */
const courseOwnerMayAct = (
  course: { company_id: bigint | null } | null,
  actor: NeedRequestActor,
  verb: "decide" | "plan",
) => {
  if (course === null) return;
  if (course.company_id === null) {
    if (actor.role !== "HRD_CENTER") {
      throw forbidden(`This is a central course, so only HRD Center can ${verb} the request`);
    }
    return;
  }
  if (actor.role !== "HRD_FACTORY" || course.company_id !== BigInt(actor.companyId ?? "-1")) {
    throw forbidden(`This course belongs to a factory, so only that factory's HRD can ${verb} the request`);
  }
};

export type NeedRequestRepository = ReturnType<typeof createNeedRequestRepository>;

export const createNeedRequestRepository = (client?: DatabaseClient) => {
  const db = () => (client ?? getPrismaClient()) as unknown as DatabaseClient & PrismaClient;

  /** HRD's own decision on one request, inside a transaction. Shared by the single and bulk paths
   *  so both refuse the same things. */
  const hrdDecide = async (
    tx: Prisma.TransactionClient,
    current: {
      training_need_request_id: bigint;
      company_id: bigint;
      status: string;
      approver_user_id: string | null;
      approver_decision: string | null;
      review_note: string | null;
      rejection_reason: string | null;
      course: { company_id: bigint | null } | null;
    },
    action: "approve" | "reject" | "reset",
    note: string | null,
    actor: NeedRequestActor,
  ) => {
    // A factory HRD may only act on requests from their own company.
    if (actor.role === "HRD_FACTORY" && current.company_id !== BigInt(actor.companyId ?? "-1")) {
      throw forbidden();
    }
    courseOwnerMayAct(current.course, actor, "decide");
    const stage = stageOf(current);
    if (stage === "WAITING_HEAD" || stage === "REJECTED_BY_HEAD") {
      throw conflict("This request has not been approved by the requester's section head");
    }
    if (stage === "PLANNED") {
      throw conflict("This request has already been incorporated into a training plan and cannot be changed");
    }
    const status: NeedRequestStatus = action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "PENDING";
    return tx.training_need_request.update({
      where: { training_need_request_id: current.training_need_request_id },
      data: {
        status,
        reviewed_by: action === "reset" ? null : BigInt(actor.userId),
        reviewed_at: action === "reset" ? null : new Date(),
        review_note: action === "reject" ? current.review_note : action === "reset" ? null : note,
        rejection_reason: action === "reject" ? note : action === "reset" ? null : current.rejection_reason,
      },
      include: requestInclude,
    });
  };

  return {
    async list(filters: NeedRequestListFilters, actor: NeedRequestActor) {
      const where: Prisma.training_need_requestWhereInput = {};
      if (filters.status) where.status = filters.status;
      if (filters.employeeUserId) where.employee_user_id = filters.employeeUserId;
      if (filters.approverUserId) where.approver_user_id = filters.approverUserId;
      if (actor.role === "HRD_FACTORY") where.company_id = BigInt(actor.companyId ?? "-1");
      if (isHrd(actor)) Object.assign(where, visibleToHrd);

      return withDatabaseErrorMapping(async () => {
        // A head opening their list has seen every request waiting in it.
        if (filters.approverUserId) {
          await db().training_need_request.updateMany({
            where: { approver_user_id: filters.approverUserId, approver_decision: null, approver_opened_at: null },
            data: { approver_opened_at: new Date() },
          });
        }
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

        if (input.approverUserId === employeeUserId) {
          throw new ApiError({ code: "INVALID_APPROVER", message: "You cannot approve your own request", status: 400 });
        }
        const approver = await db().employee.findUnique({
          where: { user_id: input.approverUserId },
          include: { position: true, employee_level: true },
        });
        const isHead =
          approver !== null &&
          approver.employment_status === "ACTIVE" &&
          approver.company_id === employee.company_id &&
          isSectionHeadOrAbove({
            positionCode: approver.position?.position_code ?? null,
            positionName: approver.position?.position_name_en ?? approver.position?.position_name_th ?? null,
            levelCode: approver.employee_level?.level_code ?? null,
            levelKey: approver.employee_level?.level_key ?? null,
            levelName: approver.employee_level?.level_name_en ?? approver.employee_level?.level_name_th ?? null,
          });
        if (!isHead) {
          throw new ApiError({
            code: "INVALID_APPROVER",
            message: "The approver must be an active section head in your company",
            status: 400,
          });
        }

        // The course the employee picked, kept by id: the id is what every later screen reads the
        // owner from, and unlike the code nothing renames or reuses it. The code and name are
        // snapshotted beside it so the request still reads as sent if the course is renamed.
        const course = input.courseId
          ? await db().course.findUnique({
              where: { course_id: BigInt(input.courseId) },
              select: { course_id: true, course_code: true, course_name: true },
            })
          : null;
        if (input.courseId && !course) {
          throw new ApiError({ code: "COURSE_NOT_FOUND", message: "Course not found", status: 404 });
        }

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
              approver_user_id: input.approverUserId,
              course_id: course?.course_id ?? null,
              course_code_snapshot: course?.course_code ?? null,
              course_name_snapshot: course?.course_name ?? null,
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

    async update(id: string, input: UpdateNeedRequestInput, actor: NeedRequestActor) {
      return withDatabaseErrorMapping(async () => {
        const current = await db().training_need_request.findUnique({
          where: { training_need_request_id: BigInt(id) },
          include: requestInclude,
        });
        if (!current) throw notFound();
        const stage = stageOf(current);

        if (input.action === "head_approve" || input.action === "head_reject") {
          // Only the head the employee named, and only while the request still waits on them.
          if (actor.role !== "EMPLOYEE" || !actor.employeeUserId || current.approver_user_id !== actor.employeeUserId) {
            throw forbidden("Only the section head named on this request can decide it");
          }
          if (stage !== "WAITING_HEAD") {
            throw conflict("This request is no longer waiting for a section head decision");
          }
          const approved = input.action === "head_approve";
          const now = new Date();
          const updated = await db().training_need_request.update({
            where: { training_need_request_id: current.training_need_request_id },
            data: {
              approver_decision: approved ? "APPROVED" : "REJECTED",
              approver_decided_at: now,
              approver_note: input.note,
              approver_opened_at: current.approver_opened_at ?? now,
              // A head's "no" ends the request; their reason is what the employee reads.
              ...(approved ? {} : { status: "REJECTED", rejection_reason: input.note }),
            },
            include: requestInclude,
          });
          return mapRequest(updated);
        }

        if (!isHrd(actor)) throw forbidden();
        if (actor.role === "HRD_FACTORY" && current.company_id !== BigInt(actor.companyId ?? "-1")) {
          throw forbidden();
        }
        // Planning a request into a batch is the course owner's call as much as approving it is.
        courseOwnerMayAct(current.course, actor, "plan");

        if (input.action === "link") {
          if (stage !== "APPROVED") throw conflict("Only an approved request can be linked to a training batch");
          const plan = await db().training_plan.findUnique({
            where: { plan_id: BigInt(input.planId!) },
            include: {
              training_plan_oap: {
                select: { company_id: true, course: { select: { course_id: true, course_code: true, course_name: true } } },
              },
            },
          });
          if (!plan) throw new ApiError({ code: "TRAINING_PLAN_NOT_FOUND", message: "Training batch not found", status: 404 });
          const planCompanyId = plan.training_plan_oap.company_id;
          // A company batch only takes that company's people; a factory HRD cannot link into
          // another factory's batch either.
          if (planCompanyId !== null && planCompanyId !== current.company_id) {
            throw forbidden("A company training batch only accepts requests from that company");
          }
          const { course } = plan.training_plan_oap;
          const updated = await db().training_need_request.update({
            where: { training_need_request_id: current.training_need_request_id },
            data: {
              status: "PLANNED",
              training_plan_id: plan.plan_id,
              planned_at: new Date(),
              course_id: course.course_id,
              course_code_snapshot: course.course_code,
              course_name_snapshot: course.course_name,
            },
            include: requestInclude,
          });
          return mapRequest(updated);
        }

        if (input.action === "unlink") {
          if (stage !== "PLANNED") throw conflict("This request is not linked to a training batch");
          const updated = await db().training_need_request.update({
            where: { training_need_request_id: current.training_need_request_id },
            data: { status: "APPROVED", training_plan_id: null, planned_at: null },
            include: requestInclude,
          });
          return mapRequest(updated);
        }

        const updated = await db().$transaction((tx) =>
          hrdDecide(tx, current, input.action as "approve" | "reject" | "reset", input.note, actor),
        );
        return mapRequest(updated);
      });
    },

    /** Approves or rejects every request named, or none of them: one refusal rolls the rest back,
     *  so HRD never has to work out which half of a selection went through. */
    async bulkDecide(input: BulkNeedRequestInput, actor: NeedRequestActor) {
      if (!isHrd(actor)) throw forbidden();
      return withDatabaseErrorMapping(async () => {
        const updated = await db().$transaction(async (tx) => {
          const rows = await tx.training_need_request.findMany({
            where: { training_need_request_id: { in: input.ids.map((id) => BigInt(id)) } },
            // The course comes with the row so the owner check below costs no extra query per request.
            include: { course: { select: { company_id: true } } },
          });
          if (rows.length !== input.ids.length) throw notFound();
          const results = [];
          for (const row of rows) {
            results.push(await hrdDecide(tx, row, input.action, input.note, actor));
          }
          return results;
        });
        return updated.map(mapRequest);
      });
    },
  };
};

export const needRequestRepository = createNeedRequestRepository();
