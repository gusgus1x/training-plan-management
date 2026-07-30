"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  readWorkflowCollection,
  type WorkflowCompletedCourse,
} from "../../../../lib/trainingWorkflow";
import {
  profileValue,
  useAuthenticatedUser,
} from "../../../AuthenticatedUserContext";
import styles from "./SummaryDashboard.module.css";

export const summaryDashboardModule = {
  title: "Summary Dashboard",
  subtitle: "Training attendance overview",
  description:
    "View attended and absent participant totals from completed Training Actual records.",
} as const;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

const monthOptions = [
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

const getCoursePeriod = (course: WorkflowCompletedCourse) => {
  const dateMatch = course.date.match(/^(\d{4})[-/](\d{1,2})/);

  if (dateMatch) {
    return {
      year: dateMatch[1],
      month: dateMatch[2].padStart(2, "0"),
    };
  }

  const parsedDate = new Date(course.date);
  const fallbackDate = Number.isNaN(parsedDate.getTime())
    ? new Date(course.savedAt)
    : parsedDate;

  return {
    year: String(fallbackDate.getFullYear()),
    month: String(fallbackDate.getMonth() + 1).padStart(2, "0"),
  };
};

export default function SummaryDashboard() {
  const user = useAuthenticatedUser();
  const [completedCourses, setCompletedCourses] = useState<
    WorkflowCompletedCourse[]
  >([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const userCompanyCode = profileValue(user?.companyCode);

  useEffect(() => {
    const syncCompletedCourses = () => {
      setCompletedCourses(
        readWorkflowCollection<WorkflowCompletedCourse>(
          TRAINING_WORKFLOW_KEYS.completedCourses,
        ),
      );
    };

    syncCompletedCourses();
    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncCompletedCourses);
    return () =>
      window.removeEventListener(
        TRAINING_WORKFLOW_EVENT,
        syncCompletedCourses,
      );
  }, []);

  const availableYears = useMemo(
    () =>
      Array.from(
        new Set(
          completedCourses
            .filter(
              (course) =>
                !isFactoryUser ||
                course.attendees.some(
                  (attendee) => attendee.company === userCompanyCode,
                ) ||
                (course.owner === "FACTORY" &&
                  course.ownerCompany === userCompanyCode),
            )
            .map((course) => getCoursePeriod(course).year),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [completedCourses, isFactoryUser, userCompanyCode],
  );
  const activeYear =
    selectedYear ||
    availableYears[0] ||
    String(new Date().getFullYear());

  const summary = useMemo(() => {
    const scopedCourses = completedCourses
      .filter((course) => {
        const period = getCoursePeriod(course);

        return (
          period.year === activeYear &&
          (selectedMonth === "all" || period.month === selectedMonth)
        );
      })
      .map((course) => ({
        ...course,
        attendees: isFactoryUser
          ? course.attendees.filter(
              (attendee) => attendee.company === userCompanyCode,
            )
          : course.attendees,
      }))
      .filter(
        (course) =>
          !isFactoryUser ||
          course.attendees.length > 0 ||
          (course.owner === "FACTORY" &&
            course.ownerCompany === userCompanyCode),
      );
    const attendees = scopedCourses.flatMap((course) => course.attendees);
    const attended = attendees.filter((attendee) => attendee.attended).length;
    const absent = attendees.filter((attendee) => !attendee.attended).length;
    const total = attended + absent;
    const attendanceRate =
      total > 0 ? Math.round((attended / total) * 100) : 0;

    return {
      sessionCount: scopedCourses.length,
      attended,
      absent,
      total,
      attendanceRate,
    };
  }, [
    activeYear,
    completedCourses,
    isFactoryUser,
    selectedMonth,
    userCompanyCode,
  ]);

  const chartStyle = {
    "--attendance-angle": `${summary.attendanceRate * 3.6}deg`,
  } as CSSProperties;

  return (
    <section
      className={styles.moduleWorkspace}
      aria-label="Summary Dashboard module"
    >
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.kicker}>{summaryDashboardModule.subtitle}</p>
          <h2>{summaryDashboardModule.title}</h2>
          <p>{summaryDashboardModule.description}</p>
        </div>
        <span className={styles.scopeBadge}>
          {isFactoryUser ? userCompanyCode : "All Companies"}
        </span>
      </section>

      <section
        className={styles.attendancePanel}
        aria-label="Training attendance summary"
      >
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Completed Training Sessions</p>
            <h3>Training Attendance Summary</h3>
          </div>
          <div className={styles.panelHeaderActions}>
            <div className={styles.periodControls}>
              <label>
                Year
                <select
                  value={activeYear}
                  onChange={(event) => {
                    setSelectedYear(event.target.value);
                    setSelectedMonth("all");
                  }}
                >
                  {availableYears.length > 0 ? (
                    availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))
                  ) : (
                    <option value={activeYear}>{activeYear}</option>
                  )}
                </select>
              </label>
              <label>
                Month
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                >
                  <option value="all">All months</option>
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <strong>{formatNumber(summary.sessionCount)} sessions</strong>
          </div>
        </div>

        <div className={styles.summaryLayout}>
          <div className={styles.chartColumn}>
            <div
              className={`${styles.donutChart} ${
                summary.total === 0 ? styles.emptyChart : ""
              }`}
              style={chartStyle}
              role="img"
              aria-label={`Attended ${summary.attended}, did not attend ${summary.absent}`}
            >
              <div className={styles.chartCenter}>
                <strong>{formatNumber(summary.total)}</strong>
                <span>Recorded Participants</span>
              </div>
            </div>

            <div className={styles.legend} aria-label="Attendance chart legend">
              <span>
                <i className={styles.attendedDot} aria-hidden="true" />
                Attended
              </span>
              <span>
                <i className={styles.absentDot} aria-hidden="true" />
                Did Not Attend
              </span>
            </div>
          </div>

          <div className={styles.metricGrid}>
            <article className={styles.attendedMetric}>
              <span>Attended</span>
              <strong>{formatNumber(summary.attended)}</strong>
              <small>people</small>
            </article>
            <article className={styles.absentMetric}>
              <span>Did Not Attend</span>
              <strong>{formatNumber(summary.absent)}</strong>
              <small>people</small>
            </article>
            <article className={styles.rateMetric}>
              <span>Attendance Rate</span>
              <strong>{summary.attendanceRate}%</strong>
              <small>
                {formatNumber(summary.attended)} / {formatNumber(summary.total)}
              </small>
            </article>
          </div>
        </div>

        {summary.total === 0 ? (
          <p className={styles.emptyState}>
            No completed Training Actual records are available yet.
          </p>
        ) : null}
      </section>
    </section>
  );
}
