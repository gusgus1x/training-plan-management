import { ApiError } from "../api/errors";
import type { InputObject } from "../api/validation";
import { EVALUATION_RESPONDENT_GROUPS } from "./types";
import type {
  AssessmentAnswerInput,
  EvaluationRespondentGroup,
  EvaluationAnswerInput,
  GradeAnswerInput,
  GradeSubmissionInput,
  GradedStage,
  GridRowAnswerInput,
  SetStageClosedInput,
  SubmitAssessmentInput,
  SubmitEvaluationInput,
} from "./types";

const invalid = (field: string, reason: string) =>
  new ApiError({ code: "INVALID_INPUT", message: "The submitted data is invalid", status: 400, details: { field, reason } });

const REVIEW_COMMENT_MAX_LENGTH = 2000;

export const parseGradedStage = (value: string): GradedStage => {
  if (value !== "PRE_TEST" && value !== "POST_TEST") {
    throw invalid("stage", "Stage must be PRE_TEST or POST_TEST");
  }
  return value;
};

export const parseEvaluationTiming = (value: string): "EVALUATION" | "EVALUATION_30DAY" => {
  if (value !== "EVALUATION" && value !== "EVALUATION_30DAY") {
    throw invalid("timing", "Timing must be EVALUATION or EVALUATION_30DAY");
  }
  return value;
};

/** Which audience's answers to summarise. Defaults to the attendees, who are the only respondents
 *  every course has - a plan with no supervisor assigned would otherwise open on an empty tab. */
export const parseEvaluationRespondentGroup = (value: string | null): EvaluationRespondentGroup => {
  if (value === null || value === "") return "EMPLOYEE";
  if (!EVALUATION_RESPONDENT_GROUPS.includes(value as EvaluationRespondentGroup)) {
    throw invalid("respondents", `Respondents must be one of ${EVALUATION_RESPONDENT_GROUPS.join(", ")}`);
  }
  return value as EvaluationRespondentGroup;
};

const readStringArray = (value: unknown, field: string): string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw invalid(field, "Value must be an array of strings");
  }
  return value as string[];
};

/**
 * A grid answer: one entry per row, each naming the columns picked for THAT row.
 *
 * Both submit parsers used to build their result field by field and simply never mention `grid`, so
 * every grid pick was dropped here - between a screen that sent them and a repository that knew how
 * to store them. The forms recorded nothing and the report counted nobody.
 *
 * Absent is not the same as empty: a form with no grid on it sends nothing, and that has to stay
 * `undefined` so the repository takes its non-grid branch.
 */
const readGridAnswer = (value: unknown): GridRowAnswerInput[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw invalid("grid", "Value must be an array of rows");
  return value.map((raw) => {
    if (typeof raw !== "object" || raw === null) {
      throw invalid("grid", "Each grid row must be an object");
    }
    const row = raw as InputObject;
    if (typeof row.rowId !== "string" || row.rowId.trim() === "") {
      throw invalid("grid.rowId", "Each grid row needs a rowId");
    }
    return { rowId: row.rowId, columnIds: readStringArray(row.columnIds, "grid.columnIds") };
  });
};

const parseAssessmentAnswer = (raw: unknown): AssessmentAnswerInput => {
  if (typeof raw !== "object" || raw === null) {
    throw invalid("answers", "Each answer must be an object");
  }
  const item = raw as InputObject;
  if (typeof item.questionId !== "string" || item.questionId.trim() === "") {
    throw invalid("questionId", "Each answer needs a questionId");
  }
  const text = item.text === undefined || item.text === null ? null : String(item.text);
  return {
    questionId: item.questionId,
    choiceIds: readStringArray(item.choiceIds, "choiceIds"),
    text,
    grid: readGridAnswer(item.grid),
  };
};

export const parseSubmitAssessment = (input: InputObject): SubmitAssessmentInput => {
  if (!Array.isArray(input.answers)) {
    throw invalid("answers", "Value must be an array");
  }
  return { answers: input.answers.map(parseAssessmentAnswer) };
};

const parseEvaluationAnswer = (raw: unknown): EvaluationAnswerInput => {
  if (typeof raw !== "object" || raw === null) {
    throw invalid("answers", "Each answer must be an object");
  }
  const item = raw as InputObject;
  if (typeof item.questionId !== "string" || item.questionId.trim() === "") {
    throw invalid("questionId", "Each answer needs a questionId");
  }
  const ratingValue =
    item.ratingValue === undefined || item.ratingValue === null ? null : Number(item.ratingValue);
  if (ratingValue !== null && !Number.isFinite(ratingValue)) {
    throw invalid("ratingValue", "Value must be a number");
  }
  const text = item.text === undefined || item.text === null ? null : String(item.text);
  return {
    questionId: item.questionId,
    optionIds: readStringArray(item.optionIds, "optionIds"),
    ratingValue,
    text,
    grid: readGridAnswer(item.grid),
  };
};

export const parseSubmitEvaluation = (input: InputObject): SubmitEvaluationInput => {
  if (!Array.isArray(input.answers)) {
    throw invalid("answers", "Value must be an array");
  }
  return { answers: input.answers.map(parseEvaluationAnswer) };
};

const parseGradeAnswer = (raw: unknown): GradeAnswerInput => {
  if (typeof raw !== "object" || raw === null) {
    throw invalid("answers", "Each graded answer must be an object");
  }
  const item = raw as InputObject;
  if (typeof item.answerId !== "string" || item.answerId.trim() === "") {
    throw invalid("answerId", "Each graded answer needs an answerId");
  }
  const scoreAwarded = Number(item.scoreAwarded);
  if (!Number.isFinite(scoreAwarded) || scoreAwarded < 0) {
    throw invalid("scoreAwarded", "Value must be a non-negative number");
  }
  const reviewComment =
    typeof item.reviewComment === "string" && item.reviewComment.trim() !== ""
      ? item.reviewComment.trim().slice(0, REVIEW_COMMENT_MAX_LENGTH)
      : null;
  return { answerId: item.answerId, scoreAwarded, reviewComment };
};

export const parseGradeSubmission = (input: InputObject): GradeSubmissionInput => {
  if (!Array.isArray(input.answers) || input.answers.length === 0) {
    throw invalid("answers", "Value must be a non-empty array");
  }
  return { answers: input.answers.map(parseGradeAnswer) };
};

export const parseSetStageClosed = (stage: GradedStage, input: InputObject): SetStageClosedInput => {
  if (typeof input.closed !== "boolean") {
    throw invalid("closed", "Value must be a boolean");
  }
  return { stage, closed: input.closed };
};
