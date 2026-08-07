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
  status: "Active" | "Draft" | "Inactive";
  courseTypeId: string;
  courseGroupId: string;
  
  standardCode: string;
  standardName: string;
  functionId: string | null;
  targetPositions: string[];
  targetLevels: string[];
  standardYear: number;
};

export type UpdateCourseInput = Partial<CreateCourseInput>;

export type CourseListFilters = {
  search: string | null;
  status: "Active" | "Draft" | "Inactive" | null;
};
