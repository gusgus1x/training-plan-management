"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  readWorkflowCollection,
  type WorkflowCompletedCourse,
} from "../../lib/trainingWorkflow";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import type { EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import {
  buildProfileItems,
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import DashboardLayout from "../DashboardLayout";
import {
  moduleCards,
  type UserModule,
} from "./data";
import {
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "../center_factory/TrainingPlanManagement/modules/TrainingRolling";
import RecordModule from "./RecordModule";
import RegisterTrainingModule from "./RegisterTrainingModule";
import ReportModule from "./ReportModule";
import RequestTrainingModule from "./RequestTrainingModule";
import RoadmapModule from "./RoadmapModule";
import styles from "./UserDashboard.module.css";
import {
  buildCalendarYearOptions,
  getCurrentCalendarDate,
} from "../../lib/calendarDate";

type UserDashboardProps = {
  username: string;
  onHome: () => void;
  onLogout: () => void;
};

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

type CalendarTraining = {
  date: string;
  title: string;
  shortName: string;
  time: string;
  place: string;
  status: string;
};

const ACTIVE_ENROLLMENT_STATUSES: readonly string[] = ["Pending Approval", "Factory Approved", "Center Approved"];

export default function UserDashboard({ username, onHome, onLogout }: UserDashboardProps) {
  const authenticatedUser = useAuthenticatedUser();
  const employeeProfile = buildProfileItems(authenticatedUser);
  const [activeModule, setActiveModule] = useState<UserModule | null>(null);
  const [trainingNeed, setTrainingNeed] = useState("");
  const [reason, setReason] = useState("");
  const [calendarToday] = useState(getCurrentCalendarDate);
  const [selectedCalendarYear, setSelectedCalendarYear] = useState(
    calendarToday.year,
  );
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(
    calendarToday.month,
  );
  const [isMonthListOpen, setIsMonthListOpen] = useState(false);

  const handlePrevCalendarMonth = () => {
    if (selectedCalendarMonth === "all") {
      setSelectedCalendarMonth("12");
    } else {
      const current = Number(selectedCalendarMonth);
      if (current === 1) {
        setSelectedCalendarMonth("12");
        const yearNum = Number(selectedCalendarYear);
        setSelectedCalendarYear(String(yearNum - 1));
      } else {
        setSelectedCalendarMonth(String(current - 1).padStart(2, "0"));
      }
    }
  };

  const handleNextCalendarMonth = () => {
    if (selectedCalendarMonth === "all") {
      setSelectedCalendarMonth("01");
    } else {
      const current = Number(selectedCalendarMonth);
      if (current === 12) {
        setSelectedCalendarMonth("01");
        const yearNum = Number(selectedCalendarYear);
        setSelectedCalendarYear(String(yearNum + 1));
      } else {
        setSelectedCalendarMonth(String(current + 1).padStart(2, "0"));
      }
    }
  };
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [completedCourses, setCompletedCourses] = useState<WorkflowCompletedCourse[]>([]);
  const employeeCode = profileValue(authenticatedUser?.employeeCode);
  const employeeCompany = profileValue(authenticatedUser?.companyCode);
  const employeeId = authenticatedUser?.employeeId ?? null;

  useEffect(() => {
    void loadWorkflowRollingPlans().then(setRollingPlans);
  }, []);

  useEffect(() => {
    if (!employeeId) {
      setEnrollments([]);
      return;
    }
    void listEnrollments({ planId: null, employeeId })
      .then((result) => setEnrollments(result.enrollments || []))
      .catch((error) => {
        console.error("Failed to load my registrations", error);
        setEnrollments([]);
      });
  }, [employeeId]);

  useEffect(() => {
    const syncWorkflow = () => {
      setCompletedCourses(
        readWorkflowCollection<WorkflowCompletedCourse>(
          TRAINING_WORKFLOW_KEYS.completedCourses,
        ),
      );
    };

    syncWorkflow();
    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncWorkflow);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncWorkflow);
  }, []);

  const availableRollingPlans = useMemo(
    () =>
      rollingPlans.filter(
        (plan) =>
          plan.dbStatus === "OPEN" &&
          plan.status === "Planned" &&
          getRollingPlanCompanies(plan).includes(employeeCompany),
      ),
    [employeeCompany, rollingPlans],
  );
  const completedHours = useMemo(
    () =>
      completedCourses.reduce(
        (total, course) =>
          course.attendees.some(
            (attendee) =>
              attendee.employeeCode === employeeCode && attendee.attended,
          )
            ? total + course.hours
            : total,
        0,
      ),
    [completedCourses, employeeCode],
  );
  const employeeCalendarTrainings = useMemo<CalendarTraining[]>(
    () =>
      availableRollingPlans.map((plan) => ({
        date: plan.trainingDate,
        title: plan.course.name,
        shortName: plan.course.code,
        time: `${plan.startTime} - ${plan.endTime}`,
        place: plan.location,
        status: enrollments.some(
          (enrollment) =>
            enrollment.planId === plan.rollingId &&
            ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status),
        )
          ? "Registered"
          : "Open registration",
      })),
    [availableRollingPlans, enrollments],
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
    calendarMonths.find((month) => month.value === selectedCalendarMonth)?.label ?? "Selected month";
  const isViewingCurrentMonth =
    selectedCalendarYear === calendarToday.year &&
    selectedCalendarMonth === calendarToday.month;

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
          const leadingBlankDays = firstDay.getDay();
          const baseDays = Array.from({ length: leadingBlankDays + daysInMonth }, (_, index) => {
            if (index < leadingBlankDays) {
              return { day: null, trainings: [] as CalendarTraining[] };
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
              trainings: [] as CalendarTraining[],
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
              <h1 translate="no">My Training Dashboard</h1>
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
                  <strong>{availableRollingPlans.length}</strong>
                </article>
                <article>
                  <span>Completed Hours</span>
                  <strong>{completedHours}</strong>
                </article>
                <article>
                  <span>Pending Requests</span>
                  <strong>0</strong>
                </article>
              </div>
            </section>

            <section className={styles.calendarPanel} aria-label="Employee training calendar">
              <div className={styles.panelHeader}>
                <div>
                  <p>Training Schedule</p>
                  <h2 translate="no">Training Calendar</h2>
                  <span className={styles.monthMetaBadge}>
                    {selectedMonthLabel} {selectedCalendarYear} • {filteredCalendarTrainings.length} courses
                  </span>
                </div>
                <button
                  className={styles.calendarToggleButton}
                  type="button"
                  onClick={() => setIsMonthListOpen((current) => !current)}
                >
                  {isMonthListOpen ? "Hide list" : "Show list"}
                </button>
              </div>

              <div className={styles.calendarFilters}>
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
                <div className={styles.calendarGrid} aria-label={`Training calendar in ${selectedMonthLabel} ${selectedCalendarYear}`}>
                  {weekDays.map((day, idx) => (
                    <b key={day} className={idx === 0 ? styles.sunHeader : idx === 6 ? styles.satHeader : undefined}>
                      {day}
                    </b>
                  ))}
                  {calendarDays.map((item, index) => {
                    const isWeekend = index % 7 === 0 || index % 7 === 6;
                    const isToday = isViewingCurrentMonth && item.day === calendarToday.day;
                    const hasTrainings = item.trainings.length > 0;

                    return (
                      <div
                        className={`${styles.calendarDay} ${hasTrainings ? styles.trainingDay : ""} ${isToday ? styles.today : ""} ${isWeekend ? styles.weekendDay : ""}`}
                        key={`${item.day ?? "empty"}-${index}`}
                      >
                        {item.day ? (
                          <>
                            <div className={styles.dayCellHeader}>
                              <span className={styles.dayNum}>{item.day}</span>
                              {isToday && <small className={styles.todayPill}>TODAY</small>}
                            </div>
                            {item.trainings.map((training) => (
                              <small key={training.title} className={styles.trainingPill} title={training.title}>
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

              {isMonthListOpen ? (
                <div className={styles.calendarTrainingList}>
                  {filteredCalendarTrainings.map((training) => {
                    const date = new Date(`${training.date}T00:00:00`);
                    const dayNum = date.getDate();
                    const monthName = date.toLocaleDateString("en-US", { month: "short" });

                    return (
                      <article key={training.title} className={styles.calendarListCard}>
                        <div className={styles.listDateBox}>
                          <strong>{dayNum}</strong>
                          <span>{monthName}</span>
                        </div>
                        <div className={styles.listCardContent}>
                          <strong>{training.title}</strong>
                          <span>🕐 {training.time} • 📍 {training.place}</span>
                        </div>
                        <span className={styles.listStatusBadge}>{training.status}</span>
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
                <h2 translate="no">Select a workspace</h2>
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
                    <strong translate="no">{module.title}</strong>
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
