import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import { cascadeDeleteTrainingPlans } from "../trainingPlanCascade";
import type { WorkflowCourse } from "../trainingWorkflow";
import type { CreateRollingPlanInput, RollingPlanListFilters, RollingPlanStatus, UpdateRollingPlanInput } from "./types";

type DatabaseClient = Pick<PrismaClient, "training_plan" | "training_plan_oap">;

const pad2 = (value: number) => String(value).padStart(2, "0");

const courseInclude = {
  course_type: true,
  course_group: true,
  assessment_course_pre_assessment_idToassessment: true,
  assessment_course_post_assessment_idToassessment: true,
  evaluation_form: true,
  evaluation_form_after_30day: true,
  company: true,
} satisfies Prisma.courseInclude;

type CourseWithRelations = Prisma.courseGetPayload<{ include: typeof courseInclude }>;

// Mirrors app/lib/trainingOap/repository.ts's course-row mapping (kept local rather than
// shared to avoid coupling this module's queries to the trainingOap repository's include shape).
const mapCourseSnapshot = (row: CourseWithRelations): WorkflowCourse => {
  const owner = row.company_id ? "FACTORY" : "CENTER";
  const ownerCompany = row.company?.company_code ?? "CENTER";
  return {
    id: row.course_id.toString(),
    courseCode: row.course_code,
    courseNameTh: row.course_name,
    courseNameEn: row.course_name_en || "",
    objective: row.objective || "",
    learningContent: row.learning_content || "",
    targetGroup: row.target_group || "",
    methodology: row.methodology || "",
    preTestId: row.pre_assessment_id?.toString() || "",
    preTest: row.assessment_course_pre_assessment_idToassessment ? "Pre-test" : "",
    postTestId: row.post_assessment_id?.toString() || "",
    postTest: row.assessment_course_post_assessment_idToassessment ? "Post-test" : "",
    evaluationId: row.evaluation_form_id?.toString() || "",
    evaluation: row.evaluation_form?.form_name || "",
    evaluationAfter30DayId: row.evaluation_form_after_30day_id?.toString() || "",
    evaluationAfter30Day: row.evaluation_form_after_30day?.form_name || "",
    lifeCycleMonth: row.validity_months?.toString() || "12",
    remark: row.description || "",
    status: row.status === "ACTIVE" ? "Active" : row.status === "DRAFT" ? "Draft" : "Inactive",
    courseType: row.course_type?.course_type_name || "",
    courseGroup: row.course_group?.course_group_name || "",
    updatedAt: (row.updated_at || row.created_at || new Date()).toISOString(),
    owner,
    ownerCompany,
    createdBy: row.created_by?.toString() || "",
  };
};

const oapSummaryInclude = {
  course: { include: courseInclude },
  instructor: true,
  company: true,
} satisfies Prisma.training_plan_oapInclude;

type OapSummary = Prisma.training_plan_oapGetPayload<{ include: typeof oapSummaryInclude }>;

const rollingInclude = {
  training_plan_oap: { include: oapSummaryInclude },
} satisfies Prisma.training_planInclude;

type RollingPlanWithRelations = Prisma.training_planGetPayload<{ include: typeof rollingInclude }>;

const DB_STATUS_TO_UI: Record<string, RollingPlanStatus> = {
  DRAFT: "Planning",
  OPEN: "Planned",
  COMPLETED: "Planned",
  CANCELLED: "Cancel",
};
const UI_STATUS_TO_DB: Record<RollingPlanStatus, string> = {
  Planning: "DRAFT",
  Planned: "OPEN",
  Cancel: "CANCELLED",
};

