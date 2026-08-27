"use client";

import { useEffect, useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../AuthenticatedUserContext";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../ToastHost";
import { useUiLanguage } from "../ThaiUiLocalization";
import {
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "../center_factory/TrainingPlanManagement/modules/TrainingRolling";
import { createEnrollment, listEnrollments, updateEnrollmentStatus } from "../../lib/trainingEnrollment/client";
import type { EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import ModuleHeader from "./ModuleHeader";
import shell from "../shared/ModuleShell.module.css";
import styles from "./RegisterTrainingModule.module.css";
import { getCurrentCalendarDate } from "../../lib/calendarDate";

const ACTIVE_ENROLLMENT_STATUSES = ["Pending Approval", "Factory Approved", "Center Approved"] as const;

type AvailableCourse = {
  rollingId: string;
  enrollmentId: string | null;
  id: string;
  title: string;
  category: string;
  courseOwner: "Center" | "Factory";
  description: string;
  objective: string;
  learningContent: string;
  methodology: string;
  date: string;
  endDate: string;
  monthKey: string;
  time: string;
  place: string;
  seats: string;
  status: string;
  round: string;
  type: string;
  duration: string;
  trainingStatus: string;
  trainer: string;
  provider: string;
  targetGroup: string;
  preTestText: string;
  postTestText: string;
  evaluationText: string;
  hasPreOrPostTest: boolean;
  hasEvaluation: boolean;
  preTestLink: string;
  postTestLink: string;
  evaluationLink: string;
  approvalFlow: string;
  contact: string;
  remarks: string;
  isEnded: boolean;
  isPending: boolean;
};

const monthTabs = [
  { value: "all", labelTh: "ทั้งปี", labelEn: "All Year" },
  { value: "01", labelTh: "มกราคม", labelEn: "Jan" },
  { value: "02", labelTh: "กุมภาพันธ์", labelEn: "Feb" },
  { value: "03", labelTh: "มีนาคม", labelEn: "Mar" },
  { value: "04", labelTh: "เมษายน", labelEn: "Apr" },
  { value: "05", labelTh: "พฤษภาคม", labelEn: "May" },
  { value: "06", labelTh: "มิถุนายน", labelEn: "Jun" },
  { value: "07", labelTh: "กรกฎาคม", labelEn: "Jul" },
  { value: "08", labelTh: "สิงหาคม", labelEn: "Aug" },
  { value: "09", labelTh: "กันยายน", labelEn: "Sep" },
  { value: "10", labelTh: "ตุลาคม", labelEn: "Oct" },
  { value: "11", labelTh: "พฤศจิกายน", labelEn: "Nov" },
  { value: "12", labelTh: "ธันวาคม", labelEn: "Dec" },
] as const;

const renderFormattedText = (text: string) => {
  if (!text || text === "-") return "-";

  const items = text.split(/(?=\b\d+\.\s*)/).map((s) => s.trim()).filter(Boolean);

  if (items.length > 1 && items.some((item) => /^\d+\.\s*/.test(item))) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "4px" }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ui-30-ink)", lineHeight: 1.45 }}>
            {item}
          </div>
        ))}
      </div>
    );
  }

  if (text.includes("\n")) {
    const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "4px" }}>
        {lines.map((line, idx) => (
          <div key={idx} style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ui-30-ink)", lineHeight: 1.45 }}>
            {line}
          </div>
        ))}
      </div>
    );
  }

  return text;
};

type RegisterTrainingModuleProps = {
  onNavigate?: (module: "record" | "register" | "roadmap" | "request" | "report" | "calendar") => void;
};

export default function RegisterTrainingModule({ onNavigate }: RegisterTrainingModuleProps = {}) {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const employeeCompany = profileValue(user?.companyCode);
  const employeeId = user?.employeeId ?? null;
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const toast = useToast();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);

  const [calendarToday] = useState(getCurrentCalendarDate);
  const [selectedMonth, setSelectedMonth] = useState<string>(calendarToday.month);
  const [selectedScope, setSelectedScope] = useState<"ALL" | "Center" | "Factory">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const todayStr = `${calendarToday.year}-${calendarToday.month}-${calendarToday.day}`;

  useEffect(() => {
    void loadWorkflowRollingPlans().then((plans) => {
      setRollingPlans(plans);
      if (plans.length > 0) {
        const activeCurrentMonthCourses = plans.some((p) => {
          if (p.dbStatus === "CANCELLED" || p.status === "Cancel") return false;
          const endDate = p.endDate || p.trainingDate;
          const isEnded = p.dbStatus === "COMPLETED" || (endDate && endDate < todayStr);
          const monthKey = p.trainingDate ? p.trainingDate.slice(5, 7) : "";
          return !isEnded && monthKey === calendarToday.month;
        });

        if (!activeCurrentMonthCourses) {
          setSelectedMonth("all");
        }
      }
    });
  }, [calendarToday.day, calendarToday.month, calendarToday.year, todayStr]);

  const loadEnrollments = async () => {
    if (!employeeId) {
      setEnrollments([]);
      return;
    }
    try {
      const result = await listEnrollments({ planId: null, employeeId, employeeUserId: null });
      setEnrollments(result.enrollments || []);
    } catch (error) {
      console.error("Failed to load my registrations", error);
      setEnrollments([]);
    }
  };

  useEffect(() => {
    void loadEnrollments();
  }, [employeeId]);

  const userCompanyCode = user?.companyCode?.trim() || "";
  const userCompanyName = user?.companyName?.trim() || "";

  const allAvailableCourses = useMemo<AvailableCourse[]>(
    () =>
      rollingPlans
        .filter((plan) => {
          if (plan.dbStatus === "CANCELLED" || plan.status === "Cancel") return false;

          const isCenter =
            (plan.ownerScope && plan.ownerScope.toUpperCase() === "CENTER") ||
            (plan.owner && plan.owner.toUpperCase() === "CENTER") ||
            plan.ownerCompany === "CENTER" ||
            plan.company === "All Companies";

          if (isCenter) return true;

          const planCompanies = getRollingPlanCompanies(plan);
          if (planCompanies.includes("ALL") || planCompanies.includes("All Companies") || planCompanies.length === 0) {
            return true;
          }

          if (!userCompanyCode && !userCompanyName) {
            return true;
          }

          const codeUpper = userCompanyCode.toUpperCase();
          const nameUpper = userCompanyName.toUpperCase();

          return planCompanies.some((c) => {
            const compUpper = c.toUpperCase();
            return (
              (codeUpper !== "" && (compUpper === codeUpper || codeUpper.includes(compUpper) || compUpper.includes(codeUpper))) ||
              (nameUpper !== "" && (compUpper === nameUpper || nameUpper.includes(compUpper) || compUpper.includes(nameUpper))) ||
              (Boolean(plan.ownerCompany) && (plan.ownerCompany.toUpperCase() === codeUpper || codeUpper.includes(plan.ownerCompany.toUpperCase())))
            );
          });
        })
        .sort((a, b) => (a.trainingDate || "").localeCompare(b.trainingDate || ""))
        .map((plan) => {
          const isCenter =
            (plan.ownerScope && plan.ownerScope.toUpperCase() === "CENTER") ||
            (plan.owner && plan.owner.toUpperCase() === "CENTER") ||
            plan.ownerCompany === "CENTER" ||
            plan.company === "All Companies";

          const courseOwner: "Center" | "Factory" = isCenter ? "Center" : "Factory";
          const activeEnrollment = enrollments.find(
            (enrollment) =>
              enrollment.planId === plan.rollingId &&
              (ACTIVE_ENROLLMENT_STATUSES as readonly string[]).includes(enrollment.status),
          );
          const isRegistered = Boolean(activeEnrollment);
          const monthKey = plan.trainingDate ? plan.trainingDate.slice(5, 7) : "01";
          const endDateStr = plan.endDate || plan.trainingDate;
          const isEnded = plan.dbStatus === "COMPLETED" || (Boolean(endDateStr) && endDateStr < todayStr);

          const isTrueValue = (val: unknown) => {
            if (!val) return false;
            if (typeof val === "boolean") return val;
            if (typeof val === "string") {
              const trimmed = val.trim().toLowerCase();
              return trimmed !== "" && trimmed !== "no" && trimmed !== "none" && trimmed !== "ไม่มี" && trimmed !== "false";
            }
            return false;
          };

          const hasPreOrPostTest =
            isTrueValue(plan.course.preTest) ||
            isTrueValue(plan.course.postTest) ||
            Boolean(plan.course.preTestLink) ||
            Boolean(plan.course.postTestLink);

          const hasEvaluation =
            isTrueValue(plan.course.evaluation) ||
            Boolean(plan.course.evaluationLink);

          const preTestText = plan.course.preTest ? t("มีแบบทดสอบก่อนอบรม", "Pre-test Required") : t("ไม่มี", "None");
          const postTestText = plan.course.postTest ? t("มีแบบทดสอบหลังอบรม", "Post-test Required") : t("ไม่มี", "None");
          const evaluationText = plan.course.evaluation ? t("ประเมินผลหลังจบอบรม", "Post-course Evaluation") : t("ไม่มี", "None");

          const isPending = activeEnrollment?.status === "Pending Approval";

          let statusLabel = isRegistered
            ? isPending
              ? courseOwner === "Center"
                ? t("🟡 รอ HRD Center อนุมัติ", "🟡 Pending HRD Center Approval")
                : t("🟡 รอ Factory HRD อนุมัติ", "🟡 Pending Factory HRD Approval")
              : activeEnrollment?.status === "Center Approved" || activeEnrollment?.status === "Factory Approved"
                ? t("🟢 อนุมัติแล้ว (พร้อมอบรม)", "🟢 Approved")
                : t("ลงทะเบียนแล้ว", "Registered")
            : courseOwner === "Center"
              ? t("หลักสูตรบังคับศูนย์กลาง", "Center Mandatory")
              : t("เปิดรับลงทะเบียน", "Open registration");

          if (isEnded && !isRegistered) {
            statusLabel = t("ผ่านเวลาไปแล้วไม่สามารถลงได้", "Registration deadline passed");
          }

          return {
            rollingId: plan.rollingId,
            enrollmentId: activeEnrollment?.id ?? null,
            id: plan.course.code,
            title: plan.course.name,
            category: plan.course.courseGroup,
            courseOwner,
            description: plan.course.objective || "-",
            objective: plan.course.objective || "-",
            learningContent: plan.course.learningContent || "-",
            methodology: plan.course.methodology || "-",
            date: plan.endDate && plan.endDate !== plan.trainingDate ? `${plan.trainingDate} - ${plan.endDate}` : plan.trainingDate,
            endDate: plan.endDate || plan.trainingDate,
            monthKey,
            time: `${plan.startTime} - ${plan.endTime}`,
            place: plan.location || "-",
            seats: `${plan.participants} ${t("ที่นั่ง", "seats")}`,
            status: statusLabel,
            round: plan.batch || "-",
            type: plan.course.courseType || "-",
            duration: `${plan.hours} ${t("ชม.", "hrs")}`,
            trainingStatus: isRegistered ? "Registered" : "Not registered",
            trainer: plan.trainer || "-",
            provider: plan.provider || "-",
            targetGroup: plan.course.targetGroup || "-",
            preTestText,
            postTestText,
            evaluationText,
            hasPreOrPostTest,
            hasEvaluation,
            preTestLink: plan.course.preTestLink || "",
            postTestLink: plan.course.postTestLink || "",
            evaluationLink: plan.course.evaluationLink || "",
            approvalFlow:
              courseOwner === "Center"
                ? t("พนักงาน > HRD Center", "Employee > HRD Center")
                : t("พนักงาน > Factory HRD", "Employee > Factory HRD"),
            contact:
              courseOwner === "Center"
                ? "HRD Center"
                : `${plan.ownerCompany ?? employeeCompany ?? "Factory"} HRD`,
            remarks: plan.course.remark || (courseOwner === "Center"
                ? t("หลักสูตรบังคับจากศูนย์กลาง", "Center Mandatory Course")
                : t("จัดโดย HRD โรงงาน", "Managed by Factory HRD")),
            isEnded,
            isPending,
          };
        }),
    [employeeCompany, enrollments, rollingPlans, isThai, todayStr],
  );

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return allAvailableCourses.filter((course) => {
      // Hide ended courses by default unless showCompleted is checked
      if (!showCompleted && course.isEnded) {
        return false;
      }
      // Month filter
      if (selectedMonth !== "all" && course.monthKey !== selectedMonth) {
        return false;
      }
      // Scope filter
      if (selectedScope !== "ALL" && course.courseOwner !== selectedScope) {
        return false;
      }
      // Search term
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const matchTitle = course.title.toLowerCase().includes(query);
        const matchCode = course.id.toLowerCase().includes(query);
        const matchCategory = course.category.toLowerCase().includes(query);
        const matchTrainer = course.trainer.toLowerCase().includes(query);
        if (!matchTitle && !matchCode && !matchCategory && !matchTrainer) return false;
      }
      return true;
    });
  }, [allAvailableCourses, showCompleted, selectedMonth, selectedScope, searchTerm]);

  // Month counts (only active unended courses, or all if showCompleted is checked)
  const monthCounts = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    for (const course of allAvailableCourses) {
      if (!showCompleted && course.isEnded) continue;
      map.all = (map.all || 0) + 1;
      map[course.monthKey] = (map[course.monthKey] || 0) + 1;
    }
    return map;
  }, [allAvailableCourses, showCompleted]);

  // Stats calculation
  const stats = useMemo(() => {
    const activeList = showCompleted
      ? allAvailableCourses
      : allAvailableCourses.filter((c) => !c.isEnded);

    const monthCourses = selectedMonth === "all"
      ? activeList
      : activeList.filter((c) => c.monthKey === selectedMonth);

    const openCount = monthCourses.filter((c) => c.trainingStatus !== "Registered" && !c.isEnded).length;
    const registeredCount = monthCourses.filter((c) => c.trainingStatus === "Registered").length;
    const centerCount = monthCourses.filter((c) => c.courseOwner === "Center").length;

    return { openCount, registeredCount, centerCount };
  }, [allAvailableCourses, selectedMonth, showCompleted]);

  // Scope Counts for Filter Pills
  const scopeCounts = useMemo(() => {
    const activeList = showCompleted
      ? allAvailableCourses
      : allAvailableCourses.filter((c) => !c.isEnded);

    const monthCourses = selectedMonth === "all"
      ? activeList
      : activeList.filter((c) => c.monthKey === selectedMonth);

    const all = monthCourses.length;
    const center = monthCourses.filter((c) => c.courseOwner === "Center").length;
    const factory = monthCourses.filter((c) => c.courseOwner === "Factory").length;

    return { all, center, factory };
  }, [allAvailableCourses, selectedMonth, showCompleted]);

  const handleRegistration = async (course: AvailableCourse) => {
    if (!employeeId || course.isEnded) return;

    try {
      if (course.enrollmentId) {
        if (!(await confirm({ message: { th: `ยืนยันที่จะยกเลิกการลงทะเบียนอบรม ${course.title} หรือไม่?`, en: `Confirm cancelling registration for ${course.title}?` }, danger: true }))) {
          return;
        }
        await updateEnrollmentStatus(course.enrollmentId, { action: "cancel" });
        toast.success(t("ยกเลิกการลงทะเบียนเรียบร้อยแล้ว", "Registration cancelled"));
      } else {
        await createEnrollment({ planId: course.rollingId, employeeId, employeeUserId: null, source: "EMPLOYEE" });
        toast.success(
          t(
            "ลงทะเบียนอบรมสำเร็จ! (สถานะ: รอการอนุมัติ)",
            "Registered successfully! (Status: Pending Approval)",
          ),
        );
      }
      await loadEnrollments();
    } catch (error) {
      console.error("Failed to update registration", error);
      toast.error(t("อัปเดตการลงทะเบียนไม่สำเร็จ กรุณาลองอีกครั้ง", "Failed to update registration"));
    }
  };

  return (
    <section className={shell.moduleWorkspace}>
      <ModuleHeader
        eyebrow="Register Training"
        title={t("ลงทะเบียนเข้าอบรมประจำเดือน", "Monthly Rolling Registration")}
        detail={t("เลือกและลงทะเบียนเข้าร่วมหลักสูตรอบรมจากแผน Rolling Plan ประจำเดือนของศูนย์กลางและโรงงาน", "Select and register for training courses from monthly published rolling plans.")}
      />

      <div className={styles.container}>
        {/* Toolbar & Filter Panel */}
        <section className={styles.toolbarPanel} aria-label="Monthly registration toolbar">
          {/* Monthly KPI Stats Row */}
          <div className={styles.statsRow}>
            <div className={styles.statCard} style={{ "--stat-bg": "rgba(59, 130, 246, 0.12)", "--stat-color": "#3b82f6" } as React.CSSProperties}>
              <div className={styles.statIcon}>📚</div>
              <div className={styles.statMeta}>
                <span className={styles.statLabel}>{t("เปิดรับสมัคร", "Open Courses")}</span>
                <strong className={styles.statValue}>{stats.openCount} {t("หลักสูตร", "courses")}</strong>
              </div>
            </div>

            <div className={styles.statCard} style={{ "--stat-bg": "rgba(16, 185, 129, 0.12)", "--stat-color": "#10b981" } as React.CSSProperties}>
              <div className={styles.statIcon}>✅</div>
              <div className={styles.statMeta}>
                <span className={styles.statLabel}>{t("ลงทะเบียนแล้ว", "My Registered")}</span>
                <strong className={styles.statValue}>{stats.registeredCount} {t("หลักสูตร", "courses")}</strong>
              </div>
            </div>

            <div className={styles.statCard} style={{ "--stat-bg": "rgba(124, 58, 237, 0.12)", "--stat-color": "#7c3aed" } as React.CSSProperties}>
              <div className={styles.statIcon}>🏛️</div>
              <div className={styles.statMeta}>
                <span className={styles.statLabel}>{t("หลักสูตรศูนย์กลาง", "Center Courses")}</span>
                <strong className={styles.statValue}>{stats.centerCount} {t("หลักสูตร", "courses")}</strong>
              </div>
            </div>
          </div>

          {/* Month Navigation Tabs */}
          <div className={styles.monthPickerRow}>
            <div className={styles.monthTabs} aria-label="Filter by month">
              {monthTabs.map((tab) => {
                const count = monthCounts[tab.value] || 0;
                const isActive = selectedMonth === tab.value;

                return (
                  <button
                    key={tab.value}
                    type="button"
                    className={`${styles.monthTab} ${isActive ? styles.activeMonthTab : ""}`}
                    onClick={() => setSelectedMonth(tab.value)}
                  >
                    {isThai ? tab.labelTh : tab.labelEn}
                    {count > 0 ? <span className={styles.monthTabCount}>{count}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter Pills & Search */}
          <div className={styles.filterRow}>
            <div className={styles.scopePills} aria-label="Filter by scope">
              <button
                type="button"
                className={`${styles.scopePill} ${selectedScope === "ALL" ? styles.activeScopePill : ""}`}
                onClick={() => setSelectedScope("ALL")}
              >
                {t("ทั้งหมด", "All Scopes")} ({scopeCounts.all})
              </button>
              <button
                type="button"
                className={`${styles.scopePill} ${selectedScope === "Center" ? styles.activeScopePill : ""}`}
                onClick={() => setSelectedScope("Center")}
              >
                🏛️ {t("ศูนย์กลาง", "Center Mandatory")} ({scopeCounts.center})
              </button>
              <button
                type="button"
                className={`${styles.scopePill} ${selectedScope === "Factory" ? styles.activeScopePill : ""}`}
                onClick={() => setSelectedScope("Factory")}
              >
                🏭 {t("โรงงาน", "Factory Training")} ({scopeCounts.factory})
              </button>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                />
                {t("แสดงคอร์สที่จบไปแล้วด้วย", "Show ended courses")}
              </label>
            </div>

            <div className={styles.searchInputWrapper}>
              <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t("ค้นหารายชื่อคอร์ส, รหัสวิชา หรือ วิทยากร...", "Search course name, code or trainer...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Course Cards Container */}
        <div className={styles.courseList}>
          {filteredCourses.map((course) => {
            const isExpanded = course.rollingId === expandedCourseId;
            const isRegistered = course.trainingStatus === "Registered";
            const isCenter = course.courseOwner === "Center";
            const isEnded = course.isEnded;

            return (
              <article
                className={`${styles.courseCard} ${isCenter ? styles.centerCard : styles.factoryCard} ${isRegistered ? styles.registeredCard : ""} ${isEnded ? styles.endedCard : ""}`}
                key={course.rollingId}
              >
                {/* Card Header Row */}
                <div className={styles.cardHeaderRow}>
                  <div className={styles.tagGroup}>
                    <span className={`${styles.scopeBadge} ${isCenter ? styles.centerBadge : styles.factoryBadge}`}>
                      {isCenter ? "🏛️ Center Mandatory" : "🏭 Factory Training"}
                    </span>
                    <span className={styles.categoryPill}>{course.category}</span>
                    {isEnded ? <span className={styles.categoryPill} style={{ background: "rgba(100,116,139,0.15)", color: "#64748b" }}>🏁 {t("จบการอบรมแล้ว", "Ended")}</span> : null}
                  </div>
                  <span className={styles.codePill}>{course.id}</span>
                </div>

                {/* Main Body */}
                <div className={styles.cardMainBody}>
                  <h3 className={styles.courseTitle} translate="no">{course.title}</h3>
                  {course.description ? (
                    <p className={styles.courseObjective}>{course.description}</p>
                  ) : null}
                </div>

                {/* Schedule Grid Box */}
                <div className={styles.scheduleGrid}>
                  <div className={styles.scheduleItem}>
                    <span className={styles.scheduleLabel}>📅 {t("วันที่อบรม", "Date")}</span>
                    <strong className={styles.scheduleValue}>{course.date}</strong>
                  </div>
                  <div className={styles.scheduleItem}>
                    <span className={styles.scheduleLabel}>⏰ {t("เวลา / ระยะเวลา", "Time & Duration")}</span>
                    <strong className={styles.scheduleValue}>{course.time} ({course.duration})</strong>
                  </div>
                  <div className={styles.scheduleItem}>
                    <span className={styles.scheduleLabel}>📍 {t("สถานที่อบรม", "Venue / Place")}</span>
                    <strong className={styles.scheduleValue} title={course.place}>{course.place}</strong>
                  </div>
                  <div className={styles.scheduleItem}>
                    <span className={styles.scheduleLabel}>👨‍🏫 {t("วิทยากร / ที่นั่ง", "Trainer & Seats")}</span>
                    <strong className={styles.scheduleValue}>{course.trainer} • {course.seats}</strong>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className={styles.cardFooter}>
                  <span className={`${styles.statusPill} ${isEnded ? styles.statusEnded : course.isPending ? styles.statusPending : isRegistered ? styles.statusRegistered : styles.statusOpen}`}>
                    {course.status}
                  </span>

                  <div className={styles.actionButtons}>
                    <button
                      className={styles.detailBtn}
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedCourseId(isExpanded ? null : course.rollingId)}
                    >
                      {isExpanded ? t("ซ่อนรายละเอียด", "Hide detail") : t("ดูรายละเอียดคอร์ส", "Show detail")}
                    </button>
                    {isEnded ? (
                      <button className={styles.detailBtn} type="button" disabled style={{ opacity: 0.65, cursor: "not-allowed", color: "var(--ui-30-muted)" }}>
                        {isRegistered ? t("เข้าร่วมอบรมแล้ว", "Attended") : t("ผ่านเวลาไปแล้วไม่สามารถลงได้", "Past deadline - Cannot register")}
                      </button>
                    ) : isRegistered ? (
                      <button
                        className={styles.cancelBtn}
                        type="button"
                        onClick={() => void handleRegistration(course)}
                      >
                        {t("ยกเลิกการลงทะเบียน", "Cancel registration")}
                      </button>
                    ) : (
                      <button
                        className={styles.registerBtn}
                        type="button"
                        onClick={() => void handleRegistration(course)}
                      >
                        {t("ลงทะเบียนอบรม", "Register now")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Detail Drawer */}
                {isExpanded ? (
                  <div className={styles.detailDrawer}>
                    <div className={styles.detailGrid}>
                      {/* Section 1: Objective & Learning Content */}
                      <div className={styles.detailSectionCard}>
                        <h4>📖 {t("วัตถุประสงค์ & เนื้อหาการเรียนรู้", "Objective & Learning Content")}</h4>
                        <dl className={styles.detailDl}>
                          <div className={styles.detailItem}>
                            <dt>{t("วัตถุประสงค์ (Objective)", "Objective")}</dt>
                            <dd>{renderFormattedText(course.objective)}</dd>
                          </div>
                          <div className={styles.detailItem}>
                            <dt>{t("เนื้อหาการเรียนรู้ (Learning Content)", "Learning Content")}</dt>
                            <dd>{renderFormattedText(course.learningContent)}</dd>
                          </div>
                          <div className={styles.detailItem}>
                            <dt>{t("รูปแบบการอบรม (Methodology)", "Methodology")}</dt>
                            <dd>{renderFormattedText(course.methodology)}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Section 2: Class & Schedule Detail */}
                      <div className={styles.detailSectionCard}>
                        <h4>🏫 {t("รายละเอียดชั้นเรียน & ผู้จัด", "Class & Trainer Detail")}</h4>
                        <dl className={styles.detailDl}>
                          <div className={styles.detailItem}>
                            <dt>{t("รหัสวิชา / รุ่นการอบรม", "Course Code / Batch")}</dt>
                            <dd>{course.id} ({course.round})</dd>
                          </div>
                          <div className={styles.detailItem}>
                            <dt>{t("ประเภทวิชา (Course Type)", "Course Type")}</dt>
                            <dd>{course.type} / {course.category}</dd>
                          </div>
                          <div className={styles.detailItem}>
                            <dt>{t("วิทยากรผู้สอน (Trainer)", "Trainer")}</dt>
                            <dd>{course.trainer}</dd>
                          </div>
                          <div className={styles.detailItem}>
                            <dt>{t("สถาบัน/ผู้จัดอบรม (Provider)", "Provider")}</dt>
                            <dd>{course.provider}</dd>
                          </div>
                          <div className={styles.detailItem}>
                            <dt>{t("สถานที่อบรม (Venue)", "Location / Venue")}</dt>
                            <dd>{course.place}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Section 3: Target Audience & Requirements */}
                      <div className={styles.detailSectionCard}>
                        <h4>🎯 {t("กลุ่มเป้าหมาย & ข้อกำหนด", "Target Group & Requirements")}</h4>
                        <dl className={styles.detailDl}>
                          <div className={styles.detailItem}>
                            <dt>{t("กลุ่มเป้าหมายหลัก (Target Group)", "Target Group")}</dt>
                            <dd>{course.targetGroup}</dd>
                          </div>
                          {course.hasPreOrPostTest ? (
                            <div className={styles.detailItem}>
                              <dt>{t("แบบทดสอบก่อน-หลัง (Pre / Post Test)", "Pre / Post Test")}</dt>
                              <dd>{course.preTestText} / {course.postTestText}</dd>
                            </div>
                          ) : null}
                          {course.hasEvaluation ? (
                            <div className={styles.detailItem}>
                              <dt>{t("การประเมินผล (Evaluation Form)", "Evaluation")}</dt>
                              <dd>{course.evaluationText}</dd>
                            </div>
                          ) : null}
                          <div className={styles.detailItem}>
                            <dt>{t("สายการอนุมัติ (Approval Flow)", "Approval Flow")}</dt>
                            <dd>{course.approvalFlow}</dd>
                          </div>
                          <div className={styles.detailItem}>
                            <dt>{t("หน่วยงานรับผิดชอบ / หมายเหตุ", "Owner & Remarks")}</dt>
                            <dd>{course.contact} • {course.remarks}</dd>
                          </div>
                          {course.preTestLink ? (
                            <div className={styles.detailItem}>
                              <dt>{t("ลิงก์แบบทดสอบก่อนอบรม (Pre-Test)", "Pre-Test Link")}</dt>
                              <dd>
                                <a href={course.preTestLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ui-30-primary)", textDecoration: "underline", fontWeight: 800 }}>
                                  🔗 {t("เปิดทำแบบทดสอบก่อนอบรม", "Open Pre-Test")}
                                </a>
                              </dd>
                            </div>
                          ) : null}
                          {course.postTestLink ? (
                            <div className={styles.detailItem}>
                              <dt>{t("ลิงก์แบบทดสอบหลังอบรม (Post-Test)", "Post-Test Link")}</dt>
                              <dd>
                                <a href={course.postTestLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ui-30-primary)", textDecoration: "underline", fontWeight: 800 }}>
                                  🔗 {t("เปิดทำแบบทดสอบหลังอบรม", "Open Post-Test")}
                                </a>
                              </dd>
                            </div>
                          ) : null}
                          {course.evaluationLink ? (
                            <div className={styles.detailItem}>
                              <dt>{t("ลิงก์แบบประเมินผลการอบรม (Evaluation)", "Evaluation Link")}</dt>
                              <dd>
                                <a href={course.evaluationLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ui-30-primary)", textDecoration: "underline", fontWeight: 800 }}>
                                  📋 {t("เปิดทำแบบประเมินผล", "Open Evaluation Form")}
                                </a>
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}

          {filteredCourses.length === 0 ? (
            <div className={styles.emptyCard}>
              <span className={styles.emptyIcon}>📅</span>
              <h3 className={styles.emptyTitle}>
                {t("ไม่พบหลักสูตรเปิดลงทะเบียนในเดือนนี้", "No courses open for registration in this period")}
              </h3>
              <p className={styles.emptyDesc}>
                {t("กรุณาเลือกเดือนอื่น หรือกดเปิด 'แสดงคอร์สที่จบไปแล้วด้วย' เพื่อดูประวัติหลักสูตรเพิ่มเติม", "Please select another month or check 'Show ended courses' to view past courses.")}
              </p>
              {selectedMonth !== "all" ? (
                <button
                  type="button"
                  className={styles.detailBtn}
                  onClick={() => {
                    setSelectedMonth("all");
                    setSelectedScope("ALL");
                    setSearchTerm("");
                  }}
                >
                  {t("ดูหลักสูตรเปิดสมัครทั้งปี", "View All Year Courses")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
