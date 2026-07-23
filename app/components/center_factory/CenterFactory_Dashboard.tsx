"use client";

import { useState } from "react";
import DashboardLayout from "../DashboardLayout";
import {
  buildProfileItems,
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import styles from "./CenterFactory_Dashboard.module.css";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const calendarYears = ["2026", "2027"] as const;
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

const trainingSchedule = [
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

const employeeTrainingSummary = [
  { label: "This Month", value: "4", helper: "courses" },
  { label: "Training Hours", value: "22", helper: "hours" },
  { label: "Readiness", value: "Active", helper: "available" },
] as const;

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
  const dashboardScope = isCenterDashboard ? "Center" : "Factory";
  const dashboardTitle = `${dashboardScope} Dashboard`;
  const [selectedCalendarYear, setSelectedCalendarYear] =
    useState<(typeof calendarYears)[number]>("2026");
  const [selectedCalendarMonth, setSelectedCalendarMonth] =
    useState<(typeof calendarMonths)[number]["value"]>("07");
  const [isMonthListOpen, setIsMonthListOpen] = useState(false);

  const selectedMonthLabel =
    calendarMonths.find((month) => month.value === selectedCalendarMonth)?.label ??
    "July";

  const filteredTrainingSchedule = trainingSchedule.filter((item) => {
    const [year, month] = item.date.split("-");
    return (
      year === selectedCalendarYear &&
      (selectedCalendarMonth === "all" || month === selectedCalendarMonth)
    );
  });

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
                return { day: null, trainings: [] as typeof trainingSchedule[number][] };
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
              trainings: [] as typeof trainingSchedule[number][],
            })),
          ];
        })();

  const menuItems = [
    {
      badge: "PLAN",
      title: "Training Plan",
      description: "Annual plans, training needs, acceptance surveys, OAP, and rolling plans.",
      onClick: onOpenTrainingPlan,
    },
    {
      badge: "RECORD",
      title: "Training Record",
      description: "Actual training results, attendance records, and employee history.",
      onClick: onOpenTrainingRecord,
    },
    {
      badge: "COURSE",
      title: "Training Course",
      description: "Course type, course group, master courses, standards, and assessments.",
      onClick: onOpenTrainingCourse,
    },
    {
      badge: "MASTER",
      title: "Master Data",
      description: "Companies, employees, instructors, levels, positions, and functions.",
      onClick: onOpenMasterData,
    },
    {
      badge: "REPORT",
      title: "Reports",
      description: "Training schedules, result reports, expenses, and internal reports.",
      onClick: onOpenReport,
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
              <h2>Profile</h2>
            </div>
            <b>Online</b>
          </div>

          <div className={styles.employeeProfile}>
            <div className={styles.photoBox} aria-hidden="true">HC</div>
            <div className={styles.employeeTitle}>
              <strong>{username}</strong>
              <p>
                {profileValue(authenticatedUser?.positionName)} /{" "}
                {profileValue(authenticatedUser?.functionName)}
              </p>
            </div>
          </div>

          <div className={styles.employeeDetails}>
            {employeeInfo.slice(0, 4).map((item) => (
              <p key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </p>
            ))}
          </div>

          <div className={styles.employeeSummary} aria-label="Training summary">
            {employeeTrainingSummary.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.helper}</small>
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
              <b>{filteredTrainingSchedule.length} courses</b>
              <button
                type="button"
                onClick={() => setIsMonthListOpen((current) => !current)}
              >
                {isMonthListOpen ? "Hide month list" : "Show month list"}
              </button>
            </div>
          </div>

          <div className={styles.calendarFilters}>
            <label>
              <span>Year</span>
              <select
                value={selectedCalendarYear}
                onChange={(event) =>
                  setSelectedCalendarYear(event.target.value as (typeof calendarYears)[number])
                }
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
                onChange={(event) =>
                  setSelectedCalendarMonth(event.target.value as (typeof calendarMonths)[number]["value"])
                }
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
                  item.day === 9 ? styles.today : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div className={className} key={`${item.day ?? "empty"}-${index}`}>
                    {item.day ? (
                      <>
                        <span>{item.day}</span>
                        {item.trainings.map((training) => (
                          <small key={training.course}>{training.shortName}</small>
                        ))}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {isMonthListOpen ? (
            <div className={styles.trainingList} aria-label="Upcoming training courses">
              {filteredTrainingSchedule.map((item) => {
                const date = new Date(`${item.date}T00:00:00`);
                const dateLabel = date.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                });

                return (
                  <article className={styles.trainingItem} key={item.course}>
                    <time dateTime={item.date}>{dateLabel}</time>
                    <div>
                      <strong>{item.course}</strong>
                      <span>{item.time} / {item.room}</span>
                    </div>
                    <b>{item.status}</b>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>

      <section className={styles.menuPanel} aria-label="Main menu">
        <div className={styles.menuHeader}>
          <div>
            <span>Workspace Operation</span>
            <h2>Select a workspace</h2>
          </div>
          <p>{menuItems.length} modules</p>
        </div>
        <div className={styles.menuRow}>
          {menuItems.map((item, index) => (
            <button
              className={styles.menuBox}
              key={item.title}
              type="button"
              onClick={item.onClick}
            >
              <span className={styles.cardIndex}>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{item.badge}</small>
                <strong>{item.title}</strong>
                <em>{item.description}</em>
              </div>
              <b>Open</b>
            </button>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