const splitDateTime = (value: Date | string | null | undefined) => {
  if (!value) return { trainingDate: "", time: "" };
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return { trainingDate: "", time: "" };
  return {
    trainingDate: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
};

const combineDateTime = (trainingDate: string, time: string) => new Date(`${trainingDate}T${time}:00`);

const mapRollingPlan = (row: RollingPlanWithRelations) => {
  const oap = row.training_plan_oap;
  const owner = oap?.company_id ? "FACTORY" : "CENTER";
  const ownerCompany = oap?.company?.company_code ?? "CENTER";
  const instructorName = oap?.instructor
    ? `${oap.instructor.first_name || ""} ${oap.instructor.last_name || ""}`.trim()
    : "";
  const start = splitDateTime(row.start_datetime);
  const end = splitDateTime(row.end_datetime);
  return {
    id: row.plan_id.toString(),
    oapPlanId: row.oap_plan_id.toString(),
    batchNo: row.batch_no,
    batchName: row.batch_name || "",
    planCode: row.plan_code,
    planName: row.plan_name,
    venue: row.venue || "",
    trainingDate: start.trainingDate,
    endDate: end.trainingDate || start.trainingDate,
    startTime: start.time,
    endTime: end.time,
    capacity: row.capacity,
    status: DB_STATUS_TO_UI[row.status] ?? "Planning",
    dbStatus: row.status,
    createdBy: row.created_by?.toString() || "",
    updatedAt: (row.updated_at || row.created_at || new Date()).toISOString(),
    course: oap?.course ? mapCourseSnapshot(oap.course) : null,
    oapParticipants: oap?.default_participant_count?.toString() || "0",
    oapHours: oap?.planned_duration_hours?.toString() || "0",
    oapBudget: oap?.total_planned_budget?.toString() || "0",
    oapTrainer: oap?.instructor_name_text || instructorName,
    oapProvider: oap?.provider_name_text || "",
    owner,
    ownerCompany,
  };
};

const loadOapSummary = async (db: PrismaClient, oapPlanId: string, companyId: string | null): Promise<OapSummary> => {
  const oap = await db.training_plan_oap.findUniqueOrThrow({
    where: { oap_plan_id: BigInt(oapPlanId) },
    include: oapSummaryInclude,
  });
  if (companyId && oap.company_id !== null && oap.company_id?.toString() !== companyId) {
    throw new ApiError({ code: "FORBIDDEN", message: "This OAP plan belongs to a different company", status: 403 });
  }
  return oap;
};

const nextBatchNo = async (tx: Prisma.TransactionClient, oapPlanId: bigint) => {
  const last = await tx.training_plan.findFirst({
    where: { oap_plan_id: oapPlanId },
    orderBy: { batch_no: "desc" },
    select: { batch_no: true },
  });
  return (last?.batch_no ?? 0) + 1;
};

export type RollingPlanRepository = ReturnType<typeof createRollingPlanRepository>;
export const createRollingPlanRepository = (client?: DatabaseClient) => {
  const db = () => (client ?? getPrismaClient()) as PrismaClient;
  return {
    async list(filters: RollingPlanListFilters, companyId: string | null) {
      const where: Prisma.training_planWhereInput = {};
      const andConditions: Prisma.training_planWhereInput[] = [];

      if (companyId) {
        andConditions.push({
          training_plan_oap: {
            OR: [
              { company_id: BigInt(companyId) },
              { company_id: null },
            ],
          },
        });
      }
      if (filters.oapPlanId) andConditions.push({ oap_plan_id: BigInt(filters.oapPlanId) });
      if (filters.status) andConditions.push({ status: UI_STATUS_TO_DB[filters.status] });
      if (filters.search) {
        andConditions.push({
          OR: [
            { plan_name: { contains: filters.search } },
            { plan_code: { contains: filters.search } },
            { venue: { contains: filters.search } },
          ],
        });
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      return withDatabaseErrorMapping(async () => {
        const rows = await db().training_plan.findMany({
          where,
          include: rollingInclude,
          orderBy: [{ oap_plan_id: "desc" }, { batch_no: "asc" }],
        });
        return rows.map(mapRollingPlan);
      });
    },

    async create(input: CreateRollingPlanInput, userId: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const oap = await loadOapSummary(db(), input.oapPlanId, companyId);
        const created = await db().$transaction(async (tx) => {
          const oapPlanId = BigInt(input.oapPlanId);
          const batchNo = await nextBatchNo(tx, oapPlanId);
          const courseName = oap.course.course_name.trim() || oap.course.course_name_en?.trim() || "Course";
          const planCode = `${oap.oap_code}-B${pad2(batchNo)}`;
          const planName = `${courseName} - Batch ${batchNo}`;

          return tx.training_plan.create({
            data: {
              oap_plan_id: oapPlanId,
              batch_no: batchNo,
              batch_name: input.batchName?.trim() || null,
              plan_code: planCode,
              plan_name: planName,
              start_datetime: combineDateTime(input.trainingDate, input.startTime),
              end_datetime: combineDateTime(input.endDate || input.trainingDate, input.endTime),
              venue: input.venue.trim() || oap.default_venue || null,
              capacity: oap.default_participant_count,
              capacity_control_mode: "HARD_LIMIT",
              allow_walk_in: false,
              qr_code_token: randomUUID(),
              status: UI_STATUS_TO_DB[input.status],
              created_by: BigInt(userId),
              created_at: new Date(),
            },
            include: rollingInclude,
          });
        });

        return mapRollingPlan(created);
      });
    },

    async update(id: string, input: UpdateRollingPlanInput, userId: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const current = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: BigInt(id) },
          include: rollingInclude,
        });
        if (companyId && current.training_plan_oap.company_id?.toString() !== companyId) {
          throw new ApiError({ code: "FORBIDDEN", message: "Factory users cannot modify plans created by HRD Center or other factories", status: 403 });
        }

        const data: Prisma.training_planUncheckedUpdateInput = {
          updated_by: BigInt(userId),
          updated_at: new Date(),
        };

        if (input.oapPlanId !== undefined && input.oapPlanId !== current.oap_plan_id.toString()) {
          const nextOap = await loadOapSummary(db(), input.oapPlanId, companyId);
          const updated = await db().$transaction(async (tx) => {
            const batchNo = await nextBatchNo(tx, nextOap.oap_plan_id);
            const courseName = nextOap.course.course_name.trim() || nextOap.course.course_name_en?.trim() || "Course";
            data.oap_plan_id = nextOap.oap_plan_id;
            data.batch_no = batchNo;
            data.plan_code = `${nextOap.oap_code}-B${pad2(batchNo)}`;
            data.plan_name = `${courseName} - Batch ${batchNo}`;
            return applyRemainingFields(tx, id, input, data);
          });
          return mapRollingPlan(updated);
        }

        const updated = await applyRemainingFields(db(), id, input, data);
        return mapRollingPlan(updated);
      });
    },

    async delete(id: string, companyId: string | null = null) {
      return withDatabaseErrorMapping(async () => {
        const planId = BigInt(id);
        if (companyId) {
          const current = await db().training_plan.findUniqueOrThrow({
            where: { plan_id: planId },
            include: { training_plan_oap: true },
          });
          if (current.training_plan_oap.company_id?.toString() !== companyId) {
            throw new ApiError({ code: "FORBIDDEN", message: "Factory users cannot delete plans created by HRD Center or other factories", status: 403 });
          }
        }
        await db().$transaction(async (tx) => {
          await cascadeDeleteTrainingPlans(tx, [planId]);
        });

        return { rollingPlanId: id, outcome: "DELETED" as const };
      });
    },
  };
};

