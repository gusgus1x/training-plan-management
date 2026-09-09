"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import {
  createAssessment,
  createAssessmentVersion,
  deleteAssessment,
  listAssessments,
  setAssessmentStatus,
  updateAssessment,
} from "../../../../lib/assessments/client";
import { ASSESSMENT_QUESTION_TYPES } from "../../../../lib/assessments/types";
import type {
  AssessmentChoiceInput,
  AssessmentPurpose,
  AssessmentQuestionInput,
  AssessmentRecord,
  AssessmentScope,
  AssessmentStatus,
  AssessmentWriteInput,
} from "../../../../lib/assessments/types";
import { listCompanies } from "../../../../lib/companies/client";
import type { CompanyRecord } from "../../../../lib/companies/types";
import {
  fallThroughLabel,
  isFormBlockType,
  remapSectionOrdinals,
  sectionCountOf,
  sectionIndexPerRow,
  type FormBlockType,
} from "../../../../lib/formBlocks";
import {
  formatCorrectColumns,
  gridTotalScore,
  isGridType,
  MIN_GRID_COLUMNS,
  MIN_GRID_ROWS,
  parseCorrectColumns,
  type GridAxis,
} from "../../../../lib/formGrids";
import FormItemToolbar, { type FormItemKind } from "./FormItemToolbar";
import FormPreviewRunner, { type PreviewItem, type PreviewKind } from "./FormPreviewRunner";
import SearchableSelect from "../../../SearchableSelect";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./Assessment.module.css";

export const assessmentModule = {
  title: "Assessment",
  subtitle: "Pre / Post Test",
  description: "Manage versioned assessment series and question banks stored in SQL Server.",
} as const;

type Mode = "idle" | "new" | "edit" | "version";
type Feedback = { tone: "success" | "error" | "info"; message: string };
type FormErrors = Partial<Record<
  "companyId" | "seriesCode" | "seriesName" | "passingScorePercent" |
  "timeLimitMinutes" | "questions" | "question",
  string
>>;
type Draft = {
  scope: AssessmentScope;
  companyId: string;
  seriesCode: string;
  seriesName: string;
  purpose: AssessmentPurpose;
  versionNote: string;
  instructions: string;
  passingScorePercent: string;
  timeLimitMinutes: string;
  status: AssessmentStatus;
};
type DraftChoice = AssessmentChoiceInput & { id: string };
/**
 * The stored value itself, not a UI-only label. The editor used to carry "Choice" | "Text" and map
 * both ways, which quietly rewrote every MULTIPLE_CHOICE and TRUE_FALSE question as SINGLE_CHOICE
 * (and dropped all but the first correct answer) the moment somebody edited and saved it. The DB
 * has always allowed all four - CK_RC2_assessment_question_question_type_enum - so the draft now
 * holds exactly what will be written back.
 */
type AssessmentQuestionType = AssessmentQuestionInput["questionType"];

/** The editor sits above the question list, so pressing Edit on a question further down moved the
 *  form off-screen. Scrolling to it is the cheap version of editing the question in place. */
