import type { AuditActor } from "../audit";
import { oapPlanRepository, type OapPlanRepository } from "./repository";
import type { CreateOapPlanInput, OapPlanListFilters, UpdateOapPlanInput } from "./types";

export type OapPlanService = ReturnType<typeof createOapPlanService>;
export const createOapPlanService = (repository: OapPlanRepository = oapPlanRepository) => ({
  listOapPlans: (filters: OapPlanListFilters, companyId: string | null) => repository.list(filters, companyId),
  async createOapPlan(input: CreateOapPlanInput, userId: string, companyId: string | null) {
    return repository.create(input, userId, companyId);
  },
  async updateOapPlan(id: string, input: UpdateOapPlanInput, userId: string, companyId: string | null) {
    return repository.update(id, input, userId, companyId);
  },
  async deleteOapPlan(id: string, companyId: string | null, actor?: AuditActor) {
    return repository.delete(id, companyId, actor);
  },
});

export const oapPlanService = createOapPlanService();