const applyRemainingFields = async (
  db: Pick<PrismaClient, "training_plan"> | Prisma.TransactionClient,
  id: string,
  input: UpdateRollingPlanInput,
  data: Prisma.training_planUncheckedUpdateInput,
) => {
  if (input.batchName !== undefined) data.batch_name = input.batchName?.trim() || null;
  if (input.venue !== undefined) data.venue = input.venue.trim() || null;
  if (
    input.trainingDate !== undefined ||
    input.endDate !== undefined ||
    input.startTime !== undefined ||
    input.endTime !== undefined
  ) {
    const current = await db.training_plan.findUniqueOrThrow({ where: { plan_id: BigInt(id) } });
    const trainingDate = input.trainingDate ?? splitDateTime(current.start_datetime).trainingDate;
    const endDate = input.endDate ?? splitDateTime(current.end_datetime).trainingDate ?? trainingDate;
    const startTime = input.startTime ?? splitDateTime(current.start_datetime).time;
    const endTime = input.endTime ?? splitDateTime(current.end_datetime).time;
    data.start_datetime = combineDateTime(trainingDate, startTime);
    data.end_datetime = combineDateTime(endDate, endTime);
  }
  if (input.status !== undefined) data.status = UI_STATUS_TO_DB[input.status];

  return db.training_plan.update({
    where: { plan_id: BigInt(id) },
    data,
    include: rollingInclude,
  });
};

export const rollingPlanRepository = createRollingPlanRepository();
