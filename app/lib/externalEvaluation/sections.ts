import type { EvaluationCourseHeader } from "../trainingForms/types";
import { QUESTION_ROLES, splitChoices, type ResponseSource, type SheetAnalysis, type SheetColumn } from "./convert";

/**
 * Advanced mode: questions grouped into sections HRD names, reported the way the company's own
 * evaluation workbook does it - one chart per section, one bar per question, the bar being the
 * average score.
 *
 * Neither Google Forms nor Microsoft Forms carries section names in its export, so the grouping is
 * HRD's to make. Pure, so the screen previews exactly what the workbook will hold.
 */

export type ReportSection = { id: string; name: string };

/** columnIndex -> section id. A question with no entry is left out of the report. */
export type SectionAssignment = Record<number, string>;

/**
 * RATING carries one average bar; CHOICE the share of people per option; GRID one bar per row of a
 * tick-many-per-row grid. TEXT is written answers, OTHER is data with no chart of its own.
 */
export type SectionQuestionKind = "RATING" | "CHOICE" | "GRID" | "TEXT" | "OTHER";

export type SectionQuestion = {
  header: string;
  kind: SectionQuestionKind;
  /** One per respondent, in respondent order. A rating is its number; everything else its text. */
  answers: Array<string | number | null>;
  /** Ratings only, to two decimals. Null when nobody answered. */
  average: number | null;
  /** RATING only: the top of its scale. 5 unless a grid row is scored by its column position. */
  outOf?: number;
  /** CHOICE only: the share of the people who answered, per option. */
  split?: Array<{ label: string; percent: number }>;
  /** GRID only: one percentage per row per column. */
  gridSplit?: { rows: string[]; columns: string[]; percent: number[][] };
};

export type SectionRespondent = {
  timestamp: string | null;
  firstName: string;
  lastName: string;
  employeeCode: string;
  companyCode: string;
};

export type SectionReport = {
  course: EvaluationCourseHeader;
  respondents: SectionRespondent[];
  sections: Array<{ name: string; questions: SectionQuestion[] }>;
  /** Replies per company, largest first. */
  companies: Array<{ companyCode: string; count: number }>;
};

const clean = (value: string | undefined) => (value ?? "").trim();

/** An Excel serial or a text timestamp as "dd/mm/yyyy HH:MM" in Bangkok time, the way the
 *  company sheet shows it. */
const timestampText = (value: string) => {
  if (!value) return null;
  const ms = /^\d+(\.\d+)?$/.test(value) && Number(value) > 20000
    ? (Number(value) - 25569) * 86_400_000 - 7 * 3_600_000
    : Date.parse(value);
  if (Number.isNaN(ms)) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  }).format(new Date(ms)).replace(",", "");
};

/**
 * Forms exports a grid as one column per row, headed "question [row]". Columns sharing a question
 * become one grid question again, which is the only way the report can chart them together.
 */
const GRID_HEADER = /^(.*\S)\s*\[(.+)\]$/;
export const gridHeaderParts = (header: string) => {
  const match = GRID_HEADER.exec(header);
  return match ? { question: match[1], row: match[2] } : null;
};

/** The percentage split of a choice column: one entry per distinct answer, share of the people. */
const choiceSplit = (answers: Array<string | number | null>, source: ResponseSource) => {
  const picked = answers
    .map((answer) => (typeof answer === "string" ? splitChoices(answer, source) : []))
    .filter((ticks) => ticks.length > 0);
  const labels = [...new Set(picked.flat())];
  return labels.map((label) => ({
    label,
    percent: picked.length === 0 ? 0 : Math.round((picked.filter((ticks) => ticks.includes(label)).length / picked.length) * 1000) / 10,
  }));
};

