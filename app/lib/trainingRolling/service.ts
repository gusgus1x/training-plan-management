import { rollingPlanRepository, type RollingPlanRepository } from "./repository";
import type { CreateRollingPlanInput, RollingPlanListFilters, UpdateRollingPlanInput } from "./types";

export type RollingPlanService = ReturnType<typeof createRollingPlanService>;
export const createRollingPlanService = (repository: RollingPlanRepository = rollingPlanRepository) => ({
  listRollingPlans: (filters: RollingPlanListFilters, companyId: string | null) => repository.list(filters, companyId),
  async createRollingPlan(input: CreateRollingPlanInput, userId: string, companyId: string | null) {
    return repository.create(input, userId, companyId);
  },
  async updateRollingPlan(id: string, input: UpdateRollingPlanInput, userId: string, companyId: string | null) {
    return repository.update(id, input, userId, companyId);
  },
  async deleteRollingPlan(id: string) {
    return repository.delete(id);
  },
});

export const rollingPlanService = createRollingPlanService();
