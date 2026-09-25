import type { WorkflowCourse, WorkflowOwner } from "../trainingWorkflow";

export type OapPlanStatus = "Planning" | "Planned" | "Cancel";

export type OapPlanRecord = {
  id: string;
  sequence: number;
  planYear: number;
  course: WorkflowCourse;
  participants: string;
  hours: string;
  budget: string;
  budgetInstructor: string;
  budgetTraveling: string;
  budgetSeminarRoom: string;
  budgetAccommodation: string;
  budgetMaterial: string;
  budgetFoodBeverage: string;
  trainer: string;
  instructorId: string | null;
  instructorTelephone: string;
  instructorEmail: string;
  instructorEducation: string;
  instructorOrganization: string;
  instructorUniversity: string;
  providerId: string | null;
  providerName: string;
  createdBy: string;
  status: OapPlanStatus;
  owner: WorkflowOwner;
  ownerCompany: string;
  targetSnapshot?: import("../trainingWorkflow").PlanTargetGroupSnapshot;
};

export type CreateOapPlanInput = {
  courseId: string;
  planYear: number;
  participants: number;
  hours: number;
  budget: string;
  budgetInstructor: string;
  budgetTraveling: string;
  budgetSeminarRoom: string;
  budgetAccommodation: string;
  budgetMaterial: string;
  budgetFoodBeverage: string;
  trainerName: string;
  instructorId: string | null;
  instructorTelephone?: string;
  instructorEmail?: string;
  instructorEducation?: string;
  instructorOrganization?: string;
  instructorUniversity?: string;
  providerName: string;
  providerId: string | null;
  status: OapPlanStatus;
};

export type UpdateOapPlanInput = Partial<CreateOapPlanInput>;

export type OapPlanListFilters = {
  search: string | null;
  status: OapPlanStatus | null;
  planYear?: number | null;
};
