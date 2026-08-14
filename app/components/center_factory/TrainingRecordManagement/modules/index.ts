import type { ComponentType } from "react";
import { withSlug } from "../../../../lib/slug";
import TrainingActual, { trainingActualModule } from "./TrainingActual";
import TrainingRecord, { trainingRecordModule } from "./TrainingRecord";

export type RecordModuleTopic = {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  locked?: boolean;
  slug: string;
  Component: ComponentType;
};

export const recordItems: readonly RecordModuleTopic[] = [
  { ...withSlug(trainingActualModule), icon: "👥", Component: TrainingActual },
  { ...withSlug(trainingRecordModule), icon: "🏅", Component: TrainingRecord },
];
