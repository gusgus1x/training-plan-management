"use client";

import { useEffect, useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../AuthenticatedUserContext";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../ToastHost";
import {
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "../center_factory/TrainingPlanManagement/modules/TrainingRolling";
import { createEnrollment, listEnrollments, updateEnrollmentStatus } from "../../lib/trainingEnrollment/client";
import type { EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

const ACTIVE_ENROLLMENT_STATUSES = ["Pending Approval", "Factory Approved", "Center Approved"] as const;

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

type AvailableCourse = {
  rollingId: string;
  enrollmentId: string | null;
  id: string;
  title: string;
  category: string;
  courseOwner: "Center" | "Factory";
  description: string;
  date: string;
  time: string;
  place: string;
  seats: string;
  status: string;
  round: string;
  type: string;
  duration: string;
  trainingStatus: string;
  registrationDeadline: string;
  trainer: string;
  targetGroup: string;
  prerequisite: string;
  documents: string;
  approvalFlow: string;
  owner: string;
  contact: string;
  remarks: string;
};

const courseOwnerGroups = [
  {
    owner: "Center",
    title: "Mandatory Center Training",
    detail: "Center courses are mandatory and controlled by HRD Center.",
  },
  {
    owner: "Factory",
    title: "Factory Training",
    detail: "Courses opened internally by your factory.",
  },
] as const;

export default function RegisterTrainingModule() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const employeeCompany = profileValue(user?.companyCode);
  const employeeId = user?.employeeId ?? null;
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    void loadWorkflowRollingPlans().then(setRollingPlans);
  }, []);

  const loadEnrollments = async () => {
    if (!employeeId) {
      setEnrollments([]);
      return;
    }
    try {
      const result = await listEnrollments({ planId: null, employeeId });
      setEnrollments(result.enrollments || []);
    } catch (error) {
      console.error("Failed to load my registrations", error);
      setEnrollments([]);
    }
  };

  useEffect(() => {
    void loadEnrollments();
  }, [employeeId]);

  const availableCourses = useMemo<AvailableCourse[]>(
    () =>
      rollingPlans
        .filter(
          (plan) =>
            plan.status === "Planned" &&
            getRollingPlanCompanies(plan).includes(employeeCompany),
        )
        .sort((a, b) => a.trainingDate.localeCompare(b.trainingDate))
        .map((plan) => {
          const courseOwner = plan.ownerScope === "CENTER" ? "Center" : "Factory";
          const activeEnrollment = enrollments.find(
            (enrollment) =>
              enrollment.planId === plan.rollingId &&
              (ACTIVE_ENROLLMENT_STATUSES as readonly string[]).includes(enrollment.status),
          );
          const isRegistered = Boolean(activeEnrollment);

          return {
            rollingId: plan.rollingId,
            enrollmentId: activeEnrollment?.id ?? null,
            id: plan.course.code,
            title: plan.course.name,
            category: plan.course.courseGroup,
            courseOwner,
            description: plan.course.objective,
            date: plan.trainingDate,
            time: `${plan.startTime} - ${plan.endTime}`,
            place: plan.location,
            seats: `${plan.participants} seats`,
            status: isRegistered
              ? "Registered"
              : courseOwner === "Center"
                ? "Mandatory / Open registration"
                : "Open registration",
            round: plan.batch,
            type: plan.course.courseType,
            duration: `${plan.hours} hours`,
            trainingStatus: isRegistered ? "Registered" : "Not registered",
            registrationDeadline: plan.trainingDate,
            trainer: plan.trainer,
            targetGroup: plan.course.targetGroup,
            prerequisite: "Follow the course standard target group.",
            documents: "Employee registration and attendance record",
            approvalFlow:
              courseOwner === "Center"
                ? "Employee > HRD Center"
                : "Employee > Factory HRD",
            owner: plan.provider,
            contact:
              courseOwner === "Center"
                ? "HRD Center"
                : `${plan.ownerCompany ?? employeeCompany} HRD`,
            remarks:
              courseOwner === "Center"
                ? "Factory HRD cannot edit or cancel this Center course."
                : "Managed by Factory HRD.",
          };
        }),
    [employeeCompany, enrollments, rollingPlans],
  );

  const handleRegistration = async (course: AvailableCourse) => {
    if (!employeeId) return;

    try {
      if (course.enrollmentId) {
        if (!(await confirm({ message: `Cancel registration for ${course.title}?`, confirmLabel: "Cancel Registration", danger: true }))) {
          return;
        }
        await updateEnrollmentStatus(course.enrollmentId, { action: "cancel" });
      } else {
        await createEnrollment({ planId: course.rollingId, employeeId, source: "EMPLOYEE" });
      }
      await loadEnrollments();
      toast.success(
        course.enrollmentId
          ? `ยกเลิกการลงทะเบียน  แล้ว / Registration cancelled`
          : `ลงทะเบียนอบรม  แล้ว / Registered`,
      );
    } catch (error) {
      console.error("Failed to update registration", error);
      toast.error("อัปเดตการลงทะเบียนไม่สำเร็จ กรุณาลองอีกครั้ง / Failed to update registration");
    }
  };

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Register Training"
        title="Register Training"
        detail="Courses appear here after HRD confirms and publishes the monthly rolling plan."
      />


      <div className={styles.registerWorkspace}>
        {courseOwnerGroups.map((group) => {
          const courses = availableCourses.filter(
            (course) => course.courseOwner === group.owner,
          );

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
                  const isExpanded = course.rollingId === expandedCourseId;
                  const isRegistered = course.trainingStatus === "Registered";

                  return (
                    <article
                      className={`${styles.trainingItem} ${
                        isExpanded ? styles.activeTrainingItem : ""
                      }`}
                      key={course.rollingId}
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
                          onClick={() =>
                            setExpandedCourseId(isExpanded ? null : course.rollingId)
                          }
                        >
                          {isExpanded ? "Hide detail" : "Show detail"}
                        </button>
                        <button type="button" onClick={() => void handleRegistration(course)}>
                          {isRegistered ? "Cancel registration" : "Register"}
                        </button>
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
                  <p className={styles.emptyCourseGroup}>
                    No published courses in this group.
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
