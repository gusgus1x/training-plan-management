"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import { listCompanies } from "../../../../lib/companies/client";
import type { CompanyRecord } from "../../../../lib/companies/types";
import {
  createEvaluation,
  deleteEvaluation,
  listEvaluations,
  setEvaluationStatus,
  updateEvaluation,
} from "../../../../lib/evaluations/client";
import { EVALUATION_QUESTION_TYPES } from "../../../../lib/evaluations/types";
import type {
  EvaluationQuestionType,
  EvaluationRecord,
  EvaluationRespondent,
  EvaluationRowType,
  EvaluationScope,
  EvaluationStatus,
  EvaluationTiming,
  EvaluationWriteInput,
} from "../../../../lib/evaluations/types";
import { legacySectionBreakPoints, legacySectionTitleAt } from "../../../../lib/evaluations/legacySections";
import {
  fallThroughLabel,
  isFormBlockType,
  remapSectionOrdinals,
  sectionCountOf,
  sectionIndexPerRow,
  type FormBlockType,
} from "../../../../lib/formBlocks";
import { isGridType, MIN_GRID_COLUMNS, MIN_GRID_ROWS } from "../../../../lib/formGrids";
import FormItemToolbar, { type FormItemKind } from "./FormItemToolbar";
import FormPreviewRunner, { type PreviewItem, type PreviewKind } from "./FormPreviewRunner";
import SearchableSelect from "../../../SearchableSelect";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./EvaluationManagement.module.css";

export const evaluationManagementModule = {
  title: "Evaluation Management",
  subtitle: "Evaluation form",
  description: "Build post-training and follow-up evaluation forms for employees and managers.",
} as const;

type Mode = "idle" | "new" | "edit";
type TimingLabel = "After Training" | "30-Day Follow-up";
type RespondentLabel = "Employee" | "Manager";
type StatusLabel = "Draft" | "Published" | "Inactive";
/** The question type is stored as the API value, not a display label. The old label vocabulary had
 *  only three entries and mapped both ways, so MULTIPLE_CHOICE and LONG_TEXT were rewritten as
 *  SINGLE_CHOICE/SHORT_TEXT the moment a stored question was opened here and saved again. */
const QUESTION_TYPE_LABELS: Record<EvaluationQuestionType, string> = {
  RATING: "Rating (1-5)",
  SINGLE_CHOICE: "Single Choice (ตอบได้ 1 ข้อ)",
  MULTIPLE_CHOICE: "Multiple Choice (ตอบได้หลายข้อ)",
  SHORT_TEXT: "Short Text (ข้อความสั้น)",
  LONG_TEXT: "Long Text (ข้อความยาว)",
  MULTIPLE_CHOICE_GRID: "Multiple Choice Grid (ตารางกริดหลายตัวเลือก)",
  CHECKBOX_GRID: "Checkbox Grid (ตารางกริดทำเครื่องหมาย)",
};
const isChoiceType = (value: EvaluationRowType) => value === "SINGLE_CHOICE" || value === "MULTIPLE_CHOICE";
const isTextType = (value: EvaluationRowType) => value === "SHORT_TEXT" || value === "LONG_TEXT";
type Feedback = { tone: "success" | "error" | "info"; message: string };
type FormErrors = Partial<Record<"name" | "companyId" | "questions" | "question", string>>;
type Draft = {
  formCode: string;
  formName: string;
  /** Shown to the respondent above the questions, the way an assessment's `instructions` are. The
   *  column and the API always accepted it; only this form never sent anything but null. */
  description: string;
  scope: EvaluationScope;
  companyId: string;
  timing: TimingLabel;
  respondent: RespondentLabel;
  anonymous: boolean;
  status: StatusLabel;
};
type DraftQuestion = {
  id: string;
  prompt: string;
  type: EvaluationRowType;
  required: boolean;
  options: string[];
  /** Body of a TEXT_BLOCK, sub-caption of a SECTION_BREAK. */
  description: string;
  /** SECTION_BREAK only: the default "after this section" target, or null to fall through. */
  nextSection: number | null;
  /** Per-option branch targets, parallel to `options`. SINGLE_CHOICE only. */
  optionTargets: (number | null)[];
  /** Grid questions only. Rows and columns are kept apart here and merged into one axis-tagged
   *  option list at save time, which is how the database stores them. */
  gridRows: string[];
  gridColumns: string[];
};

const ratingOptions = ["1 - Strongly disagree", "2 - Disagree", "3 - Neutral", "4 - Agree", "5 - Strongly agree"];
const key = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const blankDraft = (companyId = "", factory = false): Draft => ({
  formCode: "",
  formName: "",
  description: "",
  scope: factory ? "COMPANY" : "CENTRAL",
  companyId,
  timing: "After Training",
  respondent: "Employee",
  anonymous: true,
  status: "Draft",
});
/** The editor sits above the question list, so pressing Edit on a question further down moved the
 *  form off-screen. Scrolling to it is the cheap version of editing the question in place. */
const QUESTION_BUILDER_ID = "evaluation-question-builder";
const LEARNER_PREVIEW_ID = "evaluation-learner-preview";

/** Matches Assessment's indicator exactly - the two editors sit in the same menu, so a required
 *  field that is marked in one and not the other reads as a difference in the rules, not the UI.
 *  The " / " form is what the Thai dictionary splits on, so the title works in both languages. */
