import type { ComponentType } from "react";
import { withSlug } from "../../../../lib/slug";
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
  slug: string;
  Component: ComponentType;
};

export const centerCourseItems: readonly CourseModuleTopic[] = [
  { ...withSlug(courseMasterWorkspaceModule), icon: "📘", Component: CourseMasterWorkspace },
  { ...withSlug(assessmentModule), icon: "📝", Component: Assessment },
  { ...withSlug(evaluationManagementModule), icon: "⭐", Component: EvaluationManagement },
];
