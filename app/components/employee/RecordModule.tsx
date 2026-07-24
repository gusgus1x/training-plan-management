"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  readWorkflowCollection,
  type WorkflowCompletedCourse,
} from "../../lib/trainingWorkflow";
import {
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type EmployeeTrainingRecord = {
  id: string;
  courseCode: string;
  courseTitle: string;
  category: "Mandatory" | "Core Skill" | "Role Skill" | "Safety";
  completedDate: string;
  provider: "HRD Center" | "Factory HRD" | "External";
  trainingType: "Classroom" | "Online" | "Workshop" | "External";
  hours: number;
  result: "Completed" | "Passed";
  score: number | null;
  certificateNo: string;
  evidenceStatus: "Ready" | "Verified";
  instructor: string;
  location: string;
  note: string;
  preTestStatus: "Pending" | "Completed";
  postTestStatus: "Pending" | "Completed";
  evaluationStatus: "Pending" | "Completed";
};

type DownloadPurpose = "job_change" | "resignation";

const downloadPurposes: Record<DownloadPurpose, { label: string; description: string }> = {
  job_change: {
    label: "Job application / transfer",
    description: "Use this file as supporting evidence when applying for or changing jobs.",
  },
  resignation: {
    label: "Resignation document",
    description: "Use this file as a complete training record for resignation documents.",
  },
};

const employeeRecords: EmployeeTrainingRecord[] = [
  {
    id: "record-orientation",
    courseCode: "ORI-2026-05",
    courseTitle: "Orientation Program",
    category: "Core Skill",
    completedDate: "2026-05-12",
    provider: "HRD Center",
    trainingType: "Classroom",
    hours: 6,
    result: "Completed",
    score: null,
    certificateNo: "EMP-ORI-260512-001",
    evidenceStatus: "Verified",
    instructor: "HRD Learning Team",
    location: "Training Room A",
    note: "New employee orientation completed and verified by HRD.",
    preTestStatus: "Completed",
    postTestStatus: "Completed",
    evaluationStatus: "Completed",
  },
  {
    id: "record-5s",
    courseCode: "5S-2026-06",
    courseTitle: "5S Awareness",
    category: "Safety",
    completedDate: "2026-06-22",
    provider: "Factory HRD",
    trainingType: "Workshop",
    hours: 3,
    result: "Passed",
    score: 88,
    certificateNo: "EMP-5S-260622-014",
    evidenceStatus: "Ready",
    instructor: "Production Excellence",
    location: "Shop Floor Learning Area",
    note: "Passed post-training assessment and practical review.",
    preTestStatus: "Completed",
    postTestStatus: "Pending",
    evaluationStatus: "Pending",
  },
  {
    id: "record-pdpa",
    courseCode: "PDPA-2026-07",
    courseTitle: "Data Privacy Awareness",
    category: "Mandatory",
    completedDate: "2026-07-15",
    provider: "HRD Center",
    trainingType: "Online",
    hours: 2,
    result: "Passed",
    score: 96,
    certificateNo: "EMP-PDPA-260715-021",
    evidenceStatus: "Verified",
    instructor: "IT Governance",
    location: "Online",
    note: "Mandatory compliance training completed for annual requirement.",
    preTestStatus: "Pending",
    postTestStatus: "Pending",
    evaluationStatus: "Pending",
  },
];

const categories = ["all", "Mandatory", "Core Skill", "Role Skill", "Safety"] as const;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));

