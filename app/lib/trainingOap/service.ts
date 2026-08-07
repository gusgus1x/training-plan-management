import { oapPlanRepository, type OapPlanRepository } from "./repository";
import type { CreateOapPlanInput, OapPlanListFilters, UpdateOapPlanInput } from "./types";

export type OapPlanService = ReturnType<typeof createOapPlanService>;
export const createOapPlanService = (repository: OapPlanRepository = oapPlanRepository) => ({
  listOapPlans: (filters: OapPlanListFilters, companyId: string | null) => repository.list(filters, companyId),
  async createOapPlan(input: CreateOapPlanInput, userId: string, companyId: string | null) {
    return repository.create(input, userId, companyId);
  },
  async updateOapPlan(id: string, input: UpdateOapPlanInput, userId: string) {
    return repository.update(id, input, userId);
  },
  async deleteOapPlan(id: string) {
    return repository.delete(id);
  },
});

export const oapPlanService = createOapPlanService();
