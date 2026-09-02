"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { useUiLanguage, type UiLanguage } from "../ThaiUiLocalization";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  type EnrollmentRecord,
} from "../../lib/trainingEnrollment/types";
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
import CalendarModule from "./CalendarModule";
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

const RegisterIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="7" y="4" width="18" height="24" rx="3" fill="#3B82F6" />
    <rect x="7" y="24" width="18" height="2" fill="#EC4899" />
    <line x1="12" y1="4" x2="12" y2="26" stroke="#1D4EDB" strokeWidth="1.5" />
  </svg>
);

const RoadmapIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="7" width="22" height="18" rx="3" fill="#14B8A6" />
    <path d="M5 12h22" stroke="#0D9488" strokeWidth="1.5" />
    <circle cx="10" cy="18" r="2" fill="#ffffff" />
    <line x1="15" y1="18" x2="22" y2="18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const RequestIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="6" width="22" height="22" rx="3" fill="#8B5CF6" />
    <path d="M12 11h8M12 16h8M12 21h5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    <circle cx="9" cy="11" r="1.2" fill="#ffffff" />
    <circle cx="9" cy="16" r="1.2" fill="#ffffff" />
    <circle cx="9" cy="21" r="1.2" fill="#ffffff" />
  </svg>
);

const RecordIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="6" y="6" width="20" height="22" rx="3" fill="#F59E0B" />
    <rect x="11" y="4" width="10" height="4" rx="1.5" fill="#D97706" />
    <path d="M11 15l3 3 7-7" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ReportIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="5" width="22" height="22" rx="3" fill="#EF4444" />
    <rect x="9" y="16" width="3" height="7" rx="1" fill="#ffffff" />
    <rect x="14.5" y="11" width="3" height="12" rx="1" fill="#ffffff" />
    <rect x="20" y="8" width="3" height="15" rx="1" fill="#ffffff" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="5" width="22" height="22" rx="4" fill="#10B981" />
    <path d="M5 11h22" stroke="#059669" strokeWidth="1.5" />
    <rect x="9" y="15" width="4" height="4" rx="1" fill="#ffffff" />
    <rect x="15" y="15" width="4" height="4" rx="1" fill="#ffffff" />
    <rect x="21" y="15" width="4" height="4" rx="1" fill="#ffffff" />
    <rect x="9" y="21" width="4" height="4" rx="1" fill="#ffffff" />
    <rect x="15" y="21" width="4" height="4" rx="1" fill="#ffffff" />
  </svg>
);

const moduleIconMap: Record<UserModule, React.ReactNode> = {
  register: <RegisterIcon />,
  roadmap: <RoadmapIcon />,
  request: <RequestIcon />,
  record: <RecordIcon />,
  report: <ReportIcon />,
  calendar: <CalendarIcon />,
};

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

/** Enrollments whose 30-day follow-up evaluation has opened and is still unanswered - the set the
 *  dashboard's reminder banner nags about. A pure function of the list the page already loads, so
 *  it is testable without rendering the whole dashboard. */
