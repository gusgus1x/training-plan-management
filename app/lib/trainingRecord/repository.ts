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
  type SaveExpensesInput,
  type TrainingRecordExpenses,
  type TrainingRecordSummary,
} from "./types";

type DatabaseClient = Pick<PrismaClient, "training_plan" | "training_expense">;

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
      employeeId: enrollment.employee_id.toString(),
      employeeCode: enrollment.employee.employee_code,
      name: employeeDisplayName(enrollment.employee),
      department:
        enrollment.employee.organization_function?.function_name_en ||
        enrollment.employee.organization_function?.function_name_th ||
        "",
      company: enrollment.employee.company.company_code,
      attended: enrollment.attendance !== null,
      preTestPassed: preTest ? preTest.pass_status?.toUpperCase() === "PASS" : null,
      postTestPassed: postTest ? postTest.pass_status?.toUpperCase() === "PASS" : null,
      evaluationCompleted: enrollment.evaluation_submission.some((e) => e.submitted_at !== null),
    };
  });

  return {
    planId: row.plan_id.toString(),
    registeredCount: attendees.length,
    attendedCount: attendees.filter((a) => a.attended).length,
    expenses,
    preTestPassCount: attendees.filter((a) => a.preTestPassed).length,
    postTestPassCount: attendees.filter((a) => a.postTestPassed).length,
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
        const where: Prisma.training_planWhereInput = { training_expense: { some: {} } };
        if (companyId) where.training_plan_oap = { company_id: BigInt(companyId) };
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
        if (companyId && plan.training_plan_oap.company_id?.toString() !== companyId) {
          throw new ApiError({ code: "FORBIDDEN", message: "This training plan belongs to a different company", status: 403 });
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
