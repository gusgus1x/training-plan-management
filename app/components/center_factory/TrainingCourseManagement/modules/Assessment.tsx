"use client";

import { Fragment, useMemo, useState } from "react";
import styles from "./Assessment.module.css";

export const assessmentModule = {
  title: "Assessment",
  subtitle: "Pre / Post Test",
  description: "Create assessment sets and question banks for training courses.",
} as const;

type QuestionType = "Choice" | "Text";
type AssessmentStatus = "Draft" | "Published" | "Inactive";

type AssessmentQuestion = {
  id: string;
  question: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
};

type AssessmentRecord = {
  id: string;
  assessmentCode: string;
  assessmentName: string;
  courseName: string;
  assessmentType: "Pre Test" | "Post Test";
  passScore: string;
  status: AssessmentStatus;
  questions: AssessmentQuestion[];
  updatedAt: string;
};

type AssessmentForm = Omit<AssessmentRecord, "id" | "questions" | "updatedAt">;

const courseOptions = [
  "Leadership Essentials",
  "Safety Basics",
  "Data Privacy Awareness",
  "Quality Control Basics",
] as const;

const emptyForm: AssessmentForm = {
  assessmentCode: "",
  assessmentName: "",
  courseName: courseOptions[0],
  assessmentType: "Pre Test",
  passScore: "80",
  status: "Draft",
};

const initialAssessments: AssessmentRecord[] = [
  {
    id: "asm-001",
    assessmentCode: "ASM-001",
    assessmentName: "Safety Basic Pre Test",
    courseName: "Safety Basics",
    assessmentType: "Pre Test",
    passScore: "80",
    status: "Published",
    updatedAt: "2026-07-08",
    questions: [
      {
        id: "q-001",
        question: "What should employees wear in production areas?",
        type: "Choice",
        options: ["PPE", "Casual clothes", "No requirement", "Visitor badge only"],
        correctAnswer: "A",
      },
      {
        id: "q-002",
        question: "Describe the first action when an incident occurs.",
        type: "Text",
        options: [],
        correctAnswer: "Manual scoring",
      },
    ],
  },
  {
    id: "asm-002",
    assessmentCode: "ASM-002",
    assessmentName: "Leadership Post Test",
    courseName: "Leadership Essentials",
    assessmentType: "Post Test",
    passScore: "85",
    status: "Draft",
    updatedAt: "2026-07-12",
    questions: [
      {
        id: "q-003",
        question: "Which behavior is most useful for coaching?",
        type: "Choice",
        options: ["Ask open questions", "Avoid feedback", "Delay decisions", "Ignore follow-up"],
        correctAnswer: "A",
      },
    ],
  },
];

