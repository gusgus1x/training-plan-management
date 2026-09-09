import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import type { AuthenticatedPrincipal } from "../auth/types";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import { isSectionHeadOrAbove } from "../employeeMasterData";
import { assessmentStage } from "../trainingEnrollment/types";
import {
  EXPENSE_CATEGORIES,
  type CostBreakdown,
  type ExpenseCategory,
  type CompletionStatus,
  type ReviewerCandidate,
  type SaveExpensesInput,
  type SaveResultsInput,
  type SaveReviewersInput,
  type TrainingRecordExpenses,
  type TrainingRecordSummary,
} from "./types";

type DatabaseClient = Pick<
  PrismaClient,
  "training_plan" | "training_expense" | "training_result" | "employee" | "training_evaluation_reviewer"
>;

/** How many matches are read before the position rules narrow them, and how many survive. The scan
 *  limit is what keeps a two-letter search from loading the whole company. */
const REVIEWER_SEARCH_SCAN_LIMIT = 200;
const REVIEWER_SEARCH_RESULT_LIMIT = 20;

/** The section-head list, for the dropdown that offers every one of them without typing anything.
 *
 * These match on the POSITION alone, unlike isSectionHeadOrAbove, which also promotes people by
 * level and by manager-and-above titles. That is deliberate: the dropdown answers "who are the
 * section heads", so a plant manager appearing in it would be wrong. Anyone the list misses is
 * still reachable by typing a name, which uses the wider rule.
 *
 * It runs as a WHERE clause rather than in JavaScript because this list has no search text to
 * bound it - filtering after the fact would silently drop every head past the scan limit.
 */
const SECTION_HEAD_POSITION_CODES = ["SH"];
const SECTION_HEAD_POSITION_NAMES = ["section head", "sectionhead", "หัวหน้าแผนก"];
const REVIEWER_LIST_LIMIT = 200;

const EXPENSE_KEY_TO_CATEGORY: Record<keyof SaveExpensesInput, ExpenseCategory> = {
  accommodation: "ACCOMMODATION",
  foodBeverage: "FOOD_BEVERAGE",
  instructor: "INSTRUCTOR",
  material: "MATERIAL",
  seminarRoom: "SEMINAR_ROOM",
  traveling: "TRAVELING",
};
const CATEGORY_TO_EXPENSE_KEY = Object.fromEntries(
  Object.entries(EXPENSE_KEY_TO_CATEGORY).map(([key, category]) => [category, key]),
) as Record<ExpenseCategory, keyof SaveExpensesInput>;

const employeeInclude = {
  company: true,
  organization_function: true,
  // All four organisation levels, in whichever language the screen is in. The roster shows them as
  // four columns because they are four different things - organization_function above is not the
  // department, which is what the old single column had been showing under that heading.
  division: true,
  department: true,
  section: true,
  // The mapper always read a position, but the relation was never loaded, so every attendee's
  // position came back empty and the column showed "-" for the whole roster. The `as any` cast on
  // the read is what kept the compiler quiet about it.
  position: true,
} satisfies Prisma.employeeInclude;

/** What the reviewer picker shows. Division/department/section are here and not on employeeInclude
 *  because only the reviewer is chosen by org unit; the attendee roster never displays them. */
const reviewerEmployeeInclude = {
  position: true,
  // The picker shows and filters by company: a centre HRD user chooses across all of them.
  company: true,
  division: true,
  department: true,
  section: true,
  // Read by isSectionHeadOrAbove, which ranks by level when the position name says nothing useful.
  employee_level: true,
} satisfies Prisma.employeeInclude;

const trainingRecordInclude = {
  training_plan_oap: {
    select: {
      company_id: true,
      // How the course is evaluated. Without it the report cannot tell "nobody has filled the
      // evaluation in yet" apart from "this course has no evaluation to fill in".
      course: {
        select: {
          evaluation_form_id: true,
          evaluation_link: true,
          // The 30-day follow-up is the stage a supervisor is asked to fill in, so the reviewer
          // panel needs to know whether it is a form, a link, or absent.
          evaluation_form_after_30day_id: true,
          evaluation_after_30day_link: true,
        },
      },
    },
  },
  training_expense: true,
  training_enrollment: {
    where: { approval_status: "APPROVED" },
    include: {
      employee: { include: employeeInclude },
      attendance: true,
      assessment_submission: true,
      evaluation_submission: true,
      training_result: true,
      training_evaluation_reviewer: { include: { reviewer: { include: reviewerEmployeeInclude } } },
    },
  },
} satisfies Prisma.training_planInclude;

