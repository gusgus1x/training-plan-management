import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("responsive layout contract", () => {
  it("keeps form controls and grid children inside their containers", () => {
    const globalStyles = readSource("app/globals.css");

    expect(globalStyles).toContain("max-width: 100%;");
    expect(globalStyles).toContain("width: 100%;");
    expect(globalStyles).toContain(
      ":where(main, header, footer, nav, section, article, aside, form, fieldset, div, label)",
    );
    expect(globalStyles).toContain("min-width: 0;");
    expect(globalStyles).toContain("overflow-wrap: anywhere;");
  });

  it("shows the Training Accept Survey permission scope as wrapping content", () => {
    const surveySource = readSource(
      "app/components/center_factory/TrainingPlanManagement/modules/TrainingAcceptSurvey.tsx",
    );
    const surveyStyles = readSource(
      "app/components/center_factory/TrainingPlanManagement/modules/TrainingAcceptSurvey.module.css",
    );

    expect(surveySource).toContain("className={styles.scopeCard}");
    expect(surveySource).not.toContain("<input\n            disabled");
    expect(surveyStyles).toContain(".scopeCard");
    expect(surveyStyles).toContain("grid-column: 1 / -1;");
    expect(surveyStyles).toContain("overflow-wrap: anywhere;");
  });

  it("keeps late CSS overrides responsive on Training Actual and Employee pages", () => {
    const recordStyles = readSource(
      "app/components/center_factory/TrainingRecordManagement/modules/TrainingRecord.module.css",
    );
    const employeeStyles = readSource(
      "app/components/employee/UserDashboard.module.css",
    );

    expect(recordStyles).toContain(
      ".actualSelectorFirstPanel .courseSelectorControls,",
    );
    expect(employeeStyles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.moduleGrid \{\s*grid-template-columns: 1fr;/,
    );
  });

  it("uses dedicated readable text colors when the sticky navigation is dark", () => {
    const globalStyles = readSource("app/globals.css");
    const navbarStyles = readSource("app/components/Navbar.module.css");
    const loginStyles = readSource("app/components/LoginPage.module.css");

    expect(globalStyles).toContain("--ui-on-dark-muted: #d7e0eb;");
    expect(globalStyles).toContain("--ui-10-accent-on-dark: #ff9195;");
    expect(navbarStyles).toContain(".scrolledNavbar .userLabel,");
    expect(navbarStyles).toContain("color: var(--ui-on-dark-muted);");
    expect(navbarStyles).toContain(".scrolledNavbar .languageDivider");
    expect(loginStyles).toContain("color: var(--ui-10-accent-on-dark);");
  });
});
