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
  initialYear?: string;
  initialMonth?: string;
};

export type ReportModuleTopic = {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  Component: ComponentType<ReportModuleProps>;
  locked?: boolean;
};

export const centerReportItems: readonly ReportModuleTopic[] = [
  { ...summaryDashboardModule, icon: "📊", Component: SummaryDashboard },
  { ...scheduleCalendarModule, icon: "📅", Component: ScheduleCalendar },
  { ...internalReportModule, icon: "✉️", Component: InternalReport, locked: true },
];
