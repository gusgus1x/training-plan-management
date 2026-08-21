"use client";

import { useEffect, useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
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
  { key: "instructor", label: "Instructor" },
  { key: "traveling", label: "Traveling" },
  { key: "seminarRoom", label: "Seminar Room" },
  { key: "accommodation", label: "Accommodation" },
  { key: "material", label: "Material" },
  { key: "foodBeverage", label: "Food & Beverage" },
];

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
  const [courses, setCourses] = useState<ActualCourse[]>([]);
  const [courseOwnerFilter, setCourseOwnerFilter] = useState<CourseOwnerFilter>("");
  const [selectedCourseGroupId, setSelectedCourseGroupId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
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
    listEnrollments({ planId: selectedCourse.id, employeeId: null })
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

  const totalPages = Math.ceil(attendees.length / PAGE_SIZE) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * PAGE_SIZE;
  const pagedAttendees = useMemo(
    () => attendees.slice(startIndex, startIndex + PAGE_SIZE),
    [attendees, startIndex],
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
      const result = await listEnrollments({ planId: selectedCourse.id, employeeId: null });
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
      setSavedMessage("Failed to update attendance.");
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
      setSavedMessage("Failed to update attendance.");
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

      setSavedMessage(
        `Saved ${selectedCourse.code} with ${actualCount} actual attendees, total THB ${formatCurrency(expenseTotal)} (THB ${formatCurrency(actualCostPerPerson)}/person) at ${now}.`,
      );
    } catch (error) {
      console.error("Failed to save training expenses", error);
      setSavedMessage("Failed to save training expenses.");
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

      <section
        className={`${styles.actualCoursePickerPanel} ${styles.actualSelectorFirstPanel}`}
        aria-label="Select training actual course"
      >
        <div className={styles.courseSelectorControls}>
          <label className={styles.actualCourseSelect}>
            Course Owner
            <select
              value={selectedCourseOwner}
              onChange={(event) => {
                setCourseOwnerFilter(event.target.value as CourseOwnerFilter);
                setSelectedCourseGroupId("");
                setSelectedCourseId("");
                setSavedMessage("");
              }}
            >
              {!isFactoryUser && <option value="">Select Course Owner</option>}
              {!isFactoryUser && <option value="CENTER">Center</option>}
              <option value="FACTORY">Factory</option>
            </select>
          </label>
          <label className={styles.actualCourseSelect}>
            Course
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
                  ? "Select course owner first"
                  : availableCourseGroups.length > 0
                    ? "Select actual course"
                    : `No ${selectedCourseOwner.toLowerCase()} course available`}
              </option>
              {availableCourseGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.code} / {group.title} / THB{" "}
                  {formatCurrency(parseMoney(group.sessions[0]?.budget))} /{" "}
                  {group.sessions.length} sessions
                </option>
              ))}
            </select>
          </label>
          <label className={styles.actualCourseSelect}>
            Training Session
            <select
              disabled={!selectedCourseGroup}
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSavedMessage("");
              }}
            >
              <option value="">
                {selectedCourseGroup ? "Select training session" : "Select course first"}
              </option>
              {availableSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.batch ?? "-"} / {session.date} / {session.time} / {session.room}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <p className={styles.kicker}>Course Owner</p>
          <h3>Select owner first</h3>
          <span>Choose an owner first, then select a course to record actual attendance and training expenses.</span>
        </div>
      </section>

      {selectedCourse ? (
        <section className={styles.actualWorkspace}>
          <div className={styles.actualMainPanel}>
            <div className={styles.actualCompactHeader}>
              <div>
                <p className={styles.kicker}>Course Selection</p>
                <h3>{selectedCourse.title}</h3>
                <span>
                  {selectedCourse.code} / Batch {selectedCourse.batch ?? "-"} / {selectedCourse.company} / {selectedCourse.date} / {selectedCourse.time}
                </span>
              </div>

              <div className={styles.actualMiniStats}>
                <article>
                  <span>Room</span>
                  <strong>{selectedCourse.room}</strong>
                </article>
                <article>
                  <span>Instructor</span>
                  <strong>{selectedCourse.instructor}</strong>
                </article>
                <article className={styles.actualBudgetStat}>
                  <span>Planned Budget</span>
                  <strong>THB {formatCurrency(plannedBudget)}</strong>
                </article>
                <article>
                  <span>Registered</span>
                  <strong>{registeredCount}</strong>
                </article>
                <article>
                  <span>Actual</span>
                  <strong>{actualCount}</strong>
                </article>
                <article>
                  <span>Absent</span>
                  <strong>{absentCount}</strong>
                </article>
                <article className={styles.actualBudgetStat}>
                  <span>Cost / Person (Actual)</span>
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

            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Attendance Checklist</p>
                <h3>รายการเช็คชื่อเข้าร่วมอบรม</h3>
              </div>
              <div className={styles.attendanceHeaderActions}>
                <span className={styles.attendanceProgressBadge}>
                  ✓ เข้าเรียน {actualCount} / {attendees.length} คน
                </span>
                <label className={styles.selectAllAttendance}>
                  <input
                    checked={allAttended}
                    disabled={attendees.length === 0 || isSelectedCourseReadOnlyForFactory}
                    type="checkbox"
                    onChange={() => void setAllAttendance(!allAttended)}
                  />
                  <span>{allAttended ? "✕ ยกเลิกทั้งหมด" : "✓ เลือกทั้งหมด"}</span>
                </label>
              </div>
            </div>

            <div className={`${styles.tableWrap} ${styles.attendanceTableWrap}`}>
              <table className={styles.recordTable}>
                <thead>
                  <tr>
                    <th style={{ width: "110px" }}>เข้าร่วม</th>
                    <th>รหัสพนักงาน</th>
                    <th>คำนำหน้า</th>
                    <th>ชื่อ</th>
                    <th>นามสกุล</th>
                    <th>บริษัท</th>
                    <th>ส่วน</th>
                    <th>ฝ่าย</th>
                    <th>แผนก</th>
                    <th>ตำแหน่ง</th>
                    <th>ระดับ</th>
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
                                ? styles.attendStatusPresent
                                : styles.attendStatusAbsent
                            }
                          >
                            {attendee.attended ? "✓ มา" : "✕ ขาด"}
                          </span>
                        </label>
                      </td>
                      <td>
                        <span className={styles.attendeeCodePill}>{attendee.employeeCode}</span>
                      </td>
                      <td>
                        <span className={styles.prefixPill}>{attendee.prefix || "-"}</span>
                      </td>
                      <td>
                        <strong className={styles.attendeeFirstName}>{attendee.firstName}</strong>
                      </td>
                      <td>
                        <span className={styles.attendeeLastName}>{attendee.lastName}</span>
                      </td>
                      <td>
                        <span
                          className={`${styles.companyPill} ${
                            attendee.company === "TEP"
                              ? styles.companyTep
                              : attendee.company === "ATA"
                                ? styles.companyAta
                                : styles.companyDefault
                          }`}
                        >
                          {attendee.company || "-"}
                        </span>
                      </td>
                      <td>
                        <span className={styles.orgText}>{attendee.section || "-"}</span>
                      </td>
                      <td>
                        <span className={styles.orgText}>{attendee.division || "-"}</span>
                      </td>
                      <td>
                        <span className={styles.deptBadge}>{attendee.department || "-"}</span>
                      </td>
                      <td>
                        <span className={styles.positionPill}>{attendee.position || "-"}</span>
                      </td>
                      <td>
                        <span className={styles.levelBadge}>{attendee.level || "-"}</span>
                      </td>
                    </tr>
                  ))}
                  {pagedAttendees.length === 0 ? (
                    <tr>
                      <td colSpan={11} className={styles.emptyTableMessage}>
                        ไม่พบรายชื่อพนักงานในการอบรมนี้
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
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

          <aside className={styles.actualCostPanel} aria-label="Actual training expenses">
            <div className={styles.actualCostHeader}>
              <div>
                <p className={styles.kicker}>Actual Cost</p>
                <h3>Training Expenses</h3>
                <span>Record the real cost used for this course.</span>
              </div>
            </div>

            <div className={styles.actualCostGrid}>
              {expenseFields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    inputMode="decimal"
                    disabled={isSelectedCourseReadOnlyForFactory}
                    value={expenses[field.key]}
                    onChange={(event) => updateExpense(field.key, event.target.value)}
                  />
                </label>
              ))}
            </div>

            <div className={styles.actualTotalBox}>
              <span>Total Actual Cost (unsaved draft)</span>
              <strong>THB {formatCurrency(expenseTotal)}</strong>
            </div>

            <div className={`${styles.tableWrap}`}>
              <table className={styles.recordTable}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Planned</th>
                    <th>Actual (saved)</th>
                    <th>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseFields.map((field) => {
                    const planned = costBreakdown?.plannedTotals[field.key] ?? 0;
                    const actual = costBreakdown?.actualTotals[field.key] ?? 0;
                    const variance = planned - actual;
                    return (
                      <tr key={field.key}>
                        <td>{field.label}</td>
                        <td>THB {formatCurrency(planned)}</td>
                        <td>THB {formatCurrency(actual)}</td>
                        <td className={variance < 0 ? styles.actualBudgetOverrun : undefined}>
                          THB {formatCurrency(variance)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>THB {formatCurrency(plannedBudget)}</strong></td>
                    <td><strong>THB {formatCurrency(savedActualTotal)}</strong></td>
                    <td className={remainingBudget < 0 ? styles.actualBudgetOverrun : undefined}>
                      <strong>THB {formatCurrency(remainingBudget)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.actualCostPerPersonSummary}>
              <div>
                <span>Cost / Person (Actual, saved)</span>
                <strong>THB {formatCurrency(actualCostPerPerson)}</strong>
              </div>
              <small>
                Calculated from THB {formatCurrency(savedActualTotal)} ÷ {costBreakdown?.presentCount ?? 0} present attendee{(costBreakdown?.presentCount ?? 0) === 1 ? "" : "s"}
              </small>
            </div>

            {companyCostBreakdown.length > 0 ? (
              <div className={styles.actualCompanyBreakdownBox}>
                <p className={styles.kicker}>
                  {isSelectedCourseReadOnlyForFactory || (isFactoryUser && isSelectedCourseCenter)
                    ? "Company Cost Allocation (your company)"
                    : "Company Cost Allocation"}
                </p>
                <div className={styles.actualCompanyList}>
                  {companyCostBreakdown.map((item) => (
                    <div key={item.companyCode} className={styles.actualCompanyRow}>
                      <div>
                        <strong>{item.companyCode}</strong>
                        <span>{item.presentCount} present</span>
                      </div>
                      <strong>THB {formatCurrency(item.allocatedCost)}</strong>
                    </div>
                  ))}
                  {isFactoryUser && isSelectedCourseCenter ? (
                    <div className={styles.actualCompanyRow}>
                      <div>
                        <strong>Course total (all companies)</strong>
                        <span>{costBreakdown?.presentCount ?? 0} present</span>
                      </div>
                      <strong>THB {formatCurrency(savedActualTotal)}</strong>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className={styles.actualBudgetSummary}>
              <div>
                <span>Planned Budget</span>
                <strong>THB {formatCurrency(plannedBudget)}</strong>
              </div>
              <div
                className={
                  remainingBudget < 0 ? styles.actualBudgetOverrun : undefined
                }
              >
                <span>Remaining Budget</span>
                <strong>THB {formatCurrency(remainingBudget)}</strong>
              </div>
              <p
                className={
                  remainingBudget < 0 ? styles.actualBudgetOverrun : undefined
                }
              >
                {budgetStatus}
              </p>
            </div>

            <button
              className={styles.actualSaveButton}
              type="button"
              disabled={isSelectedCourseReadOnlyForFactory}
              onClick={() => void handleSave()}
            >
              Save Training Actual
            </button>

            {savedMessage ? <p className={styles.actualSavedMessage}>{savedMessage}</p> : null}
          </aside>
        </section>
      ) : (
        <section className={styles.emptyState} aria-label="No selected actual course">
          Select a course first to show training actual details.
        </section>
      )}
    </section>
  );
}
