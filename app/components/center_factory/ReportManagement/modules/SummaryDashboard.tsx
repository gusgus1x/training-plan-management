"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  readWorkflowCollection,
  type WorkflowAcceptance,
  type WorkflowCompletedCourse,
} from "../../../../lib/trainingWorkflow";
import {
  buildFactoryCenterFunding,
  buildFinanceSummary,
} from "../../../../lib/trainingFinanceSummary";
import {
  profileValue,
  useAuthenticatedUser,
} from "../../../AuthenticatedUserContext";
import {
  getRollingPlanCompanies,
  type RollingPlan,
} from "../../TrainingPlanManagement/modules/TrainingRolling";
import styles from "./SummaryDashboard.module.css";

export const summaryDashboardModule = {
  title: "Summary Dashboard",
  subtitle: "Budget, expense & attendance overview",
  description:
    "Monitor course budgets, actual spending, remaining funds, and completed training attendance in one place.",
} as const;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);

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

const getYear = (date: string, fallbackDate = "") => {
  const match = date.match(/^(\d{4})/);
  if (match) {
    return match[1];
  }

  const parsedDate = new Date(date || fallbackDate);
  return Number.isNaN(parsedDate.getTime())
    ? ""
    : String(parsedDate.getFullYear());
};

const getRollingOwner = (plan: RollingPlan) =>
  plan.ownerScope ?? (plan.owner === "admin.hrd" ? "CENTER" : "FACTORY");

const statusLabel = {
  Planned: "Planned",
  Completed: "Completed",
  "Over budget": "Over budget",
} as const;

