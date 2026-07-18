"use client";

import { Fragment, useMemo, useState } from "react";
import styles from "./EvaluationManagement.module.css";

export const evaluationManagementModule = {
  title: "Evaluation Management",
  subtitle: "Evaluation form",
  description: "Create and maintain evaluation forms for training courses.",
} as const;

type EvaluationStatus = "Draft" | "Published" | "Inactive";
type QuestionType = "Rating" | "Choice" | "Text";

type EvaluationQuestion = {
  id: string;
  question: string;
  type: QuestionType;
  options: string[];
};

type EvaluationRecord = {
  id: string;
  code: string;
  name: string;
  scope: "Central" | "Company";
  company: string;
  status: EvaluationStatus;
  questions: EvaluationQuestion[];
  updatedAt: string;
};

const initialEvaluations: EvaluationRecord[] = [
  {
    id: "eval-001",
    code: "EVA-001",
    name: "Standard Course Evaluation",
    scope: "Central",
    company: "-",
    status: "Published",
    updatedAt: "2026-07-08",
    questions: [
      { id: "eq-001", question: "The course content was useful.", type: "Rating", options: ["1", "2", "3", "4", "5"] },
      { id: "eq-002", question: "What should be improved?", type: "Text", options: [] },
    ],
  },
  {
    id: "eval-002",
    code: "EVA-002",
    name: "Workshop Feedback Form",
    scope: "Company",
    company: "ATFB",
    status: "Draft",
    updatedAt: "2026-07-12",
    questions: [
      { id: "eq-003", question: "The workshop activities were clear.", type: "Rating", options: ["1", "2", "3", "4", "5"] },
    ],
  },
];

const companies = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

