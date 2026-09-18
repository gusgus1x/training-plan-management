import type { EvaluationSummaryQuestion } from "./types";

/**
 * Evaluation results, Advanced view: the summary regrouped the way the evaluation converter's
 * Advanced mode reports it - one card per section, one average bar per scored item - but with every
 * question type kept, so nothing has to be read in the standard view instead.
 *
 * Unlike the converter, nothing has to be assigned by hand: an in-system form already names its
 * sections (SECTION_BREAK), and every question carries the name of the section it sits in. Questions
 * before the first break have no section and are gathered under `name: null`.
 */

/** One bar on a section's average chart. */
export type AverageItem = {
  key: string;
  question: EvaluationSummaryQuestion;
  /** Set for a grid row: the row's own text. */
  rowText: string | null;
  average: number | null;
  /** The top of the scale: 5 for a rating, the number of columns for a grid. */
  outOf: number;
  answeredBy: number;
};

export type SectionAverageGroup = {
  name: string | null;
  /** Ratings, and each row of a single-answer grid. */
  averages: AverageItem[];
  /** Single and multiple choice: shown as the share of people per option. */
  choices: EvaluationSummaryQuestion[];
  /** Several ticks per row, so no single average: shown as the grid chart. */
  checkboxGrids: EvaluationSummaryQuestion[];
  /** Written questions, shown as the section's comments. */
  texts: EvaluationSummaryQuestion[];
};

/**
 * Mean column position (1..N) of one grid row, to two decimals; null when nobody answered it.
 * Treats the columns as a scale from worst to best, the same reading the standard grid chart uses.
 */
export const gridRowAverage = (cells: { count: number }[]) => {
  const answers = cells.reduce((total, cell) => total + cell.count, 0);
  if (answers === 0) return null;
  const sum = cells.reduce((total, cell, index) => total + cell.count * (index + 1), 0);
  return Math.round((sum / answers) * 100) / 100;
};

const emptyGroup = (name: string | null): SectionAverageGroup => ({
  name,
  averages: [],
  choices: [],
  checkboxGrids: [],
  texts: [],
});

export const groupBySectionAverages = (questions: EvaluationSummaryQuestion[]): SectionAverageGroup[] => {
  const groups: SectionAverageGroup[] = [];
  for (const question of questions) {
    if (question.questionType === "SECTION_BREAK" || question.questionType === "TEXT_BLOCK") continue;
    let group = groups.find((candidate) => candidate.name === question.sectionName);
    if (!group) {
      group = emptyGroup(question.sectionName);
      groups.push(group);
    }

    switch (question.questionType) {
      case "RATING":
        group.averages.push({
          key: question.questionId,
          question,
          rowText: null,
          average: question.averageRating,
          outOf: 5,
          answeredBy: question.answeredBy,
        });
        break;
      case "MULTIPLE_CHOICE_GRID":
        for (const row of question.gridRows) {
          group.averages.push({
            key: `${question.questionId}:${row.rowId}`,
            question,
            rowText: row.rowText,
            average: gridRowAverage(row.cells),
            outOf: row.cells.length,
            answeredBy: row.answeredBy,
          });
        }
        break;
      case "CHECKBOX_GRID":
        group.checkboxGrids.push(question);
        break;
      case "SHORT_TEXT":
      case "LONG_TEXT":
        group.texts.push(question);
        break;
      default:
        group.choices.push(question);
    }
  }
  return groups;
};
