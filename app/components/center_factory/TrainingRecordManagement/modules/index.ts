import React, { type ComponentType, type ReactNode } from "react";
import { withSlug } from "../../../../lib/slug";
import TrainingActual, { trainingActualModule } from "./TrainingActual";
import TrainingRecord, { trainingRecordModule } from "./TrainingRecord";
import { Users, Award } from "../../../icons/LucideIcons";

export type RecordModuleTopic = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  description: string;
  locked?: boolean;
  slug: string;
  Component: ComponentType;
};

export const recordItems: readonly RecordModuleTopic[] = [
  { ...withSlug(trainingActualModule), icon: React.createElement(Users, { size: 28 }), Component: TrainingActual },
  { ...withSlug(trainingRecordModule), icon: React.createElement(Award, { size: 28 }), Component: TrainingRecord },
];
