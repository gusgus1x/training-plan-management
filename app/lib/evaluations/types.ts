import { FORM_BLOCK_TYPES } from "../formBlocks";
import type { GridAxis } from "../formGrids";

export const EVALUATION_STATUSES = ["DRAFT", "PUBLISHED", "INACTIVE"] as const;
export const EVALUATION_TIMINGS = ["AFTER_TRAINING", "FOLLOW_UP_30_DAYS"] as const;
export const EVALUATION_RESPONDENTS = ["EMPLOYEE", "MANAGER"] as const;
export const EVALUATION_QUESTION_TYPES = [
  "RATING",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_TEXT",
  "LONG_TEXT",
  // Grids are answerable, so unlike section breaks and text blocks they belong in this list and
  // in the Answer Type dropdown it feeds.
  "MULTIPLE_CHOICE_GRID",
  "CHECKBOX_GRID",
] as const;

export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];
export type EvaluationTiming = (typeof EVALUATION_TIMINGS)[number];
export type EvaluationRespondent = (typeof EVALUATION_RESPONDENTS)[number];
export type EvaluationQuestionType = (typeof EVALUATION_QUESTION_TYPES)[number];
export type EvaluationScope = "CENTRAL" | "COMPANY";

// EVALUATION_QUESTION_TYPES stays the ANSWERABLE set: it feeds the Answer Type dropdown and the
// exhaustive QUESTION_TYPE_LABELS record. Rows on a form can also be section breaks and text
// blocks, which must never appear in that dropdown — hence a second, wider union used only where a
// stored row is read or written.
export const EVALUATION_ROW_TYPES = [
  ...EVALUATION_QUESTION_TYPES,
  ...FORM_BLOCK_TYPES,
] as const;
export type EvaluationRowType = (typeof EVALUATION_ROW_TYPES)[number];

export type EvaluationOptionInput = {
  optionText: string;
  optionValue: string | null;
  /** 1-based section ordinal to jump to when this option is chosen. SINGLE_CHOICE only. */
  nextSection: number | null;
  /** 'ROW' / 'COLUMN' on a grid question, null on an ordinary option. */
  axis: GridAxis | null;
};

export type EvaluationQuestionInput = {
  questionText: string;
  questionType: EvaluationRowType;
  sectionName: string | null;
  /** Body of a TEXT_BLOCK, sub-caption of a SECTION_BREAK. Null on a real question. */
  questionDescription: string | null;
  /** Default "after this section" target. SECTION_BREAK only. */
  nextSection: number | null;
  isRequired: boolean;
  options: EvaluationOptionInput[];
};

export type EvaluationWriteInput = {
  scope: EvaluationScope;
  companyId: string | null;
  formCode: string;
  formName: string;
  description: string | null;
  timing: EvaluationTiming;
  respondentType: EvaluationRespondent;
  isAnonymous: boolean;
  status: EvaluationStatus;
  questions: EvaluationQuestionInput[];
};

export type EvaluationOptionRecord = EvaluationOptionInput & {
  evaluationOptionId: string;
  optionOrder: number;
};

export type EvaluationQuestionRecord = Omit<EvaluationQuestionInput, "options"> & {
  evaluationQuestionId: string;
  questionOrder: number;
  options: EvaluationOptionRecord[];
};

export type EvaluationRecord = {
  evaluationFormId: string;
  companyId: string | null;
  companyCode: string | null;
  companyName: string | null;
  scope: EvaluationScope;
  formCode: string;
  formName: string;
  description: string | null;
  timing: EvaluationTiming;
  respondentType: EvaluationRespondent;
  isAnonymous: boolean;
  status: EvaluationStatus;
  questions: EvaluationQuestionRecord[];
  isUsed: boolean;
  canModify: boolean;
  canDuplicate: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export type EvaluationListFilters = {
  search: string | null;
  status: EvaluationStatus | null;
  timing: EvaluationTiming | null;
  respondentType: EvaluationRespondent | null;
  skip: number;
  take: number;
};
