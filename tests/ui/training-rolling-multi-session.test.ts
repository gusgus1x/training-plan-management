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
    expect(rollingSource).toContain("for (const session of form.sessions)");
    expect(rollingSource).toContain("Add session");
  });

  it("inherits company scope from the selected OAP instead of a company checklist", () => {
    expect(rollingSource).not.toContain('type="checkbox"');
    expect(rollingSource).not.toContain("relatedCompanies: [");
    expect(rollingSource).toContain("getRollingPlanCompanies");
    expect(rollingSource).toContain("formatRollingPlanCompanies");
    expect(rollingSource).toContain(
      'value={selectedOap ? (selectedOap.owner === "CENTER" ? "All Companies" : selectedOap.ownerCompany) : ""}',
    );
  });

  it("groups repeated course data into one row with nested sessions", () => {
    expect(rollingSource).toContain("visiblePlanGroups");
    expect(rollingSource).toContain("scheduleGroupId");
    expect(rollingSource).toContain("Session schedule");
    expect(rollingSource).toContain("handleConfirmGroup");
    expect(rollingSource).toContain("Publish all");
  });

  it("edits, publishes, and deletes each session independently instead of as a group", () => {
    expect(rollingSource).toContain("selectedGroupId");
    expect(rollingSource).toContain("selected-rolling-group");
    expect(rollingSource).toContain("const handleEditSession");
    expect(rollingSource).toContain("onClick={() => handleEditSession(session)}");
    expect(rollingSource).toContain("onClick={() => void handleConfirm(session.rollingId)}");
    expect(rollingSource).toContain("onClick={() => void handleDelete(session.rollingId)}");
    expect(rollingSource).not.toContain("handleEditGroup");
    expect(rollingSource).not.toContain("handleDeleteGroup");
    expect(rollingSource).not.toContain("Delete all");
  });

  it("starts with an all-year view and requires an OAP before monthly entry", () => {
    expect(rollingSource).toContain('useState("all")');
    expect(rollingSource).toContain('<option value="all">All Year</option>');
    expect(rollingSource).toContain('selectedMonth === "all" ||');
    expect(rollingSource).toContain(
      '<option value="">Select course first</option>',
    );
    expect(rollingSource).toContain('disabled={!selectedOap}');
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
      "listEnrollments({ planId: selectedCourse.id, employeeId: null })",
    );
    expect(surveySource).toContain("selectedCourse?.companies");
    expect(surveySource).toContain("handleExportAttendanceSheet");
    expect(surveySource).toContain("Export Excel");
    expect(surveySource).not.toContain("Export PDF");
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
    const actualStyles = readSource(
      "app/components/center_factory/TrainingRecordManagement/modules/TrainingRecord.module.css",
    );

    expect(actualSource).toContain("selectedCourseGroupId");
    expect(actualSource).toContain("availableCourseGroups");
    expect(actualSource).toContain("availableSessions");
    expect(actualSource).toContain("Training Session");
    expect(actualSource).toContain("rollingId: selectedCourse.id");
    expect(actualSource).toContain("scheduleGroupId: selectedCourse.groupId");
    expect(actualSource).toContain("course.ownerCompany ?? course.company");
    expect(actualSource).toContain("const setAllAttendance");
    expect(actualSource).toContain("setAllAttendance(!allAttended)");
    expect(actualSource).toContain("Select all");
    expect(actualSource).toContain("styles.attendanceTableWrap");
    expect(actualStyles).toContain(".attendanceTableWrap");
    expect(actualStyles).toContain("max-height: 420px");
    expect(actualStyles).toContain("overflow-x: hidden");
    expect(actualStyles).toContain("overflow-y: auto");
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
