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
type MockQuestionType = "Choice" | "Text";
type DraftQuestion = Omit<AssessmentQuestionInput, "choices" | "questionType"> & {
  id: string;
  questionType: MockQuestionType;
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
const blankChoices = (): DraftChoice[] => [
  { id: key(), choiceText: "", isCorrect: true, optionScore: "1" },
  { id: key(), choiceText: "", isCorrect: false, optionScore: "0" },
  { id: key(), choiceText: "", isCorrect: false, optionScore: "0" },
  { id: key(), choiceText: "", isCorrect: false, optionScore: "0" },
];
const blankQuestion = (): DraftQuestion => ({
  id: key(),
  questionText: "",
  questionType: "Choice",
  questionScore: "1",
  isRequired: true,
  choices: blankChoices(),
});

const toDraftQuestions = (record: AssessmentRecord): DraftQuestion[] =>
  record.questions.map((question) => {
    const questionType: MockQuestionType = question.questionType === "SHORT_ANSWER" ? "Text" : "Choice";
    const storedChoices = question.choices.slice(0, 4).map((choice, index) => ({
      id: choice.choiceId,
      choiceText: choice.choiceText,
      isCorrect: questionType === "Choice" && index === question.choices.findIndex((candidate) => candidate.isCorrect),
      optionScore: choice.optionScore,
    }));
    const choices = questionType === "Choice"
      ? [...storedChoices, ...blankChoices()].slice(0, 4)
      : [];
    if (questionType === "Choice") {
      const correctIndex = Math.max(0, choices.findIndex((choice) => choice.isCorrect));
      choices.forEach((choice, index) => { choice.isCorrect = index === correctIndex; });
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
    return query
      ? items.filter((item) => [item.seriesCode, item.seriesName, item.companyCode, item.purpose, item.status]
        .filter(Boolean).join(" ").toLowerCase().includes(query))
      : items;
  }, [items, search]);

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

  const setQuestionType = (questionType: MockQuestionType) => {
    setQuestion((current) => ({
      ...current,
      questionType,
      choices: questionType === "Text"
        ? []
        : [...current.choices, ...blankChoices()].slice(0, 4),
    }));
  };

  const saveQuestion = () => {
    if (!question.questionText.trim() || Number(question.questionScore) <= 0) {
      setFormErrors((current) => ({ ...current, question: "Enter a question and a positive score before adding it." }));
      setFeedback({ tone: "error", message: "Question text and a positive score are required." });
      return;
    }
    if (question.questionType === "Choice" && (question.choices.length !== 4 || question.choices.some((choice) => !choice.choiceText.trim()))) {
      setFormErrors((current) => ({ ...current, question: "Choice questions require Option A, B, C, and D." }));
      setFeedback({ tone: "error", message: "Complete all four answer options." });
      return;
    }
    const correctCount = question.choices.filter((choice) => choice.isCorrect).length;
    if (question.questionType === "Choice" && correctCount !== 1) {
      setFormErrors((current) => ({ ...current, question: "Select exactly one correct answer." }));
      setFeedback({ tone: "error", message: "Select exactly one correct answer." });
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
      questionType: questionType === "Choice" ? "SINGLE_CHOICE" : "SHORT_ANSWER",
      questionScore,
      isRequired,
      choices: questionType === "Choice"
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

        <label>
          <span>Purpose (วัตถุประสงค์) <RequiredIndicator isFilled={Boolean(draft.purpose)} /></span>
          <select
            disabled={mode === "version"}
            value={draft.purpose}
            onChange={(event) => updateDraftField("purpose", event.target.value as AssessmentPurpose)}
          >
            <option value="PRE_TEST">PRE TEST (ทดสอบก่อนเรียน)</option>
            <option value="POST_TEST">POST TEST (ทดสอบหลังเรียน)</option>
            <option value="GENERAL">GENERAL (แบบทดสอบทั่วไป)</option>
          </select>
        </label>

        <label>
          <span>Assessment Code <RequiredIndicator isFilled={Boolean(draft.seriesCode.trim())} /></span>
          <input
            aria-invalid={Boolean(formErrors.seriesCode)}
            className={formErrors.seriesCode ? styles.inputError : undefined}
            disabled={mode === "version"}
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

      <div className={styles.questionBuilder}>
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
              onChange={(event) => setQuestionType(event.target.value as MockQuestionType)}
            >
              <option value="Choice">Choice (ปรนัย - 4 ตัวเลือก)</option>
              <option value="Text">Text (อัตนัย / เติมคำ)</option>
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

          {question.questionType === "Choice" ? (
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
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 }}>
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={choice.isCorrect}
                          onChange={() => {
                            setQuestion({
                              ...question,
                              choices: question.choices.map((item, idx) => ({ ...item, isCorrect: idx === index })),
                            });
                          }}
                        />
                        <span style={{ color: choice.isCorrect ? "#10b981" : "var(--ui-30-muted)" }}>Correct</span>
                      </label>
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
              <article key={item.id}>
                <div className={styles.questionHeading}>
                  <strong>{index + 1}. {item.questionText}</strong>
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
                    }}
                  >
                    Edit
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
        <button className={styles.primaryButton} type="button" disabled={busy} onClick={startNew}>+ เพิ่มแบบทดสอบ</button>
        <button className={styles.secondaryButton} type="button" disabled={busy || !selected?.canModify} onClick={startEdit}>แก้ไข</button>
        <button className={styles.secondaryButton} type="button" disabled={busy || !selected?.canCreateVersion} onClick={startVersion}>สร้างเวอร์ชันใหม่</button>
        <button className={styles.dangerButton} type="button" disabled={busy || !selected?.canModify} onClick={() => void remove()}>ลบ</button>
        <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void load()}>รีเฟรช</button>
        <button className={styles.secondaryButton} type="button" onClick={exportCsv}>ส่งออก CSV</button>
      </div>
      {mode !== "idle" ? renderEditor() : null}
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
            {!visible.length ? (
              <tr>
                <td className={styles.emptyTableCell} colSpan={9}>
                  {busy ? "กำลังโหลดข้อมูลแบบทดสอบ..." : "ไม่พบรายการแบบทดสอบ"}
                </td>
              </tr>
            ) : null}
            {visible.map((item) => {
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
                    <td>
                      <span className={`${styles.statusPill} ${statusClass}`}>{item.status}</span>
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
    </section>
  </section>;
}
