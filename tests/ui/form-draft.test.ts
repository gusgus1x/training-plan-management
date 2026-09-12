import { describe, expect, it } from "vitest";
import {
  blankDraft,
  blankItem,
  draftFromAssessment,
  toAssessmentInput,
  toEvaluationInput,
  toPreviewItems,
  type FormDraft,
} from "../../app/components/forms/formDraft";
import type { AssessmentRecord } from "../../app/lib/assessments/types";

/**
 * One draft shape serves both kinds of form, so the mapping in and out of it is where the two can
 * quietly contradict each other. These are the three things that must not slip: what comes back is
 * what went in, a section break is never scored, and a preview can never carry an answer key.
 */

const assessment = (): AssessmentRecord => ({
  assessmentId: "1",
  assessmentSeriesId: "10",
  companyId: "2",
  companyCode: "ATA",
  companyName: "เอทีเอ",
  scope: "COMPANY",
  seriesCode: "PRE-001",
  seriesName: "ความปลอดภัย",
  purpose: "PRE_TEST",
  versionNo: 1,
  versionNote: null,
  instructions: "อ่านให้ครบก่อนตอบ",
  passingScorePercent: "60",
  timeLimitMinutes: 30,
  status: "DRAFT",
  isUsed: false,
  createdBy: "1",
  canModify: true,
  canCreateVersion: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: null,
  questions: [
    {
      questionId: "q1",
      questionOrder: 1,
      questionText: "ข้อใดถูก",
      questionType: "SINGLE_CHOICE",
      questionScore: "2",
      questionDescription: null,
      nextSection: null,
      isRequired: true,
      choices: [
        { choiceId: "c1", choiceOrder: 1, choiceText: "ก", isCorrect: true, optionScore: "2", nextSection: null, axis: null, correctColumns: null },
        { choiceId: "c2", choiceOrder: 2, choiceText: "ข", isCorrect: false, optionScore: "2", nextSection: null, axis: null, correctColumns: null },
      ],
    },
  ],
});

describe("the shared form draft", () => {
  it("carries an assessment out and back without losing what it was", () => {
    const draft = draftFromAssessment(assessment());
    const input = toAssessmentInput(draft, "ACTIVE");

    expect(input.seriesCode).toBe("PRE-001");
    expect(input.timeLimitMinutes).toBe(30);
    expect(input.status).toBe("ACTIVE");
    expect(input.questions[0].questionScore).toBe("2");
    expect(input.questions[0].choices.map((choice) => choice.isCorrect)).toEqual([true, false]);
  });

  it("writes no time limit when the field is left blank", () => {
    const draft = { ...draftFromAssessment(assessment()), timeLimitMinutes: "" };
    expect(toAssessmentInput(draft, "DRAFT").timeLimitMinutes).toBeNull();
  });

  it("never scores a section break or a text block", () => {
    const draft: FormDraft = {
      ...draftFromAssessment(assessment()),
      items: [blankItem("SECTION_BREAK"), blankItem("TEXT_BLOCK")],
    };
    const input = toAssessmentInput(draft, "DRAFT");

    expect(input.questions.map((question) => question.questionScore)).toEqual(["0", "0"]);
    // Neither is answerable, so neither may be required.
    expect(input.questions.every((question) => question.isRequired === false)).toBe(true);
  });

  it("gives an evaluation no right answer to tick", () => {
    const draft: FormDraft = { ...draftFromAssessment(assessment()), items: [blankItem("SINGLE_CHOICE")] };
    const input = toEvaluationInput(draft, "PUBLISHED");

    // EvaluationOptionInput has nowhere to put correctness, which is the point.
    expect(Object.keys(input.questions[0].options[0])).not.toContain("isCorrect");
  });

  it("hands the preview no way to show which answer is right", () => {
    const items = toPreviewItems(draftFromAssessment(assessment()));

    expect(items[0].options).toHaveLength(2);
    for (const option of items[0].options) {
      expect(Object.keys(option)).not.toContain("isCorrect");
    }
  });
});

