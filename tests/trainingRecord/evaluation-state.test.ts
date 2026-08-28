import { describe, expect, it } from "vitest";
import { evaluationStateOf } from "../../app/components/center_factory/TrainingRecordManagement/modules/TrainingRecord";

const none = { mode: "NONE", link: null } as const;
const link = { mode: "LINK", link: "https://forms.example.com/abc" } as const;
const form = { mode: "FORM", link: null } as const;

describe("whether an attendee's evaluation is outstanding", () => {
  it("is not pending when the course has no evaluation", () => {
    // evaluation_submission is empty, so the old rule reported "รอดำเนินการ" for every attendee -
    // including on courses that have no evaluation, leaving HRD waiting on nothing.
    expect(evaluationStateOf(none, false)).toBe("None");
  });

  it("is not pending when the evaluation lives on somebody else's form", () => {
    // This system cannot read a Google Form, so it can never say the evaluation was completed.
    // Reporting "pending" forever would be a claim it has no way to check.
    expect(evaluationStateOf(link, false)).toBe("External");
  });

  it("is pending only when the course has an in-system form and nobody submitted", () => {
    expect(evaluationStateOf(form, false)).toBe("Pending");
  });

  it("is done whenever a submission exists, whatever the course declares", () => {
    expect(evaluationStateOf(form, true)).toBe("Done");
    expect(evaluationStateOf(none, true)).toBe("Done");
    expect(evaluationStateOf(link, true)).toBe("Done");
  });
});
