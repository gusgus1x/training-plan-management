import type { ComponentType } from "react";
import TrainingActual, { trainingActualModule } from "./TrainingActual";
import TrainingRecord, { trainingRecordModule } from "./TrainingRecord";

export type RecordModuleTopic = {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  locked?: boolean;
  Component: ComponentType;
};

export const recordItems: readonly RecordModuleTopic[] = [
  { ...trainingActualModule, icon: "👥", Component: TrainingActual },
  { ...trainingRecordModule, icon: "🏅", Component: TrainingRecord },
];
