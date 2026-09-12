import type {
  AssessmentRecord,
  AssessmentRowType,
  AssessmentWriteInput,
} from "../../lib/assessments/types";
import type {
  EvaluationRecord,
  EvaluationRowType,
  EvaluationWriteInput,
} from "../../lib/evaluations/types";
import { formatCorrectColumns, gridTotalScore, parseCorrectColumns } from "../../lib/formGrids";
import type { PreviewItem, PreviewKind } from "../center_factory/TrainingCourseManagement/modules/FormPreviewRunner";

/**
 * One draft shape for both kinds of form.
 *
 * An assessment and an evaluation are the same object to whoever is building one - a named form
 * with an owner, a published state and a list of items - and they differ only in the few settings
 * at the top and in whether an answer can be right. Holding them as one draft is what lets a single
 * builder serve both; the two `toWriteInput` functions below are the only places the difference is
 * spelled out.
 */

export type FormKind = "assessment" | "evaluation";

/** The row types both kinds share, plus the two that are not questions at all. */
export type DraftItemType = AssessmentRowType | EvaluationRowType;

export type DraftOption = {
  /** Local only. The server assigns real ids; this one just keeps React's list stable. */
  id: string;
  text: string;
  /** Assessments only. An evaluation has no right answer, by design. */
  isCorrect: boolean;
  axis: "ROW" | "COLUMN" | null;
  nextSection: number | null;
  /** Grid ROWs only: that row's points, and the 1-based positions of its correct columns. */
  score: string;
  correctColumnOrders: number[];
};

export type DraftItem = {
  id: string;
  type: DraftItemType;
  text: string;
  /** Body of a text block, sub-caption of a section break. */
  description: string;
  isRequired: boolean;
  /** Assessments only, as a string because the write input carries it as one. */
  score: string;
  nextSection: number | null;
  options: DraftOption[];
};

export type FormDraft = {
  name: string;
  code: string;
  scope: "CENTRAL" | "COMPANY";
  companyId: string | null;
  /** Assessment instructions, or the evaluation's description - one line of prose either way. */
  intro: string;
  /** Assessment only. */
  purpose: "PRE_TEST" | "POST_TEST" | "GENERAL";
  passingScorePercent: string;
  timeLimitMinutes: string;
  /** Evaluation only. */
  timing: "AFTER_TRAINING" | "FOLLOW_UP_30_DAYS";
  respondentType: "EMPLOYEE" | "MANAGER";
  isAnonymous: boolean;
  /** Assessment only. Free text saying what changed, carried on the version that is written. */
  versionNote: string;
  items: DraftItem[];
};

let sequence = 0;
export const localId = (prefix: string) => `${prefix}-${(sequence += 1)}`;

/** The answer types offered per kind. */
export const QUESTION_TYPES: Record<FormKind, ReadonlyArray<{ value: DraftItemType; label: string }>> = {
  assessment: [
    { value: "SINGLE_CHOICE", label: "ตัวเลือกเดียว" },
    { value: "MULTIPLE_CHOICE", label: "หลายตัวเลือก" },
    { value: "TRUE_FALSE", label: "ถูก / ผิด" },
    { value: "SHORT_ANSWER", label: "พิมพ์ตอบ" },
    { value: "MULTIPLE_CHOICE_GRID", label: "ตาราง (แถวละข้อ)" },
    { value: "CHECKBOX_GRID", label: "ตาราง (หลายข้อ)" },
  ],
  evaluation: [
    { value: "RATING", label: "คะแนน 1-5" },
    { value: "SINGLE_CHOICE", label: "ตัวเลือกเดียว" },
    { value: "MULTIPLE_CHOICE", label: "หลายตัวเลือก" },
    { value: "SHORT_TEXT", label: "ตอบสั้น" },
    { value: "LONG_TEXT", label: "ตอบยาว" },
    { value: "MULTIPLE_CHOICE_GRID", label: "ตาราง (แถวละข้อ)" },
    { value: "CHECKBOX_GRID", label: "ตาราง (หลายข้อ)" },
  ],
};

/** A grid asks the same columns about each of several rows; both axes live in `options`. */
export const isGridType = (type: DraftItemType) =>
  type === "MULTIPLE_CHOICE_GRID" || type === "CHECKBOX_GRID";

export const isBlockType = (type: DraftItemType) => type === "SECTION_BREAK" || type === "TEXT_BLOCK";

