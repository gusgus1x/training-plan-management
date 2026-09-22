import { COMPANY_FORM_COMMENT_GROUP } from "../externalEvaluation/companyForm";
import type { SectionQuestion, SectionReport, SectionRespondent } from "../externalEvaluation/sections";
import { groupBySectionAverages } from "./sectionAverages";
import type {
  EvaluationResponse,
  EvaluationResponseList,
  EvaluationSummary,
  EvaluationSummaryQuestion,
} from "./types";

/**
 * The Advanced view of an in-system evaluation, in the shape the company's evaluation workbook is
 * written from (`buildSectionWorkbook`).
 *
 * Nothing is grouped by hand here: an in-system form names its own sections, so this is the same
 * grouping the screen draws, carried over to the workbook with one column per question on
 * 01-Database and one row per reply.
 */

const SEPARATOR = "; ";

/** "dd/mm/yyyy HH:MM" in Bangkok time, as the company sheet's timestamp column reads. */
const timestampText = (iso: string | null) => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  })
    .format(new Date(ms))
    .replace(",", "");
};

/** The workbook keeps first and last name apart; the summary carries one signed name. */
const splitName = (name: string | null) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
};

const answerOf = (response: EvaluationResponse, questionId: string) =>
  response.answers.find((answer) => answer.questionId === questionId) ?? null;

/** A grid answer reads "row: column" (repository.ts), so its row is its prefix. */
const gridChoiceFor = (response: EvaluationResponse, questionId: string, rowText: string) => {
  const prefix = `${rowText}: `;
  return (answerOf(response, questionId)?.choices ?? [])
    .filter((choice) => choice.startsWith(prefix))
    .map((choice) => choice.slice(prefix.length));
};

const columnsOf = (question: EvaluationSummaryQuestion) =>
  (question.gridRows[0]?.cells ?? []).map((cell) => cell.columnText);

/**
 * `companyForm`: the form has the company form's shape (see externalEvaluation/companyForm), so the
 * report page's comment block carries Part 4 only. The caller checks the shape; this only lays out.
 */
export const buildAdvancedReport = (
  summary: EvaluationSummary,
  responses: EvaluationResponseList,
  options: { companyForm?: boolean } = {},
): SectionReport => {
  const replies = responses.responses;

  const respondents: SectionRespondent[] = replies.map((response) => ({
    timestamp: timestampText(response.submittedAt),
    // Blank on an anonymous form: the server never sends the name, and this file must not invent one.
    ...splitName(response.respondentName),
    employeeCode: response.employeeCode ?? "",
    companyCode: response.companyCode ?? "",
  }));

  const ratingQuestion = (
    question: EvaluationSummaryQuestion,
    header: string,
    value: (response: EvaluationResponse) => number | null,
    average: number | null,
    outOf: number,
  ): SectionQuestion => ({
    header,
    kind: "RATING",
    answers: replies.map(value),
    average,
    outOf,
  });

  const sections = groupBySectionAverages(summary.questions).map((group, groupIndex) => {
    const questions: SectionQuestion[] = [];

    for (const item of group.averages) {
      const { question, rowText } = item;
      if (rowText === null) {
        questions.push(
          ratingQuestion(
            question,
            question.questionText,
            (response) => answerOf(response, question.questionId)?.ratingValue ?? null,
            item.average,
            item.outOf,
          ),
        );
        continue;
      }
      // A grid row is scored by the position of the column picked, so the workbook's AVERAGE over
      // the column is the same number the screen shows.
      const columns = columnsOf(question);
      questions.push(
        ratingQuestion(
          question,
          `${question.questionText} - ${rowText}`,
          (response) => {
            const picked = gridChoiceFor(response, question.questionId, rowText)[0];
            const index = picked === undefined ? -1 : columns.indexOf(picked);
            return index === -1 ? null : index + 1;
          },
          item.average,
          item.outOf,
        ),
      );
    }

    for (const question of group.choices) {
      questions.push({
        header: question.questionText,
        kind: "CHOICE",
        answers: replies.map((response) => {
          const picked = answerOf(response, question.questionId)?.choices ?? [];
          return picked.length ? picked.join(SEPARATOR) : null;
        }),
        average: null,
        split: question.options.map((option) => ({ label: option.optionText, percent: option.percent })),
      });
    }

    for (const question of group.checkboxGrids) {
      const columns = columnsOf(question);
      questions.push({
        header: question.questionText,
        kind: "GRID",
        answers: replies.map((response) => {
          const picked = question.gridRows
            .map((row) => {
              const chosen = gridChoiceFor(response, question.questionId, row.rowText);
              return chosen.length ? `${row.rowText}: ${chosen.join(", ")}` : null;
            })
            .filter((entry): entry is string => entry !== null);
          return picked.length ? picked.join(SEPARATOR) : null;
        }),
        average: null,
        gridSplit: {
          rows: question.gridRows.map((row) => row.rowText),
          columns,
          percent: question.gridRows.map((row) => row.cells.map((cell) => cell.percent)),
        },
      });
    }

    for (const question of group.texts) {
      questions.push({
        header: question.questionText,
        kind: "TEXT",
        answers: replies.map((response) => answerOf(response, question.questionId)?.text ?? null),
        average: null,
      });
    }

    return {
      name: group.name ?? summary.formName,
      questions,
      ...(options.companyForm ? { showComments: groupIndex === COMPANY_FORM_COMMENT_GROUP } : {}),
    };
  });

  return {
    course: summary.course,
    respondents,
    sections: sections.filter((section) => section.questions.length > 0),
    companies: summary.respondentsByCompany.map((company) => ({
      companyCode: company.companyCode,
      count: company.count,
    })),
  };
};
