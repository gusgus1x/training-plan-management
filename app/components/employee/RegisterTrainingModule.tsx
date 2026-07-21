"use client";

import { useState } from "react";
import { availableCourses } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

const registerSteps = [
  "Review available courses",
  "Select course and submit",
  "Wait for HRD approval",
  "Training result recorded",
] as const;

export default function RegisterTrainingModule() {
  const [selectedCourseId, setSelectedCourseId] =
    useState<(typeof availableCourses)[number]["id"]>(availableCourses[0].id);
  const selectedCourse =
    availableCourses.find((course) => course.id === selectedCourseId) ?? availableCourses[0];

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Register Training"
        title="Register Training"
        detail="Select available courses, review course details, and submit registration for HRD approval."
      />

      <div className={styles.registerWorkspace}>
        <section className={styles.registerListPanel} aria-label="Available training courses">
          <div className={styles.panelHeader}>
            <div>
              <p>Available Courses</p>
              <h2>Course Registration</h2>
            </div>
            <span>{availableCourses.length} courses</span>
          </div>

          <div className={styles.trainingList}>
            {availableCourses.map((course) => (
              <article
                className={`${styles.trainingItem} ${
                  course.id === selectedCourseId ? styles.activeTrainingItem : ""
                }`}
                key={course.id}
              >
                <div>
                  <small>{course.category}</small>
                  <strong>{course.title}</strong>
                  <span>
                    {course.date} / {course.time} / {course.place} / {course.seats}
                  </span>
                </div>
                <b>{course.status}</b>
                <div className={styles.trainingActions}>
                  <button
                    className={styles.secondaryActionButton}
                    type="button"
                    onClick={() => setSelectedCourseId(course.id)}
                  >
                    Details
                  </button>
                  <button type="button">Register</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.courseDetailPanel} aria-label="Course detail">
          <div className={styles.panelHeader}>
            <div>
              <p>Course Detail</p>
              <h2>{selectedCourse.title}</h2>
            </div>
            <span>{selectedCourse.status}</span>
          </div>

          <span>{selectedCourse.description}</span>
          <dl className={styles.courseDetailGrid}>
            <div>
              <dt>Course Code</dt>
              <dd>{selectedCourse.id}</dd>
            </div>
            <div>
              <dt>Course Name</dt>
              <dd>{selectedCourse.title}</dd>
            </div>
            <div>
              <dt>Round</dt>
              <dd>{selectedCourse.round}</dd>
            </div>
            <div>
              <dt>Training Status</dt>
              <dd>{selectedCourse.trainingStatus}</dd>
            </div>
            <div>
              <dt>Course Type</dt>
              <dd>{selectedCourse.type}</dd>
            </div>
            <div>
              <dt>Budget</dt>
              <dd>{selectedCourse.budget}</dd>
            </div>
            <div>
              <dt>Trainer</dt>
              <dd>{selectedCourse.trainer}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{selectedCourse.owner}</dd>
            </div>
          </dl>
        </section>
      </div>

      <ol className={styles.flowSteps}>
        {registerSteps.map((step, index) => (
          <li className={index < 2 ? styles.currentStep : undefined} key={step}>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
