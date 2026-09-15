import type { AuthenticatedPrincipal } from "../auth/types";
import { trainingRecordService } from "../trainingRecord/service";
import { needRequestRepository, type NeedRequestRepository } from "./repository";
import type {
  BulkNeedRequestInput,
  CreateNeedRequestInput,
  NeedRequestActor,
  NeedRequestListFilters,
  UpdateNeedRequestInput,
} from "./types";

/** Who is acting, from the session only - never from the request body. */
export const actorOf = (principal: AuthenticatedPrincipal): NeedRequestActor => ({
  role: principal.role as NeedRequestActor["role"],
  userId: principal.userId,
  employeeUserId: principal.employeeUserId,
  companyId: principal.companyId,
});

export type NeedRequestService = ReturnType<typeof createNeedRequestService>;

export const createNeedRequestService = (
  repository: NeedRequestRepository = needRequestRepository,
) => ({
  listNeedRequests: (filters: NeedRequestListFilters, actor: NeedRequestActor) =>
    repository.list(filters, actor),
  createNeedRequest: (input: CreateNeedRequestInput, employeeUserId: string) =>
    repository.create(input, employeeUserId),
  updateNeedRequest: (id: string, input: UpdateNeedRequestInput, actor: NeedRequestActor) =>
    repository.update(id, input, actor),
  bulkDecide: (input: BulkNeedRequestInput, actor: NeedRequestActor) => repository.bulkDecide(input, actor),
  /** The same section-head picker HRD uses for 30-day reviewers, held to the employee's company. */
  listApprovers: (search: string, companyId: string) =>
    trainingRecordService.listReviewerCandidates(search, companyId),
});

export const needRequestService = createNeedRequestService();
