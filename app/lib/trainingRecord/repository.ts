import type { PrismaClient } from "../../generated/prisma/client";
import { Prisma } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";
import type { AuthenticatedPrincipal } from "../auth/types";
import { withDatabaseErrorMapping } from "../database/errors";
import { getPrismaClient } from "../database/prisma";
import {
  EXPENSE_CATEGORIES,
  type CostBreakdown,
  type ExpenseCategory,
  type CompletionStatus,
  type SaveExpensesInput,
  type SaveResultsInput,
  type TrainingRecordExpenses,
  type TrainingRecordSummary,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "training_plan" | "training_expense" | "training_result">;

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
} satisfies Prisma.employeeInclude;

const trainingRecordInclude = {
  training_plan_oap: { select: { company_id: true } },
  training_expense: true,
  training_enrollment: {
    where: { approval_status: "APPROVED" },
    include: {
      employee: { include: employeeInclude },
      attendance: true,
      assessment_submission: true,
      evaluation_submission: true,
      training_result: true,
    },
  },
} satisfies Prisma.training_planInclude;

type TrainingRecordPlan = Prisma.training_planGetPayload<{ include: typeof trainingRecordInclude }>;

const employeeDisplayName = (employee: TrainingRecordPlan["training_enrollment"][number]["employee"]) =>
  `${employee.first_name_th} ${employee.last_name_th}`.trim() ||
  `${employee.first_name_en || ""} ${employee.last_name_en || ""}`.trim();

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

    return {
      enrollmentId: enrollment.enrollment_id.toString(),
      employeeId: enrollment.employee.employee_id.toString(),
      employeeCode: enrollment.employee.employee_code ?? "",
      name: employeeDisplayName(enrollment.employee),
      department:
        enrollment.employee.organization_function?.function_name_en ||
        enrollment.employee.organization_function?.function_name_th ||
        "",
      position:
        (enrollment.employee as any).position?.position_name_en ||
        (enrollment.employee as any).position?.position_name_th ||
        "",
      company: enrollment.employee.company.company_code,
      // PRESENT only, matching Training Actual and the cost breakdown. Counting any attendance row
      // meant somebody marked ABSENT was still reported as having attended.
      attended: enrollment.attendance?.attendance_status === "PRESENT",
      preTestPassed: preTest ? preTest.pass_status?.toUpperCase() === "PASS" : null,
      postTestPassed: postTest ? postTest.pass_status?.toUpperCase() === "PASS" : null,
      evaluationCompleted: enrollment.evaluation_submission.some((e) => e.submitted_at !== null),
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
    };
  });

  return {
    planId: row.plan_id.toString(),
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
