import type {
  EvaluationCourseHeader,
  EvaluationResponse,
  EvaluationResponseList,
  EvaluationSummary,
  EvaluationSummaryQuestion,
} from "../trainingForms/types";
import { ANSWER_TIME_CAP_SECONDS } from "../trainingForms/types";

/**
 * Turns the response sheet of an external form (Google Forms, Microsoft Forms) into the same
 * summary and response list the in-system evaluation produces, so the screen charts it and the
 * report export writes it with no second implementation of either.
 *
 * Pure and dependency-free: the browser runs it every time HRD changes a column's type.
 */

export type ResponseSource = "MICROSOFT" | "GOOGLE" | "UNKNOWN";

/** What a column is for. The identity roles fill the respondent columns of the report; QUESTION_*
 *  columns become questions; SKIP is dropped. */
export const COLUMN_ROLES = [
  "SKIP",
  "STARTED_AT",
  "SUBMITTED_AT",
  "FULL_NAME",
  "FIRST_NAME",
  "LAST_NAME",
  "EMPLOYEE_CODE",
  "COMPANY",
  "RATING",
  "CHOICE",
  "MULTI_CHOICE",
  "TEXT",
] as const;
export type ColumnRole = (typeof COLUMN_ROLES)[number];

export const QUESTION_ROLES: ColumnRole[] = ["RATING", "CHOICE", "MULTI_CHOICE", "TEXT"];

export type SheetColumn = { index: number; header: string; role: ColumnRole };

export type SheetAnalysis = {
  source: ResponseSource;
  columns: SheetColumn[];
  /** Data rows only, header removed, fully blank rows dropped. */
  rows: string[][];
};

const clean = (value: string | undefined) => (value ?? "").trim();

/** Header text that marks an identity or system column, checked before any guess from the values. */
const HEADER_ROLES: Array<[RegExp, ColumnRole]> = [
  [/^(id|last modified time)$/i, "SKIP"],
  [/^(email|email address|อีเมล)$/i, "SKIP"],
  [/^start time$/i, "STARTED_AT"],
  [/^(completion time|timestamp|ประทับเวลา)$/i, "SUBMITTED_AT"],
  [/^(name|full name|ชื่อ\s*-?\s*นามสกุล|ชื่อ-สกุล)$/i, "FULL_NAME"],
  [/^(ชื่อ|first name|ชื่อจริง)$/i, "FIRST_NAME"],
  [/^(นามสกุล|last name|surname)$/i, "LAST_NAME"],
  [/(รหัส.*พนักงาน|employee\s*(id|code|no)|รหัสประจำตัว)/i, "EMPLOYEE_CODE"],
  [/^(บริษัท|company|บริษัทที่สังกัด)$/i, "COMPANY"],
];

const isInteger = (value: string) => /^-?\d+$/.test(value);

/** The type a question column most likely is, judged from its answers. HRD can change it. */
const guessQuestionRole = (values: string[], source: ResponseSource): ColumnRole => {
  const answered = values.filter(Boolean);
  if (!answered.length) return "TEXT";
  if (answered.every((value) => isInteger(value) && Number(value) >= 1 && Number(value) <= 5)) return "RATING";
  // Microsoft Forms ends every multi-select answer with ";", even a single tick.
  if (source === "MICROSOFT" && answered.some((value) => value.endsWith(";"))) return "MULTI_CHOICE";
  const distinct = new Set(answered).size;
  const longest = Math.max(...answered.map((value) => value.length));
  // Short answers that repeat across people read as a choice; answers that are all different, or
  // long, read as writing - two different comments are still two comments, not two options.
  if (distinct <= answered.length / 2 && distinct <= 10 && longest <= 60) return "CHOICE";
  return "TEXT";
};

export const analyseSheet = (sheet: string[][]): SheetAnalysis => {
  const [headerRow = [], ...body] = sheet;
  const headers = headerRow.map((header) => clean(header));
  const rows = body.filter((row) => row.some((cell) => clean(cell) !== ""));
  const has = (pattern: RegExp) => headers.some((header) => pattern.test(header));
  const source: ResponseSource = has(/^completion time$/i) && has(/^start time$/i)
    ? "MICROSOFT"
    : has(/^(timestamp|ประทับเวลา)$/i)
      ? "GOOGLE"
      : "UNKNOWN";

  const columns = headers
    .map((header, index): SheetColumn | null => {
      if (!header) return null;
      const byHeader = HEADER_ROLES.find(([pattern]) => pattern.test(header))?.[1];
      const role = byHeader ?? guessQuestionRole(rows.map((row) => clean(row[index])), source);
      return { index, header, role };
    })
    .filter((column): column is SheetColumn => column !== null);

  return { source, columns, rows };
};

/** An Excel serial date ("46241.66875") or a text timestamp, as ISO. Microsoft writes the time in
 *  the form owner's zone; ponytail: assumed Asia/Bangkok, add a zone picker if a form ever isn't. */
const toIso = (value: string): string | null => {
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value) && Number(value) > 20000) {
    const utcMs = (Number(value) - 25569) * 86_400_000 - 7 * 3_600_000;
    return new Date(Math.round(utcMs / 1000) * 1000).toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
};

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

/** A multi-select cell as its ticks: ";" for Microsoft, ", " for Google. */
const splitChoices = (value: string, source: ResponseSource) =>
  (source === "MICROSOFT" || value.includes(";") ? value.split(";") : value.split(/,\s+/))
    .map((part) => part.trim())
    .filter(Boolean);

