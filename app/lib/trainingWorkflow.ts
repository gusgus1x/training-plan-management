export type WorkflowOwner = "CENTER" | "FACTORY";

export type WorkflowCourse = {
  id: string;
  courseCode: string;
  courseNameTh: string;
  courseNameEn: string;
  objective: string;
  learningContent: string;
  targetGroup: string;
  methodology: string;
  preTest: string;
  postTest: string;
  evaluation: string;
  evaluationAfter30Day: string;
  lifeCycleMonth: string;
  remark: string;
  status: "Active" | "Draft" | "Inactive";
  courseType: string;
  courseGroup: string;
  updatedAt: string;
  owner: WorkflowOwner;
  ownerCompany: string;
  createdBy: string;
};

export type WorkflowStandard = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  functionName: string;
  positions: string[];
  levels: string[];
  owner: WorkflowOwner;
  ownerCompany: string;
};

export type WorkflowOapPlan = {
  id: string;
  sequence: number;
  course: WorkflowCourse;
  participants: string;
  hours: string;
  budget: string;
  trainer: string;
  provider: string;
  createdBy: string;
  status: "Planning" | "Planned" | "Cancel";
  owner: WorkflowOwner;
  ownerCompany: string;
};

export type WorkflowRollingPlan = {
  rollingId: string;
  oapId: string;
  sequence: number;
  course: WorkflowCourse;
  participants: string;
  hours: string;
  budget: string;
  trainer: string;
  provider: string;
  ownerName: string;
  owner: WorkflowOwner;
  ownerCompany: string;
  batch: string;
  location: string;
  trainingDate: string;
  startTime: string;
  endTime: string;
  company: string;
  status: "Planning" | "Planned";
  updatedAt: string;
};

export type WorkflowRegistration = {
  id: string;
  rollingId: string;
  employeeCode: string;
  employeeName: string;
  company: string;
  department: string;
  position: string;
  level: string;
  registeredAt: string;
};

export type WorkflowAcceptance = {
  id: string;
  name: string;
  company: string;
  department: string;
  position: string;
  level: string;
  legacyLabel: string;
  courseId: string;
  source:
    | "Employee Registration"
    | "Auto Target"
    | "Added by Center"
    | "Submitted by Factory";
  status:
    | "Pending Approval"
    | "Target"
    | "Factory Submitted"
    | "Factory Approved"
    | "Center Approved"
    | "Rejected";
  remark: string;
};

export type WorkflowCompletedCourse = {
  id: string;
  rollingId: string;
  code: string;
  title: string;
  date: string;
  company: string;
  owner: WorkflowOwner;
  room: string;
  instructor: string;
  hours: number;
  attendees: Array<{
    id: string;
    company: string;
    employeeCode: string;
    name: string;
    department: string;
    registered: boolean;
    attended: boolean;
  }>;
  expenses: {
    accommodation: number;
    foodBeverage: number;
    instructor: number;
    material: number;
    seminarRoom: number;
    traveling: number;
  };
  savedAt: string;
};

export const TRAINING_WORKFLOW_KEYS = {
  courses: "tpm_workflow_courses",
  standards: "tpm_workflow_standards",
  oapPlans: "tpm_workflow_oap_plans",
  rollingPlans: "tpm_workflow_rolling_plans",
  registrations: "tpm_workflow_registrations",
  acceptances: "tpm_workflow_acceptances",
  completedCourses: "tpm_workflow_completed_courses",
} as const;

export const TRAINING_WORKFLOW_EVENT = "training-workflow-changed";
export const TRAINING_MASTER_KEYS = {
  courseTypes: "tpm_master_course_types",
  courseGroups: "tpm_master_course_groups",
} as const;

const WORKFLOW_VERSION_KEY = "tpm_mock_workflow_version";
const WORKFLOW_VERSION = "2026-07-24-clean-2";
const LEGACY_TRANSACTION_KEYS = [
  "training-plan.employee-training-requests",
  "training-plan.approved-training-need",
  "training_accept_survey_candidates",
];

const initializeWorkflow = () => {
  if (typeof window === "undefined") {
    return;
  }

  if (window.localStorage.getItem(WORKFLOW_VERSION_KEY) === WORKFLOW_VERSION) {
    return;
  }

  Object.values(TRAINING_WORKFLOW_KEYS).forEach((key) => window.localStorage.removeItem(key));
  LEGACY_TRANSACTION_KEYS.forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.setItem(WORKFLOW_VERSION_KEY, WORKFLOW_VERSION);
};

export const initializeTrainingWorkflow = initializeWorkflow;

export const readWorkflowCollection = <T>(key: string): T[] => {
  if (typeof window === "undefined") {
    return [];
  }

  initializeWorkflow();

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T[]) : [];
  } catch {
    return [];
  }
};

export const writeWorkflowCollection = <T>(key: string, records: T[]) => {
  if (typeof window === "undefined") {
    return;
  }

  initializeWorkflow();
  window.localStorage.setItem(key, JSON.stringify(records));
  window.dispatchEvent(new CustomEvent(TRAINING_WORKFLOW_EVENT, { detail: { key } }));
};

export const readMasterCollection = <T>(key: string, defaults: T[]): T[] => {
  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T[]) : defaults;
  } catch {
    return defaults;
  }
};

export const writeMasterCollection = <T>(key: string, records: T[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(records));
};

export const isWorkflowOwner = (
  owner: WorkflowOwner,
  ownerCompany: string,
  roleCode: string | undefined,
  companyCode: string,
) =>
  roleCode === "HRD_CENTER"
    ? owner === "CENTER"
    : owner === "FACTORY" && ownerCompany === companyCode;
