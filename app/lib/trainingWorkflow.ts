export type WorkflowOwner = "CENTER" | "FACTORY";

export type WorkflowCourse = {
  id: string;
  courseCode: string;
  courseNameEn: string;
  courseNameTh: string;
  objective: string;
  learningContent: string;
  targetGroup: string;
  methodology: string;
  preTest: string;
  postTest: string;
  evaluation: string;
  evaluationAfter30Day: string;
  lifeCycleMonth: string;
  courseType: string;
  courseGroup: string;
  remark: string;
  status: "Active" | "Inactive";
  updatedAt: string;
  preTestId?: string;
  postTestId?: string;
  evaluationId?: string;
  evaluationAfter30DayId?: string;
  preTestLink?: string;
  postTestLink?: string;
  evaluationLink?: string;
  evaluationAfter30DayLink?: string;
  owner: WorkflowOwner;
  ownerCompany?: string;
  createdBy?: string;
};

export const getCourseDisplayName = (course?: WorkflowCourse | null): string => {
  if (!course) {
    return "";
  }

  const primaryName = course.courseNameTh.trim() || course.courseNameEn.trim();
  return primaryName || course.courseCode;
};

export const getCourseSecondaryName = (course?: WorkflowCourse | null): string => {
  if (!course) {
    return "";
  }

  const primaryName = getCourseDisplayName(course);
  const englishName = course.courseNameEn.trim();

  return englishName && englishName !== primaryName ? englishName : "";
};

export type WorkflowStandard = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  functionCode?: string;
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
  year?: string;
  owner: WorkflowOwner;
  ownerCompany: string;
};

export type WorkflowRollingPlan = {
  rollingId: string;
  scheduleGroupId?: string;
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
  relatedCompanies?: string[];
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
  scheduleGroupId?: string;
  code: string;
  title: string;
  date: string;
  batch?: string;
  startTime?: string;
  endTime?: string;
  company: string;
  relatedCompanies?: string[];
  owner: WorkflowOwner;
  ownerCompany?: string;
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
  employees: "tpm_master_employees",
  functions: "tpm_master_functions",
  positions: "tpm_master_positions",
  levels: "tpm_master_levels",
  instructors: "tpm_master_instructors",
} as const;
export const TRAINING_MASTER_EVENT = "training-master-changed";

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

  const existingVersion = window.localStorage.getItem(WORKFLOW_VERSION_KEY);
  if (existingVersion === WORKFLOW_VERSION) {
    return;
  }

  LEGACY_TRANSACTION_KEYS.forEach((key) => window.localStorage.removeItem(key));
  Object.values(TRAINING_WORKFLOW_KEYS).forEach((key) =>
    window.localStorage.removeItem(key),
  );
  window.localStorage.setItem(WORKFLOW_VERSION_KEY, WORKFLOW_VERSION);
};

export const initializeTrainingWorkflow = () => {
  initializeWorkflow();
};

export const readWorkflowCollection = <T,>(key: string): T[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
};

export const writeWorkflowCollection = <T,>(key: string, items: T[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(TRAINING_WORKFLOW_EVENT));
};

export const readMasterCollection = <T,>(key: string, fallback: T[]): T[] => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch {
    return fallback;
  }
};

export const writeMasterCollection = <T,>(key: string, items: T[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(TRAINING_MASTER_EVENT));
};

export const isWorkflowOwner = (
  owner: WorkflowOwner | undefined,
  ownerCompany: string | undefined,
  userRoleCode: string | undefined,
  userCompanyCode: string | undefined,
): boolean => {
  if (userRoleCode === "HRD_CENTER") {
    return true;
  }

  if (userRoleCode === "HRD_FACTORY") {
    if (!ownerCompany || ownerCompany === "All Companies") {
      return ownerCompany === userCompanyCode || owner === "FACTORY";
    }

    if (owner === "CENTER") {
      return false;
    }

    return ownerCompany === userCompanyCode;
  }

  return true;
};
