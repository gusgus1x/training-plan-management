"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatRollingPlanCompanies,
  getRollingPlanCompanies,
  monthOptions,
  type RollingPlan,
} from "../../TrainingPlanManagement/modules/TrainingRolling";
import {
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  readWorkflowCollection,
  writeWorkflowCollection,
} from "../../../../lib/trainingWorkflow";
import {
  buildCalendarYearOptions,
  getCurrentCalendarDate,
} from "../../../../lib/calendarDate";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import type { InternalReportDraft } from "./InternalReport";
import styles from "./ScheduleCalendar.module.css";

export const scheduleCalendarModule = {
  title: "Schedule Calendar",
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
      plans: plans.filter((plan) => plan.trainingDate === date),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: "", day: null, plans: [] });
  }

  return cells;
};

type ScheduleEditForm = Pick<
  RollingPlan,
  "batch" | "company" | "endTime" | "location" | "startTime" | "status" | "trainer" | "trainingDate"
>;

const buildEditForm = (plan: RollingPlan): ScheduleEditForm => ({
  batch: plan.batch,
  company: plan.company,
  endTime: plan.endTime,
  location: plan.location,
  startTime: plan.startTime,
  status: plan.status,
  trainer: plan.trainer,
  trainingDate: plan.trainingDate,
});

type ScheduleCalendarProps = {
  onPrepareEmail?: (draft: InternalReportDraft) => void;
  initialYear?: string;
  initialMonth?: string;
};

