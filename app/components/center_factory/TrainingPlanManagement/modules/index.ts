import type { ComponentType, ReactNode } from "react";
import React from "react";
import { withSlug } from "../../../../lib/slug";
import RequestTrainingNeed, {
  requestTrainingNeedModule,
} from "./RequestTrainingNeed";
import TrainingAcceptSurvey, {
  trainingAcceptSurveyModule,
} from "./TrainingAcceptSurvey";
import TrainingOAP, { trainingOapModule } from "./TrainingOAP";
import TrainingRolling, { trainingRollingModule } from "./TrainingRolling";
import { CalendarDays, Clock, FileEdit, CheckSquare } from "../../../icons/LucideIcons";

export type PlanModuleTopic = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  description: string;
  locked?: boolean;
  slug: string;
  Component: ComponentType<{ onOpenTrainingOap?: () => void; username?: string; initialCourseId?: string }>;
};

export const planItems: readonly PlanModuleTopic[] = [
  { ...withSlug(trainingOapModule), icon: React.createElement(CalendarDays, { size: 28 }), Component: TrainingOAP },
  { ...withSlug(trainingRollingModule), icon: React.createElement(Clock, { size: 28 }), Component: TrainingRolling },
  { ...withSlug(requestTrainingNeedModule), icon: React.createElement(FileEdit, { size: 28 }), Component: RequestTrainingNeed },
  { ...withSlug(trainingAcceptSurveyModule), icon: React.createElement(CheckSquare, { size: 28 }), Component: TrainingAcceptSurvey },
];
