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
  isWorkflowOwner,
  readWorkflowCollection,
  writeWorkflowCollection,
} from "../../../../lib/trainingWorkflow";
import {
  buildCalendarYearOptions,
  getCurrentCalendarDate,
} from "../../../../lib/calendarDate";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import type { InternalReportDraft } from "./InternalReport";
import styles from "./ScheduleCalendar.module.css";

export const scheduleCalendarModule = {
  title: "Schedule calendar",
  subtitle: "Training schedule",
  description: "Show monthly training details from Training Rolling data",
} as const;

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
};

export default function ScheduleCalendar({ onPrepareEmail }: ScheduleCalendarProps = {}) {
  const user = useAuthenticatedUser();
  const [calendarToday] = useState(getCurrentCalendarDate);
  const [selectedYear, setSelectedYear] = useState(calendarToday.year);
  const [selectedMonth, setSelectedMonth] = useState<"all" | string>("all");
  const [expandedTrainingMonth, setExpandedTrainingMonth] = useState("");
  const [expandedOverviewMonth, setExpandedOverviewMonth] = useState("");
  const [expandedOverviewCourse, setExpandedOverviewCourse] = useState("");
  const [editingPlanId, setEditingPlanId] = useState("");
  const [editForm, setEditForm] = useState<ScheduleEditForm | null>(null);
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
  const editingPlan = schedulePlans.find((plan) => plan.rollingId === editingPlanId) ?? null;

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

  const handleEditPlan = (plan: RollingPlan) => {
    setEditingPlanId(plan.rollingId);
    setEditForm(buildEditForm(plan));
    setSelectedMonth(plan.trainingDate.slice(5, 7));
    setExpandedOverviewMonth(plan.trainingDate.slice(5, 7));
    setExpandedOverviewCourse(plan.rollingId);
  };

  const updateEditForm = <Key extends keyof ScheduleEditForm>(
    field: Key,
    value: ScheduleEditForm[Key],
  ) => {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleSaveEdit = () => {
    if (!editingPlanId || !editForm) return;

    const nextPlans = rollingPlans.map((plan) =>
      plan.rollingId === editingPlanId ? { ...plan, ...editForm } : plan,
    );
    setRollingPlans(nextPlans);
    writeWorkflowCollection(TRAINING_WORKFLOW_KEYS.rollingPlans, nextPlans);
    setSelectedMonth(editForm.trainingDate.slice(5, 7));
    setEditingPlanId("");
    setEditForm(null);
  };

  const handleCancelEdit = () => {
    setEditingPlanId("");
    setEditForm(null);
  };

  const handleShowCurrentMonth = () => {
    setSelectedYear(calendarToday.year);
    setSelectedMonth(calendarToday.month);
    setExpandedTrainingMonth("");
    setExpandedOverviewMonth(calendarToday.month);
  };

  return (
    <section className={styles.moduleWorkspace} aria-label="Schedule calendar module">
      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label>
            <span>Company</span>
            <select
              disabled={!isCenterUser}
              value={isCenterUser ? companyFilter : userCompanyCode}
              onChange={(event) => setCompanyFilter(event.target.value)}
            >
              <option value="all">
                {isCenterUser ? "All Companies" : `${userCompanyCode} + Center Courses`}
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
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {calendarYears.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </label>
          <div className={styles.yearNote}>
            <strong>{scheduleCount}</strong>
            <span>training schedules in {selectedYear}</span>
          </div>
          <button
            className={styles.todayButton}
            type="button"
            onClick={handleShowCurrentMonth}
          >
            Current month
          </button>
          <button
            className={styles.exportButton}
            disabled={exportPlans.length === 0}
            type="button"
            onClick={handleExportExcel}
          >
            Export Excel
          </button>
          <button
            className={styles.emailButton}
            disabled={exportPlans.length === 0}
            type="button"
            onClick={handlePrepareEmail}
          >
            Prepare Email
          </button>
        </div>

        {editingPlan && editForm ? (
          <section className={styles.scheduleEditPanel} aria-label="Edit selected training schedule">
            <div className={styles.editPanelHead}>
              <div>
                <p className={styles.panelKicker}>Edit schedule</p>
                <h3>{editingPlan.course.name}</h3>
                <span>{editingPlan.course.code} / {editingPlan.course.courseGroup}</span>
              </div>
              <button type="button" onClick={handleCancelEdit}>
                Close
              </button>
            </div>

            <div className={styles.scheduleEditForm}>
              <label>
                Date
                <input
                  type="date"
                  value={editForm.trainingDate}
                  onChange={(event) => updateEditForm("trainingDate", event.target.value)}
                />
              </label>
              <label>
                Start
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(event) => updateEditForm("startTime", event.target.value)}
                />
              </label>
              <label>
                End
                <input
                  type="time"
                  value={editForm.endTime}
                  onChange={(event) => updateEditForm("endTime", event.target.value)}
                />
              </label>
              <label>
                Location
                <input
                  value={editForm.location}
                  onChange={(event) => updateEditForm("location", event.target.value)}
                />
              </label>
              <label>
                Company
                <input
                  value={editForm.company}
                  onChange={(event) => updateEditForm("company", event.target.value)}
                />
              </label>
              <label>
                Trainer
                <input
                  value={editForm.trainer}
                  onChange={(event) => updateEditForm("trainer", event.target.value)}
                />
              </label>
              <label>
                Batch
                <input
                  value={editForm.batch}
                  onChange={(event) => updateEditForm("batch", event.target.value)}
                />
              </label>
              <label>
                Status
                <select
                  value={editForm.status}
                  onChange={(event) =>
                    updateEditForm("status", event.target.value as ScheduleEditForm["status"])
                  }
                >
                  <option>Planning</option>
                  <option>Planned</option>
                </select>
              </label>
              <button className={styles.saveEditButton} type="button" onClick={handleSaveEdit}>
                Save changes
              </button>
            </div>
          </section>
        ) : null}

        <div className={styles.monthTabs} aria-label="Select schedule month">
          <button
            className={selectedMonth === "all" ? styles.activeMonth : ""}
            type="button"
            onClick={() => setSelectedMonth("all")}
          >
            All Year
          </button>
          {calendarMonths.map((month) => {
            const planCount = monthSummaries.find((item) => item.value === month.value)?.plans.length ?? 0;

            return (
              <button
                className={`${selectedMonth === month.value ? styles.activeMonth : ""} ${selectedYear === calendarToday.year && month.value === calendarToday.month ? styles.currentMonthTab : ""}`}
                key={month.value}
                type="button"
                onClick={() => setSelectedMonth(month.value)}
              >
                <strong>{month.shortLabel}</strong>
                <span>{planCount}</span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedMonth === "all" ? (
        <section className={styles.monthGrid} aria-label={`${selectedYear} monthly training detail`}>
          {displayedMonths.map((month) => (
            <article className={`${styles.monthCard} ${month.plans.length > 0 ? styles.hasPlans : ""} ${selectedYear === calendarToday.year && month.value === calendarToday.month ? styles.currentMonthCard : ""}`} key={month.value}>
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
                    {cell.plans.length > 0 ? <small>{cell.plans.length}</small> : null}
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
          <header>
            <div>
              <p className={styles.panelKicker}>Monthly calendar</p>
              <h3>{selectedMonthDetail?.label} {selectedYear}</h3>
            </div>
            <span>{selectedMonthDetail?.plans.length ?? 0} schedules</span>
          </header>
          <div className={styles.calendarGrid}>
            {weekDays.map((day) => (
              <b key={day}>{day}</b>
            ))}
            {calendarCells.map((cell, index) => (
              <div
                className={`${styles.calendarDay} ${cell.day ? "" : styles.blankDay} ${
                  cell.plans.length > 0 ? styles.trainingDay : ""
                } ${cell.date === todayDate ? styles.todayCalendarDay : ""}`}
                key={`${cell.date || "blank"}-${index}`}
              >
                {cell.day ? (
                  <>
                    <span className={styles.dayNumber}>{cell.day}</span>
                    <div className={styles.calendarEvents}>
                      {cell.plans.map((plan) => (
                        <article
                          className={`${styles.calendarEvent} ${
                            editingPlanId === plan.rollingId ? styles.editingCalendarEvent : ""
                          }`}
                          key={plan.rollingId}
                        >
                          <strong>{plan.course.name}</strong>
                          <small>{plan.startTime}-{plan.endTime} / {formatRollingPlanCompanies(plan)}</small>
                          <button type="button" onClick={() => handleEditPlan(plan)}>
                            Edit
                          </button>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedMonth !== "all" ? (
        <section className={styles.courseOverview} aria-label="Monthly course overview">
          <header>
            <div>
              <p className={styles.panelKicker}>Course overview</p>
              <h3>What training is available</h3>
            </div>
            <span>{displayedMonths[0]?.label}</span>
          </header>
          <div className={styles.courseOverviewList}>
            {displayedMonths.map((month) => {
              const firstPlan = month.plans[0];
              const isOpen = expandedOverviewMonth === month.value;

              return (
                <article className={styles.overviewRow} key={month.value}>
                <div className={styles.overviewSummary}>
                  <div className={styles.monthBadge}>
                    <strong>{month.shortLabel}</strong>
                    <span>{selectedYear}</span>
                  </div>
                  <div className={styles.overviewTitle}>
                    <strong>{month.label}</strong>
                    <span>{firstPlan ? firstPlan.course.name : "No schedule"}</span>
                  </div>
                  <button
                    disabled={month.plans.length === 0}
                    type="button"
                    onClick={() => setExpandedOverviewMonth((current) => (current === month.value ? "" : month.value))}
                  >
                    {isOpen ? "Hide details" : "Show details"}
                  </button>
                </div>
                {isOpen ? (
                  <ul className={styles.overviewDetails}>
                    {month.plans.map((plan) => (
                      <li
                        className={editingPlanId === plan.rollingId ? styles.selectedOverviewDetail : ""}
                        key={plan.rollingId}
                      >
                        <time dateTime={plan.trainingDate}>{Number(plan.trainingDate.slice(8, 10))}</time>
                        <div>
                          <span>{plan.course.name}</span>
                          <small>{plan.startTime}-{plan.endTime} / {formatRollingPlanCompanies(plan)}</small>
                        </div>
                        <strong>{plan.course.courseGroup}</strong>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedOverviewCourse((current) =>
                              current === plan.rollingId ? "" : plan.rollingId,
                            )
                          }
                        >
                          {expandedOverviewCourse === plan.rollingId ? "Hide details" : "Show details"}
                        </button>
                        <button
                          className={styles.editScheduleButton}
                          type="button"
                          onClick={() => handleEditPlan(plan)}
                        >
                          Edit
                        </button>
                        {expandedOverviewCourse === plan.rollingId ? (
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
                              <dd>{plan.startTime}-{plan.endTime}</dd>
                            </div>
                            <div>
                              <dt>Company</dt>
                              <dd>{formatRollingPlanCompanies(plan)}</dd>
                            </div>
                            <div>
                              <dt>Trainer</dt>
                              <dd>{plan.trainer}</dd>
                            </div>
                            <div>
                              <dt>Batch</dt>
                              <dd>{plan.batch}</dd>
                            </div>
                          </dl>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}
