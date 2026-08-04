export const ASSESSMENT_PURPOSES = ["PRE_TEST", "POST_TEST", "GENERAL"] as const;
export const ASSESSMENT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"] as const;
export const ASSESSMENT_QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "TRUE_FALSE",
] as const;

export type AssessmentPurpose = (typeof ASSESSMENT_PURPOSES)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export type AssessmentQuestionType = (typeof ASSESSMENT_QUESTION_TYPES)[number];
export type AssessmentScope = "CENTRAL" | "COMPANY";

export type AssessmentChoiceInput = {
  choiceText: string;
  isCorrect: boolean;
  optionScore: string;
};

export type AssessmentQuestionInput = {
  questionText: string;
  questionType: AssessmentQuestionType;
  questionScore: string;
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
