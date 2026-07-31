import { describe, expect, it } from "vitest";
import {
  buildFactoryCenterFunding,
  buildFinanceSummary,
  type FinanceRollingPlan,
} from "../../app/lib/trainingFinanceSummary";
import type {
  WorkflowAcceptance,
  WorkflowCompletedCourse,
} from "../../app/lib/trainingWorkflow";

const centerPlan: FinanceRollingPlan = {
  rollingId: "rolling-center-1",
  scheduleGroupId: "center-group",
  budget: "60,000",
  trainingDate: "2026-08-12",
  batch: "1",
  company: "ATA",
  relatedCompanies: ["ATA", "SNF"],
  owner: "admin.hrd",
  ownerScope: "CENTER",
  ownerCompany: "HRD Center",
  course: { code: "CRS-CENTER", name: "Center Course" },
};

const factoryPlan: FinanceRollingPlan = {
  rollingId: "rolling-factory-1",
  scheduleGroupId: "factory-group",
  budget: "40,000",
  trainingDate: "2026-08-18",
  batch: "1",
  company: "SNF",
  relatedCompanies: ["SNF"],
  owner: "factory.hrd",
  ownerScope: "FACTORY",
  ownerCompany: "SNF",
  course: { code: "CRS-FACTORY", name: "Factory Course" },
};

const completedCourse = (
  plan: FinanceRollingPlan,
  expenses: number[],
  companies: string[],
): WorkflowCompletedCourse => ({
  id: `completed-${plan.rollingId}`,
  rollingId: plan.rollingId,
  scheduleGroupId: plan.scheduleGroupId,
  code: plan.course.code,
  title: plan.course.name,
  date: plan.trainingDate,
  batch: plan.batch,
  company: plan.company,
  relatedCompanies: plan.relatedCompanies,
  owner: plan.ownerScope ?? "FACTORY",
  ownerCompany: plan.ownerCompany,
  room: "Room A",
  instructor: "Trainer",
  hours: 6,
  attendees: companies.map((company, index) => ({
    id: `attendee-${index}`,
    company,
    employeeCode: `EMP-${index}`,
    name: `Employee ${index}`,
    department: "Production",
    registered: true,
    attended: true,
  })),
  expenses: {
    accommodation: expenses[0] ?? 0,
    foodBeverage: expenses[1] ?? 0,
    instructor: expenses[2] ?? 0,
    material: expenses[3] ?? 0,
    seminarRoom: expenses[4] ?? 0,
    traveling: expenses[5] ?? 0,
  },
  savedAt: "2026-08-18T10:00:00.000Z",
});

describe("training finance summary", () => {
  it("separates Center-owned and Factory-owned financial totals", () => {
    const completed = [
      completedCourse(centerPlan, [5_000, 5_000], ["ATA", "SNF"]),
      completedCourse(factoryPlan, [10_000, 5_000], ["SNF"]),
    ];
    const center = buildFinanceSummary({
      rollingPlans: [centerPlan, factoryPlan],
      completedCourses: completed,
      role: "CENTER",
      companyCode: "",
      year: "2026",
      month: "08",
    });
    const factory = buildFinanceSummary({
      rollingPlans: [centerPlan, factoryPlan],
      completedCourses: completed,
      role: "FACTORY",
      companyCode: "SNF",
      year: "2026",
      month: "08",
    });

    expect(center.courseCount).toBe(1);
    expect(center.totalBudget).toBe(60_000);
    expect(center.totalActual).toBe(10_000);
    expect(factory.courseCount).toBe(1);
    expect(factory.totalBudget).toBe(40_000);
    expect(factory.totalActual).toBe(15_000);
  });

  it("counts a multi-session schedule budget once", () => {
    const secondSession = {
      ...centerPlan,
      rollingId: "rolling-center-2",
      batch: "2",
      trainingDate: "2026-08-20",
    };
    const summary = buildFinanceSummary({
      rollingPlans: [centerPlan, secondSession],
      completedCourses: [],
      role: "CENTER",
      companyCode: "",
      year: "2026",
      month: "all",
    });

    expect(summary.courseCount).toBe(1);
    expect(summary.sessionCount).toBe(2);
    expect(summary.totalBudget).toBe(60_000);
  });

  it("calculates a Factory share of a Center course from approved employees", () => {
    const acceptances = [
      ["SNF-1", "SNF"],
      ["SNF-2", "SNF"],
      ["ATA-1", "ATA"],
    ].map(
      ([id, company]): WorkflowAcceptance => ({
        id,
        name: id,
        company,
        department: "Production",
        position: "Operator",
        level: "L1",
        legacyLabel: "-",
        courseId: centerPlan.rollingId,
        source: "Submitted by Factory",
        status: "Center Approved",
        remark: "",
      }),
    );
    const rows = buildFactoryCenterFunding({
      rollingPlans: [centerPlan],
      completedCourses: [
        completedCourse(centerPlan, [15_000], ["SNF", "SNF", "ATA"]),
        {
          ...completedCourse(centerPlan, [30_000], ["SNF"]),
          id: "completed-center-september",
          date: "2026-09-02",
        },
      ],
      acceptances,
      companyCode: "SNF",
      year: "2026",
      month: "08",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].allocatedBudget).toBe(40_000);
    expect(rows[0].actualShare).toBe(10_000);
    expect(rows[0].method).toBe("Approved employees");
  });
});
