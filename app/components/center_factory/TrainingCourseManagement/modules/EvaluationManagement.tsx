"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { listCompanies } from "../../../../lib/companies/client";
import type { CompanyRecord } from "../../../../lib/companies/types";
import {
  createEvaluation,
  deleteEvaluation,
  listEvaluations,
  updateEvaluation,
} from "../../../../lib/evaluations/client";
import type {
  EvaluationQuestionType,
  EvaluationRecord,
  EvaluationRespondent,
  EvaluationScope,
  EvaluationStatus,
  EvaluationTiming,
  EvaluationWriteInput,
} from "../../../../lib/evaluations/types";
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
type QuestionTypeLabel = "Rating" | "Single Choice" | "Text";
type EvaluationSection = "Course Content" | "Instructor" | "Learning Experience" | "Application & Impact" | "Comments";
type Feedback = { tone: "success" | "error" | "info"; message: string };
type FormErrors = Partial<Record<"name" | "companyId" | "questions" | "question", string>>;
type Draft = {
  formCode: string;
  formName: string;
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
  type: QuestionTypeLabel;
  section: EvaluationSection;
  required: boolean;
  options: string[];
};

const sections: EvaluationSection[] = ["Course Content", "Instructor", "Learning Experience", "Application & Impact", "Comments"];
const ratingOptions = ["1 - Strongly disagree", "2 - Disagree", "3 - Neutral", "4 - Agree", "5 - Strongly agree"];
const key = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const blankDraft = (companyId = "", factory = false): Draft => ({
  formCode: "",
  formName: "",
  scope: factory ? "COMPANY" : "CENTRAL",
  companyId,
  timing: "After Training",
  respondent: "Employee",
  anonymous: true,
  status: "Draft",
});
/** Choice questions accept any option count from two upwards (see handleAddQuestion's check and
 *  app/lib/evaluations validation); four is only the count a brand-new question starts with. */
const MIN_OPTIONS = 2;
const DEFAULT_OPTION_COUNT = 4;
const blankOptions = (count = DEFAULT_OPTION_COUNT) => Array.from({ length: count }, () => "");

