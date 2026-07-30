export const ASSESSMENT_STORAGE_KEY = "attg-assessment-data-v2";
export const EVALUATION_STORAGE_KEY = "attg-evaluation-data-v2";
const TRAINING_FORM_CATALOG_VERSION_KEY = "attg-training-form-catalog-version";
const TRAINING_FORM_CATALOG_VERSION = "2026-07-30-empty-v1";
const LEGACY_FORM_STORAGE_KEYS = [
  "attg-assessment-mock-v1",
  "attg-evaluation-mock-v1",
];

export type TrainingAssessmentOption = {
  id: string;
  code: string;
  name: string;
  assessmentType: "Pre Test" | "Post Test";
  courseName: string;
  questionCount: number;
};

export type TrainingEvaluationOption = {
  id: string;
  code: string;
  name: string;
  timing: "After Training" | "30-Day Follow-up";
  respondent: "Employee" | "Manager";
  scope: "Central" | "Company";
  company: string;
  questionCount: number;
};

type StoredAssessment = {
  id?: unknown;
  assessmentCode?: unknown;
  assessmentName?: unknown;
  assessmentType?: unknown;
  courseName?: unknown;
  status?: unknown;
  questions?: unknown;
};

type StoredEvaluation = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  timing?: unknown;
  respondent?: unknown;
  scope?: unknown;
  company?: unknown;
  status?: unknown;
  questions?: unknown;
};

const defaultAssessmentOptions: TrainingAssessmentOption[] = [];
const defaultEvaluationOptions: TrainingEvaluationOption[] = [];

export const initializeTrainingFormCatalog = () => {
  if (typeof window === "undefined") {
    return;
  }

  if (
    window.localStorage.getItem(TRAINING_FORM_CATALOG_VERSION_KEY) ===
    TRAINING_FORM_CATALOG_VERSION
  ) {
    return;
  }

  LEGACY_FORM_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.removeItem(ASSESSMENT_STORAGE_KEY);
  window.localStorage.removeItem(EVALUATION_STORAGE_KEY);
  window.localStorage.setItem(
    TRAINING_FORM_CATALOG_VERSION_KEY,
    TRAINING_FORM_CATALOG_VERSION,
  );
};

const readStoredArray = (key: string): unknown[] | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    initializeTrainingFormCatalog();
    const storedValue = window.localStorage.getItem(key);

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as unknown;
    return Array.isArray(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
};

export const readPublishedAssessmentOptions = (): TrainingAssessmentOption[] => {
  const storedAssessments = readStoredArray(ASSESSMENT_STORAGE_KEY);

  if (!storedAssessments) {
    return defaultAssessmentOptions.map((assessment) => ({ ...assessment }));
  }

  return (storedAssessments as StoredAssessment[])
    .filter(
      (assessment) =>
        assessment.status === "Published" &&
        (assessment.assessmentType === "Pre Test" ||
          assessment.assessmentType === "Post Test") &&
        typeof assessment.id === "string" &&
        typeof assessment.assessmentCode === "string" &&
        typeof assessment.assessmentName === "string",
    )
    .map((assessment) => ({
      id: assessment.id as string,
      code: assessment.assessmentCode as string,
      name: assessment.assessmentName as string,
      assessmentType: assessment.assessmentType as "Pre Test" | "Post Test",
      courseName:
        typeof assessment.courseName === "string" ? assessment.courseName : "-",
      questionCount: Array.isArray(assessment.questions)
        ? assessment.questions.length
        : 0,
    }));
};

export const readPublishedEvaluationOptions = (): TrainingEvaluationOption[] => {
  const storedEvaluations = readStoredArray(EVALUATION_STORAGE_KEY);

  if (!storedEvaluations) {
    return defaultEvaluationOptions.map((evaluation) => ({ ...evaluation }));
  }

  return (storedEvaluations as StoredEvaluation[])
    .filter(
      (evaluation) =>
        evaluation.status === "Published" &&
        (evaluation.timing === "After Training" ||
          evaluation.timing === "30-Day Follow-up") &&
        (evaluation.respondent === "Employee" ||
          evaluation.respondent === "Manager") &&
        (evaluation.scope === "Central" || evaluation.scope === "Company") &&
        typeof evaluation.id === "string" &&
        typeof evaluation.code === "string" &&
        typeof evaluation.name === "string",
    )
    .map((evaluation) => ({
      id: evaluation.id as string,
      code: evaluation.code as string,
      name: evaluation.name as string,
      timing: evaluation.timing as "After Training" | "30-Day Follow-up",
      respondent: evaluation.respondent as "Employee" | "Manager",
      scope: evaluation.scope as "Central" | "Company",
      company:
        typeof evaluation.company === "string" ? evaluation.company : "-",
      questionCount: Array.isArray(evaluation.questions)
        ? evaluation.questions.length
        : 0,
    }));
};
