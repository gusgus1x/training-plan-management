import type { ComponentType } from "react";
import { withSlug } from "../../../../lib/slug";
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
  slug: string;
  Component: ComponentType<{ onOpenTrainingOap?: () => void; username?: string }>;
};

export const planItems: readonly PlanModuleTopic[] = [
  { ...withSlug(trainingOapModule), icon: "🗓️", Component: TrainingOAP },
  { ...withSlug(trainingRollingModule), icon: "📆", Component: TrainingRolling },
  { ...withSlug(requestTrainingNeedModule), icon: "🔒", locked: true, Component: RequestTrainingNeed },
  { ...withSlug(trainingAcceptSurveyModule), icon: "☑️", Component: TrainingAcceptSurvey },
];