type TrainingRecordPlan = Prisma.training_planGetPayload<{ include: typeof trainingRecordInclude }>;

const employeeDisplayName = (employee: TrainingRecordPlan["training_enrollment"][number]["employee"]) =>
  `${employee.first_name_th} ${employee.last_name_th}`.trim() ||
  `${employee.first_name_en || ""} ${employee.last_name_en || ""}`.trim();

/** The picker fields for one employee, from any read that included reviewerEmployeeInclude. */
const reviewerCandidate = (
  employee: Prisma.employeeGetPayload<{ include: typeof reviewerEmployeeInclude }>,
): ReviewerCandidate => ({
  reviewerUserId: employee.user_id,
  employeeCode: employee.employee_code ?? "",
  name:
    `${employee.first_name_th} ${employee.last_name_th}`.trim() ||
    `${employee.first_name_en || ""} ${employee.last_name_en || ""}`.trim(),
  position: employee.position?.position_name_th || employee.position?.position_name_en || "",
  company: employee.company.company_code,
  division: employee.division?.division_name_th || employee.division?.division_name_en || "",
  department: employee.department?.department_name_th || employee.department?.department_name_en || "",
  section: employee.section?.section_name_th || employee.section?.section_name_en || "",
});

const mapTrainingRecord = (row: TrainingRecordPlan): TrainingRecordSummary => {
  const expenses = {
    accommodation: 0,
    foodBeverage: 0,
    instructor: 0,
    material: 0,
    seminarRoom: 0,
    traveling: 0,
  };
  let savedAt: Date | null = null;
  for (const expense of row.training_expense) {
    const key = CATEGORY_TO_EXPENSE_KEY[expense.expense_category as ExpenseCategory];
    if (key) expenses[key] = Number(expense.amount);
    if (!savedAt || expense.created_at > savedAt) savedAt = expense.created_at;
  }

  const attendees = row.training_enrollment.map((enrollment) => {
    const submittedAssessments = enrollment.assessment_submission.filter((s) => s.submitted_at !== null);
    const latestByStage = (stage: string) =>
      submittedAssessments
        .filter((s) => s.assessment_stage === stage)
        .sort((a, b) => b.attempt_no - a.attempt_no)[0];
    const preTest = latestByStage("PRE_TEST");
    const postTest = latestByStage("POST_TEST");
    const assignment = enrollment.training_evaluation_reviewer;

    return {
      enrollmentId: enrollment.enrollment_id.toString(),
      employeeId: enrollment.employee.employee_id.toString(),
      employeeUserId: enrollment.employee_user_id,
      employeeCode: enrollment.employee.employee_code ?? "",
      name: employeeDisplayName(enrollment.employee),
      department:
        enrollment.employee.organization_function?.function_name_en ||
        enrollment.employee.organization_function?.function_name_th ||
        "",
      position:
        enrollment.employee.position?.position_name_en ||
        enrollment.employee.position?.position_name_th ||
        "",
      company: enrollment.employee.company.company_code,
      orgUnit: {
        functionTh: enrollment.employee.organization_function?.function_name_th ?? "",
        functionEn: enrollment.employee.organization_function?.function_name_en ?? "",
        divisionTh: enrollment.employee.division?.division_name_th ?? "",
        divisionEn: enrollment.employee.division?.division_name_en ?? "",
        departmentTh: enrollment.employee.department?.department_name_th ?? "",
        departmentEn: enrollment.employee.department?.department_name_en ?? "",
        sectionTh: enrollment.employee.section?.section_name_th ?? "",
        sectionEn: enrollment.employee.section?.section_name_en ?? "",
      },
      // PRESENT only, matching Training Actual and the cost breakdown. Counting any attendance row
      // meant somebody marked ABSENT was still reported as having attended.
      attended: enrollment.attendance?.attendance_status === "PRESENT",
      preTestPassed: preTest ? preTest.pass_status?.toUpperCase() === "PASS" : null,
      postTestPassed: postTest ? postTest.pass_status?.toUpperCase() === "PASS" : null,
      // The attendee's OWN submission only. Since a reviewer answers the same form about the same
      // enrollment, counting every submission here would report the attendee as done the moment
      // their supervisor answered.
      evaluationCompleted: enrollment.evaluation_submission.some(
        (e) => e.submitted_at !== null && e.respondent_user_id === enrollment.employee_user_id,
      ),
      result: enrollment.training_result
        ? {
            enrollmentId: enrollment.enrollment_id.toString(),
            // Decimal comes back as an object; Number() keeps null distinct from 0, which is the
            // difference between "not graded" and "scored nothing".
            preScore:
              enrollment.training_result.pre_score === null
                ? null
                : Number(enrollment.training_result.pre_score),
            postScore:
              enrollment.training_result.post_score === null
                ? null
                : Number(enrollment.training_result.post_score),
            completionStatus: enrollment.training_result.completion_status as CompletionStatus,
            completedAt: enrollment.training_result.completed_at?.toISOString() ?? null,
            validUntil: enrollment.training_result.valid_until?.toISOString().slice(0, 10) ?? null,
            certificateNo: enrollment.training_result.certificate_no,
          }
        : null,
      reviewer: assignment
        ? {
            ...reviewerCandidate(assignment.reviewer),
            assignedAt: assignment.assigned_at.toISOString(),
            openedAt: assignment.opened_at?.toISOString() ?? null,
            submitted: enrollment.evaluation_submission.some(
              (e) => e.submitted_at !== null && e.respondent_user_id === assignment.reviewer_user_id,
            ),
          }
        : null,
    };
  });

  return {
    planId: row.plan_id.toString(),
    evaluation: assessmentStage(
      row.training_plan_oap.course.evaluation_form_id,
      row.training_plan_oap.course.evaluation_link,
    ),
    // The batch's own choice wins over the course's, matching formIdForStage in
    // trainingForms/repository.ts - a batch that points this stage somewhere else has opted out of
    // the course's form, and the reviewer must be sent to what the attendee's own screens use.
    evaluationAfter30Day: assessmentStage(
      row.evaluation_form_after_30day_id ??
        (row.evaluation_after_30day_link?.trim()
          ? null
          : row.training_plan_oap.course.evaluation_form_after_30day_id),
      row.evaluation_after_30day_link ?? row.training_plan_oap.course.evaluation_after_30day_link,
    ),
    registeredCount: attendees.length,
    attendedCount: attendees.filter((a) => a.attended).length,
    expenses,
    preTestPassCount: attendees.filter((a) => a.preTestPassed).length,
    // A recorded result counts as a pass even when no test was taken: most courses have no test,
    // and counting only submissions reported 0% passed on a roster HRD had just marked as passed.
    postTestPassCount: attendees.filter(
      (a) => a.result?.completionStatus === "COMPLETED" || a.postTestPassed,
    ).length,
    evaluationCompletedCount: attendees.filter((a) => a.evaluationCompleted).length,
    attendees,
    savedAt: (savedAt ?? new Date(0)).toISOString(),
  };
};