export default function SummaryDashboard() {
  const user = useAuthenticatedUser();
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [completedCourses, setCompletedCourses] = useState<
    WorkflowCompletedCourse[]
  >([]);
  const [acceptances, setAcceptances] = useState<WorkflowAcceptance[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const role = isFactoryUser ? "FACTORY" : "CENTER";
  const userCompanyCode = profileValue(user?.companyCode);

  useEffect(() => {
    const syncDashboard = () => {
      setRollingPlans(
        readWorkflowCollection<RollingPlan>(
          TRAINING_WORKFLOW_KEYS.rollingPlans,
        ),
      );
      setCompletedCourses(
        readWorkflowCollection<WorkflowCompletedCourse>(
          TRAINING_WORKFLOW_KEYS.completedCourses,
        ),
      );
      setAcceptances(
        readWorkflowCollection<WorkflowAcceptance>(
          TRAINING_WORKFLOW_KEYS.acceptances,
        ),
      );
    };

    syncDashboard();
    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncDashboard);
    return () =>
      window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncDashboard);
  }, []);

  const relevantRollingPlans = useMemo(
    () =>
      rollingPlans.filter((plan) => {
        const owner = getRollingOwner(plan);
        if (!isFactoryUser) {
          return owner === "CENTER";
        }

        const ownsFactoryCourse =
          owner === "FACTORY" &&
          (plan.ownerCompany ?? plan.company) === userCompanyCode;
        const isRelatedCenterCourse =
          owner === "CENTER" &&
          (getRollingPlanCompanies(plan).includes(userCompanyCode) ||
            acceptances.some(
              (acceptance) =>
                acceptance.courseId === plan.rollingId &&
                acceptance.company === userCompanyCode,
            ));

        return ownsFactoryCourse || isRelatedCenterCourse;
      }),
    [acceptances, isFactoryUser, rollingPlans, userCompanyCode],
  );

  const relevantCompletedCourses = useMemo(
    () =>
      completedCourses.filter((course) =>
        isFactoryUser
          ? (course.owner === "FACTORY" &&
              (course.ownerCompany ?? course.company) === userCompanyCode) ||
            (course.owner === "CENTER" &&
              course.attendees.some(
                (attendee) => attendee.company === userCompanyCode,
              ))
          : course.owner === "CENTER",
      ),
    [completedCourses, isFactoryUser, userCompanyCode],
  );

  const availableYears = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...relevantRollingPlans.map((plan) =>
              getYear(plan.trainingDate),
            ),
            ...relevantCompletedCourses.map((course) =>
              getYear(course.date, course.savedAt),
            ),
          ].filter(Boolean),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [relevantCompletedCourses, relevantRollingPlans],
  );
  const activeYear =
    selectedYear ||
    availableYears[0] ||
    String(new Date().getFullYear());

  const summary = useMemo(
    () =>
      buildFinanceSummary({
        rollingPlans,
        completedCourses,
        role,
        companyCode: userCompanyCode,
        year: activeYear,
        month: selectedMonth,
      }),
    [
      activeYear,
      completedCourses,
      role,
      rollingPlans,
      selectedMonth,
      userCompanyCode,
    ],
  );

  const factoryCenterFunding = useMemo(
    () =>
      isFactoryUser
        ? buildFactoryCenterFunding({
            rollingPlans,
            completedCourses,
            acceptances,
            companyCode: userCompanyCode,
            year: activeYear,
            month: selectedMonth,
          })
        : [],
    [
      acceptances,
      activeYear,
      completedCourses,
      isFactoryUser,
      rollingPlans,
      selectedMonth,
      userCompanyCode,
    ],
  );

  const fundingSummary = useMemo(
    () => ({
      courses: factoryCenterFunding.length,
      allocated: factoryCenterFunding.reduce(
        (total, row) => total + row.allocatedBudget,
        0,
      ),
      actual: factoryCenterFunding.reduce(
        (total, row) => total + row.actualShare,
        0,
      ),
    }),
    [factoryCenterFunding],
  );

  const chartStyle = {
    "--attendance-angle": `${summary.attendanceRate * 3.6}deg`,
  } as CSSProperties;
  const budgetStyle = {
    "--budget-used": `${Math.min(summary.utilizationRate, 100)}%`,
  } as CSSProperties;

  return (
    <section
      className={styles.moduleWorkspace}
      aria-label="Summary Dashboard module"
    >
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.kicker}>{summaryDashboardModule.subtitle}</p>
          <h2>Financial & Attendance Overview</h2>
          <p>{summaryDashboardModule.description}</p>
        </div>
        <span className={styles.scopeBadge}>
          {isFactoryUser ? userCompanyCode : "HRD Center"}
        </span>
      </section>

      <section
        className={styles.financialOverview}
        aria-label="Budget and expense overview"
      >
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Financial overview</p>
            <h3>Course Budget & Expense Summary</h3>
          </div>
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
        </div>

        <div className={styles.financeMetricGrid}>
          <article className={styles.courseMetric}>
            <span>Total Courses</span>
            <strong>{formatNumber(summary.courseCount)}</strong>
            <small>{formatNumber(summary.sessionCount)} training sessions</small>
          </article>
          <article className={styles.budgetMetric}>
            <span>Total Planned Budget</span>
            <strong>THB {formatCurrency(summary.totalBudget)}</strong>
            <small>Approved course budget</small>
          </article>
          <article className={styles.actualMetric}>
            <span>Total Actual Spent</span>
            <strong>THB {formatCurrency(summary.totalActual)}</strong>
            <small>Saved from Training Actual</small>
          </article>
          <article
            className={
              summary.remainingBudget < 0
                ? styles.overBudgetMetric
                : styles.remainingMetric
            }
          >
            <span>Remaining Budget</span>
            <strong>
              THB {formatCurrency(summary.remainingBudget)}
            </strong>
            <small>
              {summary.remainingBudget < 0
                ? "Budget exceeded"
                : "Available balance"}
            </small>
          </article>
        </div>

        <div className={styles.budgetUtilization}>
          <div>
            <span>Budget utilization</span>
            <strong>{summary.utilizationRate}%</strong>
          </div>
          <div
            className={styles.progressTrack}
            style={budgetStyle}
            role="progressbar"
            aria-label="Budget utilization"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(summary.utilizationRate, 100)}
          >
            <span />
          </div>
        </div>
      </section>

      {isFactoryUser ? (
        <section
          className={styles.centerFundingPanel}
          aria-label="Factory budget allocation for Center courses"
        >
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Factory to Center</p>
              <h3>Company Budget Share for Center Courses</h3>
              <span className={styles.panelDescription}>
                Center courses submitted by your company and their calculated
                budget share.
              </span>
            </div>
            <strong>{fundingSummary.courses} courses</strong>
          </div>

          <div className={styles.fundingTotals}>
            <article>
              <span>Allocated Company Budget</span>
              <strong>THB {formatCurrency(fundingSummary.allocated)}</strong>
            </article>
            <article>
              <span>Estimated Actual Share</span>
              <strong>THB {formatCurrency(fundingSummary.actual)}</strong>
            </article>
            <article>
              <span>Remaining Company Share</span>
              <strong
                className={
                  fundingSummary.allocated - fundingSummary.actual < 0
                    ? styles.negativeValue
                    : undefined
                }
              >
                THB{" "}
                {formatCurrency(
                  fundingSummary.allocated - fundingSummary.actual,
                )}
              </strong>
            </article>
          </div>

          {factoryCenterFunding.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.financeTable}>
                <thead>
                  <tr>
                    <th>Center Course</th>
                    <th>Submitted / Approved</th>
                    <th>Center Budget</th>
                    <th>Company Budget Share</th>
                    <th>Actual Share</th>
                    <th>Calculation</th>
                  </tr>
                </thead>
                <tbody>
                  {factoryCenterFunding.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.code}</strong>
                        <span>{row.title}</span>
                        <small>
                          {row.date} · {row.sessions} sessions
                        </small>
                      </td>
                      <td>
                        {row.submitted} / {row.approved}
                      </td>
                      <td>THB {formatCurrency(row.centerBudget)}</td>
                      <td className={styles.allocatedValue}>
                        THB {formatCurrency(row.allocatedBudget)}
                      </td>
                      <td>THB {formatCurrency(row.actualShare)}</td>
                      <td>
                        <span className={styles.methodBadge}>{row.method}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.emptyState}>
              No company submissions to Center courses were found for this
              period.
            </p>
          )}
          <p className={styles.calculationNote}>
            Budget share is calculated from Center-approved employees. If
            approval is pending, submitted employees or the course company
            scope is used.
          </p>
        </section>
      ) : null}

      <div className={styles.insightGrid}>
        <section
          className={styles.attendancePanel}
          aria-label="Training attendance summary"
        >
          <div className={styles.compactHeader}>
            <div>
              <p className={styles.kicker}>Completed training</p>
              <h3>Attendance Summary</h3>
            </div>
            <strong>{summary.attendanceRate}%</strong>
          </div>
          <div className={styles.attendanceContent}>
            <div
              className={`${styles.donutChart} ${
                summary.participantTotal === 0 ? styles.emptyChart : ""
              }`}
              style={chartStyle}
              role="img"
              aria-label={`Attended ${summary.attended}, did not attend ${summary.absent}`}
            >
              <div className={styles.chartCenter}>
                <strong>{formatNumber(summary.participantTotal)}</strong>
                <span>Participants</span>
              </div>
            </div>
            <div className={styles.attendanceStats}>
              <article>
                <i className={styles.attendedDot} aria-hidden="true" />
                <span>Attended</span>
                <strong>{formatNumber(summary.attended)}</strong>
              </article>
              <article>
                <i className={styles.absentDot} aria-hidden="true" />
                <span>Did Not Attend</span>
                <strong>{formatNumber(summary.absent)}</strong>
              </article>
            </div>
          </div>
        </section>

        <section
          className={styles.courseStatusPanel}
          aria-label="Course financial status"
        >
          <div className={styles.compactHeader}>
            <div>
              <p className={styles.kicker}>Course status</p>
              <h3>Financial Health</h3>
            </div>
          </div>
          <div className={styles.healthList}>
            <article>
              <span>Within budget</span>
              <strong>
                {
                  summary.rows.filter(
                    (row) => row.status !== "Over budget",
                  ).length
                }
              </strong>
            </article>
            <article>
              <span>Over budget</span>
              <strong>
                {
                  summary.rows.filter(
                    (row) => row.status === "Over budget",
                  ).length
                }
              </strong>
            </article>
            <article>
              <span>Completed</span>
              <strong>
                {
                  summary.rows.filter(
                    (row) => row.status === "Completed",
                  ).length
                }
              </strong>
            </article>
          </div>
          <p>
            Planned budget is counted once per course group, while actual
            expenses include all completed sessions.
          </p>
        </section>
      </div>

      <section
        className={styles.courseBreakdownPanel}
        aria-label="Course budget breakdown"
      >
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Course breakdown</p>
            <h3>Budget vs Actual by Course</h3>
          </div>
          <strong>{summary.rows.length} courses</strong>
        </div>

        {summary.rows.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.financeTable}>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Sessions</th>
                  <th>Planned Budget</th>
                  <th>Actual Spent</th>
                  <th>Remaining</th>
                  <th>Attended</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.code}</strong>
                      <span>{row.title}</span>
                      <small>{row.date}</small>
                    </td>
                    <td>{formatNumber(row.sessions)}</td>
                    <td>THB {formatCurrency(row.budget)}</td>
                    <td>THB {formatCurrency(row.actual)}</td>
                    <td
                      className={
                        row.remaining < 0
                          ? styles.negativeValue
                          : styles.positiveValue
                      }
                    >
                      THB {formatCurrency(row.remaining)}
                    </td>
                    <td>{formatNumber(row.attended)}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          row.status === "Over budget"
                            ? styles.overBudgetStatus
                            : row.status === "Completed"
                              ? styles.completedStatus
                              : styles.plannedStatus
                        }`}
                      >
                        {statusLabel[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.emptyState}>
            No planned or completed courses are available for this period.
          </p>
        )}
      </section>
    </section>
  );
}
