"use client";

import { useState } from "react";
import { availableCourses } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

const detailSections = [
  {
    title: "Course Information",
    items: [
      ["Course Code", "id"],
      ["Course Name", "title"],
      ["Round", "round"],
      ["Course Type", "type"],
      ["Duration", "duration"],
      ["Training Status", "trainingStatus"],
    ],
  },
  {
    title: "Class Detail",
    items: [
      ["Date", "date"],
      ["Time", "time"],
      ["Place", "place"],
      ["Seats", "seats"],
      ["Registration Deadline", "registrationDeadline"],
      ["Trainer", "trainer"],
    ],
  },
  {
    title: "Audience & Requirement",
    items: [
      ["Target Group", "targetGroup"],
      ["Prerequisite", "prerequisite"],
      ["Documents", "documents"],
      ["Approval Flow", "approvalFlow"],
      ["Responsible Team", "owner"],
      ["Contact", "contact"],
      ["Remark", "remarks"],
    ],
  },
] as const;

const courseOwnerGroups = [
  {
    owner: "Center",
    title: "Center Training",
    detail: "Courses opened by HRD Center or corporate learning teams.",
  },
  {
    owner: "Factory",
    title: "Factory Training",
    detail: "Courses opened by factory HR, safety, or local operation teams.",
  },
] as const;

export default function RegisterTrainingModule() {
  const [expandedCourseId, setExpandedCourseId] =
    useState<(typeof availableCourses)[number]["id"] | null>(availableCourses[0].id);

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Register Training"
        title="Register Training"
        detail="Register any open training course. Target group is not required for normal registration."
      />

      <div className={styles.registerWorkspace}>
        {courseOwnerGroups.map((group) => {
          const courses = availableCourses.filter((course) => course.courseOwner === group.owner);

          return (
            <section
              className={styles.registerListPanel}
              aria-label={`${group.title} available courses`}
              key={group.owner}
            >
              <div className={styles.panelHeader}>
                <div>
                  <p>{group.owner} registration</p>
                  <h2>{group.title}</h2>
                  <span>{group.detail}</span>
                </div>
                <span>{courses.length} courses</span>
              </div>

              <div className={styles.trainingList}>
                {courses.map((course) => {
                  const isExpanded = course.id === expandedCourseId;

                  return (
                    <article
                      className={`${styles.trainingItem} ${
                        isExpanded ? styles.activeTrainingItem : ""
                      }`}
                      key={course.id}
                    >
                      <div>
                        <small>{course.category} / {course.courseOwner}</small>
                        <strong>{course.title}</strong>
                        <span>{course.description}</span>
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
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                        >
                          {isExpanded ? "Hide detail" : "Show detail"}
                        </button>
                        <button type="button">Register</button>
                      </div>

                      {isExpanded ? (
                        <div className={styles.courseDropdownDetail}>
                          {detailSections.map((section) => (
                            <section className={styles.courseDetailSection} key={section.title}>
                              <h3>{section.title}</h3>
                              <dl className={styles.courseDetailGrid}>
                                {section.items.map(([label, field]) => (
                                  <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{course[field]}</dd>
                                  </div>
                                ))}
                              </dl>
                            </section>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {courses.length === 0 ? (
                  <p className={styles.emptyCourseGroup}>No open courses in this group.</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
