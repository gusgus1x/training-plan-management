"use client";

import { useState, type CSSProperties } from "react";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import styles from "./TrainingRecord.module.css";

export const trainingRecordModule = {
  title: "Training Record",
  subtitle: "Completed Course Records",
  description:
    "Review completed courses, actual attendees, cost, pre/post test results, evaluation progress, and downloadable training evidence.",
} as const;

type CompletedCourse = {
  id: string;
  code: string;
  title: string;
  date: string;
  company: string;
  owner: "CENTER" | "FACTORY";
  room: string;
  instructor: string;
  actualAttendees: number;
  registeredAttendees: number;
  actualCost: {
    accommodation: number;
    foodBeverage: number;
    instructor: number;
    material: number;
    seminarRoom: number;
    traveling: number;
  };
  prePostPassPercent: number;
  postTestPassPercent: number;
  preTestPassPercent: number;
  evaluationCompleted: number;
  evaluationTotal: number;
  averageScore: number;
  attendees: Array<{
    company: string;
    id: string;
    name: string;
    employeeCode: string;
    department: string;
    prePost: "Passed" | "Failed";
    evaluation: "Done" | "Pending";
  }>;
};

const completedCourses: CompletedCourse[] = [
  {
    id: "course-001",
    code: "SAFE-2026-08",
    title: "Safety & Compliance Basics",
    date: "21 Aug 2026",
    company: "SNF",
    owner: "FACTORY",
    room: "Auditorium",
    instructor: "Safety Team",
    actualAttendees: 39,
    registeredAttendees: 42,
    actualCost: {
      accommodation: 0,
      foodBeverage: 4200,
      instructor: 12000,
      material: 2400,
      seminarRoom: 3500,
      traveling: 1800,
    },
    prePostPassPercent: 87,
    postTestPassPercent: 87,
    preTestPassPercent: 42,
    evaluationCompleted: 35,
    evaluationTotal: 39,
    averageScore: 91,
    attendees: [
      { id: "a1", company: "SNF", name: "Narin Chaiya", employeeCode: "HRD-001", department: "Production", prePost: "Passed", evaluation: "Done" },
      { id: "a2", company: "SNF", name: "Maliwan S.", employeeCode: "HRD-014", department: "Quality", prePost: "Passed", evaluation: "Done" },
      { id: "a3", company: "ATA", name: "Kittipong R.", employeeCode: "HRD-021", department: "Maintenance", prePost: "Failed", evaluation: "Pending" },
    ],
  },
  {
    id: "course-002",
    code: "PDPA-2026-07",
    title: "Data Privacy Awareness",
    date: "15 Jul 2026",
    company: "All Companies",
    owner: "CENTER",
    room: "Online",
    instructor: "IT Governance",
    actualAttendees: 58,
    registeredAttendees: 60,
    actualCost: {
      accommodation: 0,
      foodBeverage: 0,
      instructor: 8500,
      material: 1200,
      seminarRoom: 0,
      traveling: 0,
    },
    prePostPassPercent: 94,
    postTestPassPercent: 94,
    preTestPassPercent: 48,
    evaluationCompleted: 54,
    evaluationTotal: 58,
    averageScore: 96,
    attendees: [
      { id: "b1", company: "ATA", name: "Suda K.", employeeCode: "HRD-003", department: "Human Resources", prePost: "Passed", evaluation: "Done" },
      { id: "b2", company: "SNF", name: "Anucha P.", employeeCode: "HRD-019", department: "IT", prePost: "Passed", evaluation: "Done" },
      { id: "b3", company: "ATFB", name: "Pimchanok T.", employeeCode: "HRD-028", department: "Sales", prePost: "Passed", evaluation: "Pending" },
    ],
  },
  {
    id: "course-003",
    code: "SERV-2026-09",
    title: "Service Mind for Frontline",
    date: "8 Sep 2026",
    company: "ATFB",
    owner: "FACTORY",
    room: "Training Room B",
    instructor: "Maliwan P.",
    actualAttendees: 24,
    registeredAttendees: 26,
    actualCost: {
      accommodation: 3800,
      foodBeverage: 6400,
      instructor: 15000,
      material: 3100,
      seminarRoom: 5000,
      traveling: 2500,
    },
    prePostPassPercent: 79,
    postTestPassPercent: 79,
    preTestPassPercent: 36,
    evaluationCompleted: 18,
    evaluationTotal: 24,
    averageScore: 88,
    attendees: [
      { id: "c1", company: "ATFB", name: "Thanawat M.", employeeCode: "HRD-033", department: "Customer Service", prePost: "Passed", evaluation: "Done" },
      { id: "c2", company: "ATFB", name: "Pimchanok T.", employeeCode: "HRD-028", department: "Sales", prePost: "Passed", evaluation: "Done" },
      { id: "c3", company: "NIC", name: "Chaiwat N.", employeeCode: "HRD-041", department: "Frontline", prePost: "Failed", evaluation: "Pending" },
    ],
  },
];

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const expenseItems = [
  { key: "instructor", label: "Instructor" },
  { key: "traveling", label: "Traveling" },
  { key: "seminarRoom", label: "Seminar Room" },
  { key: "accommodation", label: "Accommodation" },
  { key: "material", label: "Material" },
  { key: "foodBeverage", label: "Food & Beverage" },
] as const;

