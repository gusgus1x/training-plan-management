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
        detail="Register any open training course. Target group is not required for normal registration."
      />

      <div className={styles.registerWorkspace}>
        <section className={styles.registerListPanel} aria-label="Available training courses">
          <div className={styles.panelHeader}>
            <div>
              <p>Open registration</p>
              <h2>All Available Courses</h2>
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
                  <small>{course.category} / {course.courseOwner}</small>
                  <strong>{course.title}</strong>
                  <div className={styles.trainingScheduleGrid}>
                    <span><b>Date</b>{course.date}</span>
                    <span><b>Time</b>{course.time}</span>
                    <span><b>Place</b>{course.place}</span>
                    <span><b>Seats</b>{course.seats}</span>
                  </div>
                </div>
                <div className={styles.courseStatusStack}>
                  <b>{course.courseOwner}</b>
                  <span>{course.status}</span>
                </div>
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
            <span>{selectedCourse.courseOwner}</span>
          </div>

          <div className={styles.registerCourseHero}>
            <b>{selectedCourse.status}</b>
            <span>{selectedCourse.description}</span>
            <div>
              <strong>{selectedCourse.date}</strong>
              <strong>{selectedCourse.time}</strong>
              <strong>{selectedCourse.place}</strong>
            </div>
          </div>
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
              <dt>Course Owner</dt>
              <dd>{selectedCourse.courseOwner}</dd>
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
