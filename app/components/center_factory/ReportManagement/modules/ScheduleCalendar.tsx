"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatRollingPlanCompanies,
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  monthOptions,
  type RollingPlan,
} from "../../TrainingPlanManagement/modules/TrainingRolling";
import {
  buildCalendarYearOptions,
  getCurrentCalendarDate,
} from "../../../../lib/calendarDate";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import { listEnrollments } from "../../../../lib/trainingEnrollment/client";
import { ACTIVE_ENROLLMENT_STATUSES, type EnrollmentRecord } from "../../../../lib/trainingEnrollment/types";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./ScheduleCalendar.module.css";

export const scheduleCalendarModule = {
  title: "Schedule calendar",
  subtitle: "Training schedule",
  description: "Show monthly training details from Training Rolling data",
} as const;

const thMonthLabels = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const enMonthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const calendarMonths = monthOptions.map((month) => ({
  ...month,
  shortLabel: month.label.slice(0, 3),
}));

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const getPlanEndDate = (plan: RollingPlan): string => {
  if (plan.endDate && plan.endDate >= plan.trainingDate) {
    return plan.endDate;
  }
  return plan.trainingDate;
};

export const getPlanDaysCount = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate || endDate <= startDate) return 1;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
};

export const isPlanInMonth = (plan: RollingPlan, year: string, month: string): boolean => {
  const planStart = plan.trainingDate;
  const planEnd = getPlanEndDate(plan);
  const yearNumber = Number(year);
  const monthIndex = Number(month) - 1;
  const daysInMonth = new Date(yearNumber, monthIndex + 1, 0).getDate();
  const monthStart = `${year}-${month}-01`;
  const monthEnd = `${year}-${month}-${String(daysInMonth).padStart(2, "0")}`;
  return planStart <= monthEnd && planEnd >= monthStart;
};

export interface CalendarWeekDay {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  weekdayIndex: number;
}

export interface CalendarEventSegment {
  plan: RollingPlan;
  startCol: number;
  endCol: number;
  span: number;
  slot: number;
  isMultiDay: boolean;
  totalDays: number;
  isContinuationFromPrev: boolean;
  continuesToNext: boolean;
}

export interface CalendarWeek {
  days: CalendarWeekDay[];
  eventSegments: CalendarEventSegment[];
  maxSlots: number;
}

export const buildCalendarWeeks = (
  year: string,
  month: string,
  plans: RollingPlan[],
): CalendarWeek[] => {
  const yearNumber = Number(year);
  const monthIndex = Number(month) - 1;
  const firstWeekday = new Date(yearNumber, monthIndex, 1).getDay();
  const daysInMonth = new Date(yearNumber, monthIndex + 1, 0).getDate();

  const rawDays: CalendarWeekDay[] = [];

  // Previous month padding
  const prevMonthDaysCount = new Date(yearNumber, monthIndex, 0).getDate();
  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    const dayNum = prevMonthDaysCount - i;
    const prevDate = new Date(yearNumber, monthIndex - 1, dayNum);
    const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    rawDays.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      weekdayIndex: rawDays.length % 7,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${year}-${month}-${String(day).padStart(2, "0")}`;
    rawDays.push({
      date: dateStr,
      dayNumber: day,
      isCurrentMonth: true,
      weekdayIndex: rawDays.length % 7,
    });
  }

  // Next month padding to fill out the last week
  let nextDay = 1;
  while (rawDays.length % 7 !== 0) {
    const nextDate = new Date(yearNumber, monthIndex + 1, nextDay);
    const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
    rawDays.push({
      date: dateStr,
      dayNumber: nextDay,
      isCurrentMonth: false,
      weekdayIndex: rawDays.length % 7,
    });
    nextDay += 1;
  }

  // Group into 7-day weeks
  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < rawDays.length; i += 7) {
    const weekDaysChunk = rawDays.slice(i, i + 7);
    const weekStartDate = weekDaysChunk[0].date;
    const weekEndDate = weekDaysChunk[6].date;

    const segmentsRaw: Omit<CalendarEventSegment, "slot">[] = [];

    for (const plan of plans) {
      const planStart = plan.trainingDate;
      const planEnd = getPlanEndDate(plan);

      // Check if plan overlaps this week
      if (planStart <= weekEndDate && planEnd >= weekStartDate) {
        let startCol = 0;
        let isContinuationFromPrev = false;
        if (planStart < weekStartDate) {
          startCol = 0;
          isContinuationFromPrev = true;
        } else {
          const idx = weekDaysChunk.findIndex((d) => d.date === planStart);
          startCol = idx !== -1 ? idx : 0;
        }

        let endCol = 6;
        let continuesToNext = false;
        if (planEnd > weekEndDate) {
          endCol = 6;
          continuesToNext = true;
        } else {
          const idx = weekDaysChunk.findIndex((d) => d.date === planEnd);
          endCol = idx !== -1 ? idx : 6;
        }

        const span = Math.max(1, endCol - startCol + 1);
        const totalDays = getPlanDaysCount(planStart, planEnd);
        const isMultiDay = totalDays > 1;

        segmentsRaw.push({
          plan,
          startCol,
          endCol,
          span,
          isMultiDay,
          totalDays,
          isContinuationFromPrev,
          continuesToNext,
        });
      }
    }

    // Sort: place single-day events first so multi-day continuous bars stack nicely beneath them
    segmentsRaw.sort((a, b) => {
      if (a.isMultiDay !== b.isMultiDay) {
        return a.isMultiDay ? 1 : -1;
      }
      if (a.startCol !== b.startCol) {
        return a.startCol - b.startCol;
      }
      if (b.span !== a.span) {
        return b.span - a.span;
      }
      return a.plan.trainingDate.localeCompare(b.plan.trainingDate);
    });

    // Assign non-colliding row slots
    const occupied: boolean[][] = [];
    const assignedSegments: CalendarEventSegment[] = [];

    for (const seg of segmentsRaw) {
      let slot = 0;
      while (true) {
        if (!occupied[slot]) {
          occupied[slot] = new Array(7).fill(false);
        }
        let canFit = true;
        for (let col = seg.startCol; col <= seg.endCol; col += 1) {
          if (occupied[slot][col]) {
            canFit = false;
            break;
          }
        }
        if (canFit) {
          for (let col = seg.startCol; col <= seg.endCol; col += 1) {
            occupied[slot][col] = true;
          }
          break;
        }
        slot += 1;
      }

      assignedSegments.push({
        ...seg,
        slot,
      });
    }

    weeks.push({
      days: weekDaysChunk,
      eventSegments: assignedSegments,
      maxSlots: occupied.length,
    });
  }

  return weeks;
};

const buildCalendarCells = (year: string, month: string, plans: RollingPlan[]) => {
  const yearNumber = Number(year);
  const monthIndex = Number(month) - 1;
  const firstWeekday = new Date(yearNumber, monthIndex, 1).getDay();
  const daysInMonth = new Date(yearNumber, monthIndex + 1, 0).getDate();
  const cells: { date: string; day: number | null; plans: RollingPlan[] }[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ date: "", day: null, plans: [] });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${month}-${String(day).padStart(2, "0")}`;
    cells.push({
      date,
      day,
      plans: plans.filter((plan) => {
        const planStart = plan.trainingDate;
        const planEnd = getPlanEndDate(plan);
        return planStart <= date && planEnd >= date;
      }),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: "", day: null, plans: [] });
  }

  return cells;
};

