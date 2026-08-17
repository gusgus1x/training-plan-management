import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import type { WorkflowCourse } from "../trainingWorkflow";
import type { CreateOapPlanInput, OapPlanListFilters, OapPlanStatus, UpdateOapPlanInput } from "./types";

type DatabaseClient = Pick<PrismaClient, "training_plan_oap" | "course">;

const safeBigInt = (val: string | null | undefined): bigint | null => {
  if (!val) return null;
  try {
    return BigInt(val);
  } catch {
    return null;
  }
};

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

// Mirrors app/lib/courses/repository.ts's course-row mapping (kept local rather than
// shared to avoid coupling this module's queries to the courses repository's include shape).
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
    courseType: row.course_type.course_type_name,
    courseGroup: row.course_group.course_group_name,
    updatedAt: (row.updated_at || row.created_at).toISOString(),
    owner,
    ownerCompany,
    createdBy: row.created_by.toString(),
  };
};

const oapInclude = {
  course: { include: courseInclude },
  instructor: true,
  institute_provider: true,
  company: true,
} satisfies Prisma.training_plan_oapInclude;

type OapPlanWithRelations = Prisma.training_plan_oapGetPayload<{ include: typeof oapInclude }>;

const DB_STATUS_TO_UI: Record<string, OapPlanStatus> = {
  DRAFT: "Planning",
  OPEN: "Planned",
  COMPLETED: "Planned",
  CANCELLED: "Cancel",
};
const UI_STATUS_TO_DB: Record<OapPlanStatus, string> = {
  Planning: "DRAFT",
  Planned: "OPEN",
  Cancel: "CANCELLED",
};

const mapOapPlan = (row: OapPlanWithRelations, sequence: number) => {
  const owner = row.company_id ? "FACTORY" : "CENTER";
  const ownerCompany = row.company?.company_code ?? "CENTER";
  const instructorName = row.instructor ? `${row.instructor.first_name} ${row.instructor.last_name}`.trim() : "";
  return {
    id: row.oap_plan_id.toString(),
    sequence,
    course: mapCourseSnapshot(row.course),
    participants: row.default_participant_count.toString(),
    hours: row.planned_duration_hours.toString(),
    budget: row.total_planned_budget.toString(),
    trainer: row.instructor_name_text || instructorName,
    providerId: row.provider_id?.toString() ?? null,
    providerName: row.provider_name_text || row.institute_provider?.institute_provider_name || "",
    createdBy: row.created_by.toString(),
    status: DB_STATUS_TO_UI[row.status] ?? "Planning",
    owner,
    ownerCompany,
  };
};

