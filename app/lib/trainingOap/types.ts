import type { WorkflowCourse, WorkflowOwner } from "../trainingWorkflow";

export type OapPlanStatus = "Planning" | "Planned" | "Cancel";

export type OapPlanRecord = {
  id: string;
  sequence: number;
  course: WorkflowCourse;
  participants: string;
  hours: string;
  budget: string;
  trainer: string;
  providerId: string | null;
  providerName: string;
  createdBy: string;
  status: OapPlanStatus;
  owner: WorkflowOwner;
  ownerCompany: string;
};

export type CreateOapPlanInput = {
  courseId: string;
  planYear: number;
  participants: number;
  hours: number;
  budget: string;
  trainerName: string;
  instructorId: string | null;
  providerName: string;
  providerId: string | null;
  status: OapPlanStatus;
};

export type UpdateOapPlanInput = Partial<CreateOapPlanInput>;

export type OapPlanListFilters = {
  search: string | null;
  status: OapPlanStatus | null;
};
