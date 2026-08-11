import type { ComponentType } from "react";
import RequestTrainingNeed, {
  requestTrainingNeedModule,
} from "./RequestTrainingNeed";
import TrainingAcceptSurvey, {
  trainingAcceptSurveyModule,
} from "./TrainingAcceptSurvey";
import TrainingOAP, { trainingOapModule } from "./TrainingOAP";
import TrainingRolling, { trainingRollingModule } from "./TrainingRolling";

export type PlanModuleTopic = {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  locked?: boolean;
  Component: ComponentType<{ onOpenTrainingOap?: () => void; username?: string }>;
};

export const planItems: readonly PlanModuleTopic[] = [
  { ...trainingOapModule, icon: "🗓️", Component: TrainingOAP },
  { ...trainingRollingModule, icon: "📆", Component: TrainingRolling },
  { ...requestTrainingNeedModule, icon: "🔒", locked: true, Component: RequestTrainingNeed },
  { ...trainingAcceptSurveyModule, icon: "☑️", Component: TrainingAcceptSurvey },
];
