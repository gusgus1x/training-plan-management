"use client";

import { useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
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
  attendees: Attendee[];
  expenses: Record<ExpenseKey, string>;
};

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
        employeeCode: "HRD-021",
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
  const [courses, setCourses] = useState<ActualCourse[]>(initialCourses);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourses[0].id);
  const [savedMessage, setSavedMessage] = useState("");
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const userCompanyCode = profileValue(user?.companyCode);
  const availableCourses = useMemo(
    () =>
      isFactoryUser
        ? courses.filter((course) => course.owner === "FACTORY" && course.company === userCompanyCode)
        : courses,
    [courses, isFactoryUser, userCompanyCode],
  );
  const selectedCourse =
    availableCourses.find((course) => course.id === selectedCourseId) ??
    availableCourses[0] ??
    courses[0];

  const actualCount = selectedCourse.attendees.filter((attendee) => attendee.attended).length;
  const walkInCount = selectedCourse.attendees.filter(
    (attendee) => attendee.attended && !attendee.registered,
  ).length;
  const registeredCount = selectedCourse.attendees.filter((attendee) => attendee.registered).length;
  const absentCount = selectedCourse.attendees.length - actualCount;
  const expenseTotal = useMemo(
    () =>
      expenseFields.reduce(
        (total, field) => total + Number(selectedCourse.expenses[field.key] || 0),
        0,
      ),
    [selectedCourse.expenses],
  );

  const updateSelectedCourse = (updater: (course: ActualCourse) => ActualCourse) => {
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
    const now = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());

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
            <span>{isFactoryUser ? `${userCompanyCode} only` : "Center scope"}</span>
            <span>THB {formatCurrency(expenseTotal)}</span>
          </div>
      </section>

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

            <label className={styles.actualCourseSelect}>
              Course
              <select
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSavedMessage("");
              }}
            >
              {availableCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} / {course.title}
                </option>
              ))}
            </select>
          </label>

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
    </section>
  );
}
