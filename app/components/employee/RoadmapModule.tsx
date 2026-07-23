"use client";

import { useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../AuthenticatedUserContext";
import { roadmapItems } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

const isTargetMatch = (targets: readonly string[], value: string) =>
  targets.includes("All") || targets.includes(value);

const targetsAll = (targets: readonly string[]) => targets.includes("All");

const formatTargets = (targets: readonly string[]) =>
  targetsAll(targets) ? "All" : targets.join(", ");

const roadmapGroups = [
  {
    owner: "Center",
    title: "Center Roadmap",
    detail: "Target courses assigned by HRD Center or corporate learning teams.",
  },
  {
    owner: "Factory",
    title: "Factory Roadmap",
    detail: "Target courses assigned by factory HR, safety, or local operation teams.",
  },
] as const;

const roadmapDetailSections = [
  {
    title: "Course Information",
    items: [
      ["Course Code", "code"],
      ["Course Name", "title"],
      ["Category", "category"],
      ["Round", "round"],
      ["Course Type", "type"],
      ["Training Status", "trainingStatus"],
    ],
  },
  {
    title: "Roadmap Requirement",
    items: [
      ["Due Date", "due"],
      ["Priority", "priority"],
      ["Current Status", "status"],
      ["Action", "action"],
      ["Trainer", "trainer"],
      ["Responsible Team", "owner"],
    ],
  },
] as const;

export default function RoadmapModule() {
  const authenticatedUser = useAuthenticatedUser();
  const employeeCompany = profileValue(authenticatedUser?.companyCode);
  const employeeFunction = profileValue(authenticatedUser?.functionName);
  const employeePosition = profileValue(authenticatedUser?.positionName);
  const employeeLevel = profileValue(authenticatedUser?.levelName);

  const targetCourses = useMemo(
    () =>
      roadmapItems.filter(
        (item) =>
          isTargetMatch(item.targetCompanies, employeeCompany) &&
          isTargetMatch(item.targetFunctions, employeeFunction) &&
          isTargetMatch(item.targetPositions, employeePosition) &&
          isTargetMatch(item.targetLevels, employeeLevel),
      ),
    [employeeCompany, employeeFunction, employeeLevel, employeePosition],
  );

  const fallbackCourses = targetCourses.length > 0 ? targetCourses : roadmapItems;
  const [expandedCourseCode, setExpandedCourseCode] = useState<string | null>(
    fallbackCourses[0]?.code ?? "",
  );

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Training Roadmap"
        title="My Target Courses"
        detail="Shows courses where this employee is included in the target group by company, function, or position."
      />

      <div className={styles.registerWorkspace}>
        {roadmapGroups.map((group) => {
          const courses = fallbackCourses.filter((item) => item.courseOwner === group.owner);

          return (
            <section
              className={styles.registerListPanel}
              aria-label={`${group.title} target courses`}
              key={group.owner}
            >
              <div className={styles.panelHeader}>
                <div>
                  <p>{group.owner} roadmap</p>
                  <h2>{group.title}</h2>
                  <span>{group.detail}</span>
                </div>
                <span>{courses.length} courses</span>
              </div>

              <div className={styles.trainingList}>
                {courses.map((item) => {
                  const isExpanded = item.code === expandedCourseCode;
                  const targetReason = [
                    targetsAll(item.targetFunctions) ? "all functions" : employeeFunction,
                    targetsAll(item.targetPositions) ? "all positions" : employeePosition,
                    targetsAll(item.targetLevels) ? "all levels" : employeeLevel,
                    targetsAll(item.targetCompanies) ? "all companies" : employeeCompany,
                  ].join(" / ");

                  return (
                    <article
                      className={`${styles.trainingItem} ${
                        isExpanded ? styles.activeTrainingItem : ""
                      }`}
                      key={item.code}
                    >
                      <div>
                        <small>{item.category} / {item.courseOwner}</small>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                        <div className={styles.trainingScheduleGrid}>
                          <span><b>Due</b>{item.due}</span>
                          <span><b>Round</b>{item.round}</span>
                          <span><b>Priority</b>{item.priority}</span>
                          <span><b>Status</b>{item.status}</span>
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
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedCourseCode(isExpanded ? null : item.code)}
                        >
                          {isExpanded ? "Hide detail" : "Show detail"}
                        </button>
                        <button type="button" disabled={item.action !== "Register"}>
                          {item.action === "Register" ? "Register" : item.action}
                        </button>
                      </div>

                      {isExpanded ? (
                        <div className={styles.courseDropdownDetail}>
                          <section className={styles.courseDetailSection}>
                            <h3>Why This Course Appears</h3>
                            <dl className={styles.courseDetailGrid}>
                              <div><dt>Matched Profile</dt><dd>{targetReason}</dd></div>
                              <div><dt>Target Companies</dt><dd>{formatTargets(item.targetCompanies)}</dd></div>
                              <div><dt>Target Functions</dt><dd>{formatTargets(item.targetFunctions)}</dd></div>
                              <div><dt>Target Positions</dt><dd>{formatTargets(item.targetPositions)}</dd></div>
                              <div><dt>Target Levels</dt><dd>{formatTargets(item.targetLevels)}</dd></div>
                            </dl>
                          </section>

                          {roadmapDetailSections.map((section) => (
                            <section className={styles.courseDetailSection} key={section.title}>
                              <h3>{section.title}</h3>
                              <dl className={styles.courseDetailGrid}>
                                {section.items.map(([label, field]) => (
                                  <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{item[field]}</dd>
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
                  <p className={styles.emptyCourseGroup}>No target courses in this group.</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