const QUESTION_BUILDER_ID = "assessment-question-builder";
const LEARNER_PREVIEW_ID = "assessment-learner-preview";
const scrollToQuestionBuilder = () =>
  document.getElementById(QUESTION_BUILDER_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * Exhaustive over the ANSWERABLE types only - blocks are inserted by the toolbar, never chosen from
 * this dropdown. Being a Record means a type added to ASSESSMENT_QUESTION_TYPES fails to compile
 * until it is labelled here, which is exactly what the previous hardcoded <option> list could not do.
 */
const ASSESSMENT_TYPE_LABELS: Record<(typeof ASSESSMENT_QUESTION_TYPES)[number], string> = {
  SINGLE_CHOICE: "Single Choice (ปรนัย - ตอบได้ 1 ข้อ)",
  MULTIPLE_CHOICE: "Multiple Choice (ปรนัย - ตอบได้หลายข้อ)",
  TRUE_FALSE: "True / False (ถูก - ผิด)",
  SHORT_ANSWER: "Short Answer (อัตนัย / เติมคำ)",
  MULTIPLE_CHOICE_GRID: "Multiple Choice Grid (ตารางกริดหลายตัวเลือก)",
  CHECKBOX_GRID: "Checkbox Grid (ตารางกริดทำเครื่องหมาย)",
};

/**
 * Author-facing summary of a grid: rows down, columns across, a tick on each correct cell and the
 * row's points on the right.
 *
 * Listing a grid's choices flat (A. B. C. ...) the way an ordinary question's are runs the rows and
 * the columns together into one alphabetised list, which says nothing about which column is correct
 * for which row - the only thing the author actually needs to check.
 */
const renderGridSummary = (
  choices: ReadonlyArray<{ id?: string; choiceId?: string; choiceText: string; axis: string | null; correctColumns: string | null; optionScore: string | number }>,
  pointsLabel: string,
) => {
  const rows = choices.filter((choice) => choice.axis === "ROW");
  const columns = choices.filter((choice) => choice.axis === "COLUMN");
  const keyOf = (choice: { id?: string; choiceId?: string }) => choice.id ?? choice.choiceId ?? "";
  return (
    <div className={styles.gridPreviewScroll}>
      <table className={styles.gridPreviewTable}>
        <thead>
          <tr>
            <th />
            {columns.map((column) => <th key={keyOf(column)}>{column.choiceText}</th>)}
            <th>{pointsLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const correct = parseCorrectColumns(row.correctColumns);
            return (
              <tr key={keyOf(row)}>
                <th scope="row">{row.choiceText}</th>
                {columns.map((column, columnIndex) => (
                  <td key={keyOf(column)} data-correct={correct.includes(columnIndex + 1)}>
                    {correct.includes(columnIndex + 1) ? "✓" : ""}
                  </td>
                ))}
                <td>{Number(row.optionScore)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/**
 * The question score, when the type carries its points inside its own options rather than as one
 * number for the whole question. Null means the author types the score by hand.
 *
 * Only grids do this today: Google Forms scores a grid per row, so the question is worth the sum of
 * its rows. Returning null for everything else keeps the ordinary types typing their own score, and
 * makes adding a second self-scoring type a one-line change here rather than a hunt through the JSX.
 */
const derivedQuestionScore = (question: DraftQuestion): string | null =>
  isGridType(question.questionType)
    ? gridTotalScore(question.choices.filter((choice) => choice.axis === "ROW").map((row) => row.optionScore))
    : null;

const CHOICE_TYPES: AssessmentQuestionType[] = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"];
const isChoiceType = (type: AssessmentQuestionType) => CHOICE_TYPES.includes(type);

type DraftQuestion = Omit<AssessmentQuestionInput, "choices" | "questionType"> & {
  id: string;
  questionType: AssessmentQuestionType;
  choices: DraftChoice[];
};

const blankDraft = (companyId = "", factory = false): Draft => ({
  scope: factory ? "COMPANY" : "CENTRAL",
  companyId,
  seriesCode: "",
  seriesName: "",
  purpose: "PRE_TEST",
  versionNote: "",
  instructions: "",
  passingScorePercent: "80",
  timeLimitMinutes: "",
  status: "DRAFT",
});

const key = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** The server (app/lib/assessments/validation.ts) accepts any choice count from two upwards, and
 *  the DB stores them as ordered rows with no cap - the old fixed four was a UI-only rule that
 *  forced a true/false question to carry two empty options. */
const MIN_CHOICES = 2;
const DEFAULT_CHOICE_COUNT = 4;

const blankChoice = (isCorrect = false): DraftChoice => ({
  id: key(),
  choiceText: "",
  isCorrect,
  optionScore: isCorrect ? "1" : "0",
  nextSection: null,
  axis: null,
  correctColumns: null,
});
const blankChoices = (count = DEFAULT_CHOICE_COUNT): DraftChoice[] =>
  Array.from({ length: count }, (_, index) => blankChoice(index === 0));

/** TRUE_FALSE is stored as an ordinary two-choice question; the DB check constraint accepts the
 *  type, and the runner renders it as a single-answer question like SINGLE_CHOICE. */
const trueFalseChoices = (): DraftChoice[] => [
  { id: key(), choiceText: "True", isCorrect: true, optionScore: "1", nextSection: null, axis: null, correctColumns: null },
  { id: key(), choiceText: "False", isCorrect: false, optionScore: "0", nextSection: null, axis: null, correctColumns: null },
];
const blankQuestion = (): DraftQuestion => ({
  id: key(),
  questionText: "",
  questionType: "SINGLE_CHOICE",
  questionScore: "1",
  questionDescription: null,
  nextSection: null,
  isRequired: true,
  choices: blankChoices(),
});

/** A section break or a text block: a title, an optional body, no choices and no marks. */
const blankBlock = (type: FormBlockType): DraftQuestion => ({
  ...blankQuestion(),
  questionType: type,
  questionText: type === "SECTION_BREAK" ? "Untitled section" : "Untitled text",
  questionScore: "0",
  questionDescription: "",
  isRequired: false,
  choices: [],
});

const toDraftQuestions = (record: AssessmentRecord): DraftQuestion[] =>
  record.questions.map((question) => {
    // The stored type is kept as-is. It used to be squashed into "Choice"/"Text" here and written
    // back as SINGLE_CHOICE/SHORT_ANSWER, so editing a MULTIPLE_CHOICE or TRUE_FALSE question
    // silently changed its type. Choices are no longer truncated to 4 either.
    const questionType = question.questionType;
    const storedChoices = question.choices.map((choice) => ({
      id: choice.choiceId,
      choiceText: choice.choiceText,
      // Every correct flag survives now. The old version kept only the first one, which quietly
      // destroyed the other correct answers of a MULTIPLE_CHOICE question.
      isCorrect: isChoiceType(questionType) && choice.isCorrect,
      optionScore: choice.optionScore,
      nextSection: choice.nextSection,
      axis: choice.axis,
      correctColumns: choice.correctColumns,
    }));
    const choices = isChoiceType(questionType)
      ? storedChoices.length >= MIN_CHOICES
        ? storedChoices
        : [...storedChoices, ...blankChoices()].slice(0, MIN_CHOICES)
      : [];
    // A single-answer question with nothing marked correct cannot be saved, so fall back to the
    // first option rather than handing the editor a state its own validation rejects.
    if (
      (questionType === "SINGLE_CHOICE" || questionType === "TRUE_FALSE") &&
      choices.length > 0 &&
      !choices.some((choice) => choice.isCorrect)
    ) {
      choices[0] = { ...choices[0], isCorrect: true };
    }
    return {
      id: question.questionId,
      questionText: question.questionText,
      questionType,
      questionScore: question.questionScore,
      questionDescription: question.questionDescription,
      nextSection: question.nextSection,
      isRequired: question.isRequired,
      choices,
    };
  });

/**
 * Draft rows to the shape the live preview runner takes.
 *
 * Note what is NOT carried across: isCorrect and optionScore. The learner never sees either, so a
 * preview that had access to them could drift into flattering the form. PreviewItem has nowhere to
 * put them, which makes that impossible rather than merely discouraged.
 */
const toPreviewItems = (rows: DraftQuestion[]): PreviewItem[] => rows.map((row) => {
  const kind: PreviewKind =
    row.questionType === "SECTION_BREAK" ? "section"
      : row.questionType === "TEXT_BLOCK" ? "note"
        : row.questionType === "MULTIPLE_CHOICE_GRID" ? "grid"
          : row.questionType === "CHECKBOX_GRID" ? "gridMulti"
            : row.questionType === "MULTIPLE_CHOICE" ? "multiple"
              : row.questionType === "SHORT_ANSWER" ? "text"
                : "single";
  return {
    id: row.id,
    kind,
    text: row.questionText || "(ยังไม่ได้ใส่คำถาม)",
    description: row.questionDescription || null,
    isRequired: row.isRequired,
    nextSection: row.nextSection,
    // A grid carries its rows and columns in the same choice list, tagged by axis.
    options: isGridType(row.questionType)
      ? row.choices.map((choice) => ({
          id: choice.id,
          text: choice.choiceText || "(ยังไม่ได้ใส่ข้อความ)",
          nextSection: null,
          axis: choice.axis,
        }))
      : isChoiceType(row.questionType)
        ? row.choices.map((choice) => ({
            id: choice.id,
            text: choice.choiceText || "(ยังไม่ได้ใส่ตัวเลือก)",
            nextSection: row.questionType === "SINGLE_CHOICE" ? choice.nextSection : null,
          }))
        : [],
  };
});

const displayQuestionType = (value: AssessmentRecord["questions"][number]["questionType"]) =>
  value === "SECTION_BREAK" ? "Section" : value === "TEXT_BLOCK" ? "Text block" : value === "SHORT_ANSWER" ? "Text" : "Choice";

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
/** Turned off at the user's request until the export is actually wanted. The builder below stays -
 *  flipping this back on is the whole change. */
const SHOW_CSV_EXPORT = false;

const createAssessmentCsv = (items: AssessmentRecord[]) => [
  ["Code", "Name", "Scope", "Company", "Purpose", "Version", "Pass Score", "Questions", "Status", "Updated At"],
  ...items.map((item) => [
    item.seriesCode,
    item.seriesName,
    item.scope,
    item.companyCode ?? "Central",
    item.purpose,
    item.versionNo,
    item.passingScorePercent,
    item.questions.length,
    item.status,
    item.updatedAt ?? item.createdAt,
  ]),
].map((row) => row.map(csvCell).join(",")).join("\r\n");

const statusOptions = (current?: AssessmentStatus): AssessmentStatus[] => {
  if (!current || current === "DRAFT") return ["DRAFT", "ACTIVE"];
  return current === "ACTIVE" ? ["ACTIVE", "INACTIVE"] : ["INACTIVE", "ACTIVE"];
};



const generateNextAssessmentCode = (
  purpose: AssessmentPurpose,
  scope: AssessmentScope,
  companyId: string,
  userCompanyCode: string | null | undefined,
  companyRecords: CompanyRecord[],
  assessmentRecords: AssessmentRecord[],
) => {
  const purposeTag = purpose === "PRE_TEST" ? "PRE" : purpose === "POST_TEST" ? "POST" : "ASM";
  const company = companyRecords.find((c) => c.companyId === companyId);
  const companyCode = scope === "COMPANY"
    ? (company?.companyCode || userCompanyCode || undefined)
    : undefined;

  const prefix = companyCode ? `${companyCode}-${purposeTag}` : purposeTag;
  const upperPrefix = prefix.toUpperCase();

  let maxSeq = 0;
  for (const item of assessmentRecords) {
    const code = (item.seriesCode || "").trim().toUpperCase();
    if (item.purpose === purpose || (code && code.startsWith(upperPrefix))) {
      const match = code.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  return `${prefix}-${String(maxSeq + 1).padStart(6, "0")}`;
};

const RequiredIndicator = ({ isFilled }: { isFilled: boolean }) => (
  <span
    className={isFilled ? styles.indicatorDone : styles.indicatorPending}
    title={isFilled ? "กรอกข้อมูลเรียบร้อยแล้ว / Completed" : "จำเป็นต้องกรอก / Required field"}
  >
    <span className={styles.indicatorDot} />
  </span>
);

export default function Assessment() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const isCenter = user?.roleCode === "HRD_CENTER";
  const [items, setItems] = useState<AssessmentRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [detailAsLearner, setDetailAsLearner] = useState(false);

  // The floating toolbar tracks whichever card is focused and inserts below it. onMouseDown backs
  // up onFocusCapture, which misses clicks on the parts of a card that are not focusable.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [anchorTop, setAnchorTop] = useState<number | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [mode, setMode] = useState<Mode>("idle");
  const [draft, setDraft] = useState<Draft>(() => blankDraft(user?.companyId ?? "", !isCenter));
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [question, setQuestion] = useState<DraftQuestion>(blankQuestion);

  useLayoutEffect(() => {
    setAnchorTop(focusedId ? cardRefs.current.get(focusedId)?.offsetTop ?? null : null);
  }, [focusedId, questions]);

  /** Registers a card so the floating toolbar can measure its offsetTop. */
  const cardRef = useCallback((id: string) => (element: HTMLElement | null) => {
    if (element) cardRefs.current.set(id, element);
    else cardRefs.current.delete(id);
  }, []);

  /** Section ordinal each row sits in, so a branch dropdown can offer only forward targets. */
  const sectionOfRow = useMemo(() => sectionIndexPerRow(questions.map((item) => item.questionType)), [questions]);
  const totalSections = useMemo(() => sectionCountOf(questions.map((item) => item.questionType)), [questions]);

  /**
   * A branch that jumps over a section still leaves that section's questions in the score
   * denominator - submitAssessment sums question_score over every question on the form, not over
   * the path the learner walked. Persisting the visited path would fix it properly; until then the
   * author is told plainly, because they are the one choosing to branch a graded test.
   */
  const skippedByBranch = useMemo(
    () => questions.some((item, index) => [item.nextSection, ...item.choices.map((choice) => choice.nextSection)]
      .some((target) => target !== null && target > (sectionOfRow[index] ?? 1) + 1)),
    [questions, sectionOfRow],
  );
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  // Escape hatch for the strings the DOM-walking dictionary cannot reach: those with
  // interpolated counts, and those that must differ per language rather than be translated.
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);
  // Same call shape as the old banner state, routed to the global toast instead.
  const setFeedback = useCallback(
    (next: Feedback | null) => {
      if (next) toast[next.tone](next.message);
    },
    [toast],
  );
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  /** Company code, or "CENTRAL" for the central bucket. Center users only - a Factory user's list
   *  is already narrowed to their own company plus central by the server. */
  const [companyFilter, setCompanyFilter] = useState("");
  /** Tracks the CLOSED groups, not the open ones: a company block that has just appeared (a new
   *  assessment, a cleared filter) should be open, which an "open list" would get backwards. */
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  /** Which existing assessment the new-assessment form was filled from. Display only - the copy is
   *  a one-time fill, the two records have no lasting link. */
  const [templateSourceId, setTemplateSourceId] = useState("");
  /** Author's list vs what the employee will actually be shown. Off by default: building the form
   *  is what this panel is mostly used for. */
  const [previewAsLearner, setPreviewAsLearner] = useState(false);
  const toggleGroup = (code: string) =>
    setClosedGroups((current) => current.includes(code) ? current.filter((entry) => entry !== code) : [...current, code]);

  const updateDraftField = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (mode === "new" && (field === "purpose" || field === "scope" || field === "companyId")) {
        next.seriesCode = generateNextAssessmentCode(
          next.purpose,
          next.scope,
          next.companyId,
          user?.companyCode,
          companies,
          items,
        );
      }
      return next;
    });
    if (field in formErrors) {
      setFormErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  const selected = useMemo(
    () => items.find((item) => item.assessmentId === selectedId) ?? null,
    [items, selectedId],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const bySearch = query
      ? items.filter((item) => [item.seriesCode, item.seriesName, item.companyCode, item.purpose, item.status]
        .filter(Boolean).join(" ").toLowerCase().includes(query))
      : items;
    // "CENTRAL" is its own bucket rather than a company: a central assessment has no companyCode,
    // and Center users need to be able to isolate exactly those.
    return companyFilter
      ? bySearch.filter((item) => companyFilter === "CENTRAL" ? item.companyCode === null : item.companyCode === companyFilter)
      : bySearch;
  }, [items, search, companyFilter]);

  /** The list is grouped the way Course Master groups courses: central first, then one block per
   *  company. Grouping here rather than in the table keeps the row loop a straight map. */
  const groupedVisible = useMemo(() => {
    const groups = new Map<string, AssessmentRecord[]>();
    for (const item of visible) {
      const key = item.companyCode ?? "CENTRAL";
      const bucket = groups.get(key);
      if (bucket) bucket.push(item); else groups.set(key, [item]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a === "CENTRAL" ? -1 : b === "CENTRAL" ? 1 : a.localeCompare(b))
      .map(([code, rows]) => ({
        code,
        label: code === "CENTRAL"
          ? "แบบทดสอบส่วนกลาง (HRD Center)"
          : `แบบทดสอบบริษัท ${companies.find((company) => company.companyCode === code)?.companyNameTh ?? code}`,
        isOwn: code === "CENTRAL" ? isCenter : code === user?.companyCode,
        rows,
      }));
  }, [visible, companies, isCenter, user?.companyCode]);

  const load = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const [assessmentResult, companyResult] = await Promise.all([
        listAssessments(),
        listCompanies(),
      ]);
      setItems(assessmentResult.items);
      setCompanies(companyResult.items);
      setSelectedId((current) => assessmentResult.items.some((item) => item.assessmentId === current) ? current : "");
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to load assessments" });
    } finally {
      setBusy(false);
      setIsLoading(false);
    }
  }, [setFeedback]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const closeEditor = () => {
    setMode("idle");
    setDraft(blankDraft(user?.companyId ?? "", !isCenter));
    setQuestions([]);
    setQuestion(blankQuestion());
    setEditingQuestionId("");
    setFormErrors({});
  };

  const startNew = () => {
    setSelectedId("");
    setOpenDetailId("");
    const initialDraft = blankDraft(user?.companyId ?? "", !isCenter);
    const autoCode = generateNextAssessmentCode(
      initialDraft.purpose,
      initialDraft.scope,
      initialDraft.companyId,
      user?.companyCode,
      companies,
      items,
    );
    setDraft({
      ...initialDraft,
      seriesCode: autoCode,
    });
    setQuestions([]);
    setQuestion(blankQuestion());
    setEditingQuestionId("");
    setFeedback(null);
    setFormErrors({});
    setTemplateSourceId("");
    setMode("new");
  };

  const startEdit = () => {
    if (!selected?.canModify) return;
    setDraft({
      scope: selected.scope,
      companyId: selected.companyId ?? "",
      seriesCode: selected.seriesCode,
      seriesName: selected.seriesName,
      purpose: selected.purpose,
      versionNote: selected.versionNote ?? "",
      instructions: selected.instructions ?? "",
      passingScorePercent: selected.passingScorePercent,
      timeLimitMinutes: selected.timeLimitMinutes?.toString() ?? "",
      status: selected.status,
    });
    setQuestions(toDraftQuestions(selected));
    setQuestion(blankQuestion());
    setEditingQuestionId("");
    setFeedback(null);
    setFormErrors({});
    setMode("edit");
  };

  const openEditForItem = (item: AssessmentRecord) => {
    if (!item.canModify) return;
    setSelectedId(item.assessmentId);
    setOpenDetailId("");
    setDraft({
      scope: item.scope,
      companyId: item.companyId ?? "",
      seriesCode: item.seriesCode,
      seriesName: item.seriesName,
      purpose: item.purpose,
      versionNote: item.versionNote ?? "",
      instructions: item.instructions ?? "",
      passingScorePercent: item.passingScorePercent,
      timeLimitMinutes: item.timeLimitMinutes?.toString() ?? "",
      status: item.status,
    });
    setQuestions(toDraftQuestions(item));
    setQuestion(blankQuestion());
    setEditingQuestionId("");
    setFeedback(null);
    setFormErrors({});
    setMode("edit");
  };

  const startVersion = () => {
    if (!selected?.canCreateVersion) return;
    setDraft({
      scope: selected.scope,
      companyId: selected.companyId ?? "",
      seriesCode: selected.seriesCode,
      seriesName: selected.seriesName,
      purpose: selected.purpose,
      versionNote: `New version from v${selected.versionNo}`,
      instructions: selected.instructions ?? "",
      passingScorePercent: selected.passingScorePercent,
      timeLimitMinutes: selected.timeLimitMinutes?.toString() ?? "",
      status: "DRAFT",
    });
    setQuestions(toDraftQuestions(selected).map((item) => ({
      ...item,
      id: key(),
      choices: item.choices.map((choice) => ({ ...choice, id: key() })),
    })));
    setQuestion(blankQuestion());
    setEditingQuestionId("");
    setFeedback(null);
    setFormErrors({});
    setMode("version");
  };

  const setQuestionType = (questionType: AssessmentQuestionType) => {
    setQuestion((current) => {
      if (questionType === "SHORT_ANSWER") return { ...current, questionType, choices: [] };
      if (questionType === "TRUE_FALSE") return { ...current, questionType, choices: trueFalseChoices() };

      if (isGridType(questionType)) {
        // Switching between the two grid types keeps the axes; a checkbox grid row may hold several
        // correct columns, so coming back to a multiple choice grid has to trim the key to one.
        const existing = current.choices.filter((choice) => choice.axis !== null);
        const choices = existing.length ? existing : [
          { ...blankChoice(false), axis: "ROW" as const, optionScore: "1" },
          { ...blankChoice(false), axis: "COLUMN" as const, optionScore: "0" },
          { ...blankChoice(false), axis: "COLUMN" as const, optionScore: "0" },
        ];
        return {
          ...current,
          questionType,
          choices: questionType === "MULTIPLE_CHOICE_GRID"
            ? choices.map((choice) => ({
                ...choice,
                correctColumns: formatCorrectColumns(parseCorrectColumns(choice.correctColumns).slice(0, 1)),
              }))
            : choices,
        };
      }
      // Leaving a grid drops the axes, or the choices would be neither rows nor plain options.
      const kept = current.choices.filter((choice) => choice.axis === null);
      const choices = kept.length >= MIN_CHOICES ? [...kept] : blankChoices();
      // Switching from multiple- to single-answer has to leave exactly one correct choice, which
      // is what the server requires for SINGLE_CHOICE.
      if (questionType === "SINGLE_CHOICE") {
        const firstCorrect = Math.max(0, choices.findIndex((choice) => choice.isCorrect));
        return {
          ...current,
          questionType,
          choices: choices.map((choice, index) => ({ ...choice, isCorrect: index === firstCorrect })),
        };
      }
      return { ...current, questionType, choices };
    });
  };

  /** Single-answer types behave like radio buttons; MULTIPLE_CHOICE toggles each choice on its own. */
  const toggleCorrect = (index: number) =>
    setQuestion((current) => ({
      ...current,
      choices: current.choices.map((choice, idx) =>
        current.questionType === "MULTIPLE_CHOICE"
          ? idx === index
            ? { ...choice, isCorrect: !choice.isCorrect }
            : choice
          : { ...choice, isCorrect: idx === index },
      ),
    }));

  const updateGridChoice = (choiceId: string, patch: Partial<DraftChoice>) =>
    setQuestion((current) => ({
      ...current,
      choices: current.choices.map((choice) => choice.id === choiceId ? { ...choice, ...patch } : choice),
    }));

  /** Rows are appended after the last row, columns after the last column, so the two axes stay
   *  contiguous in the stored list and a column's ordinal keeps matching its answer-key number. */
  const addGridEntry = (axis: GridAxis) =>
    setQuestion((current) => {
      const entry: DraftChoice = {
        ...blankChoice(false),
        axis,
        optionScore: axis === "ROW" ? "1" : "0",
        correctColumns: null,
      };
      const lastOfAxis = current.choices.map((choice) => choice.axis).lastIndexOf(axis);
      const at = lastOfAxis === -1 ? current.choices.length : lastOfAxis + 1;
      return { ...current, choices: [...current.choices.slice(0, at), entry, ...current.choices.slice(at)] };
    });

  const addChoice = () =>
    setQuestion((current) => ({ ...current, choices: [...current.choices, blankChoice()] }));

  const removeChoice = (choiceId: string) =>
    setQuestion((current) => {
      if (current.choices.length <= MIN_CHOICES) return current;
      const choices = current.choices.filter((choice) => choice.id !== choiceId);
      // Dropping the row that held the correct answer would leave the question with none, which
      // the save validation rejects - hand it to the first remaining option instead.
      if (!choices.some((choice) => choice.isCorrect)) {
        choices[0] = { ...choices[0], isCorrect: true };
      }
      return { ...current, choices };
    });

  const saveQuestion = () => {
    // A self-scoring type (a grid) owns its score, so the typed value is ignored from here on -
    // including by the check below, or a grid whose rows total 3 could still be rejected as "0"
    // because the read-only field never wrote back to the draft.
    const derived = derivedQuestionScore(question);
    const effectiveScore = derived ?? question.questionScore;
    if (!question.questionText.trim() || Number(effectiveScore) <= 0) {
      setFormErrors((current) => ({ ...current, question: "Enter a question and a positive score before adding it." }));
      setFeedback({ tone: "error", message: "Question text and a positive score are required." });
      return;
    }
    const choiceQuestion = isChoiceType(question.questionType);
    if (choiceQuestion && question.choices.length < MIN_CHOICES) {
      setFormErrors((current) => ({ ...current, question: `Choice questions need at least ${MIN_CHOICES} options.` }));
      setFeedback({ tone: "error", message: `Add at least ${MIN_CHOICES} answer options.` });
      return;
    }
    if (choiceQuestion && question.choices.some((choice) => !choice.choiceText.trim())) {
      setFormErrors((current) => ({ ...current, question: "Every answer option needs text - remove the ones you do not need." }));
      setFeedback({ tone: "error", message: "Fill in every answer option, or remove the empty ones." });
      return;
    }
    // These mirror app/lib/assessments/validation.ts so the editor rejects what the server would.
    const correctCount = question.choices.filter((choice) => choice.isCorrect).length;
    if (question.questionType === "TRUE_FALSE" && question.choices.length !== 2) {
      setFormErrors((current) => ({ ...current, question: "True/False questions have exactly two options." }));
      setFeedback({ tone: "error", message: "True/False questions have exactly two options." });
      return;
    }
    if ((question.questionType === "SINGLE_CHOICE" || question.questionType === "TRUE_FALSE") && correctCount !== 1) {
      setFormErrors((current) => ({ ...current, question: "Select exactly one correct answer." }));
      setFeedback({ tone: "error", message: "Select exactly one correct answer." });
      return;
    }
    if (question.questionType === "MULTIPLE_CHOICE" && correctCount < 2) {
      setFormErrors((current) => ({ ...current, question: "Multiple choice questions need at least two correct answers." }));
      setFeedback({ tone: "error", message: "Mark at least two correct answers, or switch the type to Single Choice." });
      return;
    }
    const next = { ...question, questionText: question.questionText.trim(), questionScore: effectiveScore };
    setQuestions((current) => editingQuestionId
      ? current.map((item) => item.id === editingQuestionId ? next : item)
      : [...current, next]);
    setQuestion(blankQuestion());
    setEditingQuestionId("");
    setFormErrors((current) => ({ ...current, question: undefined, questions: undefined }));
    setFeedback({ tone: "success", message: editingQuestionId ? "Question updated." : "Question added." });
  };

  /** Copies a question in place, right below the original - writing several near-identical
   *  questions is the common case when building a test, and retyping every option was the only
   *  way to do it before. Fresh ids so the copy edits independently of its source. */
  /**
   * Every list mutation goes through here. Moving, adding or deleting a section renumbers every
   * section after it, so a branch target left alone would silently start pointing at a different
   * section - worse than the reorder itself, because nothing tells the author it happened.
   */
  const reorderQuestions = (change: (current: DraftQuestion[]) => DraftQuestion[]) =>
    setQuestions((current) => {
      const after = change(current);
      const rows = (list: DraftQuestion[]) => list.map((item) => ({ id: item.id, questionType: item.questionType }));
      const map = remapSectionOrdinals(rows(current), rows(after));
      const move = (target: number | null) => (target === null ? null : map.get(target) ?? null);
      return after.map((item) => ({
        ...item,
        nextSection: move(item.nextSection),
        choices: item.choices.map((choice) => ({ ...choice, nextSection: move(choice.nextSection) })),
      }));
    });

  /**
   * The toolbar inserts below the focused card, the way Google Forms does. A question opens the
   * builder above; a section or text block is complete as soon as it exists.
   */
  const handleToolbarAdd = (kind: FormItemKind) => {
    if (kind === "QUESTION") {
      setQuestion(blankQuestion());
      setEditingQuestionId("");
      scrollToQuestionBuilder();
      return;
    }
    const block = blankBlock(kind);
    reorderQuestions((current) => {
      const at = current.findIndex((item) => item.id === focusedId);
      return at === -1 ? [...current, block] : [...current.slice(0, at + 1), block, ...current.slice(at + 1)];
    });
    setFocusedId(block.id);
  };

  const duplicateQuestion = (index: number) =>
    reorderQuestions((current) => {
      const source = current[index];
      if (!source) return current;
      const copy: DraftQuestion = {
        ...source,
        id: key(),
        choices: source.choices.map((choice) => ({ ...choice, id: key() })),
      };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });

  // Native HTML5 drag and drop - no library. The Move Up/Down buttons stay: dragging is
  // mouse-only, so they remain the keyboard path.
  //
  // Reorders live as the dragged card crosses another one (on dragOver), not just on drop, so the
  // list itself previews the landing position instead of leaving the user to guess. A ref backs
  // the index because dragOver can fire faster than React re-renders; reading state here would let
  // two events in the same tick both see the pre-swap index and double-swap.
  const [dragIndex, setDragIndexState] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const setDragIndex = (value: number | null) => {
    dragIndexRef.current = value;
    setDragIndexState(value);
  };

  const dragQuestionOver = (targetIndex: number) => {
    const from = dragIndexRef.current;
    if (from === null || from === targetIndex) return;
    reorderQuestions((current) => {
      const reordered = [...current];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered;
    });
    setDragIndex(targetIndex);
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    reorderQuestions((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
  };

  const payload = (): AssessmentWriteInput => ({
    scope: isCenter ? draft.scope : "COMPANY",
    companyId: isCenter ? (draft.scope === "COMPANY" ? draft.companyId : null) : user?.companyId ?? null,
    seriesCode: draft.seriesCode,
    seriesName: draft.seriesName,
    purpose: draft.purpose,
    versionNote: draft.versionNote.trim() || null,
    instructions: draft.instructions.trim() || null,
    passingScorePercent: draft.passingScorePercent,
    timeLimitMinutes: draft.timeLimitMinutes ? Number(draft.timeLimitMinutes) : null,
    status: draft.status,
    questions: questions.map(({ questionText, questionType, questionScore, questionDescription, nextSection, isRequired, choices }) => ({
      questionText,
      // The draft already holds the stored value - no lossy round trip through a UI-only label.
      questionType,
      // A block carries no marks; the DB asserts the same thing via
      // CK_RC2_assessment_question_block_score_zero.
      // A grid's score is the sum of its rows', kept in sync here so every server-side denominator
      // can go on summing question_score per question without knowing grids exist.
      questionScore: isFormBlockType(questionType)
        ? "0"
        : isGridType(questionType)
          ? gridTotalScore(choices.filter((choice) => choice.axis === "ROW").map((row) => row.optionScore))
          : questionScore,
      questionDescription: isFormBlockType(questionType) ? (questionDescription?.trim() || null) : null,
      nextSection: questionType === "SECTION_BREAK" ? nextSection : null,
      isRequired: isFormBlockType(questionType) ? false : isRequired,
      // Grids keep their choices too - rows and columns both live in this list.
      choices: isChoiceType(questionType) || isGridType(questionType)
        ? choices.map(({ choiceText, isCorrect, optionScore, nextSection: choiceTarget, axis, correctColumns }) => ({
            choiceText,
            isCorrect,
            // A grid ROW keeps its own point value; every other choice mirrors the question score.
            optionScore: isGridType(questionType) ? optionScore : isCorrect ? questionScore : "0",
            nextSection: questionType === "SINGLE_CHOICE" ? choiceTarget : null,
            axis,
            correctColumns,
          }))
        : [],
    })),
  });

  const save = async () => {
    const errors: FormErrors = {};
    if (mode !== "new" && !draft.seriesCode.trim()) errors.seriesCode = "Assessment code is required.";
    if (!draft.seriesName.trim()) errors.seriesName = "Assessment name is required.";
    if (isCenter && draft.scope === "COMPANY" && !draft.companyId) errors.companyId = "Select a company.";
    const passingScore = Number(draft.passingScorePercent);
    if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) errors.passingScorePercent = "Pass score must be from 0 to 100.";
    if (draft.timeLimitMinutes && (!Number.isInteger(Number(draft.timeLimitMinutes)) || Number(draft.timeLimitMinutes) <= 0)) errors.timeLimitMinutes = "Time limit must be a positive whole number.";
    // Counting rows would let an assessment of nothing but sections and text blocks pass here and
    // then be rejected by the server, which states the same rule.
    const answerable = questions.filter((row) => !isFormBlockType(row.questionType));
    if (draft.status === "ACTIVE" && !answerable.length) errors.questions = "Add at least one question before publishing.";
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      setFeedback({ tone: "error", message: "Please correct the highlighted fields." });
      return;
    }
    if (draft.status === "ACTIVE" && !(await confirm({ message: { th: "ยืนยันที่จะเผยแพร่แบบทดสอบนี้หรือไม่? เมื่อเผยแพร่แล้วจะถูกเลือกใช้เป็น Pre/Post Test ในหลักสูตรได้ทันที", en: "Confirm publishing this assessment? It becomes selectable on courses immediately." } }))) {
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const saved = mode === "edit" && selected
        ? (await updateAssessment(selected.assessmentId, payload())).assessment
        : mode === "version" && selected
          ? (await createAssessmentVersion(selected.assessmentId, { ...payload(), status: "DRAFT" })).assessment
          : (await createAssessment(payload())).assessment;
      const successMessage = mode === "edit"
        ? "Assessment updated."
        : mode === "version"
          ? "New assessment version created."
          : "Assessment created.";
      setItems((current) => mode === "edit"
        ? current.map((item) => item.assessmentId === saved.assessmentId ? saved : item)
        : [saved, ...current.filter((item) => item.assessmentSeriesId !== saved.assessmentSeriesId)]);
      setSelectedId(saved.assessmentId);
      setOpenDetailId("");
      closeEditor();
      setFeedback({ tone: "success", message: successMessage });
      void listAssessments().then((result) => setItems(result.items)).catch(() => {
        setFeedback({ tone: "info", message: `${successMessage} The list could not be refreshed; press Refresh to try again.` });
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to save assessment" });
    } finally {
      setBusy(false);
    }
  };

  const removeTargetItem = async (targetItem: AssessmentRecord) => {
    if (!targetItem.canModify) return;
    if (!(await confirm({ message: { th: `ยืนยันที่จะลบแบบทดสอบ "${targetItem.seriesName}" หรือไม่?`, en: `Confirm deleting assessment "${targetItem.seriesName}"?` }, danger: true }))) return;
    setBusy(true);
    try {
      await deleteAssessment(targetItem.assessmentId);
      if (selectedId === targetItem.assessmentId) setSelectedId("");
      if (openDetailId === targetItem.assessmentId) setOpenDetailId("");
      closeEditor();
      await load();
      setFeedback({ tone: "success", message: "Assessment deleted." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete assessment" });
    } finally {
      setBusy(false);
    }
  };

  const handlePublishItem = async (item: AssessmentRecord) => {
    if (!item.canModify) return;
    if (!item.questions.length) {
      setFeedback({ tone: "error", message: "Add at least one question before publishing." });
      return;
    }
    if (
      !(await confirm({
        message: {
          th: `ยืนยันที่จะเผยแพร่แบบทดสอบ "${item.seriesName}" หรือไม่? เมื่อเผยแพร่แล้วจะถูกเลือกใช้เป็น Pre/Post Test ในหลักสูตรได้ทันที`,
          en: `Confirm publishing assessment "${item.seriesName}"? It becomes selectable on courses immediately.`,
        },
      }))
    )
      return;
    setBusy(true);
    setFeedback(null);
    try {
      const publishInput: AssessmentWriteInput = {
        scope: item.scope,
        companyId: item.companyId,
        seriesCode: item.seriesCode,
        seriesName: item.seriesName,
        purpose: item.purpose,
        versionNote: item.versionNote,
        instructions: item.instructions,
        passingScorePercent: String(item.passingScorePercent),
        timeLimitMinutes: item.timeLimitMinutes,
        status: "ACTIVE",
        // Status-only publish: every question is echoed back exactly as stored, blocks and branch
        // targets included, so nothing is rewritten on the way through.
        questions: item.questions.map((q) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          questionScore: String(q.questionScore),
          questionDescription: q.questionDescription,
          nextSection: q.nextSection,
          isRequired: q.isRequired,
          choices: q.choices.map((c) => ({
            choiceText: c.choiceText,
            isCorrect: c.isCorrect,
            optionScore: String(c.optionScore),
            nextSection: c.nextSection,
            axis: c.axis,
            correctColumns: c.correctColumns,
          })),
        })),
      };
      const updated = (await updateAssessment(item.assessmentId, publishInput)).assessment;
      setItems((current) => current.map((i) => (i.assessmentId === updated.assessmentId ? updated : i)));
      setFeedback({ tone: "success", message: `Published assessment "${item.seriesName}".` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to publish assessment" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (selected) await removeTargetItem(selected);
  };

  /** A greyed-out button with no explanation reads as a broken screen. These are the reasons the
   *  toolbar actually disables one. */
  const disabledReason = (action: "edit" | "version") => {
    if (!selected) return "เลือกแบบทดสอบจากตารางด้านล่างก่อน";
    if (action === "version") {
      if (selected.status === "DRAFT") return "แบบทดสอบยังเป็นฉบับร่าง แก้ไขฉบับนี้ได้เลย ไม่ต้องสร้างเวอร์ชันใหม่";
      return selected.canCreateVersion ? "" : "แบบทดสอบนี้อยู่นอกขอบเขตของคุณ";
    }
    if (selected.isUsed) return "แบบทดสอบนี้ถูกผูกกับหลักสูตร/แผนอบรม หรือมีพนักงานทำไปแล้ว แก้ไขและลบไม่ได้ — ปิดใช้งานได้ หรือสร้างเวอร์ชันใหม่";
    return selected.canModify ? "" : "แบบทดสอบนี้อยู่นอกขอบเขตของคุณ หรือไม่ใช่เวอร์ชันล่าสุด";
  };

  /** Retiring or re-activating. Allowed even on an assessment already in use - it changes no
   *  content, and a form published by mistake must not be permanent. */
  const changeStatus = async (item: AssessmentRecord, status: AssessmentStatus) => {
    const retiring = status === "INACTIVE";
    if (!(await confirm({
      message: {
        th: retiring
          ? `ยืนยันที่จะปิดใช้งานแบบทดสอบ "${item.seriesName}" หรือไม่? หลักสูตรจะเลือกใช้ชุดนี้ใหม่ไม่ได้ ผลที่พนักงานทำไปแล้วยังอยู่ครบ`
          : `ยืนยันที่จะเปิดใช้งานแบบทดสอบ "${item.seriesName}" อีกครั้งหรือไม่?`,
        en: retiring ? `Retire assessment "${item.seriesName}"?` : `Re-activate assessment "${item.seriesName}"?`,
      },
      danger: retiring,
    }))) return;
    setBusy(true);
    try {
      const saved = (await setAssessmentStatus(item.assessmentId, status)).assessment;
      setItems((current) => current.map((row) => row.assessmentId === saved.assessmentId ? saved : row));
      setFeedback({ tone: "success", message: retiring ? "ปิดใช้งานแบบทดสอบแล้ว" : "เปิดใช้งานแบบทดสอบแล้ว" });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  /** Fills the new-assessment form from an existing one, the way Course Master pulls details from a
   *  Center course template. The code stays the freshly generated one and nothing is written until
   *  Save, so this can never touch the assessment it copied from. */
  const applyTemplate = (assessmentId: string) => {
    setTemplateSourceId(assessmentId);
    if (!assessmentId) return;
    const source = items.find((item) => item.assessmentId === assessmentId);
    if (!source) return;
    setDraft((current) => ({
      ...current,
      purpose: source.purpose,
      seriesCode: generateNextAssessmentCode(source.purpose, current.scope, current.companyId, user?.companyCode, companies, items),
      seriesName: `${source.seriesName} (Copy)`,
      instructions: source.instructions ?? "",
      passingScorePercent: source.passingScorePercent,
      timeLimitMinutes: source.timeLimitMinutes?.toString() ?? "",
    }));
    setQuestions(toDraftQuestions(source).map((question) => ({
      ...question,
      id: key(),
      choices: question.choices.map((choice) => ({ ...choice, id: key() })),
    })));
    setQuestion(blankQuestion());
    setEditingQuestionId("");
    setFormErrors({});
    setFeedback({ tone: "success", message: `ดึงคำถาม ${source.questions.length} ข้อจาก "${source.seriesName}" มาแล้ว แก้ไขได้ตามต้องการ` });
  };

  const exportCsv = () => {
    if (!visible.length) return setFeedback({ tone: "error", message: "There are no assessments to export." });
    const url = URL.createObjectURL(new Blob(["\uFEFF", createAssessmentCsv(visible)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `assessment-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const renderEditor = () => (
    <section className={styles.editorPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>
            {mode === "new" ? "New assessment" : mode === "version" ? "New version" : "Edit assessment"}
          </p>
          <h3>{mode === "new" ? "สร้างแบบทดสอบใหม่ (Create Assessment)" : selected?.seriesName}</h3>
        </div>
        <button className={styles.closeButton} type="button" onClick={closeEditor}>Close</button>
      </div>

      {mode === "new" ? (
        <div className={styles.templatePicker}>
          <span className={styles.templatePickerLabel}>
            📋 สร้างจากแบบทดสอบที่มีอยู่ (Use an existing assessment as a template)
          </span>
          <SearchableSelect
            value={templateSourceId}
            onChange={applyTemplate}
            placeholder="🔍 ค้นหารหัสหรือชื่อแบบทดสอบ..."
            options={[
              { value: "", label: "-- ไม่ใช้แม่แบบ (เริ่มจากหน้าว่าง) --" },
              ...items.map((item) => ({
                value: item.assessmentId,
                label: `[${item.seriesCode}] ${item.seriesName}`,
                secondaryLabel: `${item.companyCode ?? "ส่วนกลาง"} · ${item.purpose} · ${item.questions.length} ข้อ`,
              })),
            ]}
          />
          <small className={styles.templatePickerHint}>
            * ดึงคำถาม ตัวเลือก เฉลย คะแนน คำชี้แจง เกณฑ์ผ่าน และเวลาจำกัดมาให้ทั้งหมด
            รหัสแบบทดสอบจะสร้างใหม่เสมอ และแบบทดสอบต้นทางไม่ถูกแตะต้อง
          </small>
        </div>
      ) : null}

      <div className={styles.formGrid}>
        {isCenter ? (
          <label>
            <span>Scope <RequiredIndicator isFilled={Boolean(draft.scope)} /></span>
            <select
              disabled={mode === "version"}
              value={draft.scope}
              onChange={(event) => updateDraftField("scope", event.target.value as AssessmentScope)}
            >
              <option value="CENTRAL">Central (ส่วนกลาง)</option>
              <option value="COMPANY">Company (โรงงาน)</option>
            </select>
          </label>
        ) : null}

        {isCenter && draft.scope === "COMPANY" ? (
          <label>
            <span>Company <RequiredIndicator isFilled={Boolean(draft.companyId)} /></span>
            <select
              aria-invalid={Boolean(formErrors.companyId)}
              className={formErrors.companyId ? styles.inputError : undefined}
              disabled={mode === "version"}
              value={draft.companyId}
              onChange={(event) => updateDraftField("companyId", event.target.value)}
            >
              <option value="">-- เลือกโรงงาน (Select company) --</option>
              {companies.map((company) => (
                <option key={company.companyId} value={company.companyId}>
                  {company.companyCode} — {company.companyNameTh}
                </option>
              ))}
            </select>
            {formErrors.companyId ? <small>{formErrors.companyId}</small> : null}
          </label>
        ) : null}

        {/* Purpose and code are one fact, not two: the code carries the purpose tag and the server
            refuses to change either after the assessment exists. Only a brand-new assessment, whose
            code is still being generated as you pick, may set them. */}
        <label>
          <span>Purpose (วัตถุประสงค์) <RequiredIndicator isFilled={Boolean(draft.purpose)} /></span>
          <select
            disabled={mode !== "new"}
            value={draft.purpose}
            onChange={(event) => updateDraftField("purpose", event.target.value as AssessmentPurpose)}
          >
            <option value="PRE_TEST">PRE TEST (ทดสอบก่อนเรียน)</option>
            <option value="POST_TEST">POST TEST (ทดสอบหลังเรียน)</option>
            <option value="GENERAL">GENERAL (แบบทดสอบทั่วไป)</option>
          </select>
          {mode !== "new" ? <small>วัตถุประสงค์เป็นส่วนหนึ่งของรหัสแบบทดสอบ แก้ไม่ได้ ต้องสร้างแบบทดสอบใหม่</small> : null}
        </label>

        <label>
          <span>Assessment Code <RequiredIndicator isFilled={Boolean(draft.seriesCode.trim())} /></span>
          <input
            aria-invalid={Boolean(formErrors.seriesCode)}
            className={formErrors.seriesCode ? styles.inputError : undefined}
            disabled={mode !== "new"}
            maxLength={50}
            value={draft.seriesCode}
            onChange={(event) => updateDraftField("seriesCode", event.target.value.toUpperCase())}
            placeholder="Auto-generated e.g. PRE-000001"
          />
          {formErrors.seriesCode ? <small>{formErrors.seriesCode}</small> : null}
        </label>

        <label className={styles.fullWidth}>
          <span>Series Name (ชื่อแบบทดสอบ) <RequiredIndicator isFilled={Boolean(draft.seriesName.trim())} /></span>
          <input
            aria-invalid={Boolean(formErrors.seriesName)}
            className={formErrors.seriesName ? styles.inputError : undefined}
            disabled={mode === "version"}
            maxLength={255}
            placeholder="เช่น แบบทดสอบวัดความรู้เรื่องการคลัง..."
            value={draft.seriesName}
            onChange={(event) => updateDraftField("seriesName", event.target.value)}
          />
          {formErrors.seriesName ? <small>{formErrors.seriesName}</small> : null}
        </label>

        <label>
          <span>Passing Score (%) (เกณฑ์ผ่าน) <RequiredIndicator isFilled={Boolean(draft.passingScorePercent.trim())} /></span>
          <input
            aria-invalid={Boolean(formErrors.passingScorePercent)}
            className={formErrors.passingScorePercent ? styles.inputError : undefined}
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={draft.passingScorePercent}
            onChange={(event) => updateDraftField("passingScorePercent", event.target.value)}
          />
          {formErrors.passingScorePercent ? <small>{formErrors.passingScorePercent}</small> : null}
        </label>

        <label>
          <span>Time Limit (minutes) (เวลาทำแบบทดสอบ)</span>
          <input
            aria-invalid={Boolean(formErrors.timeLimitMinutes)}
            className={formErrors.timeLimitMinutes ? styles.inputError : undefined}
            type="number"
            min="1"
            value={draft.timeLimitMinutes}
            onChange={(event) => updateDraftField("timeLimitMinutes", event.target.value)}
            placeholder="ระบุเป็นนาที (ไม่ระบุ = ไม่จำกัดเวลา)"
          />
          {formErrors.timeLimitMinutes ? <small>{formErrors.timeLimitMinutes}</small> : null}
        </label>

        <label className={styles.fullWidth}>
          <span>Version Note (บันทึกเวอร์ชัน)</span>
          <input
            maxLength={500}
            value={draft.versionNote}
            onChange={(event) => updateDraftField("versionNote", event.target.value)}
            placeholder="ระบุคำอธิบายการแก้ไขหรือสร้างเวอร์ชันใหม่ (Optional)"
          />
        </label>

        <label className={styles.fullWidth}>
          <span>Instructions (คำชี้แจงสำหรับผู้ทำแบบทดสอบ)</span>
          <textarea
            value={draft.instructions}
            onChange={(event) => updateDraftField("instructions", event.target.value)}
            placeholder="คำแนะนำหรือข้อตกลงในการทำแบบทดสอบ..."
          />
        </label>
      </div>

      <div className={styles.questionBuilder} id={QUESTION_BUILDER_ID}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Question Builder</p>
            <h3>{editingQuestionId ? "แก้ไขข้อสอบ (Edit Question)" : "เพิ่มคำถามข้อสอบ (Add Question)"}</h3>
          </div>
          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#10b981" }}>
            {questions.length} ข้อ • คะแนนรวม {questions.reduce((acc, q) => acc + (Number(q.questionScore) || 0), 0)} คะแนน
          </span>
        </div>

        <div className={styles.questionGrid}>
          <label className={styles.fullWidth}>
            <span>โจทย์คำถาม (Question) <RequiredIndicator isFilled={Boolean(question.questionText.trim())} /></span>
            <textarea
              aria-invalid={Boolean(formErrors.question)}
              className={formErrors.question ? styles.inputError : undefined}
              value={question.questionText}
              placeholder="พิมพ์โจทย์คำถามที่ต้องการทดสอบ..."
              onChange={(event) => {
                setQuestion({ ...question, questionText: event.target.value });
                setFormErrors((current) => ({ ...current, question: undefined }));
              }}
            />
          </label>

          <label>
            <span>ประเภทคำถาม (Type)</span>
            <select
              value={question.questionType}
              onChange={(event) => setQuestionType(event.target.value as AssessmentQuestionType)}
            >
              {/* Driven by ASSESSMENT_QUESTION_TYPES rather than a hardcoded list: these four were
                  written out by hand, so the two grid types were added to the shared const, the
                  validator and the runner and still never appeared here. */}
              {ASSESSMENT_QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>{ASSESSMENT_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </label>

          <label>
            <span>คะแนนข้อนี้ (Score) <RequiredIndicator isFilled={Boolean(Number(derivedQuestionScore(question) ?? question.questionScore) > 0)} /></span>
            {/* A grid scores per row, so its total is arithmetic, not a decision. Making the field
                read-only and filling it live removes the step where the author had to add the rows
                up and retype the answer - and the server rejects a mismatch, so a typo there was a
                failed save with nothing obviously wrong on screen. */}
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={derivedQuestionScore(question) ?? question.questionScore}
              readOnly={derivedQuestionScore(question) !== null}
              aria-readonly={derivedQuestionScore(question) !== null}
              data-derived={derivedQuestionScore(question) !== null}
              title={derivedQuestionScore(question) !== null
                ? t("คิดจากผลรวมคะแนนของทุกแถว แก้ที่แต่ละแถวด้านล่าง", "Summed from the row scores - edit them below")
                : undefined}
              onChange={(event) => {
                if (derivedQuestionScore(question) !== null) return;
                setQuestion({ ...question, questionScore: event.target.value });
              }}
            />
            {/* A span, not a small: `.questionGrid label small` is the error-text style (accent
                colour) at a specificity this class cannot outrank, so a hint written as a small
                element would read as a validation error. */}
            {derivedQuestionScore(question) !== null ? (
              <span className={styles.derivedScoreHint}>
                {t("คิดอัตโนมัติจากผลรวมคะแนนของทุกแถว", "Calculated from the sum of the row scores")}
              </span>
            ) : null}
          </label>

          <label>
            <span>บังคับตอบ (Required)</span>
            <select
              value={question.isRequired ? "YES" : "NO"}
              onChange={(event) => setQuestion({ ...question, isRequired: event.target.value === "YES" })}
            >
              <option value="YES">Yes (ต้องตอบ)</option>
              <option value="NO">No (ไม่บังคับ)</option>
            </select>
          </label>

          {isChoiceType(question.questionType) ? (
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginTop: "8px" }}>
              {question.choices.map((choice, index) => {
                const letter = String.fromCharCode(65 + index);
                return (
                  <div
                    key={choice.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: choice.isCorrect ? "1.5px solid #10b981" : "1px solid var(--ui-30-border)",
                      background: choice.isCorrect ? "rgba(16, 185, 129, 0.08)" : "var(--ui-60-surface-soft)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.84rem", color: choice.isCorrect ? "#10b981" : "var(--ui-30-ink)" }}>
                        Option {letter} {choice.isCorrect ? "(Correct Answer)" : ""}
                      </span>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 }}>
                          <input
                            type={question.questionType === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                            name={`correct-${question.id}`}
                            checked={choice.isCorrect}
                            onChange={() => toggleCorrect(index)}
                          />
                          <span style={{ color: choice.isCorrect ? "#10b981" : "var(--ui-30-muted)" }}>Correct</span>
                        </label>
                        <button
                          type="button"
                          title="ลบตัวเลือกนี้ / Remove this option"
                          disabled={question.choices.length <= MIN_CHOICES || question.questionType === "TRUE_FALSE"}
                          onClick={() => removeChoice(choice.id)}
                          style={{
                            appearance: "none",
                            border: "none",
                            background: "transparent",
                            color: question.choices.length <= MIN_CHOICES || question.questionType === "TRUE_FALSE" ? "var(--ui-30-muted)" : "#dc2626",
                            cursor: question.choices.length <= MIN_CHOICES || question.questionType === "TRUE_FALSE" ? "not-allowed" : "pointer",
                            fontSize: "0.9rem",
                            fontWeight: 900,
                            lineHeight: 1,
                            padding: "2px 4px",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <input
                      value={choice.choiceText}
                      placeholder={`กรอกตัวเลือก ${letter}... / Enter option ${letter}...`}
                      onChange={(event) =>
                        setQuestion({
                          ...question,
                          choices: question.choices.map((item) =>
                            item.id === choice.id ? { ...item, choiceText: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </div>
                );
              })}
              {question.questionType === "TRUE_FALSE" ? null : (
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={addChoice}
                  style={{ gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  + เพิ่มตัวเลือก / Add option
                </button>
              )}
            </div>
          ) : null}

          {/* Grid editor. Rows carry the answer key and the points, because Google Forms scores a
              grid per row; columns are just labels. Both axes live in the same choices list. */}
          {isGridType(question.questionType) ? (
            <div className={styles.gridEditor}>
              {(["ROW", "COLUMN"] as const).map((axis) => {
                const entries = question.choices.filter((choice) => choice.axis === axis);
                const columns = question.choices.filter((choice) => choice.axis === "COLUMN");
                const minimum = axis === "ROW" ? MIN_GRID_ROWS : MIN_GRID_COLUMNS;
                return (
                  <div key={axis}>
                    <span className={styles.gridAxisLabel}>
                      {axis === "ROW" ? t("แถว (Rows)", "Rows") : t("คอลัมน์ (Columns)", "Columns")}
                    </span>
                    {entries.map((choice, index) => (
                      <span className={styles.gridAxisRow} data-axis={axis} key={choice.id}>
                        <input
                          value={choice.choiceText}
                          placeholder={axis === "ROW" ? t(`แถวที่ ${index + 1}`, `Row ${index + 1}`) : t(`คอลัมน์ที่ ${index + 1}`, `Column ${index + 1}`)}
                          onChange={(event) => updateGridChoice(choice.id, { choiceText: event.target.value })}
                        />
                        {axis === "ROW" ? (
                          <>
                            <select
                              className={styles.gridKeySelect}
                              title={t("คอลัมน์ที่ถูกของแถวนี้", "Correct column for this row")}
                              multiple={question.questionType === "CHECKBOX_GRID"}
                              value={question.questionType === "CHECKBOX_GRID"
                                ? parseCorrectColumns(choice.correctColumns).map(String)
                                : (parseCorrectColumns(choice.correctColumns)[0]?.toString() ?? "")}
                              onChange={(event) => {
                                const picked = question.questionType === "CHECKBOX_GRID"
                                  ? [...event.target.selectedOptions].map((option) => Number(option.value))
                                  : event.target.value ? [Number(event.target.value)] : [];
                                updateGridChoice(choice.id, { correctColumns: formatCorrectColumns(picked) });
                              }}
                            >
                              {question.questionType === "CHECKBOX_GRID"
                                ? null
                                : <option value="">{t("ไม่มีเฉลย", "No answer key")}</option>}
                              {columns.map((column, columnIndex) => (
                                <option key={column.id} value={columnIndex + 1}>
                                  {column.choiceText || t(`คอลัมน์ที่ ${columnIndex + 1}`, `Column ${columnIndex + 1}`)}
                                </option>
                              ))}
                            </select>
                            <input
                              className={styles.gridScoreInput}
                              type="number"
                              min="0"
                              step="0.5"
                              value={choice.optionScore}
                              title={t("คะแนนของแถวนี้", "Points for this row")}
                              onChange={(event) => updateGridChoice(choice.id, { optionScore: event.target.value })}
                            />
                          </>
                        ) : null}
                        <button
                          type="button"
                          className={styles.gridAxisRemove}
                          title={t("ลบรายการนี้", "Remove this entry")}
                          disabled={entries.length <= minimum}
                          onClick={() => setQuestion((current) => ({
                            ...current,
                            choices: current.choices.filter((candidate) => candidate.id !== choice.id),
                          }))}
                        >✕</button>
                      </span>
                    ))}
                    <button className={styles.secondaryButton} type="button" onClick={() => addGridEntry(axis)}>
                      {axis === "ROW" ? t("+ เพิ่มแถว", "+ Add row") : t("+ เพิ่มคอลัมน์", "+ Add column")}
                    </button>
                  </div>
                );
              })}
              <p className={styles.helperTextGrid}>
                {t(
                  `คะแนนรวมของข้อนี้ = ผลรวมคะแนนทุกแถว = ${gridTotalScore(question.choices.filter((c) => c.axis === "ROW").map((c) => c.optionScore))}`,
                  `This question scores the sum of its rows: ${gridTotalScore(question.choices.filter((c) => c.axis === "ROW").map((c) => c.optionScore))}`,
                )}
              </p>
            </div>
          ) : null}
        </div>

        {formErrors.question ? <p className={styles.validationMessage} role="alert">{formErrors.question}</p> : null}

        <div className={styles.formActions}>
          <button className={styles.secondaryButton} type="button" onClick={saveQuestion}>
            {editingQuestionId ? "Update Question" : "Add Question"}
          </button>
          {editingQuestionId ? (
            <button
              className={styles.closeButton}
              type="button"
              onClick={() => {
                setQuestion(blankQuestion());
                setEditingQuestionId("");
                setFormErrors((current) => ({ ...current, question: undefined }));
              }}
            >
              Cancel Edit
            </button>
          ) : null}
          <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void save()}>
            Save Assessment
          </button>
        </div>
        {formErrors.questions ? <p className={styles.validationMessage} role="alert">{formErrors.questions}</p> : null}
      </div>

      <div className={styles.previewPanel} id={LEARNER_PREVIEW_ID}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>
              {previewAsLearner ? "Try it as a learner" : `Question List (${questions.length} ข้อ)`}
            </p>
            <h3>{previewAsLearner ? t("ทดลองตอบเหมือนที่ผู้เข้าอบรมจะเห็น", "Try it the way a trainee will see it") : "รายการคำถามในชุดแบบทดสอบนี้"}</h3>
          </div>
          <div className={styles.previewToggle}>
            <button
              type="button"
              className={previewAsLearner ? styles.secondaryButton : styles.activePreviewButton}
              onClick={() => setPreviewAsLearner(false)}
            >
              {t("✎ มุมมองผู้จัดทำ", "✎ Author view")}
            </button>
            <button
              type="button"
              className={previewAsLearner ? styles.activePreviewButton : styles.secondaryButton}
              onClick={() => setPreviewAsLearner(true)}
            >
              {t("👁 มุมมองผู้เรียน", "👁 Learner view")}
            </button>
          </div>
        </div>

        {/* Mirrors TrainingFormRunner deliberately: same order number, same required asterisk, same
            control per question type, and no correct answers or per-question scores - the runner
            shows the learner none of those. A preview that flatters the form is worse than none. */}
        {previewAsLearner ? (
          questions.length ? (
            <FormPreviewRunner
              title={draft.seriesName.trim() || "แบบทดสอบที่ยังไม่มีชื่อ"}
              instructions={draft.instructions}
              meta={[
                draft.timeLimitMinutes.trim() ? `⏱ ${draft.timeLimitMinutes} นาที` : null,
                `เกณฑ์ผ่าน ${draft.passingScorePercent || 0}%`,
              ].filter(Boolean).join(" · ")}
              items={toPreviewItems(questions)}
            />
          ) : (
            <div className={styles.emptyState}>{t("ยังไม่มีคำถามให้แสดงตัวอย่าง", "No questions to preview yet")}</div>
          )
        ) : questions.length ? (
          <div className={styles.previewCanvas}>
          {skippedByBranch ? (
            <p className={styles.branchWarning} role="note">
              {t(
                "⚠ มีการข้ามส่วนด้วย \"ไปยังส่วนตามคำตอบ\" — คำถามในส่วนที่ถูกข้ามยังถูกนับเป็นตัวหารของคะแนนอยู่ ผู้เรียนที่เดินเส้นทางนั้นจะไม่มีทางได้คะแนนเต็ม 100%",
                "⚠ A branch skips a section. Questions in a skipped section still count toward the score denominator, so a learner on that path can never reach 100%.",
              )}
            </p>
          ) : null}
          <div className={styles.questionList}>
            {questions.map((item, index) => {
              const isBlock = isFormBlockType(item.questionType);
              // Numbering skips blocks so a section heading does not consume a question number.
              const displayNumber = questions.slice(0, index + 1).filter((row) => !isFormBlockType(row.questionType)).length;
              // Forward-only targets, matching the validation rule.
              const forwardTargets = Array.from({ length: totalSections }, (unused, offset) => offset + 1)
                .filter((target) => target > (sectionOfRow[index] ?? 1));
              return (
              <article
                key={item.id}
                draggable
                ref={cardRef(item.id)}
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  dragQuestionOver(index);
                }}
                onDrop={(event) => event.preventDefault()}
                onMouseDown={() => setFocusedId(item.id)}
                onFocusCapture={() => setFocusedId(item.id)}
                data-dragging={dragIndex === index}
                data-focused={focusedId === item.id}
                data-block={isBlock ? item.questionType : undefined}
              >
                <div className={styles.questionHeading}>
                  <strong>
                    <span className={styles.dragHandle} aria-hidden="true" title="ลากเพื่อสลับลำดับ / Drag to reorder">⠿</span>
                    {isBlock
                      ? (item.questionType === "SECTION_BREAK"
                          ? t(`ส่วนที่ ${sectionOfRow[index]}`, `Section ${sectionOfRow[index]}`)
                          : t("ข้อความ", "Text"))
                      : <>{displayNumber}. {item.questionText}</>}
                    {item.isRequired ? <em className={styles.requiredMark}> *</em> : null}
                  </strong>
                  <span>{isBlock ? displayQuestionType(item.questionType) : `${item.questionType} · ${item.questionScore} คะแนน`}</span>
                </div>
                {isBlock ? (
                  <>
                    <input
                      className={styles.blockTitleInput}
                      value={item.questionText}
                      placeholder={item.questionType === "SECTION_BREAK" ? "Section title" : "Title"}
                      onChange={(event) => setQuestions((current) => current.map((row) => row.id === item.id ? { ...row, questionText: event.target.value } : row))}
                    />
                    <textarea
                      className={styles.blockBodyInput}
                      rows={2}
                      value={item.questionDescription ?? ""}
                      placeholder="Description"
                      onChange={(event) => setQuestions((current) => current.map((row) => row.id === item.id ? { ...row, questionDescription: event.target.value } : row))}
                    />
                    {item.questionType === "SECTION_BREAK" ? (
                      <label className={styles.branchLabel}>{t("หลังส่วนนี้", "After this section")}
                        <select
                          value={item.nextSection ?? ""}
                          onChange={(event) => setQuestions((current) => current.map((row) => row.id === item.id ? { ...row, nextSection: event.target.value ? Number(event.target.value) : null } : row))}
                        >
                          <option value="">{fallThroughLabel(sectionOfRow[index] ?? 1, totalSections, language === "th")}</option>
                          <option value="0">{t("ส่งแบบฟอร์ม (จบที่นี่)", "Submit form (end here)")}</option>
                          {forwardTargets.map((target) => <option key={target} value={target}>{t(`ไปยังส่วนที่ ${target}`, `Go to section ${target}`)}</option>)}
                        </select>
                      </label>
                    ) : null}
                  </>
                ) : null}
                {isGridType(item.questionType) ? renderGridSummary(item.choices, t("คะแนน", "Points")) : null}
                {isGridType(item.questionType) ? null : item.choices.map((choice, choiceIndex) => (
                  <p key={choice.id} style={{ color: choice.isCorrect ? "var(--ui-30-primary)" : undefined, fontWeight: choice.isCorrect ? 700 : undefined }}>
                    {choice.isCorrect ? "[Correct] " : ""}{String.fromCharCode(65 + choiceIndex)}. {choice.choiceText}
                  </p>
                ))}
                {item.questionType === "SINGLE_CHOICE" && forwardTargets.length ? (
                  <div className={styles.branchRow}>
                    {item.choices.map((choice, choiceIndex) => choice.choiceText.trim() ? (
                      <label className={styles.branchLabel} key={`${item.id}-branch-${choice.id}`}>{`"${choice.choiceText}" →`}
                        <select
                          value={choice.nextSection ?? ""}
                          onChange={(event) => setQuestions((current) => current.map((row) => row.id === item.id
                            ? { ...row, choices: row.choices.map((candidate, targetIndex) => targetIndex === choiceIndex ? { ...candidate, nextSection: event.target.value ? Number(event.target.value) : null } : candidate) }
                            : row))}
                        >
                          <option value="">{fallThroughLabel(sectionOfRow[index] ?? 1, totalSections, language === "th")}</option>
                          <option value="0">{t("ส่งแบบฟอร์ม (จบที่นี่)", "Submit form (end here)")}</option>
                          {forwardTargets.map((target) => <option key={target} value={target}>{t(`ไปยังส่วนที่ ${target}`, `Go to section ${target}`)}</option>)}
                        </select>
                      </label>
                    ) : null)}
                  </div>
                ) : null}
                <div className={styles.questionActions}>
                  <button className={styles.secondaryButton} type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>
                    Move Up
                  </button>
                  <button className={styles.secondaryButton} type="button" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)}>
                    Move Down
                  </button>
                  {/* A block is edited in place above - it has nothing the question builder offers. */}
                  {isBlock ? null : (
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => {
                      setQuestion(item);
                      setEditingQuestionId(item.id);
                      setFormErrors((current) => ({ ...current, question: undefined }));
                      scrollToQuestionBuilder();
                    }}
                  >
                    Edit
                  </button>
                  )}
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => duplicateQuestion(index)}
                  >
                    Duplicate
                  </button>
                  <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={() => reorderQuestions((current) => current.filter((candidate) => candidate.id !== item.id))}
                  >
                    Delete
                  </button>
                </div>
              </article>
              );
            })}
          </div>
          <FormItemToolbar anchorTop={anchorTop} onAdd={handleToolbarAdd} />
          </div>
        ) : (
          <div className={styles.emptyState}>ยังไม่มีรายการคำถาม เพิ่มคำถามแรกด้านบนได้ทันที</div>
        )}
      </div>
    </section>
  );

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px", padding: "40px" }}>
        <TypewriterLoader label="กำลังโหลดข้อมูลแบบทดสอบ (Assessment)..." />
      </div>
    );
  }

  return <section className={styles.page} aria-label="Assessment management">
    <section className={styles.hero}><div><p className={styles.kicker}>{assessmentModule.subtitle}</p><h2>{assessmentModule.title}</h2><p>{assessmentModule.description}</p></div></section>
    <section className={styles.workspace}>
      <div className={styles.toolbar}>
        <span className={styles.listMeta}>{visible.length} / {items.length} แบบทดสอบ</span>
        <input aria-label="Search assessment" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหารหัส, ชื่อแบบทดสอบ, บริษัท, วัตถุประสงค์, สถานะ..." />
        {isCenter ? (
          <div style={{ flex: "1 1 240px", minWidth: "220px" }}>
            <SearchableSelect
              value={companyFilter}
              onChange={setCompanyFilter}
              placeholder="เลือกบริษัท / Select company"
              options={[
                { value: "", label: "ทุกบริษัท (All companies)" },
                { value: "CENTRAL", label: "ส่วนกลาง (Central)" },
                ...companies.map((company) => ({
                  value: company.companyCode,
                  label: company.companyCode,
                  secondaryLabel: company.companyNameTh,
                })),
              ]}
            />
          </div>
        ) : null}
        <button className={styles.primaryButton} type="button" disabled={busy} onClick={startNew}>+ เพิ่มแบบทดสอบ</button>
        <button className={styles.secondaryButton} type="button" disabled={busy || !selected?.canModify} onClick={startEdit} title={disabledReason("edit")}>แก้ไข</button>
        <button className={styles.secondaryButton} type="button" disabled={busy || !selected?.canCreateVersion} onClick={startVersion} title={disabledReason("version")}>สร้างเวอร์ชันใหม่</button>
        <button className={styles.dangerButton} type="button" disabled={busy || !selected?.canModify} onClick={() => void remove()} title={disabledReason("edit")}>ลบ</button>
        <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void load()}>รีเฟรช</button>
        {SHOW_CSV_EXPORT ? <button className={styles.secondaryButton} type="button" onClick={exportCsv}>ส่งออก CSV</button> : null}
      </div>
      {mode !== "idle" ? renderEditor() : null}
      {!visible.length ? (
        <div className={styles.emptyState}>{busy ? "กำลังโหลดข้อมูลแบบทดสอบ..." : "ไม่พบรายการแบบทดสอบ"}</div>
      ) : null}
      <div className={styles.companyDirectory}>
        {groupedVisible.map((group) => {
          const groupOpen = !closedGroups.includes(group.code);
          const compKey = (group.code || "").toUpperCase();
          const compClass = styles[`companyGroup_${compKey}`] || "";
          return (
          <section className={`${styles.companyGroup} ${compClass} ${groupOpen ? styles.openGroup : ""}`} key={`group-${group.code}`}>
            <button
              className={styles.companyHeader}
              type="button"
              aria-expanded={groupOpen}
              onClick={() => toggleGroup(group.code)}
            >
              <span className={styles.chevron} aria-hidden="true" />
              <span aria-hidden="true">{group.code === "CENTRAL" ? "🏢" : "🏬"}</span>
              <strong>{group.label}</strong>
              {group.isOwn ? <em className={styles.ownCompanyTag}>⭐ ของฉัน</em> : <span />}
              <small>{group.rows.length} ชุด</small>
            </button>
            {groupOpen ? (
            <div className={styles.tableWrap}>
        <table className={styles.assessmentTable}>
          <thead>
            <tr>
              <th>รหัสแบบทดสอบ</th>
              <th>ชื่อแบบทดสอบ</th>
              <th>ขอบเขต</th>
              <th>วัตถุประสงค์</th>
              <th>เวอร์ชัน</th>
              <th>เกณฑ์ผ่าน</th>
              <th>จำนวนคำถาม</th>
              <th>สถานะ</th>
              <th style={{ textAlign: "right" }}>การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
                {group.rows.map((item) => {
              const isSelected = item.assessmentId === selectedId;
              const isOpen = item.assessmentId === openDetailId;
              const statusClass =
                item.status === "ACTIVE"
                  ? styles.statusPublished
                  : item.status === "DRAFT"
                    ? styles.statusDraft
                    : styles.statusInactive;
              return (
                <Fragment key={item.assessmentId}>
                  <tr
                    aria-selected={isSelected}
                    tabIndex={0}
                    className={`${styles.selectableRow} ${isSelected ? styles.selectedRow : ""}`}
                    onClick={() => {
                      setSelectedId(isSelected ? "" : item.assessmentId);
                      setOpenDetailId("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(isSelected ? "" : item.assessmentId);
                        setOpenDetailId("");
                      }
                    }}
                  >
                    <td>{item.seriesCode}</td>
                    <td>{item.seriesName}</td>
                    <td>{item.companyCode ?? "Central"}</td>
                    <td>{item.purpose}</td>
                    <td>v{item.versionNo}</td>
                    <td>{item.passingScorePercent}%</td>
                    <td>{item.questions.length}</td>
                    {/* The pill IS the switch: its status dot grows into the sliding knob, so the
                        row carries one status control instead of a badge next to a toggle. A DRAFT
                        keeps the plain badge - publishing it goes through the เผยแพร่ button. */}
                    <td onClick={(event) => event.stopPropagation()}>
                      {item.status !== "DRAFT" && item.canCreateVersion ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.status === "ACTIVE"}
                          aria-label={item.status === "ACTIVE" ? "ปิดใช้งานแบบทดสอบนี้" : "เปิดใช้งานแบบทดสอบนี้"}
                          title={item.status === "ACTIVE" ? "กดเพื่อปิดใช้งาน" : "กดเพื่อเปิดใช้งาน"}
                          className={`${styles.statusPill} ${statusClass} ${styles.statusToggle}`}
                          disabled={busy}
                          onClick={(event) => {
                            event.stopPropagation();
                            void changeStatus(item, item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
                          }}
                        >
                          <span className={styles.statusToggleKnob} aria-hidden="true" />
                          <span>{item.status}</span>
                        </button>
                      ) : (
                        <span className={`${styles.statusPill} ${statusClass}`}>{item.status}</span>
                      )}
                    </td>
                    <td className={styles.actionCell} onClick={(event) => event.stopPropagation()}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          className={styles.detailButton}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(item.assessmentId);
                            setOpenDetailId(isOpen ? "" : item.assessmentId);
                            setDetailAsLearner(false);
                          }}
                        >
                          {isOpen ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                        </button>
                        {item.status === "DRAFT" ? (
                          <button
                            className={styles.primaryButton}
                            type="button"
                            style={{ whiteSpace: "nowrap", padding: "3px 8px", fontSize: "0.74rem" }}
                            disabled={busy || !item.canModify}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handlePublishItem(item);
                            }}
                          >
                            เผยแพร่
                          </button>
                        ) : null}
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          style={{ whiteSpace: "nowrap", padding: "3px 8px", fontSize: "0.74rem" }}
                          disabled={busy || !item.canModify}
                          title={item.canModify ? "" : item.isUsed ? "ถูกใช้งานแล้ว แก้ไขไม่ได้ — ปิดใช้งานหรือสร้างเวอร์ชันใหม่แทน" : "แบบทดสอบของส่วนกลาง ดูได้อย่างเดียว"}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditForItem(item);
                          }}
                        >
                          แก้ไข
                        </button>
                        <button
                          className={styles.dangerButton}
                          type="button"
                          style={{ whiteSpace: "nowrap", padding: "3px 8px", fontSize: "0.74rem" }}
                          disabled={busy || !item.canModify}
                          title={item.canModify ? "" : item.isUsed ? "ถูกผูกกับหลักสูตร/แผนอบรม หรือมีพนักงานทำไปแล้ว ลบไม่ได้" : "แบบทดสอบของส่วนกลาง ดูได้อย่างเดียว"}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(item.assessmentId);
                            void removeTargetItem(item);
                          }}
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className={styles.detailRow}>
                      <td colSpan={9}>
                        <div className={styles.detailPanel}>
                          <div className={styles.panelHeader}>
                            <div>
                              <p className={styles.kicker}>
                                {detailAsLearner ? "Try it as a learner" : `${item.scope} · ${item.purpose} · v${item.versionNo}`}
                              </p>
                              <h3>{item.seriesName}</h3>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {!detailAsLearner ? <span>{item.isUsed ? "Locked — already in use" : "Unused"}</span> : null}
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                aria-label={detailAsLearner ? "กลับไปมุมมองผู้จัดทำ" : "ทดลองตอบแบบผู้เรียน"}
                                title={detailAsLearner ? "กลับไปมุมมองผู้จัดทำ" : "ทดลองตอบแบบผู้เรียน"}
                                onClick={() => setDetailAsLearner((current) => !current)}
                              >
                                👁
                              </button>
                            </div>
                          </div>
                          {/* Mirrors TrainingFormRunner: no correct-answer markers, no per-question score. */}
                          {detailAsLearner ? (
                            item.questions.length ? (
                              <FormPreviewRunner
                                title={item.seriesName}
                                instructions={item.instructions}
                                meta={[
                                  item.timeLimitMinutes ? `⏱ ${item.timeLimitMinutes} นาที` : null,
                                  `เกณฑ์ผ่าน ${item.passingScorePercent || 0}%`,
                                ].filter(Boolean).join(" · ")}
                                items={toPreviewItems(toDraftQuestions(item))}
                              />
                            ) : (
                              <div className={styles.emptyState}>{t("ยังไม่มีคำถามให้แสดงตัวอย่าง", "No questions to preview yet")}</div>
                            )
                          ) : (
                            <>
                              <p>{item.instructions || "No instructions"}</p>
                              {item.questions.length ? (
                                <div className={styles.questionList}>
                                  {item.questions.map((detail, index) => {
                                    const isBlock = isFormBlockType(detail.questionType);
                                    return (
                                    <article key={detail.questionId} data-block={isBlock ? detail.questionType : undefined}>
                                      <strong>
                                        {/* Blocks are not questions: no number, and no "0 points",
                                            which is meaningless on a section heading. */}
                                        {isBlock
                                          ? detail.questionText
                                          : `${item.questions.slice(0, index + 1).filter((row) => !isFormBlockType(row.questionType)).length}. ${detail.questionText}`}
                                      </strong>
                                      <span>
                                        {isBlock
                                          ? displayQuestionType(detail.questionType)
                                          : `${displayQuestionType(detail.questionType)} · ${detail.questionScore} points`}
                                      </span>
                                      {isBlock && detail.questionDescription?.trim()
                                        ? <p className={styles.blockBodyStatic}>{detail.questionDescription}</p>
                                        : null}
                                      {isGridType(detail.questionType)
                                        ? renderGridSummary(detail.choices, t("คะแนน", "Points"))
                                        : null}
                                      {isGridType(detail.questionType) ? null : detail.choices.map((choice, choiceIndex) => (
                                        <p key={choice.choiceId}>
                                          {choice.isCorrect ? "[Correct] " : ""}
                                          {String.fromCharCode(65 + choiceIndex)}. {choice.choiceText}
                                        </p>
                                      ))}
                                    </article>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className={styles.emptyState}>This draft does not have questions yet.</div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
                })}
          </tbody>
        </table>
            </div>
            ) : null}
          </section>
          );
        })}
      </div>
    </section>
  </section>;
}
