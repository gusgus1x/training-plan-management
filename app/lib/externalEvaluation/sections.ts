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

/** Header text compared loosely: spacing, case, and the digit Excel appends to a duplicate table
 *  column name ("เอกสารประกอบการเรียน4") do not make it a different question. */
export const normaliseHeader = (value: string) => value.replace(/\s+/g, " ").trim().replace(/\d+$/, "").trim().toLowerCase();

export type StandardSection = { name: string; headers: string[] };

/**
 * Sections taken from the company template for every question whose header matches one there.
 * Questions that match nothing are left unassigned for HRD.
 */
export const assignFromStandard = (
  analysis: SheetAnalysis,
  standard: StandardSection[],
): { sections: ReportSection[]; assignment: SectionAssignment; matched: number; total: number } => {
  const sections = standard.map((section, index) => ({ id: `std-${index}`, name: section.name }));
  const lookup = new Map<string, string>();
  standard.forEach((section, index) => {
    for (const header of section.headers) lookup.set(normaliseHeader(header), `std-${index}`);
  });
  const questionColumns = analysis.columns.filter((column) => QUESTION_ROLES.includes(column.role));
  const assignment: SectionAssignment = {};
  for (const column of questionColumns) {
    const id = lookup.get(normaliseHeader(column.header));
    if (id) assignment[column.index] = id;
  }
  // A template whose header row holds placeholders ("Column1") cannot be matched by text. When the
  // file has exactly as many questions as the template has slots, fill the sections in order.
  const slots = standard.reduce((total, section) => total + section.headers.length, 0);
  if (Object.keys(assignment).length < questionColumns.length && questionColumns.length === slots) {
    let position = 0;
    standard.forEach((section, index) => {
      for (let slot = 0; slot < section.headers.length; slot += 1) {
        assignment[questionColumns[position].index] = `std-${index}`;
        position += 1;
      }
    });
  }
  const used = new Set(Object.values(assignment));
  return {
    sections: sections.filter((section) => used.has(section.id)),
    assignment,
    matched: Object.keys(assignment).length,
    total: questionColumns.length,
  };
};
