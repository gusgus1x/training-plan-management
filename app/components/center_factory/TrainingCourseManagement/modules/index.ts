import React, { type ComponentType } from "react";
import { BookOpen, FileEdit, Star } from "../../../icons/LucideIcons";
import { withSlug } from "../../../../lib/slug";
import Assessment, { assessmentModule } from "./Assessment";
import CourseMasterWorkspace, {
  courseMasterWorkspaceModule,
} from "./CourseMasterWorkspace";
import EvaluationManagement, {
  evaluationManagementModule,
} from "./EvaluationManagement";

export type CourseModuleTopic = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  locked?: boolean;
  slug: string;
  Component: ComponentType;
};

export const centerCourseItems: readonly CourseModuleTopic[] = [
  { ...withSlug(courseMasterWorkspaceModule), icon: React.createElement(BookOpen, { size: 24 }), Component: CourseMasterWorkspace },
  { ...withSlug(assessmentModule), icon: React.createElement(FileEdit, { size: 24 }), Component: Assessment },
  { ...withSlug(evaluationManagementModule), icon: React.createElement(Star, { size: 24 }), Component: EvaluationManagement },
];
