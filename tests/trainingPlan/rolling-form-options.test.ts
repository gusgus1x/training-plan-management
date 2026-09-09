import { describe, expect, it } from "vitest";
import {
  FORM_STAGES,
  optionsForStage,
} from "../../app/components/center_factory/TrainingPlanManagement/modules/TrainingRolling";

/**
 * Which forms a batch may be pointed at, per stage. The two evaluation stages ask different
 * questions - the after-training form is about the course, the 30-day one about what changed in the
 * person - so offering either in either slot sets a batch up asking the wrong thing. Course Master
 * has always filtered this way; the batch screen offered every form to both slots until now.
 *
 * The timing strings are the database's own enum, which is also what the form code is derived from
 * (AFTER_TRAINING gives EVL-AFTER, FOLLOW_UP_30_DAYS gives EVL-30DAY - see
 * app/lib/evaluations/repository.ts computeDefaultEvaluationCode).
 */

const stage = (idKey: (typeof FORM_STAGES)[number]["idKey"]) =>
  FORM_STAGES.find((entry) => entry.idKey === idKey)!;

const assessments = [
  { id: "1", label: "pre", kind: "PRE_TEST" as const },
  { id: "2", label: "post", kind: "POST_TEST" as const },
  { id: "3", label: "either", kind: "GENERAL" as const },
];

const evaluations = [
  { id: "10", label: "[EVL-AFTER-000001] ประเมินวิชา", kind: "EVALUATION" as const, timing: "AFTER_TRAINING" as const },
  { id: "11", label: "[EVL-30DAY-000001] ประเมินหลังอบรม 30 วัน", kind: "EVALUATION" as const, timing: "FOLLOW_UP_30_DAYS" as const },
];

describe("optionsForStage", () => {
  it("offers only after-training evaluations in the after-training slot", () => {
    const options = optionsForStage(stage("evaluationFormId"), assessments, evaluations);
    expect(options.map((option) => option.id)).toEqual(["10"]);
  });

  it("offers only 30-day evaluations in the 30-day slot", () => {
    const options = optionsForStage(stage("evaluationFormAfter30DayId"), assessments, evaluations);
    expect(options.map((option) => option.id)).toEqual(["11"]);
  });

  it("still matches assessments by purpose, with a general one usable at either end", () => {
    expect(optionsForStage(stage("preAssessmentId"), assessments, evaluations).map((o) => o.id)).toEqual(["1", "3"]);
    expect(optionsForStage(stage("postAssessmentId"), assessments, evaluations).map((o) => o.id)).toEqual(["2", "3"]);
  });
});
