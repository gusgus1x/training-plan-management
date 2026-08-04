import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../app/components/center_factory/TrainingCourseManagement/modules/Assessment.tsx", import.meta.url),
  "utf8",
);

describe("assessment SQL Server UI contract", () => {
  it("loads and mutates assessments through the protected API client", () => {
    expect(source).toContain("listAssessments()");
    expect(source).toContain("createAssessment(payload())");
    expect(source).toContain("updateAssessment(selected.assessmentId, payload())");
    expect(source).toContain("deleteAssessment(selected.assessmentId)");
    expect(source).not.toContain("localStorage");
    expect(source).toContain("The list could not be refreshed; press Refresh to try again.");
    expect(source).toContain("setSelectedId(saved.assessmentId)");
  });

  it("supports V6.2 series versions with the approved mock question UI", () => {
    expect(source).toContain("createAssessmentVersion");
    expect(source).toContain('<option value="Choice">Choice</option>');
    expect(source).toContain('<option value="Text">Text</option>');
    expect(source).toContain('questionType === "Choice" ? "SINGLE_CHOICE" : "SHORT_ANSWER"');
    expect(source).not.toContain('<option value="MULTIPLE_CHOICE">');
    expect(source).not.toContain('<option value="TRUE_FALSE">');
  });

  it("uses four fixed A-D options and one Correct Answer dropdown", () => {
    const blankChoices = source.slice(source.indexOf("const blankChoices"), source.indexOf("const blankQuestion"));
    expect(blankChoices.match(/choiceText:/g)).toHaveLength(4);
    expect(source).toContain("Correct Answer");
    expect(source).not.toContain("Option Score<input");
    expect(source).not.toContain(">Add choice</button>");
  });

  it("shows Assessment Code as backend-generated read-only data", () => {
    expect(source).toContain("Assessment Code<input");
    expect(source).toContain('placeholder="Auto-generated on save"');
    expect(source).toContain("mode !== \"new\" && !draft.seriesCode.trim()");
  });

  it("preserves mock UI question ordering and inline validation", () => {
    expect(source).toContain("moveQuestion(index, -1)");
    expect(source).toContain("moveQuestion(index, 1)");
    expect(source).toContain("Cancel question edit");
    expect(source).toContain("String.fromCharCode(65 + choiceIndex)");
    expect(source).toContain("Please correct the highlighted fields.");
    expect(source).toContain("formErrors.questions");
  });

  it("preserves keyboard row selection and Updated At CSV output", () => {
    expect(source).toContain('event.key === "Enter" || event.key === " "');
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain('"Updated At"');
    expect(source).toContain("item.updatedAt ?? item.createdAt");
  });

  it("uses server-returned modification rights", () => {
    expect(source).toContain("selected?.canModify");
    expect(source).toContain("selected?.canCreateVersion");
    expect(source).toContain("useAuthenticatedUser()");
  });

  it("exports only the currently visible API-backed rows", () => {
    expect(source).toContain("createAssessmentCsv(visible)");
    expect(source).toContain('type: "text/csv;charset=utf-8"');
  });
});
