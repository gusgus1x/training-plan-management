"use client";

import { useEffect, useMemo, useState } from "react";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import type {
  AssessmentStageInfo,
  EnrollmentAssessmentInfo,
  EnrollmentRecord,
} from "../../lib/trainingEnrollment/types";
import {
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import { useToast } from "../ToastHost";
import { useUiLanguage } from "../ThaiUiLocalization";
import ModuleHeader from "./ModuleHeader";
import styles from "./RecordModule.module.css";

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
  assessment: EnrollmentAssessmentInfo;
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

export const toRecord = (enrollment: EnrollmentRecord): EmployeeTrainingRecord => ({
  id: enrollment.id,
  courseCode: enrollment.plan.courseCode,
  courseTitle: enrollment.plan.courseName,
  completedDate: enrollment.plan.startAt.slice(0, 10),
  provider: enrollment.plan.owner === "CENTER" ? "HRD Center" : "Factory HRD",
  hours: enrollment.plan.hours,
  result: "Completed",
  score: enrollment.result?.postScore ?? null,
  certificateNo: enrollment.result?.certificateNo || "-",
  instructor: enrollment.plan.instructor || "-",
  location: enrollment.plan.venue || "-",
  note: enrollment.plan.batchName || "1",
  assessment: enrollment.plan.assessment,
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
    .map(([key, value]) => `<tr><th>${escapeCell(key)}</th><td>${escapeCell(value)}</td></tr>`)
    .join("");

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Training Record - ${escapeCell(employeeName)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
    h1 { margin-bottom: 4px; }
    p { margin-top: 0; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; text-align: left; }
    th { background-color: #f1f5f9; font-weight: bold; }
    .summary-table th { width: 220px; }
  </style>
</head>
<body>
  <h1>Official Training Record Passport</h1>
  <p>Issued by ATTG Training Plan Management System for ${escapeCell(employeeName)}</p>

  <table class="summary-table">
    <tbody>
      ${summaryRows}
    </tbody>
  </table>

  <h2>Completed Course History</h2>
  <table>
    <tbody>
      ${recordTableRows}
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html" });
  const downloadUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = `Training_Record_${employeeName.replaceAll(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(downloadUrl);
};

export default function RecordModule() {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);

  const authenticatedUser = useAuthenticatedUser();
  const employeeId = authenticatedUser?.employeeId ?? null;
  const employeeName = profileValue(authenticatedUser?.username);
  const employeeCode = profileValue(authenticatedUser?.employeeCode);
  const employeeCompany = profileValue(authenticatedUser?.companyCode);
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"pending" | "completed" | "download">("pending");
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<(typeof providers)[number]>("all");
  const [downloadPurpose, setDownloadPurpose] = useState<DownloadPurpose>("job_change");
  const [detailModalRecord, setDetailModalRecord] = useState<EmployeeTrainingRecord | null>(null);
  const [detailModalEnrollment, setDetailModalEnrollment] = useState<EnrollmentRecord | null>(null);

  useEffect(() => {
    if (!employeeId) {
      setEnrollments([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    listEnrollments({ planId: null, employeeId, employeeUserId: null })
      .then((result) => {
        setEnrollments(result.enrollments || []);
      })
      .catch((error) => {
        const errorMsg = error instanceof Error ? error.message : "Failed to load enrollments";
        setLoadError(errorMsg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [employeeId]);

  const pendingEnrollments = useMemo(
    () => enrollments.filter((enrollment) => enrollment.attendance?.status !== "PRESENT"),
    [enrollments],
  );

  const records = useMemo(() => buildRecords(enrollments), [enrollments]);

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        if (selectedProvider !== "all" && record.provider !== selectedProvider) {
          return false;
        }
        if (!query.trim()) {
          return true;
        }
        const normalizedQuery = query.toLowerCase().trim();
        return (
          record.courseCode.toLowerCase().includes(normalizedQuery) ||
          record.courseTitle.toLowerCase().includes(normalizedQuery) ||
          record.provider.toLowerCase().includes(normalizedQuery) ||
          record.instructor.toLowerCase().includes(normalizedQuery) ||
          record.location.toLowerCase().includes(normalizedQuery)
        );
      }),
    [query, records, selectedProvider],
  );

  const passportSummary = useMemo(() => {
    const totalHours = records.reduce((sum, r) => sum + r.hours, 0);
    const completedCount = records.length;
    const scores = records.map((r) => r.score).filter((s): s is number => s !== null);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { totalHours, completedCount, avgScore, pendingCount: pendingEnrollments.length };
  }, [pendingEnrollments.length, records]);

  const handleExportAll = () => {
    if (records.length === 0) {
      toast.error(t("ไม่มีประวัติการอบรมที่สำเร็จสำหรับดาวน์โหลด", "No completed records to download"));
      return;
    }
    const purpose = downloadPurposes[downloadPurpose];
    exportPersonalRecord(records, employeeName, purpose);
    toast.success(
      t(`ดาวน์โหลดประวัติการอบรม ${records.length} รายการแล้ว`, `Downloaded ${records.length} training record(s)`),
    );
  };

  return (
    <section className={styles.recordWorkspace}>
      <ModuleHeader
        eyebrow="My Record"
        title="My Record"
        detail={t(
          "พาสปอร์ตและประวัติการอบรมส่วนตัว รายการหลักสูตรที่ลงทะเบียน ชั่วโมงเรียนรู้ และใบรับรอง",
          "Personal training passport for registered & completed courses, learning hours, and certificates.",
        )}
        aside={
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--ui-30-muted)" }}>
            {employeeName} ({employeeCode}) • {employeeCompany}
          </span>
        }
      />

      {/* 1. Training Passport Hero Bar (Summary KPI Cards) */}
      <section className={styles.passportHero} aria-label="Training Passport KPI Summary">
        <div className={styles.heroStatCard}>
          <div
            className={styles.heroIconBadge}
            style={{
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3))",
              color: "#10b981",
            }}
          >
            🏆
          </div>
          <div className={styles.heroMeta}>
            <span className={styles.heroLabel}>{t("ผ่านการอบรมแล้ว", "Completed Courses")}</span>
            <span className={styles.heroValue}>{passportSummary.completedCount} {t("หลักสูตร", "courses")}</span>
            <span className={styles.heroSub}>{t("บันทึกการเช็กชื่อเข้าร่วม", "Attended check-in verified")}</span>
          </div>
        </div>

        <div className={styles.heroStatCard}>
          <div
            className={styles.heroIconBadge}
            style={{
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))",
              color: "#3b82f6",
            }}
          >
            ⏱️
          </div>
          <div className={styles.heroMeta}>
            <span className={styles.heroLabel}>{t("ชั่วโมงเรียนรู้สะสม", "Learning Hours")}</span>
            <span className={styles.heroValue}>{passportSummary.totalHours} {t("ชั่วโมง", "hours")}</span>
            <span className={styles.heroSub}>{t("สะสมปีปัจจุบัน", "Current year total")}</span>
          </div>
        </div>

        <div className={styles.heroStatCard}>
          <div
            className={styles.heroIconBadge}
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(124, 58, 237, 0.3))",
              color: "#8b5cf6",
            }}
          >
            📊
          </div>
          <div className={styles.heroMeta}>
            <span className={styles.heroLabel}>{t("คะแนนเฉลี่ยสอบ", "Average Post-Score")}</span>
            <span className={styles.heroValue}>{passportSummary.avgScore !== null ? `${passportSummary.avgScore}%` : "-"}</span>
            <span className={styles.heroSub}>{t("ผลทดสอบหลังอบรม", "Post-test average")}</span>
          </div>
        </div>

        <div className={styles.heroStatCard}>
          <div
            className={styles.heroIconBadge}
            style={{
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.3))",
              color: "#f59e0b",
            }}
          >
            ⏳
          </div>
          <div className={styles.heroMeta}>
            <span className={styles.heroLabel}>{t("รออนุมัติ / รออบรม", "Pending Approvals")}</span>
            <span className={styles.heroValue}>{passportSummary.pendingCount} {t("รายการ", "items")}</span>
            <span className={styles.heroSub}>{t("สถานะการลงทะเบียน", "Registration pipeline")}</span>
          </div>
        </div>
      </section>

      {/* 2. Navigation Tabs Bar */}
      <div className={styles.tabBar} role="tablist" aria-label="Training Record Workspace Tabs">
        <button
          className={`${styles.tabBtn} ${activeTab === "pending" ? styles.activeTab : ""}`}
          type="button"
          role="tab"
          aria-selected={activeTab === "pending"}
          onClick={() => setActiveTab("pending")}
        >
          ⏳ {t("สถานะลงทะเบียน & รออนุมัติ", "Registration Status & Approvals")}
          <span className={styles.tabBadge}>{pendingEnrollments.length}</span>
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === "completed" ? styles.activeTab : ""}`}
          type="button"
          role="tab"
          aria-selected={activeTab === "completed"}
          onClick={() => setActiveTab("completed")}
        >
          📜 {t("ประวัติการอบรมที่สำเร็จแล้ว", "Completed Passport")}
          <span className={styles.tabBadge}>{records.length}</span>
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === "download" ? styles.activeTab : ""}`}
          type="button"
          role="tab"
          aria-selected={activeTab === "download"}
          onClick={() => setActiveTab("download")}
        >
          📥 {t("ดาวน์โหลดประวัติ & เอกสาร", "Download Official Record")}
        </button>
      </div>

      {/* TAB 1: Pending & Registration Status (Image 2 Card Layout) */}
      {activeTab === "pending" ? (
        <section className={styles.cardSection} aria-label="Pending approval registrations">
          <div className={styles.cardSectionHeader}>
            <h3 className={styles.cardSectionTitle}>
              ⏳ {t("หลักสูตรที่ลงทะเบียน / รอการพิจารณาอนุมัติ", "Registered Courses / Awaiting Approval")}
            </h3>
            <span className={styles.cardCountBadge}>
              {pendingEnrollments.length} {t("รายการ", "items")}
            </span>
          </div>

          <div className={styles.cardList}>
            {pendingEnrollments.map((enrollment) => {
              const isCenterOwner = enrollment.plan.owner === "CENTER";
              const isPending = enrollment.status === "Pending Approval";
              const isApproved = enrollment.status === "Center Approved" || enrollment.status === "Factory Approved";
              const isRejected = enrollment.status === "Rejected";

              const statusBadgeText = isPending
                ? isCenterOwner
                  ? t("รอ HRD Center พิจารณาอนุมัติ", "Awaiting HRD Center Approval")
                  : t("รอ Factory HRD พิจารณาอนุมัติ", "Awaiting Factory HRD Approval")
                : isApproved
                  ? t("อนุมัติการลงทะเบียนแล้ว (รอเข้าอบรม)", "Approved - Ready for Training")
                  : isRejected
                    ? t("ถูกปฏิเสธการลงทะเบียน", "Registration Rejected")
                    : enrollment.status;

              return (
                <div className={styles.recordCard} key={enrollment.id}>
                  {/* Top row matching Image 2 */}
                  <div className={styles.cardHeaderRow}>
                    <span
                      className={`${styles.statusPill} ${
                        isPending ? styles.statusPending : isApproved ? styles.statusApproved : styles.statusRejected
                      }`}
                    >
                      <span className={styles.statusDot} />
                      {statusBadgeText}
                    </span>

                    <div className={styles.cardRightHeaderGroup}>
                      <span className={styles.providerTag}>
                        {isCenterOwner ? "🏛️ HRD Center" : "🏭 Factory HRD"}
                      </span>

                      <button
                        className={styles.viewDetailBtn}
                        type="button"
                        onClick={() => setDetailModalEnrollment(enrollment)}
                      >
                        🔍 {t("แสดงรายละเอียด", "View Details")}
                      </button>
                    </div>
                  </div>

                  {/* Course Title matching Image 2 */}
                  <h4 className={styles.courseTitleText}>
                    {enrollment.plan.courseName} ({enrollment.plan.courseCode})
                  </h4>

                  {/* Horizontal Info Bar matching Image 2 */}
                  <div className={styles.infoBarGrid}>
                    <div className={styles.infoBarItem}>
                      <span className={styles.infoBarLabel}>{t("วันที่อบรม", "Training Date")}</span>
                      <span className={styles.infoBarValue}>📅 {enrollment.plan.startAt.slice(0, 10)}</span>
                    </div>
                    <div className={styles.infoBarItem}>
                      <span className={styles.infoBarLabel}>{t("สถานที่", "Venue")}</span>
                      <span className={styles.infoBarValue}>📍 {enrollment.plan.venue || "-"}</span>
                    </div>
                    <div className={styles.infoBarItem}>
                      <span className={styles.infoBarLabel}>{t("วิทยากร", "Instructor")}</span>
                      <span className={styles.infoBarValue}>👨‍🏫 {enrollment.plan.instructor || "-"}</span>
                    </div>
                    <div className={styles.infoBarItem}>
                      <span className={styles.infoBarLabel}>{t("ระยะเวลา", "Duration")}</span>
                      <span className={styles.infoBarValue}>⏱️ {enrollment.plan.hours} {t("ชม.", "hrs")}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {pendingEnrollments.length === 0 ? (
              <div className={styles.emptyStateBox} style={{ padding: "20px" }}>
                {t("ยังไม่มีรายการลงทะเบียนที่อยู่ระหว่างรออนุมัติ", "No pending registrations currently.")}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* TAB 2: Completed Passport (Image 2 Card Layout for Completed Records) */}
      {activeTab === "completed" ? (
        <section className={styles.cardSection} aria-label="Completed training section">
          <div className={styles.cardSectionHeader}>
            <h3 className={styles.cardSectionTitle}>
              📜 {t("ประวัติการอบรมที่สำเร็จแล้ว (Completed Training History)", "Completed Training History")}
            </h3>
            <span className={styles.cardCountBadge}>{filteredRecords.length} {t("รายการ", "records")}</span>
          </div>

          {/* Integrated Single-Row Filter Toolbar */}
          <div className={styles.toolbar} aria-label="Training record filters">
            <select
              className={styles.selectFilter}
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as (typeof providers)[number])}
            >
              {providers.map((provider) => (
                <option key={provider} value={provider}>
                  {provider === "all" ? `-- ${t("ผู้จัดทั้งหมด", "All Providers")} --` : provider}
                </option>
              ))}
            </select>

            <div className={styles.searchInputBox}>
              <span className={styles.searchIcon} aria-hidden="true">🔍</span>
              <input
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("ค้นหาชื่อหลักสูตร, รหัส, วิทยากร, สถานที่...", "Search course name, code, instructor...")}
              />
            </div>
          </div>

          {loadError ? (
            <div className={styles.emptyStateBox} role="alert">
              {t("โหลดประวัติการอบรมไม่สำเร็จ", "Could not load training record")}: {loadError}
            </div>
          ) : null}

          {/* Cards List matching Image 2 Design */}
          <div className={styles.cardList}>
            {filteredRecords.map((record) => (
              <div className={styles.recordCard} key={record.id}>
                {/* Top Row matching Image 2 with Completed status dot */}
                <div className={styles.cardHeaderRow}>
                  <span className={`${styles.statusPill} ${styles.statusCompleted}`}>
                    <span className={styles.statusDot} />
                    {t("ผ่านการอบรมเสร็จสมบูรณ์", "Completed")}
                  </span>

                  <div className={styles.cardRightHeaderGroup}>
                    <span className={styles.providerTag}>
                      {record.provider === "HRD Center" ? "🏛️ HRD Center" : "🏭 Factory HRD"}
                    </span>

                    <button
                      className={styles.viewDetailBtn}
                      type="button"
                      onClick={() => setDetailModalRecord(record)}
                    >
                      🔍 {t("แสดงรายละเอียด", "View Details")}
                    </button>
                  </div>
                </div>

                {/* Course Title matching Image 2 */}
                <h4 className={styles.courseTitleText}>
                  {record.courseTitle} ({record.courseCode})
                </h4>

                {/* Horizontal Info Bar matching Image 2 */}
                <div className={styles.infoBarGrid}>
                  <div className={styles.infoBarItem}>
                    <span className={styles.infoBarLabel}>{t("วันที่สำเร็จอบรม", "Completed Date")}</span>
                    <span className={styles.infoBarValue}>📅 {formatDate(record.completedDate)}</span>
                  </div>
                  <div className={styles.infoBarItem}>
                    <span className={styles.infoBarLabel}>{t("สถานที่อบรม", "Venue")}</span>
                    <span className={styles.infoBarValue}>📍 {record.location || "-"}</span>
                  </div>
                  <div className={styles.infoBarItem}>
                    <span className={styles.infoBarLabel}>{t("วิทยากรผู้สอน", "Instructor")}</span>
                    <span className={styles.infoBarValue}>👨‍🏫 {record.instructor || "-"}</span>
                  </div>
                  <div className={styles.infoBarItem}>
                    <span className={styles.infoBarLabel}>{t("ระยะเวลาเรียน", "Duration")}</span>
                    <span className={styles.infoBarValue}>⏱️ {record.hours} {t("ชม.", "hrs")}</span>
                  </div>
                </div>
              </div>
            ))}

            {filteredRecords.length === 0 ? (
              <div className={styles.emptyStateBox}>
                {isLoading
                  ? t("กำลังโหลดประวัติ...", "Loading records...")
                  : t("ไม่พบประวัติการอบรมตามเงื่อนไข", "No completed training records found.")}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* TAB 3: Download Official Document Passport Panel (With Completed Courses List Preview!) */}
      {activeTab === "download" ? (
        <section className={styles.exportPanel} aria-label="Download completed training files">
          <div className={styles.exportHeader}>
            <h3>📑 {t("ดาวน์โหลดประวัติและเอกสารการอบรมฉบับเต็ม", "Download Full Official Training Record")}</h3>
            <p>
              {t(
                "ส่งออกไฟล์ประวัติการอบรมฉบับสมบูรณ์ ประกอบด้วยหลักสูตรที่ผ่าน ชั่วโมงเรียน เลขที่ใบรับรอง คะแนนสอบ และผู้จัด สำหรับยื่นเรื่องปรับตำแหน่ง ย้ายแผนก หรือลาออก",
                "Download official training passport containing course history, certificate numbers, learning hours, scores, and document evidence purpose.",
              )}
            </p>
          </div>

          <div className={styles.purposeRadioGroup} aria-label="Document purpose selection">
            {(Object.keys(downloadPurposes) as DownloadPurpose[]).map((purposeKey) => (
              <label className={styles.purposeOption} key={purposeKey}>
                <input
                  checked={downloadPurpose === purposeKey}
                  name="download-purpose"
                  onChange={() => setDownloadPurpose(purposeKey)}
                  type="radio"
                />
                <span className={styles.purposeText}>
                  <strong>{downloadPurposes[purposeKey].label}</strong>
                  <small>{downloadPurposes[purposeKey].description}</small>
                </span>
              </label>
            ))}
          </div>

          {/* TAB 3 Completed Courses List Preview */}
          <div className={styles.exportPreviewBox}>
            <h4>
              📋 {t("รายการหลักสูตรที่เสร็จสมบูรณ์ที่จะจัดส่งออกในเอกสารฉบับนี้", "Completed Courses Included in Document")}{" "}
              ({records.length} {t("รายการ", "records")})
            </h4>
            <div className={styles.exportPreviewList}>
              {records.map((record) => (
                <div className={styles.exportPreviewRow} key={record.id}>
                  <div>
                    <strong style={{ fontSize: "0.9rem", color: "var(--ui-30-ink)" }}>{record.courseTitle}</strong>
                    <div style={{ fontSize: "0.78rem", color: "var(--ui-30-muted)", marginTop: "2px" }}>
                      {record.courseCode} • {record.provider} • 📅 {formatDate(record.completedDate)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ fontSize: "0.84rem", fontWeight: 900, color: "#10b981" }}>
                      ⏱️ {record.hours} {t("ชม.", "hrs")}
                    </span>
                    <div style={{ fontSize: "0.74rem", color: "var(--ui-30-muted)" }}>
                      {t("เลขใบรับรอง", "Cert No")}: {record.certificateNo}
                    </div>
                  </div>
                </div>
              ))}

              {records.length === 0 ? (
                <div className={styles.emptyStateBox} style={{ padding: "18px" }}>
                  {t("ยังไม่มีประวัติการอบรมที่เสร็จสมบูรณ์สำหรับจัดทำเอกสาร", "No completed training records available for export.")}
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.exportFooter}>
            <div className={styles.exportStats}>
              <span className={styles.statBadge}>📚 {records.length} {t("หลักสูตร", "Records")}</span>
              <span className={styles.statBadge}>⏱️ {records.reduce((t, r) => t + r.hours, 0)} {t("ชั่วโมง", "Hours")}</span>
            </div>

            <button className={styles.exportBtn} type="button" onClick={handleExportAll}>
              📥 {t("ดาวน์โหลดเอกสาร (Download HTML)", "Download Passport Document")}
            </button>
          </div>
        </section>
      ) : null}

      {/* Detailed Modal Overlay when clicking "View Details" on Completed Record */}
      {detailModalRecord ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailModalRecord(null)}
        >
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.inspectorProvider}>
                  {detailModalRecord.provider === "HRD Center" ? "🏛️ HRD Center" : "🏭 Factory HRD"}
                </span>
                <h3 className={styles.inspectorTitle} style={{ margin: "4px 0" }}>
                  {detailModalRecord.courseTitle}
                </h3>
                <span className={styles.inspectorSub}>
                  {detailModalRecord.courseCode} • {formatDate(detailModalRecord.completedDate)}
                </span>
              </div>

              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => setDetailModalRecord(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* 4-Column Metric Box */}
            <div className={styles.modalMetricBox}>
              <div className={styles.metricCol}>
                <span className={styles.metricLabel}>{t("ระยะเวลา", "Duration")}</span>
                <strong className={styles.metricValue}>{detailModalRecord.hours} {t("ชม.", "hrs")}</strong>
              </div>
              <div className={styles.metricCol}>
                <span className={styles.metricLabel}>{t("คะแนนสอบ", "Score")}</span>
                <strong className={styles.metricValue}>{detailModalRecord.score ? `${detailModalRecord.score}%` : "-"}</strong>
              </div>
              <div className={styles.metricCol}>
                <span className={styles.metricLabel}>{t("รุ่น / รอบ", "Batch / Round")}</span>
                <strong className={styles.metricValue}>{detailModalRecord.note}</strong>
              </div>
              <div className={styles.metricCol}>
                <span className={styles.metricLabel}>{t("ผลการอบรม", "Result")}</span>
                <strong className={styles.metricValue}>{t("เสร็จสิ้น", "Completed")}</strong>
              </div>
            </div>

            {/* 2x2 Metadata Grid */}
            <div className={styles.modalMetaGrid}>
              <div className={styles.metaBox}>
                <span className={styles.metaBoxLabel}>{t("เลขที่ใบรับรอง", "Certificate No.")}</span>
                <strong className={styles.metaBoxValue}>{detailModalRecord.certificateNo}</strong>
              </div>
              <div className={styles.metaBox}>
                <span className={styles.metaBoxLabel}>{t("วิทยากรผู้สอน", "Instructor")}</span>
                <strong className={styles.metaBoxValue}>{detailModalRecord.instructor}</strong>
              </div>
              <div className={styles.metaBox}>
                <span className={styles.metaBoxLabel}>{t("สถานที่อบรม", "Location")}</span>
                <strong className={styles.metaBoxValue}>{detailModalRecord.location}</strong>
              </div>
              <div className={styles.metaBox}>
                <span className={styles.metaBoxLabel}>{t("หน่วยงานผู้จัด", "Provider")}</span>
                <strong className={styles.metaBoxValue}>{detailModalRecord.provider}</strong>
              </div>
            </div>

            {/* Assessment Flow Links Grid */}
            <section className={styles.assessmentBox} aria-label="Assessment links">
              <h4 className={styles.assessmentTitle}>
                📄 {t("แบบทดสอบ & แบบประเมินผล (ASSESSMENT FLOW)", "ASSESSMENT & EVALUATION FLOW")}
              </h4>

              <div className={styles.assessmentSteps}>
                {(
                  [
                    { key: "pre", title: t("แบบทดสอบก่อนอบรม", "Pre Test"), stage: detailModalRecord.assessment.preTest },
                    { key: "post", title: t("แบบทดสอบหลังอบรม", "Post Test"), stage: detailModalRecord.assessment.postTest },
                    { key: "evaluation", title: t("แบบประเมินผลการอบรม", "Evaluation"), stage: detailModalRecord.assessment.evaluation },
                    {
                      key: "evaluation30",
                      title: t("แบบประเมินผลหลัง 30 วัน", "30-Day Evaluation"),
                      stage: detailModalRecord.assessment.evaluationAfter30Day,
                    },
                  ] as Array<{ key: string; title: string; stage: AssessmentStageInfo }>
                )
                  .filter((step) => step.stage.mode !== "NONE")
                  .map((step) => (
                    <div className={styles.stepRow} key={step.key}>
                      <div className={styles.stepText}>
                        <span>{step.title}</span>
                        <small>
                          {step.stage.mode === "LINK"
                            ? t("ทำผ่านลิงก์ภายนอก", "External link")
                            : t("ทำในระบบ", "In-system form")}
                        </small>
                      </div>

                      {step.stage.mode === "LINK" && step.stage.link ? (
                        <a
                          href={step.stage.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.openLinkBtn}
                        >
                          🔗 {t("เปิดทำแบบทดสอบ", "Open Link")}
                        </a>
                      ) : (
                        <button
                          disabled
                          type="button"
                          className={styles.openLinkBtn}
                          style={{ opacity: 0.5, cursor: "not-allowed" }}
                        >
                          {t("ยังไม่เปิดให้ทำ", "Not available")}
                        </button>
                      )}
                    </div>
                  ))}

                {[
                  detailModalRecord.assessment.preTest,
                  detailModalRecord.assessment.postTest,
                  detailModalRecord.assessment.evaluation,
                  detailModalRecord.assessment.evaluationAfter30Day,
                ].every((stage) => stage.mode === "NONE") ? (
                  <div className={styles.emptyStateBox} style={{ padding: "12px", fontSize: "0.78rem" }}>
                    {t("หลักสูตรนี้ไม่มีแบบทดสอบหรือแบบประเมิน", "This course has no test or evaluation form.")}
                  </div>
                ) : null}
              </div>
            </section>

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "10px" }}>
              <button
                className={styles.exportBtn}
                type="button"
                onClick={() => setDetailModalRecord(null)}
              >
                {t("ปิดหน้าต่าง", "Close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Detailed Modal Overlay when clicking "View Details" on Pending Enrollment */}
      {detailModalEnrollment ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailModalEnrollment(null)}
        >
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.providerTag}>
                  {detailModalEnrollment.plan.owner === "CENTER" ? "🏛️ HRD Center" : "🏭 Factory HRD"}
                </span>
                <h3 className={styles.courseTitleText} style={{ margin: "4px 0" }}>
                  {detailModalEnrollment.plan.courseName}
                </h3>
                <span style={{ fontSize: "0.82rem", color: "var(--ui-30-muted)" }}>
                  {detailModalEnrollment.plan.courseCode} • {detailModalEnrollment.plan.batchName || "Batch 1"}
                </span>
              </div>

              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => setDetailModalEnrollment(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className={styles.infoBarGrid}>
              <div className={styles.infoBarItem}>
                <span>{t("วันที่อบรม", "Training Date")}</span>
                <strong>📅 {detailModalEnrollment.plan.startAt.slice(0, 10)}</strong>
              </div>
              <div className={styles.infoBarItem}>
                <span>{t("สถานที่อบรม", "Venue")}</span>
                <strong>📍 {detailModalEnrollment.plan.venue || "-"}</strong>
              </div>
              <div className={styles.infoBarItem}>
                <span>{t("วิทยากรผู้สอน", "Instructor")}</span>
                <strong>👨‍🏫 {detailModalEnrollment.plan.instructor || "-"}</strong>
              </div>
              <div className={styles.infoBarItem}>
                <span>{t("ระยะเวลาเรียน", "Duration")}</span>
                <strong>⏱️ {detailModalEnrollment.plan.hours} {t("ชม.", "hrs")}</strong>
              </div>
            </div>

            <div className={styles.metaBox} style={{ gap: "6px" }}>
              <span className={styles.metaBoxLabel}>{t("สถานะการพิจารณาอนุมัติ", "Approval Status")}</span>
              <strong className={styles.metaBoxValue} style={{ color: "#10b981", fontSize: "0.95rem" }}>
                🟢 {detailModalEnrollment.status}
              </strong>
            </div>

            <div className={styles.metaBox} style={{ gap: "6px" }}>
              <span className={styles.metaBoxLabel}>{t("รายละเอียดการเข้าร่วม", "Training Guidelines")}</span>
              <p style={{ margin: 0, fontSize: "0.83rem", color: "var(--ui-30-text)", lineHeight: 1.4 }}>
                {t(
                  "เมื่อถึงกำหนดวันอบรม ให้พนักงานเข้ารายงานตัว ณ สถานที่อบรมที่ระบุ และทำการลงทะเบียนเช็กชื่อผ่านระบบ จากนั้นจะสามารถทำแบบทดสอบ Pre-test และ Post-test เพื่อรับใบรับรอง",
                  "On the scheduled training date, please check in at the designated venue. Completing attendance will enable pre/post-tests for certificate issuance.",
                )}
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "10px" }}>
              <button
                className={styles.exportBtn}
                type="button"
                onClick={() => setDetailModalEnrollment(null)}
              >
                {t("ปิดหน้าต่าง", "Close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
