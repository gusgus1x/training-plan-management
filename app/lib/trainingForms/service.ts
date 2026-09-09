import { trainingFormsRepository, type TrainingFormsRepository } from "./repository";
import type {
  EvaluationRespondentGroup,
  EvaluationTimingStage,
  GradedStage,
  GradeSubmissionInput,
  SetStageClosedInput,
  SubmitAssessmentInput,
  SubmitEvaluationInput,
} from "./types";

export type TrainingFormsService = ReturnType<typeof createTrainingFormsService>;

export const createTrainingFormsService = (repository: TrainingFormsRepository = trainingFormsRepository) => ({
  readAssessment: (enrollmentId: string, stage: GradedStage, employeeId: string | null, employeeUserId: string | null) =>
    repository.readAssessmentForEmployee(enrollmentId, stage, employeeId, employeeUserId),

  submitAssessment: (
    enrollmentId: string,
    stage: GradedStage,
    input: SubmitAssessmentInput,
    employeeId: string | null,
    employeeUserId: string | null,
  ) => repository.submitAssessment(enrollmentId, stage, input, employeeId, employeeUserId),

  readAssessmentReview: (
    enrollmentId: string,
    stage: GradedStage,
    employeeId: string | null,
    employeeUserId: string | null,
    attemptNo: number | null = null,
  ) => repository.readAssessmentReviewForEmployee(enrollmentId, stage, employeeId, employeeUserId, attemptNo),

  readEvaluation: (
    enrollmentId: string,
    timing: "EVALUATION" | "EVALUATION_30DAY",
    employeeId: string | null,
    employeeUserId: string | null,
  ) => repository.readEvaluationForEmployee(enrollmentId, timing, employeeId, employeeUserId),

  submitEvaluation: (
    enrollmentId: string,
    timing: "EVALUATION" | "EVALUATION_30DAY",
    input: SubmitEvaluationInput,
    employeeId: string | null,
    employeeUserId: string | null,
  ) => repository.submitEvaluation(enrollmentId, timing, input, employeeId, employeeUserId),

  listAssignedEvaluations: (reviewerUserId: string) => repository.listAssignedEvaluations(reviewerUserId),

  markAssignedEvaluationOpened: (enrollmentId: string, reviewerUserId: string) =>
    repository.markAssignedEvaluationOpened(enrollmentId, reviewerUserId),

  listPendingGrading: (planId: string, companyId: string | null) => repository.listPendingGrading(planId, companyId),

  readSubmissionForHrd: (planId: string, submissionId: string, companyId: string | null) =>
    repository.readSubmissionForHrd(planId, submissionId, companyId),

  readEvaluationSummary: (
    planId: string,
    timing: EvaluationTimingStage,
    companyId: string | null,
    respondentGroup: EvaluationRespondentGroup = "EMPLOYEE",
  ) => repository.readEvaluationSummary(planId, timing, companyId, respondentGroup),

  gradeSubmission: (submissionId: string, input: GradeSubmissionInput, gradedByUserId: string, companyId: string | null) =>
    repository.gradeSubmission(submissionId, input, gradedByUserId, companyId),

  publishSubmissionResults: (submissionId: string, publishedByUserId: string, companyId: string | null) =>
    repository.publishSubmissionResults(submissionId, publishedByUserId, companyId),

  listPlanStageSettings: (planId: string, companyId: string | null) => repository.listPlanStageSettings(planId, companyId),

  setStageClosed: (planId: string, input: SetStageClosedInput, userId: string, companyId: string | null) =>
    repository.setStageClosed(planId, input, userId, companyId),
});

export const trainingFormsService = createTrainingFormsService();
