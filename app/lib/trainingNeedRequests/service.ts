import type { AuthenticatedPrincipal } from "../auth/types";
import { publish } from "../realtime/bus";
import { trainingRecordService } from "../trainingRecord/service";
import { needRequestRepository, type NeedRequestRepository } from "./repository";
import type {
  BulkNeedRequestInput,
  CreateNeedRequestInput,
  NeedRequestActor,
  NeedRequestListFilters,
  NeedRequestRecord,
  UpdateNeedRequestInput,
} from "./types";

/** The requester, their section head and every HRD account; each refetches its own scoped list. */
type Announced = Pick<NeedRequestRecord, "employeeUserId" | "approver">;
const announce = (records: Announced[]) => {
  const people = records.flatMap((record) => [record.employeeUserId, record.approver?.userId]);
  publish({ type: "needRequest.changed" }, { roles: ["HRD_CENTER", "HRD_FACTORY"], employees: people, accounts: people });
};

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
  async createNeedRequest(input: CreateNeedRequestInput, employeeUserId: string) {
    const created = await repository.create(input, employeeUserId);
    announce([created]);
    return created;
  },
  async updateNeedRequest(id: string, input: UpdateNeedRequestInput, actor: NeedRequestActor) {
    const updated = await repository.update(id, input, actor);
    announce([updated]);
    return updated;
  },
  async bulkDecide(input: BulkNeedRequestInput, actor: NeedRequestActor) {
    const result = await repository.bulkDecide(input, actor);
    announce(Array.isArray(result) ? result : []);
    return result;
  },
  /** The same section-head picker HRD uses for 30-day reviewers. Null company lists every company. */
  listApprovers: (search: string, companyId: string | null) =>
    trainingRecordService.listReviewerCandidates(search, companyId),
});

export const needRequestService = createNeedRequestService();
