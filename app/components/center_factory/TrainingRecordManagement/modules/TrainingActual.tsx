"use client";

import { useEffect, useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import {
  formatRollingPlanCompanies,
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "../../TrainingPlanManagement/modules/TrainingRolling";
import { listEnrollments, setEnrollmentAttendance } from "../../../../lib/trainingEnrollment/client";
import type { EnrollmentRecord } from "../../../../lib/trainingEnrollment/types";
import { getCostBreakdown, saveTrainingRecordExpenses } from "../../../../lib/trainingRecord/client";
import type { CostBreakdown } from "../../../../lib/trainingRecord/types";
import styles from "./TrainingRecord.module.css";

export const trainingActualModule = {
  title: "Training Actual",
  subtitle: "Actual Attendance",
  description:
    "Check actual attendance, record real training expenses, and save the completed actual record.",
} as const;

type ExpenseKey =
  | "instructor"
  | "traveling"
  | "seminarRoom"
  | "accommodation"
  | "material"
  | "foodBeverage";

type Attendee = {
  id: string;
  employeeCode: string;
  name: string;
  prefix: string;
  firstName: string;
  lastName: string;
  company?: string;
  section?: string;
  division?: string;
  department: string;
  position?: string;
  level?: string;
  registered: boolean;
  attended: boolean;
};

const parseNameParts = (fullName: string) => {
  const knownPrefixes = [
    "นางสาว",
    "นาย",
    "นาง",
    "Mr.",
    "Ms.",
    "Mrs.",
    "Dr.",
    "ดร.",
  ];

  let raw = (fullName || "").trim();
  let foundPrefix = "";

  for (const p of knownPrefixes) {
    if (raw.startsWith(p)) {
      foundPrefix = p;
      raw = raw.slice(p.length).trim();
      break;
    }
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || raw || "-";
  const lastName = parts.slice(1).join(" ") || "-";

  return {
    prefix: foundPrefix || "-",
    firstName,
    lastName,
  };
};

type ActualCourse = {
  id: string;
  groupId: string;
  code: string;
  title: string;
  date: string;
  batch?: string;
  startTime?: string;
  endTime?: string;
  time: string;
  room: string;
  company: string;
  relatedCompanies?: string[];
  owner: "CENTER" | "FACTORY";
  ownerCompany?: string;
  instructor: string;
  hours?: string;
  budget?: string;
};

type ActualCourseGroup = {
  id: string;
  code: string;
  title: string;
  owner: "CENTER" | "FACTORY";
  sessions: ActualCourse[];
};

type CourseOwner = ActualCourse["owner"];
type CourseOwnerFilter = CourseOwner | "";

const expenseFields: Array<{ key: ExpenseKey; label: string }> = [
  { key: "instructor", label: "ค่าวิทยากร / ค่าอบรม" },
  { key: "traveling", label: "ค่าเดินทาง" },
  { key: "seminarRoom", label: "ค่าสถานที่ / ห้องสัมมนา" },
  { key: "accommodation", label: "ค่าที่พัก" },
  { key: "material", label: "ค่าวัดผล / เอกสารประกอบ" },
  { key: "foodBeverage", label: "ค่าอาหารและเครื่องดื่ม" },
];

const expenseIcons: Record<ExpenseKey, string> = {
  instructor: "👨‍🏫",
  traveling: "🚗",
  seminarRoom: "🏢",
  accommodation: "🏨",
  material: "📚",
  foodBeverage: "🍱",
};

const emptyExpenses: Record<ExpenseKey, string> = {
  instructor: "",
  traveling: "",
  seminarRoom: "",
  accommodation: "",
  material: "",
  foodBeverage: "",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);

const parseMoney = (value?: string) => {
  const normalizedValue = value?.replace(/[^\d.-]/g, "") ?? "";
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

// Same shape TrainingRolling.tsx already uses to detect a center-owned plan — a course is
// "center" if it's owned centrally or targets every company, regardless of which field carries
// that signal for a given data source.
const isCenterCourse = (course: Pick<ActualCourse, "owner" | "ownerCompany" | "company">) =>
  course.owner === "CENTER" ||
  (course.ownerCompany ?? course.company) === "HRD Center" ||
  course.company === "All Companies";

export default function TrainingActual() {
  const user = useAuthenticatedUser();
  const toast = useToast();
  const { language } = useUiLanguage();
  const [courses, setCourses] = useState<ActualCourse[]>([]);
  const [courseOwnerFilter, setCourseOwnerFilter] = useState<CourseOwnerFilter>("");
  const [selectedCourseGroupId, setSelectedCourseGroupId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [savedSummaryData, setSavedSummaryData] = useState<{
    courseCode: string;
    courseTitle: string;
    batch: string;
    date: string;
    actualCount: number;
    totalCost: number;
    costPerPerson: number;
    savedTime: string;
  } | null>(null);
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const userCompanyCode = profileValue(user?.companyCode);
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [expenses, setExpenses] = useState<Record<ExpenseKey, string>>(emptyExpenses);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);

  useEffect(() => {
    void loadWorkflowRollingPlans().then(setRollingPlans);
  }, []);

  useEffect(() => {
    const nextCourses = rollingPlans
      .filter((plan) => plan.status === "Planned")
      .map<ActualCourse>((plan) => ({
        id: plan.rollingId,
        groupId: plan.scheduleGroupId,
        code: plan.course.code,
        title: plan.course.name,
        date: plan.trainingDate,
        batch: plan.batch,
        startTime: plan.startTime,
        endTime: plan.endTime,
        time: `${plan.startTime} - ${plan.endTime}`,
        room: plan.location,
        company: formatRollingPlanCompanies(plan),
        relatedCompanies: getRollingPlanCompanies(plan),
        owner: plan.ownerScope === "CENTER" ? "CENTER" : "FACTORY",
        ownerCompany:
          plan.ownerScope === "CENTER"
            ? "HRD Center"
            : plan.ownerCompany ?? plan.company,
        instructor: plan.trainer,
        hours: plan.hours,
        budget: plan.budget,
      }));

    setCourses(nextCourses);
  }, [rollingPlans]);
  const availableCourses = useMemo(
    () =>
      isFactoryUser
        ? courses.filter(
            (course) =>
              course.owner === "FACTORY" &&
              (course.ownerCompany ?? course.company) === userCompanyCode,
          )
        : courses,
    [courses, isFactoryUser, userCompanyCode],
  );

  useEffect(() => {
    if (isFactoryUser && courseOwnerFilter !== "FACTORY") {
      setCourseOwnerFilter("FACTORY");
    }
  }, [isFactoryUser, courseOwnerFilter]);
  const selectedCourseOwner: CourseOwnerFilter = courseOwnerFilter;
  const ownerFilteredCourses = useMemo(
    () =>
      selectedCourseOwner
        ? availableCourses.filter((course) => course.owner === selectedCourseOwner)
        : [],
    [availableCourses, selectedCourseOwner],
  );
  const availableCourseGroups = useMemo<ActualCourseGroup[]>(() => {
    const groups = new Map<string, ActualCourse[]>();

    ownerFilteredCourses.forEach((course) => {
      groups.set(course.groupId, [...(groups.get(course.groupId) ?? []), course]);
    });

    return [...groups.entries()].map(([id, sessions]) => {
      const sortedSessions = [...sessions].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startTime ?? "").localeCompare(b.startTime ?? ""),
      );
      const firstSession = sortedSessions[0];

      return {
        id,
        code: firstSession.code,
        title: firstSession.title,
        owner: firstSession.owner,
        sessions: sortedSessions,
      };
    });
  }, [ownerFilteredCourses]);
  const selectedCourseGroup =
    availableCourseGroups.find((group) => group.id === selectedCourseGroupId) ??
    null;
  const availableSessions = selectedCourseGroup?.sessions ?? [];
  const selectedCourse =
    availableSessions.find((course) => course.id === selectedCourseId) ?? null;
  const isSelectedCourseCenter = selectedCourse ? isCenterCourse(selectedCourse) : false;
  const isSelectedCourseReadOnlyForFactory = isFactoryUser && isSelectedCourseCenter;

  useEffect(() => {
    if (!selectedCourse) {
      setEnrollments([]);
      return;
    }
    let active = true;
    listEnrollments({ planId: selectedCourse.id, employeeId: null, employeeUserId: null })
      .then((result) => {
        if (active) setEnrollments(result.enrollments || []);
      })
      .catch((error) => {
        console.error("Failed to load attendees", error);
        if (active) setEnrollments([]);
      });
    return () => {
      active = false;
    };
  }, [selectedCourse?.id]);

  useEffect(() => {
    setExpenses(emptyExpenses);
    setSavedMessage("");
  }, [selectedCourse?.id]);

  const reloadCostBreakdown = async (planId: string) => {
    try {
      const result = await getCostBreakdown(planId);
      setCostBreakdown(result.costBreakdown);
    } catch (error) {
      console.error("Failed to load cost breakdown", error);
      setCostBreakdown(null);
    }
  };

  useEffect(() => {
    if (!selectedCourse) {
      setCostBreakdown(null);
      return;
    }
    void reloadCostBreakdown(selectedCourse.id);
  }, [selectedCourse?.id]);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCourse?.id]);

  const attendees: Attendee[] = selectedCourse
    ? enrollments
        .filter((candidate) =>
          selectedCourse.owner === "CENTER"
            ? candidate.status === "Center Approved"
            : candidate.status === "Factory Approved",
        )
        .map((candidate) => {
          const nameParts = parseNameParts(candidate.employeeName);
          return {
            id: candidate.id,
            employeeCode: candidate.employeeCode,
            name: candidate.employeeName,
            prefix: (candidate as any).prefix || nameParts.prefix,
            firstName: (candidate as any).firstName || nameParts.firstName,
            lastName: (candidate as any).lastName || nameParts.lastName,
            company: candidate.company,
            section: (candidate as any).section || "-",
            division: (candidate as any).division || "-",
            department: candidate.department || "-",
            position: candidate.position || "-",
            level: candidate.level || "-",
            registered: true,
            // Present-only, matching the server's cost-breakdown counting rule
            attended: candidate.attendance?.status === "PRESENT",
          };
        })
    : [];

  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [attendanceCompanyFilter, setAttendanceCompanyFilter] = useState("ALL");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");

  const filteredAttendees = useMemo(() => {
    return attendees.filter((attendee) => {
      if (
        attendanceCompanyFilter !== "ALL" &&
        attendee.company !== attendanceCompanyFilter
      ) {
        return false;
      }
      if (attendanceStatusFilter === "PRESENT" && !attendee.attended) {
        return false;
      }
      if (attendanceStatusFilter === "ABSENT" && attendee.attended) {
        return false;
      }
      if (attendanceSearchQuery.trim()) {
        const query = attendanceSearchQuery.toLowerCase().trim();
        const matchesCode = (attendee.employeeCode || "").toLowerCase().includes(query);
        const matchesName = (attendee.name || `${attendee.firstName} ${attendee.lastName}`).toLowerCase().includes(query);
        const matchesDept = (attendee.department || "").toLowerCase().includes(query);
        const matchesPos = (attendee.position || "").toLowerCase().includes(query);
        return matchesCode || matchesName || matchesDept || matchesPos;
      }
      return true;
    });
  }, [attendees, attendanceCompanyFilter, attendanceStatusFilter, attendanceSearchQuery]);

  const attendeeCompanyList = useMemo(() => {
    const companies = new Set<string>();
    attendees.forEach((att) => {
      if (att.company) companies.add(att.company);
    });
    return Array.from(companies).sort();
  }, [attendees]);

  const totalPages = Math.ceil(filteredAttendees.length / PAGE_SIZE) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * PAGE_SIZE;
  const pagedAttendees = useMemo(
    () => filteredAttendees.slice(startIndex, startIndex + PAGE_SIZE),
    [filteredAttendees, startIndex],
  );

  const actualCount = attendees.filter((attendee) => attendee.attended).length;
  const walkInCount = attendees.filter((attendee) => attendee.attended && !attendee.registered).length;
  const registeredCount = attendees.filter((attendee) => attendee.registered).length;
  const absentCount = attendees.length - actualCount;
  const expenseTotal = expenseFields.reduce(
    (total, field) => total + Number(expenses[field.key] || 0),
    0,
  );
  // Cost-per-person, planned/actual totals, and the company breakdown all come from the server
  // (app/lib/trainingRecord/repository.ts getCostBreakdown) rather than being derived from the
  // locally-fetched enrollments list: a HRD_FACTORY user viewing a HRD_CENTER-owned course only
  // ever gets their own employees back from listEnrollments, so a client-side sum can't produce
  // a correct course-wide total — the server computes it once with full visibility instead.
  const actualCostPerPerson = costBreakdown?.costPerPerson ?? 0;
  const savedActualTotal = costBreakdown?.actualGrandTotal ?? 0;
  const plannedBudget = costBreakdown?.plannedGrandTotal ?? (selectedCourse ? parseMoney(selectedCourse.budget) : 0);
  const remainingBudget = plannedBudget - savedActualTotal;
  const budgetStatus =
    plannedBudget > 0 && remainingBudget < 0 ? "Over budget" : "Within budget";
  const allAttended = Boolean(
    attendees.length && attendees.every((attendee) => attendee.attended),
  );
  const companyCostBreakdown = costBreakdown?.companyBreakdown ?? [];

  const reloadEnrollments = async () => {
    if (!selectedCourse) return;
    try {
      const result = await listEnrollments({ planId: selectedCourse.id, employeeId: null, employeeUserId: null });
      setEnrollments(result.enrollments || []);
    } catch (error) {
      console.error("Failed to reload attendees", error);
    }
  };

  const toggleAttendance = async (enrollmentId: string, attended: boolean) => {
    if (isSelectedCourseReadOnlyForFactory) return;
    try {
      await setEnrollmentAttendance(enrollmentId, { attended: !attended });
      await reloadEnrollments();
      if (selectedCourse) await reloadCostBreakdown(selectedCourse.id);
    } catch (error) {
      console.error("Failed to update attendance", error);
      toast.error("บันทึกการเช็คชื่อไม่สำเร็จ / Failed to update attendance");
    }
  };

  const setAllAttendance = async (attended: boolean) => {
    if (isSelectedCourseReadOnlyForFactory) return;
    try {
      await Promise.all(
        attendees
          .filter((attendee) => attendee.attended !== attended)
          .map((attendee) => setEnrollmentAttendance(attendee.id, { attended })),
      );
      await reloadEnrollments();
      if (selectedCourse) await reloadCostBreakdown(selectedCourse.id);
    } catch (error) {
      console.error("Failed to update attendance", error);
      toast.error("บันทึกการเช็คชื่อไม่สำเร็จ / Failed to update attendance");
    }
  };

  const updateExpense = (key: ExpenseKey, value: string) => {
    setExpenses((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!selectedCourse || isSelectedCourseReadOnlyForFactory) {
      return;
    }

    const now = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());

    try {
      await saveTrainingRecordExpenses(selectedCourse.id, {
        accommodation: Number(expenses.accommodation || 0),
        foodBeverage: Number(expenses.foodBeverage || 0),
        instructor: Number(expenses.instructor || 0),
        material: Number(expenses.material || 0),
        seminarRoom: Number(expenses.seminarRoom || 0),
        traveling: Number(expenses.traveling || 0),
      });
      await reloadCostBreakdown(selectedCourse.id);

      setSavedSummaryData({
        courseCode: selectedCourse.code,
        courseTitle: selectedCourse.title,
        batch: selectedCourse.batch ?? "1",
        date: selectedCourse.date,
        actualCount,
        totalCost: expenseTotal,
        costPerPerson: actualCostPerPerson,
        savedTime: now,
      });
      setShowSaveSuccessModal(true);

      setSavedMessage(
        `Saved ${selectedCourse.code} with ${actualCount} actual attendees, total THB ${formatCurrency(expenseTotal)} (THB ${formatCurrency(actualCostPerPerson)}/person) at ${now}.`,
      );
      toast.success("บันทึกข้อมูลการอบรมจริงแล้ว / Training actual saved");
    } catch (error) {
      console.error("Failed to save training expenses", error);
      toast.error("บันทึกค่าใช้จ่ายไม่สำเร็จ / Failed to save training expenses");
    }
  };

  return (
    <section className={styles.page} aria-label="Training Actual module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingActualModule.subtitle}</p>
          <h2>{trainingActualModule.title}</h2>
          <p>{trainingActualModule.description}</p>
        </div>
        <div className={styles.heroMeta}>
          <span>{actualCount} Actual</span>
          <span>
            {selectedCourseOwner
              ? selectedCourseOwner === "CENTER"
                ? "Center owner"
                : "Factory owner"
              : "Select owner"}
          </span>
          <span>THB {formatCurrency(expenseTotal)}</span>
          {selectedCourse && actualCount > 0 ? (
            <span className={styles.costPerPersonHeroBadge}>
              THB {formatCurrency(actualCostPerPerson)} / person
            </span>
          ) : null}
        </div>
      </section>

      {/* Course Picker Panel */}
      <section
        className={`${styles.actualCoursePickerPanel} ${styles.actualSelectorFirstPanel}`}
        aria-label="Select training actual course"
      >
        <div className={styles.courseSelectorControls}>
          <label className={styles.actualCourseSelect}>
            <span>Step 1 — สิทธิ์หลักสูตร (Owner)</span>
            <select
              value={selectedCourseOwner}
              onChange={(event) => {
                setCourseOwnerFilter(event.target.value as CourseOwnerFilter);
                setSelectedCourseGroupId("");
                setSelectedCourseId("");
                setSavedMessage("");
              }}
            >
              {!isFactoryUser && <option value="">เลือกสิทธิ์ผู้จัด (Center / Factory)</option>}
              {!isFactoryUser && <option value="CENTER">🏢 Center Standard (ส่วนกลาง)</option>}
              <option value="FACTORY">🏭 Factory (โรงงาน {userCompanyCode || ""})</option>
            </select>
          </label>

          <label className={styles.actualCourseSelect}>
            <span>Step 2 — เลือกหลักสูตร (Course)</span>
            <select
              disabled={!selectedCourseOwner}
              value={selectedCourseGroupId}
              onChange={(event) => {
                setSelectedCourseGroupId(event.target.value);
                setSelectedCourseId("");
                setSavedMessage("");
              }}
            >
              <option value="">
                {!selectedCourseOwner
                  ? "กรุณาเลือกผู้จัดหลักสูตรก่อน"
                  : availableCourseGroups.length > 0
                    ? "เลือกหลักสูตรที่ต้องการเช็คชื่อและคำนวณเงิน"
                    : `ไม่พบหลักสูตรในสิทธิ์ ${selectedCourseOwner}`}
              </option>
              {availableCourseGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  [{group.code}] {group.title} — งบประมาณ THB {formatCurrency(parseMoney(group.sessions[0]?.budget))} ({group.sessions.length} รอบอบรม)
                </option>
              ))}
            </select>
          </label>

          <label className={styles.actualCourseSelect}>
            <span>Step 3 — รอบการอบรม (Training Session)</span>
            <select
              disabled={!selectedCourseGroup}
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSavedMessage("");
              }}
            >
              <option value="">
                {selectedCourseGroup ? "เลือกรอบการอบรมที่ดำเนินการแล้ว" : "กรุณาเลือกหลักสูตรก่อน"}
              </option>
              {availableSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  Batch {session.batch ?? "1"} / วันที่ {session.date} ({session.time}) / ห้อง {session.room}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {selectedCourse ? (
        <section className={styles.actualWorkspace}>
          <div className={styles.actualMainPanel}>
            {/* Executive Course Detail Header Banner */}
            <div className={styles.actualCompactHeader}>
              <div>
                <div className={styles.heroBadgeRow}>
                  <b className={selectedCourse.owner === "CENTER" ? styles.systemSourceBadge : styles.uploadSourceBadge}>
                    {selectedCourse.owner === "CENTER" ? "🏢 Center Standard" : `🏭 ${selectedCourse.ownerCompany ?? selectedCourse.company} Scope`}
                  </b>
                  <span className={styles.totalBadge}>
                    Batch <strong>{selectedCourse.batch ?? "1"}</strong>
                  </span>
                </div>
                <h3>{selectedCourse.title}</h3>
                <span className={styles.courseMetaSubtext}>
                  📌 รหัสหลักสูตร: <strong>{selectedCourse.code}</strong> | 🏢 บริษัท: <strong>{selectedCourse.company}</strong> | 📅 วันที่: <strong>{selectedCourse.date}</strong> ({selectedCourse.time})
                </span>
              </div>

              <div className={styles.actualMiniStats}>
                <article>
                  <span>📍 สถานที่ / ห้อง</span>
                  <strong>{selectedCourse.room}</strong>
                </article>
                <article>
                  <span>👨‍🏫 วิทยากร</span>
                  <strong>{selectedCourse.instructor}</strong>
                </article>
                <article className={styles.actualBudgetStat}>
                  <span>💰 Planned Budget</span>
                  <strong>THB {formatCurrency(plannedBudget)}</strong>
                </article>
                <article>
                  <span>👥 ลงทะเบียน</span>
                  <strong>{registeredCount} คน</strong>
                </article>
                <article className={styles.actualBudgetStat}>
                  <span>🟢 เข้าเรียนจริง</span>
                  <strong>{actualCount} คน</strong>
                </article>
                <article>
                  <span>🔴 ขาดเรียน</span>
                  <strong>{absentCount} คน</strong>
                </article>
                <article className={styles.actualBudgetStat}>
                  <span>📊 Cost / Person (Actual)</span>
                  <strong>THB {formatCurrency(actualCostPerPerson)}</strong>
                </article>
              </div>
            </div>

            {isSelectedCourseReadOnlyForFactory ? (
              <div className={styles.actualPermissionNote}>
                แผนจัดอบรมของส่วนกลาง (HRD Center) — โรงงานดูรายงานได้แต่ไม่สามารถบันทึกการเข้าอบรมหรือค่าใช้จ่ายได้
              </div>
            ) : isFactoryUser ? (
              <div className={styles.actualPermissionNote}>
                Factory permission: courses owned by {userCompanyCode}, plus HRD Center courses (view-only).
              </div>
            ) : null}

            {/* Executive Attendance Checklist Workspace */}
            <div className={styles.attendanceChecklistWorkspace}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.kicker}>Attendance Checklist</p>
                  <h3>รายการเช็คชื่อเข้าร่วมอบรม</h3>
                </div>
                <div className={styles.attendanceHeaderActions}>
                  <span className={styles.attendanceProgressBadge}>
                    <span className={styles.glowingDotGreen} /> เข้าเรียน {actualCount} / {attendees.length} คน ({attendees.length ? Math.round((actualCount / attendees.length) * 100) : 0}%)
                  </span>
                  <button
                    type="button"
                    className={allAttended ? styles.activeActionButton : styles.actionButton}
                    disabled={attendees.length === 0 || isSelectedCourseReadOnlyForFactory}
                    onClick={() => void setAllAttendance(!allAttended)}
                  >
                    {allAttended ? "✕ ยกเลิกเช็คชื่อทั้งหมด" : "✓ เลือกเช็คชื่อทั้งหมด"}
                  </button>
                </div>
              </div>

              {/* Attendance Toolbar: Company Filters, Status Filters, & Real-Time Search */}
              <div className={styles.attendeeFilterToolbar}>
                <div className={styles.companyFilterChips}>
                  <button
                    type="button"
                    className={attendanceCompanyFilter === "ALL" ? styles.activeFilterChip : styles.filterChip}
                    onClick={() => setAttendanceCompanyFilter("ALL")}
                  >
                    ทุกบริษัท ({attendees.length})
                  </button>
                  {attendeeCompanyList.map((comp) => {
                    const count = attendees.filter((a) => a.company === comp).length;
                    return (
                      <button
                        key={comp}
                        type="button"
                        className={attendanceCompanyFilter === comp ? styles.activeFilterChip : styles.filterChip}
                        onClick={() => setAttendanceCompanyFilter(comp)}
                      >
                        {comp} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className={styles.companyFilterChips}>
                  <button
                    type="button"
                    className={attendanceStatusFilter === "ALL" ? styles.activeFilterChip : styles.filterChip}
                    onClick={() => setAttendanceStatusFilter("ALL")}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    className={attendanceStatusFilter === "PRESENT" ? styles.activeFilterChip : styles.filterChip}
                    onClick={() => setAttendanceStatusFilter("PRESENT")}
                  >
                    🟢 มาเรียน ({actualCount})
                  </button>
                  <button
                    type="button"
                    className={attendanceStatusFilter === "ABSENT" ? styles.activeFilterChip : styles.filterChip}
                    onClick={() => setAttendanceStatusFilter("ABSENT")}
                  >
                    🔴 ขาดเรียน ({absentCount})
                  </button>
                </div>

                <div className={styles.attendeeSearchBox}>
                  <span className={styles.searchIcon}>🔍</span>
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อ, รหัสพนักงาน, แผนก..."
                    value={attendanceSearchQuery}
                    onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                  />
                  {attendanceSearchQuery ? (
                    <button
                      type="button"
                      className={styles.clearSearchBtn}
                      onClick={() => setAttendanceSearchQuery("")}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Attendance Table */}
              <div className={`${styles.tableWrap} ${styles.attendanceTableWrap}`}>
                <table className={styles.recordTable}>
                  <thead>
                    <tr>
                      <th style={{ width: "135px" }}>เข้าร่วม</th>
                      <th>ข้อมูลพนักงาน</th>
                      <th>บริษัท / แผนก</th>
                      <th>ส่วน / ฝ่าย</th>
                      <th>ตำแหน่ง / ระดับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAttendees.map((attendee) => (
                      <tr
                        key={attendee.id}
                        className={attendee.attended ? styles.attendedRow : undefined}
                      >
                        <td className={styles.checkCell}>
                          <label className={styles.attendanceCheckLabel}>
                            <input
                              type="checkbox"
                              checked={attendee.attended}
                              disabled={isSelectedCourseReadOnlyForFactory}
                              onChange={() => void toggleAttendance(attendee.id, attendee.attended)}
                            />
                            <span
                              className={
                                attendee.attended
                                  ? styles.passBadge
                                  : styles.failBadge
                              }
                            >
                              {attendee.attended ? (
                                <>
                                  <span className={styles.glowingDotGreen} /> มาเรียน
                                </>
                              ) : (
                                <>
                                  <span className={styles.glowingDotRed} /> ขาดเรียน
                                </>
                              )}
                            </span>
                          </label>
                        </td>
                        <td>
                          <div>
                            <strong className={styles.attendeeFirstName}>
                              {attendee.prefix !== "-" ? `${attendee.prefix} ` : ""}
                              {attendee.firstName} {attendee.lastName}
                            </strong>
                            <span className={styles.attendeeCodeTag}>{attendee.employeeCode}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.deptCell}>
                            <span className={styles.companyPillBadge}>{attendee.company || "-"}</span>
                            <span className={styles.attendeeDeptText}>{attendee.department || "-"}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.orgCell}>
                            <span className={styles.orgText}>{attendee.section || "-"}</span>
                            <span className={styles.orgSubText}>{attendee.division || "-"}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.posCell}>
                            <span className={styles.positionText}>{attendee.position || "-"}</span>
                            <span className={styles.levelBadge}>{attendee.level || "-"}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pagedAttendees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={styles.emptyTableMessage}>
                          🔍 ไม่พบรายชื่อพนักงานในการอบรมตามเงื่อนไขค้นหา
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 ? (
              <div className={styles.actualPaginationBar}>
                <span className={styles.paginationInfo}>
                  แสดง {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, attendees.length)} จากทั้งหมด {attendees.length} คน (หน้า {activePage} จาก {totalPages})
                </span>
                <div className={styles.paginationNav}>
                  <button
                    className={styles.pageBtn}
                    type="button"
                    disabled={activePage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    title="หน้าก่อนหน้า"
                  >
                    ‹
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      className={`${styles.pageBtn} ${p === activePage ? styles.pageBtnActive : ""}`}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    className={styles.pageBtn}
                    type="button"
                    disabled={activePage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    title="หน้าถัดไป"
                  >
                    ›
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Executive Expense Calculation Sidebar */}
          <aside className={styles.actualCostPanel} aria-label="Actual training expenses">
            <div className={styles.actualCostHeader}>
              <div>
                <p className={styles.kicker}>Expense Calculation</p>
                <h3>ทดสอบระบบคำนวณเงิน</h3>
                <span>บันทึกและทดสอบค่าใช้จ่ายจริงที่เกิดขึ้นในการอบรม</span>
              </div>
            </div>

            <div className={styles.actualCostGrid}>
              {expenseFields.map((field) => (
                <label key={field.key} className={styles.expenseInputCard}>
                  <div className={styles.expenseLabelHeader}>
                    <span>{expenseIcons[field.key]} {field.label}</span>
                  </div>
                  <div className={styles.expenseInputWrap}>
                    <span className={styles.currencyPrefix}>THB</span>
                    <input
                      inputMode="decimal"
                      disabled={isSelectedCourseReadOnlyForFactory}
                      placeholder="0"
                      value={expenses[field.key]}
                      onChange={(event) => updateExpense(field.key, event.target.value)}
                    />
                  </div>
                </label>
              ))}
            </div>

            <div className={styles.actualTotalBox}>
              <span>รวมค่าใช้จ่ายจริง (Draft Unsaved)</span>
              <strong>THB {formatCurrency(expenseTotal)}</strong>
            </div>

            {/* Variance Analysis Table */}
            <div className={`${styles.tableWrap}`}>
              <table className={styles.recordTable}>
                <thead>
                  <tr>
                    <th>หมวดหมู่</th>
                    <th>งบประมาณ (Planned)</th>
                    <th>จ่ายจริง (Saved)</th>
                    <th>ส่วนต่าง (Variance)</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseFields.map((field) => {
                    const planned = costBreakdown?.plannedTotals[field.key] ?? 0;
                    const actual = costBreakdown?.actualTotals[field.key] ?? 0;
                    const variance = planned - actual;
                    return (
                      <tr key={field.key}>
                        <td>{expenseIcons[field.key]} {field.label}</td>
                        <td>THB {formatCurrency(planned)}</td>
                        <td>THB {formatCurrency(actual)}</td>
                        <td className={variance < 0 ? styles.actualBudgetOverrun : undefined}>
                          {variance >= 0 ? `+THB ${formatCurrency(variance)}` : `-THB ${formatCurrency(Math.abs(variance))}`}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td><strong>รวมทั้งหมด (Total)</strong></td>
                    <td><strong>THB {formatCurrency(plannedBudget)}</strong></td>
                    <td><strong>THB {formatCurrency(savedActualTotal)}</strong></td>
                    <td className={remainingBudget < 0 ? styles.actualBudgetOverrun : undefined}>
                      <strong>{remainingBudget >= 0 ? `+THB ${formatCurrency(remainingBudget)}` : `-THB ${formatCurrency(Math.abs(remainingBudget))}`}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.actualCostPerPersonSummary}>
              <div>
                <span>เฉลี่ยงบ/คน (Cost / Person)</span>
                <strong>THB {formatCurrency(actualCostPerPerson)}</strong>
              </div>
              <small>
                {(() => {
                  // Built at call time with the totals in it, so the DOM localizer can never
                  // match it against a dictionary key — pick the language here instead.
                  const present = costBreakdown?.presentCount ?? 0;
                  const total = formatCurrency(savedActualTotal);
                  return language === "th"
                    ? `คำนวณจาก THB ${total} ÷ ผู้เข้าอบรมจริง ${present} คน`
                    : `Calculated from THB ${total} ÷ ${present} present attendee${present === 1 ? "" : "s"}`;
                })()}
              </small>
            </div>

            {companyCostBreakdown.length > 0 ? (
              <div className={styles.actualCompanyBreakdownBox}>
                <div className={styles.companyBreakdownHeader}>
                  <p className={styles.kicker}>Company Cost Share</p>
                  <h4>
                    {isSelectedCourseReadOnlyForFactory || (isFactoryUser && isSelectedCourseCenter)
                      ? "งบปันส่วนบริษัทของคุณ (Your Company Allocation)"
                      : "การปันส่วนงบประมาณตามบริษัท"}
                  </h4>
                </div>

                <div className={styles.companyCostTableWrap}>
                  <table className={styles.companyCostTable}>
                    <thead>
                      <tr>
                        <th>บริษัท</th>
                        <th>ผู้เข้าเรียน</th>
                        <th>สัดส่วน %</th>
                        <th style={{ textAlign: "right" }}>งบปันส่วน (THB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyCostBreakdown.map((item) => {
                        const totalPresent = costBreakdown?.presentCount || actualCount || 1;
                        const pct = Math.round((item.presentCount / totalPresent) * 100);
                        return (
                          <tr key={item.companyCode}>
                            <td>
                              <span className={styles.companyBadgePill}>{item.companyCode}</span>
                            </td>
                            <td>
                              <span className={styles.companyPresentCount}>🟢 {item.presentCount} คน</span>
                            </td>
                            <td>
                              <div className={styles.sharePercentCell}>
                                <div className={styles.sharePercentBarWrap}>
                                  <div
                                    className={styles.sharePercentBar}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className={styles.sharePercentText}>{pct}%</span>
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <strong className={styles.allocatedCostText}>
                                THB {formatCurrency(item.allocatedCost)}
                              </strong>
                            </td>
                          </tr>
                        );
                      })}
                      {isFactoryUser && isSelectedCourseCenter ? (
                        <tr className={styles.companyTotalRow}>
                          <td colSpan={3}>
                            <strong>รวมทุกบริษัท (All Companies Total)</strong>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <strong className={styles.allocatedCostText}>
                              THB {formatCurrency(savedActualTotal)}
                            </strong>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className={styles.actualBudgetSummary}>
              <div>
                <span>งบประมาณที่วางแผนไว้</span>
                <strong>THB {formatCurrency(plannedBudget)}</strong>
              </div>
              <div
                className={
                  remainingBudget < 0 ? styles.actualBudgetOverrun : undefined
                }
              >
                <span>งบประมาณคงเหลือ</span>
                <strong>THB {formatCurrency(remainingBudget)}</strong>
              </div>
              <p
                className={
                  remainingBudget < 0 ? styles.actualBudgetOverrun : undefined
                }
              >
                {remainingBudget >= 0 ? "🟢 อยู่ในงบประมาณ (Within budget)" : "🔴 เกินงบประมาณ (Over budget)"}
              </p>
            </div>

            <button
              className={styles.actualSaveButton}
              type="button"
              disabled={isSelectedCourseReadOnlyForFactory}
              title={
                isSelectedCourseReadOnlyForFactory
                  ? "หลักสูตรของส่วนกลาง โรงงานดูได้อย่างเดียว แก้ไขไม่ได้ (Center course — read-only for factory users)"
                  : undefined
              }
              onClick={() => void handleSave()}
            >
              💾 บันทึกข้อมูลการอบรม & คำนวณเงิน
            </button>

            {savedMessage ? <p className={styles.actualSavedMessage}>{savedMessage}</p> : null}
          </aside>
        </section>
      ) : (
        <section className={styles.emptyState} aria-label="No selected actual course">
          กรุณาเลือกหลักสูตรก่อนเพื่อบันทึกและแสดงข้อมูลการอบรมจริง (Select a course first to show training actual details)
        </section>
      )}

      {/* Save Success Dialog Modal */}
      {showSaveSuccessModal && savedSummaryData ? (
        <div className={styles.successModalBackdrop} onClick={() => setShowSaveSuccessModal(false)}>
          <div
            className={styles.successModalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.successIconRing}>
              <span className={styles.checkIconEmoji}>✓</span>
            </div>

            <div className={styles.successModalHeader}>
              <h3>บันทึกข้อมูลการอบรมจริงสำเร็จ!</h3>
              <p>ระบบทำการบันทึกยอดผู้เข้าอบรมจริงและค่าใช้จ่ายเรียบร้อยแล้ว</p>
            </div>

            <div className={styles.successCourseCard}>
              <div className={styles.successCourseCodeBadge}>[{savedSummaryData.courseCode}]</div>
              <div className={styles.successCourseTitle}>{savedSummaryData.courseTitle}</div>
              <div className={styles.successCourseMeta}>
                Batch <strong>{savedSummaryData.batch}</strong> • วันที่ <strong>{savedSummaryData.date}</strong>
              </div>
            </div>

            <div className={styles.savedMetricGrid}>
              <div className={styles.savedMetricCard}>
                <span>🟢 ผู้เข้าเรียนจริง</span>
                <strong>{savedSummaryData.actualCount} คน</strong>
              </div>
              <div className={styles.savedMetricCard}>
                <span>💰 รวมค่าใช้จ่ายจริง</span>
                <strong>THB {formatCurrency(savedSummaryData.totalCost)}</strong>
              </div>
              <div className={styles.savedMetricCard}>
                <span>📊 เฉลี่ยงบ / คน</span>
                <strong>THB {formatCurrency(savedSummaryData.costPerPerson)}</strong>
              </div>
            </div>

            <div className={styles.savedTimestamp}>
              ⏰ บันทึกเมื่อ: {savedSummaryData.savedTime}
            </div>

            <div className={styles.successModalActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setShowSaveSuccessModal(false)}
              >
                ✓ ตกลง (Done)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
