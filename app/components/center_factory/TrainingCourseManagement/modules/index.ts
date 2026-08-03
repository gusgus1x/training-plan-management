import type { ComponentType } from "react";
import Assessment, { assessmentModule } from "./Assessment";
import CourseMasterWorkspace, {
  courseMasterWorkspaceModule,
} from "./CourseMasterWorkspace";
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
  { ...courseMasterWorkspaceModule, Component: CourseMasterWorkspace },
  { ...assessmentModule, Component: Assessment },
  { ...evaluationManagementModule, Component: EvaluationManagement },
];
