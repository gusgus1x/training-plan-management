export const EVALUATION_STATUSES = ["DRAFT", "PUBLISHED", "INACTIVE"] as const;
export const EVALUATION_TIMINGS = ["AFTER_TRAINING", "FOLLOW_UP_30_DAYS"] as const;
export const EVALUATION_RESPONDENTS = ["EMPLOYEE", "MANAGER"] as const;
export const EVALUATION_QUESTION_TYPES = [
  "RATING",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_TEXT",
  "LONG_TEXT",
] as const;

export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];
export type EvaluationTiming = (typeof EVALUATION_TIMINGS)[number];
export type EvaluationRespondent = (typeof EVALUATION_RESPONDENTS)[number];
export type EvaluationQuestionType = (typeof EVALUATION_QUESTION_TYPES)[number];
export type EvaluationScope = "CENTRAL" | "COMPANY";

export type EvaluationOptionInput = {
  optionText: string;
  optionValue: string | null;
};

export type EvaluationQuestionInput = {
  questionText: string;
  questionType: EvaluationQuestionType;
  sectionName: string | null;
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
