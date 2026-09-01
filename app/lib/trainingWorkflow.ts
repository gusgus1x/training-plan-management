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
  status: "Active" | "Draft" | "Inactive";
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
  /** Courses that must be completed before this one can be registered for. Empty/undefined means
   *  no condition. See app/lib/courses/repository.ts and prisma/migrations/31_Add_Course_Prerequisite.sql. */
  prerequisites?: Array<{ id: string; courseCode: string; courseName: string }>;
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
  companies?: string[];
  functionId?: string;
  divisionId?: string;
  departmentId?: string;
  sectionId?: string;
  targetOrgScopes?: Array<{
    functionId?: string | null;
    divisionId?: string | null;
    departmentId?: string | null;
    sectionId?: string | null;
    functionCode?: string;
    functionName?: string;
    divisionCode?: string;
    division?: string;
    departmentCode?: string;
    department?: string;
    sectionCode?: string;
    section?: string;
  }>;
  functionCode?: string;
  functionName: string;
  divisionCode?: string;
  division?: string;
  departmentCode?: string;
  department?: string;
  sectionCode?: string;
  section?: string;
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

// Only these three are still referenced. rollingPlans, registrations, acceptances and
// completedCourses had no reader and no writer left; registrations went when employee sign-up moved
// onto training_enrollment. Their raw strings stay in LEGACY_TRANSACTION_KEYS below so browsers
// that still hold the old values get them cleared.
export const TRAINING_WORKFLOW_KEYS = {
  courses: "tpm_workflow_courses",
  standards: "tpm_workflow_standards",
  oapPlans: "tpm_workflow_oap_plans",
} as const;

export const TRAINING_WORKFLOW_EVENT = "training-workflow-changed";
// Every master list except employees moved to the API; the other seven keys had no reader or writer.
export const TRAINING_MASTER_KEYS = {
  employees: "tpm_master_employees",
} as const;
export const TRAINING_MASTER_EVENT = "training-master-changed";

const WORKFLOW_VERSION_KEY = "tpm_mock_workflow_version";
const WORKFLOW_VERSION = "2026-08-13-wipe-all-transactions-v1";
const LEGACY_TRANSACTION_KEYS = [
  "training-plan.employee-training-requests",
  "training-plan.approved-training-need",
  "training_accept_survey_candidates",
  "training_records_uploaded_history",
  "tpm_training_actual_drafts",
  "tpm_workflow_courses",
  "tpm_workflow_standards",
  "tpm_workflow_oap_plans",
  "tpm_workflow_rolling_plans",
  "tpm_workflow_registrations",
  "tpm_workflow_acceptances",
  "tpm_workflow_completed_courses",
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

  initializeWorkflow();

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
    if (!userCompanyCode) {
      return true;
    }
    if (ownerCompany === "All Companies") {
      return true;
    }
    if (owner === "CENTER" || ownerCompany === "HRD Center") {
      return true;
    }
    return !ownerCompany || ownerCompany === userCompanyCode;
  }

  return true;
};
