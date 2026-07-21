"use client";

import { useMemo, useState } from "react";
import {
  initialRollingPlans,
  monthOptions,
  type RollingPlan,
  yearOptions,
} from "../../TrainingPlanManagement/modules/TrainingRolling";
import styles from "./ScheduleCalendar.module.css";

export const scheduleCalendarModule = {
  title: "Schedule calendar",
  subtitle: "Training schedule",
  description: "แสดงรายละเอียดการอบรมรายเดือนจากข้อมูล Training Rolling",
} as const;

const calendarMonths = monthOptions.map((month) => ({
  ...month,
  shortLabel: month.label.slice(0, 3),
}));

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const mockCourseTemplates = [
  {
    code: "CRS-101",
    name: "Leadership Essentials",
    group: "Management",
    company: "ATFB",
    time: ["09:00", "16:00"],
  },
  {
    code: "CRS-122",
    name: "Safety Awareness",
    group: "Safety",
    company: "SNF",
    time: ["10:00", "12:00"],
  },
  {
    code: "CRS-141",
    name: "Quality Control Basics",
    group: "Quality",
    company: "SATI",
    time: ["13:00", "16:00"],
  },
  {
    code: "CRS-165",
    name: "Excel for Workplace",
    group: "Digital Skill",
    company: "NIC",
    time: ["09:00", "12:00"],
  },
  {
    code: "CRS-188",
    name: "First Aid & Emergency Response",
    group: "Safety",
    company: "TEP",
    time: ["13:30", "16:30"],
  },
] as const;

const createMockRollingPlans = (year: string) => {
  const mockPlans: RollingPlan[] = [];

  calendarMonths.forEach((month) => {
    const existingPlanCount = initialRollingPlans.filter(
      (plan) => plan.trainingDate.startsWith(`${year}-${month.value}`),
    ).length;
    const missingPlanCount = Math.max(5 - existingPlanCount, 0);

    for (let index = 0; index < missingPlanCount; index += 1) {
      const course = mockCourseTemplates[index % mockCourseTemplates.length];
      const day = String(4 + index * 5).padStart(2, "0");

      mockPlans.push({
        rollingId: `mock-${year}-${month.value}-${index + 1}`,
        sequence: index + 1,
        id: `mock-oap-${month.value}-${index + 1}`,
        participants: String(18 + index * 4),
        hours: index % 2 === 0 ? "3" : "6",
        budget: String(18000 + index * 4500),
        trainer: "HRD Center",
        provider: "Internal Trainer",
        owner: "admin.hrd",
        batch: `${index + 1}/${year}`,
        location: course.company,
        trainingDate: `${year}-${month.value}-${day}`,
        startTime: course.time[0],
        endTime: course.time[1],
        company: course.company,
        status: index % 2 === 0 ? "Planned" : "Planning",
        updatedAt: `${year}-${month.value}-01`,
        course: {
          code: course.code,
          name: course.name,
          objective: `Mock-up schedule for ${course.name}.`,
          learningContent: `${course.group} learning content.`,
          targetGroup: "All related employees",
          methodology: "Classroom",
          preTest: "Pre test",
          postTest: "Post test",
          evaluation: "Course evaluation",
          evaluationAfter30Day: "Supervisor follow-up",
          lifeCycleMonth: "12",
          courseType: "IN-HOUSE",
          courseGroup: course.group,
        },
      });
    }
  });

  return mockPlans;
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
      plans: plans.filter((plan) => plan.trainingDate === date),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: "", day: null, plans: [] });
  }

  return cells;
};

export default function ScheduleCalendar() {
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedMonth, setSelectedMonth] = useState<"all" | string>("all");
  const [expandedTrainingMonth, setExpandedTrainingMonth] = useState("");
  const [expandedOverviewMonth, setExpandedOverviewMonth] = useState("");
  const [expandedOverviewCourse, setExpandedOverviewCourse] = useState("");

  const schedulePlans = useMemo(
    () =>
      [...initialRollingPlans, ...createMockRollingPlans(selectedYear)].sort((a, b) =>
        a.trainingDate.localeCompare(b.trainingDate),
      ),
    [selectedYear],
  );

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
      company: plan.company,
    })),
  );

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

  return (
    <section className={styles.moduleWorkspace} aria-label="Schedule calendar module">
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{scheduleCalendarModule.subtitle}</p>
          <h2>{scheduleCalendarModule.title}</h2>
          <p>{scheduleCalendarModule.description}</p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label>
            <span>Year</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {yearOptions.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </label>
          <div className={styles.yearNote}>
            <strong>{scheduleCount}</strong>
            <span>training schedules in {selectedYear}</span>
          </div>
          <button
            className={styles.exportButton}
            disabled={exportPlans.length === 0}
            type="button"
            onClick={handleExportExcel}
          >
            Export Excel
          </button>
        </div>

        <div className={styles.monthTabs} aria-label="Select schedule month">
          <button
            className={selectedMonth === "all" ? styles.activeMonth : ""}
            type="button"
            onClick={() => setSelectedMonth("all")}
          >
            All year
          </button>
          {calendarMonths.map((month) => {
            const planCount = monthSummaries.find((item) => item.value === month.value)?.plans.length ?? 0;

            return (
              <button
                className={selectedMonth === month.value ? styles.activeMonth : ""}
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
            <article className={`${styles.monthCard} ${month.plans.length > 0 ? styles.hasPlans : ""}`} key={month.value}>
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
                    }`}
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
                }`}
                key={`${cell.date || "blank"}-${index}`}
              >
                {cell.day ? (
                  <>
                    <span className={styles.dayNumber}>{cell.day}</span>
                    <div className={styles.calendarEvents}>
                      {cell.plans.map((plan) => (
                        <article className={styles.calendarEvent} key={plan.rollingId}>
                          <strong>{plan.course.name}</strong>
                          <small>{plan.startTime}-{plan.endTime} / {plan.company}</small>
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

      <section className={styles.courseOverview} aria-label="Monthly course overview">
        <header>
          <div>
            <p className={styles.panelKicker}>Course overview</p>
            <h3>มีอบรมอะไรบ้าง</h3>
          </div>
          <span>{selectedMonth === "all" ? selectedYear : displayedMonths[0]?.label}</span>
        </header>
        <div className={styles.courseOverviewList}>
          {displayedMonths.map((month) => {
            const firstPlan = month.plans[0];
            const lastPlan = month.plans.at(-1);
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
                  <div className={styles.overviewMeta}>
                    <span>{month.plans.length} courses</span>
                    <span>
                      {firstPlan && lastPlan
                        ? `${Number(firstPlan.trainingDate.slice(8, 10))}-${Number(lastPlan.trainingDate.slice(8, 10))} ${month.shortLabel}`
                        : "No schedule"}
                    </span>
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
                      <li key={plan.rollingId}>
                        <time dateTime={plan.trainingDate}>{Number(plan.trainingDate.slice(8, 10))}</time>
                        <div>
                          <span>{plan.course.name}</span>
                          <small>{plan.startTime}-{plan.endTime} / {plan.company}</small>
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
                              <dd>{plan.company}</dd>
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
    </section>
  );
}