const option = (text: string, axis: DraftOption["axis"] = null): DraftOption => ({
  id: localId("opt"),
  text,
  isCorrect: false,
  axis,
  nextSection: null,
  score: axis === "ROW" ? "1" : "0",
  correctColumnOrders: [],
});

/** A new item of a type, with the options that type cannot do without. */
export const blankItem = (type: DraftItemType): DraftItem => ({
  id: localId("item"),
  type,
  text: "",
  description: "",
  isRequired: type !== "SECTION_BREAK" && type !== "TEXT_BLOCK",
  score: "1",
  nextSection: null,
  options:
    type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"
      ? [option("ตัวเลือกที่ 1"), option("ตัวเลือกที่ 2")]
      : type === "TRUE_FALSE"
        ? [option("ถูก"), option("ผิด")]
        : type === "RATING"
          ? [1, 2, 3, 4, 5].map((value) => option(String(value)))
          : type === "MULTIPLE_CHOICE_GRID" || type === "CHECKBOX_GRID"
            ? [
                option("แถวที่ 1", "ROW"),
                option("แถวที่ 2", "ROW"),
                option("คอลัมน์ที่ 1", "COLUMN"),
                option("คอลัมน์ที่ 2", "COLUMN"),
              ]
            : [],
});

export const blankDraft = (kind: FormKind, companyId: string | null, isFactory: boolean): FormDraft => ({
  name: "",
  code: "",
  scope: isFactory ? "COMPANY" : "CENTRAL",
  companyId: isFactory ? companyId : null,
  intro: "",
  purpose: "PRE_TEST",
  passingScorePercent: "60",
  timeLimitMinutes: "",
  timing: "AFTER_TRAINING",
  respondentType: "EMPLOYEE",
  isAnonymous: false,
  versionNote: "",
  items: [blankItem(kind === "assessment" ? "SINGLE_CHOICE" : "RATING")],
});

export const draftFromAssessment = (record: AssessmentRecord): FormDraft => ({
  name: record.seriesName,
  code: record.seriesCode,
  scope: record.scope,
  companyId: record.companyId,
  intro: record.instructions ?? "",
  purpose: record.purpose,
  passingScorePercent: record.passingScorePercent,
  timeLimitMinutes: record.timeLimitMinutes === null ? "" : String(record.timeLimitMinutes),
  timing: "AFTER_TRAINING",
  respondentType: "EMPLOYEE",
  isAnonymous: false,
  versionNote: record.versionNote ?? "",
  items: record.questions.map((question) => ({
    id: localId("item"),
    type: question.questionType,
    text: question.questionText,
    description: question.questionDescription ?? "",
    isRequired: question.isRequired,
    score: question.questionScore,
    nextSection: question.nextSection,
    options: question.choices.map((choice) => ({
      id: localId("opt"),
      text: choice.choiceText,
      isCorrect: choice.isCorrect,
      axis: choice.axis,
      nextSection: choice.nextSection,
      score: choice.optionScore,
      correctColumnOrders: parseCorrectColumns(choice.correctColumns),
    })),
  })),
});

export const draftFromEvaluation = (record: EvaluationRecord): FormDraft => ({
  name: record.formName,
  code: record.formCode,
  scope: record.scope,
  companyId: record.companyId,
  intro: record.description ?? "",
  purpose: "PRE_TEST",
  passingScorePercent: "60",
  timeLimitMinutes: "",
  timing: record.timing,
  // An evaluation has no version chain, so it has no note about one either.
  versionNote: "",
  respondentType: record.respondentType,
  isAnonymous: record.isAnonymous,
  items: record.questions.map((question) => ({
    id: localId("item"),
    type: question.questionType,
    text: question.questionText,
    description: question.questionDescription ?? "",
    isRequired: question.isRequired,
    score: "1",
    nextSection: question.nextSection,
    options: question.options.map((choice) => ({
      id: localId("opt"),
      text: choice.optionText,
      isCorrect: false,
      axis: choice.axis,
      nextSection: choice.nextSection,
      score: "0",
      correctColumnOrders: [],
    })),
  })),
});

