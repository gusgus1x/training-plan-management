import type { ComponentType } from "react";
import { withSlug } from "../../../../lib/slug";
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
  slug: string;
  Component: ComponentType<ReportModuleProps>;
  locked?: boolean;
};

export const centerReportItems: readonly ReportModuleTopic[] = [
  { ...withSlug(summaryDashboardModule), icon: "📊", Component: SummaryDashboard, locked: true },
  { ...withSlug(scheduleCalendarModule), icon: "📅", Component: ScheduleCalendar, locked: true },
  { ...withSlug(internalReportModule), icon: "✉️", Component: InternalReport, locked: true },
];