export default function Assessment() {
  const [assessments, setAssessments] = useState<AssessmentRecord[]>(initialAssessments);
  const [selectedId, setSelectedId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [mode, setMode] = useState<"idle" | "new" | "edit">("idle");
  const [form, setForm] = useState<AssessmentForm>(emptyForm);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("Choice");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("A");
  const [search, setSearch] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  const selectedAssessment = assessments.find((assessment) => assessment.id === selectedId) ?? null;
  const visibleAssessments = useMemo(
    () =>
      assessments.filter((assessment) =>
        [
          assessment.assessmentCode,
          assessment.assessmentName,
          assessment.courseName,
          assessment.assessmentType,
          assessment.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [assessments, search],
  );

  const updateForm = (field: keyof AssessmentForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleNew = () => {
    setMode("new");
    setSelectedId("");
    setOpenDetailId("");
    setForm(emptyForm);
    setQuestions([]);
    setExportMessage("");
  };

  const handleEdit = () => {
    if (!selectedAssessment) {
      return;
    }

    setForm({
      assessmentCode: selectedAssessment.assessmentCode,
      assessmentName: selectedAssessment.assessmentName,
      courseName: selectedAssessment.courseName,
      assessmentType: selectedAssessment.assessmentType,
      passScore: selectedAssessment.passScore,
      status: selectedAssessment.status,
    });
    setQuestions(selectedAssessment.questions);
    setMode("edit");
    setOpenDetailId(selectedAssessment.id);
    setExportMessage("");
  };

  const handleDelete = () => {
    if (!selectedId) {
      return;
    }

    setAssessments((current) => current.filter((assessment) => assessment.id !== selectedId));
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
  };

  const handleRefresh = () => {
    setAssessments(initialAssessments);
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
    setSearch("");
    setExportMessage("");
  };

  const handleExport = () => {
    setExportMessage(`Export ready: ${assessments.length} assessments`);
  };

  const handleShowDetails = (assessment: AssessmentRecord) => {
    const isOpen = openDetailId === assessment.id && mode === "idle";
    setSelectedId(isOpen ? "" : assessment.id);
    setOpenDetailId(isOpen ? "" : assessment.id);
    setMode("idle");
    setExportMessage("");
  };

  const handleAddQuestion = () => {
    if (!questionText.trim()) {
      return;
    }

    const nextQuestion: AssessmentQuestion = {
      id: `question-${Date.now()}`,
      question: questionText.trim(),
      type: questionType,
      options: questionType === "Choice" ? options.map((option, index) => option.trim() || `Option ${index + 1}`) : [],
      correctAnswer: questionType === "Choice" ? correctAnswer : "Manual scoring",
    };

    setQuestions((current) => [...current, nextQuestion]);
    setQuestionText("");
    setQuestionType("Choice");
    setOptions(["", "", "", ""]);
    setCorrectAnswer("A");
  };

  const handleSave = () => {
    const nextAssessment: AssessmentRecord = {
      ...form,
      id: selectedId || `assessment-${Date.now()}`,
      assessmentCode: form.assessmentCode.trim() || `ASM-${String(assessments.length + 1).padStart(3, "0")}`,
      assessmentName: form.assessmentName.trim() || "New Assessment",
      questions,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    setAssessments((current) =>
      selectedId
        ? current.map((assessment) => (assessment.id === selectedId ? nextAssessment : assessment))
        : [nextAssessment, ...current],
    );
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
    setForm(emptyForm);
    setQuestions([]);
  };

  const renderEditor = (title: string) => (
    <section className={styles.editorPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>{mode === "new" ? "New assessment" : "Edit assessment"}</p>
          <h3>{title}</h3>
        </div>
        <button className={styles.closeButton} type="button" onClick={() => setMode("idle")}>
          Close
        </button>
      </div>

      <div className={styles.formGrid}>
        <label>
          Assessment Code
          <input value={form.assessmentCode} onChange={(event) => updateForm("assessmentCode", event.target.value)} />
        </label>
        <label>
          Assessment Name
          <input value={form.assessmentName} onChange={(event) => updateForm("assessmentName", event.target.value)} />
        </label>
        <label>
          Course Name
          <select value={form.courseName} onChange={(event) => updateForm("courseName", event.target.value)}>
            {courseOptions.map((course) => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
        </label>
        <label>
          Assessment Type
          <select value={form.assessmentType} onChange={(event) => updateForm("assessmentType", event.target.value)}>
            <option>Pre Test</option>
            <option>Post Test</option>
          </select>
        </label>
        <label>
          Pass Score
          <input value={form.passScore} inputMode="numeric" onChange={(event) => updateForm("passScore", event.target.value)} />
        </label>
        <label>
          Status
          <select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
            <option>Draft</option>
            <option>Published</option>
            <option>Inactive</option>
          </select>
        </label>
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
          <label className={styles.fullWidth}>
            Question
            <textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} />
          </label>
          <label>
            Question Type
            <select value={questionType} onChange={(event) => setQuestionType(event.target.value as QuestionType)}>
              <option>Choice</option>
              <option>Text</option>
            </select>
          </label>
          {questionType === "Choice" ? (
            <>
              {options.map((option, index) => (
                <label key={`option-${index}`}>
                  Option {String.fromCharCode(65 + index)}
                  <input
                    value={option}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((item, itemIndex) => itemIndex === index ? event.target.value : item),
                      )
                    }
                  />
                </label>
              ))}
              <label>
                Correct Answer
                <select value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)}>
                  <option>A</option>
                  <option>B</option>
                  <option>C</option>
                  <option>D</option>
                </select>
              </label>
            </>
          ) : null}
        </div>
        <div className={styles.formActions}>
          <button className={styles.secondaryButton} type="button" onClick={handleAddQuestion}>
            Add question
          </button>
          <button className={styles.primaryButton} type="button" onClick={handleSave}>
            Save assessment
          </button>
        </div>
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Preview</p>
            <h3>Question preview</h3>
          </div>
        </div>
        {questions.length ? (
          <div className={styles.questionList}>
            {questions.map((question, index) => (
              <article key={question.id}>
                <strong>{index + 1}. {question.question}</strong>
                <span>{question.type}</span>
                {question.options.map((option, optionIndex) => (
                  <p key={option}>{String.fromCharCode(65 + optionIndex)}. {option}</p>
                ))}
                <b>{question.correctAnswer}</b>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>No questions added yet.</div>
        )}
      </div>
    </section>
  );

  return (
    <section className={styles.page} aria-label="Assessment management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{assessmentModule.subtitle}</p>
          <h2>{assessmentModule.title}</h2>
          <p>{assessmentModule.description}</p>
        </div>
        <div className={styles.metrics}>
          <div>
            <span>Total</span>
            <strong>{assessments.length}</strong>
          </div>
          <div>
            <span>Published</span>
            <strong>{assessments.filter((assessment) => assessment.status === "Published").length}</strong>
          </div>
          <div>
            <span>Draft</span>
            <strong>{assessments.filter((assessment) => assessment.status === "Draft").length}</strong>
          </div>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search assessment"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search assessment, course, type, status"
          />
          <button className={styles.primaryButton} type="button" onClick={handleNew}>
            New
          </button>
          <button className={styles.secondaryButton} type="button" onClick={handleEdit} disabled={!selectedAssessment}>
            Edit
          </button>
          <button className={styles.dangerButton} type="button" onClick={handleDelete} disabled={!selectedAssessment}>
            Delete
          </button>
          <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
            Refresh
          </button>
          <button className={styles.secondaryButton} type="button" onClick={handleExport}>
            Export
          </button>
        </div>

        {mode !== "idle" ? renderEditor(mode === "new" ? "Create assessment" : "Edit assessment") : null}
        {exportMessage ? <p className={styles.exportMessage}>{exportMessage}</p> : null}

        <div className={styles.tableWrap}>
          <table className={styles.assessmentTable}>
            <thead>
              <tr>
                <th>Assessment Code</th>
                <th>Assessment Name</th>
                <th>Course Name</th>
                <th>Type</th>
                <th>Pass Score</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleAssessments.map((assessment) => {
                const isOpen = openDetailId === assessment.id && mode === "idle";

                return (
                  <Fragment key={assessment.id}>
                    <tr className={assessment.id === selectedId ? styles.selectedRow : undefined}>
                      <td>{assessment.assessmentCode}</td>
                      <td>{assessment.assessmentName}</td>
                      <td>{assessment.courseName}</td>
                      <td>{assessment.assessmentType}</td>
                      <td>{assessment.passScore}</td>
                      <td>{assessment.questions.length}</td>
                      <td><span className={styles.statusPill}>{assessment.status}</span></td>
                      <td className={styles.actionCell}>
                        <button className={styles.detailButton} type="button" onClick={() => handleShowDetails(assessment)}>
                          {isOpen ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detailRow}>
                        <td colSpan={8}>
                          <div className={styles.detailPanel}>
                            <div className={styles.panelHeader}>
                              <div>
                                <p className={styles.kicker}>Assessment detail</p>
                                <h3>{assessment.assessmentName}</h3>
                              </div>
                              <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>
                                Close
                              </button>
                            </div>
                            <div className={styles.questionList}>
                              {assessment.questions.map((question, index) => (
                                <article key={question.id}>
                                  <strong>{index + 1}. {question.question}</strong>
                                  <span>{question.type}</span>
                                  {question.options.map((option, optionIndex) => (
                                    <p key={option}>{String.fromCharCode(65 + optionIndex)}. {option}</p>
                                  ))}
                                  <b>{question.correctAnswer}</b>
                                </article>
                              ))}
                            </div>
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