export type CalendarCompanyKey = "ALL" | "ATA" | "TEP" | "ATFB" | "NIC" | "SATI" | "SNF";

export const getPlanCompanyKey = (plan: RollingPlan): CalendarCompanyKey => {
  const formatted = (formatRollingPlanCompanies(plan) || "").trim();
  if (
    formatted === "All Companies" ||
    formatted === "ทุกบริษัท" ||
    plan.owner === "CENTER" ||
    plan.company === "All Companies"
  ) {
    return "ALL";
  }

  const companies = getRollingPlanCompanies(plan);
  if (!companies.length || companies.length >= 6) {
    return "ALL";
  }

  const compStr = (plan.company || "").toUpperCase().trim();
  if (compStr === "ATA") return "ATA";
  if (compStr === "TEP") return "TEP";
  if (compStr === "ATFB") return "ATFB";
  if (compStr === "NIC") return "NIC";
  if (compStr === "SATI") return "SATI";
  if (compStr === "SNF") return "SNF";

  const ownerStr = (plan.ownerCompany || "").toUpperCase().trim();
  if (ownerStr === "ATA") return "ATA";
  if (ownerStr === "TEP") return "TEP";
  if (ownerStr === "ATFB") return "ATFB";
  if (ownerStr === "NIC") return "NIC";
  if (ownerStr === "SATI") return "SATI";
  if (ownerStr === "SNF") return "SNF";

  if (companies.length === 1) {
    const single = companies[0].toUpperCase().trim();
    if (single === "ATA") return "ATA";
    if (single === "TEP") return "TEP";
    if (single === "ATFB") return "ATFB";
    if (single === "NIC") return "NIC";
    if (single === "SATI") return "SATI";
    if (single === "SNF") return "SNF";
  }

  if (formatted.includes("ATA")) return "ATA";
  if (formatted.includes("TEP")) return "TEP";
  if (formatted.includes("ATFB")) return "ATFB";
  if (formatted.includes("NIC")) return "NIC";
  if (formatted.includes("SATI")) return "SATI";
  if (formatted.includes("SNF")) return "SNF";

  return "ALL";
};

const COMPANY_LEGEND_ITEMS: { key: CalendarCompanyKey; labelTh: string; labelEn: string }[] = [
  { key: "ALL", labelTh: "ทุกบริษัท", labelEn: "All Companies" },
  { key: "ATA", labelTh: "ATA", labelEn: "ATA" },
  { key: "TEP", labelTh: "TEP", labelEn: "TEP" },
  { key: "ATFB", labelTh: "ATFB", labelEn: "ATFB" },
  { key: "NIC", labelTh: "NIC", labelEn: "NIC" },
  { key: "SATI", labelTh: "SATI", labelEn: "SATI" },
  { key: "SNF", labelTh: "SNF", labelEn: "SNF" },
];

type ScheduleCalendarProps = {
  initialYear?: string;
  initialMonth?: string;
};

