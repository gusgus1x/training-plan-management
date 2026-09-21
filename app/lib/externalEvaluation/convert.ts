/**
 * Reads the response sheet of an external form (Google Forms, Microsoft Forms): what every column
 * is for, and how a multi-select cell splits. The report itself is assembled in ./sections.
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

export type SheetColumn = {
  index: number;
  header: string;
  role: ColumnRole;
  /** RATING only: the top of its scale, read from the answers rather than assumed to be 5. */
  scale?: number;
};

/** The widest scale a column of whole numbers is read as a rating rather than as a count. */
export const MAX_RATING_SCALE = 10;

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

/**
 * The top of a rating column's scale, or null when the column is not one.
 *
 * Read from the answers: a 1-10 form is as much a rating as a 1-5 one, and calling it a choice
 * loses its average. A column of larger numbers is a count of something, not a score.
 */
export const ratingScale = (values: string[]) => {
  const answered = values.filter(Boolean);
  if (!answered.length) return null;
  if (!answered.every((value) => isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_RATING_SCALE)) return null;
  // The top of the scale, not the top score anybody gave: on a 1-10 form where nobody picked 10,
  // charting out of 9 would read every answer as better than it was.
  return Math.max(...answered.map(Number)) <= 5 ? 5 : MAX_RATING_SCALE;
};

/** The type a question column most likely is, judged from its answers. HRD can change it. */
const guessQuestionRole = (values: string[]): ColumnRole => {
  const answered = values.filter(Boolean);
  if (!answered.length) return "TEXT";
  if (ratingScale(values) !== null) return "RATING";
  // Microsoft Forms ends every multi-select answer with ";", even a single tick. Checked whatever
  // the file says it came from: a sheet edited by hand loses the marker columns, not the answers.
  if (answered.some((value) => value.endsWith(";"))) return "MULTI_CHOICE";
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
      const values = rows.map((row) => clean(row[index]));
      const byHeader = HEADER_ROLES.find(([pattern]) => pattern.test(header))?.[1];
      const role = byHeader ?? guessQuestionRole(values);
      return role === "RATING" ? { index, header, role, scale: ratingScale(values) ?? 5 } : { index, header, role };
    })
    .filter((column): column is SheetColumn => column !== null);

  return { source, columns, rows };
};

/** A multi-select cell as its ticks: ";" for Microsoft, ", " for Google. */
export const splitChoices = (value: string, source: ResponseSource) =>
  (source === "MICROSOFT" || value.includes(";") ? value.split(";") : value.split(/,\s+/))
    .map((part) => part.trim())
    .filter(Boolean);
