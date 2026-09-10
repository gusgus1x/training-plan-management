import { describe, expect, it } from "vitest";
import { parseSubmitAssessment, parseSubmitEvaluation } from "../../app/lib/trainingForms/validation";

/**
 * The API boundary, which is where grid answers were being lost.
 *
 * The screen sent them and the repository knew how to store them; the parser in between built its
 * result field by field and never mentioned `grid`, so every grid pick was dropped on the way past.
 * Nothing failed loudly - the forms recorded nothing and the report counted nobody.
 */

describe("grid answers survive the submit parsers", () => {
  it("keeps an assessment's grid picks", () => {
    const { answers } = parseSubmitAssessment({
      answers: [
        {
          questionId: "1",
          choiceIds: [],
          text: null,
          grid: [
            { rowId: "10", columnIds: ["21"] },
            { rowId: "11", columnIds: ["22", "23"] },
          ],
        },
      ],
    });

    expect(answers[0].grid).toEqual([
      { rowId: "10", columnIds: ["21"] },
      { rowId: "11", columnIds: ["22", "23"] },
    ]);
  });

  it("keeps an evaluation's grid picks", () => {
    const { answers } = parseSubmitEvaluation({
      answers: [
        { questionId: "7", optionIds: [], ratingValue: null, text: null, grid: [{ rowId: "30", columnIds: ["41"] }] },
      ],
    });

    expect(answers[0].grid).toEqual([{ rowId: "30", columnIds: ["41"] }]);
  });

  it("leaves grid undefined when the form has none", () => {
    // Not an empty array: the repository branches on `grid?.length`, and an empty one would still
    // take the grid path and write nothing for a rating or a written answer.
    const { answers } = parseSubmitEvaluation({
      answers: [{ questionId: "2", optionIds: [], ratingValue: 4, text: null }],
    });

    expect(answers[0].grid).toBeUndefined();
  });

  it("refuses a grid row with no rowId, rather than silently dropping the row", () => {
    expect(() =>
      parseSubmitEvaluation({
        answers: [{ questionId: "7", optionIds: [], ratingValue: null, text: null, grid: [{ columnIds: ["41"] }] }],
      }),
    ).toThrow();
  });
});
