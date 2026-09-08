import { assertBranchTargets, isFormBlockType, SUBMIT_SECTION } from "../formBlocks";
import { GRID_AXES, isGridType, MIN_GRID_COLUMNS, MIN_GRID_ROWS } from "../formGrids";
import { ApiError } from "../api/errors";
import { readOptionalString, readPositiveId, readRequiredString, type InputObject } from "../api/validation";
import {
  EVALUATION_RESPONDENTS,
  EVALUATION_ROW_TYPES,
  EVALUATION_STATUSES,
  EVALUATION_TIMINGS,
  type EvaluationListFilters,
  type EvaluationOptionInput,
  type EvaluationQuestionInput,
  type EvaluationRespondent,
  type EvaluationRowType,
  type EvaluationScope,
  type EvaluationStatus,
  type EvaluationTiming,
  type EvaluationWriteInput,
} from "./types";

const invalid = (field: string, reason: string) => new ApiError({
  code: "INVALID_INPUT",
  message: "The submitted evaluation data is invalid",
  status: 400,
  details: { field, reason },
});

const member = <Value extends string>(value: unknown, values: readonly Value[], field: string): Value => {
  if (typeof value !== "string" || !values.includes(value.toUpperCase() as Value)) {
    throw invalid(field, `Value must be one of: ${values.join(", ")}`);
  }
  return value.toUpperCase() as Value;
};

const bool = (value: unknown, field: string) => {
  if (typeof value !== "boolean") throw invalid(field, "Value must be true or false");
  return value;
};

const decimalOrNull = (value: unknown, field: string) => {
  if (value === null || value === undefined || value === "") return null;
  if ((typeof value !== "string" && typeof value !== "number") || !Number.isFinite(Number(value))) {
    throw invalid(field, "Value must be a number or null");
  }
  const number = Number(value);
  if (number < -999999.99 || number > 999999.99) throw invalid(field, "Value is outside the supported range");
  return number.toFixed(2);
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

const parseOption = (value: unknown, path: string): EvaluationOptionInput => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(path, "Option must be an object");
  const input = value as InputObject;
  const axis = input.axis === null || input.axis === undefined || input.axis === ""
    ? null
    : member(input.axis, GRID_AXES, `${path}.axis`);
  return {
    optionText: readRequiredString(input, "optionText", { maxLength: 1000 }),
    optionValue: decimalOrNull(input.optionValue, `${path}.optionValue`),
    nextSection: sectionTargetOrNull(input.nextSection, `${path}.nextSection`),
    axis,
  };
};

const parseQuestion = (value: unknown, index: number): EvaluationQuestionInput => {
  const path = `questions[${index}]`;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(path, "Question must be an object");
  const input = value as InputObject;
  const questionType = member(input.questionType, EVALUATION_ROW_TYPES, `${path}.questionType`) as EvaluationRowType;
  const options = Array.isArray(input.options)
    ? input.options.map((option, optionIndex) => parseOption(option, `${path}.options[${optionIndex}]`))
    : (() => { throw invalid(`${path}.options`, "Options must be an array"); })();
  const nextSection = sectionTargetOrNull(input.nextSection, `${path}.nextSection`);
  const isRequired = bool(input.isRequired, `${path}.isRequired`);

  if (isFormBlockType(questionType)) {
    // A section break or a text block is not answerable: no options, never required, and only a
    // section break carries the "after this section" default.
    if (options.length) throw invalid(`${path}.options`, "A section or text block must not contain options");
    if (isRequired) throw invalid(`${path}.isRequired`, "A section or text block cannot be a required question");
    if (questionType === "TEXT_BLOCK" && nextSection !== null) {
      throw invalid(`${path}.nextSection`, "Only a section can set a next-section target");
    }
  } else {
    if (nextSection !== null) throw invalid(`${path}.nextSection`, "Only a section can set a next-section target");
    // Branching needs one answer to branch on, which a multi-select does not have.
    if (questionType !== "SINGLE_CHOICE" && options.some((option) => option.nextSection !== null)) {
      throw invalid(`${path}.options`, "Only a single-choice question can branch on its options");
    }

    if (isGridType(questionType)) {
      // Rows and columns live in the same option list, told apart by axis. A grid has no single
      // answer to branch on, so option targets are refused rather than silently ignored.
      const rows = options.filter((option) => option.axis === "ROW");
      const columns = options.filter((option) => option.axis === "COLUMN");
      if (rows.length + columns.length !== options.length) {
        throw invalid(`${path}.options`, "Every option of a grid must be a ROW or a COLUMN");
      }
      if (rows.length < MIN_GRID_ROWS) throw invalid(`${path}.options`, "A grid needs at least one row");
      if (columns.length < MIN_GRID_COLUMNS) throw invalid(`${path}.options`, "A grid needs at least two columns");
      if (options.some((option) => option.nextSection !== null)) {
        throw invalid(`${path}.options`, "A grid cannot branch on its options");
      }
    } else if (options.some((option) => option.axis !== null)) {
      throw invalid(`${path}.options`, "Only a grid question has rows and columns");
    } else if (questionType === "RATING") {
      if (options.length !== 5 || options.some((option, optionIndex) => Number(option.optionValue) !== optionIndex + 1)) {
        throw invalid(`${path}.options`, "RATING requires the standard five options with values 1 through 5");
      }
    } else if (questionType === "SINGLE_CHOICE" || questionType === "MULTIPLE_CHOICE") {
      if (options.length < 2) throw invalid(`${path}.options`, "Choice questions require at least two options");
    } else if (options.length) {
      throw invalid(`${path}.options`, "Text questions must not contain options");
    }
  }

  return {
    questionText: readRequiredString(input, "questionText", { maxLength: 10000 }),
    questionType,
    sectionName: readOptionalString(input, "sectionName", { maxLength: 150 }),
    questionDescription: readOptionalString(input, "questionDescription", { maxLength: 10000 }),
    nextSection,
    isRequired,
    options,
  };
};