export const toAssessmentInput = (
  draft: FormDraft,
  status: AssessmentWriteInput["status"],
): AssessmentWriteInput => ({
  scope: draft.scope,
  companyId: draft.scope === "CENTRAL" ? null : draft.companyId,
  seriesCode: draft.code.trim(),
  seriesName: draft.name.trim(),
  purpose: draft.purpose,
  versionNote: draft.versionNote.trim() || null,
  instructions: draft.intro.trim() || null,
  passingScorePercent: draft.passingScorePercent,
  timeLimitMinutes: draft.timeLimitMinutes.trim() === "" ? null : Number(draft.timeLimitMinutes),
  status,
  questions: draft.items.map((item) => ({
    questionText: item.text,
    questionType: item.type as AssessmentRowType,
    // A grid is worth the sum of its rows, which the server checks rather than takes on trust.
    questionScore: isBlockType(item.type)
      ? "0"
      : isGridType(item.type)
        ? gridTotalScore(item.options.filter((choice) => choice.axis === "ROW").map((row) => row.score))
        : item.score,
    questionDescription: isBlockType(item.type) ? item.description.trim() || null : null,
    // Only a section may send the form somewhere else, and only a block may be unanswerable. Both
    // are rules the service states back as a 400, so they are settled here rather than there.
    nextSection: item.type === "SECTION_BREAK" ? item.nextSection : null,
    isRequired: isBlockType(item.type) ? false : item.isRequired,
    choices: item.options.map((choice) => ({
      choiceText: choice.text,
      isCorrect: choice.isCorrect,
      // A grid row carries its own points. Everywhere else the marks live on the question, and a
      // choice records the question's score only when it is the right one - a wrong answer worth
      // the same as a right one is what the old editor was careful never to write.
      optionScore: isGridType(item.type)
        ? choice.axis === "ROW"
          ? choice.score
          : "0"
        : choice.isCorrect
          ? item.score
          : "0",
      // Branching needs one answer to branch on, which only a single choice has.
      nextSection: item.type === "SINGLE_CHOICE" ? choice.nextSection : null,
      axis: choice.axis,
      // The answer key lives on the row, as the positions of its correct columns.
      correctColumns: choice.axis === "ROW" ? formatCorrectColumns(choice.correctColumnOrders) : null,
    })),
  })),
});

export const toEvaluationInput = (
  draft: FormDraft,
  status: EvaluationWriteInput["status"],
): EvaluationWriteInput => ({
  scope: draft.scope,
  companyId: draft.scope === "CENTRAL" ? null : draft.companyId,
  formCode: draft.code.trim(),
  formName: draft.name.trim(),
  description: draft.intro.trim() || null,
  timing: draft.timing,
  respondentType: draft.respondentType,
  isAnonymous: draft.isAnonymous,
  status,
  questions: draft.items.map((item) => ({
    questionText: item.text,
    questionType: item.type as EvaluationRowType,
    sectionName: null,
    questionDescription: isBlockType(item.type) ? item.description.trim() || null : null,
    nextSection: item.type === "SECTION_BREAK" ? item.nextSection : null,
    isRequired: isBlockType(item.type) ? false : item.isRequired,
    options: item.options.map((choice, index) => ({
      optionText: choice.text,
      // A rating is the five values 1 to 5, and the service checks them by position. Sending null
      // here refused every rating question, which is the first row on every new evaluation.
      optionValue: item.type === "RATING" ? String(index + 1) : null,
      nextSection: item.type === "SINGLE_CHOICE" ? choice.nextSection : null,
      axis: choice.axis,
    })),
  })),
});

const PREVIEW_KINDS: Record<string, PreviewKind> = {
  SINGLE_CHOICE: "single",
  TRUE_FALSE: "single",
  MULTIPLE_CHOICE: "multiple",
  SHORT_ANSWER: "text",
  SHORT_TEXT: "text",
  LONG_TEXT: "text",
  RATING: "rating",
  MULTIPLE_CHOICE_GRID: "grid",
  CHECKBOX_GRID: "gridMulti",
  SECTION_BREAK: "section",
  TEXT_BLOCK: "note",
};

/**
 * The draft as the learner would meet it. Correctness has nowhere to live in `PreviewItem`, which
 * is what stops a preview from ever showing an answer key.
 */
export const toPreviewItems = (draft: FormDraft): PreviewItem[] =>
  draft.items.map((item) => ({
    id: item.id,
    kind: PREVIEW_KINDS[item.type] ?? "text",
    text: item.text,
    description: item.description || null,
    isRequired: item.isRequired,
    nextSection: item.nextSection,
    options: item.options.map((choice) => ({
      id: choice.id,
      text: choice.text,
      axis: choice.axis,
      nextSection: choice.nextSection,
    })),
  }));

