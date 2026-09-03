"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import {
  createAssessment,
  createAssessmentVersion,
  deleteAssessment,
  listAssessments,
  setAssessmentStatus,
  updateAssessment,
} from "../../../../lib/assessments/client";
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
const scrollToQuestionBuilder = () =>
  document.getElementById(QUESTION_BUILDER_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });

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
});
const blankChoices = (count = DEFAULT_CHOICE_COUNT): DraftChoice[] =>
  Array.from({ length: count }, (_, index) => blankChoice(index === 0));

/** TRUE_FALSE is stored as an ordinary two-choice question; the DB check constraint accepts the
 *  type, and the runner renders it as a single-answer question like SINGLE_CHOICE. */
const trueFalseChoices = (): DraftChoice[] => [
  { id: key(), choiceText: "True", isCorrect: true, optionScore: "1" },
  { id: key(), choiceText: "False", isCorrect: false, optionScore: "0" },
];
const blankQuestion = (): DraftQuestion => ({
  id: key(),
  questionText: "",
  questionType: "SINGLE_CHOICE",
  questionScore: "1",
  isRequired: true,
  choices: blankChoices(),
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
      isRequired: question.isRequired,
      choices,
    };
  });

const displayQuestionType = (value: AssessmentRecord["questions"][number]["questionType"]) =>
  value === "SHORT_ANSWER" ? "Text" : "Choice";

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
  const [mode, setMode] = useState<Mode>("idle");
  const [draft, setDraft] = useState<Draft>(() => blankDraft(user?.companyId ?? "", !isCenter));
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [question, setQuestion] = useState<DraftQuestion>(blankQuestion);
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
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

      const choices = current.choices.length >= MIN_CHOICES ? [...current.choices] : blankChoices();
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
    if (!question.questionText.trim() || Number(question.questionScore) <= 0) {
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
    const next = { ...question, questionText: question.questionText.trim() };
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
  const duplicateQuestion = (index: number) =>
    setQuestions((current) => {
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const dropQuestionOn = (targetIndex: number) => {
    setQuestions((current) => {
      if (dragIndex === null || dragIndex === targetIndex) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered;
    });
    setDragIndex(null);
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((current) => {
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
    questions: questions.map(({ questionText, questionType, questionScore, isRequired, choices }) => ({
      questionText,
      // The draft already holds the stored value - no lossy round trip through a UI-only label.
      questionType,
      questionScore,
      isRequired,
      choices: isChoiceType(questionType)
        ? choices.map(({ choiceText, isCorrect }) => ({
            choiceText,
            isCorrect,
            optionScore: isCorrect ? questionScore : "0",
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
    if (draft.status === "ACTIVE" && !questions.length) errors.questions = "Add at least one question before publishing.";
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
        questions: item.questions.map((q) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          questionScore: String(q.questionScore),
          isRequired: q.isRequired,
          choices: q.choices.map((c) => ({
            choiceText: c.choiceText,
            isCorrect: c.isCorrect,
            optionScore: String(c.optionScore),
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
              <option value="SINGLE_CHOICE">Single Choice (ปรนัย - ตอบได้ 1 ข้อ)</option>
              <option value="MULTIPLE_CHOICE">Multiple Choice (ปรนัย - ตอบได้หลายข้อ)</option>
              <option value="TRUE_FALSE">True / False (ถูก - ผิด)</option>
              <option value="SHORT_ANSWER">Short Answer (อัตนัย / เติมคำ)</option>
            </select>
          </label>

          <label>
            <span>คะแนนข้อนี้ (Score) <RequiredIndicator isFilled={Boolean(Number(question.questionScore) > 0)} /></span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={question.questionScore}
              onChange={(event) => setQuestion({ ...question, questionScore: event.target.value })}
            />
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

      <div className={styles.previewPanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Question List ({questions.length} ข้อ)</p>
            <h3>รายการคำถามในชุดแบบทดสอบนี้</h3>
          </div>
        </div>
        {questions.length ? (
          <div className={styles.questionList}>
            {questions.map((item, index) => (
              <article
                key={item.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropQuestionOn(index)}
                data-dragging={dragIndex === index}
              >
                <div className={styles.questionHeading}>
                  <strong>
                    <span className={styles.dragHandle} aria-hidden="true" title="ลากเพื่อสลับลำดับ / Drag to reorder">⠿</span>
                    {index + 1}. {item.questionText}
                    {item.isRequired ? <em className={styles.requiredMark}> *</em> : null}
                  </strong>
                  <span>{item.questionType} · {item.questionScore} คะแนน</span>
                </div>
                {item.choices.map((choice, choiceIndex) => (
                  <p key={choice.id} style={{ color: choice.isCorrect ? "#10b981" : undefined, fontWeight: choice.isCorrect ? 700 : undefined }}>
                    {choice.isCorrect ? "[Correct] " : ""}{String.fromCharCode(65 + choiceIndex)}. {choice.choiceText}
                  </p>
                ))}
                <div className={styles.questionActions}>
                  <button className={styles.secondaryButton} type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>
                    Move Up
                  </button>
                  <button className={styles.secondaryButton} type="button" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)}>
                    Move Down
                  </button>
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
                    onClick={() => setQuestions((current) => current.filter((candidate) => candidate.id !== item.id))}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
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
          return (
          <section className={`${styles.companyGroup} ${groupOpen ? styles.openGroup : ""}`} key={`group-${group.code}`}>
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
                                {item.scope} · {item.purpose} · v{item.versionNo}
                              </p>
                              <h3>{item.seriesName}</h3>
                            </div>
                            <span>{item.isUsed ? "Locked — already in use" : "Unused"}</span>
                          </div>
                          <p>{item.instructions || "No instructions"}</p>
                          {item.questions.length ? (
                            <div className={styles.questionList}>
                              {item.questions.map((detail, index) => (
                                <article key={detail.questionId}>
                                  <strong>
                                    {index + 1}. {detail.questionText}
                                  </strong>
                                  <span>
                                    {displayQuestionType(detail.questionType)} · {detail.questionScore} points
                                  </span>
                                  {detail.choices.map((choice, choiceIndex) => (
                                    <p key={choice.choiceId}>
                                      {choice.isCorrect ? "[Correct] " : ""}
                                      {String.fromCharCode(65 + choiceIndex)}. {choice.choiceText}
                                    </p>
                                  ))}
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className={styles.emptyState}>This draft does not have questions yet.</div>
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
