"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ASSESSMENT_STORAGE_KEY,
  initializeTrainingFormCatalog,
} from "../../../../lib/trainingFormCatalog";
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
type FormErrors = Partial<Record<keyof AssessmentForm | "questions" | "question", string>>;
type Feedback = {
  tone: "success" | "error" | "info";
  message: string;
};

const emptyForm: AssessmentForm = {
  assessmentCode: "",
  assessmentName: "",
  courseName: "",
  assessmentType: "Pre Test",
  passScore: "80",
  status: "Draft",
};

const initialAssessments: AssessmentRecord[] = [];

const storageKey = ASSESSMENT_STORAGE_KEY;

const cloneInitialAssessments = () =>
  initialAssessments.map((assessment) => ({
    ...assessment,
    questions: assessment.questions.map((question) => ({
      ...question,
      options: [...question.options],
    })),
  }));

const readStoredAssessments = () => {
  if (typeof window === "undefined") {
    return cloneInitialAssessments();
  }

  try {
    initializeTrainingFormCatalog();
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) {
      return cloneInitialAssessments();
    }

    const parsedValue = JSON.parse(storedValue) as unknown;
    return Array.isArray(parsedValue)
      ? (parsedValue as AssessmentRecord[])
      : cloneInitialAssessments();
  } catch {
    return cloneInitialAssessments();
  }
};

