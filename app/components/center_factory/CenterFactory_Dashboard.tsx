"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  isWorkflowOwner,
  readWorkflowCollection,
} from "../../lib/trainingWorkflow";
import DashboardLayout from "../DashboardLayout";
import {
  buildProfileItems,
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import {
  formatRollingPlanCompanies,
  getRollingPlanCompanies,
  type RollingPlan,
} from "./TrainingPlanManagement/modules/TrainingRolling";
import {
  buildCalendarYearOptions,
  getCurrentCalendarDate,
} from "../../lib/calendarDate";
import styles from "./CenterFactory_Dashboard.module.css";

const CourseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM3.82 9L12 4.54 20.18 9 12 13.46 3.82 9zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
  </svg>
);

const PlanIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z" />
  </svg>
);

const RecordIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
  </svg>
);

const ReportIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z" />
  </svg>
);

const MasterIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const calendarMonths = [
  { value: "all", label: "All year" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const legacyTrainingSchedule = [
  {
    date: "2026-07-02",
    course: "Leadership Essentials",
    shortName: "Lead",
    time: "09:00 - 16:00",
    room: "Training Room A",
    status: "Confirmed",
  },
  {
    date: "2026-07-08",
    course: "Safety & Compliance Basics",
    shortName: "Safety",
    time: "10:00 - 12:00",
    room: "Online",
    status: "Mandatory",
  },
  {
    date: "2026-07-15",
    course: "Service Mind for Frontline",
    shortName: "Service",
    time: "13:00 - 16:30",
    room: "Training Room B",
    status: "Planned",
  },
  {
    date: "2026-07-24",
    course: "Data Privacy Awareness",
    shortName: "PDPA",
    time: "09:30 - 11:30",
    room: "Meeting Room 2",
    status: "Open",
  },
  {
    date: "2026-08-21",
    course: "Quality Control Basics",
    shortName: "Quality",
    time: "09:00 - 12:00",
    room: "Training Room A",
    status: "Planned",
  },
  {
    date: "2026-09-08",
    course: "Data Privacy Refresh",
    shortName: "PDPA",
    time: "09:30 - 11:30",
    room: "Online",
    status: "Planned",
  },
  {
    date: "2027-01-14",
    course: "Annual Compliance Refresh",
    shortName: "Annual",
    time: "09:00 - 12:00",
    room: "Online",
    status: "Planned",
  },
] as const;

type DashboardTraining = {
  date: string;
  course: string;
  shortName: string;
  time: string;
  room: string;
  status: string;
  company: string;
  isCenterPlan: boolean;
};

type DashboardProps = {
  username: string;
  onHome: () => void;
  onLogout: () => void;
  onOpenTrainingPlan: () => void;
  onOpenTrainingRecord: () => void;
  onOpenTrainingCourse: () => void;
  onOpenMasterData: () => void;
  onOpenReport: () => void;
};

export default function Dashboard({
  username,
  onHome,
  onLogout,
  onOpenTrainingPlan,
  onOpenTrainingRecord,
  onOpenTrainingCourse,
  onOpenMasterData,
  onOpenReport,
}: DashboardProps) {
  const authenticatedUser = useAuthenticatedUser();
  const employeeInfo = buildProfileItems(authenticatedUser);
  const isCenterDashboard = authenticatedUser?.roleCode === "HRD_CENTER";
  const userCompanyCode = profileValue(authenticatedUser?.companyCode);
  const dashboardScope = isCenterDashboard ? "Center" : "Factory";
  const dashboardTitle = `${dashboardScope} Dashboard`;
  const [calendarToday] = useState(getCurrentCalendarDate);
  const [selectedCalendarYear, setSelectedCalendarYear] = useState(
    calendarToday.year,
  );
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(
    calendarToday.month,
  );
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("all");
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>(() =>
    readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
  );

  useEffect(() => {
    const syncRollingPlans = () => {
      setRollingPlans(
        readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
      );
    };

    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncRollingPlans);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncRollingPlans);
  }, []);

  const scopedRollingPlans = useMemo(
    () =>
      rollingPlans.filter((plan) => {
        const planCompanies = getRollingPlanCompanies(plan);
        const isCenterPlan =
          plan.ownerScope === "CENTER" ||
          plan.ownerCompany === "HRD Center" ||
          plan.provider === "HRD Center" ||
          plan.owner === "admin.hrd";

        if (isCenterDashboard) {
          if (selectedCompanyFilter === "all" || selectedCompanyFilter === "All Companies") {
            return true;
          }
          return (
            plan.company === selectedCompanyFilter ||
            planCompanies.includes(selectedCompanyFilter) ||
            plan.company === "All Companies"
          );
        }

        // Factory Scope (e.g. ATA): Sees own courses + Center-created courses
        const isOwnCompany =
          plan.company === userCompanyCode ||
          planCompanies.includes(userCompanyCode || "");

        if (isCenterPlan) {
          return (
            plan.company === "All Companies" ||
            isOwnCompany ||
            planCompanies.length === 0 ||
            planCompanies.includes(userCompanyCode || "")
          );
        }

        return isOwnCompany;
      }),
    [isCenterDashboard, rollingPlans, selectedCompanyFilter, userCompanyCode],
  );
  const trainingSchedule = useMemo<DashboardTraining[]>(
    () =>
      scopedRollingPlans.map((plan) => {
        const isCenterPlan =
          plan.ownerScope === "CENTER" ||
          plan.ownerCompany === "HRD Center" ||
          plan.provider === "HRD Center" ||
          plan.owner === "admin.hrd";

        return {
          date: plan.trainingDate,
          course: plan.course.name,
          shortName: plan.course.code,
          time: `${plan.startTime} - ${plan.endTime}`,
          room: plan.location,
          status: plan.status === "Planned" ? "Published" : "Draft",
          company: formatRollingPlanCompanies(plan),
          isCenterPlan,
        };
      }),
    [scopedRollingPlans],
  );
  const calendarYears = useMemo(
    () =>
      buildCalendarYearOptions(
        calendarToday.year,
        rollingPlans.map((plan) => plan.trainingDate),
      ),
    [calendarToday.year, rollingPlans],
  );

  const selectedMonthLabel =
    calendarMonths.find((month) => month.value === selectedCalendarMonth)?.label ??
    "Selected month";
  const isViewingCurrentMonth =
    selectedCalendarYear === calendarToday.year &&
    selectedCalendarMonth === calendarToday.month;

  const filteredTrainingSchedule = trainingSchedule.filter((item) => {
    const [year, month] = item.date.split("-");
    return (
      year === selectedCalendarYear &&
      (selectedCalendarMonth === "all" || month === selectedCalendarMonth)
    );
  });
  const employeeTrainingSummary = [
    {
      label: "This Month",
      value: String(filteredTrainingSchedule.length),
      helper: "courses",
    },
    {
      label: "Training Hours",
      value: String(
        scopedRollingPlans.reduce(
          (total, plan) => total + Number(plan.hours || 0),
          0,
        ),
      ),
      helper: "hours",
    },
    {
      label: "Published",
      value: String(
        scopedRollingPlans.filter((plan) => plan.status === "Planned").length,
      ),
      helper: "courses",
    },
  ];

  const calendarDays =
    selectedCalendarMonth === "all"
      ? []
      : (() => {
        const year = Number(selectedCalendarYear);
        const month = Number(selectedCalendarMonth);
        const firstDay = new Date(year, month - 1, 1);
        const daysInMonth = new Date(year, month, 0).getDate();
        const leadingBlankDays = (firstDay.getDay() + 6) % 7;
        const baseDays = Array.from(
          { length: leadingBlankDays + daysInMonth },
          (_, index) => {
            if (index < leadingBlankDays) {
              return { day: null, trainings: [] as DashboardTraining[] };
            }

            const day = index - leadingBlankDays + 1;
            const trainings = filteredTrainingSchedule.filter(
              (item) => Number(item.date.slice(8, 10)) === day,
            );

            return { day, trainings };
          },
        );

        return [
          ...baseDays,
          ...Array.from({ length: (7 - (baseDays.length % 7)) % 7 }, () => ({
            day: null,
            trainings: [] as DashboardTraining[],
          })),
        ];
      })();

  const menuItems = [
    {
      badge: "COURSE MANAGEMENT",
      step: "01",
      icon: "📚",
      title: "Training Course",
      description: "Manage course master, target standards, course types, and pre/post evaluation forms.",
      onClick: onOpenTrainingCourse,
    },
    {
      badge: "PLAN MANAGEMENT",
      step: "02",
      icon: "📅",
      title: "Training Plan",
      description: "Annual OAP plans, training needs, company acceptance surveys, and monthly rolling schedules.",
      onClick: onOpenTrainingPlan,
    },
    {
      badge: "RECORD MANAGEMENT",
      step: "03",
      icon: "📋",
      title: "Training Record",
      description: "Record actual attendance, post-training evaluations, expenses, and participant additions.",
      onClick: onOpenTrainingRecord,
    },
    {
      badge: "REPORT MANAGEMENT",
      step: "04",
      icon: "📊",
      title: "Reports & Analytics",
      description: "Training schedule calendars, progress summaries, expense breakdowns, and email drafts.",
      onClick: onOpenReport,
    },
    {
      badge: "MASTER DATA",
      step: "05",
      icon: "🗃️",
      title: "Master Data",
      description: "Companies, employees, instructors, levels, positions, and function master data.",
      onClick: onOpenMasterData,
    },
  ];

  return (
    <DashboardLayout
      pageClassName={styles.page}
      workspaceClassName={styles.workspace}
      workspaceLabel={`HRD ${dashboardScope} dashboard`}
      username={username}
      onHome={onHome}
      onLogout={onLogout}
    >
      <div className={styles.workspaceBadge}>{dashboardScope} Workspace</div>

      <section className={styles.heroPanel} aria-label="Dashboard overview">
        <div className={styles.heroCopy}>
          <span>HRD Training {dashboardScope}</span>
          <h1>{dashboardTitle}</h1>
          <p>
            Manage training plans, course data, records, and reports across the
            AISIN TAKAOKA Thailand group.
          </p>
        </div>
      </section>

      <div className={styles.topRow}>
        <section className={styles.employeePanel} aria-label="Employee profile">
          <div className={styles.panelHeader}>
            <div>
              <span>Current User</span>
              <h2>Profile Overview</h2>
            </div>
            <span className={styles.onlineBadge}>
              <span className={styles.onlineDot} aria-hidden="true" />
              Online
            </span>
          </div>

          <div className={styles.employeeProfileCard}>
            <div className={styles.avatarWrapper}>
              <div className={styles.photoBox} aria-hidden="true">
                {username ? username.slice(0, 2).toUpperCase() : "HC"}
              </div>
            </div>
            <div className={styles.employeeTitle}>
              <span className={styles.userRoleTag}>
                {authenticatedUser?.roleCode?.replace("_", " ") ?? "USER"}
              </span>
              <strong>{username}</strong>
              <p>
                {profileValue(authenticatedUser?.positionName)} /{" "}
                {profileValue(authenticatedUser?.functionName)}
              </p>
            </div>
          </div>

          <div className={styles.employeeDetailsGrid}>
            {employeeInfo.slice(0, 4).map((item) => (
              <div className={styles.detailCard} key={item.label}>
                <span className={styles.detailLabel}>{item.label}</span>
                <strong className={styles.detailValue}>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className={styles.employeeSummary} aria-label="Training summary">
            {employeeTrainingSummary.map((item) => (
              <article className={styles.summaryCard} key={item.label}>
                <span className={styles.summaryLabel}>{item.label}</span>
                <div className={styles.summaryValueRow}>
                  <strong className={styles.summaryValue}>{item.value}</strong>
                  <small className={styles.summaryHelper}>{item.helper}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.calendarPanel} aria-label="Training calendar">
          <div className={styles.panelHeader}>
            <div>
              <span>{selectedMonthLabel} {selectedCalendarYear}</span>
              <h2>Training Calendar</h2>
            </div>
            <div className={styles.calendarHeaderActions}>
              <b className={styles.courseCountBadge}>{filteredTrainingSchedule.length} courses</b>
            </div>
          </div>

          <div className={styles.calendarFilters}>
            <label>
              <span>Company</span>
              <select
                disabled={!isCenterDashboard}
                value={isCenterDashboard ? selectedCompanyFilter : userCompanyCode}
                onChange={(event) => setSelectedCompanyFilter(event.target.value)}
              >
                <option value="all">
                  {isCenterDashboard ? "All Companies" : `${userCompanyCode} + Center Courses`}
                </option>
                <option value="ATA">ATA</option>
                <option value="ATFB">ATFB</option>
                <option value="NIC">NIC</option>
                <option value="SATI">SATI</option>
                <option value="SNF">SNF</option>
                <option value="TEP">TEP</option>
              </select>
            </label>
            <label>
              <span>Year</span>
              <select
                value={selectedCalendarYear}
                onChange={(event) => setSelectedCalendarYear(event.target.value)}
              >
                {calendarYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Month</span>
              <select
                value={selectedCalendarMonth}
                onChange={(event) => setSelectedCalendarMonth(event.target.value)}
              >
                {calendarMonths.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </label>
          </div>

          {selectedCalendarMonth === "all" ? null : (
            <div
              className={styles.calendarGrid}
              aria-label={`Training schedule in ${selectedMonthLabel} ${selectedCalendarYear}`}
            >
              {weekDays.map((day, index) => (
                <b key={`${day}-${index}`}>{day}</b>
              ))}
              {calendarDays.map((item, index) => {
                const className = [
                  styles.calendarDay,
                  item.trainings.length > 0 ? styles.trainingDay : "",
                  isViewingCurrentMonth && item.day === calendarToday.day
                    ? styles.today
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div className={className} key={`${item.day ?? "empty"}-${index}`}>
                    {item.day ? (
                      <>
                        <span>{item.day}</span>
                        {item.trainings.map((training) => (
                          <small
                            key={`${training.date}-${training.course}-${training.time}`}
                            title={`${training.course} (${training.company})`}
                          >
                            <b style={{ color: training.isCenterPlan ? "#007a3d" : "#475569" }}>
                              [{training.company}]
                            </b>{" "}
                            {training.shortName}
                          </small>
                        ))}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {filteredTrainingSchedule.length > 0 ? (
            <div className={styles.trainingList} aria-label="Upcoming training courses">
              {filteredTrainingSchedule.map((item) => {
                const date = new Date(`${item.date}T00:00:00`);
                const dateLabel = date.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                });

                return (
                  <article className={styles.trainingItem} key={`${item.date}-${item.course}-${item.time}`}>
                    <time dateTime={item.date}>{dateLabel}</time>
                    <div>
                      <strong>{item.course}</strong>
                      <span>
                        <b style={{ color: item.isCenterPlan ? "#007a3d" : "#0f172a", fontWeight: 700 }}>
                          {item.isCenterPlan ? "HRD Center" : item.company}
                        </b>{" "}
                        ({item.company}) • {item.time} / {item.room}
                      </span>
                    </div>
                    <b>{item.status}</b>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>

      <section className={styles.menuPanel} aria-label="Main workspace menu">
        <div className={styles.menuHeader}>
          <div>
            <span>Workspace Operations</span>
            <h2>Select a Workspace Module</h2>
          </div>
          <p>{menuItems.length} Core Modules</p>
        </div>
        <div className={styles.menuRow}>
          {menuItems.map((item) => (
            <button
              className={styles.menuBox}
              key={item.title}
              type="button"
              onClick={item.onClick}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon} aria-hidden="true">
                  <span className={styles.cardEmoji}>{item.icon}</span>
                </div>
                <span className={styles.cardIndex} aria-hidden="true">
                  {item.step}
                </span>
              </div>
              <div className={styles.cardContent}>
                <small>{item.badge}</small>
                <strong>{item.title}</strong>
                <em>{item.description}</em>
              </div>
              <div className={styles.cardActionRow}>
                <b>Open Workspace</b>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
