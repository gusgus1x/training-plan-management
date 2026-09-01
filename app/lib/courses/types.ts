export type TargetOrgScope = {
  functionId?: string | null;
  divisionId?: string | null;
  departmentId?: string | null;
  sectionId?: string | null;
};

export type CreateCourseInput = {
  courseNameTh: string;
  courseNameEn: string;
  objective: string;
  learningContent: string;
  targetGroup: string;
  methodology: string;
  durationHours: number;
  validityMonths: number | null;
  preAssessmentId: string | null;
  postAssessmentId: string | null;
  evaluationFormId: string | null;
  evaluationFormAfter30DayId: string | null;
  preTestLink: string | null;
  postTestLink: string | null;
  evaluationLink: string | null;
  evaluationAfter30DayLink?: string | null;
  remark?: string | null;
  description?: string | null;
  status: "Active" | "Draft" | "Inactive";
  courseTypeId: string;
  courseGroupId: string;
  
  standardCode: string;
  standardName: string;
  functionId: string | null;
  divisionId: string | null;
  departmentId: string | null;
  sectionId: string | null;
  targetOrgScopes?: TargetOrgScope[];
  targetCompanies: string[];
  targetPositions: string[];
  targetLevels: string[];
  standardYear: number;
  /** Course ids that must be completed (training_result.completion_status = COMPLETED) before this
   *  course can be registered for. Empty means no condition. */
  prerequisiteCourseIds: string[];
};

export type UpdateCourseInput = Partial<CreateCourseInput>;

export type CourseListFilters = {
  search: string | null;
  status: "Active" | "Draft" | "Inactive" | null;
};