export default function ScheduleCalendar({
  initialYear,
  initialMonth,
}: ScheduleCalendarProps = {}) {
  const user = useAuthenticatedUser();
  const router = useRouter();
  const { language: uiLang } = useUiLanguage();
  const [calendarToday] = useState(getCurrentCalendarDate);
  const [selectedYear, setSelectedYear] = useState(() => initialYear || calendarToday.year);
  const [selectedMonth, setSelectedMonth] = useState<"all" | string>(() => initialMonth || "all");
  const [expandedTrainingMonth, setExpandedTrainingMonth] = useState("");
  const [expandedOverviewMonth, setExpandedOverviewMonth] = useState("");
  const [expandedOverviewCourse, setExpandedOverviewCourse] = useState("");
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const isCenterUser = user?.roleCode === "HRD_CENTER";
  const userCompanyCode = profileValue(user?.companyCode);

  const loadWorkspace = async () => {
    setIsLoading(true);
    try {
      const [plans, enrRes] = await Promise.all([
        loadWorkflowRollingPlans(),
        listEnrollments({ planId: null, employeeId: null, employeeUserId: null }).catch(() => ({ enrollments: [] })),
      ]);
      setRollingPlans(plans);
      setEnrollments(enrRes.enrollments || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const schedulePlans = useMemo(
    () =>
      rollingPlans
        .filter((plan) => {
          if (plan.status !== "Planned") {
            return false;
          }

          const planCompanies = getRollingPlanCompanies(plan);
          const isCenterPlan =
            plan.ownerScope === "CENTER" ||
            plan.ownerCompany === "HRD Center" ||
            plan.provider === "HRD Center";

          if (isCenterUser) {
            if (companyFilter === "all" || companyFilter === "All Companies") {
              return true;
            }
            return (
              plan.company === companyFilter ||
              planCompanies.includes(companyFilter) ||
              plan.company === "All Companies"
            );
          }

          // Factory User Scope (e.g. ATA): Sees own courses + Center-created courses!
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
        })
        .sort((a, b) => a.trainingDate.localeCompare(b.trainingDate)),
    [companyFilter, isCenterUser, rollingPlans, userCompanyCode],
  );
  const calendarYears = useMemo(
    () =>
      buildCalendarYearOptions(
        calendarToday.year,
        rollingPlans
          .filter((plan) => plan.status === "Planned")
          .map((plan) => plan.trainingDate),
      ),
    [calendarToday.year, rollingPlans],
  );
  const todayDate = `${calendarToday.year}-${calendarToday.month}-${String(calendarToday.day).padStart(2, "0")}`;

  const monthSummaries = useMemo(
    () =>
      calendarMonths.map((month) => ({
        ...month,
        plans: schedulePlans
          .filter((plan) => isPlanInMonth(plan, selectedYear, month.value))
          .sort((a, b) => a.trainingDate.localeCompare(b.trainingDate)),
      })),
    [schedulePlans, selectedYear],
  );

  const displayedMonths =
    selectedMonth === "all"
      ? monthSummaries
      : monthSummaries.filter((month) => month.value === selectedMonth);
  const selectedMonthDetail = displayedMonths[0];
  const calendarCells =
    selectedMonth === "all" || !selectedMonthDetail
      ? []
      : buildCalendarCells(selectedYear, selectedMonth, selectedMonthDetail.plans);
  const calendarWeeks = useMemo(
    () =>
      selectedMonth === "all" || !selectedMonthDetail
        ? []
        : buildCalendarWeeks(selectedYear, selectedMonth, selectedMonthDetail.plans),
    [selectedMonth, selectedMonthDetail, selectedYear],
  );
  const scheduleCount = monthSummaries.reduce((sum, month) => sum + month.plans.length, 0);
  const exportPlans = displayedMonths.flatMap((month) =>
    month.plans.map((plan) => ({
      month: month.label,
      date:
        plan.endDate && plan.endDate !== plan.trainingDate
          ? `${plan.trainingDate} - ${plan.endDate}`
          : plan.trainingDate,
      courseCode: plan.course.code,
      courseName: plan.course.name,
      time: `${plan.startTime}-${plan.endTime}`,
      company: formatRollingPlanCompanies(plan),
    })),
  );
  const emailPeriodLabel = selectedMonth === "all" ? selectedYear : `${selectedMonthDetail?.label} ${selectedYear}`;
  const emailCompanyScope = (() => {
    const companies = [...new Set(exportPlans.map((plan) => plan.company))];

    return companies.length === 1 ? companies[0] : "All Companies";
  })();
  const emailDueDate =
    selectedMonth === "all"
      ? `${selectedYear}-12-31`
      : `${selectedYear}-${selectedMonth}-${String(new Date(Number(selectedYear), Number(selectedMonth), 0).getDate()).padStart(2, "0")}`;
  const emailSendDate = todayDate;

  const handleExportExcel = () => {
    const headers = ["Month", "Date", "Course Code", "Course Name", "Time", "Company"];
    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    const rows = exportPlans
      .map((plan) =>
        [plan.month, plan.date, plan.courseCode, plan.courseName, plan.time, plan.company]
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join(""),
      )
      .map((row) => `<tr>${row}</tr>`)
      .join("");
    const table = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table>
            <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([table], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `training-schedule-${selectedYear}-${selectedMonth === "all" ? "all-year" : selectedMonth}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleShowCurrentMonth = () => {
    setSelectedYear(calendarToday.year);
    setSelectedMonth(calendarToday.month);
    setExpandedTrainingMonth("");
    setExpandedOverviewMonth(calendarToday.month);
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px", padding: "40px" }}>
        <TypewriterLoader label="กำลังโหลดข้อมูลปฏิทินแผนการอบรม (Schedule Calendar)..." />
      </div>
    );
  }

  return (
    <section className={styles.moduleWorkspace} aria-label="Schedule calendar module">
      {/* 1. Executive Hero Header */}
      <header className={styles.heroHeader}>
        <div className={styles.heroTitleGroup}>
          <div className={styles.heroTag}>
            <span className={styles.heroDot} />
            <span>Live Rolling Schedule</span>
          </div>
          <h2>Training Schedule Calendar</h2>
          <p>Monthly & annual training schedules synced directly from Training Rolling plans</p>
        </div>

        <div className={styles.heroMetrics}>
          <div className={styles.metricCard}>
            <span>Year Schedules</span>
            <strong>{scheduleCount}</strong>
          </div>
          <div className={styles.metricCard}>
            <span>Selected Period</span>
            <strong>{selectedMonth === "all" ? "All Year" : selectedMonthDetail?.label}</strong>
          </div>
          <div className={styles.metricCard}>
            <span>Company Scope</span>
            <strong>{isCenterUser ? (companyFilter === "all" ? "All" : companyFilter) : userCompanyCode}</strong>
          </div>
        </div>
      </header>

      {/* 2. Control Toolbar Panel */}
      <section className={styles.controlPanel}>
        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            <div className={styles.filterItem}>
              <span className={styles.filterTitle}>{uiLang === "th" ? "บริษัท" : "Company"}</span>
              <div className={styles.selectWrapper}>
                <select
                  className={styles.filterSelect}
                  disabled={!isCenterUser}
                  value={isCenterUser ? companyFilter : userCompanyCode}
                  onChange={(event) => setCompanyFilter(event.target.value)}
                >
                  <option value="all">
                    {isCenterUser ? (uiLang === "th" ? "ทุกบริษัท" : "All Companies") : `${userCompanyCode} + Center Courses`}
                  </option>
                  <option value="ATA">ATA</option>
                  <option value="ATFB">ATFB</option>
                  <option value="NIC">NIC</option>
                  <option value="SATI">SATI</option>
                  <option value="SNF">SNF</option>
                  <option value="TEP">TEP</option>
                </select>
                <svg className={styles.selectChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <div className={styles.filterItem}>
              <span className={styles.filterTitle}>{uiLang === "th" ? "ปี" : "Year"}</span>
              <div className={styles.selectWrapper}>
                <select
                  className={styles.filterSelect}
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
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
          </div>

          <div className={styles.actionGroup}>
            <button
              className={styles.todayButton}
              type="button"
              onClick={handleShowCurrentMonth}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{uiLang === "th" ? "เดือนปัจจุบัน" : "Current Month"}</span>
            </button>
            <button
              className={styles.exportButton}
              disabled={exportPlans.length === 0}
              type="button"
              onClick={handleExportExcel}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{uiLang === "th" ? "ส่งออก Excel" : "Export Excel"}</span>
            </button>
          </div>
        </div>

        {/* 3. Month Navigation Pill Bar */}
        <div className={styles.monthTabsBar} aria-label="Select schedule month">
          <button
            className={`${styles.monthTabBtn} ${selectedMonth === "all" ? styles.activeMonthTab : ""}`}
            type="button"
            onClick={() => setSelectedMonth("all")}
          >
            {uiLang === "th" ? `ทั้งปี (${selectedYear})` : `All Year (${selectedYear})`}
          </button>
          {calendarMonths.map((month, idx) => {
            const planCount = monthSummaries.find((item) => item.value === month.value)?.plans.length ?? 0;
            const isCurrent = selectedYear === calendarToday.year && month.value === calendarToday.month;
            const monthLabels = uiLang === "th" ? thMonthLabels : enMonthLabels;
            const displayLabel = monthLabels[idx] || month.shortLabel;

            return (
              <button
                className={`${styles.monthTabBtn} ${selectedMonth === month.value ? styles.activeMonthTab : ""} ${isCurrent ? styles.currentMonthTab : ""}`}
                key={month.value}
                type="button"
                onClick={() => setSelectedMonth(month.value)}
              >
                <span>{displayLabel}</span>
                {planCount > 0 ? <span className={styles.tabBadge}>{planCount}</span> : null}
              </button>
            );
          })}
        </div>

      </section>

      {/* 5. Main Calendar View */}
      {selectedMonth === "all" ? (
        <section className={styles.monthGrid} aria-label={`${selectedYear} monthly training detail`}>
          {displayedMonths.map((month) => (
            <article
              className={`${styles.monthCard} ${month.plans.length > 0 ? styles.hasPlans : ""} ${selectedYear === calendarToday.year && month.value === calendarToday.month ? styles.currentMonthCard : ""}`}
              key={month.value}
            >
              <header>
                <div>
                  <h3>{month.label}</h3>
                  <span>{month.plans.length} schedules</span>
                </div>
                <div className={styles.monthCardActions}>
                  <button type="button" onClick={() => setSelectedMonth(month.value)}>
                    Calendar
                  </button>
                  <button
                    disabled={month.plans.length === 0}
                    type="button"
                    onClick={() =>
                      setExpandedTrainingMonth((current) => (current === month.value ? "" : month.value))
                    }
                  >
                    {expandedTrainingMonth === month.value ? "Hide" : "Show training"}
                  </button>
                </div>
              </header>

              <div className={styles.miniCalendar}>
                {weekDays.map((day) => (
                  <b key={day}>{day.slice(0, 1)}</b>
                ))}
                {buildCalendarCells(selectedYear, month.value, month.plans).map((cell, index) => (
                  <div
                    className={`${cell.day ? "" : styles.blankMiniDay} ${
                      cell.plans.length > 0 ? styles.busyMiniDay : ""
                    } ${cell.date === todayDate ? styles.todayMiniDay : ""}`}
                    key={`${month.value}-${cell.date || "blank"}-${index}`}
                  >
                    {cell.day ? <span>{cell.day}</span> : null}
                  </div>
                ))}
              </div>

              {expandedTrainingMonth === month.value && month.plans.length > 0 ? (
                <div className={styles.monthCoursePreview}>
                  <span className={styles.previewLabel}>Training list</span>
                  {month.plans.map((plan) => {
                    const isMulti = Boolean(plan.endDate && plan.endDate !== plan.trainingDate);
                    const startDay = Number(plan.trainingDate.slice(8, 10));
                    const endDay = isMulti ? Number(plan.endDate.slice(8, 10)) : startDay;
                    const dateDisplay = isMulti ? `${startDay}-${endDay}` : startDay;
                    return (
                      <div key={plan.rollingId}>
                        <time dateTime={plan.trainingDate}>{dateDisplay}</time>
                        <span>{plan.course.name}</span>
                        {isMulti ? (
                          <span className={styles.multiDayMiniBadge}>
                            {getPlanDaysCount(plan.trainingDate, plan.endDate)}d
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.calendarPanel} aria-label={`${selectedMonthDetail?.label} ${selectedYear} training calendar`}>
          <div className={styles.calendarHeader}>
            <h3>{selectedMonthDetail?.label} {selectedYear}</h3>
            <span className={styles.calendarCountBadge}>{selectedMonthDetail?.plans.length ?? 0} Schedules</span>
          </div>

          {/* Company Color Legend Bar */}
          <div className={styles.calendarLegendBar} aria-label="Company Color Legend">
            <span className={styles.legendTitle}>{uiLang === "th" ? "สัญลักษณ์สี:" : "Colors:"}</span>
            {COMPANY_LEGEND_ITEMS.map((item) => (
              <div key={item.key} className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles[`legendDot_${item.key}`]}`} />
                <span>{uiLang === "th" ? item.labelTh : item.labelEn}</span>
              </div>
            ))}
          </div>

          <div className={styles.calendarGrid}>
            <div className={styles.calendarWeekHeaderRow}>
              {weekDays.map((day, idx) => (
                <div
                  className={`${styles.calendarWeekHeader} ${idx === 0 || idx === 6 ? styles.weekendHeader : ""}`}
                  key={day}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className={styles.calendarWeeksContainer}>
              {calendarWeeks.map((week, weekIdx) => (
                <div className={styles.calendarWeekRow} key={`week-${weekIdx}`}>
                  {/* Background Day Cells Layer */}
                  <div className={styles.calendarWeekDaysBackground}>
                    {week.days.map((cell, dayIdx) => {
                      const isWeekend = dayIdx === 0 || dayIdx === 6;
                      const isToday = cell.date === todayDate;
                      return (
                        <div
                          className={`${styles.calendarDayCell} ${!cell.isCurrentMonth ? styles.blankDayCell : ""} ${
                            isWeekend ? styles.weekendDayCell : ""
                          } ${isToday ? styles.todayDayCell : ""}`}
                          key={cell.date || `blank-${weekIdx}-${dayIdx}`}
                        >
                          {cell.isCurrentMonth ? (
                            <span className={styles.dayNumber}>{cell.dayNumber}</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Events Overlay Grid Layer */}
                  {week.eventSegments.length > 0 ? (
                    <div
                      className={styles.calendarWeekEventsGrid}
                      style={{
                        gridTemplateRows: `repeat(${Math.max(1, week.maxSlots)}, minmax(auto, 1fr))`,
                      }}
                    >
                      {week.eventSegments.map((segment) => {
                        const {
                          plan,
                          startCol,
                          span,
                          slot,
                          isMultiDay,
                          totalDays,
                          isContinuationFromPrev,
                          continuesToNext,
                        } = segment;
                        const companyKey = getPlanCompanyKey(plan);
                        const companyCardClass = styles[`eventCard_${companyKey}`] || styles.eventCard_ALL;
                        const capacity = Number(plan.participants || 0);
                        const enrolled = enrollments.filter(
                          (e) => e.planId === plan.rollingId && ACTIVE_ENROLLMENT_STATUSES.includes(e.status),
                        ).length;
                        const remaining = Math.max(0, capacity - enrolled);
                        const isWideMultiDay = isMultiDay && span > 1;

                        return (
                          <article
                            key={`${plan.rollingId}-w${weekIdx}-s${startCol}`}
                            className={`${styles.calendarEventCard} ${companyCardClass} ${
                              isWideMultiDay ? styles.multiDayEventCard : ""
                            }`}
                            style={{
                              gridColumn: `${startCol + 1} / span ${span}`,
                              gridRow: `${slot + 1}`,
                            }}
                            title={`${plan.course.name} (${plan.trainingDate}${plan.endDate && plan.endDate !== plan.trainingDate ? ` ถึง ${plan.endDate}` : ""})`}
                            onClick={() => {
                              setExpandedOverviewCourse(plan.rollingId);
                              const targetEl = document.getElementById(`course-overview-${plan.rollingId}`);
                              if (targetEl) {
                                targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
                              }
                            }}
                          >
                            {isWideMultiDay ? (
                              <>
                                <div className={styles.multiDayTitleGroup}>
                                  {isContinuationFromPrev ? (
                                    <span
                                      className={styles.eventSpanArrow}
                                      title={uiLang === "th" ? "ต่อเนื่องจากสัปดาห์ก่อน" : "Continued from previous week"}
                                    >
                                      ←
                                    </span>
                                  ) : null}
                                  <strong>{plan.course.name}</strong>
                                  <span className={styles.multiDayBadge}>
                                    {uiLang === "th" ? `${totalDays} วัน` : `${totalDays} Days`}
                                  </span>
                                  {continuesToNext ? (
                                    <span
                                      className={styles.eventSpanArrow}
                                      title={uiLang === "th" ? "ต่อเนื่องไปยังสัปดาห์ถัดไป" : "Continues next week"}
                                    >
                                      →
                                    </span>
                                  ) : null}
                                </div>
                                <div className={styles.multiDayMetaGroup}>
                                  <small>
                                    {plan.startTime}-{plan.endTime} / {formatRollingPlanCompanies(plan)}
                                  </small>
                                  {capacity > 0 ? (
                                    <span className={remaining > 0 ? styles.eventSeatBadge : styles.eventSeatBadgeFull}>
                                      {uiLang === "th"
                                        ? remaining > 0
                                          ? `เหลือ ${remaining}/${capacity} คน`
                                          : "เต็มแล้ว"
                                        : remaining > 0
                                          ? `${remaining}/${capacity} left`
                                          : "Full"}
                                    </span>
                                  ) : null}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className={styles.singleEventTitleRow}>
                                  {isContinuationFromPrev ? (
                                    <span
                                      className={styles.eventSpanArrow}
                                      title={uiLang === "th" ? "ต่อเนื่องจากสัปดาห์ก่อน" : "Continued from previous week"}
                                    >
                                      ←
                                    </span>
                                  ) : null}
                                  <strong>{plan.course.name}</strong>
                                  {continuesToNext ? (
                                    <span
                                      className={styles.eventSpanArrow}
                                      title={uiLang === "th" ? "ต่อเนื่องไปยังสัปดาห์ถัดไป" : "Continues next week"}
                                    >
                                      →
                                    </span>
                                  ) : null}
                                </div>
                                <small>
                                  {plan.startTime}-{plan.endTime} / {formatRollingPlanCompanies(plan)}
                                </small>
                                <div className={styles.singleEventMetaRow}>
                                  {isMultiDay ? (
                                    <span className={styles.multiDayBadge}>
                                      {uiLang === "th" ? `${totalDays} วัน` : `${totalDays}d`}
                                    </span>
                                  ) : null}
                                  {capacity > 0 ? (
                                    <span className={remaining > 0 ? styles.eventSeatBadge : styles.eventSeatBadgeFull}>
                                      {uiLang === "th"
                                        ? remaining > 0
                                          ? `เหลือ ${remaining}/${capacity} คน`
                                          : "เต็มแล้ว"
                                        : remaining > 0
                                          ? `${remaining}/${capacity} left`
                                          : "Full"}
                                    </span>
                                  ) : null}
                                </div>
                              </>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Course Overview Section */}
      {selectedMonth !== "all" ? (
        <section className={styles.courseOverview} aria-label="Monthly course overview">
          <header>
            <div>
              <h3>{uiLang === "th" ? "ภาพรวมคอร์สอบรมประจำเดือน" : "Monthly Course Overview"}</h3>
            </div>
            <span className={styles.headerMonthBadge}>
              {thMonthLabels[Number(selectedMonth) - 1] && uiLang === "th"
                ? monthOptions[Number(selectedMonth) - 1]?.label
                : displayedMonths[0]?.label}
            </span>
          </header>
          <div className={styles.courseOverviewList}>
            {selectedMonthDetail?.plans.length === 0 ? (
              <div className={styles.emptyCourseState}>
                {uiLang === "th" ? "ไม่มีกำหนดการอบรมในเดือนนี้" : "No training schedules found in this month"}
              </div>
            ) : (
              selectedMonthDetail?.plans.map((plan) => {
                const isExpanded = expandedOverviewCourse === plan.rollingId;
                const startDateStr = plan.trainingDate;
                const endDateStr = getPlanEndDate(plan);
                const isMultiDay = startDateStr !== endDateStr;
                const startDayNumber = Number(startDateStr.slice(8, 10));
                const endDayNumber = Number(endDateStr.slice(8, 10));
                const totalDays = getPlanDaysCount(startDateStr, endDateStr);
                const isEnded = plan.dbStatus === "COMPLETED" || (Boolean(endDateStr) && endDateStr < todayDate);
                const isFactoryPlanOfOtherCompany =
                  !isCenterUser &&
                  plan.ownerScope === "FACTORY" &&
                  Boolean(plan.ownerCompany) &&
                  Boolean(userCompanyCode) &&
                  plan.ownerCompany !== userCompanyCode;

                const dateBadgeLabel = isMultiDay
                  ? `${startDayNumber}-${endDayNumber}`
                  : startDayNumber;

                return (
                  <article
                    className={styles.courseDirectCard}
                    key={plan.rollingId}
                    id={`course-overview-${plan.rollingId}`}
                  >
                    <div className={styles.courseCardMain}>
                      <div className={styles.courseDateBadge}>
                        <strong>{dateBadgeLabel}</strong>
                        <span>
                          {uiLang === "th"
                            ? thMonthLabels[Number(selectedMonth) - 1]
                            : displayedMonths[0]?.shortLabel}
                        </span>
                        {isMultiDay ? (
                          <span className={styles.courseDaysSubBadge}>
                            {uiLang === "th" ? `${totalDays} วัน` : `${totalDays}d`}
                          </span>
                        ) : null}
                      </div>

                      <div className={styles.courseMetaInfo}>
                        <div className={styles.courseTitleRow}>
                          <h4>{plan.course.name}</h4>
                          <span className={styles.courseCodeTag}>{plan.course.code}</span>
                        </div>
                        <div className={styles.courseSubMeta}>
                          <span className={`${styles.metaChip} ${styles.metaChipTime}`}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <span className={styles.metaLabel}>{uiLang === "th" ? "เวลา:" : "Time:"}</span>
                            <span className={styles.metaValue}>{plan.startTime} - {plan.endTime}</span>
                          </span>
                          <span className={`${styles.metaChip} ${styles.metaChipCompany}`}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-3"/>
                            </svg>
                            <span className={styles.metaLabel}>{uiLang === "th" ? "ผู้เข้าอบรม:" : "Target:"}</span>
                            <span className={styles.metaValue}>{formatRollingPlanCompanies(plan)}</span>
                          </span>
                          <span className={`${styles.metaChip} ${styles.metaChipLocation}`}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span className={styles.metaLabel}>{uiLang === "th" ? "สถานที่:" : "Venue:"}</span>
                            <span className={styles.metaValue}>{plan.location || (uiLang === "th" ? "ไม่ได้ระบุ" : "N/A")}</span>
                          </span>
                          {plan.batch ? (
                            <span className={`${styles.metaChip} ${styles.metaChipBatch}`}>
                              <span className={styles.metaLabel}>{uiLang === "th" ? "รุ่น:" : "Batch:"}</span>
                              <span className={styles.metaValue}>{plan.batch}</span>
                            </span>
                          ) : null}
                          {(() => {
                            const capacity = Number(plan.participants || 0);
                            if (!capacity) return null;
                            const enrolled = enrollments.filter(e => e.planId === plan.rollingId && ACTIVE_ENROLLMENT_STATUSES.includes(e.status)).length;
                            const remaining = Math.max(0, capacity - enrolled);
                            return (
                              <span className={`${styles.metaChip} ${remaining > 0 ? styles.metaChipSeats : styles.metaChipSeatsFull}`}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                  <circle cx="9" cy="7" r="4" />
                                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                <span className={styles.metaLabel}>{uiLang === "th" ? "ที่นั่ง:" : "Seats:"}</span>
                                <span className={styles.metaValue}>
                                  {uiLang === "th"
                                    ? `ลงแล้ว ${enrolled}/${capacity} คน (${remaining > 0 ? `เหลือ ${remaining} ที่` : "เต็มแล้ว"})`
                                    : `Enrolled ${enrolled}/${capacity} (${remaining > 0 ? `${remaining} left` : "Full"})`}
                                </span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <div className={styles.courseCardActions}>
                        <span className={styles.targetGroupBadge}>{plan.course.courseGroup}</span>

                        {isEnded ? (
                          <button
                            type="button"
                            className={styles.endedBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push("/training-record");
                            }}
                            title={uiLang === "th" ? "หลักสูตรนี้จบไปแล้ว ดูข้อมูลและประวัติที่ Training Record" : "Course has completed. View in Training Record"}
                          >
                            <span>{uiLang === "th" ? "เสร็จสิ้นแล้ว" : "Completed"}</span>
                          </button>
                        ) : isFactoryPlanOfOtherCompany ? (
                          <span
                            className={styles.scopeRestrictedBadge}
                            title={uiLang === "th" ? `หลักสูตรภายในของโรงงาน ${plan.ownerCompany}` : `In-house course for ${plan.ownerCompany}`}
                          >
                            {uiLang === "th" ? `เฉพาะ ${plan.ownerCompany}` : `${plan.ownerCompany} Only`}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={styles.nominateBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/training-plan/training-accept-survey?courseId=${encodeURIComponent(plan.rollingId)}`);
                            }}
                            title={uiLang === "th" ? "ส่งคนเข้าอบรมใน Training Accept Survey" : "Nominate trainees in Training Accept Survey"}
                          >
                            <span>{uiLang === "th" ? "ส่งคนเข้าอบรม" : "Accept Survey"}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className={styles.toggleDetailBtn}
                          onClick={() =>
                            setExpandedOverviewCourse((current) =>
                              current === plan.rollingId ? "" : plan.rollingId,
                            )
                          }
                        >
                          <span>
                            {isExpanded
                              ? uiLang === "th"
                                ? "ซ่อนรายละเอียด"
                                : "Hide details"
                              : uiLang === "th"
                                ? "แสดงรายละเอียด"
                                : "Show details"}
                          </span>
                          <svg
                            style={{
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                            }}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className={styles.courseDetailPanel}>
                        {/* 1. สรุปข้อมูลสำคัญ (Logistics & Key Information) */}
                        <div className={styles.detailGrid}>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "รหัสหลักสูตร" : "Course Code"}</span>
                            <strong className={styles.detailValue}>{plan.course.code}</strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "กลุ่มหลักสูตร" : "Course Group"}</span>
                            <strong className={styles.detailValue}>{plan.course.courseGroup || "-"}</strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "ประเภทหลักสูตร" : "Course Type"}</span>
                            <strong className={styles.detailValue}>{plan.course.courseType || "-"}</strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "รุ่นที่ (Batch)" : "Batch"}</span>
                            <strong className={styles.detailValue}>{plan.batch || "-"}</strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "วันที่จัดอบรม" : "Training Dates"}</span>
                            <strong className={styles.detailValue}>
                              {plan.trainingDate}
                              {plan.endDate && plan.endDate !== plan.trainingDate ? ` ถึง ${plan.endDate}` : ""}
                            </strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "เวลาอบรม" : "Training Time"}</span>
                            <strong className={styles.detailValue}>
                              {plan.startTime} - {plan.endTime} {plan.hours ? `(${plan.hours} ชม.)` : ""}
                            </strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "สถานที่" : "Location"}</span>
                            <strong className={styles.detailValue}>{plan.location || (uiLang === "th" ? "ไม่ได้ระบุสถานที่" : "N/A")}</strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "จำนวนเป้าหมาย / เหลือ" : "Capacity & Remaining"}</span>
                            <strong className={styles.detailValue}>
                              {(() => {
                                const capacity = Number(plan.participants || 0);
                                if (!capacity) return "-";
                                const enrolled = enrollments.filter(e => e.planId === plan.rollingId && ACTIVE_ENROLLMENT_STATUSES.includes(e.status)).length;
                                const remaining = Math.max(0, capacity - enrolled);
                                return uiLang === "th"
                                  ? `รับ ${capacity} คน (ลงแล้ว ${enrolled} • ${remaining > 0 ? `เหลือ ${remaining} ที่` : "เต็มแล้ว"})`
                                  : `Capacity ${capacity} (${enrolled} enrolled • ${remaining > 0 ? `${remaining} left` : "Full"})`;
                              })()}
                            </strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "หน่วยงานผู้จัด" : "Organizer"}</span>
                            <strong className={styles.detailValue}>
                              {plan.ownerScope === "CENTER"
                                ? (uiLang === "th" ? "HRD Center (ส่วนกลาง)" : "HRD Center")
                                : `โรงงาน ${plan.ownerCompany || plan.company}`}
                            </strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "บริษัทเป้าหมาย" : "Target Companies"}</span>
                            <strong className={styles.detailValue}>{formatRollingPlanCompanies(plan)}</strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "วิทยากร" : "Trainer"}</span>
                            <strong className={styles.detailValue}>{plan.trainer || (uiLang === "th" ? "ไม่ได้ระบุ" : "-")}</strong>
                          </div>
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "สถาบันจัดอบรม" : "Provider"}</span>
                            <strong className={styles.detailValue}>{plan.provider || (uiLang === "th" ? "ไม่ได้ระบุ" : "-")}</strong>
                          </div>
                          {plan.budget ? (
                            <div className={styles.detailCard}>
                              <span className={styles.detailLabel}>{uiLang === "th" ? "งบประมาณรวม" : "Total Budget"}</span>
                              <strong className={styles.detailValue}>{Number(plan.budget).toLocaleString()} บาท</strong>
                            </div>
                          ) : null}
                          <div className={styles.detailCard}>
                            <span className={styles.detailLabel}>{uiLang === "th" ? "สถานะหลักสูตร" : "Status"}</span>
                            <strong className={styles.detailValue} style={{ color: isEnded ? "#64748b" : "#059669" }}>
                              {isEnded
                                ? (uiLang === "th" ? "เสร็จสิ้นแล้ว" : "Completed")
                                : (uiLang === "th" ? "เปิดรับสมัคร" : "Published")}
                            </strong>
                          </div>
                        </div>

                        {/* 2. วัตถุประสงค์และเนื้อหาหลักสูตร (Objectives & Learning Content) */}
                        {(plan.course.objective || plan.course.learningContent || plan.course.methodology) ? (
                          <div className={styles.detailSectionBlock}>
                            {plan.course.objective ? (
                              <div className={styles.detailTextBox}>
                                <h5>{uiLang === "th" ? "วัตถุประสงค์ของหลักสูตร" : "Course Objectives"}</h5>
                                <p>{plan.course.objective}</p>
                              </div>
                            ) : null}
                            {plan.course.learningContent ? (
                              <div className={styles.detailTextBox}>
                                <h5>{uiLang === "th" ? "เนื้อหาและหัวข้อการเรียนรู้" : "Learning Content & Outline"}</h5>
                                <p>{plan.course.learningContent}</p>
                              </div>
                            ) : null}
                            {plan.course.methodology ? (
                              <div className={styles.detailTextBox}>
                                <h5>{uiLang === "th" ? "วิธีการฝึกอบรม" : "Training Methodology"}</h5>
                                <p>{plan.course.methodology}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {/* 3. กลุ่มเป้าหมายและแบบทดสอบ/การวัดผล (Target Audience & Evaluations) */}
                        <div className={styles.detailTwoColumns}>
                          <div className={styles.detailColCard}>
                            <h5>{uiLang === "th" ? "กลุ่มเป้าหมายและตำแหน่งที่กำหนด" : "Target Audience & Criteria"}</h5>
                            <div className={styles.detailRowItem}>
                              <span>{uiLang === "th" ? "กลุ่มเป้าหมาย:" : "Target Group:"}</span>
                              <strong>{plan.course.targetGroup || (uiLang === "th" ? "พนักงานทั่วไป" : "General staff")}</strong>
                            </div>
                            {plan.course.targetLevels && plan.course.targetLevels.length > 0 ? (
                              <div className={styles.detailRowItem}>
                                <span>{uiLang === "th" ? "ระดับตำแหน่ง (Levels):" : "Target Levels:"}</span>
                                <div className={styles.tagWrap}>
                                  {plan.course.targetLevels.map((lvl) => (
                                    <span key={lvl} className={styles.smallTag}>{lvl}</span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {plan.course.targetPositions && plan.course.targetPositions.length > 0 ? (
                              <div className={styles.detailRowItem}>
                                <span>{uiLang === "th" ? "ตำแหน่ง (Positions):" : "Target Positions:"}</span>
                                <div className={styles.tagWrap}>
                                  {plan.course.targetPositions.map((pos) => (
                                    <span key={pos} className={styles.smallTag}>{pos}</span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className={styles.detailColCard}>
                            <h5>{uiLang === "th" ? "แบบทดสอบและการประเมินผล" : "Assessments & Evaluations"}</h5>
                            <div className={styles.assessmentList}>
                              <div className={styles.assessmentItem}>
                                <span>{uiLang === "th" ? "ก่อนอบรม (Pre-Test):" : "Pre-Test:"}</span>
                                <strong>{plan.course.preTest || (uiLang === "th" ? "ไม่มี" : "None")}</strong>
                              </div>
                              <div className={styles.assessmentItem}>
                                <span>{uiLang === "th" ? "หลังอบรม (Post-Test):" : "Post-Test:"}</span>
                                <strong>{plan.course.postTest || (uiLang === "th" ? "ไม่มี" : "None")}</strong>
                              </div>
                              <div className={styles.assessmentItem}>
                                <span>{uiLang === "th" ? "แบบประเมินผล (Evaluation):" : "Evaluation Form:"}</span>
                                <strong>{plan.course.evaluation || (uiLang === "th" ? "ไม่มี" : "None")}</strong>
                              </div>
                              <div className={styles.assessmentItem}>
                                <span>{uiLang === "th" ? "ติดตามผล 30 วัน:" : "30-Day Follow-up:"}</span>
                                <strong>{plan.course.evaluationAfter30Day || (uiLang === "th" ? "ไม่มี" : "None")}</strong>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 4. แถบ Action ด้านล่างของกล่องรายละเอียด */}
                        <div className={styles.detailFooterBar}>
                          <div className={styles.footerStatusChip}>
                            <span
                              className={styles.statusDot}
                              style={{ background: isEnded ? "#94a3b8" : "#10b981" }}
                            />
                            <span>
                              {isEnded
                                ? (uiLang === "th" ? "หลักสูตรนี้จัดเสร็จสิ้นแล้ว" : "Course has completed")
                                : isFactoryPlanOfOtherCompany
                                  ? (uiLang === "th" ? `หลักสูตรเฉพาะพนักงาน ${plan.ownerCompany}` : `In-house course for ${plan.ownerCompany}`)
                                  : (uiLang === "th" ? "หลักสูตรนี้กำลังเปิดรับสมัครผู้เข้าอบรม" : "Open for trainee nomination")}
                            </span>
                          </div>
                          <div>
                            {isEnded ? (
                              <button
                                type="button"
                                className={styles.endedBtn}
                                onClick={() => router.push("/training-record")}
                              >
                                <span>{uiLang === "th" ? "เสร็จสิ้นแล้ว" : "Completed"}</span>
                              </button>
                            ) : isFactoryPlanOfOtherCompany ? (
                              <span className={styles.scopeRestrictedBadge}>
                                {uiLang === "th" ? `เฉพาะ ${plan.ownerCompany}` : `${plan.ownerCompany} Only`}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={styles.nominateBtn}
                                onClick={() => router.push(`/training-plan/training-accept-survey?courseId=${encodeURIComponent(plan.rollingId)}`)}
                              >
                                <span>{uiLang === "th" ? "ส่งคนเข้าอบรม" : "Accept Survey"}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}