export default function EvaluationManagement() {
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>(initialEvaluations);
  const [selectedId, setSelectedId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [mode, setMode] = useState<"idle" | "new" | "edit">("idle");
  const [form, setForm] = useState({
    code: "",
    name: "",
    scope: "Central" as "Central" | "Company",
    company: "ATA",
    status: "Draft" as EvaluationStatus,
  });
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [question, setQuestion] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("Rating");
  const [search, setSearch] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  const selectedEvaluation = evaluations.find((evaluation) => evaluation.id === selectedId) ?? null;
  const visibleEvaluations = useMemo(
    () =>
      evaluations.filter((evaluation) =>
        [evaluation.code, evaluation.name, evaluation.scope, evaluation.company, evaluation.status]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [evaluations, search],
  );

  const handleNew = () => {
    setSelectedId("");
    setOpenDetailId("");
    setMode("new");
    setForm({ code: "", name: "", scope: "Central", company: "ATA", status: "Draft" });
    setQuestions([]);
    setExportMessage("");
  };

  const handleEdit = () => {
    if (!selectedEvaluation) return;
    setMode("edit");
    setOpenDetailId(selectedEvaluation.id);
    setForm({
      code: selectedEvaluation.code,
      name: selectedEvaluation.name,
      scope: selectedEvaluation.scope,
      company: selectedEvaluation.company === "-" ? "ATA" : selectedEvaluation.company,
      status: selectedEvaluation.status,
    });
    setQuestions(selectedEvaluation.questions);
    setExportMessage("");
  };

  const handleDelete = () => {
    if (!selectedId) return;
    setEvaluations((current) => current.filter((evaluation) => evaluation.id !== selectedId));
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
  };

  const handleRefresh = () => {
    setEvaluations(initialEvaluations);
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
    setSearch("");
    setExportMessage("");
  };

  const handleAddQuestion = () => {
    if (!question.trim()) return;
    const options = questionType === "Rating" ? ["1", "2", "3", "4", "5"] : questionType === "Choice" ? ["Very good", "Good", "Fair", "Need improvement"] : [];
    setQuestions((current) => [...current, { id: `eq-${Date.now()}`, question: question.trim(), type: questionType, options }]);
    setQuestion("");
    setQuestionType("Rating");
  };

  const handleSave = () => {
    const nextEvaluation: EvaluationRecord = {
      id: selectedId || `eval-${Date.now()}`,
      code: form.code.trim() || `EVA-${String(evaluations.length + 1).padStart(3, "0")}`,
      name: form.name.trim() || "New Evaluation Form",
      scope: form.scope,
      company: form.scope === "Central" ? "-" : form.company,
      status: form.status,
      questions,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    setEvaluations((current) =>
      selectedId
        ? current.map((evaluation) => evaluation.id === selectedId ? nextEvaluation : evaluation)
        : [nextEvaluation, ...current],
    );
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
  };

  const renderEditor = () => (
    <section className={styles.editorPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>{mode === "new" ? "New evaluation" : "Edit evaluation"}</p>
          <h3>Evaluation form</h3>
        </div>
        <button className={styles.closeButton} type="button" onClick={() => setMode("idle")}>Close</button>
      </div>

      <div className={styles.formGrid}>
        <label>Evaluation Code<input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></label>
        <label>Evaluation Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
        <label>Scope<select value={form.scope} onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value as "Central" | "Company" }))}><option>Central</option><option>Company</option></select></label>
        <label>Company<select disabled={form.scope === "Central"} value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}>{companies.map((company) => <option key={company}>{company}</option>)}</select></label>
        <label>Status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EvaluationStatus }))}><option>Draft</option><option>Published</option><option>Inactive</option></select></label>
      </div>

      <div className={styles.questionBuilder}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Question builder</p>
            <h3>Add question</h3>
          </div>
          <span>{questions.length} questions</span>
        </div>
        <div className={styles.questionGrid}>
          <label className={styles.fullWidth}>Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
          <label>Question Type<select value={questionType} onChange={(event) => setQuestionType(event.target.value as QuestionType)}><option>Rating</option><option>Choice</option><option>Text</option></select></label>
        </div>
        <div className={styles.formActions}>
          <button className={styles.secondaryButton} type="button" onClick={handleAddQuestion}>Add question</button>
          <button className={styles.primaryButton} type="button" onClick={handleSave}>Save evaluation</button>
        </div>
      </div>
    </section>
  );

  return (
    <section className={styles.page} aria-label="Evaluation Management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{evaluationManagementModule.subtitle}</p>
          <h2>{evaluationManagementModule.title}</h2>
          <p>{evaluationManagementModule.description}</p>
        </div>
        <div className={styles.metrics}>
          <div><span>Total</span><strong>{evaluations.length}</strong></div>
          <div><span>Published</span><strong>{evaluations.filter((item) => item.status === "Published").length}</strong></div>
          <div><span>Draft</span><strong>{evaluations.filter((item) => item.status === "Draft").length}</strong></div>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search evaluation, scope, company, status" />
          <button className={styles.primaryButton} type="button" onClick={handleNew}>New</button>
          <button className={styles.secondaryButton} type="button" onClick={handleEdit} disabled={!selectedEvaluation}>Edit</button>
          <button className={styles.dangerButton} type="button" onClick={handleDelete} disabled={!selectedEvaluation}>Delete</button>
          <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>Refresh</button>
          <button className={styles.secondaryButton} type="button" onClick={() => setExportMessage(`Export ready: ${evaluations.length} evaluations`)}>Export</button>
        </div>

        {mode !== "idle" ? renderEditor() : null}
        {exportMessage ? <p className={styles.exportMessage}>{exportMessage}</p> : null}

        <div className={styles.tableWrap}>
          <table className={styles.evaluationTable}>
            <thead><tr><th>Code</th><th>Evaluation Name</th><th>Scope</th><th>Company</th><th>Questions</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleEvaluations.map((evaluation) => {
                const isOpen = openDetailId === evaluation.id && mode === "idle";
                return (
                  <Fragment key={evaluation.id}>
                    <tr className={evaluation.id === selectedId ? styles.selectedRow : undefined}>
                      <td>{evaluation.code}</td><td>{evaluation.name}</td><td>{evaluation.scope}</td><td>{evaluation.company}</td><td>{evaluation.questions.length}</td><td><span className={styles.statusPill}>{evaluation.status}</span></td>
                      <td className={styles.actionCell}><button className={styles.detailButton} type="button" onClick={() => { setSelectedId(isOpen ? "" : evaluation.id); setOpenDetailId(isOpen ? "" : evaluation.id); setMode("idle"); }}>{isOpen ? "Hide" : "Details"}</button></td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detailRow}><td colSpan={7}><div className={styles.detailPanel}><div className={styles.panelHeader}><div><p className={styles.kicker}>Evaluation detail</p><h3>{evaluation.name}</h3></div><button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>Close</button></div><div className={styles.questionList}>{evaluation.questions.map((item, index) => <article key={item.id}><strong>{index + 1}. {item.question}</strong><span>{item.type}</span>{item.options.map((option) => <p key={option}>{option}</p>)}</article>)}</div></div></td></tr>
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
