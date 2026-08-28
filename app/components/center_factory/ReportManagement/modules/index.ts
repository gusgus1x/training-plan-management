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
  { ...withSlug(summaryDashboardModule), icon: "📊", Component: SummaryDashboard },
  { ...withSlug(scheduleCalendarModule), icon: "📅", Component: ScheduleCalendar },
  // Locked until it has a backend: sending a report only adds it to local component state, and
  // announcement and notification are both empty, so a sent report reaches nobody.
  { ...withSlug(internalReportModule), icon: "✉️", Component: InternalReport, locked: true },
];