const branchRows = (questions: EvaluationQuestionInput[]) => questions.map((question) => ({
  questionType: question.questionType,
  nextSection: question.nextSection,
  optionTargets: question.options.map((option) => option.nextSection),
}));

export const parseEvaluationWriteInput = (input: InputObject): EvaluationWriteInput => {
  const scope = member(input.scope, ["CENTRAL", "COMPANY"] as const, "scope") as EvaluationScope;
  const companyId = scope === "COMPANY" ? readPositiveId(input.companyId, "companyId") : null;
  const formCode = readRequiredString(input, "formCode", { maxLength: 50 }).toUpperCase();
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(formCode)) throw invalid("formCode", "Use uppercase letters, numbers, and single hyphens");
  const status = member(input.status, EVALUATION_STATUSES, "status") as EvaluationStatus;
  const questions = Array.isArray(input.questions) ? input.questions.map(parseQuestion) : (() => { throw invalid("questions", "Questions must be an array"); })();
  assertBranchTargets(branchRows(questions), invalid);
  // Blocks are not questions, so a form of nothing but sections and text cannot publish.
  const answerable = questions.filter((question) => !isFormBlockType(question.questionType));
  if (status === "PUBLISHED" && !answerable.length) throw invalid("questions", "A PUBLISHED evaluation requires at least one question");
  if (status === "PUBLISHED" && !answerable.some((question) => question.isRequired)) throw invalid("questions", "A PUBLISHED evaluation requires at least one required question");

  return {
    scope,
    companyId,
    formCode,
    formName: readRequiredString(input, "formName", { maxLength: 255 }),
    description: readOptionalString(input, "description", { maxLength: 10000 }),
    timing: member(input.timing, EVALUATION_TIMINGS, "timing") as EvaluationTiming,
    respondentType: member(input.respondentType, EVALUATION_RESPONDENTS, "respondentType") as EvaluationRespondent,
    isAnonymous: bool(input.isAnonymous, "isAnonymous"),
    status,
    questions,
  };
};

export const parseCreateEvaluationWriteInput = (input: InputObject) =>
  parseEvaluationWriteInput({ ...input, formCode: "AUTO" });

/** Status-only change - the one edit an evaluation already in use still accepts. Kept apart from
 *  parseEvaluationWriteInput so it cannot become a door for content edits. */
export const parseEvaluationStatusInput = (input: InputObject): EvaluationStatus =>
  member(input.status, EVALUATION_STATUSES, "status") as EvaluationStatus;

export const parseEvaluationListFilters = (
  params: URLSearchParams,
  pagination: Pick<EvaluationListFilters, "skip" | "take">,
): EvaluationListFilters => {
  const search = params.get("search")?.trim() || null;
  if (search && search.length > 100) throw invalid("search", "Search must contain no more than 100 characters");
  const rawStatus = params.get("status");
  const rawTiming = params.get("timing");
  const rawRespondent = params.get("respondentType");
  return {
    search,
    status: rawStatus ? member(rawStatus, EVALUATION_STATUSES, "status") as EvaluationStatus : null,
    timing: rawTiming ? member(rawTiming, EVALUATION_TIMINGS, "timing") as EvaluationTiming : null,
    respondentType: rawRespondent ? member(rawRespondent, EVALUATION_RESPONDENTS, "respondentType") as EvaluationRespondent : null,
    ...pagination,
  };
};
