import type { FormBlockType } from "../formBlocks";
import type { GridAxis, GridQuestionType } from "../formGrids";

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
/** One row of a grid answer: which columns were picked for that row. */
export type GridRowAnswerInput = {
  rowId: string;
  columnIds: string[];
};

export type AssessmentAnswerInput = {
  questionId: string;
  /** SINGLE_CHOICE/TRUE_FALSE: exactly one id. MULTIPLE_CHOICE: one or more. Empty for SHORT_ANSWER. */
  choiceIds: string[];
  /** SHORT_ANSWER only. */
  text: string | null;
  /** Grid questions only. A grid answer cannot live in choiceIds because a column alone does not
   *  say which row it was picked for. */
  grid?: GridRowAnswerInput[];
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
  /** Grid questions only - see AssessmentAnswerInput.grid. */
  grid?: GridRowAnswerInput[];
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
  /** 1-based section to jump to when this choice is picked. Navigation only - it reveals nothing
   *  about correctness, so it is safe in the employee projection. */
  nextSection: number | null;
  /** 'ROW' / 'COLUMN' on a grid question. Layout, not correctness. */
  axis: GridAxis | null;
  // Deliberately no isCorrect / optionScore - this projection is what gets sent to the person
  // being tested. AssessmentRecord (app/lib/assessments/types.ts) carries both and must never be
  // reused here.
};

export type AssessmentQuestionForEmployee = {
  questionId: string;
  questionOrder: number;
  questionText: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "TRUE_FALSE" | GridQuestionType | FormBlockType;
  questionScore: string;
  questionDescription: string | null;
  nextSection: number | null;
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
  /** 1-based section to jump to when this option is picked. */
  nextSection: number | null;
  /** 'ROW' / 'COLUMN' on a grid question. */
  axis: GridAxis | null;
};

