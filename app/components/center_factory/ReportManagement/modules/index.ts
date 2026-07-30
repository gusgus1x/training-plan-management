import type { ComponentType } from "react";
import InternalReport, {
  type InternalReportDraft,
  internalReportModule,
  internalReportTitle,
} from "./InternalReport";
import ScheduleCalendar, { scheduleCalendarModule } from "./ScheduleCalendar";
import SummaryDashboard, {
  summaryDashboardModule,
} from "./SummaryDashboard";

export { internalReportTitle };
export type { InternalReportDraft };

export type ReportModuleProps = {
  onPrepareEmail?: (draft: InternalReportDraft) => void;
  preparedDraft?: InternalReportDraft | null;
};

export type ReportModuleTopic = {
  title: string;
  subtitle: string;
  description: string;
  Component: ComponentType<ReportModuleProps>;
  locked?: boolean;
};

export const centerReportItems: readonly ReportModuleTopic[] = [
  { ...summaryDashboardModule, Component: SummaryDashboard },
  { ...scheduleCalendarModule, Component: ScheduleCalendar },
  { ...internalReportModule, Component: InternalReport, locked: true },
];
