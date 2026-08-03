"use client";

import { Fragment, useEffect, useState } from "react";
import {
  EVALUATION_STORAGE_KEY,
  initializeTrainingFormCatalog,
} from "../../../../lib/trainingFormCatalog";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import styles from "./EvaluationManagement.module.css";

export const evaluationManagementModule = {
  title: "Evaluation Management",
  subtitle: "Evaluation form",
  description:
    "Build post-training and follow-up evaluation forms for employees and managers.",
} as const;

type EvaluationStatus = "Draft" | "Published" | "Inactive";
type EvaluationScope = "Central" | "Company";
type EvaluationTiming = "After Training" | "30-Day Follow-up";
type EvaluationRespondent = "Employee" | "Manager";
type QuestionType = "Rating" | "Single Choice" | "Text";
type EvaluationSection =
  | "Course Content"
  | "Instructor"
  | "Learning Experience"
  | "Application & Impact"
  | "Comments";

type EvaluationQuestion = {
  id: string;
  prompt: string;
  type: QuestionType;
  section: EvaluationSection;
  required: boolean;
  options: string[];
};

type EvaluationRecord = {
  id: string;
  code: string;
  name: string;
  scope: EvaluationScope;
  company: string;
  timing: EvaluationTiming;
  respondent: EvaluationRespondent;
  anonymous: boolean;
  status: EvaluationStatus;
  questions: EvaluationQuestion[];
  updatedAt: string;
};

type EvaluationForm = Omit<EvaluationRecord, "id" | "questions" | "updatedAt">;
type QuestionDraft = Omit<EvaluationQuestion, "id">;
type FormErrors = Partial<
  Record<keyof EvaluationForm | "questions" | "question", string>
>;
type Feedback = {
  tone: "success" | "error" | "info";
  message: string;
};

const companies = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;
const sections: EvaluationSection[] = [
  "Course Content",
  "Instructor",
  "Learning Experience",
  "Application & Impact",
  "Comments",
];
const ratingOptions = [
  "1 - Strongly disagree",
  "2 - Disagree",
  "3 - Neutral",
  "4 - Agree",
  "5 - Strongly agree",
];

const emptyForm: EvaluationForm = {
  code: "",
  name: "",
  scope: "Central",
  company: companies[0],
  timing: "After Training",
  respondent: "Employee",
  anonymous: true,
  status: "Draft",
};

const emptyQuestionDraft: QuestionDraft = {
  prompt: "",
  type: "Rating",
  section: "Course Content",
  required: true,
  options: ["", "", "", ""],
};

const initialEvaluations: EvaluationRecord[] = [];

const storageKey = EVALUATION_STORAGE_KEY;

const cloneInitialEvaluations = () =>
  initialEvaluations.map((evaluation) => ({
    ...evaluation,
    questions: evaluation.questions.map((question) => ({
      ...question,
      options: [...question.options],
    })),
  }));

const readStoredEvaluations = () => {
  if (typeof window === "undefined") {
    return cloneInitialEvaluations();
  }

  try {
    initializeTrainingFormCatalog();
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) {
      return cloneInitialEvaluations();
    }

    const parsedValue = JSON.parse(storedValue) as unknown;
    return Array.isArray(parsedValue)
      ? (parsedValue as EvaluationRecord[])
      : cloneInitialEvaluations();
  } catch {
    return cloneInitialEvaluations();
  }
};

