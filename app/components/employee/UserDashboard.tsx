"use client";

import { useMemo, useState } from "react";
import {
  buildProfileItems,
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import DashboardLayout from "../DashboardLayout";
import {
  availableCourses,
  employeeCalendarTrainings,
  history,
  moduleCards,
  type UserModule,
} from "./data";
import RecordModule from "./RecordModule";
import RegisterTrainingModule from "./RegisterTrainingModule";
import ReportModule from "./ReportModule";
import RequestTrainingModule from "./RequestTrainingModule";
import RoadmapModule from "./RoadmapModule";
import styles from "./UserDashboard.module.css";

type UserDashboardProps = {
  username: string;
  onHome: () => void;
  onLogout: () => void;
};

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

export default function UserDashboard({ username, onHome, onLogout }: UserDashboardProps) {
  const authenticatedUser = useAuthenticatedUser();
  const employeeProfile = buildProfileItems(authenticatedUser);
  const [activeModule, setActiveModule] = useState<UserModule | null>(null);
  const [trainingNeed, setTrainingNeed] = useState("Advanced Quality Control");
  const [reason, setReason] = useState(
    "Need to improve quality inspection skills for production line work.",
  );
  const [selectedCalendarYear, setSelectedCalendarYear] =
    useState<(typeof calendarYears)[number]>("2026");
  const [selectedCalendarMonth, setSelectedCalendarMonth] =
    useState<(typeof calendarMonths)[number]["value"]>("07");
  const [isMonthListOpen, setIsMonthListOpen] = useState(false);

  const completedHours = useMemo(
    () => history.reduce((total, item) => total + Number(item.hours), 0),
    [],
  );

  const selectedMonthLabel =
    calendarMonths.find((month) => month.value === selectedCalendarMonth)?.label ?? "July";

  const filteredCalendarTrainings = employeeCalendarTrainings.filter((training) => {
    const [year, month] = training.date.split("-");
    return year === selectedCalendarYear && (selectedCalendarMonth === "all" || month === selectedCalendarMonth);
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
          const baseDays = Array.from({ length: leadingBlankDays + daysInMonth }, (_, index) => {
            if (index < leadingBlankDays) {
              return { day: null, trainings: [] as typeof employeeCalendarTrainings[number][] };
            }

            const day = index - leadingBlankDays + 1;
            const trainings = filteredCalendarTrainings.filter(
              (training) => Number(training.date.slice(8, 10)) === day,
            );

            return { day, trainings };
          });

          return [
            ...baseDays,
            ...Array.from({ length: (7 - (baseDays.length % 7)) % 7 }, () => ({
              day: null,
              trainings: [] as typeof employeeCalendarTrainings[number][],
            })),
          ];
        })();

  const handleHome = () => {
    if (activeModule) {
      setActiveModule(null);
      return;
    }

    onHome();
  };

  const activeModuleTitle =
    moduleCards.find((module) => module.key === activeModule)?.title ?? "Dashboard";

  const contextItems = [
    ...moduleCards.map((module) => ({
      title: module.title,
      active: activeModule === module.key,
      onClick: () => setActiveModule(module.key),
    })),
  ];

  return (
    <DashboardLayout
      pageClassName={styles.page}
      workspaceClassName={styles.workspace}
      workspaceLabel="User dashboard"
      username={username}
      userLevel="User"
      contextTitle={activeModule ? activeModuleTitle : undefined}
      contextItems={activeModule ? contextItems : undefined}
      onBack={activeModule ? () => setActiveModule(null) : undefined}
      onHome={handleHome}
      onLogout={onLogout}
    >
      {activeModule ? (
        <>
          {activeModule === "register" ? (
            <RegisterTrainingModule />
          ) : null}
          {activeModule === "roadmap" ? (
            <RoadmapModule />
          ) : null}
          {activeModule === "request" ? (
            <RequestTrainingModule
              reason={reason}
              setReason={setReason}
              setTrainingNeed={setTrainingNeed}
              trainingNeed={trainingNeed}
            />
          ) : null}
          {activeModule === "record" ? (
            <RecordModule />
          ) : null}
          {activeModule === "report" ? (
            <ReportModule completedHours={completedHours} />
          ) : null}
        </>
      ) : (
        <>
          <div className={styles.workspaceBadge}>Employee Workspace</div>

          <section className={styles.heroPanel} aria-label="Employee dashboard overview">
            <div className={styles.heroCopy}>
              <span>Employee Training</span>
              <h1>My Training Dashboard</h1>
              <p>
                Review your training calendar, register courses, request training needs,
                and follow your training records.
              </p>
            </div>
          </section>

          <div className={styles.topRow}>
            <section className={styles.employeePanel} aria-label="My employee information">
              <div className={styles.employeeProfile}>
                <div className={styles.avatar} aria-hidden="true">
                  EU
                </div>
                <div className={styles.profileCopy}>
                  <span>Employee Profile</span>
                  <h1>{username}</h1>
                  <p>{profileValue(authenticatedUser?.positionName)} / {profileValue(authenticatedUser?.functionName)}</p>
                </div>
                <b className={styles.employeeStatus}>Online</b>
              </div>

              <div className={styles.employeeProfileGrid}>
                {employeeProfile.slice(0, 4).map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>

              <div className={styles.profileStats}>
                <article>
                  <span>Available Courses</span>
                  <strong>{availableCourses.length}</strong>
                </article>
                <article>
                  <span>Completed Hours</span>
                  <strong>{completedHours}</strong>
                </article>
                <article>
                  <span>Pending Requests</span>
                  <strong>2</strong>
                </article>
              </div>
            </section>

            <section className={styles.calendarPanel} aria-label="Employee training calendar">
              <div className={styles.panelHeader}>
                <div>
                  <p>Training Schedule</p>
                  <h2>Training Calendar</h2>
                  <span>{selectedMonthLabel} {selectedCalendarYear} / {filteredCalendarTrainings.length} courses</span>
                </div>
                <button
                  className={styles.calendarToggleButton}
                  type="button"
                  onClick={() => setIsMonthListOpen((current) => !current)}
                >
                  {isMonthListOpen ? "Hide month list" : "Show month list"}
                </button>
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
                <div className={styles.calendarGrid} aria-label={`Training calendar in ${selectedMonthLabel} ${selectedCalendarYear}`}>
                  {weekDays.map((day) => (
                    <b key={day}>{day}</b>
                  ))}
                  {calendarDays.map((item, index) => (
                    <div
                      className={`${styles.calendarDay} ${item.trainings.length > 0 ? styles.trainingDay : ""}`}
                      key={`${item.day ?? "empty"}-${index}`}
                    >
                      {item.day ? (
                        <>
                          <span>{item.day}</span>
                          {item.trainings.map((training) => (
                            <small key={training.title}>{training.shortName}</small>
                          ))}
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {isMonthListOpen ? (
                <div className={styles.calendarTrainingList}>
                  {filteredCalendarTrainings.map((training) => {
                    const date = new Date(`${training.date}T00:00:00`);
                    const dateLabel = date.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    });

                    return (
                      <article key={training.title}>
                        <time dateTime={training.date}>{dateLabel}</time>
                        <div>
                          <strong>{training.title}</strong>
                          <span>{training.time} / {training.place}</span>
                        </div>
                        <b>{training.status}</b>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </div>

          <section className={styles.modulePanel} aria-label="User modules">
            <div className={styles.panelHeader}>
              <div>
                <p>User Operation</p>
                <h2>Select a workspace</h2>
              </div>
              <span>{moduleCards.length} modules</span>
            </div>

            <div className={styles.moduleGrid}>
              {moduleCards.map((module, index) => (
                <button
                  className={styles.moduleCard}
                  key={module.key}
                  type="button"
                  onClick={() => setActiveModule(module.key)}
                >
                  <small>{String(index + 1).padStart(2, "0")}</small>
                  <div>
                    <em>{module.eyebrow}</em>
                    <strong>{module.title}</strong>
                    <span>{module.detail}</span>
                  </div>
                  <b>Open</b>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
