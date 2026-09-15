import type { EvaluationCourseHeader } from "../trainingForms/types";
import { QUESTION_ROLES, type SheetAnalysis } from "./convert";

/**
 * Advanced mode: questions grouped into sections HRD names, reported the way the company's own
 * evaluation workbook does it - one chart per section, one bar per question, the bar being the
 * average score.
 *
 * Neither Google Forms nor Microsoft Forms carries section names in its export, so the grouping is
 * HRD's to make. Pure, so the screen previews exactly what the workbook will hold.
 */

export type ReportSection = { id: string; name: string };

/** What the one-page company dashboard holds legibly: past these, a chart runs into the footer or its
 *  bars get too thin to read. Measured by opening generated workbooks in Excel. */
export const LAYOUT_LIMITS = { chartSections: 3, ratingsPerSection: 10 };

/** Where a report goes past LAYOUT_LIMITS: 0 and [] when it fits. */
export const layoutWarnings = (report: SectionReport) => {
  const charted = report.sections.filter((section) => section.questions.some((question) => question.kind === "RATING"));
  return {
    tooManySections: charted.length > LAYOUT_LIMITS.chartSections ? charted.length : 0,
    crowdedSections: charted
      .map((section) => ({ name: section.name, ratings: section.questions.filter((question) => question.kind === "RATING").length }))
      .filter((section) => section.ratings > LAYOUT_LIMITS.ratingsPerSection),
  };
};

/** columnIndex -> section id. A question with no entry is left out of the report. */
export type SectionAssignment = Record<number, string>;

export type SectionQuestionKind = "RATING" | "TEXT" | "OTHER";

export type SectionQuestion = {
  header: string;
  kind: SectionQuestionKind;
  /** One per respondent, in respondent order. A rating is its number; everything else its text. */
  answers: Array<string | number | null>;
  /** Ratings only, to two decimals. Null when nobody answered. */
  average: number | null;
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

  const reportSections = sections
    .map((section) => ({
      name: section.name.trim() || "-",
      questions: columns
        .filter((column) => QUESTION_ROLES.includes(column.role) && assignment[column.index] === section.id)
        .map((column): SectionQuestion => {
          const kind: SectionQuestionKind = column.role === "RATING" ? "RATING" : column.role === "TEXT" ? "TEXT" : "OTHER";
          const answers = rows.map((row) => {
            const value = clean(row[column.index]);
            if (!value) return null;
            return kind === "RATING" && /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
          });
          const numbers = answers.filter((answer): answer is number => typeof answer === "number");
          return {
            header: column.header,
            kind,
            answers,
            average: kind === "RATING" && numbers.length
              ? Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 100) / 100
              : null,
          };
        }),
    }))
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
