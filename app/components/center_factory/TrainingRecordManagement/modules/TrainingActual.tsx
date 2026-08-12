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
import { saveTrainingRecordExpenses } from "../../../../lib/trainingRecord/client";
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
  department: string;
  company?: string;
  registered: boolean;
  attended: boolean;
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
  const selectedCourseOwner: CourseOwnerFilter = isFactoryUser ? "FACTORY" : courseOwnerFilter;
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

  const attendees: Attendee[] = selectedCourse
    ? enrollments
        .filter((candidate) =>
          selectedCourse.owner === "CENTER"
            ? candidate.status === "Center Approved"
            : candidate.status === "Factory Approved",
        )
        .map((candidate) => ({
          id: candidate.id,
          employeeCode: candidate.employeeCode,
          name: candidate.employeeName,
          department: candidate.department,
          company: candidate.company,
          registered: true,
          attended: candidate.attendance !== null,
        }))
    : [];

  const actualCount = attendees.filter((attendee) => attendee.attended).length;
  const walkInCount = attendees.filter((attendee) => attendee.attended && !attendee.registered).length;
  const registeredCount = attendees.filter((attendee) => attendee.registered).length;
  const absentCount = attendees.length - actualCount;
  const expenseTotal = expenseFields.reduce(
    (total, field) => total + Number(expenses[field.key] || 0),
    0,
  );
  const actualCostPerPerson = actualCount > 0 ? Math.round(expenseTotal / actualCount) : 0;
  const plannedBudget = selectedCourse ? parseMoney(selectedCourse.budget) : 0;
  const remainingBudget = plannedBudget - expenseTotal;
  const budgetStatus =
    plannedBudget > 0 && remainingBudget < 0 ? "Over budget" : "Within budget";
  const allAttended = Boolean(
    attendees.length && attendees.every((attendee) => attendee.attended),
  );

  const companyCostBreakdown = useMemo(() => {
    const companyMap = new Map<string, { total: number; attended: number }>();
    attendees.forEach((attendee) => {
      const companyKey = attendee.company || selectedCourse?.company || "Other";
      const current = companyMap.get(companyKey) ?? { total: 0, attended: 0 };
      current.total += 1;
      if (attendee.attended) {
        current.attended += 1;
      }
      companyMap.set(companyKey, current);
    });

    return Array.from(companyMap.entries()).map(([company, data]) => ({
      company,
      total: data.total,
      attended: data.attended,
      allocatedCost: data.attended * actualCostPerPerson,
    }));
  }, [attendees, selectedCourse, actualCostPerPerson]);

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
    try {
      await setEnrollmentAttendance(enrollmentId, { attended: !attended });
      await reloadEnrollments();
    } catch (error) {
      console.error("Failed to update attendance", error);
      setSavedMessage("Failed to update attendance.");
    }
  };

  const setAllAttendance = async (attended: boolean) => {
    try {
      await Promise.all(
        attendees
          .filter((attendee) => attendee.attended !== attended)
          .map((attendee) => setEnrollmentAttendance(attendee.id, { attended })),
      );
      await reloadEnrollments();
    } catch (error) {
      console.error("Failed to update attendance", error);
      setSavedMessage("Failed to update attendance.");
    }
  };

  const updateExpense = (key: ExpenseKey, value: string) => {
    setExpenses((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!selectedCourse) {
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
              disabled={isFactoryUser}
              value={selectedCourseOwner}
              onChange={(event) => {
                setCourseOwnerFilter(event.target.value as CourseOwnerFilter);
                setSelectedCourseGroupId("");
                setSelectedCourseId("");
                setSavedMessage("");
              }}
            >
              <option value="">Select Course Owner</option>
              <option value="CENTER">Center</option>
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

            {isFactoryUser ? (
              <div className={styles.actualPermissionNote}>
                Factory permission: only courses owned by {userCompanyCode} are available.
              </div>
            ) : null}

            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Attendance Check</p>
                <h3>Actual Attendees</h3>
              </div>
              <div className={styles.attendanceHeaderActions}>
                <span>{actualCount} / {attendees.length} attended</span>
                <label className={styles.selectAllAttendance}>
                  <input
                    checked={allAttended}
                    disabled={attendees.length === 0}
                    type="checkbox"
                    onChange={() => void setAllAttendance(!allAttended)}
                  />
                  <span>{allAttended ? "Clear all" : "Select all"}</span>
                </label>
              </div>
            </div>

            <div className={`${styles.tableWrap} ${styles.attendanceTableWrap}`}>
            <table className={styles.recordTable}>
              <thead>
                <tr>
                  <th>Attend</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Source</th>
                  <th>Actual Cost</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee) => (
                  <tr key={attendee.id}>
                    <td>
                      <label className={styles.attendanceCheck}>
                        <input
                          type="checkbox"
                          checked={attendee.attended}
                          onChange={() => void toggleAttendance(attendee.id, attendee.attended)}
                        />
                        <span>{attendee.attended ? "Attend" : "Absent"}</span>
                      </label>
                    </td>
                    <td>
                      <strong>{attendee.name}</strong>
                      <span>
                        {attendee.employeeCode}
                        {attendee.company ? ` (${attendee.company})` : ""}
                      </span>
                    </td>
                    <td>{attendee.department}</td>
                    <td>
                      <span className={attendee.registered ? styles.statusPill : styles.walkInPill}>
                        {attendee.registered ? "Registered" : "Walk-in"}
                      </span>
                    </td>
                    <td>
                      {attendee.attended ? (
                        <span className={styles.attendeeCostBadge}>
                          THB {formatCurrency(actualCostPerPerson)}
                        </span>
                      ) : (
                        <span className={styles.attendeeCostBadgeAbsent}>
                          THB 0 (Absent)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                    value={expenses[field.key]}
                    onChange={(event) => updateExpense(field.key, event.target.value)}
                  />
                </label>
              ))}
            </div>

            <div className={styles.actualTotalBox}>
              <span>Total Actual Cost</span>
              <strong>THB {formatCurrency(expenseTotal)}</strong>
            </div>

            <div className={styles.actualCostPerPersonSummary}>
              <div>
                <span>Cost / Person (Actual)</span>
                <strong>THB {formatCurrency(actualCostPerPerson)}</strong>
              </div>
              <small>
                Calculated from THB {formatCurrency(expenseTotal)} ÷ {actualCount} actual attendee{actualCount === 1 ? "" : "s"}
              </small>
            </div>

            {companyCostBreakdown.length > 0 ? (
              <div className={styles.actualCompanyBreakdownBox}>
                <p className={styles.kicker}>Company Cost Allocation</p>
                <div className={styles.actualCompanyList}>
                  {companyCostBreakdown.map((item) => (
                    <div key={item.company} className={styles.actualCompanyRow}>
                      <div>
                        <strong>{item.company}</strong>
                        <span>
                          {item.attended} / {item.total} attended
                        </span>
                      </div>
                      <strong>THB {formatCurrency(item.allocatedCost)}</strong>
                    </div>
                  ))}
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

            <button className={styles.actualSaveButton} type="button" onClick={() => void handleSave()}>
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