describe("grid questions in the shared draft", () => {
  const gridRecord = (): AssessmentRecord => ({
    ...assessment(),
    questions: [
      {
        questionId: "q1",
        questionOrder: 1,
        questionText: "ประเมินวิทยากร",
        questionType: "MULTIPLE_CHOICE_GRID",
        questionScore: "3",
        questionDescription: null,
        nextSection: null,
        isRequired: true,
        choices: [
          { choiceId: "r1", choiceOrder: 1, choiceText: "ความชัดเจน", isCorrect: false, optionScore: "2", nextSection: null, axis: "ROW", correctColumns: "1" },
          { choiceId: "r2", choiceOrder: 2, choiceText: "การตอบคำถาม", isCorrect: false, optionScore: "1", nextSection: null, axis: "ROW", correctColumns: "2" },
          { choiceId: "c1", choiceOrder: 3, choiceText: "ดี", isCorrect: false, optionScore: "0", nextSection: null, axis: "COLUMN", correctColumns: null },
          { choiceId: "c2", choiceOrder: 4, choiceText: "พอใช้", isCorrect: false, optionScore: "0", nextSection: null, axis: "COLUMN", correctColumns: null },
        ],
      },
    ],
  });

  it("keeps each row's points and its own answer key", () => {
    const input = toAssessmentInput(draftFromAssessment(gridRecord()), "DRAFT");
    const rows = input.questions[0].choices.filter((choice) => choice.axis === "ROW");

    expect(rows.map((row) => row.optionScore)).toEqual(["2", "1"]);
    // Positions among the columns, not ids: both repositories rewrite every row on save.
    expect(rows.map((row) => row.correctColumns)).toEqual(["1", "2"]);
  });

  it("scores the grid as the sum of its rows, which is what the server checks", () => {
    const input = toAssessmentInput(draftFromAssessment(gridRecord()), "DRAFT");
    expect(Number(input.questions[0].questionScore)).toBe(3);
  });

  it("gives a column no answer key and no points of its own", () => {
    const input = toAssessmentInput(draftFromAssessment(gridRecord()), "DRAFT");
    const columns = input.questions[0].choices.filter((choice) => choice.axis === "COLUMN");

    expect(columns.every((column) => column.correctColumns === null)).toBe(true);
    expect(columns.map((column) => column.optionScore)).toEqual(["0", "0"]);
  });

  it("starts a new grid with rows and columns to fill in", () => {
    const created = blankItem("CHECKBOX_GRID");

    expect(created.options.filter((option) => option.axis === "ROW")).toHaveLength(2);
    expect(created.options.filter((option) => option.axis === "COLUMN")).toHaveLength(2);
  });
});

describe("the payload a new assessment version is created with", () => {
  /**
   * createAssessmentVersion refuses the call with ASSESSMENT_SERIES_MISMATCH unless the code, the
   * name and the purpose arrive exactly as the series holds them. The builder sends the loaded
   * draft untouched, and this is what fails if anybody decorates it again - an earlier version of
   * that screen appended "-V2" to the code, which the server could only refuse.
   */
  it("carries the series identity through unchanged", () => {
    const record = assessment();
    const input = toAssessmentInput(draftFromAssessment(record), "DRAFT");

    expect(input.seriesCode).toBe(record.seriesCode);
    expect(input.seriesName).toBe(record.seriesName);
    expect(input.purpose).toBe(record.purpose);
  });
});