export type EvaluationQuestionForEmployee = {
  questionId: string;
  questionOrder: number;
  questionText: string;
  questionType: "RATING" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "SHORT_TEXT" | "LONG_TEXT" | GridQuestionType | FormBlockType;
  sectionName: string | null;
  questionDescription: string | null;
  nextSection: number | null;
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

/** Free-text answers are hidden until this many people have answered the form. Even on an anonymous
 *  form a written comment can identify its author when the batch is small enough. */
export const FREE_TEXT_MIN_RESPONDENTS = 3;

export type EvaluationSummaryOption = {
  optionId: string;
  optionText: string;
  /** Respondents who picked this option - people, not answer rows. A MULTIPLE_CHOICE question
   *  stores one row per tick, so counting rows would count one person several times. */
  count: number;
  percent: number;
};

export type EvaluationSummaryGridCell = {
  columnId: string;
  columnText: string;
  /** People who picked this column FOR THIS ROW. */
  count: number;
  /** Share of the people who answered this row, not of the whole question. */
  percent: number;
};

export type EvaluationSummaryGridRow = {
  rowId: string;
  rowText: string;
  /** People who answered this row at all. Rows of a grid are answered independently, so one row
   *  can have far fewer respondents than the question as a whole. */
  answeredBy: number;
  cells: EvaluationSummaryGridCell[];
};

export type EvaluationSummaryQuestion = {
  questionId: string;
  questionOrder: number;
  questionText: string;
  questionType: EvaluationQuestionForEmployee["questionType"];
  sectionName: string | null;
  /** How many people answered THIS question (a question nobody answered is not the same as one
   *  everybody scored badly). */
  answeredBy: number;
  /** RATING only: mean of the 1-5 values, and how many people gave each value. */
  averageRating: number | null;
  ratingDistribution: { value: number; count: number }[];
  /** Choice questions only. Empty for a grid, whose axes are not options. */
  options: EvaluationSummaryOption[];
  /**
   * Grid questions only: one entry per row, each carrying a count per column.
   *
   * A grid cannot be summarised as a flat option list. Its answers are (row, column) pairs, so
   * counting by column alone collapses the rows together and reports "people who picked this
   * column somewhere in the grid" - which is never the question anyone is asking.
   */
  gridRows: EvaluationSummaryGridRow[];
  /** Free-text only, and only once the form clears FREE_TEXT_MIN_RESPONDENTS. */
  textAnswers: string[];
  textAnswersWithheld: boolean;
};

/**
 * Who the answers came from. Two audiences answer the same form about the same course - the person
 * who attended, and the supervisor asked to evaluate them - and their answers mean different
 * things. A summary always covers exactly one of them: averaging a class's own view together with
 * their supervisors' produces a number that describes nobody.
 */
export const EVALUATION_RESPONDENT_GROUPS = ["EMPLOYEE", "SUPERVISOR"] as const;
export type EvaluationRespondentGroup = (typeof EVALUATION_RESPONDENT_GROUPS)[number];

export type EvaluationSummary = {
  evaluationFormId: string;
  formName: string;
  description: string | null;
  isAnonymous: boolean;
  timing: EvaluationTimingStage;
  respondentGroup: EvaluationRespondentGroup;
  /** How many people were expected to answer: the attendees for the EMPLOYEE group, the assigned
   *  supervisors for the SUPERVISOR one. Everything else here is meaningless without it. */
  expectedCount: number;
  submittedCount: number;
  responseRatePercent: number;
  questions: EvaluationSummaryQuestion[];
};

/** One question the employee did not get full marks on, as shown back to them after the result is
 *  released. Deliberately carries NO correct answer and no choice list: the point is to send them
 *  back to the material before another attempt, not to hand them the answer key. */
export type MissedQuestion = {
  questionId: string;
  questionOrder: number;
  questionText: string;
  scoreAwarded: number;
  questionScore: number;
  /** HRD's note on a written answer, when they left one. */
  reviewComment: string | null;
};

/** One released attempt, as a line on the attempt list. Carries no questions: the list is there to
 *  choose from, and the chosen attempt is the one that arrives in full. */
export type AssessmentAttemptSummary = {
  submissionId: string;
  attemptNo: number;
  submittedAt: string | null;
  /** False while HRD has not released this attempt. The fields below say what may still be shown. */
  resultsPublished: boolean;
  /** Released attempts only - the final percentage and verdict are HRD's to hand out. */
  scorePercent: number | null;
  passStatus: PassStatus;
  /** Released attempts only, for the same reason. `totalPossible` is safe either way: what the
   *  paper is worth is not a result. */
  totalAwarded: number | null;
  totalPossible: number;
  /**
   * The part this system marked by itself - the questions with a right answer. Shown whether or not
   * the attempt is released, because it cannot change: a matched answer is matched. It is what tells
   * somebody how far the auto-marked questions got them, and so whether another go is worth it
   * without waiting on the written marking.
   */
  autoAwarded: number;
  autoPossible: number;
  /** What the written answers still waiting to be marked are worth. The gap between "what I have"
   *  and "what is still in play". */
  writtenPendingScore: number;
};

export type AssessmentReview = {
  submissionId: string;
  attemptNo: number;
  submittedAt: string | null;
  /** Whether HRD has released THIS attempt. False means the numbers below are the partial ones and
   *  `missedQuestions` is empty - the breakdown is part of the released result. */
  resultsPublished: boolean;
  scorePercent: number | null;
  passStatus: PassStatus;
  passingScorePercent: number;
  totalAwarded: number | null;
  totalPossible: number;
  autoAwarded: number;
  autoPossible: number;
  writtenPendingScore: number;
  missedQuestions: MissedQuestion[];
  /**
   * Every released attempt, newest first, so the employee can look back at any of them rather than
   * only the last one they sat. An unreleased attempt never appears: HRD decides when a score goes
   * out, and that gate is the same one `publication_status` enforces everywhere else.
   */
  attempts: AssessmentAttemptSummary[];
  /** The attempt with the highest score, which is the one that opens by default. Ties go to the
   *  earlier attempt - it got there first. */
  bestAttemptNo: number;
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

/**
 * One evaluation a supervisor has been asked to fill in about somebody else.
 *
 * `mode` decides what the row can honestly claim. FORM means this system holds the answers and
 * `submitted` is real. LINK means the form belongs to somebody else, so `openedAt` - whether the
 * supervisor followed the link at all - is the only thing that can ever be known, and `submitted`
 * stays false however many times they answer it.
 */
export type AssignedEvaluation = {
  enrollmentId: string;
  stage: EvaluationTimingStage;
  attendeeName: string;
  attendeeEmployeeCode: string;
  courseName: string;
  batchNo: number | null;
  startAt: string;
  endAt: string;
  mode: "FORM" | "LINK";
  /** Only set when mode is LINK. */
  link: string | null;
  opensAt: string;
  isOpen: boolean;
  openedAt: string | null;
  submitted: boolean;
};

/**
 * One question on a submitted paper, as HRD sees it while checking or reviewing the answers.
 *
 * This is the marked-up version, with the answer key on it - deliberately a separate type from
 * AssessmentReview, which is what the employee sees and carries no key at all. The two audiences
 * get two shapes so a screen written for one cannot accidentally serve the other.
 */
export type SubmissionReviewQuestion = {
  questionId: string;
  questionOrder: number;
  questionText: string;
  questionType: string;
  questionScore: number;
  /** null while a written answer is still waiting for HRD to mark it. */
  scoreAwarded: number | null;
  /** null for a written answer, whose correctness is a judgement rather than a match. */
  isCorrect: boolean | null;
  /** Set on a written answer that HRD has not marked yet - the reason to be on this screen. */
  needsReview: boolean;
  /** The answer id, which is what a mark is saved against. Only set for a written answer. */
  answerId: string | null;
  answerText: string | null;
  reviewComment: string | null;
  choices: Array<{
    choiceId: string;
    choiceOrder: number;
    choiceText: string;
    isCorrect: boolean;
    /** Whether the person taking the test picked this one. */
    picked: boolean;
    /** Grid rows only: the row this cell belongs to. */
    rowId: string | null;
    axis: "ROW" | "COLUMN" | null;
  }>;
};

/** A whole submitted paper for HRD: who, which attempt, the score so far, and every question. */
export type SubmissionReview = {
  submissionId: string;
  enrollmentId: string;
  employeeName: string;
  employeeCode: string;
  stage: GradedStage;
  attemptNo: number;
  submittedAt: string | null;
  /** What the paper is worth in total, and what has been awarded so far. `scoreAwarded` counts
   *  only what is marked, so it keeps rising as HRD works through the written answers. */
  totalScore: number;
  scoreAwarded: number;
  passingScorePercent: number;
  passStatus: "PENDING" | "PASS" | "FAIL";
  gradingStatus: "PENDING_REVIEW" | "REVIEWED";
  /** False while the score is graded but not yet released to the employee. */
  resultsPublished: boolean;
  questions: SubmissionReviewQuestion[];
};
