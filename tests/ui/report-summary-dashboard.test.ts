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
    expect(moduleIndex.indexOf("summaryDashboardModule")).toBeLessThan(
      moduleIndex.indexOf("scheduleCalendarModule, Component"),
    );
  });

  it("summarizes attended and absent people from completed actual records", () => {
    const dashboardSource = readSource(
      "app/components/center_factory/ReportManagement/modules/SummaryDashboard.tsx",
    );

    expect(dashboardSource).toContain(
      "TRAINING_WORKFLOW_KEYS.completedCourses",
    );
    expect(dashboardSource).toContain("TRAINING_WORKFLOW_EVENT");
    expect(dashboardSource).toContain(
      "attendees.filter((attendee) => attendee.attended)",
    );
    expect(dashboardSource).toContain(
      "attendees.filter((attendee) => !attendee.attended)",
    );
    expect(dashboardSource).toContain("course.attendees.filter");
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

    expect(dashboardSource).toContain("const getCoursePeriod");
    expect(dashboardSource).toContain("selectedYear");
    expect(dashboardSource).toContain("selectedMonth");
    expect(dashboardSource).toContain('selectedMonth === "all"');
    expect(dashboardSource).toContain('<option value="all">All months</option>');
    expect(dashboardSource).toContain("period.year === activeYear");
    expect(dashboardSource).toContain("period.month === selectedMonth");
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
      "{ ...internalReportModule, Component: InternalReport, locked: true }",
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
