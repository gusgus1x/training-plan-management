import { describe, expect, it } from "vitest";
import { gridRowAverage, groupBySectionAverages } from "../../app/lib/trainingForms/sectionAverages";
import type { EvaluationSummaryQuestion } from "../../app/lib/trainingForms/types";

const question = (
  questionId: string,
  questionType: EvaluationSummaryQuestion["questionType"],
  sectionName: string | null,
  extra: Partial<EvaluationSummaryQuestion> = {},
): EvaluationSummaryQuestion => ({
  questionId,
  questionOrder: Number(questionId),
  questionText: `Q${questionId}`,
  questionType,
  sectionName,
  answeredBy: 4,
  averageRating: null,
  ratingDistribution: [],
  options: [],
  gridRows: [],
  textAnswers: [],
  textAnswersWithheld: false,
  ...extra,
});

const cells = (...counts: number[]) =>
  counts.map((count, index) => ({ columnId: `c${index}`, columnText: `C${index}`, count, percent: 0 }));

describe("Evaluation results Advanced view grouping", () => {
  it("keeps every question type, grouped by the form's own sections in form order", () => {
    const groups = groupBySectionAverages([
      question("1", "RATING", null, { averageRating: 4.5 }),
      question("2", "SECTION_BREAK", "Part 2"),
      question("3", "RATING", "Part 2", { averageRating: 4 }),
      question("4", "SINGLE_CHOICE", "Part 2"),
      question("5", "MULTIPLE_CHOICE", "Part 2"),
      question("6", "MULTIPLE_CHOICE_GRID", "Part 2", {
        gridRows: [
          { rowId: "r1", rowText: "Clarity", answeredBy: 4, cells: cells(1, 0, 0, 0, 3) },
          { rowId: "r2", rowText: "Pace", answeredBy: 0, cells: cells(0, 0, 0, 0, 0) },
        ],
      }),
      question("7", "CHECKBOX_GRID", "Part 2"),
      question("8", "LONG_TEXT", "Part 2"),
      question("9", "TEXT_BLOCK", "Part 2"),
      question("10", "RATING", "Part 3", { averageRating: 3.25 }),
    ]);

    expect(groups.map((group) => group.name)).toEqual([null, "Part 2", "Part 3"]);
    const part2 = groups[1];
    expect(part2.averages.map((item) => [item.key, item.average, item.outOf])).toEqual([
      ["3", 4, 5],
      ["6:r1", 4, 5],
      ["6:r2", null, 5],
    ]);
    expect(part2.choices.map((q) => q.questionId)).toEqual(["4", "5"]);
    expect(part2.checkboxGrids.map((q) => q.questionId)).toEqual(["7"]);
    expect(part2.texts.map((q) => q.questionId)).toEqual(["8"]);
  });

  it("averages a grid row by column position, out of its column count", () => {
    // 1 person on column 1 and 3 on column 5: (1*1 + 3*5) / 4 = 4.
    expect(gridRowAverage(cells(1, 0, 0, 0, 3))).toBe(4);
    expect(gridRowAverage(cells(1, 1, 1))).toBe(2);
    expect(gridRowAverage(cells(0, 0))).toBeNull();
  });
});
