"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { WorkflowCompletedCourse } from "../../../../lib/trainingWorkflow";
import {
  buildFactoryCenterFunding,
  buildFinanceSummary,
  type FinancialCourseRow,
} from "../../../../lib/trainingFinanceSummary";
import {
  profileValue,
  useAuthenticatedUser,
} from "../../../AuthenticatedUserContext";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import {
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "../../TrainingPlanManagement/modules/TrainingRolling";
import { listEnrollments } from "../../../../lib/trainingEnrollment/client";
import type { EnrollmentRecord } from "../../../../lib/trainingEnrollment/types";
import { listTrainingRecords } from "../../../../lib/trainingRecord/client";
import type { TrainingRecordSummary } from "../../../../lib/trainingRecord/types";
import styles from "./SummaryDashboard.module.css";
import {
  Building2,
  Factory,
  Coins,
  Wallet,
  Users,
  Activity,
  Search,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Info,
  X,
} from "../../../icons/LucideIcons";

export const summaryDashboardModule = {
  title: "Summary Dashboard",
  subtitle: "Executive Financial & Attendance Overview",
  description:
    "Monitor planned course budgets, actual spending, balance variances, and completed training attendance in one unified dashboard.",
} as const;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);

const monthOptions = [
  { value: "01", label: "January", thLabel: "มกราคม (ม.ค.)" },
  { value: "02", label: "February", thLabel: "กุมภาพันธ์ (ก.พ.)" },
  { value: "03", label: "March", thLabel: "มีนาคม (มี.ค.)" },
  { value: "04", label: "April", thLabel: "เมษายน (เม.ย.)" },
  { value: "05", label: "May", thLabel: "พฤษภาคม (พ.ค.)" },
  { value: "06", label: "June", thLabel: "มิถุนายน (มิ.ย.)" },
  { value: "07", label: "July", thLabel: "กรกฎาคม (ก.ค.)" },
  { value: "08", label: "August", thLabel: "สิงหาคม (ส.ค.)" },
  { value: "09", label: "September", thLabel: "กันยายน (ก.ย.)" },
  { value: "10", label: "October", thLabel: "ตุลาคม (ต.ค.)" },
  { value: "11", label: "November", thLabel: "พฤศจิกายน (พ.ย.)" },
  { value: "12", label: "December", thLabel: "ธันวาคม (ธ.ค.)" },
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

const getRollingOwner = (plan: RollingPlan) => plan.ownerScope;

const PAGE_SIZE = 10;

export default function SummaryDashboard() {
  const { language } = useUiLanguage();
  const isThai = language === "th";

  const user = useAuthenticatedUser();
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<
    TrainingRecordSummary[]
  >([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "Within budget" | "Over budget" | "Completed"
  >("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const role = isFactoryUser ? "FACTORY" : "CENTER";
  const userCompanyCode = profileValue(user?.companyCode);

  useEffect(() => {
    void loadWorkflowRollingPlans().then(setRollingPlans);
    void listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then((result) => setEnrollments(result.enrollments || []))
      .catch((error) => {
        console.error("Failed to load enrollments", error);
        setEnrollments([]);
      });
    void listTrainingRecords()
      .then((result) => setTrainingRecords(result.trainingRecords || []))
      .catch((error) => {
        console.error("Failed to load training records", error);
        setTrainingRecords([]);
      });
  }, []);

  const completedCourses = useMemo<WorkflowCompletedCourse[]>(
    () =>
      trainingRecords.map((record) => {
        const plan = rollingPlans.find(
          (candidate) => candidate.rollingId === record.planId,
        );

        return {
          id: record.planId,
          rollingId: record.planId,
          scheduleGroupId: plan?.scheduleGroupId,
          code: plan?.course.code ?? "",
          title: plan?.course.name ?? "",
          date: plan?.trainingDate ?? "",
          batch: plan?.batch,
          company: plan?.company ?? "",
          relatedCompanies: plan ? getRollingPlanCompanies(plan) : [],
          owner: plan?.ownerScope ?? "FACTORY",
          ownerCompany: plan?.ownerCompany,
          room: plan?.location ?? "",
          instructor: plan?.trainer ?? "",
          hours: Number(plan?.hours ?? 0),
          attendees: record.attendees.map((attendee) => ({
            id: attendee.enrollmentId,
            company: attendee.company,
            employeeCode: attendee.employeeCode,
            name: attendee.name,
            department: attendee.department,
            registered: true,
            attended: attendee.attended,
          })),
          expenses: record.expenses,
          savedAt: record.savedAt,
        };
      }),
    [rollingPlans, trainingRecords],
  );

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
          owner === "CENTER" && getRollingPlanCompanies(plan).includes(userCompanyCode);

        return ownsFactoryCourse || isRelatedCenterCourse;
      }),
    [isFactoryUser, rollingPlans, userCompanyCode],
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
            enrollments,
            companyCode: userCompanyCode,
            year: activeYear,
            month: selectedMonth,
          })
        : [],
    [
      activeYear,
      completedCourses,
      enrollments,
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

  // Reset pagination on filter or period change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, activeYear, selectedMonth]);

  // Tab counts
  const statusCounts = useMemo(() => {
    const all = summary.rows.length;
    const overBudget = summary.rows.filter(
      (r) => r.status === "Over budget",
    ).length;
    const completed = summary.rows.filter(
      (r) => r.status === "Completed",
    ).length;
    const withinBudget = summary.rows.filter(
      (r) => r.status !== "Over budget",
    ).length;
    return { all, overBudget, completed, withinBudget };
  }, [summary.rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return summary.rows.filter((row) => {
      if (statusFilter === "Over budget" && row.status !== "Over budget") {
        return false;
      }
      if (statusFilter === "Completed" && row.status !== "Completed") {
        return false;
      }
      if (statusFilter === "Within budget" && row.status === "Over budget") {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const codeMatch = row.code.toLowerCase().includes(query);
        const titleMatch = row.title.toLowerCase().includes(query);
        if (!codeMatch && !titleMatch) {
          return false;
        }
      }

      return true;
    });
  }, [summary.rows, statusFilter, searchTerm]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  // Generate pagination numbers (sliding window)
  const paginationPages = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  // Dynamic budget variance calculation
  const budgetVariancePercent = useMemo(() => {
    if (summary.totalBudget <= 0) return 0;
    return Math.round((Math.abs(summary.remainingBudget) / summary.totalBudget) * 100);
  }, [summary.remainingBudget, summary.totalBudget]);

  // Utilization threshold status
  const utilizationStatus = useMemo(() => {
    if (summary.utilizationRate > 100) {
      return {
        label: isThai ? "เกินงบประมาณ" : "Over Budget Alert",
        tone: "critical",
        hint: isThai ? "ค่าใช้จ่ายจริงสูงกว่างบประมาณที่วางแผนไว้" : "Expenses exceed planned allocation",
      };
    }
    if (summary.utilizationRate >= 80) {
      return {
        label: isThai ? "ใกล้เต็มงบประมาณ" : "Near Capacity",
        tone: "warning",
        hint: isThai ? "อัตราการใช้งบประมาณเข้าใกล้เกณฑ์สูงสุด" : "Budget utilization approaching maximum",
      };
    }
    return {
      label: isThai ? "เป็นไปตามแผน" : "Healthy Pace",
      tone: "healthy",
      hint: isThai ? "การใช้จ่ายอยู่ในกรอบงบประมาณที่วางแผนไว้อย่างเหมาะสม" : "Spending is well within planned parameters",
    };
  }, [summary.utilizationRate, isThai]);

  // Attendance compliance rating
  const attendanceRating = useMemo(() => {
    if (summary.attendanceRate >= 90) {
      return {
        label: isThai ? "การเข้าอบรมดีเยี่ยม" : "Excellent Compliance",
        tone: "healthy",
      };
    }
    if (summary.attendanceRate >= 75) {
      return {
        label: isThai ? "การเข้าอบรมปกติ" : "Good Attendance",
        tone: "neutral",
      };
    }
    return {
      label: isThai ? "ควรติดตามเป็นพิเศษ" : "Needs Attention",
      tone: "warning",
    };
  }, [summary.attendanceRate, isThai]);

  const chartStyle = {
    "--attendance-angle": `${summary.attendanceRate * 3.6}deg`,
  } as CSSProperties;

  const budgetStyle = {
    "--budget-used": `${Math.min(summary.utilizationRate, 100)}%`,
  } as CSSProperties;

  const getStatusBadgeLabel = (status: "Planned" | "Completed" | "Over budget") => {
    if (isThai) {
      if (status === "Planned") return "ตามแผน";
      if (status === "Completed") return "เสร็จสิ้น";
      if (status === "Over budget") return "เกินงบ";
    }
    return status;
  };

  return (
    <div
      className={styles.moduleWorkspace}
      aria-label="Summary Dashboard module"
    >
      {/* ── Section 1: Executive Command Header ── */}
      <header className={styles.commandHeader}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.titleRow}>
            <h2>{isThai ? "แดชบอร์ดสรุปภาพรวม" : summaryDashboardModule.title}</h2>
            <span
              className={`${styles.scopeBadge} ${
                isFactoryUser ? styles.factoryScopeBadge : styles.centerScopeBadge
              }`}
            >
              {isFactoryUser ? (
                <>
                  <Factory size={14} className={styles.scopeIcon} />
                  <span>
                    {isThai
                      ? `${userCompanyCode} ขอบเขตโรงงาน`
                      : `${userCompanyCode} Factory Scope`}
                  </span>
                </>
              ) : (
                <>
                  <Building2 size={14} className={styles.scopeIcon} />
                  <span>{isThai ? "HRD Center ส่วนกลาง" : "HRD Center Enterprise"}</span>
                </>
              )}
            </span>
          </div>
          <p className={styles.headerDescription}>
            {isThai
              ? "ติดตามงบประมาณตามแผน ค่าใช้จ่ายจริง ยอดคงเหลือ และสถิติการเข้าอบรมในแดชบอร์ดเดียว"
              : summaryDashboardModule.description}
          </p>
        </div>

        {/* Unified Period Filter Controls */}
        <div className={styles.periodControlsCard}>
          <div className={styles.filterControlGroup}>
            <label htmlFor="summary-year-select" className={styles.controlLabel}>
              <Calendar size={13} className={styles.controlIcon} />
              <span>{isThai ? "ปี" : "Year"}</span>
            </label>
            <div className={styles.selectWrapper}>
              <select
                id="summary-year-select"
                value={activeYear}
                onChange={(event) => {
                  setSelectedYear(event.target.value);
                  setSelectedMonth("all");
                }}
                className={styles.periodSelect}
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
            </div>
          </div>

          <div className={styles.controlDivider} />

          <div className={styles.filterControlGroup}>
            <label htmlFor="summary-month-select" className={styles.controlLabel}>
              <span>{isThai ? "ช่วงเวลา" : "Period"}</span>
            </label>
            <div className={styles.selectWrapper}>
              <select
                id="summary-month-select"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className={styles.periodSelect}
              >
                <option value="all">
                  {isThai ? "ทุกเดือน (ทั้งปี)" : "All Months (Full Year)"}
                </option>
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {isThai ? month.thLabel : month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* ── Section 2: Executive KPI Cards (4 Anchors) ── */}
      <section className={styles.kpiGrid} aria-label="Key Performance Indicators">
        {/* Card 1: Total Planned Budget */}
        <article className={`${styles.kpiCard} ${styles.budgetKpi}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>
              {isThai ? "งบประมาณตามแผนทั้งหมด" : "Total Planned Budget"}
            </span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconGreen}`}>
              <Coins size={18} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.currencyPrefix}>THB</span>
            <strong className={styles.kpiMainValue}>
              {formatCurrency(summary.totalBudget)}
            </strong>
          </div>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiSubtag}>
              <BookOpen size={12} />
              {isThai
                ? `${formatNumber(summary.courseCount)} หลักสูตร`
                : `${formatNumber(summary.courseCount)} Courses`}
            </span>
            <span className={styles.kpiSubtext}>
              {isThai
                ? `${formatNumber(summary.sessionCount)} รอบอบรมตามแผน`
                : `${formatNumber(summary.sessionCount)} Sessions Scheduled`}
            </span>
          </div>
        </article>

        {/* Card 2: Total Actual Spending */}
        <article className={`${styles.kpiCard} ${styles.actualKpi}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>
              {isThai ? "ค่าใช้จ่ายจ่ายจริงทั้งหมด" : "Total Actual Spending"}
            </span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconBlue}`}>
              <Activity size={18} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.currencyPrefix}>THB</span>
            <strong className={styles.kpiMainValue}>
              {formatCurrency(summary.totalActual)}
            </strong>
          </div>
          <div className={styles.kpiFooter}>
            <span className={`${styles.kpiSubtag} ${styles.tagBlue}`}>
              {isThai
                ? `ใช้ไปแล้ว ${summary.utilizationRate}%`
                : `${summary.utilizationRate}% utilized`}
            </span>
            <span className={styles.kpiSubtext}>
              {isThai ? "บันทึกจากรอบการอบรมที่จัดจริง" : "Recorded from actual sessions"}
            </span>
          </div>
        </article>

        {/* Card 3: Remaining Budget & Variance */}
        <article
          className={`${styles.kpiCard} ${
            summary.remainingBudget < 0 ? styles.overBudgetKpi : styles.remainingKpi
          }`}
        >
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>
              {isThai ? "งบประมาณคงเหลือ" : "Remaining Balance"}
            </span>
            <div
              className={`${styles.kpiIconWrapper} ${
                summary.remainingBudget < 0 ? styles.iconRed : styles.iconEmerald
              }`}
            >
              {summary.remainingBudget < 0 ? (
                <AlertTriangle size={18} />
              ) : (
                <Wallet size={18} />
              )}
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.currencyPrefix}>THB</span>
            <strong
              className={`${styles.kpiMainValue} ${
                summary.remainingBudget < 0
                  ? styles.negativeText
                  : styles.positiveText
              }`}
            >
              {formatCurrency(summary.remainingBudget)}
            </strong>
          </div>
          <div className={styles.kpiFooter}>
            {summary.remainingBudget < 0 ? (
              <span className={`${styles.kpiSubtag} ${styles.tagRed}`}>
                {isThai
                  ? `เกินงบ -${budgetVariancePercent}%`
                  : `-${budgetVariancePercent}% exceeded`}
              </span>
            ) : (
              <span className={`${styles.kpiSubtag} ${styles.tagGreen}`}>
                {isThai
                  ? `เหลืองบ +${budgetVariancePercent}%`
                  : `+${budgetVariancePercent}% remaining`}
              </span>
            )}
            <span className={styles.kpiSubtext}>
              {summary.remainingBudget < 0
                ? isThai
                  ? "ต้องปรับแผนงบประมาณ"
                  : "Requires budget adjustment"
                : isThai
                  ? "งบพร้อมสำหรับการจัดสรร"
                  : "Available for allocation"}
            </span>
          </div>
        </article>

        {/* Card 4: Attendance Rate */}
        <article className={`${styles.kpiCard} ${styles.attendanceKpi}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>
              {isThai ? "อัตราการเข้าอบรมโดยรวม" : "Overall Attendance Rate"}
            </span>
            <div className={`${styles.kpiIconWrapper} ${styles.iconTeal}`}>
              <Users size={18} />
            </div>
          </div>
          <div className={styles.kpiValueRow}>
            <strong className={styles.kpiMainValue}>
              {summary.attendanceRate}
              <span className={styles.percentSymbol}>%</span>
            </strong>
          </div>
          <div className={styles.kpiFooter}>
            <span className={`${styles.kpiSubtag} ${styles.tagTeal}`}>
              {isThai
                ? `เข้าเรียน ${formatNumber(summary.attended)} / ${formatNumber(summary.participantTotal)} คน`
                : `${formatNumber(summary.attended)} / ${formatNumber(summary.participantTotal)} Attended`}
            </span>
            <span className={styles.kpiSubtext}>
              {isThai
                ? `ขาดเรียน ${formatNumber(summary.absent)} คน`
                : `${formatNumber(summary.absent)} Absent / No-show`}
            </span>
          </div>
        </article>
      </section>

      {/* ── Section 3: Dual-Insight Analytics (2-Column Balanced Grid) ── */}
      <section className={styles.analyticsGrid} aria-label="Deep Financial & Attendance Analytics">
        {/* Left Column: Budget Health & Utilization Meter */}
        <div className={styles.analyticsCard}>
          <div className={styles.cardHeaderRow}>
            <div>
              <span className={styles.cardKicker}>
                {isThai ? "การใช้งบประมาณและสถานะ" : "Budget Burn & Health"}
              </span>
              <h3 className={styles.cardTitle}>
                {isThai ? "สถานะความคุ้มค่าและงบประมาณ" : "Financial Health Overview"}
              </h3>
            </div>
            <span
              className={`${styles.healthPill} ${
                utilizationStatus.tone === "critical"
                  ? styles.healthCritical
                  : utilizationStatus.tone === "warning"
                    ? styles.healthWarning
                    : styles.healthOk
              }`}
            >
              {utilizationStatus.label}
            </span>
          </div>

          <div className={styles.utilizationSection}>
            <div className={styles.utilizationLabels}>
              <span className={styles.utilizationTitle}>
                {isThai ? "อัตราการใช้งบประมาณ" : "Budget Utilization"}
              </span>
              <span className={styles.utilizationValue}>
                <strong>{summary.utilizationRate}%</strong>{" "}
                {isThai ? "ของงบประมาณตามแผนทั้งหมด" : "of total planned"}
              </span>
            </div>

            {/* Enhanced multi-stage progress meter */}
            <div
              className={styles.meterTrack}
              style={budgetStyle}
              role="progressbar"
              aria-label="Budget utilization progress"
              aria-valuenow={Math.min(summary.utilizationRate, 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={styles.meterFill} />
              <div className={styles.meterMarkers}>
                <span className={styles.marker25} />
                <span className={styles.marker50} />
                <span className={styles.marker75} />
              </div>
            </div>

            <div className={styles.meterLegend}>
              <span>0%</span>
              <span>50%</span>
              <span>{isThai ? "75% เฝ้าระวัง" : "75% Warning"}</span>
              <span>{isThai ? "100% เป้าหมาย" : "100% Target"}</span>
            </div>
          </div>

          {/* 3 Status Counters */}
          <div className={styles.healthStatsRow}>
            <div className={styles.healthStatItem}>
              <div className={styles.healthStatIconGreen}>
                <CheckCircle2 size={16} />
              </div>
              <div>
                <span className={styles.healthStatLabel}>
                  {isThai ? "อยู่ในงบประมาณ" : "Within Budget"}
                </span>
                <strong className={styles.healthStatCount}>
                  {statusCounts.withinBudget}
                </strong>
              </div>
            </div>

            <div className={styles.healthStatItem}>
              <div className={styles.healthStatIconRed}>
                <AlertTriangle size={16} />
              </div>
              <div>
                <span className={styles.healthStatLabel}>
                  {isThai ? "เกินงบประมาณ" : "Over Budget"}
                </span>
                <strong className={styles.healthStatCount}>
                  {statusCounts.overBudget}
                </strong>
              </div>
            </div>

            <div className={styles.healthStatItem}>
              <div className={styles.healthStatIconBlue}>
                <TrendingUp size={16} />
              </div>
              <div>
                <span className={styles.healthStatLabel}>
                  {isThai ? "เสร็จสิ้นแล้ว" : "Completed"}
                </span>
                <strong className={styles.healthStatCount}>
                  {statusCounts.completed}
                </strong>
              </div>
            </div>
          </div>

          <p className={styles.healthFootnote}>
            <Info size={12} className={styles.footnoteIcon} />
            {isThai
              ? "งบประมาณตามแผนนับครั้งเดียวต่อกลุ่มหลักสูตร และค่าใช้จ่ายจริงรวมทุกรอบที่บันทึกแล้ว"
              : "Planned budget counts once per course group; actual expenses reflect all finalized training sessions."}
          </p>
        </div>

        {/* Right Column: Attendance Compliance & Participant Breakdown */}
        <div className={styles.analyticsCard}>
          <div className={styles.cardHeaderRow}>
            <div>
              <span className={styles.cardKicker}>
                {isThai ? "การจัดฝึกอบรม" : "Training Delivery"}
              </span>
              <h3 className={styles.cardTitle}>
                {isThai ? "การปฏิบัติตามเกณฑ์การเข้าอบรม" : "Attendance Compliance"}
              </h3>
            </div>
            <span
              className={`${styles.healthPill} ${
                attendanceRating.tone === "healthy"
                  ? styles.healthOk
                  : attendanceRating.tone === "warning"
                    ? styles.healthWarning
                    : styles.healthNeutral
              }`}
            >
              {attendanceRating.label}
            </span>
          </div>

          <div className={styles.attendanceLayout}>
            {/* Modern Radial Donut */}
            <div className={styles.donutWrapper}>
              <div
                className={`${styles.donutChart} ${
                  summary.participantTotal === 0 ? styles.emptyChart : ""
                }`}
                style={chartStyle}
                role="img"
                aria-label={`Attendance rate: ${summary.attendanceRate}%, Attended ${summary.attended}, Absent ${summary.absent}`}
              >
                <div className={styles.donutCenter}>
                  <strong className={styles.donutCenterNumber}>
                    {summary.attendanceRate}%
                  </strong>
                  <span className={styles.donutCenterLabel}>
                    {isThai ? "อัตราเข้าเรียน" : "Attendance"}
                  </span>
                </div>
              </div>
            </div>

            {/* Attendance Breakdown Cards */}
            <div className={styles.attendanceBreakdown}>
              <article className={`${styles.breakdownCard} ${styles.breakdownAttended}`}>
                <div className={styles.breakdownHeader}>
                  <span className={styles.attendedBullet} />
                  <span className={styles.breakdownTitle}>
                    {isThai ? "เข้าร่วมอบรม" : "Attended Sessions"}
                  </span>
                </div>
                <strong className={styles.breakdownCount}>
                  {formatNumber(summary.attended)}
                </strong>
                <span className={styles.breakdownPercentage}>
                  {summary.participantTotal > 0
                    ? Math.round((summary.attended / summary.participantTotal) * 100)
                    : 0}
                  % {isThai ? "ของผู้ลงทะเบียนทั้งหมด" : "of total participants"}
                </span>
              </article>

              <article className={`${styles.breakdownCard} ${styles.breakdownAbsent}`}>
                <div className={styles.breakdownHeader}>
                  <span className={styles.absentBullet} />
                  <span className={styles.breakdownTitle}>
                    {isThai ? "ขาดเรียน / ไม่มา" : "Absent / No-Show"}
                  </span>
                </div>
                <strong className={styles.breakdownCount}>
                  {formatNumber(summary.absent)}
                </strong>
                <span className={styles.breakdownPercentage}>
                  {summary.participantTotal > 0
                    ? Math.round((summary.absent / summary.participantTotal) * 100)
                    : 0}
                  % {isThai ? "อัตราการไม่เข้าร่วมอบรม" : "non-attendance rate"}
                </span>
              </article>
            </div>
          </div>

          <p className={styles.healthFootnote}>
            <Users size={12} className={styles.footnoteIcon} />
            {isThai
              ? `คำนวณจากทุกรอบที่เสร็จสิ้น (รวม ${formatNumber(summary.participantTotal)} ที่นั่ง)`
              : `Calculated across all completed records (${formatNumber(summary.participantTotal)} total registered participant spots).`}
          </p>
        </div>
      </section>

      {/* ── Section 4: Factory to Center Funding (Conditional for Factory Scope) ── */}
      {isFactoryUser ? (
        <section
          className={styles.centerFundingSection}
          aria-label="Factory budget allocation for Center courses"
        >
          <div className={styles.fundingHeader}>
            <div>
              <span className={styles.cardKicker}>
                {isThai ? "ค่าใช้จ่ายร่วมระหว่างโรงงานและส่วนกลาง" : "Factory to Center Shared Cost"}
              </span>
              <h3 className={styles.cardTitle}>
                {isThai
                  ? "สัดส่วนงบประมาณบริษัทสำหรับหลักสูตร Center"
                  : "Company Budget Share for Center Courses"}
              </h3>
              <p className={styles.fundingDescription}>
                {isThai
                  ? "หลักสูตรที่ Center จัดขึ้นและมีพนักงานของบริษัทท่านเข้าร่วม พร้อมสัดส่วนงบประมาณที่คำนวณได้"
                  : "Center-hosted courses submitted by your company and their proportional budget share."}
              </p>
            </div>
            <span className={styles.coursesCountBadge}>
              {isThai
                ? `${fundingSummary.courses} หลักสูตร Center`
                : `${fundingSummary.courses} Center Courses`}
            </span>
          </div>

          <div className={styles.fundingMetricRow}>
            <article className={styles.fundingCard}>
              <span className={styles.fundingCardLabel}>
                {isThai ? "งบประมาณบริษัทที่จัดสรร" : "Allocated Company Budget"}
              </span>
              <strong className={styles.fundingCardValue}>
                THB {formatCurrency(fundingSummary.allocated)}
              </strong>
              <span className={styles.fundingCardSub}>
                {isThai ? "คำนวณตามสัดส่วนที่ระบุ" : "Calculated from scope share"}
              </span>
            </article>

            <article className={styles.fundingCard}>
              <span className={styles.fundingCardLabel}>
                {isThai ? "ประมาณการจ่ายจริง" : "Estimated Actual Share"}
              </span>
              <strong className={styles.fundingCardValue}>
                THB {formatCurrency(fundingSummary.actual)}
              </strong>
              <span className={styles.fundingCardSub}>
                {isThai ? "คิดตามยอดการเข้าอบรมจริง" : "Billed based on attendance"}
              </span>
            </article>

            <article className={styles.fundingCard}>
              <span className={styles.fundingCardLabel}>
                {isThai ? "งบประมาณบริษัทคงเหลือ" : "Remaining Company Share"}
              </span>
              <strong
                className={`${styles.fundingCardValue} ${
                  fundingSummary.allocated - fundingSummary.actual < 0
                    ? styles.negativeText
                    : styles.positiveText
                }`}
              >
                THB {formatCurrency(fundingSummary.allocated - fundingSummary.actual)}
              </strong>
              <span className={styles.fundingCardSub}>
                {fundingSummary.allocated - fundingSummary.actual < 0
                  ? isThai
                    ? "เกินโควตาจัดสรร"
                    : "Over budget allocation"
                  : isThai
                    ? "งบประมาณคงเหลือในโควตา"
                    : "Available allocation pool"}
              </span>
            </article>
          </div>

          {factoryCenterFunding.length > 0 ? (
            <div className={styles.tableResponsive}>
              <table className={styles.dashboardTable}>
                <thead>
                  <tr>
                    <th>{isThai ? "หลักสูตร Center" : "Center Course"}</th>
                    <th>{isThai ? "ส่งชื่อ / อนุมัติ" : "Submitted / Approved"}</th>
                    <th className={styles.thRight}>
                      {isThai ? "งบ Center รวม" : "Center Total Budget"}
                    </th>
                    <th className={styles.thRight}>
                      {isThai ? "สัดส่วนงบของบริษัท" : "Company Budget Share"}
                    </th>
                    <th className={styles.thRight}>
                      {isThai ? "ยอดจ่ายจริงตามสัดส่วน" : "Actual Share"}
                    </th>
                    <th>{isThai ? "วิธีคำนวณ" : "Calculation Method"}</th>
                  </tr>
                </thead>
                <tbody>
                  {factoryCenterFunding.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className={styles.courseCell}>
                          <span className={styles.courseCodeBadge}>{row.code}</span>
                          <span className={styles.courseTitleText}>{row.title}</span>
                          <span className={styles.courseMetaText}>
                            {row.date} · {row.sessions}{" "}
                            {isThai ? "รอบอบรม" : "sessions"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.applicantBadge}>
                          {row.submitted} / {row.approved}
                        </span>
                      </td>
                      <td className={styles.tdRight}>
                        <span className={styles.tabularNum}>
                          THB {formatCurrency(row.centerBudget)}
                        </span>
                      </td>
                      <td className={styles.tdRight}>
                        <strong className={`${styles.tabularNum} ${styles.allocatedText}`}>
                          THB {formatCurrency(row.allocatedBudget)}
                        </strong>
                      </td>
                      <td className={styles.tdRight}>
                        <span className={styles.tabularNum}>
                          THB {formatCurrency(row.actualShare)}
                        </span>
                      </td>
                      <td>
                        <span className={styles.methodPill}>
                          {isThai
                            ? row.method === "Approved employees"
                              ? "ตามผู้อนุมัติ"
                              : row.method === "Submitted employees"
                                ? "ตามผู้ส่งชื่อ"
                                : "ตามสัดส่วนบริษัท"
                            : row.method}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyTableState}>
              <Info size={24} className={styles.emptyIcon} />
              <p>
                {isThai
                  ? "ไม่พบรายการที่บริษัทส่งเข้าร่วมหลักสูตร Center ในช่วงเวลานี้"
                  : "No company submissions to Center courses were found for this selected period."}
              </p>
            </div>
          )}
          <p className={styles.fundingFootnote}>
            {isThai
              ? "* สัดส่วนงบคำนวณจากพนักงานที่ Center อนุมัติ หากอยู่ระหว่างรออนุมัติจะคำนวณจากผู้ที่ส่งชื่อหรือขอบเขตบริษัท"
              : "* Budget share is calculated from Center-approved employees. If approval is pending, submitted employees or the course scope is used."}
          </p>
        </section>
      ) : null}

      {/* ── Section 5: Smart Financial Drill-down Table ── */}
      <section
        className={styles.breakdownSection}
        aria-label="Course budget and attendance breakdown"
      >
        <div className={styles.breakdownHeader}>
          <div>
            <span className={styles.cardKicker}>
              {isThai ? "รายละเอียดรายวิชา" : "Course Breakdown"}
            </span>
            <h3 className={styles.cardTitle}>
              {isThai
                ? "เปรียบเทียบงบประมาณตามแผนและค่าใช้จ่ายจริงรายหลักสูตร"
                : "Budget vs Actual by Course"}
            </h3>
            <p className={styles.breakdownSubtitle}>
              {isThai
                ? "แสดงรายละเอียดงบประมาณที่วางแผน ค่าใช้จ่ายจริง ผลต่างคงเหลือ และสถิติการเข้าเรียน"
                : "Detailed breakdown of planned allocations, actual expenses, and attendance metrics."}
            </p>
          </div>
          <span className={styles.coursesCountBadge}>
            {isThai
              ? `${filteredRows.length} หลักสูตร`
              : `${filteredRows.length} ${filteredRows.length === 1 ? "Course" : "Courses"}`}
          </span>
        </div>

        {/* Action Toolbar: Search + Filter Tabs */}
        <div className={styles.tableToolbar}>
          {/* Status Filter Tabs */}
          <div className={styles.filterTabsGroup}>
            <button
              type="button"
              className={`${styles.tabBtn} ${
                statusFilter === "ALL" ? styles.tabBtnActive : ""
              }`}
              onClick={() => setStatusFilter("ALL")}
            >
              {isThai ? `ทั้งหมด (${statusCounts.all})` : `All (${statusCounts.all})`}
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${
                statusFilter === "Within budget" ? styles.tabBtnActive : ""
              }`}
              onClick={() => setStatusFilter("Within budget")}
            >
              {isThai
                ? `อยู่ในงบ (${statusCounts.withinBudget})`
                : `Within Budget (${statusCounts.withinBudget})`}
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${
                statusFilter === "Over budget" ? styles.tabBtnActive : ""
              }`}
              onClick={() => setStatusFilter("Over budget")}
            >
              {isThai
                ? `เกินงบ (${statusCounts.overBudget})`
                : `Over Budget (${statusCounts.overBudget})`}
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${
                statusFilter === "Completed" ? styles.tabBtnActive : ""
              }`}
              onClick={() => setStatusFilter("Completed")}
            >
              {isThai
                ? `เสร็จสิ้น (${statusCounts.completed})`
                : `Completed (${statusCounts.completed})`}
            </button>
          </div>

          {/* Search Input */}
          <div className={styles.searchBox}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={isThai ? "ค้นหารหัสวิชา หรือชื่อหลักสูตร..." : "Search code or title..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className={styles.searchClearBtn}
                title={isThai ? "ล้างการค้นหา" : "Clear search"}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Main Table */}
        {paginatedRows.length > 0 ? (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.dashboardTable}>
                <thead>
                  <tr>
                    <th>{isThai ? "รหัสและชื่อหลักสูตร" : "Course Code & Title"}</th>
                    <th>{isThai ? "รอบอบรม" : "Sessions"}</th>
                    <th className={styles.thRight}>
                      {isThai ? "งบตามแผน" : "Planned Budget"}
                    </th>
                    <th className={styles.thRight}>
                      {isThai ? "จ่ายจริง" : "Actual Spent"}
                    </th>
                    <th className={styles.thRight}>
                      {isThai ? "คงเหลือ" : "Remaining Balance"}
                    </th>
                    <th className={styles.thRight}>
                      {isThai ? "เข้าเรียน" : "Attended"}
                    </th>
                    <th>{isThai ? "สถานะ" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className={styles.courseCell}>
                          <span className={styles.courseCodeBadge}>{row.code}</span>
                          <span className={styles.courseTitleText}>{row.title}</span>
                          <span className={styles.courseMetaText}>{row.date}</span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.sessionCountBadge}>
                          {formatNumber(row.sessions)}
                        </span>
                      </td>
                      <td className={styles.tdRight}>
                        <span className={styles.tabularNum}>
                          THB {formatCurrency(row.budget)}
                        </span>
                      </td>
                      <td className={styles.tdRight}>
                        <span className={styles.tabularNum}>
                          THB {formatCurrency(row.actual)}
                        </span>
                      </td>
                      <td className={styles.tdRight}>
                        <span
                          className={`${styles.tabularNum} ${
                            row.remaining < 0
                              ? styles.negativeText
                              : styles.positiveText
                          }`}
                        >
                          THB {formatCurrency(row.remaining)}
                        </span>
                      </td>
                      <td className={styles.tdRight}>
                        <span className={styles.attendedNumber}>
                          <Users size={12} className={styles.attendedIcon} />
                          {formatNumber(row.attended)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            row.status === "Over budget"
                              ? styles.statusOverBudget
                              : row.status === "Completed"
                                ? styles.statusCompleted
                                : styles.statusPlanned
                          }`}
                        >
                          {getStatusBadgeLabel(row.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className={styles.paginationBar}>
                <div className={styles.paginationInfo}>
                  {isThai
                    ? `แสดง ${(currentPage - 1) * PAGE_SIZE + 1} ถึง ${Math.min(
                        currentPage * PAGE_SIZE,
                        filteredRows.length,
                      )} จากทั้งหมด ${filteredRows.length} หลักสูตร`
                    : `Showing ${(currentPage - 1) * PAGE_SIZE + 1} to ${Math.min(
                        currentPage * PAGE_SIZE,
                        filteredRows.length,
                      )} of ${filteredRows.length} courses`}
                </div>
                <div className={styles.paginationControls}>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    title={isThai ? "ก่อนหน้า" : "Previous page"}
                  >
                    <ChevronLeft size={16} />
                    <span>{isThai ? "ก่อนหน้า" : "Prev"}</span>
                  </button>

                  {paginationPages.map((page, idx) =>
                    page === "..." ? (
                      <span key={`ellipsis-${idx}`} className={styles.paginationEllipsis}>
                        ...
                      </span>
                    ) : (
                      <button
                        key={`page-${page}`}
                        type="button"
                        className={`${styles.pageBtn} ${
                          currentPage === page ? styles.pageBtnActive : ""
                        }`}
                        onClick={() => setCurrentPage(Number(page))}
                      >
                        {page}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    title={isThai ? "ถัดไป" : "Next page"}
                  >
                    <span>{isThai ? "ถัดไป" : "Next"}</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyTableState}>
            <BookOpen size={32} className={styles.emptyIcon} />
            <h4>{isThai ? "ไม่พบหลักสูตรที่ตรงกับเงื่อนไข" : "No courses found"}</h4>
            <p>
              {isThai
                ? searchTerm || statusFilter !== "ALL"
                  ? "ไม่พบหลักสูตรที่ตรงกับคำค้นหาหรือตัวกรองที่เลือก ลองล้างตัวกรองเพื่อดูข้อมูลทั้งหมด"
                  : "ไม่มีหลักสูตรตามแผนหรือที่เสร็จสิ้นในช่วงเวลานี้"
                : searchTerm || statusFilter !== "ALL"
                  ? "No courses match your filter or search query. Try clearing your filters."
                  : "No planned or completed courses are available for this selected period."}
            </p>
            {(searchTerm || statusFilter !== "ALL") && (
              <button
                type="button"
                className={styles.clearFilterBtn}
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                }}
              >
                {isThai ? "ล้างตัวกรองทั้งหมด" : "Reset Filters"}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