describe("what the builder has to carry for a branched form", () => {
  /**
   * Branch targets are section ordinals stored on the row and on each option. The builder edits
   * them, so the mapping out of the draft has to keep both, or a form branches in the editor and
   * runs straight through for the learner.
   */
  it("writes a section's target, and a single choice's target per option", () => {
    const draft = draftFromAssessment(assessment());
    const branched: FormDraft = {
      ...draft,
      items: [
        { ...blankItem("SECTION_BREAK"), text: "ส่วนที่สอง", nextSection: 3 },
        ...draft.items.map((item) => ({
          ...item,
          options: item.options.map((option, index) => ({ ...option, nextSection: index === 0 ? 3 : null })),
        })),
      ],
    };
    const input = toAssessmentInput(branched, "DRAFT");

    expect(input.questions[0].nextSection).toBe(3);
    expect(input.questions[1].choices.map((choice) => choice.nextSection)).toEqual([3, null]);
  });

  it("carries the version note, and sends nothing when it is blank", () => {
    const draft = draftFromAssessment(assessment());

    expect(toAssessmentInput({ ...draft, versionNote: " แก้เฉลยข้อ 3 " }, "DRAFT").versionNote).toBe("แก้เฉลยข้อ 3");
    expect(toAssessmentInput({ ...draft, versionNote: "   " }, "DRAFT").versionNote).toBeNull();
  });
});

describe("the marks the builder writes", () => {
  /**
   * Grading reads `question_score` for a choice question and the row's `option_score` for a grid,
   * so what the builder writes into those two is the whole of what a learner is scored on. The
   * choice scores are not read by the grader, but a wrong answer recorded as worth the question's
   * marks is a lie sitting in the table, and the old editor never wrote one.
   */
  it("gives the question's marks to the right answer only", () => {
    const record = assessment();
    const input = toAssessmentInput(draftFromAssessment(record), "DRAFT");
    const choices = input.questions[0].choices;

    expect(input.questions[0].questionScore).toBe("2");
    expect(choices.filter((choice) => choice.isCorrect).map((choice) => choice.optionScore)).toEqual(["2"]);
    expect(choices.filter((choice) => !choice.isCorrect).every((choice) => Number(choice.optionScore) === 0)).toBe(true);
  });

  it("scores a grid as the sum of its rows, and gives a column nothing", () => {
    const grid = blankItem("MULTIPLE_CHOICE_GRID");
    const draft: FormDraft = {
      ...draftFromAssessment(assessment()),
      items: [
        {
          ...grid,
          text: "ประเมินวิทยากร",
          options: grid.options.map((option, index) =>
            option.axis === "ROW" ? { ...option, score: index === 0 ? "2" : "1" } : option,
          ),
        },
      ],
    };
    const input = toAssessmentInput(draft, "DRAFT");
    const choices = input.questions[0].choices;

    expect(Number(input.questions[0].questionScore)).toBe(3);
    expect(choices.filter((choice) => choice.axis === "ROW").map((choice) => choice.optionScore)).toEqual(["2", "1"]);
    expect(choices.filter((choice) => choice.axis === "COLUMN").every((choice) => Number(choice.optionScore) === 0)).toBe(true);
  });

  it("numbers a rating one to five, which is what the evaluation service checks", () => {
    const draft = blankDraft("evaluation", null, false);
    const named = { ...draft, name: "ความพึงพอใจ", items: draft.items.map((item) => ({ ...item, text: "วิทยากร" })) };
    const input = toEvaluationInput(named, "DRAFT");

    expect(input.questions[0].questionType).toBe("RATING");
    expect(input.questions[0].options.map((option) => option.optionValue)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("lets only a section send the form onward, and only a single choice branch on an answer", () => {
    const draft = draftFromAssessment(assessment());
    const branched: FormDraft = {
      ...draft,
      items: draft.items.map((item) => ({
        ...item,
        type: "MULTIPLE_CHOICE" as const,
        nextSection: 2,
        options: item.options.map((option) => ({ ...option, nextSection: 3 })),
      })),
    };
    const input = toAssessmentInput(branched, "DRAFT");

    expect(input.questions[0].nextSection).toBeNull();
    expect(input.questions[0].choices.every((choice) => choice.nextSection === null)).toBe(true);
  });
});
