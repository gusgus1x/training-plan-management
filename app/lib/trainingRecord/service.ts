import type { AuthenticatedPrincipal } from "../auth/types";
import { trainingRecordRepository, type TrainingRecordRepository } from "./repository";
import type { SaveExpensesInput, SaveResultsInput, SaveReviewersInput } from "./types";

export type TrainingRecordService = ReturnType<typeof createTrainingRecordService>;
export const createTrainingRecordService = (repository: TrainingRecordRepository = trainingRecordRepository) => ({
  listTrainingRecords: (companyId: string | null) => repository.list(companyId),
  saveTrainingRecordExpenses: (planId: string, input: SaveExpensesInput, userId: string, companyId: string | null) =>
    repository.saveExpenses(planId, input, userId, companyId),
  saveTrainingResults: (planId: string, input: SaveResultsInput, companyId: string | null) =>
    repository.saveResults(planId, input, companyId),
  getCostBreakdown: (planId: string, principal: AuthenticatedPrincipal) =>
    repository.getCostBreakdown(planId, principal),
  listReviewerCandidates: (search: string, companyId: string | null) =>
    repository.listReviewerCandidates(search, companyId),
  saveTrainingReviewers: (planId: string, input: SaveReviewersInput, userId: string, companyId: string | null) =>
    repository.saveReviewers(planId, input, userId, companyId),
});

export const trainingRecordService = createTrainingRecordService();
