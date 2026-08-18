import type { AuthenticatedPrincipal } from "../auth/types";
import { trainingRecordRepository, type TrainingRecordRepository } from "./repository";
import type { SaveExpensesInput } from "./types";

export type TrainingRecordService = ReturnType<typeof createTrainingRecordService>;
export const createTrainingRecordService = (repository: TrainingRecordRepository = trainingRecordRepository) => ({
  listTrainingRecords: (companyId: string | null) => repository.list(companyId),
  saveTrainingRecordExpenses: (planId: string, input: SaveExpensesInput, userId: string, companyId: string | null) =>
    repository.saveExpenses(planId, input, userId, companyId),
  getCostBreakdown: (planId: string, principal: AuthenticatedPrincipal) =>
    repository.getCostBreakdown(planId, principal),
});

export const trainingRecordService = createTrainingRecordService();
