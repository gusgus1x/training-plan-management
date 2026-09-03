export type { FormStageKey } from "./availability";

/** The two stages that carry an in-system pass/fail assessment. Evaluations are never graded. */
export type GradedStage = "PRE_TEST" | "POST_TEST";
export type EvaluationTimingStage = "EVALUATION" | "EVALUATION_30DAY";

export type PassStatus = "PENDING" | "PASS" | "FAIL";
export type SubmissionLifecycleStatus = "IN_PROGRESS" | "SUBMITTED" | "GRADED";
export type GradingStatus = "PENDING_REVIEW" | "REVIEWED";

/** One answer to one assessment question, as the employee submits it. Server re-derives the
 *  question's real type from the database rather than trusting which of these fields is filled -
 *  a client claiming SHORT_ANSWER for a SINGLE_CHOICE question must not slip an ungraded row past
 *  the scorer. */
export type AssessmentAnswerInput = {
  questionId: string;
  /** SINGLE_CHOICE/TRUE_FALSE: exactly one id. MULTIPLE_CHOICE: one or more. Empty for SHORT_ANSWER. */
  choiceIds: string[];
  /** SHORT_ANSWER only. */
  text: string | null;
};

export type SubmitAssessmentInput = {
  answers: AssessmentAnswerInput[];
};

export type EvaluationAnswerInput = {
  questionId: string;
  /** SINGLE_CHOICE: one id. MULTIPLE_CHOICE: one or more. */
  optionIds: string[];
  /** RATING only. */
  ratingValue: number | null;
  /** SHORT_TEXT/LONG_TEXT only. */
  text: string | null;
};

export type SubmitEvaluationInput = {
  answers: EvaluationAnswerInput[];
};

export type SubmissionSummary = {
  submissionId: string;
  attemptNo: number;
  submittedAt: string | null;
  /** Percentage 0-100, on the same scale as the assessment's passingScorePercent. Null until every
   *  answer in this attempt has been graded - a partial score would misstate a submission that
   *  still has an ungraded short-answer question. */
  score: number | null;
  passStatus: PassStatus;
  status: SubmissionLifecycleStatus;
  gradingStatus: GradingStatus;
  /** Google Forms' "release grades" gate. An auto-graded attempt publishes at submit time; one that
   *  needed a human to read a written answer stays unpublished until HRD releases it, and the score
   *  is withheld from the employee (and from the official training_result) until then. */
  resultsPublished: boolean;
};

export type AssessmentChoiceForEmployee = {
  choiceId: string;
  choiceOrder: number;
  choiceText: string;
  // Deliberately no isCorrect / optionScore - this projection is what gets sent to the person
  // being tested. AssessmentRecord (app/lib/assessments/types.ts) carries both and must never be
  // reused here.
};

export type AssessmentQuestionForEmployee = {
  questionId: string;
  questionOrder: number;
  questionText: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "TRUE_FALSE";
  questionScore: string;
  isRequired: boolean;
  choices: AssessmentChoiceForEmployee[];
};

export type AssessmentForEmployee = {
  assessmentId: string;
  seriesName: string;
  instructions: string | null;
  timeLimitMinutes: number | null;
  passingScorePercent: string;
  questions: AssessmentQuestionForEmployee[];
  /** Every attempt taken so far, newest first. Empty means never attempted. */
  submissions: SubmissionSummary[];
};

export type EvaluationOptionForEmployee = {
  optionId: string;
  optionOrder: number;
  optionText: string;
};

export type EvaluationQuestionForEmployee = {
  questionId: string;
  questionOrder: number;
  questionText: string;
  questionType: "RATING" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_TEXT" | "LONG_TEXT";
  sectionName: string | null;
  isRequired: boolean;
  options: EvaluationOptionForEmployee[];
};

export type EvaluationForEmployee = {
  evaluationFormId: string;
  formName: string;
  description: string | null;
  isAnonymous: boolean;
  questions: EvaluationQuestionForEmployee[];
  /** Submitted once means it can never be submitted again - evaluation_submission carries
   *  UNIQUE(evaluation_form_id, enrollment_id). */
  alreadySubmitted: boolean;
  submittedAt: string | null;
};

export type GradeAnswerInput = {
  answerId: string;
  scoreAwarded: number;
  reviewComment: string | null;
};

export type GradeSubmissionInput = {
  answers: GradeAnswerInput[];
};

export type StageSetting = {
  stage: GradedStage;
  /** NONE/LINK stages have nothing for HRD to close - the panel shows them without a switch. */
  mode: "NONE" | "LINK" | "FORM";
  opensAt: string;
  closedAt: string | null;
};

export type SetStageClosedInput = {
  stage: GradedStage;
  closed: boolean;
};

export type PendingGradingAnswer = {
  answerId: string;
  questionText: string;
  questionScore: string;
  answerText: string | null;
};

export type PendingGradingSubmission = {
  submissionId: string;
  enrollmentId: string;
  employeeCode: string;
  employeeName: string;
  stage: GradedStage;
  attemptNo: number;
  submittedAt: string | null;
  pendingAnswers: PendingGradingAnswer[];
  /** Already graded, waiting only for HRD to release the score. `pendingAnswers` is empty on these
   *  rows - the panel shows a publish button instead of score inputs. */
  awaitingPublication: boolean;
};
