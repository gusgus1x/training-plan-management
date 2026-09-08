import type { ComponentType } from "react";
import { withSlug } from "../../../../lib/slug";
import ScheduleCalendar, { scheduleCalendarModule } from "./ScheduleCalendar";
import SummaryDashboard, {
  summaryDashboardModule,
} from "./SummaryDashboard";
import NewActivitiesReport, {
  newActivitiesReportModule,
} from "./NewActivitiesReport";

export { newActivitiesReportModule };

export type ReportModuleProps = {
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
  { ...withSlug(newActivitiesReportModule), icon: "📰", Component: NewActivitiesReport },
];
