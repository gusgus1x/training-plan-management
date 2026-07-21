"use client";

import { useState } from "react";
import { roadmapItems } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

export default function RoadmapModule() {
  const [selectedCourseCode, setSelectedCourseCode] =
    useState<(typeof roadmapItems)[number]["code"]>(roadmapItems[0].code);
  const selectedCourse =
    roadmapItems.find((item) => item.code === selectedCourseCode) ?? roadmapItems[0];

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Training Roadmap"
        title="Training Roadmap"
        detail="Review recommended courses, required training, and registration priority by your role."
      />

      <div className={styles.roadmapWorkspace}>
        <section className={styles.roadmapListPanel} aria-label="Recommended roadmap courses">
          <div className={styles.panelHeader}>
            <div>
              <p>Roadmap List</p>
              <h2>Recommended Courses</h2>
            </div>
            <span>{roadmapItems.length} courses</span>
          </div>

          <div className={styles.roadmapGrid}>
            {roadmapItems.map((item) => (
              <article
                className={item.code === selectedCourseCode ? styles.activeRoadmapItem : ""}
                key={item.title}
              >
                <div className={styles.roadmapContent}>
                  <small>{item.category}</small>
                  <strong>{item.title}</strong>
                  <span>{item.due} / {item.round} / {item.type}</span>
                </div>
                <div className={styles.roadmapMeta}>
                  <b>{item.status}</b>
                  <em>Due {item.due}</em>
                </div>
                <div className={styles.trainingActions}>
                  <button
                    className={styles.secondaryActionButton}
                    type="button"
                    onClick={() => setSelectedCourseCode(item.code)}
                  >
                    Details
                  </button>
                  <button type="button">{item.action}</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.courseDetailPanel} aria-label="Recommended course detail">
          <p>Selected Course</p>
          <h2>{selectedCourse.title}</h2>
          <span>{selectedCourse.detail}</span>
          <dl className={styles.courseDetailGrid}>
            <div><dt>Course Code</dt><dd>{selectedCourse.code}</dd></div>
            <div><dt>Round</dt><dd>{selectedCourse.round}</dd></div>
            <div><dt>Status</dt><dd>{selectedCourse.trainingStatus}</dd></div>
            <div><dt>Priority</dt><dd>{selectedCourse.priority}</dd></div>
            <div><dt>Course Type</dt><dd>{selectedCourse.type}</dd></div>
            <div><dt>Budget</dt><dd>{selectedCourse.budget}</dd></div>
            <div><dt>Trainer</dt><dd>{selectedCourse.trainer}</dd></div>
            <div><dt>Owner</dt><dd>{selectedCourse.owner}</dd></div>
          </dl>
        </section>
      </div>
    </section>
  );
}
