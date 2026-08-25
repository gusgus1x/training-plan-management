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
  const toast = useToast();
  // Same call shape as the old banner state, routed to the global toast instead.
  const setFeedback = useCallback(
    (next: Feedback | null) => {
      if (next) toast[next.tone](next.message);
    },
    [toast],
  );
  const [formErrors, setFormErrors] = useState<FormErrors>({});

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
        isCenter ? listCompanies() : Promise.resolve({ items: [] as CompanyRecord[] }),
      ]);
      setItems(assessmentResult.items);
      setCompanies(companyResult.items);
      setSelectedId((current) => assessmentResult.items.some((item) => item.assessmentId === current) ? current : "");
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to load assessments" });
    } finally {
      setBusy(false);
    }
  }, [isCenter, setFeedback]);

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
    setDraft(blankDraft(user?.companyId ?? "", !isCenter));
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
    if (draft.status === "ACTIVE" && !(await confirm({ message: "Publish this assessment? It will become selectable as a live pre/post-test on courses immediately.", confirmLabel: "Publish" }))) {
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

  const remove = async () => {
    if (!selected?.canModify) return;
    if (!(await confirm({ message: `Delete "${selected.seriesName}"?`, confirmLabel: "Delete", danger: true }))) return;
    setBusy(true);
    try {
      await deleteAssessment(selected.assessmentId);
      setSelectedId("");
      setOpenDetailId("");
      closeEditor();
      await load();
      setFeedback({ tone: "success", message: "Assessment deleted." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete assessment" });
    } finally { setBusy(false); }
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
        <div><p className={styles.kicker}>{mode === "new" ? "New assessment" : mode === "version" ? "New version" : "Edit assessment"}</p><h3>{mode === "new" ? "Create assessment series" : selected?.seriesName}</h3></div>
        <button className={styles.closeButton} type="button" onClick={closeEditor}>Close</button>
      </div>
      <div className={styles.formGrid}>
        {isCenter ? <label>Scope<select disabled={mode === "version"} value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value as AssessmentScope })}><option value="CENTRAL">Central</option><option value="COMPANY">Company</option></select></label> : null}
        {isCenter && draft.scope === "COMPANY" ? <label>Company<select aria-invalid={Boolean(formErrors.companyId)} className={formErrors.companyId ? styles.inputError : undefined} disabled={mode === "version"} value={draft.companyId} onChange={(event) => { setDraft({ ...draft, companyId: event.target.value }); setFormErrors((current) => ({ ...current, companyId: undefined })); }}><option value="">Select company</option>{companies.map((company) => <option key={company.companyId} value={company.companyId}>{company.companyCode} — {company.companyNameTh}</option>)}</select>{formErrors.companyId ? <small>{formErrors.companyId}</small> : null}</label> : null}
        <label>Assessment Code<input aria-invalid={Boolean(formErrors.seriesCode)} className={formErrors.seriesCode ? styles.inputError : undefined} disabled maxLength={50} value={draft.seriesCode} placeholder="Auto-generated on save" />{formErrors.seriesCode ? <small>{formErrors.seriesCode}</small> : null}</label>
        <label>Series Name<input aria-invalid={Boolean(formErrors.seriesName)} className={formErrors.seriesName ? styles.inputError : undefined} disabled={mode === "version"} maxLength={255} value={draft.seriesName} onChange={(event) => { setDraft({ ...draft, seriesName: event.target.value }); setFormErrors((current) => ({ ...current, seriesName: undefined })); }} />{formErrors.seriesName ? <small>{formErrors.seriesName}</small> : null}</label>
        <label>Purpose<select disabled={mode === "version"} value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value as AssessmentPurpose })}><option value="PRE_TEST">PRE TEST</option><option value="POST_TEST">POST TEST</option><option value="GENERAL">GENERAL</option></select></label>
        <label>Passing Score (%)<input aria-invalid={Boolean(formErrors.passingScorePercent)} className={formErrors.passingScorePercent ? styles.inputError : undefined} type="number" min="0" max="100" step="0.01" value={draft.passingScorePercent} onChange={(event) => { setDraft({ ...draft, passingScorePercent: event.target.value }); setFormErrors((current) => ({ ...current, passingScorePercent: undefined })); }} />{formErrors.passingScorePercent ? <small>{formErrors.passingScorePercent}</small> : null}</label>
        <label>Time Limit (minutes)<input aria-invalid={Boolean(formErrors.timeLimitMinutes)} className={formErrors.timeLimitMinutes ? styles.inputError : undefined} type="number" min="1" value={draft.timeLimitMinutes} onChange={(event) => { setDraft({ ...draft, timeLimitMinutes: event.target.value }); setFormErrors((current) => ({ ...current, timeLimitMinutes: undefined })); }} placeholder="Optional" />{formErrors.timeLimitMinutes ? <small>{formErrors.timeLimitMinutes}</small> : null}</label>
        <label>Status<select disabled={mode === "version"} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as AssessmentStatus })}>{statusOptions(mode === "edit" ? selected?.status : undefined).map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className={styles.fullWidth}>Version Note<input maxLength={500} value={draft.versionNote} onChange={(event) => setDraft({ ...draft, versionNote: event.target.value })} placeholder="Optional" /></label>
        <label className={styles.fullWidth}>Instructions<textarea value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} placeholder="Instructions shown to learners" /></label>
      </div>

      <div className={styles.questionBuilder}>
        <div className={styles.panelHeader}><div><p className={styles.kicker}>Question builder</p><h3>{editingQuestionId ? "Edit question" : "Add question"}</h3></div><span>{questions.length} questions</span></div>
        <div className={styles.questionGrid}>
          <label className={styles.fullWidth}>Question<textarea aria-invalid={Boolean(formErrors.question)} className={formErrors.question ? styles.inputError : undefined} value={question.questionText} onChange={(event) => { setQuestion({ ...question, questionText: event.target.value }); setFormErrors((current) => ({ ...current, question: undefined })); }} /></label>
          <label>Question Type<select value={question.questionType} onChange={(event) => setQuestionType(event.target.value as MockQuestionType)}><option value="Choice">Choice</option><option value="Text">Text</option></select></label>
          <label>Score<input type="number" min="0.01" step="0.01" value={question.questionScore} onChange={(event) => setQuestion({ ...question, questionScore: event.target.value })} /></label>
          <label>Required<select value={question.isRequired ? "YES" : "NO"} onChange={(event) => setQuestion({ ...question, isRequired: event.target.value === "YES" })}><option value="YES">Yes</option><option value="NO">No</option></select></label>
          {question.choices.map((choice, index) => <label key={choice.id}>Option {String.fromCharCode(65 + index)}<input value={choice.choiceText} onChange={(event) => setQuestion({ ...question, choices: question.choices.map((item) => item.id === choice.id ? { ...item, choiceText: event.target.value } : item) })} /></label>)}
          {question.questionType === "Choice" ? <label>Correct Answer<select value={String.fromCharCode(65 + Math.max(0, question.choices.findIndex((choice) => choice.isCorrect)))} onChange={(event) => { const correctIndex = event.target.value.charCodeAt(0) - 65; setQuestion({ ...question, choices: question.choices.map((choice, index) => ({ ...choice, isCorrect: index === correctIndex })) }); }}>{question.choices.map((choice, index) => <option key={choice.id} value={String.fromCharCode(65 + index)}>{String.fromCharCode(65 + index)}</option>)}</select></label> : null}
        </div>
        {formErrors.question ? <p className={styles.validationMessage} role="alert">{formErrors.question}</p> : null}
        <div className={styles.formActions}>
          <button className={styles.secondaryButton} type="button" onClick={saveQuestion}>{editingQuestionId ? "Update question" : "Add question"}</button>
          {editingQuestionId ? <button className={styles.closeButton} type="button" onClick={() => { setQuestion(blankQuestion()); setEditingQuestionId(""); setFormErrors((current) => ({ ...current, question: undefined })); }}>Cancel question edit</button> : null}
          <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void save()}>Save assessment</button>
        </div>
        {formErrors.questions ? <p className={styles.validationMessage} role="alert">{formErrors.questions}</p> : null}
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.panelHeader}><div><p className={styles.kicker}>Preview</p><h3>Question preview</h3></div></div>
        {questions.length ? <div className={styles.questionList}>{questions.map((item, index) => <article key={item.id}>
          <div className={styles.questionHeading}><strong>{index + 1}. {item.questionText}</strong><span>{item.questionType} · {item.questionScore} points</span></div>
          {item.choices.map((choice, choiceIndex) => <p key={choice.id}>{choice.isCorrect ? "✓ " : ""}{String.fromCharCode(65 + choiceIndex)}. {choice.choiceText}</p>)}
          <div className={styles.questionActions}><button className={styles.secondaryButton} type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>Up</button><button className={styles.secondaryButton} type="button" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)}>Down</button><button className={styles.secondaryButton} type="button" onClick={() => { setQuestion(item); setEditingQuestionId(item.id); setFormErrors((current) => ({ ...current, question: undefined })); }}>Edit</button><button className={styles.dangerButton} type="button" onClick={() => setQuestions((current) => current.filter((candidate) => candidate.id !== item.id))}>Remove</button></div>
        </article>)}</div> : <div className={styles.emptyState}>No questions added yet.</div>}
      </div>
    </section>
  );

  return <section className={styles.page} aria-label="Assessment management">
    <section className={styles.hero}><div><p className={styles.kicker}>{assessmentModule.subtitle}</p><h2>{assessmentModule.title}</h2><p>{assessmentModule.description}</p></div></section>
    <section className={styles.workspace}>
      <div className={styles.toolbar}>
        <span className={styles.listMeta}>{visible.length} / {items.length} assessments</span>
        <input aria-label="Search assessment" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code, name, company, purpose, status" />
        <button className={styles.primaryButton} type="button" disabled={busy} onClick={startNew}>New</button>
        <button className={styles.secondaryButton} type="button" disabled={busy || !selected?.canModify} onClick={startEdit}>Edit</button>
        <button className={styles.secondaryButton} type="button" disabled={busy || !selected?.canCreateVersion} onClick={startVersion}>New Version</button>
        <button className={styles.dangerButton} type="button" disabled={busy || !selected?.canModify} onClick={() => void remove()}>Delete</button>
        <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void load()}>Refresh</button>
        <button className={styles.secondaryButton} type="button" onClick={exportCsv}>Export</button>
      </div>
      {mode !== "idle" ? renderEditor() : null}
            <div className={styles.tableWrap}><table className={styles.assessmentTable}><thead><tr><th>Code</th><th>Assessment Name</th><th>Scope</th><th>Purpose</th><th>Version</th><th>Pass</th><th>Questions</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {!visible.length ? <tr><td className={styles.emptyTableCell} colSpan={9}>{busy ? "Loading assessments..." : "No assessments found."}</td></tr> : null}
        {visible.map((item) => {
          const isSelected = item.assessmentId === selectedId;
          const isOpen = item.assessmentId === openDetailId;
          const statusClass = item.status === "ACTIVE" ? styles.statusPublished : item.status === "DRAFT" ? styles.statusDraft : styles.statusInactive;
          return <Fragment key={item.assessmentId}><tr aria-selected={isSelected} tabIndex={0} className={`${styles.selectableRow} ${isSelected ? styles.selectedRow : ""}`} onClick={() => { setSelectedId(isSelected ? "" : item.assessmentId); setOpenDetailId(""); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(isSelected ? "" : item.assessmentId); setOpenDetailId(""); } }}><td>{item.seriesCode}</td><td>{item.seriesName}</td><td>{item.companyCode ?? "Central"}</td><td>{item.purpose}</td><td>v{item.versionNo}</td><td>{item.passingScorePercent}%</td><td>{item.questions.length}</td><td><span className={`${styles.statusPill} ${statusClass}`}>{item.status}</span></td><td className={styles.actionCell}><button className={styles.detailButton} type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(item.assessmentId); setOpenDetailId(isOpen ? "" : item.assessmentId); }}>{isOpen ? "Hide" : "Details"}</button></td></tr>
            {isOpen ? <tr className={styles.detailRow}><td colSpan={9}><div className={styles.detailPanel}><div className={styles.panelHeader}><div><p className={styles.kicker}>{item.scope} · {item.purpose} · v{item.versionNo}</p><h3>{item.seriesName}</h3></div><span>{item.isUsed ? "Locked — already in use" : "Unused"}</span></div><p>{item.instructions || "No instructions"}</p>{item.questions.length ? <div className={styles.questionList}>{item.questions.map((detail, index) => <article key={detail.questionId}><strong>{index + 1}. {detail.questionText}</strong><span>{displayQuestionType(detail.questionType)} · {detail.questionScore} points</span>{detail.choices.map((choice, choiceIndex) => <p key={choice.choiceId}>{choice.isCorrect ? "✓ " : ""}{String.fromCharCode(65 + choiceIndex)}. {choice.choiceText}</p>)}</article>)}</div> : <div className={styles.emptyState}>This draft does not have questions yet.</div>}</div></td></tr> : null}
          </Fragment>;
        })}
      </tbody></table></div>
    </section>
  </section>;
}
