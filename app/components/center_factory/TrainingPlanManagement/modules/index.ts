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
  title: string;
  subtitle: string;
  description: string;
  Component: ComponentType<{ username?: string }>;
};

export const planItems: readonly PlanModuleTopic[] = [
  { ...trainingOapModule, Component: TrainingOAP },
  { ...trainingRollingModule, Component: TrainingRolling },
  { ...requestTrainingNeedModule, Component: RequestTrainingNeed },
  { ...trainingAcceptSurveyModule, Component: TrainingAcceptSurvey },
];
