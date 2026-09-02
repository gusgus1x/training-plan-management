import { ApiError } from "../api/errors";
import type { InputObject } from "../api/validation";
import type {
  AssessmentAnswerInput,
  EvaluationAnswerInput,
  GradeAnswerInput,
  GradeSubmissionInput,
  GradedStage,
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

const readStringArray = (value: unknown, field: string): string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw invalid(field, "Value must be an array of strings");
  }
  return value as string[];
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
