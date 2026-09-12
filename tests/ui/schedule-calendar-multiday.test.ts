import { describe, expect, it } from "vitest";
import {
  buildCalendarWeeks,
  getPlanDaysCount,
  getPlanEndDate,
  isPlanInMonth,
} from "../../app/components/center_factory/ReportManagement/modules/ScheduleCalendar";
import type { RollingPlan } from "../../app/components/center_factory/TrainingPlanManagement/modules/TrainingRolling";

const createMockPlan = (overrides: Partial<RollingPlan> = {}): RollingPlan =>
  ({
    id: "plan-1",
    rollingId: "plan-1",
    scheduleGroupId: "grp-1",
    oapId: "oap-1",
    sequence: 1,
    planCode: "RP-001",
    ownerName: "Admin",
    owner: "CENTER",
    ownerScope: "CENTER",
    ownerCompany: "HRD Center",
    company: "All Companies",
    batchNo: 1,
    batch: "รุ่น 1",
    trainingDate: "2026-08-28",
    endDate: "2026-08-29",
    startTime: "09:00",
    endTime: "16:00",
    location: "Room 101",
    status: "Planned",
    participants: "20",
    hours: "6",
    budget: "10000",
    budgetInstructor: "5000",
    budgetTraveling: "1000",
    budgetSeminarRoom: "2000",
    budgetAccommodation: "1000",
    budgetMaterial: "500",
    budgetFoodBeverage: "500",
    trainer: "John Doe",
    provider: "Institute",
    course: {
      code: "CRS-001",
      name: "การออกแบบหน้าจอ GOT ด้วย GT-Designer 3",
      courseGroup: "Technical",
      courseType: "In-house",
      objective: "",
      learningContent: "",
      targetGroup: "",
      methodology: "",
      preTest: "",
      postTest: "",
      evaluation: "",
      evaluationAfter30Day: "",
      lifeCycleMonth: "1",
      remark: "",
    },
    ...overrides,
  } as RollingPlan);

describe("Schedule Calendar Multi-Day Spanning", () => {
  it("computes end date correctly when endDate is provided or omitted", () => {
    const multiDayPlan = createMockPlan({ trainingDate: "2026-08-28", endDate: "2026-08-29" });
    expect(getPlanEndDate(multiDayPlan)).toBe("2026-08-29");

    const singleDayPlan = createMockPlan({ trainingDate: "2026-08-28", endDate: "" });
    expect(getPlanEndDate(singleDayPlan)).toBe("2026-08-28");

    const invalidEndPlan = createMockPlan({ trainingDate: "2026-08-28", endDate: "2026-08-27" });
    expect(getPlanEndDate(invalidEndPlan)).toBe("2026-08-28");
  });

  it("calculates plan days count accurately", () => {
    expect(getPlanDaysCount("2026-08-28", "2026-08-29")).toBe(2);
    expect(getPlanDaysCount("2026-08-28", "2026-08-28")).toBe(1);
    expect(getPlanDaysCount("2026-08-28", "2026-08-31")).toBe(4);
  });

  it("determines whether plan overlaps with a month", () => {
    const planAug = createMockPlan({ trainingDate: "2026-08-28", endDate: "2026-08-29" });
    expect(isPlanInMonth(planAug, "2026", "08")).toBe(true);
    expect(isPlanInMonth(planAug, "2026", "09")).toBe(false);

    // Cross month plan (Aug 31 to Sep 2)
    const crossMonthPlan = createMockPlan({ trainingDate: "2026-08-31", endDate: "2026-09-02" });
    expect(isPlanInMonth(crossMonthPlan, "2026", "08")).toBe(true);
    expect(isPlanInMonth(crossMonthPlan, "2026", "09")).toBe(true);
    expect(isPlanInMonth(crossMonthPlan, "2026", "10")).toBe(false);
  });

  it("builds calendar weeks with continuous multi-day spans and non-colliding slots", () => {
    // 2-day plan on Friday (Aug 28) and Saturday (Aug 29) 2026
    const planA = createMockPlan({
      rollingId: "plan-a",
      trainingDate: "2026-08-28",
      endDate: "2026-08-29",
      course: {
        code: "CRS-A",
        name: "การออกแบบหน้าจอ GOT",
        courseGroup: "Tech",
        courseType: "In-house",
        objective: "",
        learningContent: "",
        targetGroup: "",
        methodology: "",
        preTest: "",
        postTest: "",
        evaluation: "",
        evaluationAfter30Day: "",
        lifeCycleMonth: "1",
        remark: "",
      },
    });

    // Single-day plan on Saturday (Aug 29)
    const planB = createMockPlan({
      rollingId: "plan-b",
      trainingDate: "2026-08-29",
      endDate: "2026-08-29",
      course: {
        code: "CRS-B",
        name: "Melt Specialist",
        courseGroup: "Tech",
        courseType: "In-house",
        objective: "",
        learningContent: "",
        targetGroup: "",
        methodology: "",
        preTest: "",
        postTest: "",
        evaluation: "",
        evaluationAfter30Day: "",
        lifeCycleMonth: "1",
        remark: "",
      },
    });

    const weeks = buildCalendarWeeks("2026", "08", [planA, planB]);
    expect(weeks.length).toBeGreaterThan(0);

    // Find the week that contains Aug 28 and Aug 29
    const targetWeek = weeks.find((w) =>
      w.days.some((d) => d.date === "2026-08-28" && d.isCurrentMonth),
    );
    expect(targetWeek).toBeDefined();

    const segA = targetWeek?.eventSegments.find((s) => s.plan.rollingId === "plan-a");
    const segB = targetWeek?.eventSegments.find((s) => s.plan.rollingId === "plan-b");

    expect(segA).toBeDefined();
    expect(segB).toBeDefined();

    // Plan A is 2 days so span should be 2
    expect(segA?.span).toBe(2);
    expect(segA?.isMultiDay).toBe(true);
    expect(segA?.totalDays).toBe(2);

    // Plan B is 1 day so span should be 1
    expect(segB?.span).toBe(1);
    expect(segB?.isMultiDay).toBe(false);

    // Slots must not collide on the overlapping column (Saturday Aug 29)
    expect(segA?.slot).not.toBe(segB?.slot);
  });
});
