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
  /** This batch's own form choices. Empty string means "use the course's", which is what almost
   *  every batch holds - `course` above still carries the course-level default to fall back to. */
  formOverrides: RollingPlanFormOverrides;
  /** False once the course has started: every form opens at start_datetime, so up to that moment
   *  nobody can have answered anything and the swap is free. After it, changing the form would
   *  hand different trainees in one batch different papers. */
  canEditForms: boolean;
};

export type RollingPlanFormOverrides = {
  preAssessmentId: string;
  postAssessmentId: string;
  evaluationFormId: string;
  evaluationFormAfter30DayId: string;
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
  /** Optional per-batch forms, set while creating rather than in a second edit. Omitted or empty
   *  means the batch follows the course, which is what most batches want. */
  formOverrides?: Partial<RollingPlanFormOverrides>;
};

export type UpdateRollingPlanInput = Partial<CreateRollingPlanInput> & {
  /** Each field is optional; an empty string clears the override back to the course's form. */
  formOverrides?: Partial<RollingPlanFormOverrides>;
};

export type RollingPlanListFilters = {
  search: string | null;
  status: RollingPlanStatus | null;
  oapPlanId: string | null;
};
