import type { AuditActor } from "../audit";
import { publish } from "../realtime/bus";
import { rollingPlanRepository, type RollingPlanRepository } from "./repository";
import type { CreateRollingPlanInput, RollingPlanListFilters, UpdateRollingPlanInput } from "./types";

// A batch shows on the calendar, Register and dashboards of anyone signed in, and each page asks
// its own scoped API again, so everyone is told.
const announce = (planId?: string) => publish({ type: "plan.changed", planId }, { all: true });

export type RollingPlanService = ReturnType<typeof createRollingPlanService>;
export const createRollingPlanService = (repository: RollingPlanRepository = rollingPlanRepository) => ({
  listRollingPlans: (filters: RollingPlanListFilters, companyId: string | null) => repository.list(filters, companyId),
  async createRollingPlan(input: CreateRollingPlanInput, userId: string, companyId: string | null) {
    const created = await repository.create(input, userId, companyId);
    announce();
    return created;
  },
  async updateRollingPlan(id: string, input: UpdateRollingPlanInput, userId: string, companyId: string | null) {
    const updated = await repository.update(id, input, userId, companyId);
    announce(id);
    return updated;
  },
  async deleteRollingPlan(id: string, companyId?: string | null, actor?: AuditActor) {
    const deleted = await repository.delete(id, companyId ?? null, actor);
    announce(id);
    return deleted;
  },
});

export const rollingPlanService = createRollingPlanService();
