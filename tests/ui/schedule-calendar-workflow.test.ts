import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scheduleSource = readFileSync(
  join(
    process.cwd(),
    "app/components/center_factory/ReportManagement/modules/ScheduleCalendar.tsx",
  ),
  "utf8",
);

describe("Schedule Calendar workflow", () => {
  it("uses real Rolling data without hiding weekend schedules or adding mocks", () => {
    expect(scheduleSource).toContain("loadWorkflowRollingPlans");
    expect(scheduleSource).not.toContain("createMockRollingPlans");
    expect(scheduleSource).not.toContain("isWeekendDate");
  });

  it("starts with the current year overview and can return to the current month", () => {
    expect(scheduleSource).toContain("useState(calendarToday.year)");
    expect(scheduleSource).toContain('useState<"all" | string>("all")');
    expect(scheduleSource).toContain("handleShowCurrentMonth");
    expect(scheduleSource).toContain("todayDate");
  });

  it("avoids repeating the course overview in the all-year view", () => {
    expect(scheduleSource).toContain('selectedMonth !== "all" ? (');
  });
});
