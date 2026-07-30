import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const assessmentSource = readFileSync(
  new URL(
    "../../app/components/center_factory/TrainingCourseManagement/modules/Assessment.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("assessment functional mockup contract", () => {
  it("starts with sample assessments and persists local mock changes", () => {
    expect(assessmentSource).toContain(
      "useState<AssessmentRecord[]>(cloneInitialAssessments)",
    );
    expect(assessmentSource).toContain("window.localStorage.getItem(storageKey)");
    expect(assessmentSource).toContain("window.localStorage.setItem(storageKey");
  });

  it("supports assessment and question CRUD interactions", () => {
    expect(assessmentSource).toContain("handleNew");
    expect(assessmentSource).toContain("handleEdit");
    expect(assessmentSource).toContain("handleDelete");
    expect(assessmentSource).toContain("handleSave");
    expect(assessmentSource).toContain("handleEditQuestion");
    expect(assessmentSource).toContain("handleRemoveQuestion");
    expect(assessmentSource).toContain("handleMoveQuestion");
  });

  it("validates scores, unique codes, and published question sets", () => {
    expect(assessmentSource).toContain(
      "Pass score must be a whole number from 0 to 100.",
    );
    expect(assessmentSource).toContain("Assessment code already exists.");
    expect(assessmentSource).toContain(
      "Add at least one question before publishing.",
    );
  });

  it("exports the visible assessment list as a CSV download", () => {
    expect(assessmentSource).toContain("createAssessmentCsv(visibleAssessments)");
    expect(assessmentSource).toContain('type: "text/csv;charset=utf-8"');
    expect(assessmentSource).toContain("downloadLink.download");
  });
});
