import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Report Management summary dashboard", () => {
  it("registers the summary dashboard as the first report module", () => {
    const moduleIndex = readSource(
      "app/components/center_factory/ReportManagement/modules/index.ts",
    );

    expect(moduleIndex).toContain('from "./SummaryDashboard"');
    expect(
      moduleIndex.indexOf(
        '{ ...summaryDashboardModule, icon: "📊", Component: SummaryDashboard }',
      ),
    ).toBeLessThan(
      moduleIndex.indexOf(
        '{ ...scheduleCalendarModule, icon: "📅", Component: ScheduleCalendar }',
      ),
    );
  });

  it("summarizes attended and absent people from completed actual records", () => {
    const dashboardSource = readSource(
      "app/components/center_factory/ReportManagement/modules/SummaryDashboard.tsx",
    );
    const financeSource = readSource(
      "app/lib/trainingFinanceSummary.ts",
    );

    expect(dashboardSource).toContain(
      "TRAINING_WORKFLOW_KEYS.completedCourses",
    );
    expect(dashboardSource).toContain("loadWorkflowRollingPlans");
    expect(dashboardSource).toContain("TRAINING_WORKFLOW_EVENT");
    expect(financeSource).toContain(
      "attendees.filter((attendee) => attendee.attended)",
    );
    expect(financeSource).toContain(
      "attendees.filter((attendee) => !attendee.attended)",
    );
    expect(dashboardSource).toContain("buildFinanceSummary");
    expect(dashboardSource).toContain("buildFactoryCenterFunding");
    expect(dashboardSource).toContain('role="img"');
  });

  it("renders the attendance ratio as a responsive donut chart", () => {
    const dashboardStyles = readSource(
      "app/components/center_factory/ReportManagement/modules/SummaryDashboard.module.css",
    );

    expect(dashboardStyles).toContain("conic-gradient(");
    expect(dashboardStyles).toContain("--attendance-angle");
    expect(dashboardStyles).toContain("@media (max-width: 760px)");
  });

  it("filters the dashboard by whole year or an individual month", () => {
    const dashboardSource = readSource(
      "app/components/center_factory/ReportManagement/modules/SummaryDashboard.tsx",
    );
    const financeSource = readSource(
      "app/lib/trainingFinanceSummary.ts",
    );

    expect(financeSource).toContain("const isInPeriod");
    expect(dashboardSource).toContain("selectedYear");
    expect(dashboardSource).toContain("selectedMonth");
    expect(financeSource).toContain('month === "all"');
    expect(dashboardSource).toContain('<option value="all">All months</option>');
    expect(dashboardSource).toContain("year: activeYear");
    expect(dashboardSource).toContain("month: selectedMonth");
  });

  it("shows budget, actual spending, remaining funds, and Factory Center shares", () => {
    const dashboardSource = readSource(
      "app/components/center_factory/ReportManagement/modules/SummaryDashboard.tsx",
    );

    expect(dashboardSource).toContain("Total Planned Budget");
    expect(dashboardSource).toContain("Total Actual Spent");
    expect(dashboardSource).toContain("Remaining Budget");
    expect(dashboardSource).toContain("Budget utilization");
    expect(dashboardSource).toContain("Company Budget Share for Center Courses");
    expect(dashboardSource).toContain("Allocated Company Budget");
    expect(dashboardSource).toContain("Budget vs Actual by Course");
  });

  it("keeps Internal Report visibly locked and blocks every entry point", () => {
    const moduleIndex = readSource(
      "app/components/center_factory/ReportManagement/modules/index.ts",
    );
    const managementSource = readSource(
      "app/components/center_factory/ReportManagement/CenterFactory_ReportManagement.tsx",
    );
    const navbarSource = readSource("app/components/Navbar.tsx");

    expect(moduleIndex).toContain(
      '{ ...internalReportModule, icon: "✉️", Component: InternalReport, locked: true }',
    );
    expect(managementSource).toContain("if (item.locked)");
    expect(managementSource).toContain("disabled={item.locked}");
    expect(managementSource).toContain('item.locked ? "Locked" : "Open"');
    expect(managementSource).toContain(
      "isInternalReportLocked ? undefined : handlePrepareEmail",
    );
    expect(navbarSource).toContain("disabled={item.locked}");
    expect(navbarSource).toContain("styles.contextLock");
  });
});
