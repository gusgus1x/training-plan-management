import { assertBranchTargets, isFormBlockType, SUBMIT_SECTION } from "../formBlocks";
import {
  formatCorrectColumns,
  GRID_AXES,
  gridTotalScore,
  isGridType,
  MIN_GRID_COLUMNS,
  MIN_GRID_ROWS,
  parseCorrectColumns,
} from "../formGrids";
import { ApiError } from "../api/errors";
import { readOptionalString, readPositiveId, readRequiredString, type InputObject } from "../api/validation";
import {
  ASSESSMENT_PURPOSES,
  ASSESSMENT_ROW_TYPES,
  ASSESSMENT_STATUSES,
  type AssessmentChoiceInput,
  type AssessmentListFilters,
  type AssessmentPurpose,
  type AssessmentQuestionInput,
  type AssessmentRowType,
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

/**
 * A branch target is a 1-based section ordinal, never an id - ids are regenerated on every save.
 * null means "continue to the next section" and SUBMIT_SECTION (0) means "end the form here".
 */
const sectionTargetOrNull = (value: unknown, field: string) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < SUBMIT_SECTION) {
    throw invalid(field, "Section target must be a whole number, 0 to submit the form");
  }
  return number;
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
    nextSection: sectionTargetOrNull(input.nextSection, `${path}.nextSection`),
    axis: input.axis === null || input.axis === undefined || input.axis === ""
      ? null
      : member(input.axis, GRID_AXES, `${path}.axis`),
    correctColumns: formatCorrectColumns(
      parseCorrectColumns(typeof input.correctColumns === "string" ? input.correctColumns : null),
    ),
  };
};

const validateQuestionRules = (question: AssessmentQuestionInput, path: string) => {
  const correct = question.choices.filter((choice) => choice.isCorrect).length;
  if (isFormBlockType(question.questionType)) {
    // Not answerable: no choices, never required, and it must carry no marks - CK_RC2_assessment_
    // question_block_score_zero asserts the same thing at the storage layer.
    if (question.choices.length) throw invalid(`${path}.choices`, "A section or text block must not contain choices");
    if (question.isRequired) throw invalid(`${path}.isRequired`, "A section or text block cannot be a required question");
    if (Number(question.questionScore) !== 0) throw invalid(`${path}.questionScore`, "A section or text block must score zero");
    if (question.questionType === "TEXT_BLOCK" && question.nextSection !== null) {
      throw invalid(`${path}.nextSection`, "Only a section can set a next-section target");
    }
    return;
  }
  if (question.nextSection !== null) throw invalid(`${path}.nextSection`, "Only a section can set a next-section target");
  // Branching needs one answer to branch on, which a multi-select does not have.
  if (question.questionType !== "SINGLE_CHOICE" && question.choices.some((choice) => choice.nextSection !== null)) {
    throw invalid(`${path}.choices`, "Only a single-choice question can branch on its choices");
  }
  if (isGridType(question.questionType)) {
    // Google Forms scores a grid per ROW: each row carries its own points and its own correct
    // column(s). question_score is therefore the sum of the row points, which is what lets every
    // existing denominator loop keep summing question_score without knowing grids exist.
    const rows = question.choices.filter((choice) => choice.axis === "ROW");
    const columns = question.choices.filter((choice) => choice.axis === "COLUMN");
    if (rows.length + columns.length !== question.choices.length) {
      throw invalid(`${path}.choices`, "Every choice of a grid must be a ROW or a COLUMN");
    }
    if (rows.length < MIN_GRID_ROWS) throw invalid(`${path}.choices`, "A grid needs at least one row");
    if (columns.length < MIN_GRID_COLUMNS) throw invalid(`${path}.choices`, "A grid needs at least two columns");
    if (question.choices.some((choice) => choice.nextSection !== null)) {
      throw invalid(`${path}.choices`, "A grid cannot branch on its choices");
    }
    if (columns.some((column) => column.correctColumns !== null)) {
      throw invalid(`${path}.choices`, "Only a row carries a grid answer key");
    }
    // A multiple choice grid takes exactly one answer per row; a checkbox grid takes any number.
    const columnOrders = new Set(columns.map((unused, index) => index + 1));
    for (const row of rows) {
      const key = parseCorrectColumns(row.correctColumns);
      if (key.some((order) => !columnOrders.has(order))) {
        throw invalid(`${path}.choices`, "A grid answer key points at a column that does not exist");
      }
      if (question.questionType === "MULTIPLE_CHOICE_GRID" && key.length > 1) {
        throw invalid(`${path}.choices`, "A multiple choice grid row accepts only one correct column");
      }
      if (Number(row.optionScore) < 0) throw invalid(`${path}.choices`, "A grid row cannot score less than zero");
    }
    const total = gridTotalScore(rows.map((row) => row.optionScore));
    if (Number(total) <= 0) throw invalid(`${path}.questionScore`, "A grid needs at least one row worth points");
    if (Number(question.questionScore) !== Number(total)) {
      throw invalid(`${path}.questionScore`, "A grid's score must equal the sum of its row scores");
    }
    return;
  }
  if (question.choices.some((choice) => choice.axis !== null || choice.correctColumns !== null)) {
    throw invalid(`${path}.choices`, "Only a grid question has rows and columns");
  }
  if (Number(question.questionScore) <= 0) throw invalid(`${path}.questionScore`, "A question must score more than zero");
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
    questionType: member(input.questionType, ASSESSMENT_ROW_TYPES, `${path}.questionType`) as AssessmentRowType,
    // Floor is 0 so a block row can score zero; validateQuestionRules holds a real question above 0.
    questionScore: decimal(input.questionScore, `${path}.questionScore`, 0, 999999.99),
    questionDescription: readOptionalString(input, "questionDescription", { maxLength: 10000 }),
    nextSection: sectionTargetOrNull(input.nextSection, `${path}.nextSection`),
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
  assertBranchTargets(questions.map((question) => ({
    questionType: question.questionType,
    nextSection: question.nextSection,
    optionTargets: question.choices.map((choice) => choice.nextSection),
  })), invalid);
  // Blocks are not questions, so an assessment of nothing but sections and text cannot go ACTIVE.
  if (status === "ACTIVE" && !questions.some((question) => !isFormBlockType(question.questionType))) {
    throw invalid("questions", "An ACTIVE assessment requires at least one question");
  }

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

/** Status-only change. Separate from parseAssessmentWriteInput because this is the one edit an
 *  assessment already in use still accepts - it must not become a door for content edits. */
export const parseAssessmentStatusInput = (input: InputObject): AssessmentStatus =>
  member(input.status, ASSESSMENT_STATUSES, "status") as AssessmentStatus;

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
