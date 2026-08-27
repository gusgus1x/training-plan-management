"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildProfileItems,
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import {
  createNeedRequest,
  listNeedRequests,
} from "../../lib/trainingNeedRequests/client";
import type { NeedRequestRecord } from "../../lib/trainingNeedRequests/types";
import { needRequestStatusLabel } from "../../lib/trainingNeedRequests/labels";
import { requestStatuses } from "./data";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import { buildRecords, type EmployeeTrainingRecord } from "./RecordModule";
import { useNotice } from "../NoticeDialog";
import { useToast } from "../ToastHost";
import { useUiLanguage } from "../ThaiUiLocalization";
import ModuleHeader from "./ModuleHeader";
import shell from "../shared/ModuleShell.module.css";
import styles from "./UserDashboard.module.css";

type RequestTrainingModuleProps = {
  reason: string;
  setReason: (value: string) => void;
  setTrainingNeed: (value: string) => void;
  trainingNeed: string;
};

// The owning HRD comes from the plan itself. It used to be guessed from the course name containing
// "5S", which mislabelled every other factory course as a Center one.
const courseOwnerOf = (record: EmployeeTrainingRecord) =>
  record.provider === "Factory HRD" ? "Factory" : "Center";

export default function RequestTrainingModule({
  reason,
  setReason,
  setTrainingNeed,
  trainingNeed,
}: RequestTrainingModuleProps) {
  const authenticatedUser = useAuthenticatedUser();
  const profileItems = buildProfileItems(authenticatedUser);
  const employeeCode = profileValue(authenticatedUser?.employeeCode);
  const employeeName = profileValue(authenticatedUser?.username);
  const employeeCompany = profileValue(authenticatedUser?.companyCode);
  const employeeFunction = profileValue(authenticatedUser?.functionName);
  const [completedCourses, setCompletedCourses] = useState<EmployeeTrainingRecord[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const notice = useNotice();
  const toast = useToast();
  const { language } = useUiLanguage();
  // One language at a time - a "ไทย / English" label shows both to a reader who asked for one.
  const t = (th: string, en: string) => (language === "th" ? th : en);
  const statusLabel = (status: NeedRequestRecord["status"]) => needRequestStatusLabel(status, language);
  const [myRequests, setMyRequests] = useState<NeedRequestRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedCourse =
    completedCourses.find((course) => course.id === selectedCourseId) ?? completedCourses[0];
  const selectedCourseOwner = selectedCourse ? courseOwnerOf(selectedCourse) : "Center";

  useEffect(() => {
    let cancelled = false;
    // Same source and same rule as the training record page, so a course shown there can always be
    // picked here. The server scopes the list to the signed-in employee.
    listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then(({ enrollments }) => {
        if (cancelled) return;
        setCompletedCourses(buildRecords(enrollments));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMyRequests = () =>
    listNeedRequests()
      .then(({ needRequests }) => setMyRequests(needRequests))
      .catch(() => undefined);

  useEffect(() => {
    void loadMyRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    const courseNeed = trainingNeed.trim();
    const requestReason = reason.trim();

    const missingFields: string[] = [];
    if (!courseNeed) missingFields.push("หลักสูตรที่ต้องการอบรม (Course Needed)");
    if (!requestReason) missingFields.push("เหตุผลในการขออบรม (Request Reason)");
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }

    setIsSubmitting(true);
    try {
      // The request is filed against the signed-in employee on the server; nothing about who is
      // asking travels in the body.
      const { needRequest } = await createNeedRequest({
        requestedCourseName: courseNeed,
        requestReason,
        preferredStartDate: null,
        preferredEndDate: null,
      });

      setMyRequests((current) => [needRequest, ...current]);
      setTrainingNeed("");
      setReason("");
      toast.success(
        t(
          `ส่งคำขอ ${needRequest.requestNo} ไปยัง HRD แล้ว`,
          `Request ${needRequest.requestNo} submitted to HRD`,
        ),
      );
    } catch (error: unknown) {
      // The old page reported success the moment it wrote to localStorage, so a request that never
      // reached anyone still looked sent.
      toast.error(
        error instanceof Error
          ? error.message
          : t("ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง", "Could not submit the request"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectCourse = (courseId: string) => {
    const nextCourse = completedCourses.find((course) => course.id === courseId);

    setSelectedCourseId(courseId);
    setTrainingNeed(nextCourse ? `${nextCourse.courseTitle} follow-up training` : "");
    setReason(
      nextCourse
        ? `I completed ${nextCourse.courseTitle} on ${nextCourse.completedDate} and would like additional training to improve practical usage.`
        : "",
    );
  };

  return (
    <section className={shell.moduleWorkspace}>
      <ModuleHeader
        eyebrow="Request Training Need"
        title="Request Training Need"
        detail="Select a completed training record, then request follow-up training need to HRD Center."
      />

      <div className={styles.requestLayout}>
        <form className={styles.requestForm}>
          <div className={styles.requestEmployeeStrip}>
            {profileItems.slice(0, 4).map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <section className={styles.previousTrainingPicker} aria-label="Previous training records">
            <div>
              <p>Previous Training</p>
              <strong>Select a course from your training record</strong>
            </div>
            <label className={styles.courseDropdown}>
              Course
              <select
                value={selectedCourse?.id ?? ""}
                onChange={(event) => handleSelectCourse(event.target.value)}
              >
                {completedCourses.length === 0 ? (
                  <option value="">
                    {t("ยังไม่มีประวัติการอบรม", "No completed training yet")}
                  </option>
                ) : null}
                {completedCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.courseTitle}
                  </option>
                ))}
              </select>
            </label>

            {selectedCourse ? (
              <article className={styles.selectedPreviousCourse}>
                <div>
                  <span>Completed Course</span>
                  <strong>{selectedCourse.courseTitle}</strong>
                  <small>
                    {selectedCourse.completedDate} · {selectedCourse.result} ·{" "}
                    {selectedCourse.hours} hrs
                  </small>
                </div>
                <b className={styles.courseOwnerBadge}>{selectedCourseOwner}</b>
              </article>
            ) : null}

          </section>

          <label>
            Course Needed
            <input
              type="text"
              value={trainingNeed}
              onChange={(event) => setTrainingNeed(event.target.value)}
              placeholder="Enter course or skill topic"
            />
          </label>
          <label>
            Request Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this training is needed"
            />
          </label>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting
              ? t("กำลังส่ง...", "Submitting...")
              : t("ส่งคำขอฝึกอบรม", "Submit Training Need")}
          </button>
        </form>

        <div className={styles.requestPreview}>
          <article>
            <p>Preview Request</p>
            <h3>{trainingNeed || "Course name will appear here"}</h3>
            <span>{reason || "Request reason will appear here"}</span>
          </article>

          {selectedCourse ? (
            <section className={styles.selectedRecordPreview}>
              <p>Based On Training Record</p>
              <strong>{selectedCourse.courseTitle}</strong>
              <span>
                {selectedCourseOwner} · {selectedCourse.completedDate} · {selectedCourse.result} ·{" "}
                {selectedCourse.hours} hrs
              </span>
            </section>
          ) : null}

          <div className={styles.approvalTimeline}>
            {requestStatuses.map((item) => (
              <article key={item.title}>
                <b>{item.status}</b>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.owner}</span>
                </div>
              </article>
            ))}
          </div>

          <section className={shell.panel}>
            <div className={shell.panelHeader}>
              <div>
                <span>{t("คำขอของฉัน", "My Requests")}</span>
                <h3>{t(`ส่งไปแล้ว ${myRequests.length} รายการ`, `${myRequests.length} submitted`)}</h3>
              </div>
            </div>
            {myRequests.length === 0 ? (
              <p className={shell.emptyState}>
                {t("ยังไม่เคยส่งคำขอ", "No request submitted yet")}
              </p>
            ) : null}
            {myRequests.slice(0, 5).map((request) => (
              <article key={request.id}>
                <span>{request.requestNo}</span>
                <strong>{request.requestedCourseName}</strong>
                <small>{statusLabel(request.status)}</small>
              </article>
            ))}
          </section>
        </div>
      </div>
    </section>
  );
}