const blankQuestion = (): DraftQuestion => ({
  id: key(),
  prompt: "",
  type: "Rating",
  section: "Course Content",
  required: true,
  options: blankOptions(),
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
const typeToApi = (value: QuestionTypeLabel): EvaluationQuestionType => value === "Rating" ? "RATING" : value === "Single Choice" ? "SINGLE_CHOICE" : "SHORT_TEXT";
const typeFromApi = (value: EvaluationQuestionType): QuestionTypeLabel => value === "RATING" ? "Rating" : value === "SINGLE_CHOICE" || value === "MULTIPLE_CHOICE" ? "Single Choice" : "Text";

const toDraftQuestions = (record: EvaluationRecord): DraftQuestion[] => record.questions.map((question) => ({
  id: question.evaluationQuestionId,
  prompt: question.questionText,
  type: typeFromApi(question.questionType),
  section: sections.includes(question.sectionName as EvaluationSection) ? question.sectionName as EvaluationSection : "Comments",
  required: question.isRequired,
  // Not truncated to 4 any more: a question stored with more options used to lose the extras as
  // soon as it was opened here, and saving wrote the shortened list back.
  options: question.questionType === "SINGLE_CHOICE" || question.questionType === "MULTIPLE_CHOICE"
    ? (() => {
        const stored = question.options.map((option) => option.optionText);
        return stored.length >= MIN_OPTIONS ? stored : [...stored, ...blankOptions()].slice(0, MIN_OPTIONS);
      })()
    : blankOptions(),
}));

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
  const [mode, setMode] = useState<Mode>("idle");
  const [draft, setDraft] = useState<Draft>(() => blankDraft(user?.companyId ?? "", isFactory));
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [questionDraft, setQuestionDraft] = useState<DraftQuestion>(blankQuestion);
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const toast = useToast();
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
    return query ? items.filter((item) => [item.formCode, item.formName, item.companyCode, timingFromApi(item.timing), respondentFromApi(item.respondentType), statusFromApi(item.status)].filter(Boolean).join(" ").toLowerCase().includes(query)) : items;
  }, [items, search]);

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
        questions: item.questions.map((question) => ({
          questionText: question.questionText,
          questionType: question.questionType,
          sectionName: question.sectionName,
          isRequired: question.isRequired,
          options: question.options.map((option) => ({
            optionText: option.optionText,
            optionValue: option.optionValue,
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
    description: null,
    timing: timingToApi(sourceDraft.timing),
    respondentType: respondentToApi(sourceDraft.respondent),
    isAnonymous: sourceDraft.anonymous,
    status: statusToApi(sourceDraft.status),
    questions: sourceQuestions.map((question) => ({
      questionText: question.prompt,
      questionType: typeToApi(question.type),
      sectionName: question.section,
      isRequired: question.required,
      options: question.type === "Rating"
        ? ratingOptions.map((option, index) => ({ optionText: option, optionValue: String(index + 1) }))
        : question.type === "Single Choice"
          ? question.options.filter((option) => option.trim()).map((option) => ({ optionText: option, optionValue: null }))
          : [],
    })),
  });

  const handleDuplicate = async () => {
    if (!selected?.canDuplicate) return;
    setBusy(true); setFeedback(null);
    try {
      const duplicateDraft: Draft = {
        formCode: "",
        formName: `${selected.formName} (Copy)`,
        scope: selected.scope,
        companyId: selected.companyId ?? "",
        timing: timingFromApi(selected.timing),
        respondent: respondentFromApi(selected.respondentType),
        anonymous: selected.isAnonymous,
        status: "Draft",
      };
      const result = await createEvaluation(payload(duplicateDraft, toDraftQuestions(selected)));
      setItems((current) => [result.evaluation, ...current]);
      setSelectedId(result.evaluation.evaluationFormId);
      setFeedback({ tone: "success", message: "Evaluation duplicated as a new draft." });
    } catch (error) { setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to duplicate evaluation" }); }
    finally { setBusy(false); }
  };

  const handleAddQuestion = () => {
    const cleanOptions = questionDraft.options.map((option) => option.trim());
    if (!questionDraft.prompt.trim()) return setErrors((current) => ({ ...current, question: "Enter an evaluation question." }));
    if (questionDraft.type === "Single Choice" && cleanOptions.filter(Boolean).length < 2) return setErrors((current) => ({ ...current, question: "Single Choice questions need at least two options." }));
    const next: DraftQuestion = { ...questionDraft, prompt: questionDraft.prompt.trim(), options: questionDraft.type === "Single Choice" ? cleanOptions : blankOptions() };
    setQuestions((current) => editingQuestionId ? current.map((item) => item.id === editingQuestionId ? next : item) : [...current, next]);
    setErrors((current) => ({ ...current, question: undefined, questions: undefined }));
    setFeedback({ tone: "success", message: editingQuestionId ? "Question updated." : "Question added." });
    setPreviewAnswers({}); resetQuestionEditor();
  };
  const handleEditQuestion = (question: DraftQuestion) => { setQuestionDraft({ ...question, options: question.options.length >= MIN_OPTIONS ? [...question.options] : [...question.options, ...blankOptions()].slice(0, MIN_OPTIONS) }); setEditingQuestionId(question.id); setErrors((current) => ({ ...current, question: undefined })); };
  const handleRemoveQuestion = (id: string) => { setQuestions((current) => current.filter((item) => item.id !== id)); if (editingQuestionId === id) resetQuestionEditor(); setPreviewAnswers({}); };

  const handleAddOption = () => setQuestionDraft((current) => ({ ...current, options: [...current.options, ""] }));
  const handleRemoveOption = (index: number) => setQuestionDraft((current) => current.options.length <= MIN_OPTIONS ? current : ({ ...current, options: current.options.filter((_, itemIndex) => itemIndex !== index) }));

  /** Copies a question in place, right below the original - the common case when writing a set of
   *  near-identical rating questions for one section. */
  const handleDuplicateQuestion = (index: number) => setQuestions((current) => {
    const source = current[index];
    if (!source) return current;
    return [...current.slice(0, index + 1), { ...source, id: key(), options: [...source.options] }, ...current.slice(index + 1)];
  });
  const handleMoveQuestion = (index: number, direction: -1 | 1) => setQuestions((current) => {
    const destination = index + direction; if (destination < 0 || destination >= current.length) return current;
    const reordered = [...current]; [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]]; return reordered;
  });

  const handleSave = async () => {
    const nextErrors: FormErrors = {};
    if (!draft.formName.trim()) nextErrors.name = "Evaluation name is required.";
    if (!isFactory && draft.scope === "COMPANY" && !draft.companyId) nextErrors.companyId = "Select a company for a company-specific form.";
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

  const renderQuestionPreview = (previewQuestions: DraftQuestion[], previewKey: string, editable: boolean) => previewQuestions.length ? <div className={styles.questionList}>{previewQuestions.map((item, index) => {
    const answerKey = `${previewKey}-${item.id}`;
    const options = item.type === "Rating" ? ratingOptions : item.options.filter(Boolean);
    return <article key={item.id}><div className={styles.questionHeading}><div><span>{item.section}</span><strong>{index + 1}. {item.prompt}{item.required ? <em className={styles.requiredMark}> *</em> : null}</strong></div><b>{item.type}</b></div>
      {item.type === "Text" ? <textarea aria-label={`Preview answer for question ${index + 1}`} placeholder="Type a preview response" value={previewAnswers[answerKey] ?? ""} onChange={(event) => setPreviewAnswers((current) => ({ ...current, [answerKey]: event.target.value }))} /> : <div className={styles.previewOptions}>{options.map((option) => <label key={`${item.id}-${option}`}><input checked={previewAnswers[answerKey] === option} name={answerKey} type="radio" value={option} onChange={(event) => setPreviewAnswers((current) => ({ ...current, [answerKey]: event.target.value }))} /><span>{option}</span></label>)}</div>}
      {editable ? <div className={styles.questionActions}><button className={styles.secondaryButton} type="button" disabled={index === 0} onClick={() => handleMoveQuestion(index, -1)}>Up</button><button className={styles.secondaryButton} type="button" disabled={index === previewQuestions.length - 1} onClick={() => handleMoveQuestion(index, 1)}>Down</button><button className={styles.secondaryButton} type="button" onClick={() => handleEditQuestion(item)}>Edit</button><button className={styles.secondaryButton} type="button" onClick={() => handleDuplicateQuestion(index)}>Duplicate</button><button className={styles.dangerButton} type="button" onClick={() => handleRemoveQuestion(item.id)}>Remove</button></div> : null}
    </article>;
  })}</div> : <div className={styles.emptyState}>No questions yet. Add a question to preview the evaluation form.</div>;

  const renderEditor = () => <section className={styles.editorPanel}>
    <div className={styles.panelHeader}><div><p className={styles.kicker}>{mode === "new" ? "New evaluation" : "Edit evaluation"}</p><h3>Evaluation form settings</h3></div><button className={styles.closeButton} type="button" onClick={closeEditor}>Close</button></div>
    <div className={styles.formGrid}>
      <label className={styles.fullWidth}>Evaluation Name
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
        <label>Company
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
    <div className={styles.questionBuilder}><div className={styles.panelHeader}><div><p className={styles.kicker}>Question builder</p><h3>{editingQuestionId ? "Edit question" : "Add evaluation question"}</h3></div><span>{questions.length} questions</span></div>
      <div className={styles.questionGrid}><label className={styles.fullWidth}>Question<textarea aria-invalid={Boolean(errors.question)} className={errors.question ? styles.inputError : undefined} value={questionDraft.prompt} onChange={(event) => { setQuestionDraft({ ...questionDraft, prompt: event.target.value }); setErrors((current) => ({ ...current, question: undefined })); }} placeholder="Enter the question shown to respondents" /></label>
        <label>Section<select value={questionDraft.section} onChange={(event) => setQuestionDraft({ ...questionDraft, section: event.target.value as EvaluationSection })}>{sections.map((section) => <option key={section}>{section}</option>)}</select></label>
        <label>Answer Type<select value={questionDraft.type} onChange={(event) => setQuestionDraft({ ...questionDraft, type: event.target.value as QuestionTypeLabel })}><option>Rating</option><option>Single Choice</option><option>Text</option></select></label>
        <label className={styles.toggleLabel}><input checked={questionDraft.required} type="checkbox" onChange={(event) => setQuestionDraft({ ...questionDraft, required: event.target.checked })} />Required question</label>
        {questionDraft.type === "Single Choice" ? questionDraft.options.map((option, index) => <label key={`choice-${index}`}>Choice {index + 1}<span style={{ display: "flex", alignItems: "center", gap: "6px" }}><input style={{ flex: 1, minWidth: 0 }} value={option} onChange={(event) => setQuestionDraft({ ...questionDraft, options: questionDraft.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} /><button type="button" title="ลบตัวเลือกนี้ / Remove this option" disabled={questionDraft.options.length <= MIN_OPTIONS} onClick={() => handleRemoveOption(index)} style={{ appearance: "none", border: "none", background: "transparent", color: questionDraft.options.length <= MIN_OPTIONS ? "var(--ui-30-muted)" : "#dc2626", cursor: questionDraft.options.length <= MIN_OPTIONS ? "not-allowed" : "pointer", fontSize: "0.9rem", fontWeight: 900, lineHeight: 1, padding: "2px 4px" }}>✕</button></span></label>) : null}
        {questionDraft.type === "Single Choice" ? <div className={styles.fullWidth}><button className={styles.secondaryButton} type="button" onClick={handleAddOption}>+ เพิ่มตัวเลือก / Add option</button></div> : null}
      </div>
      {questionDraft.type === "Rating" ? <p className={styles.helperText}>Rating uses the standard five-point scale from Strongly disagree to Strongly agree.</p> : null}
      {errors.question ? <p className={styles.validationMessage} role="alert">{errors.question}</p> : null}
      <div className={styles.formActions}><button className={styles.secondaryButton} type="button" onClick={handleAddQuestion}>{editingQuestionId ? "Update question" : "Add question"}</button>{editingQuestionId ? <button className={styles.closeButton} type="button" onClick={resetQuestionEditor}>Cancel question edit</button> : null}</div>
    </div>
    <div className={styles.previewPanel}><div className={styles.panelHeader}><div><p className={styles.kicker}>Live preview</p><h3>{draft.formName.trim() || "Untitled evaluation form"}</h3></div><span>{draft.timing} · {draft.respondent}</span></div>{renderQuestionPreview(questions, "editor-preview", true)}</div>
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
          <button className={styles.primaryButton} type="button" disabled={busy} onClick={handleNew}>
            + เพิ่มแบบประเมิน
          </button>
          <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void load()}>
            รีเฟรช
          </button>
          <button className={styles.secondaryButton} type="button" onClick={handleExport}>
            ส่งออก CSV
          </button>
        </div>
        {mode !== "idle" ? renderEditor() : null}
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
              {!visible.length ? (
                <tr>
                  <td className={styles.emptyTableCell} colSpan={8}>
                    {busy ? "Loading evaluations..." : "No evaluations yet. Select New to create the first form."}
                  </td>
                </tr>
              ) : null}
              {visible.map((item) => {
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
                      <td>
                        <span className={`${styles.statusPill} ${statusClass}`}>{status}</span>
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
                                <p className={styles.kicker}>Evaluation preview</p>
                                <h3>{item.formName}</h3>
                              </div>
                              <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>
                                Close
                              </button>
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
                            {renderQuestionPreview(draftQuestions, `detail-${item.evaluationFormId}`, false)}
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
    </section>
  );
}
