import { FORM_BLOCK_TYPES } from "../formBlocks";
import type { GridAxis } from "../formGrids";

export const ASSESSMENT_PURPOSES = ["PRE_TEST", "POST_TEST", "GENERAL"] as const;
export const ASSESSMENT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"] as const;
export const ASSESSMENT_QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "TRUE_FALSE",
  // Grids are answerable, so unlike section breaks and text blocks they belong in this list.
  "MULTIPLE_CHOICE_GRID",
  "CHECKBOX_GRID",
] as const;

export type AssessmentPurpose = (typeof ASSESSMENT_PURPOSES)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export type AssessmentQuestionType = (typeof ASSESSMENT_QUESTION_TYPES)[number];
export type AssessmentScope = "CENTRAL" | "COMPANY";

// ASSESSMENT_QUESTION_TYPES stays the ANSWERABLE set. Rows on an assessment can also be section
// breaks and text blocks, which are never offered as an answer type — see EVALUATION_ROW_TYPES.
export const ASSESSMENT_ROW_TYPES = [
  ...ASSESSMENT_QUESTION_TYPES,
  ...FORM_BLOCK_TYPES,
] as const;
export type AssessmentRowType = (typeof ASSESSMENT_ROW_TYPES)[number];

export type AssessmentChoiceInput = {
  choiceText: string;
  isCorrect: boolean;
  /** On a grid ROW this is that row's point value; elsewhere it mirrors the question score. */
  optionScore: string;
  /** 1-based section ordinal to jump to when this choice is chosen. SINGLE_CHOICE only. */
  nextSection: number | null;
  /** 'ROW' / 'COLUMN' on a grid question, null on an ordinary choice. */
  axis: GridAxis | null;
  /** ROW choices only: choice_order values of that row's correct columns, comma separated. */
  correctColumns: string | null;
};

export type AssessmentQuestionInput = {
  questionText: string;
  questionType: AssessmentRowType;
  questionScore: string;
  /** Body of a TEXT_BLOCK, sub-caption of a SECTION_BREAK. Null on a real question. */
  questionDescription: string | null;
  /** Default "after this section" target. SECTION_BREAK only. */
  nextSection: number | null;
  isRequired: boolean;
  choices: AssessmentChoiceInput[];
};

export type AssessmentWriteInput = {
  scope: AssessmentScope;
  companyId: string | null;
  seriesCode: string;
  seriesName: string;
  purpose: AssessmentPurpose;
  versionNote: string | null;
  instructions: string | null;
  passingScorePercent: string;
  timeLimitMinutes: number | null;
  status: AssessmentStatus;
  questions: AssessmentQuestionInput[];
};

export type AssessmentChoiceRecord = AssessmentChoiceInput & {
  choiceId: string;
  choiceOrder: number;
};

export type AssessmentQuestionRecord = Omit<AssessmentQuestionInput, "choices"> & {
  questionId: string;
  questionOrder: number;
  choices: AssessmentChoiceRecord[];
};

export type AssessmentRecord = {
  assessmentId: string;
  assessmentSeriesId: string;
  companyId: string | null;
  companyCode: string | null;
  companyName: string | null;
  scope: AssessmentScope;
  seriesCode: string;
  seriesName: string;
  purpose: AssessmentPurpose;
  versionNo: number;
  versionNote: string | null;
  instructions: string | null;
  passingScorePercent: string;
  timeLimitMinutes: number | null;
  status: AssessmentStatus;
  questions: AssessmentQuestionRecord[];
  isUsed: boolean;
  /** Who made it. "My forms" on the gallery means this, not the company it belongs to. */
  createdBy: string;
  canModify: boolean;
  canCreateVersion: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export type AssessmentListFilters = {
  search: string | null;
  status: AssessmentStatus | null;
  purpose: AssessmentPurpose | null;
  skip: number;
  take: number;
};
