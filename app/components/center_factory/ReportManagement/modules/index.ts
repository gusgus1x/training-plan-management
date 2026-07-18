import type { ComponentType } from "react";
import InternalReport, {
  internalReportModule,
  internalReportTitle,
} from "./InternalReport";
import ScheduleCalendar, { scheduleCalendarModule } from "./ScheduleCalendar";

export { internalReportTitle };

export type ReportModuleTopic = {
  title: string;
  subtitle: string;
  description: string;
  Component: ComponentType;
};

export const centerReportItems: readonly ReportModuleTopic[] = [
  { ...scheduleCalendarModule, Component: ScheduleCalendar },
  { ...internalReportModule, Component: InternalReport },
];