const generateEvaluationCode = (evaluations: EvaluationRecord[]) => {
  const latestNumber = evaluations.reduce((maximum, evaluation) => {
    const match = evaluation.code.match(/^EVA-(\d+)$/i);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);

  return `EVA-${String(latestNumber + 1).padStart(3, "0")}`;
};

const escapeCsvCell = (value: string | number | boolean) =>
  `"${String(value).replaceAll('"', '""')}"`;

const createEvaluationCsv = (evaluations: EvaluationRecord[]) => {
  const header = [
    "Code",
    "Evaluation Name",
    "Timing",
    "Respondent",
    "Scope",
    "Company",
    "Anonymous",
    "Questions",
    "Required Questions",
    "Status",
    "Updated At",
  ];
  const rows = evaluations.map((evaluation) => [
    evaluation.code,
    evaluation.name,
    evaluation.timing,
    evaluation.respondent,
    evaluation.scope,
    evaluation.company,
    evaluation.anonymous,
    evaluation.questions.length,
    evaluation.questions.filter((question) => question.required).length,
    evaluation.status,
    evaluation.updatedAt,
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
};

export default function EvaluationManagement() {
  const user = useAuthenticatedUser();
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const factoryCompanyCode = companies.find(
    (company) => company === user?.companyCode,
  );
  const availableCompanies =
    isFactoryUser && factoryCompanyCode ? [factoryCompanyCode] : companies;
  const createScopedEmptyForm = (): EvaluationForm => ({
    ...emptyForm,
    scope: isFactoryUser ? "Company" : emptyForm.scope,
    company: factoryCompanyCode ?? emptyForm.company,
  });
  const [evaluations, setEvaluations] =
    useState<EvaluationRecord[]>(cloneInitialEvaluations);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [mode, setMode] = useState<"idle" | "new" | "edit">("idle");
  const [form, setForm] = useState<EvaluationForm>(createScopedEmptyForm);
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [questionDraft, setQuestionDraft] =
    useState<QuestionDraft>(emptyQuestionDraft);
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>(
    {},
  );
  const [search, setSearch] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      setEvaluations(readStoredEvaluations());
      setStorageReady(true);
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(evaluations));
    } catch {
      // The in-memory mock remains usable when browser storage is unavailable.
    }
  }, [evaluations, storageReady]);

  const scopedEvaluations = evaluations.filter(
    (evaluation) =>
      !isFactoryUser ||
      (evaluation.scope === "Company" &&
        evaluation.company === factoryCompanyCode),
  );

  const selectedEvaluation =
    scopedEvaluations.find((evaluation) => evaluation.id === selectedId) ?? null;

  const visibleEvaluations = (() => {
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) {
      return scopedEvaluations;
    }

    return scopedEvaluations.filter((evaluation) =>
      [
        evaluation.code,
        evaluation.name,
        evaluation.scope,
        evaluation.company,
        evaluation.timing,
        evaluation.respondent,
        evaluation.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm),
    );
  })();

  const updateForm = <K extends keyof EvaluationForm,>(
    field: K,
    value: EvaluationForm[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback(null);
  };

  const updateQuestionDraft = <K extends keyof QuestionDraft,>(
    field: K,
    value: QuestionDraft[K],
  ) => {
    setQuestionDraft((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, question: undefined }));
    setFeedback(null);
  };

  const resetQuestionEditor = () => {
    setQuestionDraft(emptyQuestionDraft);
    setEditingQuestionId("");
    setFormErrors((current) => ({ ...current, question: undefined }));
  };

  const closeEditor = () => {
    setMode("idle");
    setForm(createScopedEmptyForm());
    setQuestions([]);
    setPreviewAnswers({});
    setFormErrors({});
    resetQuestionEditor();
  };

  const handleNew = () => {
    setSelectedId("");
    setOpenDetailId("");
    setMode("new");
    setForm(createScopedEmptyForm());
    setQuestions([]);
    setPreviewAnswers({});
    setFormErrors({});
    resetQuestionEditor();
    setFeedback(null);
  };

  const handleEdit = () => {
    if (!selectedEvaluation) {
      return;
    }

    setMode("edit");
    setOpenDetailId(selectedEvaluation.id);
    setForm({
      code: selectedEvaluation.code,
      name: selectedEvaluation.name,
      scope: selectedEvaluation.scope,
      company:
        selectedEvaluation.company === "-"
          ? companies[0]
          : selectedEvaluation.company,
      timing: selectedEvaluation.timing,
      respondent: selectedEvaluation.respondent,
      anonymous: selectedEvaluation.anonymous,
      status: selectedEvaluation.status,
    });
    setQuestions(
      selectedEvaluation.questions.map((question) => ({
        ...question,
        options: [...question.options],
      })),
    );
    setPreviewAnswers({});
    setFormErrors({});
    resetQuestionEditor();
    setFeedback(null);
  };

  const handleDuplicate = () => {
    if (!selectedEvaluation) {
      return;
    }

    const duplicateId = `evaluation-${Date.now()}`;
    const duplicatedEvaluation: EvaluationRecord = {
      ...selectedEvaluation,
      id: duplicateId,
      code: generateEvaluationCode(evaluations),
      name: `${selectedEvaluation.name} (Copy)`,
      status: "Draft",
      updatedAt: new Date().toISOString().slice(0, 10),
      questions: selectedEvaluation.questions.map((question, index) => ({
        ...question,
        id: `${duplicateId}-question-${index + 1}`,
        options: [...question.options],
      })),
    };

    setEvaluations((current) => [duplicatedEvaluation, ...current]);
    setSelectedId(duplicateId);
    setOpenDetailId("");
    setFeedback({
      tone: "success",
      message: "Evaluation duplicated as a new draft.",
    });
  };

  const handleDelete = () => {
    if (!selectedEvaluation) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete "${selectedEvaluation.name}"? This record will be removed from this browser.`,
    );

    if (!shouldDelete) {
      return;
    }

    setEvaluations((current) =>
      current.filter((evaluation) => evaluation.id !== selectedEvaluation.id),
    );
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
    setFeedback({ tone: "success", message: "Evaluation deleted." });
  };

  const handleRefresh = () => {
    setEvaluations(readStoredEvaluations());
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
    setFeedback({
      tone: "info",
      message: "Evaluation data refreshed from browser storage.",
    });
  };

  const handleClearAllData = () => {
    const shouldClear = window.confirm(
      "Clear all Evaluation Management data from this browser? This cannot be undone.",
    );

    if (!shouldClear) {
      return;
    }

    setEvaluations((current) =>
      isFactoryUser
        ? current.filter(
            (evaluation) =>
              evaluation.scope !== "Company" ||
              evaluation.company !== factoryCompanyCode,
          )
        : [],
    );
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
    setSearch("");
    setFeedback({
      tone: "success",
      message: "All Evaluation Management data cleared.",
    });
  };

  const handleExport = () => {
    if (!visibleEvaluations.length) {
      setFeedback({
        tone: "error",
        message: "There are no evaluations to export.",
      });
      return;
    }

    const csvContent = createEvaluationCsv(visibleEvaluations);
    const downloadUrl = URL.createObjectURL(
      new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8" }),
    );
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `evaluation-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    setFeedback({
      tone: "success",
      message: `Exported ${visibleEvaluations.length} evaluation${visibleEvaluations.length === 1 ? "" : "s"} to CSV.`,
    });
  };

  const handleShowDetails = (evaluation: EvaluationRecord) => {
    const isOpen = openDetailId === evaluation.id && mode === "idle";
    setSelectedId(isOpen ? "" : evaluation.id);
    setOpenDetailId(isOpen ? "" : evaluation.id);
    setMode("idle");
    setPreviewAnswers({});
    setFeedback(null);
  };

  const handleAddQuestion = () => {
    const prompt = questionDraft.prompt.trim();
    const choiceOptions = questionDraft.options.map((option) => option.trim());

    if (!prompt) {
      setFormErrors((current) => ({
        ...current,
        question: "Enter an evaluation question.",
      }));
      return;
    }

    if (
      questionDraft.type === "Single Choice" &&
      choiceOptions.filter(Boolean).length < 2
    ) {
      setFormErrors((current) => ({
        ...current,
        question: "Single Choice questions need at least two options.",
      }));
      return;
    }

    const nextQuestion: EvaluationQuestion = {
      ...questionDraft,
      id: editingQuestionId || `evaluation-question-${Date.now()}`,
      prompt,
      options:
        questionDraft.type === "Rating"
          ? [...ratingOptions]
          : questionDraft.type === "Single Choice"
            ? choiceOptions.filter(Boolean)
            : [],
    };

    setQuestions((current) =>
      editingQuestionId
        ? current.map((question) =>
            question.id === editingQuestionId ? nextQuestion : question,
          )
        : [...current, nextQuestion],
    );
    setPreviewAnswers({});
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

  const handleEditQuestion = (question: EvaluationQuestion) => {
    setQuestionDraft({
      prompt: question.prompt,
      type: question.type,
      section: question.section,
      required: question.required,
      options:
        question.type === "Single Choice"
          ? [...question.options, "", "", "", ""].slice(0, 4)
          : ["", "", "", ""],
    });
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

    setPreviewAnswers({});
    setFeedback({ tone: "success", message: "Question removed." });
  };

  const handleMoveQuestion = (questionIndex: number, direction: -1 | 1) => {
    setQuestions((current) => {
      const destinationIndex = questionIndex + direction;

      if (destinationIndex < 0 || destinationIndex >= current.length) {
        return current;
      }

      const reorderedQuestions = [...current];
      [reorderedQuestions[questionIndex], reorderedQuestions[destinationIndex]] =
        [
          reorderedQuestions[destinationIndex],
          reorderedQuestions[questionIndex],
        ];
      return reorderedQuestions;
    });
  };

  const handleSave = () => {
    const errors: FormErrors = {};
    const evaluationCode =
      form.code.trim() || generateEvaluationCode(evaluations);

    if (!form.name.trim()) {
      errors.name = "Evaluation name is required.";
    }

    if (
      evaluations.some(
        (evaluation) =>
          evaluation.id !== selectedId &&
          evaluation.code.toLowerCase() === evaluationCode.toLowerCase(),
      )
    ) {
      errors.code = "Evaluation code already exists.";
    }

    if (form.scope === "Company" && !form.company) {
      errors.company = "Select a company for a company-specific form.";
    }

    if (form.status === "Published" && !questions.length) {
      errors.questions = "Add at least one question before publishing.";
    }

    if (
      form.status === "Published" &&
      !questions.some((question) => question.required)
    ) {
      errors.questions =
        "Published evaluations need at least one required question.";
    }

    if (Object.keys(errors).length) {
      setFormErrors(errors);
      setFeedback({
        tone: "error",
        message: "Please correct the highlighted fields.",
      });
      return;
    }

    const nextEvaluation: EvaluationRecord = {
      ...form,
      scope: isFactoryUser ? "Company" : form.scope,
      id: selectedId || `evaluation-${Date.now()}`,
      code: evaluationCode,
      name: form.name.trim(),
      company: isFactoryUser
        ? factoryCompanyCode ?? form.company
        : form.scope === "Central"
          ? "-"
          : form.company,
      questions,
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    setEvaluations((current) =>
      selectedId
        ? current.map((evaluation) =>
            evaluation.id === selectedId ? nextEvaluation : evaluation,
          )
        : [nextEvaluation, ...current],
    );
    setSelectedId("");
    setOpenDetailId("");
    setMode("idle");
    setForm(createScopedEmptyForm());
    setQuestions([]);
    setPreviewAnswers({});
    setFormErrors({});
    resetQuestionEditor();
    setFeedback({
      tone: "success",
      message: selectedId ? "Evaluation updated." : "Evaluation created.",
    });
  };

  const renderQuestionPreview = (
    previewQuestions: EvaluationQuestion[],
    previewKey: string,
    editable: boolean,
  ) => {
    if (!previewQuestions.length) {
      return (
        <div className={styles.emptyState}>
          No questions yet. Add a question to preview the evaluation form.
        </div>
      );
    }

    return (
      <div className={styles.questionList}>
        {previewQuestions.map((item, index) => {
          const answerKey = `${previewKey}-${item.id}`;

          return (
            <article key={item.id}>
              <div className={styles.questionHeading}>
                <div>
                  <span>{item.section}</span>
                  <strong>
                    {index + 1}. {item.prompt}
                    {item.required ? (
                      <em className={styles.requiredMark}> *</em>
                    ) : null}
                  </strong>
                </div>
                <b>{item.type}</b>
              </div>

              {item.type === "Text" ? (
                <textarea
                  aria-label={`Preview answer for question ${index + 1}`}
                  placeholder="Type a preview response"
                  value={previewAnswers[answerKey] ?? ""}
                  onChange={(event) =>
                    setPreviewAnswers((current) => ({
                      ...current,
                      [answerKey]: event.target.value,
                    }))
                  }
                />
              ) : (
                <div className={styles.previewOptions}>
                  {item.options.map((option) => (
                    <label key={`${item.id}-${option}`}>
                      <input
                        checked={previewAnswers[answerKey] === option}
                        name={answerKey}
                        type="radio"
                        value={option}
                        onChange={(event) =>
                          setPreviewAnswers((current) => ({
                            ...current,
                            [answerKey]: event.target.value,
                          }))
                        }
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {editable ? (
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
                    disabled={index === previewQuestions.length - 1}
                  >
                    Down
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => handleEditQuestion(item)}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={() => handleRemoveQuestion(item.id)}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    );
  };

  const renderEditor = () => (
    <section className={styles.editorPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>
            {mode === "new" ? "New evaluation" : "Edit evaluation"}
          </p>
          <h3>Evaluation form settings</h3>
        </div>
        <button className={styles.closeButton} type="button" onClick={closeEditor}>
          Close
        </button>
      </div>

      <div className={styles.formGrid}>
        <label>
          Evaluation Code
          <input
            aria-invalid={Boolean(formErrors.code)}
            className={formErrors.code ? styles.inputError : undefined}
            value={form.code}
            onChange={(event) => updateForm("code", event.target.value)}
            placeholder="Auto-generated when left blank"
          />
          {formErrors.code ? <small>{formErrors.code}</small> : null}
        </label>
        <label>
          Evaluation Name
          <input
            aria-invalid={Boolean(formErrors.name)}
            className={formErrors.name ? styles.inputError : undefined}
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            placeholder="e.g. Standard Course Evaluation"
          />
          {formErrors.name ? <small>{formErrors.name}</small> : null}
        </label>
        <label>
          Timing
          <select
            value={form.timing}
            onChange={(event) =>
              updateForm("timing", event.target.value as EvaluationTiming)
            }
          >
            <option>After Training</option>
            <option>30-Day Follow-up</option>
          </select>
        </label>
        <label>
          Respondent
          <select
            value={form.respondent}
            onChange={(event) =>
              updateForm(
                "respondent",
                event.target.value as EvaluationRespondent,
              )
            }
          >
            <option>Employee</option>
            <option>Manager</option>
          </select>
        </label>
        <label>
          Scope
          <select
            value={form.scope}
            disabled={isFactoryUser}
            onChange={(event) =>
              updateForm("scope", event.target.value as EvaluationScope)
            }
          >
            <option>Central</option>
            <option>Company</option>
          </select>
        </label>
        <label>
          Company
          <select
            aria-invalid={Boolean(formErrors.company)}
            className={formErrors.company ? styles.inputError : undefined}
            disabled={form.scope === "Central" || isFactoryUser}
            value={form.company}
            onChange={(event) => updateForm("company", event.target.value)}
          >
            {availableCompanies.map((company) => (
              <option key={company}>{company}</option>
            ))}
          </select>
          {formErrors.company ? <small>{formErrors.company}</small> : null}
        </label>
        <label>
          Status
          <select
            value={form.status}
            onChange={(event) =>
              updateForm("status", event.target.value as EvaluationStatus)
            }
          >
            <option>Draft</option>
            <option>Published</option>
            <option>Inactive</option>
          </select>
        </label>
        <label className={styles.toggleLabel}>
          <input
            checked={form.anonymous}
            type="checkbox"
            onChange={(event) => updateForm("anonymous", event.target.checked)}
          />
          Anonymous responses
          <small>Hide the respondent identity in evaluation results.</small>
        </label>
      </div>

      <div className={styles.questionBuilder}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Question builder</p>
            <h3>
              {editingQuestionId ? "Edit question" : "Add evaluation question"}
            </h3>
          </div>
          <span>{questions.length} questions</span>
        </div>

        <div className={styles.questionGrid}>
          <label className={styles.fullWidth}>
            Question
            <textarea
              aria-invalid={Boolean(formErrors.question)}
              className={formErrors.question ? styles.inputError : undefined}
              value={questionDraft.prompt}
              onChange={(event) =>
                updateQuestionDraft("prompt", event.target.value)
              }
              placeholder="Enter the question shown to respondents"
            />
          </label>
          <label>
            Section
            <select
              value={questionDraft.section}
              onChange={(event) =>
                updateQuestionDraft(
                  "section",
                  event.target.value as EvaluationSection,
                )
              }
            >
              {sections.map((section) => (
                <option key={section}>{section}</option>
              ))}
            </select>
          </label>
          <label>
            Answer Type
            <select
              value={questionDraft.type}
              onChange={(event) =>
                updateQuestionDraft(
                  "type",
                  event.target.value as QuestionType,
                )
              }
            >
              <option>Rating</option>
              <option>Single Choice</option>
              <option>Text</option>
            </select>
          </label>
          <label className={styles.toggleLabel}>
            <input
              checked={questionDraft.required}
              type="checkbox"
              onChange={(event) =>
                updateQuestionDraft("required", event.target.checked)
              }
            />
            Required question
          </label>

          {questionDraft.type === "Single Choice"
            ? questionDraft.options.map((option, optionIndex) => (
                <label key={`choice-option-${optionIndex}`}>
                  Choice {optionIndex + 1}
                  <input
                    value={option}
                    onChange={(event) =>
                      updateQuestionDraft(
                        "options",
                        questionDraft.options.map((item, itemIndex) =>
                          itemIndex === optionIndex ? event.target.value : item,
                        ),
                      )
                    }
                  />
                </label>
              ))
            : null}
        </div>

        {questionDraft.type === "Rating" ? (
          <p className={styles.helperText}>
            Rating uses the standard five-point scale from Strongly disagree to
            Strongly agree.
          </p>
        ) : null}
        {formErrors.question ? (
          <p className={styles.validationMessage} role="alert">
            {formErrors.question}
          </p>
        ) : null}

        <div className={styles.formActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleAddQuestion}
          >
            {editingQuestionId ? "Update question" : "Add question"}
          </button>
          {editingQuestionId ? (
            <button
              className={styles.closeButton}
              type="button"
              onClick={resetQuestionEditor}
            >
              Cancel question edit
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Live preview</p>
            <h3>{form.name.trim() || "Untitled evaluation form"}</h3>
          </div>
          <span>
            {form.timing} · {form.respondent}
          </span>
        </div>
        {renderQuestionPreview(questions, "editor-preview", true)}
      </div>

      {formErrors.questions ? (
        <p className={styles.validationMessage} role="alert">
          {formErrors.questions}
        </p>
      ) : null}

      <div className={styles.editorActions}>
        <button className={styles.closeButton} type="button" onClick={closeEditor}>
          Cancel
        </button>
        <button className={styles.primaryButton} type="button" onClick={handleSave}>
          Save evaluation
        </button>
      </div>
    </section>
  );

  const feedbackClass = feedback
    ? {
        success: styles.feedbackSuccess,
        error: styles.feedbackError,
        info: styles.feedbackInfo,
      }[feedback.tone]
    : "";

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
            {visibleEvaluations.length} / {scopedEvaluations.length} evaluations
          </span>
          <input
            aria-label="Search evaluation"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, timing, respondent, scope, company, status"
          />
          <button className={styles.primaryButton} type="button" onClick={handleNew}>
            New
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleEdit}
            disabled={!selectedEvaluation}
          >
            Edit
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleDuplicate}
            disabled={!selectedEvaluation}
          >
            Duplicate
          </button>
          <button
            className={styles.dangerButton}
            type="button"
            onClick={handleDelete}
            disabled={!selectedEvaluation}
          >
            Delete
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleRefresh}
          >
            Refresh
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleExport}
          >
            Export
          </button>
          <button
            className={styles.dangerButton}
            type="button"
            onClick={handleClearAllData}
          >
            Clear all
          </button>
        </div>

        {mode !== "idle" ? renderEditor() : null}
        {feedback ? (
          <p
            className={`${styles.feedback} ${feedbackClass}`}
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.evaluationTable}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Evaluation Name</th>
                <th>Timing</th>
                <th>Respondent</th>
                <th>Scope</th>
                <th>Questions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!visibleEvaluations.length ? (
                <tr>
                  <td className={styles.emptyTableCell} colSpan={8}>
                    {evaluations.length
                      ? "No evaluations match your search."
                      : "No evaluations yet. Select New to create the first form."}
                  </td>
                </tr>
              ) : null}
              {visibleEvaluations.map((evaluation) => {
                const isOpen =
                  openDetailId === evaluation.id && mode === "idle";
                const isSelected = evaluation.id === selectedId;
                const statusClass =
                  evaluation.status === "Published"
                    ? styles.statusPublished
                    : evaluation.status === "Draft"
                      ? styles.statusDraft
                      : styles.statusInactive;

                return (
                  <Fragment key={evaluation.id}>
                    <tr
                      aria-selected={isSelected}
                      className={`${styles.selectableRow} ${isSelected ? styles.selectedRow : ""}`}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedId(isSelected ? "" : evaluation.id);
                        setOpenDetailId("");
                        setFeedback(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(isSelected ? "" : evaluation.id);
                          setOpenDetailId("");
                          setFeedback(null);
                        }
                      }}
                    >
                      <td>{evaluation.code}</td>
                      <td>{evaluation.name}</td>
                      <td>{evaluation.timing}</td>
                      <td>{evaluation.respondent}</td>
                      <td>
                        {evaluation.scope}
                        {evaluation.scope === "Company"
                          ? ` · ${evaluation.company}`
                          : ""}
                      </td>
                      <td>{evaluation.questions.length}</td>
                      <td>
                        <span className={`${styles.statusPill} ${statusClass}`}>
                          {evaluation.status}
                        </span>
                      </td>
                      <td className={styles.actionCell}>
                        <button
                          className={styles.detailButton}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleShowDetails(evaluation);
                          }}
                        >
                          {isOpen ? "Hide" : "Preview"}
                        </button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detailRow}>
                        <td colSpan={8}>
                          <div className={styles.detailPanel}>
                            <div className={styles.panelHeader}>
                              <div>
                                <p className={styles.kicker}>
                                  Evaluation preview
                                </p>
                                <h3>{evaluation.name}</h3>
                              </div>
                              <button
                                className={styles.closeButton}
                                type="button"
                                onClick={() => setOpenDetailId("")}
                              >
                                Close
                              </button>
                            </div>

                            <div className={styles.detailMeta}>
                              <article>
                                <span>Timing</span>
                                <strong>{evaluation.timing}</strong>
                              </article>
                              <article>
                                <span>Respondent</span>
                                <strong>{evaluation.respondent}</strong>
                              </article>
                              <article>
                                <span>Scope</span>
                                <strong>
                                  {evaluation.scope === "Central"
                                    ? "All companies"
                                    : evaluation.company}
                                </strong>
                              </article>
                              <article>
                                <span>Response identity</span>
                                <strong>
                                  {evaluation.anonymous
                                    ? "Anonymous"
                                    : "Identified"}
                                </strong>
                              </article>
                            </div>

                            {renderQuestionPreview(
                              evaluation.questions,
                              `detail-${evaluation.id}`,
                              false,
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