export const buildSectionReport = (
  analysis: SheetAnalysis,
  sections: ReportSection[],
  assignment: SectionAssignment,
  course: EvaluationCourseHeader,
): SectionReport => {
  const { columns, rows } = analysis;
  const cell = (row: string[], role: string) => {
    const column = columns.find((item) => item.role === role);
    return column ? clean(row[column.index]) : "";
  };

  const respondents: SectionRespondent[] = rows.map((row) => {
    const full = cell(row, "FULL_NAME");
    const parts = full.split(/\s+/).filter(Boolean);
    const firstName = cell(row, "FIRST_NAME") || (parts.length > 1 ? parts.slice(0, -1).join(" ") : full);
    const lastName = cell(row, "LAST_NAME") || (parts.length > 1 ? parts[parts.length - 1] : "");
    return {
      timestamp: timestampText(cell(row, "SUBMITTED_AT") || cell(row, "STARTED_AT")),
      firstName,
      lastName,
      employeeCode: cell(row, "EMPLOYEE_CODE"),
      companyCode: cell(row, "COMPANY"),
    };
  });

  const answersOf = (column: SheetColumn) =>
    rows.map((row) => {
      const value = clean(row[column.index]);
      if (!value) return null;
      return column.role === "RATING" && /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
    });

  const ratingQuestion = (column: SheetColumn): SectionQuestion => {
    const answers = answersOf(column);
    const numbers = answers.filter((answer): answer is number => typeof answer === "number");
    return {
      header: column.header,
      kind: "RATING",
      answers,
      average: numbers.length ? Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 100) / 100 : null,
      outOf: column.scale ?? 5,
    };
  };

  /** Several "question [row]" columns, back together as the grid they were exported from. */
  const gridQuestion = (question: string, parts: Array<{ column: SheetColumn; row: string }>): SectionQuestion => {
    const splits = parts.map((part) => choiceSplit(answersOf(part.column), analysis.source));
    const labels = [...new Set(splits.flatMap((split) => split.map((entry) => entry.label)))];
    return {
      header: question,
      kind: "GRID",
      // One cell per row, so the raw sheet still reads as "row: answer" per person.
      answers: rows.map((_, rowIndex) =>
        parts
          .map((part) => {
            const value = clean(rows[rowIndex][part.column.index]);
            return value ? `${part.row}: ${value}` : null;
          })
          .filter((entry): entry is string => entry !== null)
          .join("; ") || null,
      ),
      average: null,
      gridSplit: {
        rows: parts.map((part) => part.row),
        columns: labels,
        percent: splits.map((split) => labels.map((label) => split.find((entry) => entry.label === label)?.percent ?? 0)),
      },
    };
  };

  const reportSections = sections
    .map((section) => {
      const own = columns.filter(
        (column) => QUESTION_ROLES.includes(column.role) && assignment[column.index] === section.id,
      );
      const questions: SectionQuestion[] = [];
      const grids = new Map<string, Array<{ column: SheetColumn; row: string }>>();

      // A grid is two or more columns under one question, so one bracketed heading on its own is
      // just a question with brackets in it - not a grid, and not regrouped.
      const bracketed = new Map<string, number>();
      for (const column of own) {
        const parts = gridHeaderParts(column.header);
        if (parts) bracketed.set(parts.question, (bracketed.get(parts.question) ?? 0) + 1);
      }

      for (const column of own) {
        const gridParts = gridHeaderParts(column.header);
        if (gridParts && (bracketed.get(gridParts.question) ?? 0) > 1) {
          const parts = grids.get(gridParts.question) ?? [];
          parts.push({ column, row: gridParts.row });
          grids.set(gridParts.question, parts);
          continue;
        }
        if (column.role === "RATING") {
          questions.push(ratingQuestion(column));
          continue;
        }
        if (column.role === "TEXT") {
          questions.push({ header: column.header, kind: "TEXT", answers: answersOf(column), average: null });
          continue;
        }
        questions.push({
          header: column.header,
          kind: "CHOICE",
          answers: answersOf(column),
          average: null,
          split: choiceSplit(answersOf(column), analysis.source),
        });
      }

      for (const [question, parts] of grids) {
        questions.push(gridQuestion(question, parts));
      }

      return { name: section.name.trim() || "-", questions };
    })
    .filter((section) => section.questions.length > 0);

  const counts = new Map<string, number>();
  for (const respondent of respondents) {
    if (respondent.companyCode) counts.set(respondent.companyCode, (counts.get(respondent.companyCode) ?? 0) + 1);
  }

  return {
    course,
    respondents,
    sections: reportSections,
    companies: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([companyCode, count]) => ({ companyCode, count })),
  };
};
