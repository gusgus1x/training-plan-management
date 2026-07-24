"use client";

import { useMemo, useState } from "react";
import {
  buildProfileItems,
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import {
  createTrainingNeedRequestNo,
  EMPLOYEE_TRAINING_REQUESTS_STORAGE_KEY,
  type EmployeeTrainingNeedRequest,
} from "../../lib/trainingRequests";
import { recordCourses, requestStatuses } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type RequestTrainingModuleProps = {
  reason: string;
  setReason: (value: string) => void;
  setTrainingNeed: (value: string) => void;
  trainingNeed: string;
};

const readStoredRequests = () => {
  if (typeof window === "undefined") {
    return [] as EmployeeTrainingNeedRequest[];
  }

  try {
    const storedValue = window.localStorage.getItem(EMPLOYEE_TRAINING_REQUESTS_STORAGE_KEY);
    return storedValue ? (JSON.parse(storedValue) as EmployeeTrainingNeedRequest[]) : [];
  } catch {
    return [] as EmployeeTrainingNeedRequest[];
  }
};

const getCourseOwner = (courseName: string) => {
  if (courseName.includes("5S")) {
    return "Factory";
  }

  return "Center";
};

const completedRecordCourses: Array<(typeof recordCourses)[number]> = [];

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
  const [selectedCourseName, setSelectedCourseName] = useState<string>(
    completedRecordCourses[0]?.course ?? "",
  );
  const [submitMessage, setSubmitMessage] = useState("");
  const [submittedRequests, setSubmittedRequests] = useState(readStoredRequests);
  const selectedCourse =
    completedRecordCourses.find((course) => course.course === selectedCourseName) ??
    completedRecordCourses[0];
  const selectedCourseOwner = selectedCourse ? getCourseOwner(selectedCourse.course) : "Center";

  const myRequests = useMemo(
    () =>
      submittedRequests.filter(
        (request) => employeeCode === "-" || request.employeeCode === employeeCode,
      ),
    [employeeCode, submittedRequests],
  );

  const handleSubmit = () => {
    const nextRequest: EmployeeTrainingNeedRequest = {
      id: `employee-req-${Date.now()}`,
      requestNo: createTrainingNeedRequestNo(),
      employeeCode,
      employeeName,
      company: employeeCompany,
      functionName: employeeFunction,
      courseNeed: trainingNeed.trim(),
      reason: reason.trim(),
      sourceCourse: selectedCourse?.course,
      sourceCourseDate: selectedCourse?.date,
      sourceCourseResult: selectedCourse?.result,
      sourceCourseOwner: selectedCourseOwner,
      expectedBenefit: "Improve working skill and apply the knowledge in daily operation.",
      preferredMonth: "-",
      urgency: "Normal",
      status: "New Request",
      submittedAt: new Date().toISOString().slice(0, 10),
      approvedBy: "",
    };

    if (!nextRequest.courseNeed || !nextRequest.reason) {
      setSubmitMessage("Please enter Course Needed and Request Reason.");
      return;
    }

    const nextRequests = [nextRequest, ...readStoredRequests()];
    window.localStorage.setItem(
      EMPLOYEE_TRAINING_REQUESTS_STORAGE_KEY,
      JSON.stringify(nextRequests),
    );
    window.dispatchEvent(new Event("employee-training-requests-changed"));
    setSubmittedRequests(nextRequests);
    setSubmitMessage(`${nextRequest.requestNo} submitted to HRD Center.`);
  };

  const handleSelectCourse = (courseName: string) => {
    const nextCourse = completedRecordCourses.find((course) => course.course === courseName);

    setSelectedCourseName(courseName);
    setTrainingNeed(nextCourse ? `${nextCourse.course} follow-up training` : "");
    setReason(
      nextCourse
        ? `I completed ${nextCourse.course} on ${nextCourse.date} and would like additional training to improve practical usage.`
        : "",
    );
  };

  return (
    <section className={styles.modulePage}>
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
                value={selectedCourseName}
                onChange={(event) => handleSelectCourse(event.target.value)}
              >
                {completedRecordCourses.map((course) => (
                  <option key={course.course} value={course.course}>
                    {course.course}
                  </option>
                ))}
              </select>
            </label>

            {selectedCourse ? (
              <article className={styles.selectedPreviousCourse}>
                <div>
                  <span>Completed Course</span>
                  <strong>{selectedCourse.course}</strong>
                  <small>
                    {selectedCourse.date} / {selectedCourse.result} / {selectedCourse.assessment}
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
          <button type="button" onClick={handleSubmit}>
            Submit Training Need
          </button>
          {submitMessage ? <p className={styles.requestSubmitMessage}>{submitMessage}</p> : null}
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
              <strong>{selectedCourse.course}</strong>
              <span>
                {selectedCourseOwner} / {selectedCourse.date} / {selectedCourse.result} /{" "}
                {selectedCourse.assessment}
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

          <section className={styles.myRequestPanel}>
            <div>
              <p>My Requests</p>
              <strong>{myRequests.length} submitted</strong>
            </div>
            {myRequests.slice(0, 3).map((request) => (
              <article key={request.id}>
                <span>{request.requestNo}</span>
                <strong>{request.courseNeed}</strong>
                <small>{request.status}</small>
              </article>
            ))}
          </section>
        </div>
      </div>
    </section>
  );
}
