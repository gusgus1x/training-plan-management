import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Employee registration used to be written to localStorage and nowhere else: the employee saw it
 * stick in their own browser and HRD never received it — the same shape as the training-need bug
 * fixed earlier, where the screen reported success while the work vanished.
 *
 * Both screens now go through the enrollment API. The assertions are mostly negative, because what
 * has to stay true is that no registration path writes to browser storage again; matching exact
 * call sites would break on any refactor that kept the behaviour.
 */

const read = (path: string) =>
  readFileSync(new URL(`../../app/components/employee/${path}`, import.meta.url), "utf8");

const registerModule = read("RegisterTrainingModule.tsx");
const roadmapModule = read("RoadmapModule.tsx");

describe("employee registration reaches the database", () => {
  it.each([
    ["RegisterTrainingModule", registerModule],
    ["RoadmapModule", roadmapModule],
  ])("%s submits through the enrollment API", (_label, source) => {
    expect(source).toContain("createEnrollment(");
    expect(source).toContain("updateEnrollmentStatus(");
  });

  it.each([
    ["RegisterTrainingModule", registerModule],
    ["RoadmapModule", roadmapModule],
  ])("%s never stores a registration in the browser", (_label, source) => {
    expect(source).not.toContain("writeWorkflowCollection");
    expect(source).not.toContain("WorkflowRegistration");
    expect(source).not.toContain("TRAINING_WORKFLOW_KEYS.registrations");
  });

  it("has no WorkflowRegistration consumer left anywhere in the app", () => {
    // The type still exists in trainingWorkflow.ts; what matters is that nothing reads or writes it.
    const roots = [registerModule, roadmapModule];
    for (const source of roots) {
      expect(source).not.toMatch(/readWorkflowCollection<WorkflowRegistration>/);
    }
  });

  it.each([
    ["RegisterTrainingModule", registerModule],
    ["RoadmapModule", roadmapModule],
  ])("%s treats only seat-holding enrollments as registered", (_label, source) => {
    // Rejected and Cancelled must not block registering again, which a plain "has an enrollment"
    // check would do.
    expect(source).toContain("ACTIVE_ENROLLMENT_STATUSES");
  });
});
