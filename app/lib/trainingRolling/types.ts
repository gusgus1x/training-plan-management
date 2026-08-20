import type { WorkflowCourse, WorkflowOwner } from "../trainingWorkflow";

export type RollingPlanStatus = "Planning" | "Planned" | "Cancel";

export type RollingPlanRecord = {
  id: string;
  oapPlanId: string;
  batchNo: number;
  batchName: string;
  planCode: string;
  planName: string;
  venue: string;
  trainingDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  status: RollingPlanStatus;
  dbStatus?: string;
  createdBy: string;
  updatedAt: string;
  course: WorkflowCourse;
  oapParticipants: string;
  oapHours: string;
  oapBudget: string;
  oapBudgetInstructor: string;
  oapBudgetTraveling: string;
  oapBudgetSeminarRoom: string;
  oapBudgetAccommodation: string;
  oapBudgetMaterial: string;
  oapBudgetFoodBeverage: string;
  oapTrainer: string;
  oapProvider: string;
  owner: WorkflowOwner;
  ownerCompany: string;
};

export type CreateRollingPlanInput = {
  oapPlanId: string;
  batchName: string | null;
  venue: string;
  trainingDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  status: RollingPlanStatus;
};

export type UpdateRollingPlanInput = Partial<CreateRollingPlanInput>;

export type RollingPlanListFilters = {
  search: string | null;
  status: RollingPlanStatus | null;
  oapPlanId: string | null;
};
