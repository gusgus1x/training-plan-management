import type { ComponentType } from "react";
import Assessment, { assessmentModule } from "./Assessment";
import CourseGroup, { courseGroupModule } from "./CourseGroup";
import CourseMaster, { courseMasterModule } from "./CourseMaster";
import CourseStandard, { courseStandardModule } from "./CourseStandard";
import CourseType, { courseTypeModule } from "./CourseType";
import EvaluationManagement, {
  evaluationManagementModule,
} from "./EvaluationManagement";

export type CourseModuleTopic = {
  title: string;
  subtitle: string;
  description: string;
  Component: ComponentType;
};

export const centerCourseItems: readonly CourseModuleTopic[] = [
  { ...courseTypeModule, Component: CourseType },
  { ...courseGroupModule, Component: CourseGroup },
  { ...courseMasterModule, Component: CourseMaster },
  { ...courseStandardModule, Component: CourseStandard },
  { ...assessmentModule, Component: Assessment },
  { ...evaluationManagementModule, Component: EvaluationManagement },
];
