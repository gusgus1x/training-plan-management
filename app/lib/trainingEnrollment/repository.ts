import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import { CLOSABLE_STAGES, stageAvailability, type FormStageKey } from "../trainingForms/availability";
import { assessmentStage } from "./types";
import type {
  AttendanceStatus,
  CreateEnrollmentInput,
  EnrollmentAction,
  EnrollmentListFilters,
  EnrollmentSource,
  EnrollmentStageInfo,
  EnrollmentStatus,
  StageSubmissionSummary,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "training_enrollment" | "training_plan" | "employee" | "attendance" | "course_standard_course" | "course_prerequisite" | "training_result">;

const forbidden = (message: string) => new ApiError({ code: "FORBIDDEN", message, status: 403 });

const employeeInclude = {
  company: true,
  organization_function: true,
  section: true,
  division: true,
  department: true,
  position: true,
  employee_level: true,
} satisfies Prisma.employeeInclude;

// The OAP fields ride along so an employee can see what they enrolled in without calling the
// rolling-plan list, which would hand them every plan in the organisation to read three of them.
const enrollmentInclude = {
  employee: { include: employeeInclude },
  attendance: true,
  training_result: true,
  // Every attempt/submission this enrollment has ever made, across all four stages - small tables,
  // and reading them here means the "take this form" screens never need a second request just to
  // know whether the employee has already attempted or submitted something.
  assessment_submission: {
    select: { assessment_id: true, assessment_stage: true, attempt_no: true, submitted_at: true, score: true, pass_status: true, grading_status: true, publication_status: true },
  },
  evaluation_submission: {
    select: { evaluation_form_id: true, submitted_at: true },
  },
  training_plan: {
    include: {
      // HRD's close switch for PRE_TEST/POST_TEST (see trainingForms/availability.ts - the two
      // evaluation stages never have a row here, they cannot be closed).
      training_plan_assessment_setting: { select: { assessment_stage: true, close_at: true } },
      training_plan_oap: {
        select: {
          company_id: true,
          course_name_snapshot: true,
          planned_duration_hours: true,
          instructor_name_text: true,
          provider_name_text: true,
          course: {
            select: {
              course_code: true,
              pre_assessment_id: true,
              pre_test_link: true,
              post_assessment_id: true,
              post_test_link: true,
              evaluation_form_id: true,
              evaluation_link: true,
              evaluation_form_after_30day_id: true,
              evaluation_after_30day_link: true,
              validity_months: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.training_enrollmentInclude;

type EnrollmentWithRelations = Prisma.training_enrollmentGetPayload<{ include: typeof enrollmentInclude }>;
type EmployeeWithRelations = Prisma.employeeGetPayload<{ include: typeof employeeInclude }>;

const employeeDisplayName = (employee: EmployeeWithRelations) => {
  const prefixStr = employee.title_th || employee.title_en || "";
  const nameStr = `${employee.first_name_th} ${employee.last_name_th}`.trim() ||
    `${employee.first_name_en || ""} ${employee.last_name_en || ""}`.trim();
  return prefixStr ? `${prefixStr} ${nameStr}` : nameStr;
};

const mapStatus = (approvalStatus: string, planOwnerIsFactory: boolean): EnrollmentStatus => {
  switch (approvalStatus) {
    case "APPROVED":
      return planOwnerIsFactory ? "Factory Approved" : "Center Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Pending Approval";
  }
};
/**
 * Layers plan dates, HRD's close switch and the enrollment's own submission history onto a bare
 * AssessmentStageInfo. `latestSubmission` is pre-filtered to the rows for this stage (PRE_TEST vs
 * POST_TEST assessment_submission rows are told apart by assessment_stage; the single evaluation
 * row for a stage is told apart by which evaluation_form_id it targets).
 */
const withEnrollmentStageInfo = (
  base: ReturnType<typeof assessmentStage>,
  stage: FormStageKey,
  startAt: Date,
  endAt: Date,
  closedAt: Date | null,
  latestSubmission: StageSubmissionSummary | null,
): EnrollmentStageInfo => {
  const availability = stageAvailability(
    stage,
    startAt.toISOString(),
    endAt.toISOString(),
    CLOSABLE_STAGES.includes(stage) ? closedAt?.toISOString() ?? null : null,
    new Date(),
  );
  return { ...base, opensAt: availability.opensAt, availability: availability.state, submission: latestSubmission };
};

const mapEnrollment = (row: EnrollmentWithRelations) => {
  const plan = row.training_plan;
  const oap = plan.training_plan_oap;
  const planOwnerIsFactory = oap.company_id !== null;
  const employee = row.employee;

  // The batch's own choice REPLACES the course's for that stage - an id or a link, never a mix of
  // the batch's link with the course's assessment. Same rule as trainingForms' formIdForStage,
  // resolved once here so every stage below reads the identical answer.
  // `!= null` rather than `!== null`: a row read without these columns selected yields undefined,
  // and treating that as "the batch chose something" would blank the stage entirely.
  const stageSource = (
    batchId: bigint | null,
    batchLink: string | null,
    courseId: bigint | null,
    courseLink: string | null,
  ): { id: bigint | null; link: string | null } =>
    batchId != null || batchLink?.trim()
      ? { id: batchId ?? null, link: batchLink ?? null }
      : { id: courseId, link: courseLink };

  const pre = stageSource(plan.pre_assessment_id, plan.pre_test_link, oap.course.pre_assessment_id, oap.course.pre_test_link);
  const post = stageSource(plan.post_assessment_id, plan.post_test_link, oap.course.post_assessment_id, oap.course.post_test_link);
  const evaluation = stageSource(plan.evaluation_form_id, plan.evaluation_link, oap.course.evaluation_form_id, oap.course.evaluation_link);
  const evaluation30 = stageSource(
    plan.evaluation_form_after_30day_id,
    plan.evaluation_after_30day_link,
    oap.course.evaluation_form_after_30day_id,
    oap.course.evaluation_after_30day_link,
  );

  const preAssessmentId = pre.id;
  const postAssessmentId = post.id;
  const evaluationFormId = evaluation.id;
  const evaluationForm30DayId = evaluation30.id;

  const closedAtByStage = new Map(plan.training_plan_assessment_setting.map((s) => [s.assessment_stage, s.close_at]));
  const latestAssessmentSubmission = (assessmentId: bigint | null, stage: "PRE_TEST" | "POST_TEST"): StageSubmissionSummary | null => {
    if (assessmentId === null) return null;
    const attempts = row.assessment_submission
      .filter((s) => s.assessment_id === assessmentId && s.assessment_stage === stage)
      .sort((a, b) => b.attempt_no - a.attempt_no);
    const latest = attempts[0];
    if (!latest) return null;
    // Same publication gate as trainingForms' mapSubmission: an unreleased score never leaves the
    // server, so My Record cannot show a grade the runner is still hiding.
    const resultsPublished = latest.publication_status === "PUBLISHED";
    return {
      attemptNo: latest.attempt_no,
      submittedAt: latest.submitted_at?.toISOString() ?? null,
      score: !resultsPublished || latest.score === null ? null : Number(latest.score),
      passStatus: resultsPublished ? (latest.pass_status as StageSubmissionSummary["passStatus"]) : "PENDING",
      gradingStatus: latest.grading_status as StageSubmissionSummary["gradingStatus"],
      resultsPublished,
    };
  };
  const evaluationSubmission = (formId: bigint | null): StageSubmissionSummary | null => {
    if (formId === null) return null;
    const submitted = row.evaluation_submission.find((s) => s.evaluation_form_id === formId);
    if (!submitted) return null;
    // Evaluations are never graded and never repeated - these three fields exist only because the
    // shape is shared with assessments, and "submitted" is the only fact worth carrying here.
    return { attemptNo: 1, submittedAt: submitted.submitted_at?.toISOString() ?? null, score: null, passStatus: "PENDING", gradingStatus: "REVIEWED", resultsPublished: true };
  };

  return {
    id: row.enrollment_id.toString(),
    planId: row.plan_id.toString(),
    result: row.training_result
      ? {
          // Decimal arrives as an object. Number() keeps null apart from 0 - "not graded" and
          // "scored nothing" are different claims on a record used as evidence.
          preScore: row.training_result.pre_score === null ? null : Number(row.training_result.pre_score),
          postScore: row.training_result.post_score === null ? null : Number(row.training_result.post_score),
          completionStatus: row.training_result.completion_status as
            | "PENDING"
            | "NOT_COMPLETED"
            | "COMPLETED",
          completedAt: row.training_result.completed_at?.toISOString() ?? null,
          validUntil: row.training_result.valid_until?.toISOString().slice(0, 10) ?? null,
          certificateNo: row.training_result.certificate_no,
        }
      : null,
    plan: {
      assessment: {
        preTest: withEnrollmentStageInfo(
          assessmentStage(pre.id, pre.link),
          "PRE_TEST",
          plan.start_datetime,
          plan.end_datetime,
          closedAtByStage.get("PRE_TEST") ?? null,
          latestAssessmentSubmission(preAssessmentId, "PRE_TEST"),
        ),
        postTest: withEnrollmentStageInfo(
          assessmentStage(post.id, post.link),
          "POST_TEST",
          plan.start_datetime,
          plan.end_datetime,
          closedAtByStage.get("POST_TEST") ?? null,
          latestAssessmentSubmission(postAssessmentId, "POST_TEST"),
        ),
        evaluation: withEnrollmentStageInfo(
          assessmentStage(evaluation.id, evaluation.link),
          "EVALUATION",
          plan.start_datetime,
          plan.end_datetime,
          null,
          evaluationSubmission(evaluationFormId),
        ),
        evaluationAfter30Day: withEnrollmentStageInfo(
          assessmentStage(evaluation30.id, evaluation30.link),
          "EVALUATION_30DAY",
          plan.start_datetime,
          plan.end_datetime,
          null,
          evaluationSubmission(evaluationForm30DayId),
        ),
      },
      // 0 is stored the same as null elsewhere in the codebase: "no validity period".
      validityMonths:
        oap.course.validity_months && oap.course.validity_months > 0
          ? oap.course.validity_months
          : null,
      planCode: plan.plan_code,
      planName: plan.plan_name,
      batchName: plan.batch_name || `Batch ${plan.batch_no}`,
      courseCode: oap.course.course_code,
      courseName: oap.course_name_snapshot,
      hours: oap.planned_duration_hours,
      instructor: oap.instructor_name_text || "",
      provider: oap.provider_name_text || "",
      venue: plan.venue || "",
      startAt: plan.start_datetime.toISOString(),
      endAt: plan.end_datetime.toISOString(),
      owner: planOwnerIsFactory ? ("FACTORY" as const) : ("CENTER" as const),
    },
    employeeId: employee.employee_id.toString(),
    // Carried through so the layers above can move to the durable key without another query.
    employeeUserId: row.employee_user_id ?? employee.user_id ?? null,
    employeeCode: employee.employee_code ?? "",
    employeeName: employeeDisplayName(employee),
    prefix: employee.title_th || employee.title_en || "",
    firstName: employee.first_name_th || employee.first_name_en || "",
    lastName: employee.last_name_th || employee.last_name_en || "",
    company: employee.company.company_code,
    section: employee.section?.section_name_th || employee.section?.section_name_en || "",
    division: employee.division?.division_name_th || employee.division?.division_name_en || "",
    department: employee.organization_function?.function_name_en || employee.organization_function?.function_name_th || employee.department?.department_name_th || "",
    position: employee.position?.position_name_en || employee.position?.position_name_th || "",
    // level_key is a Thai abbreviation (จ/บ/ป + number), not an English code despite the
    // name — level_code ("S1"/"O1"/"M1"..."M4") is the real English code and must come first.
    level: employee.employee_level?.level_code || employee.employee_level?.level_code_en || employee.employee_level?.level_name_en || employee.employee_level?.level_key || employee.employee_level?.level_code_th || "",
    source: row.enrollment_source as EnrollmentSource,
    status: mapStatus(row.approval_status, planOwnerIsFactory),
    targetMatchStatus: row.target_match_status as "MATCHED" | "NOT_MATCHED",
    levelMatchStatus: row.level_match_status as "MATCHED" | "NOT_MATCHED" | "NOT_REQUIRED",
    remark: row.reject_reason || row.queue_override_reason || "",
    enrolledAt: row.enrolled_at.toISOString(),
    approvedBy: row.approved_by?.toString() || null,
    approvedAt: row.approved_at?.toISOString() || null,
    attendance: row.attendance
      ? {
          attendanceId: row.attendance.attendance_id.toString(),
          status: row.attendance.attendance_status as AttendanceStatus,
          checkInAt: row.attendance.check_in_at?.toISOString() || null,
          checkOutAt: row.attendance.check_out_at?.toISOString() || null,
          method: row.attendance.attendance_method,
          recordedBy: row.attendance.recorded_by?.toString() || null,
          remark: row.attendance.remark || "",
        }
      : null,
  };
};

export const computeTargetMatch = async (
  db: DatabaseClient,
  courseId: bigint,
  employee: EmployeeWithRelations,
) => {
  const standards = await db.course_standard_course.findMany({
    where: { course_id: courseId },
    include: {
      course_standard_target_position: true,
      course_standard_target_level: true,
      course_standard_target_company: true,
    },
  });

  if (standards.length === 0) {
    return { targetMatchStatus: "NOT_MATCHED" as const, levelMatchStatus: "NOT_REQUIRED" as const, standardCourseId: null as bigint | null };
  }

  let matchedStandardId: bigint | null = null;
  let overallTargetMatched = false;
  let overallHasLevels = false;
  let overallLevelMatched = false;

  for (const standard of standards) {
    const hasLevels = standard.course_standard_target_level.length > 0;
    const hasPositions = standard.course_standard_target_position.length > 0;

    if (hasLevels) overallHasLevels = true;

    const isLevelMatched =
      hasLevels &&
      employee.level_id !== null &&
      standard.course_standard_target_level.some((row) => row.level_id === employee.level_id);

    if (isLevelMatched) overallLevelMatched = true;

    const isPositionMatched =
      hasPositions &&
      employee.position_id !== null &&
      standard.course_standard_target_position.some((row) => row.position_id === employee.position_id);

    let posLevelMatch = true;
    if (hasLevels && hasPositions) {
      posLevelMatch = isLevelMatched && isPositionMatched;
    } else if (hasLevels) {
      posLevelMatch = isLevelMatched;
    } else if (hasPositions) {
      posLevelMatch = isPositionMatched;
    }

    const orgMatch =
      (standard.function_id === null || standard.function_id === employee.function_id) &&
      (standard.division_id === null || standard.division_id === employee.division_id) &&
      (standard.department_id === null || standard.department_id === employee.department_id) &&
      (standard.section_id === null || standard.section_id === employee.section_id);

    const companyMatch =
      standard.course_standard_target_company.length === 0 ||
      standard.course_standard_target_company.some((row) => row.company_id === employee.company_id);

    if (orgMatch && companyMatch && posLevelMatch) {
      overallTargetMatched = true;
      matchedStandardId = standard.standard_course_id;
      break;
    }
  }

  const targetMatchStatus = overallTargetMatched ? ("MATCHED" as const) : ("NOT_MATCHED" as const);
  const levelMatchStatus = !overallHasLevels
    ? ("NOT_REQUIRED" as const)
    : overallLevelMatched
      ? ("MATCHED" as const)
      : ("NOT_MATCHED" as const);

  return {
    targetMatchStatus,
    levelMatchStatus,
    standardCourseId: matchedStandardId ?? standards[0].standard_course_id,
  };
};

/**
 * Prerequisites for `courseId` the employee has not completed. Empty means clear to register.
 * "Completed" is training_result.completion_status = COMPLETED - the only record of a finished
 * course this system keeps. valid_until is deliberately not checked: once passed, always passed.
 */
export const missingPrerequisites = async (
  db: DatabaseClient,
  courseId: bigint,
  employeeUserId: string,
): Promise<Array<{ courseCode: string; courseName: string }>> => {
  const prerequisites = await db.course_prerequisite.findMany({
    where: { course_id: courseId },
    include: { prerequisite_course: { select: { course_code: true, course_name: true } } },
  });
  if (prerequisites.length === 0) return [];

  const completed = await db.training_result.findMany({
    where: {
      completion_status: "COMPLETED",
      training_enrollment: {
        employee_user_id: employeeUserId,
        training_plan: {
          training_plan_oap: { course_id: { in: prerequisites.map((p) => p.prerequisite_course_id) } },
        },
      },
    },
    select: {
      training_enrollment: {
        select: { training_plan: { select: { training_plan_oap: { select: { course_id: true } } } } },
      },
    },
  });
  const completedCourseIds = new Set(
    completed.map((row) => row.training_enrollment.training_plan.training_plan_oap.course_id.toString()),
  );

  return prerequisites
    .filter((p) => !completedCourseIds.has(p.prerequisite_course_id.toString()))
    .map((p) => ({ courseCode: p.prerequisite_course.course_code, courseName: p.prerequisite_course.course_name }));
};

const loadPlanScope = async (db: DatabaseClient, planId: bigint) => {
  const plan = await db.training_plan.findUniqueOrThrow({
    where: { plan_id: planId },
    include: { training_plan_oap: { select: { course_id: true, company_id: true } } },
  });
  return { courseId: plan.training_plan_oap.course_id, companyId: plan.training_plan_oap.company_id };
};

const assertFactoryScopeForEnrollment = (
  planCompanyId: bigint | null,
  employeeCompanyId: bigint | null,
  requesterCompanyId: string | null,
) => {
  if (requesterCompanyId === null) {
    throw forbidden("This training plan or employee is outside your permitted scope");
  }
  const isOwnPlan = planCompanyId !== null && planCompanyId.toString() === requesterCompanyId;
  const isOwnEmployee = employeeCompanyId !== null && employeeCompanyId.toString() === requesterCompanyId;

  if (!isOwnPlan && !isOwnEmployee) {
    throw forbidden("This training plan or employee is outside your permitted scope");
  }
};

export type EnrollmentRepository = ReturnType<typeof createEnrollmentRepository>;
export const createEnrollmentRepository = (client?: DatabaseClient) => {
  const db = () => (client ?? getPrismaClient()) as unknown as DatabaseClient & PrismaClient;
  return {
    async list(filters: EnrollmentListFilters, companyId: string | null) {
      const where: Prisma.training_enrollmentWhereInput = {};
      if (filters.planId) where.plan_id = BigInt(filters.planId);
      // The durable key wins when the caller supplies it; employee_id remains the legacy filter.
      if (filters.employeeUserId) where.employee_user_id = filters.employeeUserId;
      else if (filters.employeeId) where.employee = { employee_id: BigInt(filters.employeeId) };
      if (companyId) {
        // A factory HRD needs visibility into both directions: enrollments under a plan
        // their own company owns (any employee), and their own employees' enrollments
        // under a plan owned by someone else (e.g. submitted to a Center-owned course).
        where.OR = [
          { training_plan: { training_plan_oap: { company_id: BigInt(companyId) } } },
          { employee: { company_id: BigInt(companyId) } },
        ];
      }

      return withDatabaseErrorMapping(async () => {
        const rows = await db().training_enrollment.findMany({
          where,
          include: enrollmentInclude,
          orderBy: { enrolled_at: "asc" },
        });
        return rows.map(mapEnrollment);
      });
    },

    async create(input: CreateEnrollmentInput, userId: string, role: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const planId = BigInt(input.planId);
        const { courseId, companyId: planCompanyId } = await loadPlanScope(db(), planId);
        // Resolve by the durable key when the caller sent one, otherwise by the surrogate id.
        const employee = input.employeeUserId
          ? await db().employee.findUniqueOrThrow({ where: { user_id: input.employeeUserId }, include: employeeInclude })
          : await db().employee.findUniqueOrThrow({ where: { employee_id: BigInt(input.employeeId) }, include: employeeInclude });

        if (role === "HRD_FACTORY") {
          assertFactoryScopeForEnrollment(planCompanyId, employee.company_id, companyId);
        }

        const { targetMatchStatus, levelMatchStatus, standardCourseId } = await computeTargetMatch(db(), courseId, employee);

        if (!input.acknowledgePrerequisite) {
          const missing = await missingPrerequisites(db(), courseId, employee.user_id);
          if (missing.length > 0) {
            throw new ApiError({
              code: "PREREQUISITE_NOT_MET",
              message: `This employee has not completed ${missing.map((c) => c.courseCode).join(", ")} yet`,
              status: 409,
              // ApiErrorDetails only allows scalars, so the missing list rides as two parallel
              // comma-joined strings - the UI zips them back together to build the confirm prompt.
              details: {
                missingCourseCodes: missing.map((c) => c.courseCode).join(","),
                missingCourseNames: missing.map((c) => c.courseName).join(","),
              },
            });
          }
        }

        const isOwnFactoryPlan = planCompanyId !== null && companyId !== null && planCompanyId.toString() === companyId;
        const autoApprove = role === "HRD_CENTER" || (role === "HRD_FACTORY" && isOwnFactoryPlan);

        const data: Prisma.training_enrollmentUncheckedCreateInput = {
          plan_id: planId,
          // employee_id is gone from this table (Phase 20 Stage 8); the durable key is the link.
          employee_user_id: employee.user_id,
          enrollment_source: input.source,
          approval_status: autoApprove ? "APPROVED" : "PENDING",
          standard_course_id: standardCourseId,
          position_id_snapshot: employee.position_id,
          position_code_snapshot: employee.position?.position_code || null,
          position_name_snapshot: employee.position?.position_name_en || employee.position?.position_name_th || null,
          level_id_snapshot: employee.level_id,
          level_code_snapshot: employee.employee_level?.level_code || employee.employee_level?.level_code_en || employee.employee_level?.level_key || null,
          level_name_snapshot: employee.employee_level?.level_name_en || employee.employee_level?.level_name_th || null,
          target_match_status: targetMatchStatus,
          level_match_status: levelMatchStatus,
          target_checked_at: new Date(),
          enrolled_at: new Date(),
          approved_by: autoApprove ? BigInt(userId) : null,
          approved_at: autoApprove ? new Date() : null,
        };

        const existing = await db().training_enrollment.findUnique({
          where: { plan_id_employee_user_id: { plan_id: planId, employee_user_id: employee.user_id } },
        });

        const saved = existing
          ? await db().training_enrollment.update({ where: { enrollment_id: existing.enrollment_id }, data, include: enrollmentInclude })
          : await db().training_enrollment.create({ data, include: enrollmentInclude });

        return mapEnrollment(saved);
      });
    },

    async updateStatus(
      id: string,
      action: EnrollmentAction,
      reason: string | undefined,
      userId: string,
      role: string,
      companyId: string | null,
      requesterEmployeeId: string | null,
      requesterEmployeeUserId: string | null,
    ) {
      return withDatabaseErrorMapping(async () => {
        const enrollmentId = BigInt(id);
        const current = await db().training_enrollment.findUniqueOrThrow({
          where: { enrollment_id: enrollmentId },
          include: enrollmentInclude,
        });

        if (role === "HRD_FACTORY") {
          assertFactoryScopeForEnrollment(
            current.training_plan.training_plan_oap.company_id,
            current.employee.company_id,
            companyId,
          );
        } else if (role === "EMPLOYEE") {
          // Same rule as requireEmployeeOwnership: either key may prove it, neither may be assumed.
          const ownsByDurableKey =
            requesterEmployeeUserId !== null &&
            current.employee_user_id !== null &&
            current.employee_user_id === requesterEmployeeUserId;
          const ownsBySurrogateKey =
            requesterEmployeeId !== null &&
            current.employee.employee_id.toString() === requesterEmployeeId;

          if (action !== "cancel" || (!ownsByDurableKey && !ownsBySurrogateKey)) {
            throw forbidden("You can only withdraw your own registration");
          }
        }

        if (action === "cancel") {
          // Cancelling really does destroy the record and its results, attendance and submissions —
          // confirmed as intended, not an oversight, so do not "fix" this into a soft delete. The
          // schema's CANCELLED status is deliberately unused.
          await db().$transaction(async (tx) => {
            // No .catch here: deleteMany on zero rows does not throw, so swallowing an error only
            // hid a poisoned transaction and made the failure surface against the wrong table.
            await tx.training_result.deleteMany({ where: { enrollment_id: enrollmentId } });
            await tx.attendance.deleteMany({ where: { enrollment_id: enrollmentId } });
            await tx.evaluation_submission.deleteMany({ where: { enrollment_id: enrollmentId } });
            await tx.assessment_submission.deleteMany({ where: { enrollment_id: enrollmentId } });
            await tx.training_enrollment.delete({ where: { enrollment_id: enrollmentId } });
          });
          // The row is gone, so there is no enrollment to return and no stored status to report.
          // This used to answer with approval_status "CANCELLED" — a value the database never held.
          return { enrollmentId: id, outcome: "DELETED" as const };
        }

        const data: Prisma.training_enrollmentUncheckedUpdateInput = {};
        if (action === "approve") {
          data.approval_status = "APPROVED";
          data.approved_by = BigInt(userId);
          data.approved_at = new Date();
          data.reject_reason = null;
        } else if (action === "reject") {
          data.approval_status = "REJECTED";
          data.approved_by = BigInt(userId);
          data.approved_at = new Date();
          data.reject_reason = reason || null;
        }

        const updated = await db().training_enrollment.update({ where: { enrollment_id: enrollmentId }, data, include: enrollmentInclude });
        return mapEnrollment(updated);
      });
    },

    async setAttendance(id: string, attended: boolean, userId: string, role: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const enrollmentId = BigInt(id);
        const current = await db().training_enrollment.findUniqueOrThrow({
          where: { enrollment_id: enrollmentId },
          include: enrollmentInclude,
        });

        if (role === "HRD_FACTORY") {
          assertFactoryScopeForEnrollment(
            current.training_plan.training_plan_oap.company_id,
            current.employee.company_id,
            companyId,
          );
        }

        if (!attended) {
          if (current.attendance) {
            await db().attendance.delete({ where: { enrollment_id: enrollmentId } });
          }
        } else {
          await db().attendance.upsert({
            where: { enrollment_id: enrollmentId },
            create: {
              enrollment_id: enrollmentId,
              attendance_status: "PRESENT",
              attendance_method: "MANUAL",
              check_in_at: new Date(),
              recorded_by: BigInt(userId),
            },
            update: {
              attendance_status: "PRESENT",
              check_in_at: new Date(),
              recorded_by: BigInt(userId),
            },
          });
        }

        const updated = await db().training_enrollment.findUniqueOrThrow({ where: { enrollment_id: enrollmentId }, include: enrollmentInclude });
        return mapEnrollment(updated);
      });
    },
  };
};

export const enrollmentRepository = createEnrollmentRepository();
