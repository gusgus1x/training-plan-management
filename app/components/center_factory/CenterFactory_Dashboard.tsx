"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import DashboardLayout from "../DashboardLayout";
import {
  buildProfileItems,
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import {
  formatRollingPlanCompanies,
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "./TrainingPlanManagement/modules/TrainingRolling";
import {
  buildCalendarYearOptions,
  getCurrentCalendarDate,
} from "../../lib/calendarDate";
import { useUiLanguage } from "../ThaiUiLocalization";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import { ACTIVE_ENROLLMENT_STATUSES, type EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import NewActivities from "./NewActivities/NewActivities";
import ScheduleCalendar from "./ReportManagement/modules/ScheduleCalendar";
import styles from "./CenterFactory_Dashboard.module.css";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  BarChart3,
  Folder,
  ArrowRight,
} from "../icons/LucideIcons";
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

type DashboardTraining = {
  planId: string;
  date: string;
  course: string;
  shortName: string;
  time: string;
  room: string;
  status: string;
  company: string;
  isCenterPlan: boolean;
  batch?: string;
  isEnded?: boolean;
  capacity?: number;
  enrolledCount?: number;
  remainingSeats?: number;
};

type CompanyColorKey = "ALL" | "ATA" | "TEP" | "ATFB" | "NIC" | "SATI" | "SNF";

const getCompanyColorKey = (company: string, isCenterPlan?: boolean): CompanyColorKey => {
  if (isCenterPlan || company === "All Companies" || company === "ทุกบริษัท" || !company) {
    return "ALL";
  }
  const c = company.toUpperCase().trim();
  if (c === "ATA") return "ATA";
  if (c === "TEP") return "TEP";
  if (c === "ATFB") return "ATFB";
  if (c === "NIC") return "NIC";
  if (c === "SATI") return "SATI";
  if (c === "SNF") return "SNF";

  if (c.includes("ATA")) return "ATA";
  if (c.includes("TEP")) return "TEP";
  if (c.includes("ATFB")) return "ATFB";
  if (c.includes("NIC")) return "NIC";
  if (c.includes("SATI")) return "SATI";
  if (c.includes("SNF")) return "SNF";

  return "ALL";
};

export const getDashboardTrainingStatus = ({
  dbStatus,
  endDate,
  trainingDate,
  todayStr,
  isThai,
}: {
  dbStatus?: string;
  endDate?: string;
  trainingDate?: string;
  todayStr: string;
  isThai: boolean;
}) => {
  const endDateStr = endDate || trainingDate || "";
  const isEnded = dbStatus === "COMPLETED" || (Boolean(endDateStr) && endDateStr < todayStr);
  return {
    isEnded,
    status: isEnded
      ? (isThai ? "เสร็จสิ้นแล้ว" : "Completed")
      : (isThai ? "เปิดรับสมัคร" : "Published"),
  };
};

type DashboardProps = {
  username: string;
  onHome: () => void;
  onLogout: () => void;
  onOpenTrainingPlan?: (targetModule?: string, courseId?: string) => void;
  onOpenTrainingRecord: () => void;
  onOpenTrainingCourse: () => void;
  onOpenMasterData: () => void;
  onOpenReport: (targetModule?: string, year?: string, month?: string) => void;
};

type DashboardMenuItem = {
  badge: string;
  step: string;
  icon: React.ReactNode;
  title: string;
  subTitle: string;
  description: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentGlow: string;
  onClick: () => void;
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
  const { language } = useUiLanguage();
  const isThai = language === "th";

  const fullEmployeeProfileItems = useMemo(() => {
    const userAny = authenticatedUser as any;
    const isFactory = authenticatedUser?.roleCode === "HRD_FACTORY";
    const isCenter = authenticatedUser?.roleCode === "HRD_CENTER";
    const defaultHrdName = isFactory
      ? `HRD ${authenticatedUser?.companyCode ?? "Factory"}`
      : isCenter
        ? "HRD Center"
        : username;

    return [
      {
        label: isThai ? "ชื่อ-นามสกุล" : "Full Name",
        value: profileValue(authenticatedUser?.displayName ?? defaultHrdName),
      },
      {
        label: isThai ? "รหัสพนักงาน" : "Employee Code",
        value: authenticatedUser?.employeeCode ? authenticatedUser.employeeCode : "HRD Account",
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
        value:
          isCenter
            ? isThai ? "ทุกบริษัท (All Companies)" : "All Companies"
            : profileValue(authenticatedUser?.companyName ?? authenticatedUser?.companyCode),
      },
    ];
  }, [authenticatedUser, username, isThai]);
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
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const handlePrevMonth = () => {
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

  const handleNextMonth = () => {
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

  const handleOpenAcceptSurvey = (training: DashboardTraining) => {
    if (onOpenTrainingPlan) {
      onOpenTrainingPlan("Training Accept Survey", training.planId);
    }
  };

  useEffect(() => {
    void loadWorkflowRollingPlans().then(setRollingPlans);
    void listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then((res) => setEnrollments(res.enrollments || []))
      .catch(() => setEnrollments([]));
  }, []);

  const scopedRollingPlans = useMemo(
    () =>
      rollingPlans.filter((plan) => {
        const planCompanies = getRollingPlanCompanies(plan);
        const isCenterPlan =
          plan.ownerScope === "CENTER" ||
          plan.ownerCompany === "HRD Center" ||
          plan.provider === "HRD Center";

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

                // Factory dashboard: show all plans (including Center) – company info will be displayed in UI
        return true;
      }),
    [isCenterDashboard, rollingPlans, selectedCompanyFilter, userCompanyCode],
  );

  const todayStr = `${calendarToday.year}-${calendarToday.month}-${String(calendarToday.day).padStart(2, "0")}`;

  const trainingSchedule = useMemo<DashboardTraining[]>(
    () =>
      scopedRollingPlans
        .filter((plan) => plan.status === "Planned")
        .map((plan) => {
          const isCenterPlan =
            plan.ownerScope === "CENTER" ||
            plan.ownerCompany === "HRD Center" ||
            plan.provider === "HRD Center";

          const { isEnded, status } = getDashboardTrainingStatus({
            dbStatus: plan.dbStatus,
            endDate: plan.endDate,
            trainingDate: plan.trainingDate,
            todayStr,
            isThai,
          });

          const capacity = Number(plan.participants || 0);
          const enrolledCount = enrollments.filter(
            (e) => e.planId === plan.rollingId && ACTIVE_ENROLLMENT_STATUSES.includes(e.status)
          ).length;
          const remainingSeats = capacity > 0 ? Math.max(0, capacity - enrolledCount) : 0;

          return {
            planId: plan.rollingId,
            date: plan.trainingDate,
            course: plan.course.name,
            shortName: plan.course.code,
            time: `${plan.startTime} - ${plan.endTime}`,
            room: plan.location,
            status,
            company: formatRollingPlanCompanies(plan),
            isCenterPlan,
            batch: plan.batch,
            isEnded,
            capacity,
            enrolledCount,
            remainingSeats,
          };
        }),
    [scopedRollingPlans, todayStr, isThai, enrollments],
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
      label: isThai ? "คอร์สเดือนนี้" : "This Month",
      value: String(filteredTrainingSchedule.length),
      helper: isThai ? "หลักสูตร" : "courses",
    },
    {
      label: isThai ? "ชั่วโมงอบรม" : "Training Hours",
      value: String(
        scopedRollingPlans.reduce(
          (total, plan) => total + Number(plan.hours || 0),
          0,
        ),
      ),
      helper: isThai ? "ชม." : "hours",
    },
    {
      label: isThai ? "เผยแพร่แล้ว" : "Published",
      value: String(
        scopedRollingPlans.filter((plan) => plan.status === "Planned").length,
      ),
      helper: isThai ? "หลักสูตร" : "courses",
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
        const leadingBlankDays = firstDay.getDay();
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

  const menuItems: DashboardMenuItem[] = [
    {
      badge: isThai ? "จัดการหลักสูตร" : "COURSE MANAGEMENT",
      step: "01",
      icon: <BookOpen size={26} color="currentColor" strokeWidth={2.2} />,
      title: "Training Course",
      subTitle: "Training Course Management",
      description: isThai
        ? "ดูแลฐานข้อมูลหลักสูตร มาตรฐานกลุ่มเป้าหมาย ประเภทหลักสูตร และแบบทดสอบก่อน-หลังอบรม"
        : "Manage course master, target standards, course types, and pre/post evaluation forms.",
      accent: "var(--ui-30-primary)",
      accentSoft: "var(--ui-30-primary-soft)",
      accentBorder: "var(--ui-30-primary)",
      accentGlow: "rgba(0, 122, 61, 0.18)",
      onClick: onOpenTrainingCourse,
    },
    {
      badge: isThai ? "จัดการแผนอบรม" : "PLAN MANAGEMENT",
      step: "02",
      icon: <CalendarDays size={26} color="currentColor" strokeWidth={2.2} />,
      title: "Training Plan",
      subTitle: "Training Plan Management",
      description: isThai
        ? "จัดการแผน OAP ประจำปี คำขอฝึกอบรม แบบตอบรับจากบริษัท และแผนอบรมรายเดือน"
        : "Annual OAP plans, training needs, company acceptance surveys, and monthly rolling schedules.",
      accent: "var(--ui-30-primary)",
      accentSoft: "var(--ui-30-primary-soft)",
      accentBorder: "var(--ui-30-primary)",
      accentGlow: "rgba(0, 122, 61, 0.18)",
      onClick: () => onOpenTrainingPlan?.(),
    },
    {
      badge: isThai ? "บันทึกผลอบรม" : "RECORD MANAGEMENT",
      step: "03",
      icon: <ClipboardCheck size={26} color="currentColor" strokeWidth={2.2} />,
      title: "Training Record",
      subTitle: "Training Record Management",
      description: isThai
        ? "บันทึกผู้เข้าอบรมจริง ผลประเมินหลังอบรม ค่าใช้จ่าย และรายชื่อที่เพิ่มภายหลัง"
        : "Record actual attendance, post-training evaluations, expenses, and participant additions.",
      accent: "var(--ui-30-primary)",
      accentSoft: "var(--ui-30-primary-soft)",
      accentBorder: "var(--ui-30-primary)",
      accentGlow: "rgba(0, 122, 61, 0.18)",
      onClick: onOpenTrainingRecord,
    },
    {
      badge: isThai ? "รายงาน" : "REPORT MANAGEMENT",
      step: "04",
      icon: <BarChart3 size={26} color="currentColor" strokeWidth={2.2} />,
      title: "Reports & Analytics",
      subTitle: "Reports & Analytics Management",
      description: isThai
        ? "ดูปฏิทินอบรม สรุปความคืบหน้า และค่าใช้จ่าย"
        : "Training schedule calendars, progress summaries, and expense breakdowns.",
      accent: "var(--ui-30-primary)",
      accentSoft: "var(--ui-30-primary-soft)",
      accentBorder: "var(--ui-30-primary)",
      accentGlow: "rgba(0, 122, 61, 0.18)",
      onClick: () => onOpenReport(),
    },
    {
      badge: isThai ? "ข้อมูลหลัก" : "MASTER DATA",
      step: "05",
      icon: <Folder size={26} color="currentColor" strokeWidth={2.2} />,
      title: "Master Data",
      subTitle: "Master Data Management",
      description: isThai
        ? "ข้อมูลหลักของบริษัท พนักงาน วิทยากร ระดับ ตำแหน่ง และหน่วยงาน"
        : "Companies, employees, instructors, levels, positions, and function master data.",
      accent: "var(--ui-30-primary)",
      accentSoft: "var(--ui-30-primary-soft)",
      accentBorder: "var(--ui-30-primary)",
      accentGlow: "rgba(0, 122, 61, 0.18)",
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
          <span>{isThai ? "ระบบบริหารจัดการการฝึกอบรม HRD" : `HRD Training ${dashboardScope}`}</span>
          <h1 translate="no">{dashboardTitle}</h1>
          <p>
            {isThai
              ? "จัดการแผนการอบรม ข้อมูลหลักสูตร ประวัติการฝึกอบรม และรายงานวิเคราะห์ผล ทั้งกลุ่มบริษัท AISIN TAKAOKA Thailand"
              : "Manage training plans, course data, records, and reports across the AISIN TAKAOKA Thailand group."}
          </p>
        </div>
      </section>

      {/* 1. Profile - Full-width Row */}
      <section className={styles.employeePanel} aria-label="Employee profile">
        <div className={styles.profileHeaderBanner}>
          <div className={styles.profileUserGroup}>
            <div className={styles.photoBox} aria-hidden="true">
              {username ? username.slice(0, 2).toUpperCase() : "HC"}
            </div>
            <div className={styles.profileMetaBox}>
              <div className={styles.profileTagRow}>
                <span className={styles.userRoleTag}>
                  {authenticatedUser?.roleCode === "HRD_CENTER"
                    ? "HRD CENTER"
                    : authenticatedUser?.roleCode === "HRD_FACTORY"
                      ? "HRD FACTORY"
                      : "EMPLOYEE"}
                </span>
                <span className={styles.onlineBadge}>
                  <span className={styles.onlineDot} aria-hidden="true" />
                  {isThai ? "ออนไลน์" : "Online"}
                </span>
              </div>
              <strong className={styles.profileName}>{username}</strong>
              <p className={styles.profileSubText}>
                {authenticatedUser?.roleCode === "HRD_CENTER"
                  ? (isThai ? "ผู้ดูแลระบบฝึกอบรมกลาง (HRD Center)" : "HRD Center Administrator")
                  : (authenticatedUser?.positionName || (isThai ? "ผู้ดูแลระบบโรงงาน (HRD Factory)" : "HRD Factory Admin"))}
              </p>
            </div>
          </div>

          <div className={styles.kpiSummaryBar} aria-label="Training summary">
            {employeeTrainingSummary.map((item) => (
              <div className={styles.kpiCol} key={item.label}>
                <span className={styles.kpiLabel}>{item.label}</span>
                <div className={styles.kpiValueRow}>
                  <strong className={styles.kpiValue}>{item.value}</strong>
                  <small className={styles.kpiHelper}>{item.helper}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.employeeDetailsGrid}>
          {fullEmployeeProfileItems.map((item) => (
            <div className={styles.detailCard} key={item.label}>
              <span className={styles.detailLabel}>{item.label}</span>
              <strong className={styles.detailValue} title={item.value}>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      {/* 2. New Activities */}
      <NewActivities
        isThai={isThai}
        onOpenModule={() => onOpenReport("New Activities")}
      />

      {/* 3. Schedule Calendar - Interactive Module */}
      <section className={styles.calendarSection} aria-label="Schedule Calendar">
        <ScheduleCalendar initialMonth={calendarToday.month} initialYear={calendarToday.year} defaultOverviewOpen={false} />
      </section>

      {/* 4. Workspace Module */}
      <section className={styles.menuPanel} aria-label="Main workspace menu">
        <div className={styles.menuHeader}>
          <div>
            <span>{isThai ? "เมนูการทำงาน" : "Workspace Operations"}</span>
            <h2>{isThai ? "เลือกโมดูลที่ต้องการใช้งาน" : "Select a Workspace Module"}</h2>
          </div>
          <p className={styles.coreModulesBadge}>5 Core Modules</p>
        </div>

        <div className={styles.menuRow}>
          {menuItems.map((item) => (
            <button
              className={styles.menuBox}
              key={item.title}
              style={{
                "--card-accent": item.accent,
                "--card-accent-soft": item.accentSoft,
                "--card-accent-border": item.accentBorder,
              } as CSSProperties}
              type="button"
              onClick={item.onClick}
            >
              <div className={styles.cardHeaderRow}>
                <div className={styles.cardIconBox} aria-hidden="true">
                  <span className={styles.cardEmojiIcon}>{item.icon}</span>
                </div>
                <span className={styles.cardIndexPill} aria-hidden="true">
                  {item.step}
                </span>
              </div>

              <div className={styles.cardBodyContent}>
                <span className={styles.cardKicker}>{item.badge}</span>
                <strong className={styles.cardMainTitle} translate="no">{item.title}</strong>
                <p className={styles.cardDescText}>{item.description}</p>
              </div>

              <div className={styles.cardFooterAction}>
                <span className={styles.moduleStatusHint}>
                  <span className={styles.activeDot} aria-hidden="true" />
                  {isThai ? "พร้อมใช้งาน" : "Active"}
                </span>
                <span className={styles.openBtn}>
                  <span>{isThai ? "เข้าใช้งาน" : "Access"}</span>
                  <ArrowRight size={13} className={styles.btnArrow} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}