export type TrainingRecordRepository = ReturnType<typeof createTrainingRecordRepository>;
export const createTrainingRecordRepository = (client?: DatabaseClient) => {
  const db = () => (client ?? getPrismaClient()) as PrismaClient;
  return {
    async list(companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        // A training that happened leaves one of three traces. Requiring an expense row hid every
        // course that cost nothing - an internal trainer, a supplier running it free - along with
        // any results recorded against it, and saving all-zero expenses deleted the rows and made
        // a plan disappear from this page entirely.
        const where: Prisma.training_planWhereInput = {
          OR: [
            { training_expense: { some: {} } },
            { training_enrollment: { some: { training_result: { isNot: null } } } },
            { status: "COMPLETED" },
          ],
        };
        if (companyId) {
          where.AND = [
            {
              OR: [
                {
                  training_plan_oap: {
                    company_id: BigInt(companyId),
                  },
                },
                {
                  training_plan_oap: {
                    company_id: null,
                  },
                  training_enrollment: {
                    some: {
                      employee: {
                        company_id: BigInt(companyId),
                      },
                      attendance: {
                        isNot: null,
                      },
                    },
                  },
                },
              ],
            },
          ];
        }
        const rows = await db().training_plan.findMany({
          where,
          include: trainingRecordInclude,
          orderBy: { plan_id: "desc" },
        });
        return rows.map(mapTrainingRecord);
      });
    },

    async saveExpenses(planId: string, input: SaveExpensesInput, userId: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const id = BigInt(planId);
        const plan = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: id },
          include: { training_plan_oap: { select: { company_id: true } } },
        });
        if (companyId && (plan.training_plan_oap.company_id === null || plan.training_plan_oap.company_id?.toString() !== companyId)) {
          throw new ApiError({ code: "FORBIDDEN", message: "This training plan belongs to a different company or center scope", status: 403 });
        }

        const rows = EXPENSE_CATEGORIES.map((category) => {
          const key = CATEGORY_TO_EXPENSE_KEY[category];
          return { key, category, amount: input[key] };
        }).filter((row) => row.amount > 0);

        await db().$transaction(async (tx) => {
          await tx.training_expense.deleteMany({ where: { plan_id: id } });
          if (rows.length) {
            await tx.training_expense.createMany({
              data: rows.map((row) => ({
                plan_id: id,
                expense_category: row.category,
                amount: row.amount,
                recorded_by: BigInt(userId),
                created_at: new Date(),
              })),
            });
          }
          await tx.training_plan.update({
            where: { plan_id: id },
            data: { status: "COMPLETED", updated_at: new Date() },
          });
        });

        const updated = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: id },
          include: trainingRecordInclude,
        });
        return mapTrainingRecord(updated);
      });
    },

    // Nothing in this codebase ever wrote a training_result before this: the three places that
    // named the table all deleted from it. Attendance was where the pipeline stopped, which is why
    // certificates, scores and the result report were all empty.
    async saveResults(planId: string, input: SaveResultsInput, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const id = BigInt(planId);
        const plan = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: id },
          include: {
            training_plan_oap: { select: { company_id: true } },
            training_enrollment: {
              where: { approval_status: "APPROVED" },
              select: { enrollment_id: true, attendance: { select: { attendance_status: true } } },
            },
          },
        });

        if (
          companyId &&
          (plan.training_plan_oap.company_id === null ||
            plan.training_plan_oap.company_id?.toString() !== companyId)
        ) {
          throw new ApiError({
            code: "FORBIDDEN",
            message: "This training plan belongs to a different company or center scope",
            status: 403,
          });
        }

        const attendanceByEnrollment = new Map(
          plan.training_enrollment.map((enrollment) => [
            enrollment.enrollment_id.toString(),
            enrollment.attendance?.attendance_status ?? null,
          ]),
        );

        for (const row of input.results) {
          // Refuse a result for someone who is not on this plan's approved roster, rather than
          // letting an id from another plan through and writing a result nobody can explain.
          if (!attendanceByEnrollment.has(row.enrollmentId)) {
            throw new ApiError({
              code: "ENROLLMENT_NOT_ON_PLAN",
              message: `Enrollment ${row.enrollmentId} is not an approved enrollment on this plan`,
              status: 409,
            });
          }
          // A completion for someone the attendance sheet says never came is a claim the record
          // cannot support - and this record is what an employee downloads as evidence.
          const attendance = attendanceByEnrollment.get(row.enrollmentId);
          if (row.completionStatus === "COMPLETED" && attendance !== "PRESENT" && attendance !== "LATE") {
            throw new ApiError({
              code: "ATTENDANCE_REQUIRED",
              message: `Enrollment ${row.enrollmentId} cannot be completed without attendance`,
              status: 409,
            });
          }
        }

        // certificate_no is unique across the whole table. Left to the database this surfaces as a
        // generic conflict, and on a save of thirty rows HRD would not know which certificate
        // clashed. Check it here so the message can name it.
        const certificates = input.results
          .map((row) => row.certificateNo)
          .filter((value): value is string => value !== null);
        const duplicateInPayload = certificates.find(
          (value, index) => certificates.indexOf(value) !== index,
        );
        if (duplicateInPayload) {
          throw new ApiError({
            code: "CERTIFICATE_CONFLICT",
            message: `Certificate number ${duplicateInPayload} is used twice in this save`,
            status: 409,
          });
        }

        if (certificates.length > 0) {
          const taken = await db().training_result.findMany({
            where: {
              certificate_no: { in: certificates },
              enrollment_id: { notIn: input.results.map((row) => BigInt(row.enrollmentId)) },
            },
            select: { certificate_no: true },
          });
          if (taken.length > 0) {
            throw new ApiError({
              code: "CERTIFICATE_CONFLICT",
              message: `Certificate number ${taken[0].certificate_no} already belongs to another training result`,
              status: 409,
            });
          }
        }

        const now = new Date();
        await db().$transaction(async (tx) => {
          for (const row of input.results) {
            const enrollmentId = BigInt(row.enrollmentId);
            const data = {
              pre_score: row.preScore,
              post_score: row.postScore,
              completion_status: row.completionStatus,
              // Owned by the status, not by the caller: a row that stops being COMPLETED must not
              // keep the date it was completed on.
              completed_at: row.completionStatus === "COMPLETED" ? now : null,
              valid_until: row.validUntil ? new Date(`${row.validUntil}T00:00:00Z`) : null,
              certificate_no: row.certificateNo,
            };

            await tx.training_result.upsert({
              where: { enrollment_id: enrollmentId },
              create: { enrollment_id: enrollmentId, ...data },
              update: data,
            });
          }
        });

        const updated = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: id },
          include: trainingRecordInclude,
        });
        return mapTrainingRecord(updated);
      });
    },

    /**
     * People HRD can pick as a reviewer.
     *
     * With no search text this is the section-head list: everyone whose POSITION says section head,
     * which is what the dropdown offers. With search text it is a wider net - isSectionHeadOrAbove,
     * which also promotes people by level and by manager-and-above titles - so a head whose
     * position record does not say so can still be found by name.
     *
     * That wider rule reads position code, position name and level together, which cannot be
     * expressed as a WHERE clause, so it runs in JavaScript over a capped fetch. The section-head
     * list cannot work that way: with no search text to bound it, filtering after the fetch would
     * silently drop every head past the cap.
     */
    async listReviewerCandidates(search: string, companyId: string | null): Promise<ReviewerCandidate[]> {
      return withDatabaseErrorMapping(async () => {
        if (search === "") {
          const heads = await db().employee.findMany({
            where: {
              employment_status: "ACTIVE",
              ...(companyId ? { company_id: BigInt(companyId) } : {}),
              position: {
                OR: [
                  { position_code: { in: SECTION_HEAD_POSITION_CODES } },
                  ...SECTION_HEAD_POSITION_NAMES.flatMap((name) => [
                    { position_name_th: { contains: name } },
                    { position_name_en: { contains: name } },
                  ]),
                ],
              },
            },
            include: reviewerEmployeeInclude,
            orderBy: [{ first_name_th: "asc" }, { last_name_th: "asc" }],
            take: REVIEWER_LIST_LIMIT,
          });
          return heads.map(reviewerCandidate);
        }

        const rows = await db().employee.findMany({
          where: {
            employment_status: "ACTIVE",
            ...(companyId ? { company_id: BigInt(companyId) } : {}),
            OR: [
              { first_name_th: { contains: search } },
              { last_name_th: { contains: search } },
              { first_name_en: { contains: search } },
              { last_name_en: { contains: search } },
              { employee_code: { contains: search } },
            ],
          },
          include: reviewerEmployeeInclude,
          orderBy: [{ first_name_th: "asc" }, { last_name_th: "asc" }],
          take: REVIEWER_SEARCH_SCAN_LIMIT,
        });

        return rows
          .filter((employee) =>
            isSectionHeadOrAbove({
              positionCode: employee.position?.position_code ?? null,
              positionName: employee.position?.position_name_en ?? employee.position?.position_name_th ?? null,
              levelCode: employee.employee_level?.level_code ?? null,
              levelKey: employee.employee_level?.level_key ?? null,
              levelName: employee.employee_level?.level_name_en ?? employee.employee_level?.level_name_th ?? null,
            }),
          )
          .slice(0, REVIEWER_SEARCH_RESULT_LIMIT)
          .map(reviewerCandidate);
      });
    },

    /**
     * Replaces the reviewer of every attendee named in `input`. Attendees left out keep whatever
     * they have - the screen sends the basket, not the whole roster.
     *
     * Assignments are written in one transaction so a half-saved basket cannot exist. Reassigning
     * does not touch anything the previous reviewer already submitted: that submission stays
     * attributed to the person who actually wrote it.
     */
    async saveReviewers(planId: string, input: SaveReviewersInput, userId: string, companyId: string | null) {
      return withDatabaseErrorMapping(async () => {
        const id = BigInt(planId);
        const plan = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: id },
          include: {
            training_plan_oap: { select: { company_id: true } },
            training_enrollment: { where: { approval_status: "APPROVED" }, select: { enrollment_id: true } },
          },
        });
        if (
          companyId &&
          (plan.training_plan_oap.company_id === null ||
            plan.training_plan_oap.company_id?.toString() !== companyId)
        ) {
          throw new ApiError({
            code: "FORBIDDEN",
            message: "This training plan belongs to a different company or center scope",
            status: 403,
          });
        }

        // An assignment whose reviewer has already answered is closed. Their submission is filed
        // against them by name, so moving the assignment to somebody else would leave answers
        // credited to a person the record no longer says was asked. Checked here rather than only
        // on screen, because the screen is not the thing that protects the data.
        const answered = await db().training_evaluation_reviewer.findMany({
          where: {
            enrollment_id: { in: input.assignments.map((assignment) => BigInt(assignment.enrollmentId)) },
            training_enrollment: {
              evaluation_submission: { some: { submitted_at: { not: null } } },
            },
          },
          select: {
            enrollment_id: true,
            reviewer_user_id: true,
            training_enrollment: {
              select: {
                evaluation_submission: {
                  where: { submitted_at: { not: null } },
                  select: { respondent_user_id: true },
                },
              },
            },
          },
        });
        const lockedEnrollmentIds = new Set(
          answered
            .filter((row) =>
              row.training_enrollment.evaluation_submission.some(
                (submission) => submission.respondent_user_id === row.reviewer_user_id,
              ),
            )
            .map((row) => row.enrollment_id.toString()),
        );

        const onPlan = new Set(plan.training_enrollment.map((enrollment) => enrollment.enrollment_id.toString()));
        for (const assignment of input.assignments) {
          if (lockedEnrollmentIds.has(assignment.enrollmentId)) {
            throw new ApiError({
              code: "REVIEWER_ALREADY_ANSWERED",
              message: "This reviewer has already submitted the evaluation and can no longer be changed",
              status: 409,
              details: { enrollmentId: assignment.enrollmentId },
            });
          }
          // Same refusal as saveResults: an id from another plan would otherwise create an
          // assignment nobody on this screen can see, let alone remove.
          if (!onPlan.has(assignment.enrollmentId)) {
            throw new ApiError({
              code: "ENROLLMENT_NOT_ON_PLAN",
              message: `Enrollment ${assignment.enrollmentId} is not an approved enrollment on this plan`,
              status: 409,
            });
          }
        }

        await db().$transaction(async (tx) => {
          for (const assignment of input.assignments) {
            const enrollmentId = BigInt(assignment.enrollmentId);
            if (assignment.reviewerUserId === null) {
              await tx.training_evaluation_reviewer.deleteMany({ where: { enrollment_id: enrollmentId } });
              continue;
            }
            await tx.training_evaluation_reviewer.upsert({
              where: { enrollment_id: enrollmentId },
              // A new reviewer has not opened anything yet, so opened_at resets. Leaving the old
              // value would credit the new person with the previous one's visit.
              update: {
                reviewer_user_id: assignment.reviewerUserId,
                assigned_by: BigInt(userId),
                assigned_at: new Date(),
                opened_at: null,
              },
              create: {
                enrollment_id: enrollmentId,
                reviewer_user_id: assignment.reviewerUserId,
                assigned_by: BigInt(userId),
                assigned_at: new Date(),
              },
            });
          }
        });

        const updated = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: id },
          include: trainingRecordInclude,
        });
        return mapTrainingRecord(updated);
      });
    },

    async getCostBreakdown(planId: string, principal: AuthenticatedPrincipal): Promise<CostBreakdown> {
      return withDatabaseErrorMapping(async () => {
        const id = BigInt(planId);
        const plan = await db().training_plan.findUniqueOrThrow({
          where: { plan_id: id },
          include: {
            training_plan_oap: {
              select: {
                company_id: true,
                total_planned_budget: true,
                budget_instructor: true,
                budget_traveling: true,
                budget_seminar_room: true,
                budget_accommodation: true,
                budget_material: true,
                budget_food_beverage: true,
              },
            },
            training_expense: true,
            training_enrollment: {
              where: { approval_status: "APPROVED" },
              include: { employee: { include: { company: true } }, attendance: true },
            },
          },
        });

        if (principal.role === "HRD_FACTORY") {
          const ownsPlan = plan.training_plan_oap.company_id?.toString() === principal.companyId;
          const hasOwnEmployee = plan.training_enrollment.some(
            (enrollment) => enrollment.employee.company_id.toString() === principal.companyId,
          );
          if (!ownsPlan && !hasOwnEmployee) {
            throw new ApiError({ code: "FORBIDDEN", message: "This training plan is outside your permitted scope", status: 403 });
          }
        }

        const actualTotals: TrainingRecordExpenses = {
          accommodation: 0, foodBeverage: 0, instructor: 0, material: 0, seminarRoom: 0, traveling: 0,
        };
        for (const expense of plan.training_expense) {
          const key = CATEGORY_TO_EXPENSE_KEY[expense.expense_category as ExpenseCategory];
          if (key) actualTotals[key] += Number(expense.amount);
        }
        const actualGrandTotal = Object.values(actualTotals).reduce((sum, value) => sum + value, 0);

        const oap = plan.training_plan_oap;
        const plannedTotals: TrainingRecordExpenses = {
          instructor: Number(oap.budget_instructor ?? 0),
          traveling: Number(oap.budget_traveling ?? 0),
          seminarRoom: Number(oap.budget_seminar_room ?? 0),
          accommodation: Number(oap.budget_accommodation ?? 0),
          material: Number(oap.budget_material ?? 0),
          foodBeverage: Number(oap.budget_food_beverage ?? 0),
        };
        const plannedCategorySum = Object.values(plannedTotals).reduce((sum, value) => sum + value, 0);
        // Plans created before the budget-category breakdown existed only have the old lump-sum
        // total_planned_budget with no per-category values — fall back to that instead of
        // showing a misleading "Planned: 0".
        const plannedGrandTotal = plannedCategorySum || Number(oap.total_planned_budget ?? 0);

        // "Present" only — count only enrollments whose attendance record was actually marked
        // PRESENT, not just any attendance row (matches how cost-per-person should reflect who
        // genuinely attended, not everyone who was ever checked in regardless of status).
        const presentEnrollments = plan.training_enrollment.filter(
          (enrollment) => enrollment.attendance?.attendance_status === "PRESENT",
        );
        const presentCount = presentEnrollments.length;
        const costPerPersonRaw = presentCount > 0 ? actualGrandTotal / presentCount : 0;

        type CompanyGroup = { companyId: string; companyCode: string; presentCount: number };
        const companyGroups = new Map<string, CompanyGroup>();
        for (const enrollment of presentEnrollments) {
          const companyId = enrollment.employee.company_id.toString();
          const existing = companyGroups.get(companyId);
          if (existing) {
            existing.presentCount += 1;
          } else {
            companyGroups.set(companyId, {
              companyId,
              companyCode: enrollment.employee.company.company_code,
              presentCount: 1,
            });
          }
        }
        let groups = Array.from(companyGroups.values());
        // HRD_FACTORY only ever sees their own company's row here — the course-wide total is
        // still visible via presentCount/actualGrandTotal above, which are never filtered.
        if (principal.role === "HRD_FACTORY" && principal.companyId) {
          groups = groups.filter((group) => group.companyId === principal.companyId);
        }
        const companyBreakdown = groups.map(({ companyCode, presentCount: count }) => ({
          companyCode,
          presentCount: count,
          allocatedCost: Math.round(count * costPerPersonRaw),
        }));

        return {
          planId,
          plannedTotals,
          plannedGrandTotal,
          actualTotals,
          actualGrandTotal,
          presentCount,
          costPerPerson: Math.round(costPerPersonRaw),
          companyBreakdown,
        };
      });
    },
  };
};

export const trainingRecordRepository = createTrainingRecordRepository();
