import type { ComponentType } from "react";
import Assessment, { assessmentModule } from "./Assessment";
import CourseMasterWorkspace, {
  courseMasterWorkspaceModule,
} from "./CourseMasterWorkspace";
import EvaluationManagement, {
  evaluationManagementModule,
} from "./EvaluationManagement";

export type CourseModuleTopic = {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  locked?: boolean;
  Component: ComponentType;
};

export const centerCourseItems: readonly CourseModuleTopic[] = [
  { ...courseMasterWorkspaceModule, icon: "📘", Component: CourseMasterWorkspace },
  { ...assessmentModule, icon: "📝", Component: Assessment },
  { ...evaluationManagementModule, icon: "⭐", Component: EvaluationManagement },
];
