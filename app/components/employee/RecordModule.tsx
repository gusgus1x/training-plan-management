"use client";

import { useState } from "react";
import { externalRecordRequests, recordCourses } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type RecordModuleProps = {
  completedHours: number;
};

const recordYears = ["2026", "2027"] as const;

const recordMonths = [
  { value: "all", label: "All year" },
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

export default function RecordModule({ completedHours }: RecordModuleProps) {
  const [selectedRecordYear, setSelectedRecordYear] = useState<(typeof recordYears)[number]>("2026");
  const [selectedRecordMonth, setSelectedRecordMonth] =
    useState<(typeof recordMonths)[number]["value"]>("all");

  const visibleRecordCourses = recordCourses.filter(
    (course) =>
      course.year === selectedRecordYear &&
      (selectedRecordMonth === "all" || course.month === selectedRecordMonth),
  );

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Training Record"
        title="Training Record"
        detail="Check training history, assessment status, completed hours, and external record requests."
      />

      <div className={styles.recordSummary}>
        <article>
          <span>Completed Hours</span>
          <strong>{completedHours}</strong>
        </article>
        <article>
          <span>Completed</span>
          <strong>2</strong>
        </article>
        <article>
          <span>Pending</span>
          <strong>1</strong>
        </article>
      </div>

      <div className={styles.recordLayout}>
        <section className={styles.recordPanel} aria-label="Training record in system">
          <div className={styles.panelHeader}>
            <div>
              <p>System Record</p>
              <h2>Training Records</h2>
            </div>
            <span>{visibleRecordCourses.length} courses</span>
          </div>

          <div className={styles.recordFilters}>
            <label>
              <span>Year</span>
              <select
                value={selectedRecordYear}
                onChange={(event) =>
                  setSelectedRecordYear(event.target.value as (typeof recordYears)[number])
                }
              >
                {recordYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Month</span>
              <select
                value={selectedRecordMonth}
                onChange={(event) =>
                  setSelectedRecordMonth(event.target.value as (typeof recordMonths)[number]["value"])
                }
              >
                {recordMonths.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.recordCourseList}>
            {visibleRecordCourses.map((item) => (
              <article key={item.course}>
                <div>
                  <strong>{item.course}</strong>
                  <span>{item.date}</span>
                </div>
                <b>{item.result}</b>
                <span>{item.assessment}</span>
                <button type="button">{item.action}</button>
              </article>
            ))}
            {visibleRecordCourses.length === 0 ? (
              <div className={styles.recordEmpty}>No training record found for this period.</div>
            ) : null}
          </div>
        </section>

        <section className={styles.recordPanel} aria-label="Request external training record">
          <div className={styles.panelHeader}>
            <div>
              <p>Request Record</p>
              <h2>External Record Request</h2>
            </div>
            <span>HRD</span>
          </div>

          <form className={styles.recordRequestForm}>
            <label>
              Course Name
              <input type="text" defaultValue="Forklift Safety Training" />
            </label>
            <label>
              Source
              <select defaultValue="external">
                <option value="external">External training</option>
                <option value="previous">Previous workplace record</option>
              </select>
            </label>
            <label>
              Note / Evidence
              <textarea defaultValue="Attach certificate or supporting document for HRD verification." />
            </label>
            <div className={styles.recordReasonBox}>
              <span>Reason</span>
              <strong>
                Use this request when training was completed outside the system and needs HRD confirmation.
              </strong>
            </div>
            <button type="button">Submit Request</button>
          </form>

          <div className={styles.externalRecordList}>
            {externalRecordRequests.map((item) => (
              <article key={item.course}>
                <div>
                  <strong>{item.course}</strong>
                  <span>{item.source}</span>
                </div>
                <b>{item.status}</b>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
