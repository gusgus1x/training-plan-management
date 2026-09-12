import React, { type ComponentType } from "react";
import { BarChart3, CalendarDays, Newspaper } from "../../../icons/LucideIcons";
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
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  titleTh?: string;
  subtitleTh?: string;
  descriptionTh?: string;
  slug: string;
  Component: ComponentType<ReportModuleProps>;
  locked?: boolean;
};

export const centerReportItems: readonly ReportModuleTopic[] = [
  { ...withSlug(summaryDashboardModule), icon: React.createElement(BarChart3, { size: 24 }), Component: SummaryDashboard },
  { ...withSlug(scheduleCalendarModule), icon: React.createElement(CalendarDays, { size: 24 }), Component: ScheduleCalendar },
  { ...withSlug(newActivitiesReportModule), icon: React.createElement(Newspaper, { size: 24 }), Component: NewActivitiesReport },
];
