"use client";

import { useEffect, useMemo, useState } from "react";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import type { EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import {
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import { useToast } from "../ToastHost";
import { useUiLanguage } from "../ThaiUiLocalization";
import ModuleHeader from "./ModuleHeader";
import shell from "../shared/ModuleShell.module.css";
import styles from "./UserDashboard.module.css";

export type EmployeeTrainingRecord = {
  id: string;
  courseCode: string;
  courseTitle: string;
  completedDate: string;
  provider: "HRD Center" | "Factory HRD";
  hours: number;
  result: "Completed";
  score: number | null;
  certificateNo: string;
  instructor: string;
  location: string;
  note: string;
  // Nobody has submitted an assessment through the system yet - assessment_submission is empty and
  // has no repository - so these are always Pending until that feature is built.
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

// A record is one enrollment the employee actually attended. Attendance is the only completed
// signal the database carries today: training_result has no rows and no repository yet.
export const toRecord = (enrollment: EnrollmentRecord): EmployeeTrainingRecord => ({
  id: enrollment.id,
  courseCode: enrollment.plan.courseCode,
  courseTitle: enrollment.plan.courseName,
  completedDate: enrollment.plan.startAt.slice(0, 10),
  provider: enrollment.plan.owner === "CENTER" ? "HRD Center" : "Factory HRD",
  hours: enrollment.plan.hours,
  result: "Completed",
  // No score and no certificate exist yet: training_result and training_certificate_file are both
  // empty. This file is downloaded as evidence for job applications, so an invented certificate
  // number would be a forged credential, not a placeholder.
  score: null,
  certificateNo: "-",
  instructor: enrollment.plan.instructor || "-",
  location: enrollment.plan.venue || "-",
  note: enrollment.plan.batchName,
  preTestStatus: "Pending",
  postTestStatus: "Pending",
  evaluationStatus: "Pending",
});

export const buildRecords = (enrollments: EnrollmentRecord[]) =>
  enrollments
    .filter((enrollment) => enrollment.attendance?.status === "PRESENT")
    .map(toRecord)
    .sort((left, right) => right.completedDate.localeCompare(left.completedDate));

const providers = ["all", "HRD Center", "Factory HRD"] as const;


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
    "Provider",
    "Hours",
    "Result",
    "Score",
    "Certificate No.",
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
    record.provider,
    record.hours,
    record.result,
    record.score,
    record.certificateNo,
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
  const { language } = useUiLanguage();
  // One language at a time - a "ไทย / English" label shows both to a reader who asked for one.
  const t = (th: string, en: string) => (language === "th" ? th : en);
  const employeeName = profileValue(authenticatedUser?.displayName ?? authenticatedUser?.username);
  const [records, setRecords] = useState<EmployeeTrainingRecord[]>([]);
  const [rawEnrollments, setRawEnrollments] = useState<EnrollmentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<(typeof providers)[number]>("all");
  const [query, setQuery] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [downloadPurpose, setDownloadPurpose] = useState<DownloadPurpose>("job_change");
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;

    listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then(({ enrollments }) => {
        if (cancelled) return;
        setRawEnrollments(enrollments);
        const nextRecords = buildRecords(enrollments);

        setRecords(nextRecords);
        setSelectedRecordId((current) =>
          nextRecords.some((record) => record.id === current)
            ? current
            : nextRecords[0]?.id ?? "",
        );
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Could not load training record");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const pendingEnrollments = useMemo(() => {
    return rawEnrollments.filter(
      (e) => e.status !== "Cancelled" && e.attendance?.status !== "PRESENT",
    );
  }, [rawEnrollments]);


  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return records.filter((record) => {
      const matchesProvider = selectedProvider === "all" || record.provider === selectedProvider;
      const matchesQuery =
        !normalizedQuery ||
        [
          record.courseCode,
          record.courseTitle,
          record.provider,
          record.instructor,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));

      return matchesProvider && matchesQuery;
    });
  }, [query, records, selectedProvider]);

  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedRecordId) ??
    filteredRecords[0] ??
    null;

  const handleExportAll = () => {
    if (records.length === 0) {
      toast.warning(t("ไม่มีประวัติการอบรมให้ส่งออก", "No training record available to export"));
      return;
    }

    const purpose = downloadPurposes[downloadPurpose];

    exportPersonalRecord(records, employeeName, purpose);
    toast.success(
      t(`ดาวน์โหลดประวัติการอบรม ${records.length} รายการแล้ว`, `Downloaded ${records.length} training record(s)`),
    );
  };

  return (
    <section className={shell.moduleWorkspace}>
      <ModuleHeader
        eyebrow="Employee Training Record"
        title="My Training Record"
        detail={t(
          "ประวัติการอบรมส่วนตัว หลักสูตรที่สำเร็จ ชั่วโมงเรียนรู้ และหลักฐานประกอบ",
          "A personal training passport for completed courses, learning hours, and evidence.",
        )}
        aside={
          <span className={shell.permissionNote}>
            {records.length} {t("รายการ", "completed")}
          </span>
        }
      />

      {/* Workspace Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          style={{
            padding: "10px 22px",
            borderRadius: "999px",
            border: activeTab === "pending" ? "1px solid var(--ui-30-primary)" : "1px solid var(--ui-30-border)",
            background: activeTab === "pending" ? "var(--ui-30-primary)" : "var(--ui-60-surface-soft)",
            color: activeTab === "pending" ? "#ffffff" : "var(--ui-30-ink)",
            fontSize: "0.85rem",
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: activeTab === "pending" ? "0 4px 14px rgba(37, 99, 235, 0.25)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          ⏳ {t("สถานะลงทะเบียน & รออนุมัติ", "Registration Status & Approval")} ({pendingEnrollments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("completed")}
          style={{
            padding: "10px 22px",
            borderRadius: "999px",
            border: activeTab === "completed" ? "1px solid var(--ui-30-primary)" : "1px solid var(--ui-30-border)",
            background: activeTab === "completed" ? "var(--ui-30-primary)" : "var(--ui-60-surface-soft)",
            color: activeTab === "completed" ? "#ffffff" : "var(--ui-30-ink)",
            fontSize: "0.85rem",
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: activeTab === "completed" ? "0 4px 14px rgba(37, 99, 235, 0.25)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          📜 {t("ประวัติการอบรมที่สำเร็จแล้ว", "Completed Records")} ({records.length})
        </button>
      </div>

      {activeTab === "pending" ? (
        <section className={shell.panel} style={{ marginBottom: "24px" }} aria-label="Pending approval registrations">
          <div className={shell.panelHeader}>
            <div>
              <p>Registration & Survey Status</p>
              <h2>{t("หลักสูตรที่ลงทะเบียน / รอการพิจารณาอนุมัติ", "Registered Courses / Awaiting Approval")}</h2>
            </div>
            <p>{pendingEnrollments.length} {t("รายการ", "items")}</p>
          </div>

          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            {pendingEnrollments.map((enrollment) => {
              const isCenterOwner = enrollment.plan.owner === "CENTER";
              const isPending = enrollment.status === "Pending Approval";
              const isApproved = enrollment.status === "Center Approved" || enrollment.status === "Factory Approved";
              const isRejected = enrollment.status === "Rejected";

              let statusBadgeText = isPending
                ? isCenterOwner
                  ? t("🟡 รอ HRD Center พิจารณาอนุมัติ", "🟡 Awaiting HRD Center Approval")
                  : t("🟡 รอ Factory HRD พิจารณาอนุมัติ", "🟡 Awaiting Factory HRD Approval")
                : isApproved
                  ? t("🟢 อนุมัติการลงทะเบียนแล้ว (รอเข้าอบรม & ทำแบบสำรวจ)", "🟢 Approved - Ready for Training & Survey")
                  : isRejected
                    ? t("🔴 ถูกปฏิเสธการลงทะเบียน", "🔴 Registration Rejected")
                    : enrollment.status;

              return (
                <div
                  key={enrollment.id}
                  style={{
                    padding: "16px",
                    borderRadius: "var(--ui-radius-lg)",
                    background: "var(--ui-60-surface-soft)",
                    border: "1px solid var(--ui-30-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 800,
                          padding: "4px 12px",
                          borderRadius: "999px",
                          background: isPending
                            ? "rgba(245, 158, 11, 0.15)"
                            : isApproved
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(239, 68, 68, 0.15)",
                          color: isPending
                            ? "#d97706"
                            : isApproved
                              ? "#10b981"
                              : "#dc2626",
                          border: isPending
                            ? "1px solid rgba(245, 158, 11, 0.3)"
                            : isApproved
                              ? "1px solid rgba(16, 185, 129, 0.3)"
                              : "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                      >
                        {statusBadgeText}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--ui-30-muted)", fontWeight: 700 }}>
                        {isCenterOwner ? "🏛️ HRD Center" : "🏭 Factory HRD"}
                      </span>
                    </div>
                    <strong style={{ fontSize: "1.05rem", color: "var(--ui-30-ink)" }}>
                      {enrollment.plan.courseName} ({enrollment.plan.courseCode})
                    </strong>
                    <div style={{ fontSize: "0.82rem", color: "var(--ui-30-muted)", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <span>📅 {enrollment.plan.startAt.slice(0, 10)}</span>
                      <span>📍 {enrollment.plan.venue || "-"}</span>
                      <span>👨‍🏫 {enrollment.plan.instructor || "-"}</span>
                      <span>⏱️ {enrollment.plan.hours} {t("ชม.", "hrs")}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {pendingEnrollments.length === 0 ? (
              <p className={shell.emptyState}>
                {t("ยังไม่มีรายการลงทะเบียนที่อยู่ระหว่างรออนุมัติ", "No pending registrations currently.")}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "completed" ? (
        <>
          <section className={shell.panel}>
            <div className={shell.toolbar} aria-label="Training record filters">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder={t("ค้นหาหลักสูตร ผู้จัด วิทยากร...", "Search course, provider, instructor...")}
              />
              <div className={shell.filterGroup}>
                <select
                  value={selectedProvider}
                  onChange={(event) => {
                    setSelectedProvider(event.target.value as (typeof providers)[number]);
                  }}
                >
                  {providers.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider === "all" ? t("ผู้จัดทั้งหมด", "All providers") : provider}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadError ? (
              <p className={shell.emptyState} role="alert">
                {t("โหลดประวัติการอบรมไม่สำเร็จ", "Could not load training record")}: {loadError}
              </p>
            ) : null}
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
      </section>

      <div className={shell.contentGrid}>
        <section className={shell.panel} aria-label="Completed training list">
          <div className={shell.panelHeader}>
            <div>
              <p>Completed History</p>
              <h2>Training Timeline</h2>
            </div>
            <p>{filteredRecords.length} records</p>
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
              <p className={shell.emptyState}>
                {isLoading
                  ? t("กำลังโหลด...", "Loading...")
                  : t("ไม่พบประวัติการอบรม", "No completed training record found.")}
              </p>
            ) : null}
          </div>
        </section>

        {selectedRecord ? (
        <aside className={shell.detailPanel} aria-label="Selected training record detail">
          <div className={styles.employeeRecordDetailHead}>
            <div>
              <span>{selectedRecord.provider}</span>
              <h2>{selectedRecord.courseTitle}</h2>
              <p>{selectedRecord.courseCode} / {formatDate(selectedRecord.completedDate)}</p>
            </div>
            <b>{selectedRecord.result}</b>
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
              <span>Batch</span>
              <strong>{selectedRecord.note}</strong>
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
            <span>{t("หมายเหตุหลักฐาน", "Evidence Note")}</span>
            <p>
              {t(
                "บันทึกจากการเช็กชื่อเข้าอบรม ใบรับรองและคะแนนจะแสดงเมื่อระบบบันทึกผลการอบรมแล้ว",
                "Confirmed by attendance check-in. Certificate and score appear once results are recorded.",
              )}
            </p>
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
                        toast.info(`เปิด ${step.title} สำหรับ ${selectedRecord.courseTitle} แล้ว / ${step.title} opened`);
                      }}
                    >
                      {buttonLabel}
                    </button>
                  </article>
                );
              })}
            </div>

          </section>

        </aside>
        ) : (
          <aside className={shell.detailPanel} aria-label="No training record">
            <p className={shell.emptyState}>
              No completed training record yet.
            </p>
          </aside>
        )}
      </div>
        </>
      ) : null}
    </section>
  );
}
