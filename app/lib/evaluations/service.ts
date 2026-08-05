import { ApiError } from "../api/errors";
import type { AuthenticatedPrincipal } from "../auth/types";
import { evaluationRepository, type EvaluationRepository } from "./repository";
import type { EvaluationListFilters, EvaluationRecord, EvaluationWriteInput } from "./types";

const fail = (code: string, message: string, status: number) => new ApiError({ code, message, status });
type StoredEvaluation = Omit<EvaluationRecord, "canModify" | "canDuplicate">;

const requireFactoryCompany = (principal: AuthenticatedPrincipal) => {
  if (principal.role === "HRD_FACTORY" && !principal.companyId) {
    throw fail("COMPANY_SCOPE_REQUIRED", "The signed-in HRD Factory account has no company scope", 403);
  }
};

const owns = (record: StoredEvaluation, principal: AuthenticatedPrincipal) =>
  principal.role === "HRD_CENTER" ||
  (record.companyId !== null && record.companyId === principal.companyId);

const readable = (record: StoredEvaluation, principal: AuthenticatedPrincipal) =>
  principal.role === "HRD_CENTER" || record.companyId === null || record.companyId === principal.companyId;

const targetCompany = (input: EvaluationWriteInput, principal: AuthenticatedPrincipal) => {
  requireFactoryCompany(principal);
  if (principal.role === "HRD_FACTORY") return principal.companyId!;
  return input.scope === "CENTRAL" ? null : input.companyId;
};

const transitions: Record<EvaluationRecord["status"], readonly EvaluationRecord["status"][]> = {
  DRAFT: ["DRAFT", "PUBLISHED"],
  PUBLISHED: ["PUBLISHED", "INACTIVE"],
  INACTIVE: ["INACTIVE", "PUBLISHED"],
};

export type EvaluationService = ReturnType<typeof createEvaluationService>;

export const createEvaluationService = (repository: EvaluationRepository = evaluationRepository) => ({
  async listEvaluations(filters: EvaluationListFilters, principal: AuthenticatedPrincipal) {
    requireFactoryCompany(principal);
    const result = await repository.list(filters, principal);
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        canModify: owns(item, principal) && !item.isUsed,
        canDuplicate: readable(item, principal),
      })),
    };
  },

  async getEvaluation(evaluationFormId: string, principal: AuthenticatedPrincipal) {
    const record = await repository.findById(evaluationFormId);
    if (!record || !readable(record, principal)) throw fail("EVALUATION_NOT_FOUND", "Evaluation form not found", 404);
    return {
      ...record,
      canModify: owns(record, principal) && !record.isUsed,
      canDuplicate: true,
    };
  },

  async createEvaluation(input: EvaluationWriteInput, principal: AuthenticatedPrincipal) {
    const record = await repository.create(input, targetCompany(input, principal), principal.userId);
    return { ...record, canModify: true, canDuplicate: true };
  },

  async updateEvaluation(evaluationFormId: string, input: EvaluationWriteInput, principal: AuthenticatedPrincipal) {
    const current = await repository.findById(evaluationFormId);
    if (!current) throw fail("EVALUATION_NOT_FOUND", "Evaluation form not found", 404);
    if (!owns(current, principal)) throw fail("EVALUATION_SCOPE_FORBIDDEN", "You cannot modify an evaluation outside your company", 403);
    if (current.isUsed) throw fail("EVALUATION_LOCKED", "An evaluation already in use cannot be modified; duplicate it instead", 409);
    if (input.formCode !== current.formCode) throw fail("EVALUATION_CODE_LOCKED", "An auto-generated evaluation code cannot be changed", 409);
    if (!transitions[current.status].includes(input.status)) {
      throw fail("EVALUATION_STATUS_TRANSITION_INVALID", `Status cannot change from ${current.status} to ${input.status}`, 409);
    }
    const record = await repository.update(current, input, targetCompany(input, principal));
    return { ...record, canModify: true, canDuplicate: true };
  },

  async deleteEvaluation(evaluationFormId: string, principal: AuthenticatedPrincipal) {
    const current = await repository.findById(evaluationFormId);
    if (!current) throw fail("EVALUATION_NOT_FOUND", "Evaluation form not found", 404);
    if (!owns(current, principal)) throw fail("EVALUATION_SCOPE_FORBIDDEN", "You cannot delete an evaluation outside your company", 403);
    if (current.isUsed) throw fail("EVALUATION_IN_USE", "An evaluation already in use cannot be deleted", 409);
    return { evaluation: await repository.delete(current), outcome: "DELETED" as const };
  },
});

export const evaluationService = createEvaluationService();
