"use client";

import type {
  AssessmentForEmployee,
  AssessmentReview,
  AssignedEvaluation,
  EvaluationForEmployee,
  EvaluationRespondentGroup,
  EvaluationSummary,
  GradeSubmissionInput,
  GradedStage,
  PendingGradingSubmission,
  SubmissionReview,
  SetStageClosedInput,
  StageSetting,
  SubmissionSummary,
  SubmitAssessmentInput,
  SubmitEvaluationInput,
} from "./types";

type Fetcher = typeof fetch;
type Envelope<T> = { ok: true; data: T } | { ok: false; error?: { code?: string; message?: string; details?: Record<string, unknown> } };

export class TrainingFormsClientError extends Error {
  readonly details?: Record<string, unknown>;
  constructor(
    readonly code = "TRAINING_FORMS_REQUEST_FAILED",
    message = "Training forms request failed",
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TrainingFormsClientError";
    this.details = details;
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new TrainingFormsClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new TrainingFormsClientError(error?.code, error?.message, error?.details);
  }
  return body.data;
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const readAssessment = async (enrollmentId: string, stage: GradedStage, fetcher: Fetcher = fetch) =>
  read<AssessmentForEmployee>(
    await fetcher(`/api/training-plan/enrollments/${enrollmentId}/assessments/${stage}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );

export const readAssessmentReview = async (
  enrollmentId: string,
  stage: GradedStage,
  /** Which attempt to open. Null asks for the best-scoring one, which is what the panel opens on. */
  attemptNo: number | null = null,
  fetcher: Fetcher = fetch,
) =>
  read<{ review: AssessmentReview | null }>(
    await fetcher(
      `/api/training-plan/enrollments/${enrollmentId}/assessments/${stage}/review${
        attemptNo === null ? "" : `?attempt=${attemptNo}`
      }`,
      { credentials: "include", cache: "no-store" },
    ),
  );

export const submitAssessment = async (
  enrollmentId: string,
  stage: GradedStage,
  input: SubmitAssessmentInput,
  fetcher: Fetcher = fetch,
) =>
  read<SubmissionSummary>(
    await fetcher(`/api/training-plan/enrollments/${enrollmentId}/assessments/${stage}`, json("POST", input)),
  );

export const readEvaluation = async (
  enrollmentId: string,
  timing: "EVALUATION" | "EVALUATION_30DAY",
  fetcher: Fetcher = fetch,
) =>
  read<EvaluationForEmployee>(
    await fetcher(`/api/training-plan/enrollments/${enrollmentId}/evaluations/${timing}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );

export const submitEvaluation = async (
  enrollmentId: string,
  timing: "EVALUATION" | "EVALUATION_30DAY",
  input: SubmitEvaluationInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ submitted: true }>(
    await fetcher(`/api/training-plan/enrollments/${enrollmentId}/evaluations/${timing}`, json("POST", input)),
  );

export const listPendingGrading = async (planId: string, fetcher: Fetcher = fetch) =>
  read<{ submissions: PendingGradingSubmission[] }>(
    await fetcher(`/api/training-plan/training-records/${planId}/submissions`, { credentials: "include", cache: "no-store" }),
  );

export const gradeSubmission = async (
  planId: string,
  submissionId: string,
  input: GradeSubmissionInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ graded: true }>(
    await fetcher(`/api/training-plan/training-records/${planId}/submissions/${submissionId}`, json("PUT", input)),
  );

export const readEvaluationSummary = async (
  planId: string,
  timing: "EVALUATION" | "EVALUATION_30DAY",
  respondents: EvaluationRespondentGroup = "EMPLOYEE",
  fetcher: Fetcher = fetch,
) =>
  read<{ summary: EvaluationSummary | null }>(
    await fetcher(`/api/training-plan/training-records/${planId}/evaluations/${timing}?respondents=${respondents}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );

export const publishSubmissionResults = async (planId: string, submissionId: string, fetcher: Fetcher = fetch) =>
  read<{ published: true }>(
    await fetcher(`/api/training-plan/training-records/${planId}/submissions/${submissionId}`, json("POST", {})),
  );

export const listPlanStageSettings = async (planId: string, fetcher: Fetcher = fetch) =>
  read<{ settings: StageSetting[] }>(
    await fetcher(`/api/training-plan/training-records/${planId}/form-settings`, { credentials: "include", cache: "no-store" }),
  );

export const setStageClosed = async (planId: string, input: SetStageClosedInput, fetcher: Fetcher = fetch) =>
  read<{ closed: boolean }>(
    await fetcher(`/api/training-plan/training-records/${planId}/form-settings`, json("PUT", input)),
  );

export const listAssignedEvaluations = async (fetcher: Fetcher = fetch) =>
  read<{ assignedEvaluations: AssignedEvaluation[] }>(
    await fetcher("/api/training-plan/assigned-evaluations", { credentials: "include", cache: "no-store" }),
  );

export const markAssignedEvaluationOpened = async (enrollmentId: string, fetcher: Fetcher = fetch) =>
  read<{ opened: true }>(
    await fetcher("/api/training-plan/assigned-evaluations", json("POST", { enrollmentId })),
  );

export const readSubmissionReview = async (planId: string, submissionId: string, fetcher: Fetcher = fetch) =>
  read<{ review: SubmissionReview }>(
    await fetcher(`/api/training-plan/training-records/${planId}/submissions/${submissionId}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );
