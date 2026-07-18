import type { ComponentType } from "react";
import TrainingActual, { trainingActualModule } from "./TrainingActual";
import TrainingRecord, { trainingRecordModule } from "./TrainingRecord";

export type RecordModuleTopic = {
  title: string;
  subtitle: string;
  description: string;
  Component: ComponentType;
};

export const recordItems: readonly RecordModuleTopic[] = [
  { ...trainingActualModule, Component: TrainingActual },
  { ...trainingRecordModule, Component: TrainingRecord },
];
