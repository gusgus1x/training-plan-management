"use client";

import { useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../AuthenticatedUserContext";
import { roadmapItems } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

const isTargetMatch = (targets: readonly string[], value: string) =>
  targets.includes("All") || targets.includes(value);

const targetsAll = (targets: readonly string[]) => targets.includes("All");

export default function RoadmapModule() {
  const authenticatedUser = useAuthenticatedUser();
  const employeeCompany = profileValue(authenticatedUser?.companyCode);
  const employeeFunction = profileValue(authenticatedUser?.functionName);
  const employeePosition = profileValue(authenticatedUser?.positionName);

  const targetCourses = useMemo(
    () =>
      roadmapItems.filter(
        (item) =>
          isTargetMatch(item.targetCompanies, employeeCompany) &&
          isTargetMatch(item.targetFunctions, employeeFunction) &&
          isTargetMatch(item.targetPositions, employeePosition),
      ),
    [employeeCompany, employeeFunction, employeePosition],
  );

  const fallbackCourses = targetCourses.length > 0 ? targetCourses : roadmapItems;
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(
    fallbackCourses[0]?.code ?? "",
  );
  const selectedCourse =
    fallbackCourses.find((item) => item.code === selectedCourseCode) ?? fallbackCourses[0];

  const centerCourses = fallbackCourses.filter((item) => item.courseOwner === "Center");
  const factoryCourses = fallbackCourses.filter((item) => item.courseOwner === "Factory");

  const targetReason = selectedCourse
    ? [
        targetsAll(selectedCourse.targetFunctions)
          ? "all functions"
          : employeeFunction,
        targetsAll(selectedCourse.targetPositions)
          ? "all positions"
          : employeePosition,
        targetsAll(selectedCourse.targetCompanies)
          ? "all companies"
          : employeeCompany,
      ].join(" / ")
    : "-";

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Training Roadmap"
        title="My Target Courses"
        detail="Shows courses where this employee is included in the target group by company, function, or position."
      />

      <div className={styles.registerWorkspace}>
        <section className={styles.registerListPanel} aria-label="Target roadmap courses">
          <div className={styles.panelHeader}>
            <div>
              <p>Target group courses</p>
              <h2>Courses Assigned To Me</h2>
            </div>
            <span>{centerCourses.length} Center / {factoryCourses.length} Factory</span>
          </div>

          <div className={styles.trainingList}>
            {fallbackCourses.map((item) => (
              <article
                className={`${styles.trainingItem} ${
                  item.code === selectedCourse?.code ? styles.activeTrainingItem : ""
                }`}
                key={item.title}
              >
                <div>
                  <small>{item.category} / {item.courseOwner}</small>
                  <strong>{item.title}</strong>
                  <div className={styles.trainingScheduleGrid}>
                    <span><b>Due</b>{item.due}</span>
                    <span><b>Round</b>{item.round}</span>
                    <span><b>Priority</b>{item.priority}</span>
                    <span><b>Owner</b>{item.courseOwner}</span>
                  </div>
                </div>
                <div className={styles.courseStatusStack}>
                  <b>{item.courseOwner}</b>
                  <span>Target group</span>
                </div>
                <div className={styles.trainingActions}>
                  <button
                    className={styles.secondaryActionButton}
                    type="button"
                    onClick={() => setSelectedCourseCode(item.code)}
                  >
                    Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.courseDetailPanel} aria-label="Target course detail">
          <p>Why This Course Appears</p>
          <h2>{selectedCourse?.title ?? "No target course"}</h2>
          {selectedCourse ? (
            <>
              <div className={styles.registerCourseHero}>
                <b>{selectedCourse.courseOwner}</b>
                <span>
                  This course appears because your profile matches the course target group.
                </span>
                <div>
                  <strong>Due {selectedCourse.due}</strong>
                  <strong>{selectedCourse.round}</strong>
                  <strong>{selectedCourse.priority}</strong>
                </div>
              </div>
              <dl className={styles.courseDetailGrid}>
                <div><dt>Course Code</dt><dd>{selectedCourse.code}</dd></div>
                <div><dt>Round</dt><dd>{selectedCourse.round}</dd></div>
                <div><dt>Status</dt><dd>{selectedCourse.trainingStatus}</dd></div>
                <div><dt>Priority</dt><dd>{selectedCourse.priority}</dd></div>
                <div><dt>Course Type</dt><dd>{selectedCourse.type}</dd></div>
                <div><dt>Budget</dt><dd>{selectedCourse.budget}</dd></div>
                <div><dt>Trainer</dt><dd>{selectedCourse.trainer}</dd></div>
                <div><dt>Owner</dt><dd>{selectedCourse.owner}</dd></div>
                <div><dt>Target Group</dt><dd>{targetReason}</dd></div>
                <div><dt>Target Result</dt><dd>This employee is included</dd></div>
              </dl>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
