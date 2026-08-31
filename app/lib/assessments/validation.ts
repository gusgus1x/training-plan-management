import { ApiError } from "../api/errors";
import { readOptionalString, readPositiveId, readRequiredString, type InputObject } from "../api/validation";
import {
  ASSESSMENT_PURPOSES,
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_STATUSES,
  type AssessmentChoiceInput,
  type AssessmentListFilters,
  type AssessmentPurpose,
  type AssessmentQuestionInput,
  type AssessmentQuestionType,
  type AssessmentScope,
  type AssessmentStatus,
  type AssessmentWriteInput,
} from "./types";

const invalid = (field: string, reason: string) => new ApiError({
  code: "INVALID_INPUT",
  message: "The submitted assessment data is invalid",
  status: 400,
  details: { field, reason },
});

const member = <Value extends string>(
  value: unknown,
  values: readonly Value[],
  field: string,
): Value => {
  if (typeof value !== "string" || !values.includes(value.toUpperCase() as Value)) {
    throw invalid(field, `Value must be one of: ${values.join(", ")}`);
  }
  return value.toUpperCase() as Value;
};

const decimal = (value: unknown, field: string, minimum: number, maximum: number) => {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") {
    throw invalid(field, "Value must be a number");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw invalid(field, `Value must be between ${minimum} and ${maximum}`);
  }
  return parsed.toFixed(2);
};

const boolean = (value: unknown, field: string) => {
  if (typeof value !== "boolean") throw invalid(field, "Value must be true or false");
  return value;
};

const parseChoice = (value: unknown, path: string): AssessmentChoiceInput => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(path, "Choice must be an object");
  const input = value as InputObject;
  return {
    // assessment_choice.choice_text is NVARCHAR(1000); 2000 let SQL Server refuse the insert with
    // a truncation error instead of this layer naming the field.
    choiceText: readRequiredString(input, "choiceText", { maxLength: 1000 }),
    isCorrect: boolean(input.isCorrect, `${path}.isCorrect`),
    optionScore: decimal(input.optionScore ?? 0, `${path}.optionScore`, 0, 999999.99),
  };
};

const validateQuestionRules = (question: AssessmentQuestionInput, path: string) => {
  const correct = question.choices.filter((choice) => choice.isCorrect).length;
  if (question.questionType === "SHORT_ANSWER") {
    if (question.choices.length) throw invalid(`${path}.choices`, "SHORT_ANSWER must not contain choices");
    return;
  }
  if (question.questionType === "TRUE_FALSE") {
    if (question.choices.length !== 2 || correct !== 1) throw invalid(`${path}.choices`, "TRUE_FALSE requires exactly two choices and one correct answer");
    return;
  }
  if (question.choices.length < 2) throw invalid(`${path}.choices`, "Choice questions require at least two choices");
  if (question.questionType === "SINGLE_CHOICE" && correct !== 1) throw invalid(`${path}.choices`, "SINGLE_CHOICE requires exactly one correct answer");
  if (question.questionType === "MULTIPLE_CHOICE" && correct < 2) throw invalid(`${path}.choices`, "MULTIPLE_CHOICE requires at least two correct answers");
};

const parseQuestion = (value: unknown, index: number): AssessmentQuestionInput => {
  const path = `questions[${index}]`;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(path, "Question must be an object");
  const input = value as InputObject;
  const question: AssessmentQuestionInput = {
    questionText: readRequiredString(input, "questionText", { maxLength: 10000 }),
    questionType: member(input.questionType, ASSESSMENT_QUESTION_TYPES, `${path}.questionType`) as AssessmentQuestionType,
    questionScore: decimal(input.questionScore, `${path}.questionScore`, 0.01, 999999.99),
    isRequired: boolean(input.isRequired, `${path}.isRequired`),
    choices: Array.isArray(input.choices)
      ? input.choices.map((choice, choiceIndex) => parseChoice(choice, `${path}.choices[${choiceIndex}]`))
      : (() => { throw invalid(`${path}.choices`, "Choices must be an array"); })(),
  };
  validateQuestionRules(question, path);
  return question;
};

export const parseAssessmentWriteInput = (input: InputObject): AssessmentWriteInput => {
  const scope = member(input.scope, ["CENTRAL", "COMPANY"] as const, "scope") as AssessmentScope;
  const companyId = scope === "COMPANY" ? readPositiveId(input.companyId, "companyId") : null;
  const seriesCode = readRequiredString(input, "seriesCode", { maxLength: 50 }).toUpperCase();
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(seriesCode)) throw invalid("seriesCode", "Use uppercase letters, numbers, and single hyphens");
  const status = member(input.status, ASSESSMENT_STATUSES, "status") as AssessmentStatus;
  const questions = Array.isArray(input.questions)
    ? input.questions.map(parseQuestion)
    : (() => { throw invalid("questions", "Questions must be an array"); })();
  if (status === "ACTIVE" && !questions.length) throw invalid("questions", "An ACTIVE assessment requires at least one question");

  let timeLimitMinutes: number | null = null;
  if (input.timeLimitMinutes !== undefined && input.timeLimitMinutes !== null && input.timeLimitMinutes !== "") {
    const parsed = Number(input.timeLimitMinutes);
    if (!Number.isInteger(parsed) || parsed <= 0) throw invalid("timeLimitMinutes", "Value must be a positive whole number");
    timeLimitMinutes = parsed;
  }

  return {
    scope,
    companyId,
    seriesCode,
    seriesName: readRequiredString(input, "seriesName", { maxLength: 255 }),
    purpose: member(input.purpose, ASSESSMENT_PURPOSES, "purpose") as AssessmentPurpose,
    versionNote: readOptionalString(input, "versionNote", { maxLength: 500 }),
    // assessment.instructions is NVARCHAR(1000), not 10000.
    instructions: readOptionalString(input, "instructions", { maxLength: 1000 }),
    passingScorePercent: decimal(input.passingScorePercent, "passingScorePercent", 0, 100),
    timeLimitMinutes,
    status,
    questions,
  };
};

export const parseCreateAssessmentWriteInput = (input: InputObject): AssessmentWriteInput =>
  parseAssessmentWriteInput({ ...input, seriesCode: "AUTO" });

export const parseAssessmentListFilters = (
  params: URLSearchParams,
  pagination: Pick<AssessmentListFilters, "skip" | "take">,
): AssessmentListFilters => {
  const search = params.get("search")?.trim() || null;
  if (search && search.length > 100) throw invalid("search", "Search must contain no more than 100 characters");
  const statusValue = params.get("status");
  const purposeValue = params.get("purpose");
  return {
    search,
    status: statusValue ? member(statusValue, ASSESSMENT_STATUSES, "status") as AssessmentStatus : null,
    purpose: purposeValue ? member(purposeValue, ASSESSMENT_PURPOSES, "purpose") as AssessmentPurpose : null,
    ...pagination,
  };
};