export type ConvertedEvaluation = { summary: EvaluationSummary; responses: EvaluationResponseList };

export const convertSheet = (
  analysis: SheetAnalysis,
  course: EvaluationCourseHeader,
  formName: string,
): ConvertedEvaluation => {
  const { source, columns, rows } = analysis;
  const cell = (row: string[], role: ColumnRole) => {
    const column = columns.find((item) => item.role === role);
    return column ? clean(row[column.index]) : "";
  };
  const questionColumns = columns.filter((column) => QUESTION_ROLES.includes(column.role));
  const questionId = (column: SheetColumn) => `c${column.index}`;

  // Anonymous when nothing in the sheet could name anyone.
  const identityRoles: ColumnRole[] = ["FULL_NAME", "FIRST_NAME", "LAST_NAME", "EMPLOYEE_CODE"];
  const isAnonymous = !rows.some((row) =>
    identityRoles.some((role) => {
      const value = cell(row, role);
      return value !== "" && value.toLowerCase() !== "anonymous";
    }),
  );

  const responses: EvaluationResponse[] = rows.map((row, index) => {
    const fullName = cell(row, "FULL_NAME") || [cell(row, "FIRST_NAME"), cell(row, "LAST_NAME")].filter(Boolean).join(" ");
    return {
      responseNo: index + 1,
      respondentName: isAnonymous ? null : fullName || null,
      respondentPosition: null,
      companyCode: cell(row, "COMPANY") || null,
      employeeCode: isAnonymous ? null : cell(row, "EMPLOYEE_CODE") || null,
      subjectName: null,
      startedAt: toIso(cell(row, "STARTED_AT")),
      submittedAt: toIso(cell(row, "SUBMITTED_AT")),
      answers: questionColumns.map((column) => {
        const value = clean(row[column.index]);
        return {
          questionId: questionId(column),
          choices:
            column.role === "CHOICE" && value ? [value]
              : column.role === "MULTI_CHOICE" ? splitChoices(value, source)
                : [],
          ratingValue: column.role === "RATING" && isInteger(value) ? Number(value) : null,
          text: column.role === "TEXT" ? value || null : null,
        };
      }),
    };
  });

  const questions: EvaluationSummaryQuestion[] = questionColumns.map((column, order) => {
    const answers = responses.map((response) => response.answers[order]);
    const base = {
      questionId: questionId(column),
      questionOrder: order + 1,
      questionText: column.header,
      sectionName: null,
      averageRating: null,
      ratingDistribution: [] as { value: number; count: number }[],
      options: [] as EvaluationSummaryQuestion["options"],
      gridRows: [],
      textAnswers: [] as string[],
      textAnswersWithheld: false,
    };
    if (column.role === "RATING") {
      const values = answers.map((answer) => answer.ratingValue).filter((value): value is number => value !== null && value >= 1 && value <= 5);
      return {
        ...base,
        questionType: "RATING",
        answeredBy: values.length,
        averageRating: values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null,
        ratingDistribution: [1, 2, 3, 4, 5].map((value) => ({ value, count: values.filter((item) => item === value).length })),
      };
    }
    if (column.role === "TEXT") {
      const texts = answers.map((answer) => answer.text).filter((text): text is string => Boolean(text));
      return { ...base, questionType: "LONG_TEXT", answeredBy: texts.length, textAnswers: texts };
    }
    const picked = answers.filter((answer) => answer.choices.length > 0);
    const labels = [...new Set(picked.flatMap((answer) => answer.choices))];
    return {
      ...base,
      questionType: column.role === "MULTI_CHOICE" ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE",
      answeredBy: picked.length,
      options: labels.map((label, index) => {
        const count = picked.filter((answer) => answer.choices.includes(label)).length;
        return { optionId: `${questionId(column)}-${index}`, optionText: label, count, percent: percent(count, picked.length) };
      }),
    };
  });

  const byCompany = new Map<string, number>();
  for (const response of responses) {
    if (response.companyCode) byCompany.set(response.companyCode, (byCompany.get(response.companyCode) ?? 0) + 1);
  }
  const companyTotal = [...byCompany.values()].reduce((sum, count) => sum + count, 0);

  const durations = responses
    .map((response) =>
      response.startedAt && response.submittedAt
        ? (Date.parse(response.submittedAt) - Date.parse(response.startedAt)) / 1000
        : null,
    )
    .filter((seconds): seconds is number => seconds !== null && seconds >= 0 && seconds <= ANSWER_TIME_CAP_SECONDS);

  const summary: EvaluationSummary = {
    evaluationFormId: "external",
    formName,
    description: null,
    isAnonymous,
    timing: "EVALUATION",
    respondentGroup: "EMPLOYEE",
    // Nobody is "expected" from a file: the sheet is the whole population it knows about.
    expectedCount: responses.length,
    submittedCount: responses.length,
    responseRatePercent: responses.length ? 100 : 0,
    averageAnswerSeconds: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
    course,
    respondentsByCompany: [...byCompany.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([companyCode, count]) => ({ companyCode, companyName: companyCode, count, percent: percent(count, companyTotal) })),
    questions,
  };

  return {
    summary,
    responses: {
      formName,
      isAnonymous,
      timing: "EVALUATION",
      respondentGroup: "EMPLOYEE",
      questions: questions.map(({ questionId: id, questionOrder, questionText, questionType }) => ({
        questionId: id,
        questionOrder,
        questionText,
        questionType,
      })),
      responses,
    },
  };
};
