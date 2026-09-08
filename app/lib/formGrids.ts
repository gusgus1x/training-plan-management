// Grid questions: a multiple choice grid and a checkbox grid, matching Google Forms.
//
// A grid asks the same set of COLUMNS about each of several ROWS. Both axes are stored as ordinary
// option/choice rows of the question, distinguished by `axis`, so ordering and the per-question
// unique constraint keep working untouched.
//
// The difference between the two types is only how many columns a row accepts:
//   MULTIPLE_CHOICE_GRID - one column per row (radio)
//   CHECKBOX_GRID        - any number of columns per row (checkbox)

export const GRID_QUESTION_TYPES = ["MULTIPLE_CHOICE_GRID", "CHECKBOX_GRID"] as const;

export type GridQuestionType = (typeof GRID_QUESTION_TYPES)[number];

export const isGridType = (questionType: string): questionType is GridQuestionType =>
  (GRID_QUESTION_TYPES as readonly string[]).includes(questionType);

/** A row accepts more than one column only in a checkbox grid. */
export const gridAllowsMultiplePerRow = (questionType: string) => questionType === "CHECKBOX_GRID";

export const GRID_AXES = ["ROW", "COLUMN"] as const;
export type GridAxis = (typeof GRID_AXES)[number];

export const MIN_GRID_ROWS = 1;
export const MIN_GRID_COLUMNS = 2;

/**
 * The per-row answer key, stored on the ROW as the comma-separated `choice_order` values of its
 * correct columns.
 *
 * Orders rather than ids, for the same reason branch targets are section ordinals: both
 * repositories delete and recreate every row on save, so an id would dangle immediately. Empty or
 * absent means the row has no answer key and therefore scores nothing.
 */
export const parseCorrectColumns = (value: string | null | undefined): number[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((order) => Number.isInteger(order) && order > 0);
};

export const formatCorrectColumns = (orders: readonly number[]): string | null => {
  const unique = [...new Set(orders.filter((order) => Number.isInteger(order) && order > 0))].sort((a, b) => a - b);
  return unique.length ? unique.join(",") : null;
};

/**
 * Whether one row of a grid was answered correctly.
 *
 * Google Forms scores a grid PER ROW: each row carries its own points and its own correct
 * column(s). A row earns its points only on an exact match - the same all-or-nothing rule Google
 * applies to checkbox questions, so a checkbox-grid row with two of three correct columns ticked
 * scores zero rather than part of the row.
 *
 * A row with no answer key never scores, which is what keeps an unmarked grid from handing out
 * free marks.
 */
export const isGridRowCorrect = (
  correctColumnOrders: readonly number[],
  submittedColumnOrders: readonly number[],
): boolean => {
  if (!correctColumnOrders.length) return false;
  const submitted = new Set(submittedColumnOrders);
  return submitted.size === correctColumnOrders.length
    && correctColumnOrders.every((order) => submitted.has(order));
};

/**
 * A grid's total points: the sum of its rows'.
 *
 * Kept in sync into assessment_question.question_score at write time, which is what lets every
 * existing denominator loop (submitAssessment, gradeSubmission, readAssessmentReviewForEmployee)
 * go on summing question_score per question with no knowledge of grids at all.
 */
export const gridTotalScore = (rowScores: readonly string[]): string =>
  rowScores.reduce((total, score) => total + (Number(score) || 0), 0).toFixed(2);
