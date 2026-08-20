import type {
  WorkflowCourse,
  WorkflowOapPlan,
  WorkflowStandard,
} from "./trainingWorkflow";

export type CourseOutlineBudget = {
  budgetInstructor?: number | string;
  budgetTraveling?: number | string;
  budgetSeminarRoom?: number | string;
  budgetAccommodation?: number | string;
  budgetMaterial?: number | string;
  budgetFoodBeverage?: number | string;
  totalBudget?: number | string;
};

export type CourseOutlineSchedule = {
  date?: string;
  time?: string;
  location?: string;
};

export type CourseOutlineRequest = {
  course: WorkflowCourse;
  standard?: WorkflowStandard | null;
  oapPlan?: WorkflowOapPlan | null;
  schedule?: CourseOutlineSchedule | null;
  budget?: CourseOutlineBudget | null;
};

// Windows/macOS reject \ / : * ? " < > | in file names; Thai letters are fine.
const sanitizeFileNamePart = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[-\s]+|[-\s]+$/g, "");

export const getCourseOutlineFileName = (
  course: Pick<WorkflowCourse, "courseCode" | "courseNameTh" | "courseNameEn">,
  schedule?: CourseOutlineSchedule | null,
) => {
  const parts = [
    sanitizeFileNamePart(course.courseNameTh || course.courseNameEn || ""),
    sanitizeFileNamePart(course.courseCode || ""),
    sanitizeFileNamePart(schedule?.date || ""),
    sanitizeFileNamePart(schedule?.time || ""),
  ].filter(Boolean);
  return `${parts.join("_") || "course-outline"}.xlsx`;
};