export type OapPlanRepository = ReturnType<typeof createOapPlanRepository>;
export const createOapPlanRepository = (client?: DatabaseClient) => {
  const db = () => (client ?? getPrismaClient()) as PrismaClient;
  return {
    async list(filters: OapPlanListFilters, companyId: string | null) {
      const where: Prisma.training_plan_oapWhereInput = {};
      if (companyId) where.company_id = BigInt(companyId);
      if (filters.status) where.status = UI_STATUS_TO_DB[filters.status];
      if (filters.search) {
        where.OR = [
          { course_name_snapshot: { contains: filters.search } },
          { instructor_name_text: { contains: filters.search } },
          { provider_name_text: { contains: filters.search } },
        ];
      }

      return withDatabaseErrorMapping(async () => {
        const rows = await db().training_plan_oap.findMany({
          where,
          include: oapInclude,
          orderBy: { oap_plan_id: "desc" },
        });
        return rows.map((row, index) => mapOapPlan(row, rows.length - index));
      });
    },

    async create(input: CreateOapPlanInput, userId: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const courseId = safeBigInt(input.courseId);
        if (!courseId) throw new Error("INVALID_COURSE_ID");

        const course = await db().course.findUniqueOrThrow({
          where: { course_id: courseId },
          include: courseInclude,
        });

        const oapCode = `OAP-${input.planYear}-${course.course_code}`;

        const created = await db().training_plan_oap.create({
          data: {
            oap_code: oapCode,
            company_id: companyId ? BigInt(companyId) : null,
            plan_year: input.planYear,
            course_id: courseId,
            course_name_snapshot: course.course_name,
            course_description_snapshot: course.objective,
            pre_assessment_id: course.pre_assessment_id,
            post_assessment_id: course.post_assessment_id,
            evaluation_form_id: course.evaluation_form_id,
            planned_duration_hours: input.hours,
            default_participant_count: input.participants,
            total_planned_budget: input.budget,
            instructor_id: safeBigInt(input.instructorId),
            instructor_name_text: input.trainerName || null,
            provider_id: safeBigInt(input.providerId),
            provider_name_text: input.providerName || null,
            enrollment_mode: "BOTH",
            allow_non_target: false,
            status: UI_STATUS_TO_DB[input.status],
            created_by: BigInt(userId),
            created_at: new Date(),
          },
          include: oapInclude,
        });

        return mapOapPlan(created, 1);
      });
    },

    async update(id: string, input: UpdateOapPlanInput, userId: string) {
      return withDatabaseErrorMapping(async () => {
        const data: Prisma.training_plan_oapUncheckedUpdateInput = {
          updated_by: BigInt(userId),
          updated_at: new Date(),
        };

        if (input.courseId !== undefined) {
          const courseId = safeBigInt(input.courseId);
          if (!courseId) throw new Error("INVALID_COURSE_ID");
          const course = await db().course.findUniqueOrThrow({
            where: { course_id: courseId },
            include: courseInclude,
          });
          data.course_id = courseId;
          data.course_name_snapshot = course.course_name;
          data.course_description_snapshot = course.objective;
          data.pre_assessment_id = course.pre_assessment_id;
          data.post_assessment_id = course.post_assessment_id;
          data.evaluation_form_id = course.evaluation_form_id;
        }
        if (input.planYear !== undefined) data.plan_year = input.planYear;
        if (input.hours !== undefined) data.planned_duration_hours = input.hours;
        if (input.participants !== undefined) data.default_participant_count = input.participants;
        if (input.budget !== undefined) data.total_planned_budget = input.budget;
        if (input.instructorId !== undefined) data.instructor_id = safeBigInt(input.instructorId);
        if (input.trainerName !== undefined) data.instructor_name_text = input.trainerName || null;
        if (input.providerId !== undefined) data.provider_id = safeBigInt(input.providerId);
        if (input.providerName !== undefined) data.provider_name_text = input.providerName || null;
        if (input.status !== undefined) data.status = UI_STATUS_TO_DB[input.status];

        const updated = await db().training_plan_oap.update({
          where: { oap_plan_id: BigInt(id) },
          data,
          include: oapInclude,
        });

        return mapOapPlan(updated, 1);
      });
    },

    async delete(id: string) {
      return withDatabaseErrorMapping(async () => {
        const oapPlanId = BigInt(id);
        await db().$transaction(async (tx) => {
          // Find all training_plans for this OAP plan
          const plans = await tx.training_plan.findMany({
            where: { oap_plan_id: oapPlanId },
            select: { plan_id: true },
          });
          const planIds = plans.map((p) => p.plan_id);

          if (planIds.length > 0) {
            // Find all enrollments
            const enrollments = await tx.training_enrollment.findMany({
              where: { plan_id: { in: planIds } },
              select: { enrollment_id: true },
            });
            const enrollmentIds = enrollments.map((e) => e.enrollment_id);

            if (enrollmentIds.length > 0) {
              const assessmentSubmissions = await tx.assessment_submission.findMany({
                where: { enrollment_id: { in: enrollmentIds } },
                select: { submission_id: true },
              });
              if (assessmentSubmissions.length > 0) {
                const submissionIds = assessmentSubmissions.map((s) => s.submission_id);
                await tx.assessment_answer.deleteMany({
                  where: { submission_id: { in: submissionIds } },
                });
                await tx.assessment_submission.deleteMany({
                  where: { submission_id: { in: submissionIds } },
                });
              }

              const evaluationSubmissions = await tx.evaluation_submission.findMany({
                where: { enrollment_id: { in: enrollmentIds } },
                select: { evaluation_submission_id: true },
              });
              if (evaluationSubmissions.length > 0) {
                const evalSubIds = evaluationSubmissions.map((s) => s.evaluation_submission_id);
                await tx.evaluation_answer.deleteMany({
                  where: { evaluation_submission_id: { in: evalSubIds } },
                });
                await tx.evaluation_submission.deleteMany({
                  where: { evaluation_submission_id: { in: evalSubIds } },
                });
              }

              await tx.attendance.deleteMany({
                where: { enrollment_id: { in: enrollmentIds } },
              });

              await tx.training_result.deleteMany({
                where: { enrollment_id: { in: enrollmentIds } },
              });

              await tx.training_certificate_file.updateMany({
                where: { enrollment_id: { in: enrollmentIds } },
                data: { enrollment_id: null },
              });

              await tx.training_enrollment.deleteMany({
                where: { plan_id: { in: planIds } },
              });
            }

            await tx.training_plan_assessment_setting.deleteMany({
              where: { plan_id: { in: planIds } },
            });

            await tx.training_expense.deleteMany({
              where: { plan_id: { in: planIds } },
            });

            await tx.training_need_request.updateMany({
              where: { training_plan_id: { in: planIds } },
              data: { training_plan_id: null },
            });

            await tx.certificate_import_batch.deleteMany({
              where: { plan_id: { in: planIds } },
            });

            await tx.training_plan.deleteMany({
              where: { oap_plan_id: oapPlanId },
            });
          }

          await tx.training_plan_oap.delete({
            where: { oap_plan_id: oapPlanId },
          });
        });

        return { oapPlanId: id, outcome: "DELETED" as const };
      });
    },
  };
};

export const oapPlanRepository = createOapPlanRepository();