/**
 * What is wrong with a draft, as codes rather than sentences.
 *
 * The wording belongs to the screen, which knows which language the reader chose; this only knows
 * the rules. Every one of them restates a rule the services enforce, so a draft that passes here is
 * one the server will accept - the point is to say so before the round trip, beside the field.
 *
 * `field` is a settings field by name, `items` for the form as a whole, or an item's own id.
 */
export type DraftIssue = { field: string; code: DraftIssueCode };

export type DraftIssueCode =
  | "NAME_REQUIRED"
  | "PASS_RANGE"
  | "TIME_POSITIVE"
  | "NEED_QUESTION"
  | "TEXT_REQUIRED"
  | "MIN_OPTIONS"
  | "OPTION_TEXT"
  | "ONE_CORRECT"
  | "SOME_CORRECT"
  | "SCORE_POSITIVE"
  | "RATING_FIVE"
  | "GRID_AXES";

const MIN_OPTIONS = 2;

const isChoiceType = (type: DraftItemType) =>
  type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE";

export const validateDraft = (
  draft: FormDraft,
  kind: FormKind,
  publishing: boolean,
): DraftIssue[] => {
  const issues: DraftIssue[] = [];
  const isAssessment = kind === "assessment";

  if (!draft.name.trim()) issues.push({ field: "name", code: "NAME_REQUIRED" });

  if (isAssessment) {
    const passing = Number(draft.passingScorePercent);
    if (!Number.isFinite(passing) || passing < 0 || passing > 100) {
      issues.push({ field: "passingScorePercent", code: "PASS_RANGE" });
    }
    const minutes = draft.timeLimitMinutes.trim();
    if (minutes !== "" && (!Number.isInteger(Number(minutes)) || Number(minutes) <= 0)) {
      issues.push({ field: "timeLimitMinutes", code: "TIME_POSITIVE" });
    }
  }

  // Rows that are not questions cannot carry a form on their own, which is what the server says
  // too: a form of nothing but sections and text blocks asks nobody anything.
  const answerable = draft.items.filter((item) => !isBlockType(item.type));
  if (publishing && answerable.length === 0) issues.push({ field: "items", code: "NEED_QUESTION" });

  for (const item of answerable) {
    if (!item.text.trim()) issues.push({ field: item.id, code: "TEXT_REQUIRED" });

    if (isChoiceType(item.type)) {
      // True/false is the two it is born with: the services refuse a third.
      if (item.type === "TRUE_FALSE" ? item.options.length !== 2 : item.options.length < MIN_OPTIONS) {
        issues.push({ field: item.id, code: "MIN_OPTIONS" });
      }
      if (item.options.some((choice) => !choice.text.trim())) {
        issues.push({ field: item.id, code: "OPTION_TEXT" });
      }
      if (isAssessment) {
        const correct = item.options.filter((choice) => choice.isCorrect).length;
        // Two, not one: a multiple choice with a single right answer is a single choice, and the
        // service says so with a 400.
        if (item.type === "MULTIPLE_CHOICE" ? correct < 2 : correct !== 1) {
          issues.push({ field: item.id, code: item.type === "MULTIPLE_CHOICE" ? "SOME_CORRECT" : "ONE_CORRECT" });
        }
      }
    }

    if (item.type === "RATING" && item.options.length !== 5) {
      issues.push({ field: item.id, code: "RATING_FIVE" });
    }

    if (isGridType(item.type)) {
      const rows = item.options.filter((choice) => choice.axis === "ROW");
      const columns = item.options.filter((choice) => choice.axis === "COLUMN");
      // One row is enough, two columns are not optional: a grid with one column asks nothing.
      if (rows.length === 0 || columns.length < 2) issues.push({ field: item.id, code: "GRID_AXES" });
      // The question's score is the sum of the rows', so rows worth nothing leave it at zero.
      if (isAssessment && !(rows.reduce((sum, row) => sum + (Number(row.score) || 0), 0) > 0)) {
        issues.push({ field: item.id, code: "SCORE_POSITIVE" });
      }
    }

    // A grid is scored by its rows, so the question's own score is derived rather than typed.
    if (isAssessment && !isGridType(item.type) && !(Number(item.score) > 0)) {
      issues.push({ field: item.id, code: "SCORE_POSITIVE" });
    }
  }

  return issues;
};
