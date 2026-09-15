"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import ActivitiesModule from "./ActivitiesModule";
import RecordModule from "./RecordModule";
import EmployeeNoticeCards from "./EmployeeNoticeCards";
import { recordFocusHref } from "./recordLink";
import RegisterTrainingModule from "./RegisterTrainingModule";
import RequestTrainingModule from "./RequestTrainingModule";
import RoadmapModule from "./RoadmapModule";
import NewActivities from "../center_factory/NewActivities/NewActivities";
import ScheduleCalendar from "../center_factory/ReportManagement/modules/ScheduleCalendar";
import styles from "./UserDashboard.module.css";
import {
  buildCalendarYearOptions,
  getCurrentCalendarDate,
} from "../../lib/calendarDate";
import TypewriterLoader from "../TypewriterLoader";
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  User,
  ClipboardList,
  BookOpen,
  Map as MapIcon,
  Lightbulb,
  Camera,
  Lock,
  X,
  Check,
  FileEdit,
  ArrowRight,
} from "../icons/LucideIcons";

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

const CalendarIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="6" width="22" height="20" rx="3" fill="#0EA5E9" />
    <line x1="5" y1="12" x2="27" y2="12" stroke="#0284C7" strokeWidth="1.5" />
    <circle cx="10" cy="17" r="1.5" fill="#ffffff" />
    <circle cx="16" cy="17" r="1.5" fill="#ffffff" />
    <circle cx="22" cy="17" r="1.5" fill="#ffffff" />
    <circle cx="10" cy="22" r="1.5" fill="#ffffff" />
    <circle cx="16" cy="22" r="1.5" fill="#ffffff" />
  </svg>
);

const ActivitiesIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="5" width="22" height="22" rx="3" fill="#EC4899" />
    <path d="M10 16l4 4 8-8" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const moduleIconMap: Record<UserModule, React.ReactNode> = {
  register: <RegisterIcon />,
  roadmap: <RoadmapIcon />,
  request: <RequestIcon />,
  record: <RecordIcon />,
  calendar: <CalendarIcon />,
  activities: <ActivitiesIcon />,
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

const COMPANY_EN_NAMES: Record<string, string> = {
  ATA: "Aisin Takaoka Asia Co., Ltd.",
  ATFB: "Aisin Takaoka Foundry Bangpakong Co., Ltd.",
  NIC: "The Nawaloha Industry Co., Ltd.",
  SATI: "Siam AT Industry Co., Ltd.",
  SNF: "The Siam Nawaloha Foundry Co., Ltd.",
  TEP: "Thai Engineering Products Co., Ltd.",
};

const THAI_COMPANY_TO_EN: Record<string, string> = {
  "บริษัท ไอชิน ทากาโอกะ เอเชีย จำกัด": "Aisin Takaoka Asia Co., Ltd.",
  "บริษัท ไอซิน ทาคาโอกะ เอเชีย จำกัด": "Aisin Takaoka Asia Co., Ltd.",
  "บริษัท ไอชิน ทากาโอกะ ฟาวดรี บางปะกง จำกัด": "Aisin Takaoka Foundry Bangpakong Co., Ltd.",
  "บริษัท ไอซิน ทาคาโอกะ ฟาวดรี บางปะกง จำกัด": "Aisin Takaoka Foundry Bangpakong Co., Ltd.",
  "บริษัท เดอะ นวโลหะ อินดัสตรี จำกัด": "The Nawaloha Industry Co., Ltd.",
  "บริษัท สยาม เอที อินดัสทรี จำกัด": "Siam AT Industry Co., Ltd.",
  "บริษัท เดอะ สยาม นวโลหะ ฟาวน์ดรี จำกัด": "The Siam Nawaloha Foundry Co., Ltd.",
  "บริษัท ไทย เอ็นจิเนียริ่ง โปรดักส์ จำกัด": "Thai Engineering Products Co., Ltd.",
};

const THAI_POSITION_TO_EN: Record<string, string> = {
  "เจ้าหน้าที่": "Officer",
  "พนักงาน": "Staff",
  "พนักงานปฏิบัติการ": "Operator",
  "วิศวกร": "Engineer",
  "ช่างเทคนิค": "Technician",
  "หัวหน้างาน": "Section Head",
  "หัวหน้าแผนก": "Section Head",
  "ผู้จัดการแผนก": "Section Head",
  "ผู้จัดการ": "Manager",
  "ผู้จัดการ++": "Manager++",
  "ผู้จัดการฝ่าย": "General Manager",
  "ผู้จัดการทั่วไป": "General Manager",
  "ผู้จัดการโรงงาน": "Plant Manager",
  "โฟร์แมน": "Foreman",
  "หัวหน้าชุด": "Foreman",
  "หัวหน้าชุดอาวุโส": "Senior Foreman",
  "ลีดเดอร์": "Leader",
  "ประธาน": "President",
  "รองประธาน": "Vice President",
  "ที่ปรึกษา": "Advisor",
};

const THAI_FUNCTION_TO_EN: Record<string, string> = {
  "สนง.บริหารกลาง": "General Administration Office",
  "บริหารกลาง": "General Administration Office",
  "สำนักงานบริหารกลาง": "General Administration Office",
  "ทรัพยากรบุคคล": "Human Resource",
  "ฝ่ายบุคคล": "Human Resource",
  "ทรัพยากรมนุษย์": "Human Resource",
  "การเงินและบัญชี": "Account and Financial",
  "บัญชีและการเงิน": "Account and Financial",
  "บัญชี": "Account and Financial",
  "ฝ่ายผลิต": "Production",
  "ผลิต": "Production",
  "การผลิต": "Production",
  "วางแผนการผลิต": "Production Planning",
  "วิศวกรรม": "Engineering and Maintenance",
  "ฝ่ายวิศวกรรม": "Engineering and Maintenance",
  "วิศวกรรมและซ่อมบำรุง": "Engineering and Maintenance",
  "วิศวกรรมโครงการ": "Project Engineering",
  "ประกันคุณภาพ": "Quality",
  "ควบคุมคุณภาพ": "Quality",
  "คุณภาพ": "Quality",
  "ความปลอดภัยและสิ่งแวดล้อม": "Safety and Environment",
  "คลังสินค้า": "Warehouse",
  "จัดซื้อ": "Purchase",
  "เทคโนโลยีสารสนเทศ": "IT Promotion",
  "ฝ่ายไอที": "IT Promotion",
  "การขาย": "Sale",
  "วางแผนการขาย": "Sale Planning",
  "สำนักงานกรรมการผู้จัดการ": "President Office",
  "ธุรการ": "Administration",
  "ล่ามและเลขานุการ": "Interpreter and Secretary",
  "อื่นๆ": "Other",
};

export const resolveDisplayName = (
  displayName: string | null | undefined,
  username: string,
  isThai: boolean,
  displayNameEn?: string | null,
) => {
  if (isThai) {
    return displayName || username;
  }
  if (displayNameEn?.trim()) {
    return displayNameEn.trim();
  }
  const current = (displayName || username).trim();
  if (current === "ทดสอบ ระบบอบรม" || current === "นาย ทดสอบ ระบบอบรม") {
    return "Training System Test";
  }
  return current;
};

export const resolvePosition = (
  positionName: string | null | undefined,
  isThai: boolean,
  positionNameEn?: string | null,
) => {
  const raw = positionName?.trim();
  if (!raw) return "-";
  if (isThai) return raw;
  if (positionNameEn?.trim()) return positionNameEn.trim();
  return THAI_POSITION_TO_EN[raw] ?? raw;
};

export const resolveDepartment = (
  functionName: string | null | undefined,
  isThai: boolean,
  functionNameEn?: string | null,
) => {
  const raw = functionName?.trim();
  if (!raw) return "-";
  if (isThai) return raw;
  if (functionNameEn?.trim()) return functionNameEn.trim();
  return THAI_FUNCTION_TO_EN[raw] ?? raw;
};

export const resolveCompany = (
  companyName: string | null | undefined,
  companyCode: string | null | undefined,
  isThai: boolean,
  companyNameEn?: string | null,
) => {
  const rawName = companyName?.trim() ?? "";
  const rawCode = companyCode?.trim() ?? "";
  if (isThai) {
    return rawName || rawCode || "-";
  }
  if (companyNameEn?.trim()) return companyNameEn.trim();
  if (rawCode && COMPANY_EN_NAMES[rawCode]) {
    return COMPANY_EN_NAMES[rawCode];
  }
  if (rawName && THAI_COMPANY_TO_EN[rawName]) {
    return THAI_COMPANY_TO_EN[rawName];
  }
  return rawName || rawCode || "-";
};

export { certificatesOf, pendingFollowUpEvaluationsOf } from "./employeeNotices";

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
  const displayFullName = resolveDisplayName(
    authenticatedUser?.displayName,
    username,
    isThai,
    authenticatedUser?.displayNameEn,
  );
  const displayPosition = resolvePosition(
    authenticatedUser?.positionName,
    isThai,
    authenticatedUser?.positionNameEn,
  );
  const displayDepartment = resolveDepartment(
    authenticatedUser?.functionName,
    isThai,
    authenticatedUser?.functionNameEn,
  );
  const displayCompany = resolveCompany(
    authenticatedUser?.companyName,
    authenticatedUser?.companyCode,
    isThai,
    authenticatedUser?.companyNameEn,
  );

  const fullEmployeeProfileItems = useMemo(() => {
    const userAny = authenticatedUser as any;
    return [
      {
        label: isThai ? "ชื่อ-นามสกุล" : "Full Name",
        value: profileValue(displayFullName),
      },
      {
        label: isThai ? "รหัสพนักงาน" : "Employee Code",
        value: authenticatedUser?.employeeCode?.trim()
          ? authenticatedUser.employeeCode
          : isThai
            ? "ไม่ระบุ"
            : "Not specified",
      },
      {
        label: isThai ? "ตำแหน่ง" : "Position",
        value: profileValue(displayPosition),
      },
      {
        label: isThai ? "หน่วยงาน / แผนก" : "Department",
        value: profileValue(displayDepartment),
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
        value: profileValue(displayCompany),
      },
    ];
  }, [
    authenticatedUser,
    displayFullName,
    displayPosition,
    displayDepartment,
    displayCompany,
    isThai,
  ]);
  const searchParams = useSearchParams();
  const router = useRouter();
  // Read once, as the initial value only - a page returning from /training-form links back to
  // "/?module=record" so the employee lands on My Record instead of the bare dashboard home.
  // Switching modules afterward does not sync back into the URL; this only covers the return trip.
  const [activeModule, setActiveModule] = useState<UserModule | null>(() => {
    const requested = searchParams.get("module");
    return moduleCards.some((module) => module.key === requested) ? (requested as UserModule) : null;
  });
  // A notice (dashboard card or navbar bell) pushes "/?module=record&...&at=<now>" while this page
  // is already mounted, so the initial read above is not enough. `at` changes on every click.
  const requestedModule = searchParams.get("module");
  const requestedAt = searchParams.get("at");
  const [handledAt, setHandledAt] = useState(requestedAt);
  if (requestedAt !== handledAt) {
    setHandledAt(requestedAt);
    if (moduleCards.some((module) => module.key === requestedModule)) setActiveModule(requestedModule as UserModule);
  }
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
        <TypewriterLoader label={t("กำลังโหลดข้อมูลแดชบอร์ด...", "Loading dashboard...")} />
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
          {activeModule === "calendar" ? (
            <CalendarModule
              initialYear={selectedCalendarYear}
              initialMonth={selectedCalendarMonth}
            />
          ) : null}
          {activeModule === "activities" ? (
            <ActivitiesModule
              initialYear={selectedCalendarYear}
            />
          ) : null}
        </>
      ) : (
        <>
          <EmployeeNoticeCards enrollments={enrollments} />

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

          {/* 1. Profile - Full-width Row */}
          <section className={styles.employeePanel} aria-label="My employee information">
            <div className={styles.profileHeaderBanner}>
              <div className={styles.profileUserGroup}>
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
                    {profileValue(displayPosition)} / {profileValue(displayDepartment)}
                  </p>
                </div>
              </div>

              <div className={styles.kpiSummaryBar} aria-label="Training summary">
                <button
                  type="button"
                  className={styles.kpiColBtn}
                  onClick={() => setActiveModule("record")}
                  title={t("ดูประวัติการอบรม", "View training records")}
                >
                  <span className={styles.kpiLabel}>{t("ลงทะเบียน", "Registered")}</span>
                  <div className={styles.kpiValueRow}>
                    <strong className={styles.kpiValue}>{enrolledPlanIds.size}</strong>
                    <small className={styles.kpiHelper}>{t("หลักสูตร", "courses")}</small>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.kpiColBtn}
                  onClick={() => setActiveModule("record")}
                  title={t("ดูประวัติการอบรมที่สำเร็จแล้ว", "View completed records")}
                >
                  <span className={styles.kpiLabel}>{t("สำเร็จแล้ว", "Completed")}</span>
                  <div className={styles.kpiValueRow}>
                    <strong className={`${styles.kpiValue} ${styles.kpiCompletedVal}`}>{completedHours}</strong>
                    <small className={styles.kpiHelper}>{t("ชั่วโมง", "hours")}</small>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.kpiColBtn}
                  onClick={() => setActiveModule("register")}
                  title={t("ดูหลักสูตรที่เปิดรับสมัคร", "View open courses")}
                >
                  <span className={styles.kpiLabel}>{t("เปิดรับสมัคร", "Open")}</span>
                  <div className={styles.kpiValueRow}>
                    <strong className={`${styles.kpiValue} ${styles.kpiOpenVal}`}>{openToRegister.length}</strong>
                    <small className={styles.kpiHelper}>{t("หลักสูตร", "courses")}</small>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.kpiColBtn}
                  onClick={() => setActiveModule("register")}
                  title={t("ดูรายการรออนุมัติ", "View awaiting approval")}
                >
                  <span className={styles.kpiLabel}>{t("รออนุมัติ", "Pending")}</span>
                  <div className={styles.kpiValueRow}>
                    <strong className={`${styles.kpiValue} ${styles.kpiPendingVal}`}>{awaitingApproval.length}</strong>
                    <small className={styles.kpiHelper}>{t("รายการ", "items")}</small>
                  </div>
                </button>
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
          </section>

          {/* 2. New Activities */}
          <NewActivities
            isThai={isThai}
            readOnly={true}
            onOpenModule={() => setActiveModule("activities")}
          />

          {/* 3. Schedule Calendar - Interactive Module */}
          <section className={styles.calendarSection} aria-label="Schedule Calendar">
            <ScheduleCalendar
              initialMonth={calendarToday.month}
              initialYear={calendarToday.year}
              defaultOverviewOpen={false}
              filterMode="my-trainings"
              onNavigateRegister={() => setActiveModule("register")}
              onNavigateRecord={(enrollment) => router.push(recordFocusHref(enrollment))}
            />
          </section>

          {/* 4. Workspace Module */}
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
                  { icon: React.ReactNode; accent: string; accentSoft: string; accentBorder: string; badgeText?: string }
                > = {
                  register: {
                    icon: <BookOpen size={24} color="currentColor" strokeWidth={2.2} />,
                    accent: "#2563eb",
                    accentSoft: "rgba(37, 99, 235, 0.12)",
                    accentBorder: "rgba(37, 99, 235, 0.3)",
                    badgeText: openToRegister.length > 0 ? (isThai ? `เปิดรับ ${openToRegister.length} คอร์ส` : `${openToRegister.length} open`) : undefined,
                  },
                  roadmap: {
                    icon: <MapIcon size={24} color="currentColor" strokeWidth={2.2} />,
                    accent: "#0d9488",
                    accentSoft: "rgba(13, 148, 136, 0.12)",
                    accentBorder: "rgba(13, 148, 136, 0.3)",
                    badgeText: isThai ? "เส้นทางฝึกอบรม" : "Personal Path",
                  },
                  request: {
                    icon: <Lightbulb size={24} color="currentColor" strokeWidth={2.2} />,
                    accent: "#7c3aed",
                    accentSoft: "rgba(124, 58, 237, 0.12)",
                    accentBorder: "rgba(124, 58, 237, 0.3)",
                    badgeText: awaitingApproval.length > 0 ? (isThai ? `รออนุมัติ ${awaitingApproval.length}` : `${awaitingApproval.length} pending`) : undefined,
                  },
                  record: {
                    icon: <ClipboardList size={24} color="currentColor" strokeWidth={2.2} />,
                    accent: "#d97706",
                    accentSoft: "rgba(217, 119, 6, 0.12)",
                    accentBorder: "rgba(217, 119, 6, 0.3)",
                    badgeText: isThai ? `สะสม ${completedHours} ชม.` : `${completedHours} hrs`,
                  },
                  calendar: {
                    icon: <Calendar size={24} color="currentColor" strokeWidth={2.2} />,
                    accent: "#059669",
                    accentSoft: "rgba(5, 150, 105, 0.12)",
                    accentBorder: "rgba(5, 150, 105, 0.3)",
                    badgeText: isThai ? "ตารางการอบรม" : "Schedules",
                  },
                  activities: {
                    icon: <Camera size={24} color="currentColor" strokeWidth={2.2} />,
                    accent: "#0284c7",
                    accentSoft: "rgba(2, 132, 199, 0.12)",
                    accentBorder: "rgba(2, 132, 199, 0.3)",
                    badgeText: isThai ? "ข่าวสาร & ภาพกิจกรรม" : "News & Events",
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
                        <span className={styles.cardEmojiIcon}>{isLocked ? <Lock size={22} color="#64748b" /> : theme.icon}</span>
                      </div>
                      <span className={styles.cardIndexPill} aria-hidden="true">
                        {isLocked ? <Lock size={12} /> : String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className={styles.cardBodyContent}>
                      <span className={styles.cardKicker}>
                        {isLocked ? (
                          <>
                            <Lock size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                            {isThai ? "ล็อกอยู่" : "Locked"}
                          </>
                        ) : (
                          theme.badgeText || module.eyebrow
                        )}
                      </span>
                      <strong className={styles.cardMainTitle} translate="no">{module.title}</strong>
                      <p className={styles.cardDescText}>{module.detail}</p>
                    </div>

                    <div className={styles.cardFooterAction}>
                      <span className={styles.moduleStatusHint}>
                        <span className={isLocked ? styles.lockedDot : styles.activeDot} aria-hidden="true" />
                        {isLocked
                          ? (isThai ? "ยังไม่เปิด" : "Unavailable")
                          : (isThai ? "พร้อมใช้งาน" : "Active")}
                      </span>
                      <span className={`${styles.openBtn} ${isLocked ? styles.openBtnLocked : ""}`}>
                        {isLocked ? (
                          <>
                            <Lock size={12} />
                            <span>{isThai ? "ล็อกอยู่" : "Locked"}</span>
                          </>
                        ) : (
                          <>
                            <span>{isThai ? "เข้าใช้งาน" : "Access"}</span>
                            <ArrowRight size={13} className={styles.btnArrow} />
                          </>
                        )}
                      </span>
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
