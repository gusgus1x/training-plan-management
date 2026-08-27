import { needRequestRepository, type NeedRequestRepository } from "./repository";
import type {
  CreateNeedRequestInput,
  NeedRequestAction,
  NeedRequestListFilters,
} from "./types";

export type NeedRequestService = ReturnType<typeof createNeedRequestService>;

export const createNeedRequestService = (
  repository: NeedRequestRepository = needRequestRepository,
) => ({
  listNeedRequests: (filters: NeedRequestListFilters, companyId: string | null) =>
    repository.list(filters, companyId),
  createNeedRequest: (input: CreateNeedRequestInput, employeeUserId: string) =>
    repository.create(input, employeeUserId),
  updateNeedRequestStatus: (
    id: string,
    action: NeedRequestAction,
    note: string | null,
    reviewerUserId: string,
    companyId: string | null,
  ) => repository.updateStatus(id, action, note, reviewerUserId, companyId),
});

export const needRequestService = createNeedRequestService();