export const pendingFollowUpEvaluationsOf = (enrollments: EnrollmentRecord[]) =>
  enrollments.filter(
    (enrollment) =>
      enrollment.plan.assessment.evaluationAfter30Day.mode === "FORM" &&
      enrollment.plan.assessment.evaluationAfter30Day.availability === "OPEN" &&
      enrollment.plan.assessment.evaluationAfter30Day.submission === null,
  );

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
  const fullEmployeeProfileItems = useMemo(() => {
    const userAny = authenticatedUser as any;
    return [
      {
        label: isThai ? "ชื่อ-นามสกุล" : "Full Name",
        value: profileValue(authenticatedUser?.displayName ?? username),
      },
      {
        label: isThai ? "รหัสพนักงาน" : "Employee Code",
        value: authenticatedUser?.employeeCode ? authenticatedUser.employeeCode : "EMPLOYEE Account",
      },
      {
        label: isThai ? "ตำแหน่ง" : "Position",
        value: profileValue(authenticatedUser?.positionName),
      },
      {
        label: isThai ? "หน่วยงาน / แผนก" : "Department",
        value: profileValue(authenticatedUser?.functionName),
      },
      {
        label: isThai ? "วันเริ่มงาน" : "Start Date",
        value: userAny?.startDate ? userAny.startDate : (isThai ? "ไม่ระบุ" : "Not specified"),
      },
      {
        label: isThai ? "วันเกิด" : "Date of Birth",
        value: userAny?.birthDate ? userAny.birthDate : (isThai ? "ไม่ระบุ" : "Not specified"),
      },
      {
        label: isThai ? "บริษัท" : "Company",
        value: profileValue(authenticatedUser?.companyName ?? authenticatedUser?.companyCode),
      },
    ];
  }, [authenticatedUser, username, isThai]);
  const searchParams = useSearchParams();
  // Read once, as the initial value only - a page returning from /training-form links back to
  // "/?module=record" so the employee lands on My Record instead of the bare dashboard home.
  // Switching modules afterward does not sync back into the URL; this only covers the return trip.
  const [activeModule, setActiveModule] = useState<UserModule | null>(() => {
    const requested = searchParams.get("module");
    return moduleCards.some((module) => module.key === requested) ? (requested as UserModule) : null;
  });
  const [trainingNeed, setTrainingNeed] = useState("");
  const [reason, setReason] = useState("");
  const [requestCourseId, setRequestCourseId] = useState("");
  const [calendarToday] = useState(getCurrentCalendarDate);
  const [selectedCalendarYear, setSelectedCalendarYear] = useState(
    calendarToday.year,
  );
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(
    calendarToday.month,
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
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
    setSelectedDay(null);
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
    setSelectedDay(null);
  };
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpcomingSectionOpen, setIsUpcomingSectionOpen] = useState(false);
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
  const upcomingApprovedTrainings = useMemo(() => {
    const now = Date.now();
    return enrollments
      .filter(
        (enrollment) =>
          APPROVED_ENROLLMENT_STATUSES.includes(enrollment.status) &&
          Date.parse(enrollment.plan.endAt) >= now,
      )
      .sort((left, right) => left.plan.startAt.localeCompare(right.plan.startAt));
  }, [enrollments]);
  // Everything this needs already rides on the same enrollments list (Phase 3.1) - no extra
  // request just to know whether to nag someone about a survey.
  const pendingFollowUpEvaluations = useMemo(() => pendingFollowUpEvaluationsOf(enrollments), [enrollments]);
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
      locked: module.locked,
      onClick: () => {
        if (!module.locked) setActiveModule(module.key);
      },
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
            <RegisterTrainingModule onNavigate={(mod) => setActiveModule(mod)} />
          ) : null}
          {activeModule === "roadmap" ? (
            <RoadmapModule
              onRequestRefresher={(recordId) => {
                setRequestCourseId(recordId);
                setActiveModule("request");
              }}
              onNavigate={(mod) => setActiveModule(mod as any)}
            />
          ) : null}
          {activeModule === "request" ? (
            <RequestTrainingModule
              reason={reason}
              setReason={setReason}
              setTrainingNeed={setTrainingNeed}
              trainingNeed={trainingNeed}
              initialCourseId={requestCourseId}
              onNavigate={(mod) => setActiveModule(mod as any)}
            />
          ) : null}
          {activeModule === "record" ? (
            <RecordModule
              onRequestRefresher={(record) => {
                setRequestCourseId(record.id);
                setActiveModule("request");
              }}
            />
          ) : null}
          {activeModule === "report" ? (
            <ReportModule
              completedHours={completedHours}
              completedCount={completedEnrollments.length}
            />
          ) : null}
          {activeModule === "calendar" ? (
            <CalendarModule
              initialYear={selectedCalendarYear}
              initialMonth={selectedCalendarMonth}
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

          <div className={styles.actionStrip} aria-label="What needs your attention">
            <button
              className={styles.actionCard}
              type="button"
              style={{
                "--card-accent": "#2563eb",
                "--card-accent-soft": "rgba(37, 99, 235, 0.12)",
                "--card-accent-border": "rgba(37, 99, 235, 0.3)",
              } as CSSProperties}
              disabled={openToRegister.length === 0}
              onClick={() => setActiveModule("register")}
            >
              <span className={styles.actionCount}>{openToRegister.length}</span>
              <span className={styles.actionCopy}>
                <strong>{isThai ? "หลักสูตรที่สมัครได้" : "Open to register"}</strong>
                <span>
                  {openToRegister.length === 0
                    ? (isThai ? "ยังไม่มีหลักสูตรใหม่" : "Nothing new right now")
                    : (isThai ? "กดเพื่อเลือกหลักสูตร" : "Tap to choose a course")}
                </span>
              </span>
              <span className={styles.actionChevron} aria-hidden="true">›</span>
            </button>

            <button
              className={styles.actionCard}
              type="button"
              style={{
                "--card-accent": "#7c3aed",
                "--card-accent-soft": "rgba(124, 58, 237, 0.12)",
                "--card-accent-border": "rgba(124, 58, 237, 0.3)",
              } as CSSProperties}
              disabled={awaitingApproval.length === 0}
              onClick={() => setActiveModule("register")}
            >
              <span className={styles.actionCount}>{awaitingApproval.length}</span>
              <span className={styles.actionCopy}>
                <strong>{isThai ? "รออนุมัติ" : "Awaiting approval"}</strong>
                <span>
                  {awaitingApproval.length === 0
                    ? (isThai ? "ไม่มีคำขอค้าง" : "No request pending")
                    : (isThai ? "HRD กำลังพิจารณา" : "With HRD for review")}
                </span>
              </span>
              <span className={styles.actionChevron} aria-hidden="true">›</span>
            </button>

            <button
              className={styles.actionCard}
              type="button"
              style={{
                "--card-accent": "#10b981",
                "--card-accent-soft": "rgba(16, 185, 129, 0.12)",
                "--card-accent-border": "rgba(16, 185, 129, 0.3)",
              } as CSSProperties}
              disabled={completedEnrollments.length === 0}
              onClick={() => setActiveModule("record")}
            >
              <span className={styles.actionCount}>{completedEnrollments.length}</span>
              <span className={styles.actionCopy}>
                <strong>{isThai ? "อบรมสำเร็จแล้ว" : "Completed"}</strong>
                <span>
                  {completedEnrollments.length === 0
                    ? (isThai ? "ยังไม่มีประวัติ" : "No record yet")
                    : (isThai ? `สะสม ${completedHours} ชั่วโมง` : `${completedHours} hours`)}
                </span>
              </span>
              <span className={styles.actionChevron} aria-hidden="true">›</span>
            </button>
          </div>

          {pendingFollowUpEvaluations.length > 0 ? (
            <button
              type="button"
              onClick={() => setActiveModule("record")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                textAlign: "left",
                margin: "0 0 16px",
                padding: "12px 16px",
                borderRadius: "12px",
                background: "rgba(234, 179, 8, 0.12)",
                border: "1px solid rgba(234, 179, 8, 0.35)",
                color: "#854d0e",
                cursor: "pointer",
                font: "inherit",
              }}
              aria-label="30-day follow-up evaluation reminder"
            >
              <span aria-hidden="true" style={{ fontSize: "1.1rem" }}>📋</span>
              <span style={{ fontSize: "0.84rem", fontWeight: 700 }}>
                {isThai
                  ? `มีแบบประเมินหลัง 30 วันรอทำ ${pendingFollowUpEvaluations.length} รายการ: ${pendingFollowUpEvaluations
                      .map((e) => e.plan.courseName)
                      .join(", ")} — กดเพื่อไปทำ`
                  : `${pendingFollowUpEvaluations.length} 30-day follow-up evaluation${pendingFollowUpEvaluations.length > 1 ? "s" : ""} waiting: ${pendingFollowUpEvaluations
                      .map((e) => e.plan.courseName)
                      .join(", ")} — tap to complete`}
              </span>
            </button>
          ) : null}

          <div className={styles.topRow}>
            <section className={styles.employeePanel} aria-label="My employee information">
              <div className={styles.profileHeaderBanner}>
                <div className={styles.photoBox} aria-hidden="true">
                  {initialsOf(username)}
                </div>
                <div className={styles.profileMetaBox}>
                  <div className={styles.profileTagRow}>
                    <span className={styles.userRoleTag}>{t("พนักงาน", "EMPLOYEE")}</span>
                    <span className={styles.onlineBadge}>
                      <span className={styles.onlineDot} aria-hidden="true" />
                      {t("ออนไลน์", "Online")}
                    </span>
                  </div>
                  <strong className={styles.profileName}>{username}</strong>
                  <p className={styles.profileSubText}>
                    {profileValue(authenticatedUser?.positionName)} /{" "}
                    {profileValue(authenticatedUser?.functionName)}
                  </p>
                </div>
              </div>

              <div className={styles.employeeDetailsGrid}>
                {fullEmployeeProfileItems.map((item) => (
                  <div className={styles.detailCard} key={item.label}>
                    <span className={styles.detailLabel}>{item.label}</span>
                    <strong className={styles.detailValue} title={item.value}>
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>

              <div className={styles.kpiSummaryBar} aria-label="Training summary">
                <div className={styles.kpiCol}>
                  <span className={styles.kpiLabel}>{t("ลงทะเบียน", "Registered")}</span>
                  <div className={styles.kpiValueRow}>
                    <strong className={styles.kpiValue}>{enrolledPlanIds.size}</strong>
                    <small className={styles.kpiHelper}>{t("หลักสูตร", "courses")}</small>
                  </div>
                </div>
                <div className={styles.kpiCol}>
                  <span className={styles.kpiLabel}>{t("สำเร็จแล้ว", "Completed")}</span>
                  <div className={styles.kpiValueRow}>
                    <strong className={styles.kpiValue}>{completedHours}</strong>
                    <small className={styles.kpiHelper}>{t("ชั่วโมง", "hours")}</small>
                  </div>
                </div>
                <div className={styles.kpiCol}>
                  <span className={styles.kpiLabel}>{t("เปิดรับ", "Open")}</span>
                  <div className={styles.kpiValueRow}>
                    <strong className={styles.kpiValue}>{openToRegister.length}</strong>
                    <small className={styles.kpiHelper}>{t("เข้าร่วมได้", "to join")}</small>
                  </div>
                </div>
              </div>

            </section>

            <section className={styles.calendarPanel} aria-label="Employee training calendar">
              <div className={styles.panelHeader}>
                <div>
                  <span>{selectedMonthLabel} {selectedCalendarYear}</span>
                  <h2>{t("ปฏิทินการฝึกอบรม", "Training Calendar")}</h2>
                </div>
                <div className={styles.calendarHeaderActions}>
                  <b className={styles.courseCountBadge}>
                    <span className={styles.badgeDot} />
                    {filteredCalendarTrainings.length} {t("หลักสูตร", "courses")}
                  </b>
                  <button
                    type="button"
                    className={styles.fullCalendarBtn}
                    onClick={() => setActiveModule("calendar")}
                    title={t("ดูปฏิทินแบบเต็ม (Full Calendar)", "View Full Calendar")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    <span>{t("ปฏิทินใหญ่", "Full Calendar")}</span>
                  </button>
                </div>
              </div>

              <div className={styles.calendarFilters}>
                <div className={styles.filterItem}>
                  <span className={styles.filterTitle}>{t("บริษัท", "Company")}</span>
                  <div className={styles.selectWrapper}>
                    <select
                      className={styles.filterSelect}
                      disabled
                      value={employeeCompany}
                    >
                      <option value={employeeCompany}>{employeeCompany} + Center</option>
                    </select>
                    <svg className={styles.selectChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                <div className={styles.filterItem}>
                  <span className={styles.filterTitle}>{t("ปี", "Year")}</span>
                  <div className={styles.selectWrapper}>
                    <select
                      className={styles.filterSelect}
                      value={selectedCalendarYear}
                      onChange={(event) => {
                        setSelectedCalendarYear(event.target.value);
                        setSelectedDay(null);
                      }}
                    >
                      {calendarYears.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    <svg className={styles.selectChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                <div className={styles.filterItem}>
                  <span className={styles.filterTitle}>{t("เดือน", "Month")}</span>
                  <div className={styles.selectWrapper}>
                    <select
                      className={styles.filterSelect}
                      value={selectedCalendarMonth}
                      onChange={(event) => {
                        setSelectedCalendarMonth(event.target.value);
                        setSelectedDay(null);
                      }}
                    >
                      {calendarMonths.map((month) => (
                        <option key={month.value} value={month.value}>{monthLabel(month.value, month.label)}</option>
                      ))}
                    </select>
                    <svg className={styles.selectChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
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
                    const isSelected = item.day !== null && item.day === selectedDay;

                    const className = [
                      styles.calendarDay,
                      hasTrainings ? styles.trainingDay : "",
                      isToday ? styles.today : "",
                      isSelected ? styles.selectedDay : "",
                      isWeekend ? styles.weekendDay : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <div
                        className={className}
                        key={`${item.day ?? "empty"}-${index}`}
                        onClick={() => {
                          if (item.day !== null && hasTrainings) {
                            setSelectedDay(item.day === selectedDay ? null : item.day);
                          }
                        }}
                        style={hasTrainings ? { cursor: "pointer" } : undefined}
                        title={hasTrainings ? `${item.trainings.length} ${isThai ? "หลักสูตร (กดเพื่อดูรายละเอียด)" : "courses (click for details)"}` : undefined}
                      >
                        {item.day ? (
                          <>
                            <div className={styles.dayCellTop}>
                              <span className={styles.dayNumberBadge}>{item.day}</span>
                              {isToday && <span className={styles.todayDotIndicator} title={isThai ? "วันนี้" : "Today"} />}
                            </div>
                            {hasTrainings && (
                              <span className={styles.topRightBadge}>
                                {item.trainings.length}
                              </span>
                            )}
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedCalendarMonth !== "all" && selectedDay !== null && (() => {
                const dayTrainings = filteredCalendarTrainings.filter(
                  (item) => Number(item.date.slice(8, 10)) === selectedDay,
                );
                if (dayTrainings.length === 0) return null;
                const dateStr = `${selectedCalendarYear}-${selectedCalendarMonth}-${String(selectedDay).padStart(2, "0")}`;
                const dateLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString(isThai ? "th-TH" : "en-US", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                });
                return (
                  <div className={styles.dayDetailPanel} aria-label={`Training detail for day ${selectedDay}`}>
                    <div className={styles.dayDetailHeader}>
                      <div>
                        <strong>📅 {dateLabel}</strong>
                        <span>{dayTrainings.length} {isThai ? "รายการอบรมในวันนี้" : "training courses scheduled today"}</span>
                      </div>
                      <button
                        className={styles.dayDetailClose}
                        type="button"
                        onClick={() => setSelectedDay(null)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className={styles.dayDetailList}>
                      {dayTrainings.map((training) => (
                        <div className={styles.dayDetailItem} key={training.title}>
                          <div className={styles.dayDetailItemTop}>
                            <span className={styles.dayDetailCompanyTag}>
                              🏠 {employeeCompany}
                            </span>
                            <span className={styles.dayDetailStatusBadge}>
                              <span className={styles.pulseDot} />
                              {training.status}
                            </span>
                          </div>
                          <strong className={styles.dayDetailCourseName}>{training.title}</strong>
                          <div className={styles.dayDetailInfo}>
                            <span>🕐 {training.time}</span>
                            <span>📍 {training.place}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

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

          {upcomingApprovedTrainings.length > 0 ? (
            <section className={styles.upcomingTrainingsSection} aria-label="Upcoming approved trainings">
              <div
                className={styles.upcomingSectionHeader}
                onClick={() => setIsUpcomingSectionOpen((prev) => !prev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsUpcomingSectionOpen((prev) => !prev);
                  }
                }}
              >
                <div className={styles.upcomingSectionTitleBox}>
                  <span className={styles.upcomingSectionIcon} aria-hidden="true">📅</span>
                  <div>
                    <div className={styles.upcomingSectionTitleRow}>
                      <h3 className={styles.upcomingSectionTitle}>
                        {isThai ? "หลักสูตรที่ต้องเข้าอบรม" : "Upcoming Scheduled Trainings"}
                      </h3>
                      <span className={styles.upcomingCountBadge}>
                        <span className={styles.badgePulseDot} aria-hidden="true" />
                        {upcomingApprovedTrainings.length} {isThai ? "หลักสูตร" : "courses"}
                      </span>
                    </div>
                    <p className={styles.upcomingSectionSubtitle}>
                      {isThai
                        ? "หลักสูตรที่ได้รับการอนุมัติแล้ว พร้อมกำหนดการและห้องอบรม"
                        : "Approved courses with schedules, venue, and examination links"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.upcomingAccordionBtn}
                  aria-expanded={isUpcomingSectionOpen}
                  title={isThai ? "ย่อ / ขยายรายการ" : "Toggle list"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsUpcomingSectionOpen((prev) => !prev);
                  }}
                >
                  <span>{isUpcomingSectionOpen ? (isThai ? "ย่อรายการ" : "Collapse") : (isThai ? "ดูรายการ" : "Expand")}</span>
                  <span style={{ fontSize: "0.75rem", transition: "transform 0.2s ease", transform: isUpcomingSectionOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    ▼
                  </span>
                </button>
              </div>

              {isUpcomingSectionOpen ? (
                <div className={styles.upcomingCardsGrid}>
                  {upcomingApprovedTrainings.map((enrollment) => {
                    const startDate = new Date(enrollment.plan.startAt);
                    const endDate = new Date(enrollment.plan.endAt);
                    const days = daysUntil(enrollment.plan.startAt);
                    const isTodayOrSoon = days !== null && days <= 3;

                    return (
                      <article key={enrollment.id} className={styles.upcomingCourseCard}>
                        <div className={styles.upcomingDateColumn}>
                          <div className={styles.upcomingDateBadge}>
                            <div className={styles.upcomingDateMonthBanner}>
                              {startDate.toLocaleDateString(locale, { month: "short" })}
                            </div>
                            <div className={styles.upcomingDateDayNumber}>
                              {startDate.getDate()}
                            </div>
                            <div className={styles.upcomingDateYear}>
                              {startDate.getFullYear()}
                            </div>
                          </div>
                          {days !== null ? (
                            <span
                              className={
                                days < 0
                                  ? styles.countdownBadgeOngoing
                                  : isTodayOrSoon
                                    ? styles.countdownBadgeSoon
                                    : styles.countdownBadgeNormal
                              }
                            >
                              <span className={styles.badgePulseDot} style={{ width: 5, height: 5 }} aria-hidden="true" />
                              {countdownLabel(days, language)}
                            </span>
                          ) : null}
                        </div>

                        <div className={styles.upcomingCardBody}>
                          <div className={styles.upcomingCardHeader}>
                            <div className={styles.upcomingCourseMetaTop}>
                              <span className={styles.upcomingCourseCode}>
                                {enrollment.plan.courseCode || "TR-COURSE"}
                              </span>
                              <span className={styles.upcomingStatusTag}>
                                ✓ {isThai ? "อนุมัติแล้ว" : "Approved"}
                              </span>
                              <span className={styles.upcomingOwnerTag}>
                                🏢 {enrollment.plan.owner === "CENTER" ? "HRD Center" : `${employeeCompany || "Factory"}`}
                              </span>
                            </div>
                            <h4 className={styles.upcomingCourseName} title={enrollment.plan.courseName}>
                              {enrollment.plan.courseName}
                            </h4>
                          </div>

                          <div className={styles.upcomingDetailsRow}>
                            <div className={styles.upcomingDetailChip}>
                              <span className={styles.upcomingDetailChipLabel}>🕒 {isThai ? "เวลา" : "Time"}:</span>
                              <span className={styles.upcomingDetailChipValue}>
                                {startDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} -{" "}
                                {endDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}{" "}
                                ({enrollment.plan.hours} {isThai ? "ชม." : "hrs"})
                              </span>
                            </div>
                            <div className={styles.upcomingDetailChip}>
                              <span className={styles.upcomingDetailChipLabel}>📍 {isThai ? "สถานที่" : "Venue"}:</span>
                              <span className={styles.upcomingDetailChipValue}>{enrollment.plan.venue || "-"}</span>
                            </div>
                            <div className={styles.upcomingDetailChip}>
                              <span className={styles.upcomingDetailChipLabel}>👤 {isThai ? "วิทยากร" : "Instructor"}:</span>
                              <span className={styles.upcomingDetailChipValue}>{enrollment.plan.instructor || "-"}</span>
                            </div>
                          </div>
                        </div>

                        <div className={styles.upcomingCardActions}>
                          <button
                            type="button"
                            className={styles.upcomingActionPrimaryBtn}
                            onClick={() => setActiveModule("record")}
                            title={isThai ? "ไปที่หน้าประวัติและแบบทดสอบ" : "Go to My Record & Tests"}
                          >
                            📝 {isThai ? "แบบทดสอบ & ผล" : "Tests & Record"}
                          </button>
                          <button
                            type="button"
                            className={styles.upcomingActionSecondaryBtn}
                            onClick={() => setActiveModule("calendar")}
                            title={isThai ? "ดูตารางในปฏิทิน" : "View in Calendar"}
                          >
                            📅 {isThai ? "ดูในปฏิทิน" : "Calendar"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={styles.menuPanel} aria-label="Main workspace menu">
            <div className={styles.menuHeader}>
              <div>
                <span>{t("เมนูผู้ใช้งาน", "User Operations")}</span>
                <h2>{t("เลือกโมดูลที่ต้องการใช้งาน", "Select a Workspace Module")}</h2>
              </div>
              <p className={styles.coreModulesBadge}>{moduleCards.length} Core Modules</p>
            </div>

            <div className={styles.menuRow}>
              {moduleCards.map((module, index) => {
                const moduleThemes: Record<
                  UserModule,
                  { icon: string; accent: string; accentSoft: string; accentBorder: string; badgeText?: string }
                > = {
                  register: {
                    icon: "📚",
                    accent: "#2563eb",
                    accentSoft: "rgba(37, 99, 235, 0.12)",
                    accentBorder: "rgba(37, 99, 235, 0.3)",
                    badgeText: openToRegister.length > 0 ? (isThai ? `เปิดรับ ${openToRegister.length} คอร์ส` : `${openToRegister.length} open`) : undefined,
                  },
                  roadmap: {
                    icon: "🗺️",
                    accent: "#0d9488",
                    accentSoft: "rgba(13, 148, 136, 0.12)",
                    accentBorder: "rgba(13, 148, 136, 0.3)",
                    badgeText: isThai ? "เส้นทางฝึกอบรม" : "Personal Path",
                  },
                  request: {
                    icon: "💡",
                    accent: "#7c3aed",
                    accentSoft: "rgba(124, 58, 237, 0.12)",
                    accentBorder: "rgba(124, 58, 237, 0.3)",
                    badgeText: awaitingApproval.length > 0 ? (isThai ? `รออนุมัติ ${awaitingApproval.length}` : `${awaitingApproval.length} pending`) : undefined,
                  },
                  record: {
                    icon: "📋",
                    accent: "#d97706",
                    accentSoft: "rgba(217, 119, 6, 0.12)",
                    accentBorder: "rgba(217, 119, 6, 0.3)",
                    badgeText: isThai ? `สะสม ${completedHours} ชม.` : `${completedHours} hrs`,
                  },
                  report: {
                    icon: "📊",
                    accent: "#dc2626",
                    accentSoft: "rgba(220, 38, 38, 0.12)",
                    accentBorder: "rgba(220, 38, 38, 0.3)",
                    badgeText: isThai ? "รายงานประวัติ" : "Summary",
                  },
                  calendar: {
                    icon: "📅",
                    accent: "#059669",
                    accentSoft: "rgba(5, 150, 105, 0.12)",
                    accentBorder: "rgba(5, 150, 105, 0.3)",
                    badgeText: isThai ? "ตารางการอบรม" : "Schedules",
                  },
                };

                const theme = moduleThemes[module.key];

                const isLocked = module.locked;

                return (
                  <button
                    className={`${styles.menuBox} ${isLocked ? styles.lockedMenuBox : ""}`}
                    key={module.key}
                    type="button"
                    disabled={isLocked}
                    style={{
                      "--card-accent": theme.accent,
                      "--card-accent-soft": theme.accentSoft,
                      "--card-accent-border": theme.accentBorder,
                    } as CSSProperties}
                    onClick={() => {
                      if (!isLocked) setActiveModule(module.key);
                    }}
                  >
                    <div className={styles.cardHeaderRow}>
                      <div className={styles.cardIconBox} aria-hidden="true">
                        <span className={styles.cardEmojiIcon}>{isLocked ? "🔒" : theme.icon}</span>
                      </div>
                      <span className={styles.cardIndexPill} aria-hidden="true">
                        {isLocked ? "🔒" : String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className={styles.cardBodyContent}>
                      <span className={styles.cardKicker}>{isLocked ? (isThai ? "🔒 ล็อกอยู่" : "🔒 Locked") : (theme.badgeText || module.eyebrow)}</span>
                      <strong className={styles.cardMainTitle} translate="no">{module.title}</strong>
                      <p className={styles.cardDescText}>{module.detail}</p>
                    </div>

                    <div className={styles.cardFooterAction}>
                      <span className={styles.openBtn}>{isLocked ? (isThai ? "🔒 ล็อกอยู่" : "🔒 Locked") : (isThai ? "เปิด" : "Open")}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
