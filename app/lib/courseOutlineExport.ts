import type {
  WorkflowCourse,
  WorkflowOapPlan,
  WorkflowStandard,
} from "./trainingWorkflow";

export type CourseOutlineRequest = {
  course: WorkflowCourse;
  standard?: WorkflowStandard | null;
  oapPlan?: WorkflowOapPlan | null;
};

export const getCourseOutlineFileName = (
  course: Pick<WorkflowCourse, "courseCode">,
) => {
  const safeCode = course.courseCode
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `course-outline_${safeCode || "course"}.xlsx`;
};
