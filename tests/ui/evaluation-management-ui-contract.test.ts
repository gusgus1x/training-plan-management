import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const evaluationSource = readFileSync(
  new URL(
    "../../app/components/center_factory/TrainingCourseManagement/modules/EvaluationManagement.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("evaluation management functional mockup contract", () => {
  it("loads and saves evaluations through API clients", () => {
    expect(evaluationSource).toContain(
      "useState<EvaluationRecord[]>([])",
    );
    expect(evaluationSource).toContain(
      "listEvaluations()",
    );
    expect(evaluationSource).toContain(
      "createEvaluation(payload())",
    );
    expect(evaluationSource).toContain(
      "updateEvaluation(selected.evaluationFormId, payload())",
    );
    expect(evaluationSource).toContain(
      "deleteEvaluation(selected.evaluationFormId)",
    );
    expect(evaluationSource).not.toContain(
      "window.localStorage",
    );
  });

  it("models the evaluation timing, respondent, identity, and question rules", () => {
    expect(evaluationSource).toContain(
      'type MockTiming = "After Training" | "30-Day Follow-up"',
    );
    expect(evaluationSource).toContain(
      'type MockRespondent = "Employee" | "Manager"',
    );
    expect(evaluationSource).toContain("anonymous: boolean");
    expect(evaluationSource).toContain("required: boolean");
    expect(evaluationSource).toContain("section: EvaluationSection");
  });

  it("supports form and question management", () => {
    expect(evaluationSource).toContain("handleNew");
    expect(evaluationSource).toContain("handleEdit");
    expect(evaluationSource).toContain("handleDuplicate");
    expect(evaluationSource).toContain("handleDelete");
    expect(evaluationSource).toContain("handleSave");
    expect(evaluationSource).toContain("handleEditQuestion");
    expect(evaluationSource).toContain("handleRemoveQuestion");
    expect(evaluationSource).toContain("handleMoveQuestion");
  });

  it("validates publish readiness and choice options", () => {
    expect(evaluationSource).toContain(
      "Single Choice questions need at least two options.",
    );
    expect(evaluationSource).toContain(
      "Add at least one question before publishing.",
    );
    expect(evaluationSource).toContain(
      "Published evaluations need at least one required question.",
    );
  });

  it("provides interactive preview and real CSV export", () => {
    expect(evaluationSource).toContain("renderQuestionPreview");
    expect(evaluationSource).toContain("setPreviewAnswers");
    expect(evaluationSource).toContain(
      "createEvaluationCsv(visible)",
    );
    expect(evaluationSource).toContain('type: "text/csv;charset=utf-8"');
  });
});