export default function TrainingRecord() {
  const user = useAuthenticatedUser();
  const [selectedCourseId, setSelectedCourseId] = useState(completedCourses[0].id);
  const [downloadMessage, setDownloadMessage] = useState("");
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const userCompanyCode = profileValue(user?.companyCode);
  const availableCourses = isFactoryUser
    ? completedCourses.filter((course) => course.owner === "FACTORY" && course.company === userCompanyCode)
    : completedCourses;
  const selectedCourse =
    availableCourses.find((course) => course.id === selectedCourseId) ?? availableCourses[0];

  if (!selectedCourse) {
    return (
      <section className={styles.page} aria-label="Training Record module">
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{trainingRecordModule.subtitle}</p>
            <h2>{trainingRecordModule.title}</h2>
            <p>{trainingRecordModule.description}</p>
          </div>
          <div className={styles.heroMeta}>
            <span>0 completed courses</span>
            <span>Factory permission</span>
          </div>
        </section>

        <section className={styles.courseSelectPanel} aria-label="Completed course selector">
          <div>
            <p className={styles.kicker}>Completed Course</p>
            <h3>No completed course available</h3>
          </div>
          <p className={styles.emptyState}>
            Factory permission can view only completed courses owned by {userCompanyCode || "your company"}.
          </p>
        </section>
      </section>
    );
  }
  const evaluationPercent = Math.round(
    (selectedCourse.evaluationCompleted / selectedCourse.evaluationTotal) * 100,
  );
  const selectedActualCost = expenseItems.reduce(
    (total, item) => total + selectedCourse.actualCost[item.key],
    0,
  );
  const attendeesByCompany = Object.entries(
    selectedCourse.attendees.reduce<Record<string, typeof selectedCourse.attendees>>((result, attendee) => {
      result[attendee.company] = [...(result[attendee.company] ?? []), attendee];
      return result;
    }, {}),
  );

  const handleDownload = (label: string) => {
    setDownloadMessage(`${label} downloaded for ${selectedCourse.code}.`);
  };

  return (
    <section className={styles.page} aria-label="Training Record module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingRecordModule.subtitle}</p>
          <h2>{trainingRecordModule.title}</h2>
          <p>{trainingRecordModule.description}</p>
        </div>
        <div className={styles.heroMeta}>
          <span>{availableCourses.length} completed courses</span>
          <span>Completed only</span>
        </div>
      </section>

      <section className={styles.courseSelectPanel} aria-label="Completed course selector">
        <div>
          <p className={styles.kicker}>Completed Course</p>
          <h3>Select Course</h3>
        </div>
        <label>
          Course
          <select
            value={selectedCourseId}
            onChange={(event) => {
              setSelectedCourseId(event.target.value);
              setDownloadMessage("");
            }}
          >
            {availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} / {course.title} / {course.company}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className={styles.completedRecordWorkspace}>
        <div className={styles.completedCourseDetail}>
          <section className={styles.completedCourseHero}>
            <div>
              <p className={styles.kicker}>Course Record</p>
              <h3>{selectedCourse.title}</h3>
              <span>
                {selectedCourse.code} / {selectedCourse.date} / {selectedCourse.room} / {selectedCourse.instructor}
              </span>
            </div>
            <button type="button" onClick={() => handleDownload("All summary")}>
              Download Summary
            </button>
          </section>

          <section className={styles.recordMetricGrid}>
            <article><span>Actual / Registered</span><strong>{selectedCourse.actualAttendees}/{selectedCourse.registeredAttendees}</strong></article>
            <article><span>Actual Cost</span><strong>THB {formatNumber(selectedActualCost)}</strong></article>
            <article><span>Average Score</span><strong>{selectedCourse.averageScore}%</strong></article>
            <article><span>Evaluation</span><strong>{selectedCourse.evaluationCompleted}/{selectedCourse.evaluationTotal}</strong></article>
          </section>

          <section className={styles.costBreakdownPanel} aria-label="Actual cost breakdown">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Actual Cost</p>
                <h3>Cost Breakdown</h3>
              </div>
              <span>THB {formatNumber(selectedActualCost)}</span>
            </div>

            <div className={styles.costBreakdownGrid}>
              {expenseItems.map((item) => (
                <article key={item.key}>
                  <span>{item.label}</span>
                  <strong>THB {formatNumber(selectedCourse.actualCost[item.key])}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.recordChartGrid}>
            <article className={styles.chartPanel}>
              <div
                className={styles.donutChart}
                style={{ "--value": `${selectedCourse.preTestPassPercent}%` } as CSSProperties}
                aria-label={`Pre test pass rate ${selectedCourse.preTestPassPercent}%`}
              >
                <strong>{selectedCourse.preTestPassPercent}%</strong>
                <span>Pass</span>
              </div>
              <div>
                <p className={styles.kicker}>Pre Test</p>
                <h3>Before Training</h3>
                <span>Most attendees did not pass before training.</span>
              </div>
            </article>

            <article className={styles.chartPanel}>
              <div
                className={styles.donutChart}
                style={{ "--value": `${selectedCourse.postTestPassPercent}%` } as CSSProperties}
                aria-label={`Post test pass rate ${selectedCourse.postTestPassPercent}%`}
              >
                <strong>{selectedCourse.postTestPassPercent}%</strong>
                <span>Pass</span>
              </div>
              <div>
                <p className={styles.kicker}>Post Test</p>
                <h3>After Training</h3>
                <span>Pass rate after course completion.</span>
              </div>
            </article>

            <article className={styles.chartPanel}>
              <div
                className={styles.donutChart}
                style={{ "--value": `${evaluationPercent}%` } as CSSProperties}
                aria-label={`Evaluation completion ${evaluationPercent}%`}
              >
                <strong>{evaluationPercent}%</strong>
                <span>Done</span>
              </div>
              <div>
                <p className={styles.kicker}>Evaluation Form</p>
                <h3>{selectedCourse.evaluationCompleted}/{selectedCourse.evaluationTotal} completed</h3>
                <span>Download by person or export all evaluation forms.</span>
              </div>
            </article>
          </section>

          <section className={styles.evaluationDownloadPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Actual Attendees</p>
                <h3>Evaluation Download by Company / Person</h3>
              </div>
              <button type="button" onClick={() => handleDownload("All evaluation forms")}>
                Download All Forms
              </button>
            </div>

            <div className={styles.companyAccordionList} aria-label="Actual attendees by company">
              {attendeesByCompany.map(([company, attendees], index) => (
                <details className={styles.companyAccordion} key={company} open={index === 0}>
                  <summary>
                    <div>
                      <span>{company}</span>
                      <strong>{attendees.length} actual attendees</strong>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        handleDownload(`${company} evaluation forms`);
                      }}
                    >
                      Download Company Forms
                    </button>
                  </summary>

                  <div className={styles.companyAttendeeList}>
                    {attendees.map((attendee) => (
                      <article key={attendee.id}>
                        <div>
                          <strong>{attendee.name}</strong>
                          <span>{attendee.employeeCode} / {attendee.department}</span>
                        </div>
                        <span className={styles.statusPill}>{attendee.prePost}</span>
                        <span className={styles.statusPill}>{attendee.evaluation}</span>
                        <button
                          className={styles.detailButton}
                          type="button"
                          onClick={() => handleDownload(`${attendee.name} evaluation form`)}
                        >
                          Download Form
                        </button>
                      </article>
                    ))}
                  </div>
                </details>
              ))}
            </div>

            {downloadMessage ? <p className={styles.downloadMessage}>{downloadMessage}</p> : null}
          </section>
        </div>
      </section>
    </section>
  );
}
