import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const rollingSource = readSource(
  "app/components/center_factory/TrainingPlanManagement/modules/TrainingRolling.tsx",
);

describe("Training Rolling multi-session workflow", () => {
  it("supports adding and removing independent training sessions", () => {
    expect(rollingSource).toContain("sessions: RollingSessionForm[]");
    expect(rollingSource).toContain("const addSession");
    expect(rollingSource).toContain("const removeSession");
    expect(rollingSource).toContain("form.sessions.map");
    expect(rollingSource).toContain("nextSessionPlans");
    expect(rollingSource).toContain("Add session");
  });

  it("stores a multi-company scope selected with checkboxes", () => {
    expect(rollingSource).toContain("relatedCompanies?: string[]");
    expect(rollingSource).toContain("const toggleCompany");
    expect(rollingSource).toContain("const toggleAllCompanies");
    expect(rollingSource).toContain('type="checkbox"');
    expect(rollingSource).toContain("getRollingPlanCompanies");
    expect(rollingSource).toContain("formatRollingPlanCompanies");
  });

  it("groups repeated course data into one row with nested sessions", () => {
    expect(rollingSource).toContain("visiblePlanGroups");
    expect(rollingSource).toContain("scheduleGroupId");
    expect(rollingSource).toContain("Session schedule");
    expect(rollingSource).toContain("handleConfirmGroup");
    expect(rollingSource).toContain("handleDeleteGroup");
    expect(rollingSource).toContain("Publish all");
    expect(rollingSource).toContain("Delete all");
  });

  it("uses related companies in employee and acceptance workflows", () => {
    const registrationSource = readSource(
      "app/components/employee/RegisterTrainingModule.tsx",
    );
    const dashboardSource = readSource(
      "app/components/employee/UserDashboard.tsx",
    );
    const surveySource = readSource(
      "app/components/center_factory/TrainingPlanManagement/modules/TrainingAcceptSurvey.tsx",
    );

    expect(registrationSource).toContain("getRollingPlanCompanies(plan)");
    expect(dashboardSource).toContain("getRollingPlanCompanies(plan)");
    expect(surveySource).toContain(
      "companies: getRollingPlanCompanies(plan)",
    );
  });

  it("lets Training Accept Survey choose a grouped course and exact session", () => {
    const surveySource = readSource(
      "app/components/center_factory/TrainingPlanManagement/modules/TrainingAcceptSurvey.tsx",
    );

    expect(surveySource).toContain("selectedCourseGroupId");
    expect(surveySource).toContain("availableCourseGroups");
    expect(surveySource).toContain("availableSessions");
    expect(surveySource).toContain("Training Session");
    expect(surveySource).toContain("session.id");
    expect(surveySource).toContain(
      "candidate.courseId === selectedCourse.id",
    );
    expect(surveySource).toContain("selectedCourse?.companies");
  });

  it("separates automatic target employees from later manual additions", () => {
    const surveySource = readSource(
      "app/components/center_factory/TrainingPlanManagement/modules/TrainingAcceptSurvey.tsx",
    );

    expect(surveySource).toContain("availableTargetEmployees");
    expect(surveySource).toContain("targetEmployeeGroups");
    expect(surveySource).toContain("additionalEmployees");
    expect(surveySource).toContain("additionalEmployeeGroups");
    expect(surveySource).toContain("Automatic target group");
    expect(surveySource).toContain("Add employees outside the target group");
    expect(surveySource).toContain("styles.additionalDisclosure");
    expect(surveySource).not.toContain("showTargetOnly");
  });

  it("lets Training Actual choose and save an exact Rolling session", () => {
    const actualSource = readSource(
      "app/components/center_factory/TrainingRecordManagement/modules/TrainingActual.tsx",
    );

    expect(actualSource).toContain("selectedCourseGroupId");
    expect(actualSource).toContain("availableCourseGroups");
    expect(actualSource).toContain("availableSessions");
    expect(actualSource).toContain("Training Session");
    expect(actualSource).toContain("rollingId: selectedCourse.id");
    expect(actualSource).toContain("scheduleGroupId: selectedCourse.groupId");
    expect(actualSource).toContain("course.ownerCompany ?? course.company");
  });

  it("groups completed records while keeping each Rolling session separate", () => {
    const recordSource = readSource(
      "app/components/center_factory/TrainingRecordManagement/modules/TrainingRecord.tsx",
    );
    const workflowSource = readSource("app/lib/trainingWorkflow.ts");

    expect(recordSource).toContain("selectedCourseGroupId");
    expect(recordSource).toContain("availableCourseGroups");
    expect(recordSource).toContain("availableSessions");
    expect(recordSource).toContain("course.rollingId");
    expect(recordSource).toContain("course.ownerCompany ?? course.company");
    expect(recordSource).toContain("Training Session");
    expect(workflowSource).toContain("scheduleGroupId?: string");
    expect(workflowSource).toContain("batch?: string");
  });
});