const escapeCell = (value: string | number | null) =>
  String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const exportPersonalRecord = (
  records: EmployeeTrainingRecord[],
  employeeName: string,
  purpose: (typeof downloadPurposes)[DownloadPurpose],
) => {
  const headers = [
    "Employee",
    "Completed Date",
    "Course Code",
    "Course Title",
    "Category",
    "Provider",
    "Training Type",
    "Hours",
    "Result",
    "Score",
    "Certificate No.",
    "Evidence Status",
    "Pre Test",
    "Post Test",
    "Evaluation",
    "Instructor",
    "Location",
  ];
  const rows = records.map((record) => [
    employeeName,
    formatDate(record.completedDate),
    record.courseCode,
    record.courseTitle,
    record.category,
    record.provider,
    record.trainingType,
    record.hours,
    record.result,
    record.score,
    record.certificateNo,
    record.evidenceStatus,
    record.preTestStatus,
    record.postTestStatus,
    record.evaluationStatus,
    record.instructor,
    record.location,
  ]);
  const recordTableRows = [headers, ...rows]
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join("")}</tr>`)
    .join("");
  const summaryRows = [
    ["Document", "Completed Training Record"],
    ["Employee", employeeName],
    ["Purpose", purpose.label],
    ["Purpose Detail", purpose.description],
    ["Total Completed Records", records.length],
    ["Total Completed Hours", records.reduce((total, record) => total + record.hours, 0)],
    ["Generated Date", formatDate(new Date().toISOString().slice(0, 10))],
  ]
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join("")}</tr>`)
    .join("");
  const workbook = `<!doctype html><html><head><meta charset="utf-8" /><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;margin-bottom:16px}td{border:1px solid #cbd5e1;padding:6px 8px;white-space:nowrap}.summary tr td:first-child,.records tr:first-child td{background:#f1f5f9;font-weight:700}</style></head><body><table class="summary">${summaryRows}</table><table class="records">${recordTableRows}</table></body></html>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `my-training-record-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function RecordModule() {
  const authenticatedUser = useAuthenticatedUser();
  const employeeName = profileValue(authenticatedUser?.displayName ?? authenticatedUser?.username);
  const employeeCode = profileValue(authenticatedUser?.employeeCode);
  const [records, setRecords] = useState<EmployeeTrainingRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<(typeof categories)[number]>("all");
  const [query, setQuery] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [downloadPurpose, setDownloadPurpose] = useState<DownloadPurpose>("job_change");
  const [exportMessage, setExportMessage] = useState("");
  const [assessmentMessage, setAssessmentMessage] = useState("");

  useEffect(() => {
    const syncRecords = () => {
      const nextRecords = readWorkflowCollection<WorkflowCompletedCourse>(
        TRAINING_WORKFLOW_KEYS.completedCourses,
      )
        .filter((course) =>
          course.attendees.some(
            (attendee) =>
              attendee.employeeCode === employeeCode && attendee.attended,
          ),
        )
        .map<EmployeeTrainingRecord>((course) => ({
          id: course.id,
          courseCode: course.code,
          courseTitle: course.title,
          category: course.owner === "CENTER" ? "Mandatory" : "Core Skill",
          completedDate: course.date,
          provider: course.owner === "CENTER" ? "HRD Center" : "Factory HRD",
          trainingType: "Classroom",
          hours: course.hours,
          result: "Completed",
          score: null,
          certificateNo: `CERT-${course.code}-${employeeCode}`,
          evidenceStatus: "Ready",
          instructor: course.instructor,
          location: course.room,
          note: "Saved from Training Actual by HRD.",
          preTestStatus: "Pending",
          postTestStatus: "Pending",
          evaluationStatus: "Pending",
        }));

      setRecords(nextRecords);
      setSelectedRecordId((current) =>
        nextRecords.some((record) => record.id === current)
          ? current
          : nextRecords[0]?.id ?? "",
      );
    };

    syncRecords();
    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncRecords);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncRecords);
  }, [employeeCode]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return records.filter((record) => {
      const matchesCategory = selectedCategory === "all" || record.category === selectedCategory;
      const matchesQuery =
        !normalizedQuery ||
        [
          record.courseCode,
          record.courseTitle,
          record.category,
          record.provider,
          record.certificateNo,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [query, records, selectedCategory]);

  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedRecordId) ??
    filteredRecords[0] ??
    null;

  const handleExportAll = () => {
    if (records.length === 0) {
      setExportMessage("No training record available to export.");
      return;
    }

    const purpose = downloadPurposes[downloadPurpose];

    exportPersonalRecord(records, employeeName, purpose);
    setExportMessage(
      `Downloaded ${records.length} completed training records for ${purpose.label}.`,
    );
  };

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Employee Training Record"
        title="My Training Record"
        detail="A personal training passport for completed courses, certificates, scores, and verified learning hours."
      />

      <section className={styles.employeeRecordToolbar} aria-label="Training record filters">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setExportMessage("");
          }}
          placeholder="Search course, provider, certificate..."
        />
        <select
          value={selectedCategory}
          onChange={(event) => {
            setSelectedCategory(event.target.value as (typeof categories)[number]);
            setExportMessage("");
          }}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category === "all" ? "All categories" : category}
            </option>
          ))}
        </select>
      </section>

      <section className={styles.employeeRecordDownloadBox} aria-label="Download completed training files">
        <div>
          <span>All Completed Training Files</span>
          <h2>Download full training record</h2>
          <p>
            Download one file that includes every completed training record, certificate number,
            learning hours, score, provider, evidence status, and document purpose.
          </p>
        </div>
        <div className={styles.employeeRecordPurposeGroup} aria-label="Document purpose">
          {(Object.keys(downloadPurposes) as DownloadPurpose[]).map((purposeKey) => (
            <label key={purposeKey}>
              <input
                checked={downloadPurpose === purposeKey}
                name="download-purpose"
                onChange={() => {
                  setDownloadPurpose(purposeKey);
                  setExportMessage("");
                }}
                type="radio"
              />
              <span>
                <strong>{downloadPurposes[purposeKey].label}</strong>
                <small>{downloadPurposes[purposeKey].description}</small>
              </span>
            </label>
          ))}
        </div>
        <div className={styles.employeeRecordDownloadMeta}>
          <article>
            <span>Records</span>
            <strong>{records.length}</strong>
          </article>
          <article>
            <span>Hours</span>
            <strong>{records.reduce((total, record) => total + record.hours, 0)}</strong>
          </article>
          <button type="button" onClick={handleExportAll}>
            Download All Records
          </button>
        </div>
        {exportMessage ? <p className={styles.employeeRecordMessage}>{exportMessage}</p> : null}
      </section>

      <div className={styles.employeeRecordWorkspace}>
        <section className={styles.employeeRecordListPanel} aria-label="Completed training list">
          <div className={styles.panelHeader}>
            <div>
              <p>Completed History</p>
              <h2>Training Timeline</h2>
            </div>
            <span>{filteredRecords.length} records</span>
          </div>

          <div className={styles.employeeRecordTimeline}>
            {filteredRecords.map((record) => (
              <button
                className={
                  record.id === selectedRecord?.id
                    ? styles.activeEmployeeRecordItem
                    : styles.employeeRecordItem
                }
                key={record.id}
                type="button"
                onClick={() => {
                  setSelectedRecordId(record.id);
                  setExportMessage("");
                  setAssessmentMessage("");
                }}
              >
                <time dateTime={record.completedDate}>{formatDate(record.completedDate)}</time>
                <div>
                  <strong>{record.courseTitle}</strong>
                  <span>{record.courseCode} / {record.provider}</span>
                </div>
                <b>{record.result}</b>
              </button>
            ))}
            {filteredRecords.length === 0 ? (
              <p className={styles.employeeRecordEmpty}>No completed training record found.</p>
            ) : null}
          </div>
        </section>

        {selectedRecord ? (
        <aside className={styles.employeeRecordDetailPanel} aria-label="Selected training record detail">
          <div className={styles.employeeRecordDetailHead}>
            <div>
              <span>{selectedRecord.category}</span>
              <h2>{selectedRecord.courseTitle}</h2>
              <p>{selectedRecord.courseCode} / {formatDate(selectedRecord.completedDate)}</p>
            </div>
            <b>{selectedRecord.evidenceStatus}</b>
          </div>

          <div className={styles.employeeRecordDetailGrid}>
            <article>
              <span>Hours</span>
              <strong>{selectedRecord.hours}</strong>
            </article>
            <article>
              <span>Score</span>
              <strong>{selectedRecord.score ? `${selectedRecord.score}%` : "-"}</strong>
            </article>
            <article>
              <span>Type</span>
              <strong>{selectedRecord.trainingType}</strong>
            </article>
            <article>
              <span>Result</span>
              <strong>{selectedRecord.result}</strong>
            </article>
          </div>

          <dl className={styles.employeeRecordMeta}>
            <div>
              <dt>Certificate No.</dt>
              <dd>{selectedRecord.certificateNo}</dd>
            </div>
            <div>
              <dt>Instructor</dt>
              <dd>{selectedRecord.instructor}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{selectedRecord.location}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{selectedRecord.provider}</dd>
            </div>
          </dl>

          <div className={styles.employeeRecordEvidence}>
            <span>Evidence Note</span>
            <p>{selectedRecord.note}</p>
          </div>

          <section className={styles.employeeAssessmentPanel} aria-label="Assessment flow">
            <div>
              <span>Assessment Flow</span>
              <h3>Pre test / Post test / Evaluation</h3>
              <p>
                Post test opens after pre test is completed. Evaluation opens after post test is completed.
              </p>
            </div>

            <div className={styles.employeeAssessmentSteps}>
              {[
                {
                  key: "pre",
                  title: "Pre Test",
                  status: selectedRecord.preTestStatus,
                  locked: false,
                  action: "Open Pre Test",
                },
                {
                  key: "post",
                  title: "Post Test",
                  status: selectedRecord.postTestStatus,
                  locked: selectedRecord.preTestStatus !== "Completed",
                  action: "Open Post Test",
                },
                {
                  key: "evaluation",
                  title: "Evaluation",
                  status: selectedRecord.evaluationStatus,
                  locked: selectedRecord.postTestStatus !== "Completed",
                  action: "Open Evaluation",
                },
              ].map((step) => {
                const isCompleted = step.status === "Completed";
                const buttonLabel = step.locked
                  ? "Locked"
                  : isCompleted
                    ? "Completed"
                    : step.action;

                return (
                  <article
                    className={step.locked ? styles.lockedAssessmentStep : styles.employeeAssessmentStep}
                    key={step.key}
                  >
                    <div>
                      <span>{step.title}</span>
                      <strong>{step.status}</strong>
                      <small>
                        {step.locked
                          ? step.key === "post"
                            ? "Complete pre test first"
                            : "Complete post test first"
                          : isCompleted
                            ? "Already submitted"
                            : "Ready to open"}
                      </small>
                    </div>
                    <button
                      disabled={step.locked || isCompleted}
                      type="button"
                      onClick={() => {
                        setAssessmentMessage(`${step.title} opened for ${selectedRecord.courseTitle}.`);
                      }}
                    >
                      {buttonLabel}
                    </button>
                  </article>
                );
              })}
            </div>

            {assessmentMessage ? (
              <p className={styles.employeeRecordMessage}>{assessmentMessage}</p>
            ) : null}
          </section>

        </aside>
        ) : (
          <aside className={styles.employeeRecordDetailPanel} aria-label="No training record">
            <p className={styles.employeeRecordEmpty}>
              No completed training record yet.
            </p>
          </aside>
        )}
      </div>
    </section>
  );
}