const RequiredIndicator = ({ isFilled }: { isFilled: boolean }) => (
  <span
    className={isFilled ? styles.indicatorDone : styles.indicatorPending}
    title={isFilled ? "กรอกข้อมูลเรียบร้อยแล้ว / Completed" : "จำเป็นต้องกรอก / Required field"}
  >
    <span className={styles.indicatorDot} />
  </span>
);
const scrollToQuestionBuilder = () =>
  document.getElementById(QUESTION_BUILDER_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** Choice questions accept any option count from two upwards (see handleAddQuestion's check and
 *  app/lib/evaluations validation); four is only the count a brand-new question starts with. */
const MIN_OPTIONS = 2;
const DEFAULT_OPTION_COUNT = 4;
const blankOptions = (count = DEFAULT_OPTION_COUNT) => Array.from({ length: count }, () => "");

const blankQuestion = (): DraftQuestion => ({
  id: key(),
  prompt: "",
  type: "RATING",
  required: true,
  options: blankOptions(),
  description: "",
  nextSection: null,
  optionTargets: blankOptions().map(() => null),
  gridRows: ["", ""],
  gridColumns: ["", ""],
});

/** A section break or a text block: a title, an optional body, and never an answer. */
const blankBlock = (type: FormBlockType): DraftQuestion => ({
  ...blankQuestion(),
  type,
  prompt: type === "SECTION_BREAK" ? "Untitled section" : "Untitled text",
  required: false,
  options: [],
  optionTargets: [],
});

/** Draft rows to the shape the live preview runner takes. RATING has no stored options in the
 *  draft - the five-point scale is synthesised at save time - so it is rendered as a rating. */
const toPreviewItems = (rows: DraftQuestion[]): PreviewItem[] => rows.map((row) => {
  const kind: PreviewKind =
    row.type === "SECTION_BREAK" ? "section"
      : row.type === "TEXT_BLOCK" ? "note"
        : row.type === "RATING" ? "rating"
          : row.type === "MULTIPLE_CHOICE_GRID" ? "grid"
            : row.type === "CHECKBOX_GRID" ? "gridMulti"
              : row.type === "MULTIPLE_CHOICE" ? "multiple"
                : row.type === "SINGLE_CHOICE" ? "single"
                  : "text";
  if (kind === "grid" || kind === "gridMulti") {
    return {
      id: row.id,
      kind,
      text: row.prompt,
      description: null,
      isRequired: row.required,
      nextSection: null,
      options: [
        ...row.gridRows.filter((label) => label.trim()).map((label, index) => ({
          id: `${row.id}-r${index}`, text: label, nextSection: null, axis: "ROW" as const,
        })),
        ...row.gridColumns.filter((label) => label.trim()).map((label, index) => ({
          id: `${row.id}-c${index}`, text: label, nextSection: null, axis: "COLUMN" as const,
        })),
      ],
    };
  }
  return {
    id: row.id,
    kind,
    text: row.prompt,
    description: row.description || null,
    isRequired: row.required,
    nextSection: row.nextSection,
    options: kind === "single" || kind === "multiple"
      ? row.options
          .map((option, index) => ({ option, target: row.optionTargets[index] ?? null }))
          .filter(({ option }) => option.trim())
          .map(({ option, target }, index) => ({
            id: `${row.id}-${index}`,
            text: option,
            nextSection: kind === "single" ? target : null,
          }))
      : [],
  };
});

// The *Label types are what the form shows; the Evaluation* types are what the API stores. These
// pairs are the only place the two vocabularies meet, so each side is typed for the direction it
// actually carries.
const timingToApi = (value: TimingLabel): EvaluationTiming => value === "After Training" ? "AFTER_TRAINING" : "FOLLOW_UP_30_DAYS";
const timingFromApi = (value: EvaluationTiming): TimingLabel => value === "AFTER_TRAINING" ? "After Training" : "30-Day Follow-up";
const respondentToApi = (value: RespondentLabel): EvaluationRespondent => value === "Employee" ? "EMPLOYEE" : "MANAGER";
const respondentFromApi = (value: EvaluationRespondent): RespondentLabel => value === "EMPLOYEE" ? "Employee" : "Manager";
const statusToApi = (value: StatusLabel): EvaluationStatus => value.toUpperCase() as EvaluationStatus;
const statusFromApi = (value: EvaluationStatus): StatusLabel => value === "DRAFT" ? "Draft" : value === "PUBLISHED" ? "Published" : "Inactive";

const toDraftQuestions = (record: EvaluationRecord): DraftQuestion[] => {
  const rows: DraftQuestion[] = record.questions.map((question) => ({
    id: question.evaluationQuestionId,
    prompt: question.questionText,
    type: question.questionType,
    required: question.isRequired,
    description: question.questionDescription ?? "",
    nextSection: question.nextSection,
    // Not truncated to 4 any more: a question stored with more options used to lose the extras as
    // soon as it was opened here, and saving wrote the shortened list back.
    options: isChoiceType(question.questionType)
      ? (() => {
          const stored = question.options.map((option) => option.optionText);
          return stored.length >= MIN_OPTIONS ? stored : [...stored, ...blankOptions()].slice(0, MIN_OPTIONS);
        })()
      : blankOptions(),
    optionTargets: isChoiceType(question.questionType)
      ? question.options.map((option) => option.nextSection)
      : [],
    // Stored as one axis-tagged list; split back into the two the editor works with.
    gridRows: question.options.filter((option) => option.axis === "ROW").map((option) => option.optionText),
    gridColumns: question.options.filter((option) => option.axis === "COLUMN").map((option) => option.optionText),
  }));

  // Old forms grouped questions with a section_name label instead of real breaks. Convert on open
  // so the grouping survives the next save, which deletes and recreates every row.
  const hasRealSections = rows.some((row) => row.type === "SECTION_BREAK");
  if (hasRealSections) return rows;
  const points = legacySectionBreakPoints(record.questions);
  if (!points.length) return rows;

  const converted: DraftQuestion[] = [];
  rows.forEach((row, index) => {
    if (points.includes(index)) {
      converted.push({ ...blankBlock("SECTION_BREAK"), prompt: legacySectionTitleAt(record.questions, index) });
    }
    converted.push(row);
  });
  return converted;
};

/** Turned off at the user's request, matching Assessment. Flip to true to bring the button back. */
const SHOW_CSV_EXPORT = false;

const csvCell = (value: string | number | boolean) => `"${String(value).replaceAll('"', '""')}"`;
const createEvaluationCsv = (items: EvaluationRecord[]) => [
  ["Code", "Evaluation Name", "Timing", "Respondent", "Scope", "Company", "Anonymous", "Questions", "Required Questions", "Status", "Updated At"],
  ...items.map((item) => [
    item.formCode,
    item.formName,
    timingFromApi(item.timing),
    respondentFromApi(item.respondentType),
    item.scope === "CENTRAL" ? "Central" : "Company",
    item.companyCode ?? "-",
    item.isAnonymous,
    item.questions.length,
    item.questions.filter((question) => question.isRequired).length,
    statusFromApi(item.status),
    item.updatedAt ?? item.createdAt,
  ]),
].map((row) => row.map(csvCell).join(",")).join("\r\n");

const generateNextEvaluationCode = (timing: TimingLabel, existingItems: EvaluationRecord[]) => {
  const prefix = timing === "After Training" ? "EVL-AFTER" : "EVL-30DAY";
  let maxSeq = 0;
  existingItems.forEach((item) => {
    const code = item.formCode || "";
    const match = code.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  });
  return `${prefix}-${String(maxSeq + 1).padStart(6, "0")}`;
};

export default function EvaluationManagement() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const isFactory = user?.roleCode === "HRD_FACTORY";
  const [items, setItems] = useState<EvaluationRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [detailAsLearner, setDetailAsLearner] = useState(false);
  /** Editor-level view switch, separate from detailAsLearner which belongs to the list rows. */
  const [previewAsLearner, setPreviewAsLearner] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [draft, setDraft] = useState<Draft>(() => blankDraft(user?.companyId ?? "", isFactory));
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [questionDraft, setQuestionDraft] = useState<DraftQuestion>(blankQuestion);
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});

  // The floating toolbar tracks whichever card is focused and inserts below it. The refs give it
  // that card's offsetTop; onMouseDown backs up onFocusCapture, which misses clicks on the parts of
  // a card that are not focusable.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [anchorTop, setAnchorTop] = useState<number | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  useLayoutEffect(() => {
    setAnchorTop(focusedId ? cardRefs.current.get(focusedId)?.offsetTop ?? null : null);
  }, [focusedId, questions]);
  const [search, setSearch] = useState("");
  /** Company code, or "CENTRAL". Center users only - a Factory list is already narrowed server-side. */
  const [companyFilter, setCompanyFilter] = useState("");
  /** Tracks the CLOSED groups: a block that has just appeared should be open, which an "open list"
   *  would get backwards. */
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  /** Which existing form the new-evaluation form was filled from. Display only - a one-time copy. */
  const [templateSourceId, setTemplateSourceId] = useState("");
  const toggleGroup = (code: string) =>
    setClosedGroups((current) => current.includes(code) ? current.filter((entry) => entry !== code) : [...current, code]);
  const [errors, setErrors] = useState<FormErrors>({});
  const toast = useToast();
  // Escape hatch for the strings the DOM-walking dictionary cannot reach: those with
  // interpolated counts, and those that must differ per language rather than be translated.
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);
  const setFeedback = useCallback(
    (next: Feedback | null) => {
      if (next) toast[next.tone](next.message);
    },
    [toast],
  );
  const [busy, setBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const selected = useMemo(() => items.find((item) => item.evaluationFormId === selectedId) ?? null, [items, selectedId]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const bySearch = query ? items.filter((item) => [item.formCode, item.formName, item.companyCode, timingFromApi(item.timing), respondentFromApi(item.respondentType), statusFromApi(item.status)].filter(Boolean).join(" ").toLowerCase().includes(query)) : items;
    // "CENTRAL" is its own bucket rather than a company - a central form has no companyCode.
    return companyFilter
      ? bySearch.filter((item) => companyFilter === "CENTRAL" ? item.companyCode === null : item.companyCode === companyFilter)
      : bySearch;
  }, [items, search, companyFilter]);

  /** Central first, then one block per company - the same grouping Course Master uses. */
  const groupedVisible = useMemo(() => {
    const groups = new Map<string, EvaluationRecord[]>();
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
          ? "แบบประเมินส่วนกลาง (HRD Center)"
          : `แบบประเมินบริษัท ${companies.find((company) => company.companyCode === code)?.companyNameTh ?? code}`,
        isOwn: code === "CENTRAL" ? !isFactory : code === user?.companyCode,
        rows,
      }));
  }, [visible, companies, isFactory, user?.companyCode]);

  const load = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const [evaluationResult, companyResult] = await Promise.all([
        listEvaluations(),
        isFactory ? Promise.resolve({ items: [] as CompanyRecord[] }) : listCompanies(),
      ]);
      setItems(evaluationResult.items);
      setCompanies(companyResult.items);
      setSelectedId((current) => evaluationResult.items.some((item) => item.evaluationFormId === current) ? current : "");
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to load evaluations" });
    } finally {
      setBusy(false);
      setIsLoading(false);
    }
  }, [isFactory, setFeedback]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const resetQuestionEditor = () => {
    setQuestionDraft(blankQuestion());
    setEditingQuestionId("");
    setErrors((current) => ({ ...current, question: undefined }));
  };
  const closeEditor = () => {
    setMode("idle");
    setDraft(blankDraft(user?.companyId ?? "", isFactory));
    setQuestions([]);
    setPreviewAnswers({});
    setErrors({});
    resetQuestionEditor();
  };
  const handleNew = () => {
    setSelectedId("");
    setOpenDetailId("");
    setFeedback(null);
    const initialTiming: TimingLabel = "After Training";
    const initialDraft = blankDraft(user?.companyId ?? "", isFactory);
    initialDraft.formCode = generateNextEvaluationCode(initialTiming, items);
    setDraft(initialDraft);
    setQuestions([]);
    setPreviewAnswers({});
    setErrors({});
    setTemplateSourceId("");
    resetQuestionEditor();
    setMode("new");
  };

  const openEditForItem = (item: EvaluationRecord) => {
    if (!item.canModify) return;
    setSelectedId(item.evaluationFormId);
    setOpenDetailId("");
    setDraft({
      formCode: item.formCode,
      formName: item.formName,
      description: item.description ?? "",
      scope: item.scope,
      companyId: item.companyId ?? "",
      timing: timingFromApi(item.timing),
      respondent: respondentFromApi(item.respondentType),
      anonymous: item.isAnonymous,
      status: statusFromApi(item.status),
    });
    setQuestions(toDraftQuestions(item));
    setPreviewAnswers({});
    setErrors({});
    resetQuestionEditor();
    setFeedback(null);
    setMode("edit");
  };

  const removeTargetItem = async (item: EvaluationRecord) => {
    if (!item.canModify) return;
    if (
      !(await confirm({
        message: {
          th: `ยืนยันที่จะลบแบบประเมิน "${item.formName}" หรือไม่?`,
          en: `Confirm deleting evaluation "${item.formName}"?`,
        },
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setFeedback(null);
    try {
      await deleteEvaluation(item.evaluationFormId);
      setItems((current) => current.filter((i) => i.evaluationFormId !== item.evaluationFormId));
      if (selectedId === item.evaluationFormId) {
        setSelectedId("");
        closeEditor();
      }
      setFeedback({ tone: "success", message: "Evaluation deleted." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete evaluation" });
    } finally {
      setBusy(false);
    }
  };

  const handlePublishItem = async (item: EvaluationRecord) => {
    if (!item.canModify) return;
    const draftQs = toDraftQuestions(item);
    if (!draftQs.length) {
      setFeedback({ tone: "error", message: "Add at least one question before publishing." });
      return;
    }
    if (!draftQs.some((q) => q.required)) {
      setFeedback({ tone: "error", message: "Published evaluations need at least one required question." });
      return;
    }
    if (
      !(await confirm({
        message: {
          th: `ยืนยันที่จะเผยแพร่แบบประเมิน "${item.formName}" หรือไม่? เมื่อเผยแพร่แล้วจะถูกเลือกใช้ในหลักสูตรได้ทันที`,
          en: `Confirm publishing evaluation "${item.formName}"? It becomes selectable on courses immediately.`,
        },
      }))
    )
      return;
    setBusy(true);
    setFeedback(null);
    try {
      const publishInput: EvaluationWriteInput = {
        scope: item.scope,
        companyId: item.companyId,
        formCode: item.formCode,
        formName: item.formName,
        description: item.description,
        timing: item.timing,
        respondentType: item.respondentType,
        isAnonymous: item.isAnonymous,
        status: "PUBLISHED",
        // Status-only publish: every question is echoed back exactly as stored, blocks and branch
        // targets included, so nothing is rewritten on the way through.
        questions: item.questions.map((question) => ({
          questionText: question.questionText,
          questionType: question.questionType,
          sectionName: question.sectionName,
          questionDescription: question.questionDescription,
          nextSection: question.nextSection,
          isRequired: question.isRequired,
          options: question.options.map((option) => ({
            optionText: option.optionText,
            optionValue: option.optionValue,
            nextSection: option.nextSection,
            axis: option.axis,
          })),
        })),
      };
      const updated = (await updateEvaluation(item.evaluationFormId, publishInput)).evaluation;
      setItems((current) => current.map((i) => (i.evaluationFormId === updated.evaluationFormId ? updated : i)));
      setFeedback({ tone: "success", message: `Published evaluation "${item.formName}".` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to publish evaluation" });
    } finally {
      setBusy(false);
    }
  };

  const payload = (sourceDraft = draft, sourceQuestions = questions): EvaluationWriteInput => ({
    scope: isFactory ? "COMPANY" : sourceDraft.scope,
    companyId: isFactory ? user?.companyId ?? null : sourceDraft.scope === "COMPANY" ? sourceDraft.companyId : null,
    formCode: sourceDraft.formCode,
    formName: sourceDraft.formName,
    description: sourceDraft.description.trim() || null,
    timing: timingToApi(sourceDraft.timing),
    respondentType: respondentToApi(sourceDraft.respondent),
    isAnonymous: sourceDraft.anonymous,
    status: statusToApi(sourceDraft.status),
    questions: sourceQuestions.map((question) => ({
      questionText: question.prompt,
      questionType: question.type,
      // Superseded by SECTION_BREAK rows. The column stays for forms not yet re-saved, but nothing
      // written from here sets it again.
      sectionName: null,
      questionDescription: isFormBlockType(question.type) ? question.description.trim() || null : null,
      nextSection: question.type === "SECTION_BREAK" ? question.nextSection : null,
      isRequired: isFormBlockType(question.type) ? false : question.required,
      options: question.type === "RATING"
        ? ratingOptions.map((option, index) => ({ optionText: option, optionValue: String(index + 1), nextSection: null, axis: null }))
        : isGridType(question.type)
          // Rows first, then columns: both live in one ordered list, told apart by axis.
          ? [
              ...question.gridRows.filter((row) => row.trim()).map((row) => ({
                optionText: row, optionValue: null, nextSection: null, axis: "ROW" as const,
              })),
              ...question.gridColumns.filter((column) => column.trim()).map((column) => ({
                optionText: column, optionValue: null, nextSection: null, axis: "COLUMN" as const,
              })),
            ]
          : isChoiceType(question.type)
            ? question.options
                .map((option, index) => ({ option, target: question.optionTargets[index] ?? null }))
                .filter(({ option }) => option.trim())
                .map(({ option, target }) => ({
                  optionText: option,
                  optionValue: null,
                  nextSection: question.type === "SINGLE_CHOICE" ? target : null,
                  axis: null,
                }))
            : [],
    })),
  });

  /** Whether this user owns the form, independent of whether it is in use. canModify folds the two
   *  together, but retiring a form is allowed on one already in use. */
  const canOwn = (item: EvaluationRecord) =>
    !isFactory || (item.companyId !== null && item.companyId === (user?.companyId ?? null));

  /** Retiring or re-publishing. Allowed on a form already in use - it changes no content, and a
   *  form published by mistake must not be permanent. */
  const changeStatus = async (item: EvaluationRecord, status: EvaluationStatus) => {
    const retiring = status === "INACTIVE";
    if (!(await confirm({
      message: {
        th: retiring
          ? `ยืนยันที่จะปิดใช้งานแบบประเมิน "${item.formName}" หรือไม่? หลักสูตรจะเลือกใช้ชุดนี้ใหม่ไม่ได้ คำตอบที่มีอยู่ยังอยู่ครบ`
          : `ยืนยันที่จะเปิดใช้งานแบบประเมิน "${item.formName}" อีกครั้งหรือไม่?`,
        en: retiring ? `Retire evaluation "${item.formName}"?` : `Re-publish evaluation "${item.formName}"?`,
      },
      danger: retiring,
    }))) return;
    setBusy(true);
    try {
      const saved = (await setEvaluationStatus(item.evaluationFormId, status)).evaluation;
      setItems((current) => current.map((row) => row.evaluationFormId === saved.evaluationFormId ? saved : row));
      setFeedback({ tone: "success", message: retiring ? "ปิดใช้งานแบบประเมินแล้ว" : "เปิดใช้งานแบบประเมินแล้ว" });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  /** Fills the new-evaluation form from an existing one, the way Course Master pulls details from a
   *  Center course template. Nothing is written until Save, so the source form is never touched. */
  const applyTemplate = (evaluationFormId: string) => {
    setTemplateSourceId(evaluationFormId);
    if (!evaluationFormId) return;
    const source = items.find((item) => item.evaluationFormId === evaluationFormId);
    if (!source) return;
    setDraft((current) => ({
      ...current,
      formName: `${source.formName} (Copy)`,
      description: source.description ?? "",
      timing: timingFromApi(source.timing),
      respondent: respondentFromApi(source.respondentType),
      anonymous: source.isAnonymous,
    }));
    setQuestions(toDraftQuestions(source).map((question) => ({ ...question, id: key() })));
    setPreviewAnswers({});
    resetQuestionEditor();
    setFeedback({ tone: "success", message: `ดึงคำถาม ${source.questions.length} ข้อจาก "${source.formName}" มาแล้ว แก้ไขได้ตามต้องการ` });
  };

  /**
   * Every list mutation goes through here. Moving, adding or deleting a section renumbers every
   * section after it, so a branch target left alone would silently start pointing at a different
   * section - worse than the reorder itself, because nothing tells the author it happened.
   */
  const withRemappedTargets = (before: DraftQuestion[], after: DraftQuestion[]): DraftQuestion[] => {
    const rows = (list: DraftQuestion[]) => list.map((item) => ({ id: item.id, questionType: item.type }));
    const map = remapSectionOrdinals(rows(before), rows(after));
    const move = (target: number | null) => (target === null ? null : map.get(target) ?? null);
    return after.map((item) => ({
      ...item,
      nextSection: move(item.nextSection),
      optionTargets: item.optionTargets.map(move),
    }));
  };
  const reorderQuestions = (change: (current: DraftQuestion[]) => DraftQuestion[]) =>
    setQuestions((current) => withRemappedTargets(current, change(current)));

  /**
   * The toolbar inserts below the focused card, the way Google Forms does. A question opens the
   * builder above (there is nowhere to type it inline); a section or text block is complete as
   * soon as it exists, so it goes straight into the list.
   */
  const handleToolbarAdd = (kind: FormItemKind) => {
    if (kind === "QUESTION") {
      resetQuestionEditor();
      scrollToQuestionBuilder();
      return;
    }
    const block = blankBlock(kind);
    reorderQuestions((current) => {
      const at = current.findIndex((item) => item.id === focusedId);
      return at === -1
        ? [...current, block]
        : [...current.slice(0, at + 1), block, ...current.slice(at + 1)];
    });
    setFocusedId(block.id);
    setPreviewAnswers({});
  };

  const handleAddQuestion = () => {
    const cleanOptions = questionDraft.options.map((option) => option.trim());
    if (!questionDraft.prompt.trim()) return setErrors((current) => ({ ...current, question: "Enter an evaluation question." }));
    if (isChoiceType(questionDraft.type) && cleanOptions.filter(Boolean).length < MIN_OPTIONS) return setErrors((current) => ({ ...current, question: "Choice questions need at least two options." }));
    const next: DraftQuestion = { ...questionDraft, prompt: questionDraft.prompt.trim(), options: isChoiceType(questionDraft.type) ? cleanOptions : blankOptions() };
    setQuestions((current) => editingQuestionId ? current.map((item) => item.id === editingQuestionId ? next : item) : [...current, next]);
    setErrors((current) => ({ ...current, question: undefined, questions: undefined }));
    setFeedback({ tone: "success", message: editingQuestionId ? "Question updated." : "Question added." });
    setPreviewAnswers({}); resetQuestionEditor();
  };
  const handleEditQuestion = (question: DraftQuestion) => { setQuestionDraft({ ...question, options: question.options.length >= MIN_OPTIONS ? [...question.options] : [...question.options, ...blankOptions()].slice(0, MIN_OPTIONS) }); setEditingQuestionId(question.id); setErrors((current) => ({ ...current, question: undefined })); scrollToQuestionBuilder(); };
  const handleRemoveQuestion = (id: string) => { reorderQuestions((current) => current.filter((item) => item.id !== id)); if (editingQuestionId === id) resetQuestionEditor(); setPreviewAnswers({}); };

  // Native HTML5 drag and drop - no library. Up/Down stay as the keyboard path.
  //
  // Reorders live as the dragged card crosses another one (on dragOver), not just on drop, so the
  // list previews the landing position instead of leaving the user to guess. A ref backs the index
  // because dragOver can fire faster than React re-renders; reading state here would let two
  // events in the same tick both see the pre-swap index and double-swap.
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

  const handleAddOption = () => setQuestionDraft((current) => ({ ...current, options: [...current.options, ""] }));
  const handleRemoveOption = (index: number) => setQuestionDraft((current) => current.options.length <= MIN_OPTIONS ? current : ({ ...current, options: current.options.filter((_, itemIndex) => itemIndex !== index) }));

  /** Copies a question in place, right below the original - the common case when writing a set of
   *  near-identical rating questions for one section. */
  const handleDuplicateQuestion = (index: number) => reorderQuestions((current) => {
    const source = current[index];
    if (!source) return current;
    return [...current.slice(0, index + 1), { ...source, id: key(), options: [...source.options], optionTargets: [...source.optionTargets] }, ...current.slice(index + 1)];
  });
  const handleMoveQuestion = (index: number, direction: -1 | 1) => reorderQuestions((current) => {
    const destination = index + direction; if (destination < 0 || destination >= current.length) return current;
    const reordered = [...current]; [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]]; return reordered;
  });

  const handleSave = async () => {
    const nextErrors: FormErrors = {};
    if (!draft.formName.trim()) nextErrors.name = "Evaluation name is required.";
    if (!isFactory && draft.scope === "COMPANY" && !draft.companyId) nextErrors.companyId = "Select a company for a company-specific form.";
    // Same two rules the server enforces (app/lib/evaluations/validation.ts). Checking them here as
    // well means the author is told which field is wrong instead of getting a generic API error,
    // and blocks are excluded from the count because a form of only sections has no questions.
    const answerable = questions.filter((row) => !isFormBlockType(row.type));
    if (draft.status === "Published" && !answerable.length) {
      nextErrors.questions = "Add at least one question before publishing.";
    } else if (draft.status === "Published" && !answerable.some((row) => row.required)) {
      nextErrors.questions = "A published evaluation needs at least one required question.";
    }
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); setFeedback({ tone: "error", message: "Please correct the highlighted fields." }); return; }
    setBusy(true); setFeedback(null);
    try {
      const saved = mode === "edit" && selected
        ? (await updateEvaluation(selected.evaluationFormId, payload())).evaluation
        : (await createEvaluation(payload())).evaluation;
      setItems((current) => mode === "edit" ? current.map((item) => item.evaluationFormId === saved.evaluationFormId ? saved : item) : [saved, ...current]);
      setSelectedId(saved.evaluationFormId); setOpenDetailId(""); closeEditor();
      setFeedback({ tone: "success", message: mode === "edit" ? "Evaluation updated." : "Evaluation created." });
      void listEvaluations().then((result) => setItems(result.items)).catch(() => undefined);
    } catch (error) { setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to save evaluation" }); }
    finally { setBusy(false); }
  };

  const handleExport = () => {
    if (!visible.length) return setFeedback({ tone: "error", message: "There are no evaluations to export." });
    const url = URL.createObjectURL(new Blob(["\uFEFF", createEvaluationCsv(visible)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `evaluation-export-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  // The preview keeps one string per question, so a multi-select answer is stored as a newline-joined
  // list rather than a second state shape.
  const selectedPreviewOptions = (answerKey: string) => new Set((previewAnswers[answerKey] ?? "").split("\n").filter(Boolean));
  const togglePreviewOption = (answerKey: string, option: string, multiple: boolean) => setPreviewAnswers((current) => {
    if (!multiple) return { ...current, [answerKey]: option };
    const chosen = new Set((current[answerKey] ?? "").split("\n").filter(Boolean));
    if (chosen.has(option)) chosen.delete(option); else chosen.add(option);
    return { ...current, [answerKey]: [...chosen].join("\n") };
  });

  /** Section ordinal each row sits in, so a branch dropdown can offer only forward targets. */
  const sectionOfRow = useMemo(() => sectionIndexPerRow(questions.map((item) => item.type)), [questions]);
  const totalSections = useMemo(() => sectionCountOf(questions.map((item) => item.type)), [questions]);

  const cardRef = (id: string) => (element: HTMLElement | null) => {
    if (element) cardRefs.current.set(id, element);
    else cardRefs.current.delete(id);
  };

  const renderQuestionPreview = (previewQuestions: DraftQuestion[], previewKey: string, editable: boolean) => previewQuestions.length ? <div className={styles.questionList}>{previewQuestions.map((item, index) => {
    const answerKey = `${previewKey}-${item.id}`;
    const options = item.type === "RATING" ? ratingOptions : item.options.filter(Boolean);
    const multiple = item.type === "MULTIPLE_CHOICE";
    const isBlock = isFormBlockType(item.type);
    // Numbering skips blocks so a section heading does not consume a question number.
    const displayNumber = previewQuestions.slice(0, index + 1).filter((row) => !isFormBlockType(row.type)).length;
    // Forward-only targets, matching the validation rule.
    const forwardTargets = Array.from({ length: totalSections }, (unused, offset) => offset + 1)
      .filter((target) => target > (sectionOfRow[index] ?? 1));

    const actions = editable ? <div className={styles.questionActions}><button className={styles.secondaryButton} type="button" disabled={index === 0} onClick={() => handleMoveQuestion(index, -1)}>Up</button><button className={styles.secondaryButton} type="button" disabled={index === previewQuestions.length - 1} onClick={() => handleMoveQuestion(index, 1)}>Down</button>{isBlock ? null : <button className={styles.secondaryButton} type="button" onClick={() => handleEditQuestion(item)}>Edit</button>}<button className={styles.secondaryButton} type="button" onClick={() => handleDuplicateQuestion(index)}>Duplicate</button><button className={styles.dangerButton} type="button" onClick={() => handleRemoveQuestion(item.id)}>Remove</button></div> : null;

    const cardProps = {
      draggable: editable,
      onDragStart: () => editable && setDragIndex(index),
      onDragEnd: () => setDragIndex(null),
      onDragOver: (event: React.DragEvent) => { if (!editable) return; event.preventDefault(); dragQuestionOver(index); },
      onDrop: (event: React.DragEvent) => event.preventDefault(),
      onMouseDown: () => editable && setFocusedId(item.id),
      onFocusCapture: () => editable && setFocusedId(item.id),
      ref: editable ? cardRef(item.id) : undefined,
      "data-dragging": dragIndex === index,
      "data-focused": editable && focusedId === item.id,
    };

    // A section break or a text block is edited in place: it is only a title and a body, so the
    // question builder above has nothing to offer it.
    if (isBlock) {
      return <article key={item.id} {...cardProps} data-block={item.type}>
        <div className={styles.questionHeading}><div><strong>{editable ? <span className={styles.dragHandle} aria-hidden="true" title="ลากเพื่อสลับลำดับ / Drag to reorder">⠿</span> : null}{item.type === "SECTION_BREAK" ? t(`ส่วนที่ ${sectionOfRow[index]}`, `Section ${sectionOfRow[index]}`) : t("ข้อความ", "Text")}</strong></div><b>{item.type === "SECTION_BREAK" ? "Section" : "Text"}</b></div>
        {editable ? <>
          <input className={styles.blockTitleInput} value={item.prompt} placeholder={item.type === "SECTION_BREAK" ? "Section title" : "Title"} onChange={(event) => setQuestions((current) => current.map((row) => row.id === item.id ? { ...row, prompt: event.target.value } : row))} />
          <textarea className={styles.blockBodyInput} rows={2} value={item.description} placeholder="Description" onChange={(event) => setQuestions((current) => current.map((row) => row.id === item.id ? { ...row, description: event.target.value } : row))} />
          {item.type === "SECTION_BREAK" ? <label className={styles.branchLabel}>{t("หลังส่วนนี้", "After this section")}
            <select value={item.nextSection ?? ""} onChange={(event) => setQuestions((current) => current.map((row) => row.id === item.id ? { ...row, nextSection: event.target.value ? Number(event.target.value) : null } : row))}>
              <option value="">{fallThroughLabel(sectionOfRow[index] ?? 1, totalSections, language === "th")}</option>
              <option value="0">{t("ส่งแบบฟอร์ม (จบที่นี่)", "Submit form (end here)")}</option>
              {forwardTargets.map((target) => <option key={target} value={target}>{t(`ไปยังส่วนที่ ${target}`, `Go to section ${target}`)}</option>)}
            </select>
          </label> : null}
        </> : <>
          <strong className={styles.blockTitleStatic}>{item.prompt}</strong>
          {item.description.trim() ? <p className={styles.blockBodyStatic}>{item.description}</p> : null}
        </>}
        {actions}
      </article>;
    }

    return <article key={item.id} {...cardProps}><div className={styles.questionHeading}><div><strong>{editable ? <span className={styles.dragHandle} aria-hidden="true" title="ลากเพื่อสลับลำดับ / Drag to reorder">⠿</span> : null}{displayNumber}. {item.prompt}{item.required ? <em className={styles.requiredMark}> *</em> : null}</strong></div><b>{QUESTION_TYPE_LABELS[item.type as EvaluationQuestionType]}</b></div>
      {/* A grid keeps its rows and columns in gridRows/gridColumns, not in `options`, so without
          this branch the shared option renderer below found nothing to draw and the card came out
          empty. */}
      {isGridType(item.type) ? <div className={styles.gridPreviewScroll}>
        <table className={styles.gridPreviewTable}>
          <thead>
            <tr>
              <th />
              {item.gridColumns.filter(Boolean).map((column, columnIndex) => <th key={`col-${columnIndex}`}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {item.gridRows.filter(Boolean).map((row, rowIndex) => <tr key={`row-${rowIndex}`}>
              <th scope="row">{row}</th>
              {item.gridColumns.filter(Boolean).map((unused, columnIndex) => <td key={`cell-${rowIndex}-${columnIndex}`}>
                <input
                  type={item.type === "MULTIPLE_CHOICE_GRID" ? "radio" : "checkbox"}
                  name={`${answerKey}-${rowIndex}`}
                  checked={selectedPreviewOptions(`${answerKey}-${rowIndex}`).has(String(columnIndex))}
                  onChange={() => togglePreviewOption(`${answerKey}-${rowIndex}`, String(columnIndex), item.type === "CHECKBOX_GRID")}
                />
              </td>)}
            </tr>)}
          </tbody>
        </table>
        {!item.gridRows.some(Boolean) || !item.gridColumns.some(Boolean)
          ? <p className={styles.helperText}>{t("ยังไม่ได้ใส่แถวหรือคอลัมน์", "No rows or columns yet")}</p>
          : null}
      </div> : isTextType(item.type) ? <textarea aria-label={`Preview answer for question ${displayNumber}`} placeholder="Type a preview response" rows={item.type === "LONG_TEXT" ? 4 : 2} value={previewAnswers[answerKey] ?? ""} onChange={(event) => setPreviewAnswers((current) => ({ ...current, [answerKey]: event.target.value }))} /> : <div className={styles.previewOptions}>{options.map((option) => <label key={`${item.id}-${option}`}><input checked={selectedPreviewOptions(answerKey).has(option)} name={answerKey} type={multiple ? "checkbox" : "radio"} value={option} onChange={() => togglePreviewOption(answerKey, option, multiple)} /><span>{option}</span></label>)}</div>}
      {editable && item.type === "SINGLE_CHOICE" && forwardTargets.length ? <div className={styles.branchRow}>{item.options.map((option, optionIndex) => option.trim() ? <label className={styles.branchLabel} key={`${item.id}-branch-${optionIndex}`}>{`"${option}" →`}
        <select value={item.optionTargets[optionIndex] ?? ""} onChange={(event) => setQuestions((current) => current.map((row) => row.id === item.id ? { ...row, optionTargets: row.options.map((unused, targetIndex) => targetIndex === optionIndex ? (event.target.value ? Number(event.target.value) : null) : row.optionTargets[targetIndex] ?? null) } : row))}>
          <option value="">{fallThroughLabel(sectionOfRow[index] ?? 1, totalSections, language === "th")}</option>
          <option value="0">{t("ส่งแบบฟอร์ม (จบที่นี่)", "Submit form (end here)")}</option>
          {forwardTargets.map((target) => <option key={target} value={target}>{t(`ไปยังส่วนที่ ${target}`, `Go to section ${target}`)}</option>)}
        </select>
      </label> : null)}</div> : null}
      {actions}
    </article>;
  })}</div> : <div className={styles.emptyState}>No questions yet. Add a question to preview the evaluation form.</div>;

  const renderEditor = () => <section className={styles.editorPanel}>
    <div className={styles.panelHeader}><div><p className={styles.kicker}>{mode === "new" ? "New evaluation" : "Edit evaluation"}</p><h3>Evaluation form settings</h3></div><button className={styles.closeButton} type="button" onClick={closeEditor}>Close</button></div>
    {mode === "new" ? (
      <div className={styles.templatePicker}>
        <span className={styles.templatePickerLabel}>
          📋 สร้างจากแบบประเมินที่มีอยู่ (Use an existing evaluation as a template)
        </span>
        <SearchableSelect
          value={templateSourceId}
          onChange={applyTemplate}
          placeholder="🔍 ค้นหารหัสหรือชื่อแบบประเมิน..."
          options={[
            { value: "", label: "-- ไม่ใช้แม่แบบ (เริ่มจากหน้าว่าง) --" },
            ...items.map((item) => ({
              value: item.evaluationFormId,
              label: `[${item.formCode}] ${item.formName}`,
              secondaryLabel: `${item.companyCode ?? "ส่วนกลาง"} · ${timingFromApi(item.timing)} · ${item.questions.length} ข้อ`,
            })),
          ]}
        />
        <small className={styles.templatePickerHint}>
          * ดึงคำถาม ตัวเลือก หัวข้อ ช่วงเวลา และกลุ่มผู้ตอบมาให้ทั้งหมด
          รหัสแบบประเมินจะสร้างใหม่เสมอ และแบบประเมินต้นทางไม่ถูกแตะต้อง
        </small>
      </div>
    ) : null}
    <div className={styles.formGrid}>
      <label className={styles.fullWidth}><span>Evaluation Name <RequiredIndicator isFilled={Boolean(draft.formName.trim())} /></span>
        <input
          aria-invalid={Boolean(errors.name)}
          className={errors.name ? styles.inputError : undefined}
          value={draft.formName}
          onChange={(event) => {
            setDraft({ ...draft, formName: event.target.value });
            setErrors((current) => ({ ...current, name: undefined }));
          }}
          placeholder="e.g. Standard Course Evaluation"
        />
        {errors.name ? <small>{errors.name}</small> : null}
      </label>
      <label className={styles.fullWidth}>คำชี้แจงสำหรับผู้ตอบ (Instructions for respondents)
        <textarea
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          placeholder="เช่น แบบประเมินนี้ใช้เวลาประมาณ 5 นาที คำตอบของท่านจะไม่ถูกเปิดเผยรายบุคคล (ไม่บังคับ)"
          rows={3}
        />
      </label>
      {!isFactory ? (
        <label>Scope
          <select
            value={draft.scope}
            onChange={(event) => setDraft({ ...draft, scope: event.target.value as EvaluationScope })}
          >
            <option value="CENTRAL">Central</option>
            <option value="COMPANY">Company</option>
          </select>
        </label>
      ) : null}
      {!isFactory && draft.scope === "COMPANY" ? (
        <label><span>Company <RequiredIndicator isFilled={Boolean(draft.companyId)} /></span>
          <select
            aria-invalid={Boolean(errors.companyId)}
            className={errors.companyId ? styles.inputError : undefined}
            value={draft.companyId}
            onChange={(event) => {
              setDraft({ ...draft, companyId: event.target.value });
              setErrors((current) => ({ ...current, companyId: undefined }));
            }}
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.companyId} value={company.companyId}>
                {company.companyCode}
              </option>
            ))}
          </select>
          {errors.companyId ? <small>{errors.companyId}</small> : null}
        </label>
      ) : null}
      <label>Timing
        <select
          value={draft.timing}
          onChange={(event) => {
            const nextTiming = event.target.value as TimingLabel;
            setDraft((current) => ({
              ...current,
              timing: nextTiming,
              formCode: mode === "new" ? generateNextEvaluationCode(nextTiming, items) : current.formCode,
            }));
          }}
        >
          <option>After Training</option>
          <option>30-Day Follow-up</option>
        </select>
      </label>
      <label>Respondent
        <select
          value={draft.respondent}
          onChange={(event) => setDraft({ ...draft, respondent: event.target.value as RespondentLabel })}
        >
          <option>Employee</option>
          <option>Manager</option>
        </select>
      </label>
      <label>Evaluation Code
        <input disabled value={draft.formCode} placeholder="Auto-generated" />
      </label>
      <label className={styles.toggleLabel}>
        <input
          checked={draft.anonymous}
          type="checkbox"
          onChange={(event) => setDraft({ ...draft, anonymous: event.target.checked })}
        />
        Anonymous responses
        <small>Hide the respondent identity in evaluation results.</small>
      </label>
    </div>
    <div className={styles.questionBuilder} id={QUESTION_BUILDER_ID}><div className={styles.panelHeader}><div><p className={styles.kicker}>Question builder</p><h3>{editingQuestionId ? "Edit question" : "Add evaluation question"}</h3></div><span>{questions.length} questions</span></div>
      <div className={styles.questionGrid}><label className={styles.fullWidth}><span>Question <RequiredIndicator isFilled={Boolean(questionDraft.prompt.trim())} /></span><textarea aria-invalid={Boolean(errors.question)} className={errors.question ? styles.inputError : undefined} value={questionDraft.prompt} onChange={(event) => { setQuestionDraft({ ...questionDraft, prompt: event.target.value }); setErrors((current) => ({ ...current, question: undefined })); }} placeholder="Enter the question shown to respondents" /></label>
        <label>Answer Type<select value={questionDraft.type} onChange={(event) => setQuestionDraft({ ...questionDraft, type: event.target.value as EvaluationQuestionType })}>{EVALUATION_QUESTION_TYPES.map((type) => <option key={type} value={type}>{QUESTION_TYPE_LABELS[type]}</option>)}</select></label>
        <label className={styles.toggleLabel}><input checked={questionDraft.required} type="checkbox" onChange={(event) => setQuestionDraft({ ...questionDraft, required: event.target.checked })} />Required question</label>
        {isChoiceType(questionDraft.type) ? questionDraft.options.map((option, index) => <label key={`choice-${index}`}>Choice {index + 1}<span style={{ display: "flex", alignItems: "center", gap: "6px" }}><input style={{ flex: 1, minWidth: 0 }} value={option} onChange={(event) => setQuestionDraft({ ...questionDraft, options: questionDraft.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} /><button type="button" title="ลบตัวเลือกนี้ / Remove this option" disabled={questionDraft.options.length <= MIN_OPTIONS} onClick={() => handleRemoveOption(index)} style={{ appearance: "none", border: "none", background: "transparent", color: questionDraft.options.length <= MIN_OPTIONS ? "var(--ui-30-muted)" : "#dc2626", cursor: questionDraft.options.length <= MIN_OPTIONS ? "not-allowed" : "pointer", fontSize: "0.9rem", fontWeight: 900, lineHeight: 1, padding: "2px 4px" }}>✕</button></span></label>) : null}
        {isChoiceType(questionDraft.type) ? <div className={styles.fullWidth}><button className={styles.secondaryButton} type="button" onClick={handleAddOption}>+ เพิ่มตัวเลือก / Add option</button></div> : null}
        {/* A grid asks the same columns about every row, so the two axes are edited as two lists
            rather than one - which is also exactly how they are stored, tagged by axis. */}
        {isGridType(questionDraft.type) ? (["gridRows", "gridColumns"] as const).map((axisField) => (
          <div className={styles.fullWidth} key={axisField}>
            <span className={styles.gridAxisLabel}>
              {axisField === "gridRows" ? t("แถว (Rows)", "Rows") : t("คอลัมน์ (Columns)", "Columns")}
            </span>
            {questionDraft[axisField].map((label, index) => (
              <span className={styles.gridAxisRow} key={`${axisField}-${index}`}>
                <input
                  value={label}
                  placeholder={axisField === "gridRows" ? t(`แถวที่ ${index + 1}`, `Row ${index + 1}`) : t(`คอลัมน์ที่ ${index + 1}`, `Column ${index + 1}`)}
                  onChange={(event) => setQuestionDraft({
                    ...questionDraft,
                    [axisField]: questionDraft[axisField].map((item, itemIndex) => itemIndex === index ? event.target.value : item),
                  })}
                />
                <button
                  type="button"
                  className={styles.gridAxisRemove}
                  title={t("ลบรายการนี้", "Remove this entry")}
                  disabled={questionDraft[axisField].length <= (axisField === "gridRows" ? MIN_GRID_ROWS : MIN_GRID_COLUMNS)}
                  onClick={() => setQuestionDraft({
                    ...questionDraft,
                    [axisField]: questionDraft[axisField].filter((unused, itemIndex) => itemIndex !== index),
                  })}
                >✕</button>
              </span>
            ))}
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setQuestionDraft({ ...questionDraft, [axisField]: [...questionDraft[axisField], ""] })}
            >
              {axisField === "gridRows" ? t("+ เพิ่มแถว", "+ Add row") : t("+ เพิ่มคอลัมน์", "+ Add column")}
            </button>
          </div>
        )) : null}
      </div>
      {questionDraft.type === "RATING" ? <p className={styles.helperText}>Rating uses the standard five-point scale from Strongly disagree to Strongly agree.</p> : null}
      {errors.question ? <p className={styles.validationMessage} role="alert">{errors.question}</p> : null}
      <div className={styles.formActions}><button className={styles.secondaryButton} type="button" onClick={handleAddQuestion}>{editingQuestionId ? "Update question" : "Add question"}</button>{editingQuestionId ? <button className={styles.closeButton} type="button" onClick={resetQuestionEditor}>Cancel question edit</button> : null}</div>
    </div>
    {/* Same two-view contract as Assessment: the author view is where questions are built and
        reordered, the learner view is a real rehearsal of the paged, branching form. Without the
        toggle the author could only see sections and branches after publishing. */}
    <div className={styles.previewPanel} id={LEARNER_PREVIEW_ID}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>
            {previewAsLearner ? "Try it as a learner" : `Live preview (${questions.length} ข้อ)`}
          </p>
          <h3>
            {previewAsLearner
              ? t("ทดลองตอบเหมือนที่พนักงานจะเห็น", "Try it the way an employee will see it")
              : draft.formName.trim() || "Untitled evaluation form"}
          </h3>
        </div>
        <div className={styles.previewHeaderSide}>
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
          <span>{draft.timing} · {draft.respondent}</span>
        </div>
      </div>
      {previewAsLearner ? (
        questions.length ? (
          <FormPreviewRunner
            title={draft.formName.trim() || "Untitled evaluation form"}
            instructions={draft.description}
            meta={`${draft.timing} · ${draft.respondent}`}
            items={toPreviewItems(questions)}
          />
        ) : (
          <div className={styles.emptyState}>{t("ยังไม่มีคำถามให้ทดลองตอบ", "No questions to try yet")}</div>
        )
      ) : (
        <div className={styles.previewCanvas}>
          {renderQuestionPreview(questions, "editor-preview", true)}
          <FormItemToolbar anchorTop={anchorTop} onAdd={handleToolbarAdd} />
        </div>
      )}
    </div>
    {errors.questions ? <p className={styles.validationMessage} role="alert">{errors.questions}</p> : null}
    <div className={styles.editorActions}><button className={styles.closeButton} type="button" onClick={closeEditor}>Cancel</button><button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void handleSave()}>Save evaluation</button></div>
  </section>;

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px", padding: "40px" }}>
        <TypewriterLoader label="กำลังโหลดข้อมูลแบบประเมิน (Evaluation)..." />
      </div>
    );
  }

  return (
    <section className={styles.page} aria-label="Evaluation Management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{evaluationManagementModule.subtitle}</p>
          <h2>{evaluationManagementModule.title}</h2>
          <p>{evaluationManagementModule.description}</p>
        </div>
      </section>
      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <span className={styles.listMeta}>
            {visible.length} / {items.length} แบบประเมิน
          </span>
          <input
            aria-label="Search evaluation"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหารหัส, ชื่อแบบประเมิน, ช่วงเวลา, ผู้ตอบ, ขอบเขต, สถานะ..."
          />
          {!isFactory ? (
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
          <button className={styles.primaryButton} type="button" disabled={busy} onClick={handleNew}>
            + เพิ่มแบบประเมิน
          </button>
          <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void load()}>
            รีเฟรช
          </button>
          {SHOW_CSV_EXPORT ? (
            <button className={styles.secondaryButton} type="button" onClick={handleExport}>
              ส่งออก CSV
            </button>
          ) : null}
        </div>
        {mode !== "idle" ? renderEditor() : null}
        {!visible.length ? (
          <div className={styles.emptyState}>
            {busy ? "Loading evaluations..." : "No evaluations yet. Select New to create the first form."}
          </div>
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
          <table className={styles.evaluationTable}>
            <thead>
              <tr>
                <th>รหัสแบบประเมิน</th>
                <th>ชื่อแบบประเมิน</th>
                <th>ช่วงเวลา</th>
                <th>กลุ่มผู้ตอบ</th>
                <th>ขอบเขต</th>
                <th>จำนวนคำถาม</th>
                <th>สถานะ</th>
                <th style={{ textAlign: "right" }}>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
                  {group.rows.map((item) => {
                const isSelected = item.evaluationFormId === selectedId;
                const isOpen = item.evaluationFormId === openDetailId;
                const draftQuestions = toDraftQuestions(item);
                const status = statusFromApi(item.status);
                const statusClass =
                  status === "Published"
                    ? styles.statusPublished
                    : status === "Draft"
                      ? styles.statusDraft
                      : styles.statusInactive;
                return (
                  <Fragment key={item.evaluationFormId}>
                    <tr
                      aria-selected={isSelected}
                      tabIndex={0}
                      className={`${styles.selectableRow} ${isSelected ? styles.selectedRow : ""}`}
                      onClick={() => {
                        setSelectedId(isSelected ? "" : item.evaluationFormId);
                        setOpenDetailId("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(isSelected ? "" : item.evaluationFormId);
                          setOpenDetailId("");
                        }
                      }}
                    >
                      <td>{item.formCode}</td>
                      <td>{item.formName}</td>
                      <td>{timingFromApi(item.timing)}</td>
                      <td>{respondentFromApi(item.respondentType)}</td>
                      <td>{item.scope === "CENTRAL" ? "Central" : `Company · ${item.companyCode}`}</td>
                      <td>{item.questions.length}</td>
                      {/* The pill IS the switch - see Assessment. A DRAFT keeps the plain badge. */}
                      <td onClick={(event) => event.stopPropagation()}>
                        {item.status !== "DRAFT" && canOwn(item) ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.status === "PUBLISHED"}
                            aria-label={item.status === "PUBLISHED" ? "ปิดใช้งานแบบประเมินนี้" : "เปิดใช้งานแบบประเมินนี้"}
                            title={item.status === "PUBLISHED" ? "กดเพื่อปิดใช้งาน" : "กดเพื่อเปิดใช้งาน"}
                            className={`${styles.statusPill} ${statusClass} ${styles.statusToggle}`}
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation();
                              void changeStatus(item, item.status === "PUBLISHED" ? "INACTIVE" : "PUBLISHED");
                            }}
                          >
                            <span className={styles.statusToggleKnob} aria-hidden="true" />
                            <span>{status}</span>
                          </button>
                        ) : (
                          <span className={`${styles.statusPill} ${statusClass}`}>{status}</span>
                        )}
                      </td>
                      <td className={styles.actionCell} onClick={(event) => event.stopPropagation()}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                          <button
                            className={styles.detailButton}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(item.evaluationFormId);
                              setOpenDetailId(isOpen ? "" : item.evaluationFormId);
                              setDetailAsLearner(false);
                            }}
                          >
                            {isOpen ? "Hide" : "Preview"}
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
                            title={item.canModify ? "" : item.isUsed ? "ถูกใช้งานแล้ว แก้ไขไม่ได้ — ปิดใช้งานหรือใช้เป็นแม่แบบแทน" : "แบบประเมินของส่วนกลาง ดูได้อย่างเดียว"}
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
                            title={item.canModify ? "" : item.isUsed ? "ถูกผูกกับหลักสูตร/แผนอบรม หรือมีพนักงานตอบไปแล้ว ลบไม่ได้" : "แบบประเมินของส่วนกลาง ดูได้อย่างเดียว"}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(item.evaluationFormId);
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
                        <td colSpan={8}>
                          <div className={styles.detailPanel}>
                            <div className={styles.panelHeader}>
                              <div>
                                <p className={styles.kicker}>{detailAsLearner ? "Try it as a learner" : "Evaluation preview"}</p>
                                <h3>{item.formName}</h3>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <button
                                  type="button"
                                  className={styles.secondaryButton}
                                  aria-label={detailAsLearner ? "กลับไปมุมมองผู้จัดทำ" : "ทดลองตอบแบบผู้เรียน"}
                                  title={detailAsLearner ? "กลับไปมุมมองผู้จัดทำ" : "ทดลองตอบแบบผู้เรียน"}
                                  onClick={() => setDetailAsLearner((current) => !current)}
                                >
                                  👁
                                </button>
                                <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>
                                  Close
                                </button>
                              </div>
                            </div>
                            <div className={styles.detailMeta}>
                              <article>
                                <span>Timing</span>
                                <strong>{timingFromApi(item.timing)}</strong>
                              </article>
                              <article>
                                <span>Respondent</span>
                                <strong>{respondentFromApi(item.respondentType)}</strong>
                              </article>
                              <article>
                                <span>Scope</span>
                                <strong>{item.companyCode ?? "All companies"}</strong>
                              </article>
                              <article>
                                <span>Response identity</span>
                                <strong>{item.isAnonymous ? "Anonymous" : "Identified"}</strong>
                              </article>
                            </div>
                            {detailAsLearner ? (
                              <FormPreviewRunner
                                title={item.formName}
                                instructions={item.description}
                                meta={`${timingFromApi(item.timing)} · ${respondentFromApi(item.respondentType)}`}
                                items={toPreviewItems(draftQuestions)}
                                emptyLabel="ยังไม่มีคำถามให้ทดลองตอบ"
                              />
                            ) : draftQuestions.length ? (
                              <div className={styles.questionList}>
                                {draftQuestions.map((detail, index) => (
                                  <article key={detail.id} data-block={isFormBlockType(detail.type) ? detail.type : undefined}>
                                    <strong>
                                      {/* Blocks are not questions, so they take no number - otherwise
                                          a form with two sections reads as having two extra items. */}
                                      {isFormBlockType(detail.type)
                                        ? detail.prompt
                                        : `${draftQuestions.slice(0, index + 1).filter((row) => !isFormBlockType(row.type)).length}. ${detail.prompt}`}
                                    </strong>
                                    <span>
                                      {isFormBlockType(detail.type)
                                        ? (detail.type === "SECTION_BREAK" ? "Section" : "Text")
                                        : QUESTION_TYPE_LABELS[detail.type as EvaluationQuestionType]}
                                    </span>
                                    {isFormBlockType(detail.type) && detail.description.trim()
                                      ? <p className={styles.blockBodyStatic}>{detail.description}</p>
                                      : null}
                                    {isChoiceType(detail.type)
                                      ? detail.options.filter(Boolean).map((option, optionIndex) => (
                                          <p key={`${detail.id}-${optionIndex}`}>
                                            {String.fromCharCode(65 + optionIndex)}. {option}
                                          </p>
                                        ))
                                      : null}
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <div className={styles.emptyState}>No questions yet.</div>
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
    </section>
  );
}