const generateAssessmentCode = (assessments: AssessmentRecord[]) => {
  const latestNumber = assessments.reduce((maximum, assessment) => {
    const match = assessment.assessmentCode.match(/^ASM-(\d+)$/i);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);

  return `ASM-${String(latestNumber + 1).padStart(3, "0")}`;
};

const escapeCsvCell = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

const createAssessmentCsv = (assessments: AssessmentRecord[]) => {
  const header = [
    "Assessment Code",
    "Assessment Name",
    "Course Name",
    "Type",
    "Pass Score",
    "Questions",
    "Status",
    "Updated At",
  ];
  const rows = assessments.map((assessment) => [
    assessment.assessmentCode,
    assessment.assessmentName,
    assessment.courseName,
    assessment.assessmentType,
    assessment.passScore,
    assessment.questions.length,
    assessment.status,
    assessment.updatedAt,
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
};

export default function Assessment() {
  const [assessments, setAssessments] = useState<AssessmentRecord[]>(cloneInitialAssessments);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [mode, setMode] = useState<"idle" | "new" | "edit">("idle");
  const [form, setForm] = useState<AssessmentForm>(emptyForm);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("Choice");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("A");
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [search, setSearch] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      setAssessments(readStoredAssessments());
      setStorageReady(true);
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(assessments));
    } catch {
      // The in-memory mock remains usable when browser storage is unavailable.
    }
  }, [assessments, storageReady]);

  const selectedAssessment = assessments.find((assessment) => assessment.id === selectedId) ?? null;
  const visibleAssessments = useMemo(
    () => {
      const searchTerm = search.trim().toLowerCase();

      if (!searchTerm) {
        return assessments;
      }

      return assessments.filter((assessment) =>
        [
          assessment.assessmentCode,
          assessment.assessmentName,
          assessment.courseName,
          assessment.assessmentType,
          assessment.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm),
      );
    },
    [assessments, search],
  );

  const updateForm = (field: keyof AssessmentForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback(null);
  };

  const resetQuestionEditor = () => {
    setQuestionText("");
    setQuestionType("Choice");
    setOptions(["", "", "", ""]);
    setCorrectAnswer("A");
    setEditingQuestionId("");
    setFormErrors((current) => ({ ...current, question: undefined }));
  };

  const closeEditor = () => {
    setMode("idle");
    setForm(emptyForm);
    setQuestions([]);
    setFormErrors({});
    resetQuestionEditor();
  };

  const handleNew = () => {
    setMode("new");
    setSelectedId("");
    setOpenDetailId("");
    setForm(emptyForm);
    setQuestions([]);
    setFormErrors({});
    resetQuestionEditor();
    setFeedback(null);
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
    setQuestions(
      selectedAssessment.questions.map((question) => ({
        ...question,
        options: [...question.options],
      })),
    );
    setMode("edit");
    setOpenDetailId(selectedAssessment.id);
    setFormErrors({});
    resetQuestionEditor();
    setFeedback(null);
  };

  const handleDelete = () => {
    if (!selectedAssessment) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete "${selectedAssessment.assessmentName}"? This record will be removed from this browser.`,
    );

    if (!shouldDelete) {
      return;
    }

    setAssessments((current) => current.filter((assessment) => assessment.id !== selectedId));
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
    setFeedback({
      tone: "success",
      message: "Assessment deleted.",
    });
  };

  const handleRefresh = () => {
    setAssessments(readStoredAssessments());
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
    setFeedback({
      tone: "info",
      message: "Assessment data refreshed from browser storage.",
    });
  };

  const handleClearAllData = () => {
    const shouldClear = window.confirm(
      "Clear all Assessment data from this browser? This cannot be undone.",
    );

    if (!shouldClear) {
      return;
    }

    setAssessments([]);
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
    setSearch("");
    setFeedback({
      tone: "success",
      message: "All Assessment data cleared.",
    });
  };

  const handleExport = () => {
    if (!visibleAssessments.length) {
      setFeedback({
        tone: "error",
        message: "There are no assessments to export.",
      });
      return;
    }

    const csvContent = createAssessmentCsv(visibleAssessments);
    const downloadUrl = URL.createObjectURL(
      new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8" }),
    );
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `assessment-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    setFeedback({
      tone: "success",
      message: `Exported ${visibleAssessments.length} assessment${visibleAssessments.length === 1 ? "" : "s"} to CSV.`,
    });
  };

  const handleShowDetails = (assessment: AssessmentRecord) => {
    const isOpen = openDetailId === assessment.id && mode === "idle";
    setSelectedId(isOpen ? "" : assessment.id);
    setOpenDetailId(isOpen ? "" : assessment.id);
    setMode("idle");
    setFeedback(null);
  };

  const handleAddQuestion = () => {
    const cleanQuestion = questionText.trim();
    const cleanOptions = options.map((option) => option.trim());
    const correctOptionIndex = correctAnswer.charCodeAt(0) - 65;

    if (!cleanQuestion) {
      setFormErrors((current) => ({
        ...current,
        question: "Enter a question before adding it.",
      }));
      return;
    }

    if (
      questionType === "Choice" &&
      (cleanOptions.filter(Boolean).length < 2 || !cleanOptions[correctOptionIndex])
    ) {
      setFormErrors((current) => ({
        ...current,
        question: "Choice questions need at least two options and a valid correct answer.",
      }));
      return;
    }

    const nextQuestion: AssessmentQuestion = {
      id: editingQuestionId || `question-${Date.now()}`,
      question: cleanQuestion,
      type: questionType,
      options: questionType === "Choice" ? cleanOptions : [],
      correctAnswer: questionType === "Choice" ? correctAnswer : "Manual scoring",
    };

    setQuestions((current) =>
      editingQuestionId
        ? current.map((question) =>
            question.id === editingQuestionId ? nextQuestion : question,
          )
        : [...current, nextQuestion],
    );
    setFormErrors((current) => ({
      ...current,
      question: undefined,
      questions: undefined,
    }));
    setFeedback({
      tone: "success",
      message: editingQuestionId ? "Question updated." : "Question added.",
    });
    resetQuestionEditor();
  };

  const handleEditQuestion = (question: AssessmentQuestion) => {
    setQuestionText(question.question);
    setQuestionType(question.type);
    setOptions(
      question.type === "Choice"
        ? [...question.options, "", "", "", ""].slice(0, 4)
        : ["", "", "", ""],
    );
    setCorrectAnswer(question.type === "Choice" ? question.correctAnswer : "A");
    setEditingQuestionId(question.id);
    setFormErrors((current) => ({ ...current, question: undefined }));
    setFeedback(null);
  };

  const handleRemoveQuestion = (questionId: string) => {
    setQuestions((current) =>
      current.filter((question) => question.id !== questionId),
    );

    if (editingQuestionId === questionId) {
      resetQuestionEditor();
    }

    setFeedback({
      tone: "success",
      message: "Question removed.",
    });
  };

  const handleMoveQuestion = (questionIndex: number, direction: -1 | 1) => {
    setQuestions((current) => {
      const destinationIndex = questionIndex + direction;

      if (destinationIndex < 0 || destinationIndex >= current.length) {
        return current;
      }

      const reorderedQuestions = [...current];
      [reorderedQuestions[questionIndex], reorderedQuestions[destinationIndex]] = [
        reorderedQuestions[destinationIndex],
        reorderedQuestions[questionIndex],
      ];
      return reorderedQuestions;
    });
  };

  const handleSave = () => {
    const passScore = Number(form.passScore);
    const errors: FormErrors = {};
    const assessmentCode =
      form.assessmentCode.trim() || generateAssessmentCode(assessments);

    if (!form.assessmentName.trim()) {
      errors.assessmentName = "Assessment name is required.";
    }

    if (!Number.isInteger(passScore) || passScore < 0 || passScore > 100) {
      errors.passScore = "Pass score must be a whole number from 0 to 100.";
    }

    if (
      assessments.some(
        (assessment) =>
          assessment.id !== selectedId &&
          assessment.assessmentCode.toLowerCase() === assessmentCode.toLowerCase(),
      )
    ) {
      errors.assessmentCode = "Assessment code already exists.";
    }

    if (form.status === "Published" && !questions.length) {
      errors.questions = "Add at least one question before publishing.";
    }

    if (Object.keys(errors).length) {
      setFormErrors(errors);
      setFeedback({
        tone: "error",
        message: "Please correct the highlighted fields.",
      });
      return;
    }

    const nextAssessment: AssessmentRecord = {
      ...form,
      id: selectedId || `assessment-${Date.now()}`,
      assessmentCode,
      assessmentName: form.assessmentName.trim(),
      passScore: String(passScore),
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
    setFormErrors({});
    resetQuestionEditor();
    setFeedback({
      tone: "success",
      message: selectedId ? "Assessment updated." : "Assessment created.",
    });
  };

  const renderEditor = (title: string) => (
    <section className={styles.editorPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>{mode === "new" ? "New assessment" : "Edit assessment"}</p>
          <h3>{title}</h3>
        </div>
        <button className={styles.closeButton} type="button" onClick={closeEditor}>
          Close
        </button>
      </div>

      <div className={styles.formGrid}>
        <label>
          Assessment Code
          <input
            aria-invalid={Boolean(formErrors.assessmentCode)}
            className={formErrors.assessmentCode ? styles.inputError : undefined}
            value={form.assessmentCode}
            onChange={(event) => updateForm("assessmentCode", event.target.value)}
            placeholder="Auto-generated when left blank"
          />
          {formErrors.assessmentCode ? <small>{formErrors.assessmentCode}</small> : null}
        </label>
        <label>
          Assessment Name
          <input
            aria-invalid={Boolean(formErrors.assessmentName)}
            className={formErrors.assessmentName ? styles.inputError : undefined}
            value={form.assessmentName}
            onChange={(event) => updateForm("assessmentName", event.target.value)}
            placeholder="e.g. Safety Basics Pre Test"
          />
          {formErrors.assessmentName ? <small>{formErrors.assessmentName}</small> : null}
        </label>
        <label>
          Course Reference (optional)
          <input
            value={form.courseName}
            onChange={(event) => updateForm("courseName", event.target.value)}
            placeholder="Course name or leave blank for a reusable test"
          />
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
          <input
            aria-invalid={Boolean(formErrors.passScore)}
            className={formErrors.passScore ? styles.inputError : undefined}
            value={form.passScore}
            inputMode="numeric"
            onChange={(event) => updateForm("passScore", event.target.value)}
          />
          {formErrors.passScore ? <small>{formErrors.passScore}</small> : null}
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
            <textarea
              aria-invalid={Boolean(formErrors.question)}
              className={formErrors.question ? styles.inputError : undefined}
              value={questionText}
              onChange={(event) => {
                setQuestionText(event.target.value);
                setFormErrors((current) => ({ ...current, question: undefined }));
              }}
              placeholder="Enter the question shown to learners"
            />
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
                  {options.map((_, index) => {
                    const answer = String.fromCharCode(65 + index);
                    return <option key={answer}>{answer}</option>;
                  })}
                </select>
              </label>
            </>
          ) : null}
        </div>
        {formErrors.question ? (
          <p className={styles.validationMessage} role="alert">
            {formErrors.question}
          </p>
        ) : null}
        <div className={styles.formActions}>
          <button className={styles.secondaryButton} type="button" onClick={handleAddQuestion}>
            {editingQuestionId ? "Update question" : "Add question"}
          </button>
          {editingQuestionId ? (
            <button className={styles.closeButton} type="button" onClick={resetQuestionEditor}>
              Cancel question edit
            </button>
          ) : null}
          <button className={styles.primaryButton} type="button" onClick={handleSave}>
            Save assessment
          </button>
        </div>
        {formErrors.questions ? (
          <p className={styles.validationMessage} role="alert">
            {formErrors.questions}
          </p>
        ) : null}
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
                <div className={styles.questionHeading}>
                  <strong>{index + 1}. {question.question}</strong>
                  <span>{question.type}</span>
                </div>
                {question.options.map((option, optionIndex) => (
                  option ? (
                    <p key={`${question.id}-${optionIndex}`}>
                      {String.fromCharCode(65 + optionIndex)}. {option}
                    </p>
                  ) : null
                ))}
                <b>{question.correctAnswer}</b>
                <div className={styles.questionActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => handleMoveQuestion(index, -1)}
                    disabled={index === 0}
                  >
                    Up
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => handleMoveQuestion(index, 1)}
                    disabled={index === questions.length - 1}
                  >
                    Down
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => handleEditQuestion(question)}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={() => handleRemoveQuestion(question.id)}
                  >
                    Remove
                  </button>
                </div>
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
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <span className={styles.listMeta}>{visibleAssessments.length} / {assessments.length} assessments</span>
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
          <button className={styles.dangerButton} type="button" onClick={handleClearAllData}>
            Clear all
          </button>
        </div>

        {mode !== "idle" ? renderEditor(mode === "new" ? "Create assessment" : "Edit assessment") : null}
        {feedback ? (
          <p
            className={`${styles.feedback} ${styles[`feedback${feedback.tone[0].toUpperCase()}${feedback.tone.slice(1)}`]}`}
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        ) : null}

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
              {!visibleAssessments.length ? (
                <tr>
                  <td className={styles.emptyTableCell} colSpan={8}>
                    {assessments.length
                      ? "No assessments match your search."
                      : "No assessments yet. Select New to create the first record."}
                  </td>
                </tr>
              ) : null}
              {visibleAssessments.map((assessment) => {
                const isOpen = openDetailId === assessment.id && mode === "idle";
                const isSelected = assessment.id === selectedId;
                const statusClass =
                  assessment.status === "Published"
                    ? styles.statusPublished
                    : assessment.status === "Draft"
                      ? styles.statusDraft
                      : styles.statusInactive;

                return (
                  <Fragment key={assessment.id}>
                    <tr
                      aria-selected={isSelected}
                      className={`${styles.selectableRow} ${isSelected ? styles.selectedRow : ""}`}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedId(isSelected ? "" : assessment.id);
                        setOpenDetailId("");
                        setFeedback(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(isSelected ? "" : assessment.id);
                          setOpenDetailId("");
                          setFeedback(null);
                        }
                      }}
                    >
                      <td>{assessment.assessmentCode}</td>
                      <td>{assessment.assessmentName}</td>
                      <td>{assessment.courseName || "Reusable"}</td>
                      <td>{assessment.assessmentType}</td>
                      <td>{assessment.passScore}%</td>
                      <td>{assessment.questions.length}</td>
                      <td>
                        <span className={`${styles.statusPill} ${statusClass}`}>
                          {assessment.status}
                        </span>
                      </td>
                      <td className={styles.actionCell}>
                        <button
                          className={styles.detailButton}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleShowDetails(assessment);
                          }}
                        >
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
                            {assessment.questions.length ? (
                              <div className={styles.questionList}>
                                {assessment.questions.map((question, index) => (
                                  <article key={question.id}>
                                    <strong>{index + 1}. {question.question}</strong>
                                    <span>{question.type}</span>
                                    {question.options.map((option, optionIndex) => (
                                      option ? (
                                        <p key={`${question.id}-detail-${optionIndex}`}>
                                          {String.fromCharCode(65 + optionIndex)}. {option}
                                        </p>
                                      ) : null
                                    ))}
                                    <b>{question.correctAnswer}</b>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <div className={styles.emptyState}>
                                This draft does not have questions yet.
                              </div>
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
    </section>
  );
}
