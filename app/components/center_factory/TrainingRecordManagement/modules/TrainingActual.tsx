"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  readWorkflowCollection,
  writeWorkflowCollection,
  type WorkflowAcceptance,
  type WorkflowCompletedCourse,
} from "../../../../lib/trainingWorkflow";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import type { RollingPlan } from "../../TrainingPlanManagement/modules/TrainingRolling";
import styles from "./TrainingRecord.module.css";

export const trainingActualModule = {
  title: "Training Actual",
  subtitle: "Actual Attendance",
  description:
    "Check actual attendance, add unregistered attendees, record real training expenses, and save the completed actual record.",
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
  code: string;
  title: string;
  date: string;
  time: string;
  room: string;
  company: string;
  owner: "CENTER" | "FACTORY";
  instructor: string;
  hours?: string;
  attendees: Attendee[];
  expenses: Record<ExpenseKey, string>;
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

const initialCourses: ActualCourse[] = [
  {
    id: "course-001",
    code: "SAFE-2026-08",
    title: "Safety & Compliance Basics",
    date: "2026-08-21",
    time: "10:00 - 12:00",
    room: "Auditorium",
    company: "SNF",
    owner: "FACTORY",
    instructor: "Safety Team",
    attendees: [
      {
        id: "att-001",
        employeeCode: "HRD-001",
        name: "Narin Chaiya",
        department: "Production",
        registered: true,
        attended: true,
      },
      {
        id: "att-002",
        employeeCode: "HRD-014",
        name: "Maliwan S.",
        department: "Quality",
        registered: true,
        attended: false,
      },
      {
        id: "att-003",
        employeeCode: "SNF-5621",
        name: "Kittipong R.",
        department: "Maintenance",
        registered: false,
        attended: true,
      },
    ],
    expenses: {
      instructor: "12000",
      traveling: "1800",
      seminarRoom: "3500",
      accommodation: "0",
      material: "2400",
      foodBeverage: "4200",
    },
  },
  {
    id: "course-002",
    code: "PDPA-2026-07",
    title: "Data Privacy Awareness",
    date: "2026-07-15",
    time: "09:30 - 11:30",
    room: "Online",
    company: "All Companies",
    owner: "CENTER",
    instructor: "IT Governance",
    attendees: [
      {
        id: "att-004",
        employeeCode: "HRD-003",
        name: "Suda K.",
        department: "Human Resources",
        registered: true,
        attended: true,
      },
      {
        id: "att-005",
        employeeCode: "HRD-019",
        name: "Anucha P.",
        department: "IT",
        registered: true,
        attended: true,
      },
    ],
    expenses: {
      instructor: "8500",
      traveling: "0",
      seminarRoom: "0",
      accommodation: "0",
      material: "1200",
      foodBeverage: "0",
    },
  },
  {
    id: "course-003",
    code: "SERV-2026-09",
    title: "Service Mind for Frontline",
    date: "2026-09-08",
    time: "09:00 - 16:00",
    room: "Training Room B",
    company: "ATFB",
    owner: "FACTORY",
    instructor: "Maliwan P.",
    attendees: [
      {
        id: "att-006",
        employeeCode: "HRD-028",
        name: "Pimchanok T.",
        department: "Sales",
        registered: true,
        attended: false,
      },
      {
        id: "att-007",
        employeeCode: "HRD-033",
        name: "Thanawat M.",
        department: "Customer Service",
        registered: false,
        attended: true,
      },
    ],
    expenses: {
      instructor: "15000",
      traveling: "2500",
      seminarRoom: "5000",
      accommodation: "3800",
      material: "3100",
      foodBeverage: "6400",
    },
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);

export default function TrainingActual() {
  const user = useAuthenticatedUser();
  const [courses, setCourses] = useState<ActualCourse[]>([]);
  const [courseOwnerFilter, setCourseOwnerFilter] = useState<CourseOwnerFilter>("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const userCompanyCode = profileValue(user?.companyCode);

  useEffect(() => {
    const syncWorkflow = () => {
      const acceptances = readWorkflowCollection<WorkflowAcceptance>(
        TRAINING_WORKFLOW_KEYS.acceptances,
      );
      const nextCourses = readWorkflowCollection<RollingPlan>(
        TRAINING_WORKFLOW_KEYS.rollingPlans,
      )
        .filter((plan) => plan.status === "Planned")
        .map<ActualCourse>((plan) => ({
          id: plan.rollingId,
          code: plan.course.code,
          title: plan.course.name,
          date: plan.trainingDate,
          time: `${plan.startTime} - ${plan.endTime}`,
          room: plan.location,
          company: plan.company,
          owner: plan.ownerScope === "CENTER" ? "CENTER" : "FACTORY",
          instructor: plan.trainer,
          hours: plan.hours,
          attendees: acceptances
            .filter(
              (acceptance) =>
                acceptance.courseId === plan.rollingId &&
                (plan.ownerScope === "CENTER"
                  ? acceptance.status === "Center Approved"
                  : acceptance.status === "Factory Approved"),
            )
            .map((acceptance) => ({
              id: `${plan.rollingId}-${acceptance.id}`,
              employeeCode: acceptance.id,
              name: acceptance.name,
              department: acceptance.department,
              company: acceptance.company,
              registered: true,
              attended: false,
            })),
          expenses: {
            instructor: "",
            traveling: "",
            seminarRoom: "",
            accommodation: "",
            material: "",
            foodBeverage: "",
          },
        }))
        .filter((course) => course.attendees.length > 0);

      setCourses((current) =>
        nextCourses.map((nextCourse) => {
          const existing = current.find((course) => course.id === nextCourse.id);
          return existing
            ? {
                ...nextCourse,
                attendees: nextCourse.attendees.map((nextAttendee) => {
                  const existingAttendee = existing.attendees.find(
                    (attendee) => attendee.id === nextAttendee.id,
                  );
                  return existingAttendee ?? nextAttendee;
                }),
                expenses: existing.expenses,
              }
            : nextCourse;
        }),
      );
    };

    syncWorkflow();
    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncWorkflow);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncWorkflow);
  }, []);
  const availableCourses = useMemo(
    () =>
      isFactoryUser
        ? courses.filter((course) => course.owner === "FACTORY" && course.company === userCompanyCode)
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
  const selectedCourse = ownerFilteredCourses.find((course) => course.id === selectedCourseId);

  const actualCount = selectedCourse
    ? selectedCourse.attendees.filter((attendee) => attendee.attended).length
    : 0;
  const walkInCount = selectedCourse
    ? selectedCourse.attendees.filter((attendee) => attendee.attended && !attendee.registered).length
    : 0;
  const registeredCount = selectedCourse
    ? selectedCourse.attendees.filter((attendee) => attendee.registered).length
    : 0;
  const absentCount = selectedCourse ? selectedCourse.attendees.length - actualCount : 0;
  const expenseTotal = useMemo(
    () =>
      selectedCourse
        ? expenseFields.reduce(
            (total, field) => total + Number(selectedCourse.expenses[field.key] || 0),
            0,
          )
        : 0,
    [selectedCourse],
  );

  const updateSelectedCourse = (updater: (course: ActualCourse) => ActualCourse) => {
    if (!selectedCourse) {
      return;
    }

    setCourses((current) =>
      current.map((course) => (course.id === selectedCourse.id ? updater(course) : course)),
    );
  };

  const toggleAttendance = (attendeeId: string) => {
    updateSelectedCourse((course) => ({
      ...course,
      attendees: course.attendees.map((attendee) =>
        attendee.id === attendeeId ? { ...attendee, attended: !attendee.attended } : attendee,
      ),
    }));
  };

  const updateExpense = (key: ExpenseKey, value: string) => {
    updateSelectedCourse((course) => ({
      ...course,
      expenses: {
        ...course.expenses,
        [key]: value,
      },
    }));
  };

  const handleSave = () => {
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

    const completedCourses = readWorkflowCollection<WorkflowCompletedCourse>(
      TRAINING_WORKFLOW_KEYS.completedCourses,
    );
    const completedCourse: WorkflowCompletedCourse = {
      id: `completed-${selectedCourse.id}`,
      rollingId: selectedCourse.id,
      code: selectedCourse.code,
      title: selectedCourse.title,
      date: selectedCourse.date,
      company: selectedCourse.company,
      owner: selectedCourse.owner,
      room: selectedCourse.room,
      instructor: selectedCourse.instructor,
      hours: Number(selectedCourse.hours || 0),
      attendees: selectedCourse.attendees.map((attendee) => ({
        ...attendee,
        company: attendee.company ?? selectedCourse.company,
      })),
      expenses: {
        accommodation: Number(selectedCourse.expenses.accommodation || 0),
        foodBeverage: Number(selectedCourse.expenses.foodBeverage || 0),
        instructor: Number(selectedCourse.expenses.instructor || 0),
        material: Number(selectedCourse.expenses.material || 0),
        seminarRoom: Number(selectedCourse.expenses.seminarRoom || 0),
        traveling: Number(selectedCourse.expenses.traveling || 0),
      },
      savedAt: new Date().toISOString(),
    };
    const nextCompletedCourses = [
      completedCourse,
      ...completedCourses.filter((course) => course.rollingId !== selectedCourse.id),
    ];
    writeWorkflowCollection(
      TRAINING_WORKFLOW_KEYS.completedCourses,
      nextCompletedCourses,
    );

    setSavedMessage(
      `Saved ${selectedCourse.code} with ${actualCount} actual attendees and THB ${formatCurrency(expenseTotal)} at ${now}.`,
    );
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
            <span>{walkInCount} Walk-in</span>
            <span>
              {selectedCourseOwner
                ? selectedCourseOwner === "CENTER"
                  ? "Center owner"
                  : "Factory owner"
                : "Select owner"}
            </span>
            <span>THB {formatCurrency(expenseTotal)}</span>
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
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSavedMessage("");
              }}
            >
              <option value="">
                {!selectedCourseOwner
                  ? "Select course owner first"
                  : ownerFilteredCourses.length > 0
                    ? "Select actual course"
                    : `No ${selectedCourseOwner.toLowerCase()} course available`}
              </option>
              {ownerFilteredCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} / {course.title} / {course.company}
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
                {selectedCourse.code} / {selectedCourse.company} / {selectedCourse.date} / {selectedCourse.time}
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
              <article>
                <span>Walk-in</span>
                <strong>{walkInCount}</strong>
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
            <span>{actualCount} attended</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.recordTable}>
              <thead>
                <tr>
                  <th>Attend</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {selectedCourse.attendees.map((attendee) => (
                  <tr key={attendee.id}>
                    <td>
                      <label className={styles.attendanceCheck}>
                        <input
                          type="checkbox"
                          checked={attendee.attended}
                          onChange={() => toggleAttendance(attendee.id)}
                        />
                        <span>{attendee.attended ? "Attend" : "Absent"}</span>
                      </label>
                    </td>
                    <td>
                      <strong>{attendee.name}</strong>
                      <span>{attendee.employeeCode}</span>
                    </td>
                    <td>{attendee.department}</td>
                    <td>
                      <span className={attendee.registered ? styles.statusPill : styles.walkInPill}>
                        {attendee.registered ? "Registered" : "Walk-in"}
                      </span>
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
                  value={selectedCourse.expenses[field.key]}
                  onChange={(event) => updateExpense(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>

          <div className={styles.actualTotalBox}>
            <span>Total Actual Cost</span>
            <strong>THB {formatCurrency(expenseTotal)}</strong>
          </div>

          <button className={styles.actualSaveButton} type="button" onClick={handleSave}>
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
