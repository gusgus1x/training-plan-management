import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The server is the real gate (see prerequisite-override.test.ts): an employee cannot enroll
 * without completing a prerequisite no matter what the client sends, and HRD's override only takes
 * effect after they confirm a popup naming the missing course. These assertions are deliberately
 * negative/structural rather than matching exact wording, because two earlier tests in this
 * project broke on a colleague's refactor that preserved behaviour but changed a message.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const registerModule = read("../../app/components/employee/RegisterTrainingModule.tsx");
const roadmapModule = read("../../app/components/employee/RoadmapModule.tsx");
const acceptSurvey = read(
  "../../app/components/center_factory/TrainingPlanManagement/modules/TrainingAcceptSurvey.tsx",
);
const courseMaster = read(
  "../../app/components/center_factory/TrainingCourseManagement/modules/CourseMasterWorkspace.tsx",
);

describe("employee screens never send the prerequisite override", () => {
  it.each([
    ["RegisterTrainingModule", registerModule],
    ["RoadmapModule", roadmapModule],
  ])("%s does not send acknowledgePrerequisite", (_label, source) => {
    expect(source).not.toContain("acknowledgePrerequisite");
  });

  it.each([
    ["RegisterTrainingModule", registerModule],
    ["RoadmapModule", roadmapModule],
  ])("%s reads missingPrerequisites before letting a registration through", (_label, source) => {
    expect(source).toContain("missingPrerequisites");
  });
});

describe("HRD confirms before overriding a prerequisite", () => {
  it("asks via the shared confirm dialog, not a bespoke popup", () => {
    expect(acceptSurvey).toContain("useConfirm");
    expect(acceptSurvey).toContain("PREREQUISITE_NOT_MET");
  });

  it("resends with the override flag only after confirmation, in one shared helper", () => {
    // A single acknowledging call site is the point: two independent copies is how the "keep
    // skipped employees in the draft" behaviour drifts between the single-add and batch paths.
    const acknowledgeCalls = acceptSurvey.match(/acknowledgePrerequisite:\s*true/g) ?? [];
    expect(acknowledgeCalls.length).toBe(1);
  });

  it("does not drop a batch candidate who was not confirmed", () => {
    // The old bug shape: submitting a draft batch cleared the whole list regardless of outcome.
    // (Resetting to [] when the selected course changes is unrelated and still fine.)
    expect(acceptSurvey).toContain("setDraftSubmittedEmployees(skipped)");
  });
});

describe("Course Master prerequisite picker", () => {
  it("takes the graph rules from the pure module, not the repository", () => {
    // courses/repository.ts imports Prisma on its first line; reaching into it from a "use client"
    // component drags the server bundle along with it.
    expect(courseMaster).not.toMatch(/from\s+".*lib\/courses\/repository"/);
    expect(courseMaster).toContain("prerequisiteGraph");
  });

  it("fills in a prerequisite's own prerequisites rather than leaving the gap", () => {
    expect(courseMaster).toContain("collectTransitivePrerequisites");
  });

  it("says which courses it filled in, instead of adding them silently", () => {
    expect(courseMaster).toContain("autoAddedPrerequisites");
  });

  it("closes off picks that would form a loop before the save is attempted", () => {
    expect(courseMaster).toContain("courseIdsThatWouldCycle");
  });
});
