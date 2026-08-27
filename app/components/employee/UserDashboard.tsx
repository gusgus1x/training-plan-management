"use client";

import { useEffect, useMemo, useState } from "react";
import dash from "../shared/DashboardShell.module.css";
import { useUiLanguage, type UiLanguage } from "../ThaiUiLocalization";
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
import TypewriterLoader from "../TypewriterLoader";

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
const APPROVED_ENROLLMENT_STATUSES: readonly string[] = ["Factory Approved", "Center Approved"];

export const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "EU";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

/** Whole days from today to the training, floored, so "today" reads as 0 rather than -1. */
export const daysUntil = (isoDate: string) => {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);
};

export const countdownLabel = (days: number, language: UiLanguage) => {
  const isThai = language === "th";
  if (days < 0) return isThai ? "กำลังดำเนินการ" : "In progress";
  if (days === 0) return isThai ? "วันนี้" : "Today";
  if (days === 1) return isThai ? "พรุ่งนี้" : "Tomorrow";
  return isThai ? `อีก ${days} วัน` : `in ${days} days`;
};

export default function UserDashboard({ username, onHome, onLogout }: UserDashboardProps) {
  const authenticatedUser = useAuthenticatedUser();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  // One language at a time. A "ไทย / English" label shows both to a reader who asked for one.
  const t = (th: string, en: string) => (isThai ? th : en);
  // Thai keeps the Gregorian calendar here: the plan dates are stored as Gregorian and the HRD
  // screens show them that way, so switching to the Buddhist era would put the two sides two
  // years apart on the same training.
  const locale = isThai ? "th-TH-u-ca-gregory" : "en-GB";
  const weekDayNames = isThai ? ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] : weekDays;
  const monthLabel = (value: string, fallback: string) =>
    value === "all"
      ? t("ทั้งปี", "All year")
      : new Date(2020, Number(value) - 1, 1).toLocaleDateString(locale, { month: "long" }) ||
        fallback;
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
  const [isLoading, setIsLoading] = useState(true);
  const employeeCompany = profileValue(authenticatedUser?.companyCode);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    // No employee filter is sent: the server scopes an EMPLOYEE caller to themselves. Guarding on
    // employeeId here used to blank the page for an account that carries only the durable key.
    const fetchEnrollments = listEnrollments({
      planId: null,
      employeeId: null,
      employeeUserId: null,
    }).catch(() => ({ enrollments: [] }));

    void Promise.all([
      loadWorkflowRollingPlans().catch(() => []),
      fetchEnrollments,
    ]).then(([plans, enrollResult]) => {
      if (!active) return;
      setRollingPlans(plans);
      setEnrollments(enrollResult.enrollments || []);
    }).finally(() => {
      if (active) setIsLoading(false);
    });

    return () => { active = false; };
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
  // Attended enrollments are the completed record. Same rule as RecordModule, same source, so the
  // hours on the dashboard and the rows on the record page can no longer disagree.
  const completedEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.attendance?.status === "PRESENT"),
    [enrollments],
  );
  const completedHours = useMemo(
    () => completedEnrollments.reduce((total, enrollment) => total + enrollment.plan.hours, 0),
    [completedEnrollments],
  );
  const enrolledPlanIds = useMemo(
    () =>
      new Set(
        enrollments
          .filter((enrollment) => ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status))
          .map((enrollment) => enrollment.planId),
      ),
    [enrollments],
  );
  // What the employee can still act on: a course open to their company that they are not already
  // registered for. Counting every open plan would keep nagging about ones they have joined.
  const openToRegister = useMemo(
    () => availableRollingPlans.filter((plan) => !enrolledPlanIds.has(plan.rollingId)),
    [availableRollingPlans, enrolledPlanIds],
  );
  const awaitingApproval = useMemo(
    () => enrollments.filter((enrollment) => enrollment.status === "Pending Approval"),
    [enrollments],
  );
  // The soonest approved training that has not finished yet. Sorted rather than reduced so a tie
  // resolves the same way every render.
  const nextTraining = useMemo(() => {
    const now = Date.now();
    return enrollments
      .filter(
        (enrollment) =>
          APPROVED_ENROLLMENT_STATUSES.includes(enrollment.status) &&
          Date.parse(enrollment.plan.endAt) >= now,
      )
      .sort((left, right) => left.plan.startAt.localeCompare(right.plan.startAt))[0];
  }, [enrollments]);
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

  const selectedMonthLabel = monthLabel(
    selectedCalendarMonth,
    t("เดือนที่เลือก", "Selected month"),
  );
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
      {isLoading ? (
        <TypewriterLoader label="กำลังโหลดข้อมูลแดชบอร์ด..." />
      ) : activeModule ? (
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
            <ReportModule
              completedHours={completedHours}
              completedCount={completedEnrollments.length}
            />
          ) : null}
        </>
      ) : (
        <>
          <div className={styles.workspaceBadge}>{t("พื้นที่ทำงานพนักงาน", "Employee Workspace")}</div>

          <section className={styles.heroPanel} aria-label="Employee dashboard overview">
            <div className={styles.heroCopy}>
              <span>{t("การฝึกอบรมพนักงาน", "Employee Training")}</span>
              <h1 translate="no">{t("แดชบอร์ดการอบรมของฉัน", "My Training Dashboard")}</h1>
              <p>
                {t(
                  "ตรวจสอบปฏิทินอบรม ลงทะเบียนหลักสูตร ส่งคำขอฝึกอบรม และติดตามประวัติการอบรมของคุณ",
                  "Review your training calendar, register courses, request training needs, and follow your training records.",
                )}
              </p>
            </div>
          </section>

          <div className={dash.actionStrip} aria-label="What needs your attention">
            <button
              className={`${dash.actionCard} ${openToRegister.length === 0 ? dash.quiet : ""}`}
              type="button"
              disabled={openToRegister.length === 0}
              onClick={() => setActiveModule("register")}
            >
              <span className={dash.actionCount}>{openToRegister.length}</span>
              <span className={dash.actionCopy}>
                <strong>{isThai ? "หลักสูตรที่สมัครได้" : "Open to register"}</strong>
                <span>
                  {openToRegister.length === 0
                    ? (isThai ? "ยังไม่มีหลักสูตรใหม่" : "Nothing new right now")
                    : (isThai ? "กดเพื่อเลือกหลักสูตร" : "Tap to choose a course")}
                </span>
              </span>
            </button>

            <button
              className={`${dash.actionCard} ${awaitingApproval.length === 0 ? dash.quiet : ""}`}
              type="button"
              disabled={awaitingApproval.length === 0}
              onClick={() => setActiveModule("register")}
            >
              <span className={dash.actionCount}>{awaitingApproval.length}</span>
              <span className={dash.actionCopy}>
                <strong>{isThai ? "รออนุมัติ" : "Awaiting approval"}</strong>
                <span>
                  {awaitingApproval.length === 0
                    ? (isThai ? "ไม่มีคำขอค้าง" : "No request pending")
                    : (isThai ? "HRD กำลังพิจารณา" : "With HRD for review")}
                </span>
              </span>
            </button>

            <button
              className={`${dash.actionCard} ${completedEnrollments.length === 0 ? dash.quiet : ""}`}
              type="button"
              disabled={completedEnrollments.length === 0}
              onClick={() => setActiveModule("record")}
            >
              <span className={dash.actionCount}>{completedEnrollments.length}</span>
              <span className={dash.actionCopy}>
                <strong>{isThai ? "อบรมสำเร็จแล้ว" : "Completed"}</strong>
                <span>
                  {completedEnrollments.length === 0
                    ? (isThai ? "ยังไม่มีประวัติ" : "No record yet")
                    : (isThai ? `สะสม ${completedHours} ชั่วโมง` : `${completedHours} hours`)}
                </span>
              </span>
            </button>
          </div>

          <div className={styles.topRow}>
            <section className={styles.employeePanel} aria-label="My employee information">
              <div className={dash.profileHeaderBanner}>
                <div className={dash.photoBox} aria-hidden="true">
                  {initialsOf(username)}
                </div>
                <div className={dash.profileMetaBox}>
                  <div className={dash.profileTagRow}>
                    <span className={dash.userRoleTag}>{t("พนักงาน", "Employee")}</span>
                    <span className={dash.onlineBadge}>
                      <span className={dash.onlineDot} aria-hidden="true" />
                      {t("ออนไลน์", "Online")}
                    </span>
                  </div>
                  <strong className={dash.profileName}>{username}</strong>
                  <p className={dash.profileSubText}>
                    {profileValue(authenticatedUser?.positionName)} /{" "}
                    {profileValue(authenticatedUser?.functionName)}
                  </p>
                </div>
              </div>

              <div className={dash.employeeDetailsGrid}>
                {employeeProfile.slice(0, 5).map((item) => (
                  <div className={dash.detailCard} key={item.label}>
                    <span className={dash.detailLabel}>{item.label}</span>
                    <strong className={dash.detailValue} title={item.value}>
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>

              <div className={dash.kpiSummaryBar} aria-label="Training summary">
                <div className={dash.kpiCol}>
                  <span className={dash.kpiLabel}>{t("ลงทะเบียน", "Registered")}</span>
                  <div className={dash.kpiValueRow}>
                    <strong className={dash.kpiValue}>{enrolledPlanIds.size}</strong>
                    <small className={dash.kpiHelper}>{t("หลักสูตร", "courses")}</small>
                  </div>
                </div>
                <div className={dash.kpiCol}>
                  <span className={dash.kpiLabel}>{t("สำเร็จแล้ว", "Completed")}</span>
                  <div className={dash.kpiValueRow}>
                    <strong className={dash.kpiValue}>{completedHours}</strong>
                    <small className={dash.kpiHelper}>{t("ชั่วโมง", "hours")}</small>
                  </div>
                </div>
                <div className={dash.kpiCol}>
                  <span className={dash.kpiLabel}>{t("เปิดรับ", "Open")}</span>
                  <div className={dash.kpiValueRow}>
                    <strong className={dash.kpiValue}>{openToRegister.length}</strong>
                    <small className={dash.kpiHelper}>{t("เข้าร่วมได้", "to join")}</small>
                  </div>
                </div>
              </div>

              {nextTraining ? (
                <div className={dash.nextTraining}>
                  <div className={dash.nextTrainingDate}>
                    <strong>{new Date(nextTraining.plan.startAt).getDate()}</strong>
                    <span>
                      {new Date(nextTraining.plan.startAt).toLocaleDateString(locale, {
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div className={dash.nextTrainingCopy}>
                    <span>{isThai ? "อบรมครั้งถัดไป" : "Next training"}</span>
                    <strong title={nextTraining.plan.courseName}>
                      {nextTraining.plan.courseName}
                    </strong>
                    <small>
                      {nextTraining.plan.venue || "-"} • {nextTraining.plan.hours} hrs
                    </small>
                  </div>
                  {(() => {
                    const days = daysUntil(nextTraining.plan.startAt);
                    if (days === null) return null;
                    return (
                      <span
                        className={`${dash.countdownPill} ${days <= 3 ? dash.soon : ""}`}
                      >
                        {countdownLabel(days, language)}
                      </span>
                    );
                  })()}
                </div>
              ) : null}
            </section>

            <section className={styles.calendarPanel} aria-label="Employee training calendar">
              <div className={styles.panelHeader}>
                <div>
                  <p>{t("ตารางการอบรม", "Training Schedule")}</p>
                  <h2 translate="no">{t("ปฏิทินการอบรม", "Training Calendar")}</h2>
                  <span className={styles.monthMetaBadge}>
                    {selectedMonthLabel} {selectedCalendarYear} • {filteredCalendarTrainings.length} {t("หลักสูตร", "courses")}
                  </span>
                </div>
                <button
                  className={styles.calendarToggleButton}
                  type="button"
                  onClick={() => setIsMonthListOpen((current) => !current)}
                >
                  {isMonthListOpen ? t("ซ่อนรายการ", "Hide list") : t("แสดงรายการ", "Show list")}
                </button>
              </div>

              <div className={styles.calendarFilters}>
                <label>
                  <span>{t("ปี", "Year")}</span>
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
                  <span>{t("เดือน", "Month")}</span>
                  <select
                    value={selectedCalendarMonth}
                    onChange={(event) => setSelectedCalendarMonth(event.target.value)}
                  >
                    {calendarMonths.map((month) => (
                      <option key={month.value} value={month.value}>{monthLabel(month.value, month.label)}</option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedCalendarMonth === "all" ? null : (
                <div className={styles.calendarGrid} aria-label={`Training calendar in ${selectedMonthLabel} ${selectedCalendarYear}`}>
                  {weekDayNames.map((day, idx) => (
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
                    const monthName = date.toLocaleDateString(locale, { month: "short" });

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
                <p>{t("เมนูผู้ใช้งาน", "User Operation")}</p>
                <h2 translate="no">{t("เลือกพื้นที่ทำงาน", "Select a workspace")}</h2>
              </div>
              <span>{moduleCards.length} {t("เมนู", "modules")}</span>
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
                  <b>{t("เปิด", "Open")}</b>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