export default function ScheduleCalendar({
  onPrepareEmail,
  initialYear,
  initialMonth,
}: ScheduleCalendarProps = {}) {
  const user = useAuthenticatedUser();
  const { language: uiLang } = useUiLanguage();
  const [calendarToday] = useState(getCurrentCalendarDate);
  const [selectedYear, setSelectedYear] = useState(() => initialYear || calendarToday.year);
  const [selectedMonth, setSelectedMonth] = useState<"all" | string>(() => initialMonth || "all");
  const [expandedTrainingMonth, setExpandedTrainingMonth] = useState("");
  const [expandedOverviewMonth, setExpandedOverviewMonth] = useState("");
  const [expandedOverviewCourse, setExpandedOverviewCourse] = useState("");
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const isCenterUser = user?.roleCode === "HRD_CENTER";
  const userCompanyCode = profileValue(user?.companyCode);

  useEffect(() => {
    const syncRollingPlans = () => {
      setRollingPlans(
        readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
      );
    };

    syncRollingPlans();
    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncRollingPlans);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncRollingPlans);
  }, []);

  const schedulePlans = useMemo(
    () =>
      rollingPlans
        .filter((plan) => {
          const planCompanies = getRollingPlanCompanies(plan);
          const isCenterPlan =
            plan.ownerScope === "CENTER" ||
            plan.ownerCompany === "HRD Center" ||
            plan.provider === "HRD Center" ||
            plan.owner === "admin.hrd";

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
        rollingPlans.map((plan) => plan.trainingDate),
      ),
    [calendarToday.year, rollingPlans],
  );
  const todayDate = `${calendarToday.year}-${calendarToday.month}-${String(calendarToday.day).padStart(2, "0")}`;

  const monthSummaries = useMemo(
    () =>
      calendarMonths.map((month) => ({
        ...month,
        plans: schedulePlans
          .filter(
            (plan) =>
              plan.trainingDate.startsWith(selectedYear) &&
              plan.trainingDate.slice(5, 7) === month.value,
          )
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
  const scheduleCount = monthSummaries.reduce((sum, month) => sum + month.plans.length, 0);
  const exportPlans = displayedMonths.flatMap((month) =>
    month.plans.map((plan) => ({
      month: month.label,
      date: plan.trainingDate,
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

  const handlePrepareEmail = () => {
    if (exportPlans.length === 0) {
      return;
    }

    const scheduleLines = exportPlans
      .slice(0, 8)
      .map((plan) => `${plan.date} ${plan.time} - ${plan.courseName} (${plan.company})`);
    const remainingCount = exportPlans.length - scheduleLines.length;
    const summary = [
      `Training schedule for ${emailPeriodLabel}.`,
      `Total schedules: ${exportPlans.length}.`,
      ...scheduleLines,
      remainingCount > 0 ? `And ${remainingCount} more schedules.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    onPrepareEmail?.({
      subject: `Training schedule: ${emailPeriodLabel}`,
      reportType: "Training Plan Progress",
      recipientType: "Company",
      recipientTarget: emailCompanyScope,
      recipientGroup: "Factory HR",
      companyScope: emailCompanyScope,
      period: emailSendDate,
      dueDate: emailDueDate,
      summary,
    });
  };

  const handleShowCurrentMonth = () => {
    setSelectedYear(calendarToday.year);
    setSelectedMonth(calendarToday.month);
    setExpandedTrainingMonth("");
    setExpandedOverviewMonth(calendarToday.month);
  };

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
            <button
              className={styles.emailButton}
              disabled={exportPlans.length === 0}
              type="button"
              onClick={handlePrepareEmail}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span>{uiLang === "th" ? "เตรียมอีเมล" : "Prepare Email"}</span>
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
                  {month.plans.map((plan) => (
                    <div key={plan.rollingId}>
                      <time dateTime={plan.trainingDate}>{Number(plan.trainingDate.slice(8, 10))}</time>
                      <span>{plan.course.name}</span>
                    </div>
                  ))}
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

          <div className={styles.calendarGrid}>
            {weekDays.map((day, idx) => (
              <div
                className={`${styles.calendarWeekHeader} ${idx === 0 || idx === 6 ? styles.weekendHeader : ""}`}
                key={day}
              >
                {day}
              </div>
            ))}
            {calendarCells.map((cell, index) => {
              const isWeekend = index % 7 === 0 || index % 7 === 6;
              return (
                <div
                  className={`${styles.calendarDayCell} ${cell.day ? "" : styles.blankDayCell} ${
                    isWeekend ? styles.weekendDayCell : ""
                  } ${cell.date === todayDate ? styles.todayDayCell : ""}`}
                  key={`${cell.date || "blank"}-${index}`}
                >
                {cell.day ? (
                  <>
                    <span className={styles.dayNumber}>{cell.day}</span>
                    <div className={styles.calendarEventsList}>
                      {cell.plans.map((plan) => (
                        <article
                          className={styles.calendarEventCard}
                          key={plan.rollingId}
                        >
                          <strong>{plan.course.name}</strong>
                          <small>{plan.startTime}-{plan.endTime} / {formatRollingPlanCompanies(plan)}</small>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
          </div>
        </section>
      )}

      {/* 6. Course Overview Section */}
      {selectedMonth !== "all" ? (
        <section className={styles.courseOverview} aria-label="Monthly course overview">
          <header>
            <div>
              <h3>Monthly Course Overview</h3>
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
                const dayNumber = Number(plan.trainingDate.slice(8, 10));

                return (
                  <article className={styles.courseDirectCard} key={plan.rollingId}>
                    <div className={styles.courseCardMain}>
                      <div className={styles.courseDateBadge}>
                        <strong>{dayNumber}</strong>
                        <span>
                          {uiLang === "th"
                            ? thMonthLabels[Number(selectedMonth) - 1]
                            : displayedMonths[0]?.shortLabel}
                        </span>
                      </div>

                      <div className={styles.courseMetaInfo}>
                        <div className={styles.courseTitleRow}>
                          <h4>{plan.course.name}</h4>
                          <span className={styles.courseCodeTag}>{plan.course.code}</span>
                        </div>
                        <p className={styles.courseSubMeta}>
                          <span className={styles.metaItem}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                            {plan.startTime} - {plan.endTime}
                          </span>
                          <span className={styles.metaDot}>•</span>
                          <span className={styles.metaItem}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-3"/>
                            </svg>
                            {formatRollingPlanCompanies(plan)}
                          </span>
                          <span className={styles.metaDot}>•</span>
                          <span className={styles.metaItem}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                            {plan.location || (uiLang === "th" ? "ไม่ได้ระบุสถานที่" : "N/A")}
                          </span>
                        </p>
                      </div>

                      <div className={styles.courseCardActions}>
                        <span className={styles.targetGroupBadge}>{plan.course.courseGroup}</span>
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
                      <dl className={styles.courseDetailPanel}>
                        <div>
                          <dt>Course Code</dt>
                          <dd>{plan.course.code}</dd>
                        </div>
                        <div>
                          <dt>Course Group</dt>
                          <dd>{plan.course.courseGroup}</dd>
                        </div>
                        <div>
                          <dt>Time</dt>
                          <dd>{plan.startTime} - {plan.endTime}</dd>
                        </div>
                        <div>
                          <dt>Company</dt>
                          <dd>{formatRollingPlanCompanies(plan)}</dd>
                        </div>
                        <div>
                          <dt>Trainer</dt>
                          <dd>{plan.trainer || "-"}</dd>
                        </div>
                        <div>
                          <dt>Batch</dt>
                          <dd>{plan.batch || "-"}</dd>
                        </div>
                        <div>
                          <dt>Location</dt>
                          <dd>{plan.location || "-"}</dd>
                        </div>
                        <div>
                          <dt>Status</dt>
                          <dd>{plan.status}</dd>
                        </div>
                      </dl>
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
