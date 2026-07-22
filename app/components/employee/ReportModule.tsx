"use client";

import { useMemo, useState } from "react";
import { recordCourses } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type ReportModuleProps = {
  completedHours: number;
};

type ReportStatus = "Draft" | "Ready" | "Sent";

type EmployeeReport = {
  id: string;
  subject: string;
  reportType: string;
  recipient: string;
  period: string;
  deliveryMethod: string;
  summary: string;
  status: ReportStatus;
  sentAt: string;
};

const reportTypes = [
  "My Training Summary",
  "Training Record Follow Up",
  "Certificate Request",
  "Training Need Follow Up",
] as const;

const recipients = ["HRD Center", "HRD Factory", "Supervisor"] as const;
const deliveryMethods = ["Dashboard Notice", "Email", "Email + Dashboard"] as const;

const initialReports: EmployeeReport[] = [
  {
    id: "employee-report-001",
    subject: "Training record follow up",
    reportType: "Training Record Follow Up",
    recipient: "HRD Factory",
    period: "July 2026",
    deliveryMethod: "Dashboard Notice",
    summary: "Follow up Data Privacy Awareness record status and approval result.",
    status: "Sent",
    sentAt: "18 Jul 2026, 09:40",
  },
  {
    id: "employee-report-002",
    subject: "Certificate request",
    reportType: "Certificate Request",
    recipient: "HRD Center",
    period: "June 2026",
    deliveryMethod: "Email + Dashboard",
    summary: "Request certificate copy for 5S Awareness completed training.",
    status: "Ready",
    sentAt: "-",
  },
];

const createInitialSummary = (completedHours: number) =>
  `Completed ${completedHours} training hours. ${recordCourses.length} records are available in the employee training record.`;

export default function ReportModule({ completedHours }: ReportModuleProps) {
  const [subject, setSubject] = useState("My training summary");
  const [reportType, setReportType] = useState<(typeof reportTypes)[number]>("My Training Summary");
  const [recipient, setRecipient] = useState<(typeof recipients)[number]>("HRD Center");
  const [period, setPeriod] = useState("July 2026");
  const [deliveryMethod, setDeliveryMethod] =
    useState<(typeof deliveryMethods)[number]>("Email + Dashboard");
  const [summary, setSummary] = useState(createInitialSummary(completedHours));
  const [reports, setReports] = useState<EmployeeReport[]>(initialReports);
  const [selectedId, setSelectedId] = useState(initialReports[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const selectedReport = reports.find((report) => report.id === selectedId) ?? reports[0] ?? null;
  const visibleReports = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return reports;
    }

    return reports.filter((report) =>
      [
        report.subject,
        report.reportType,
        report.recipient,
        report.period,
        report.status,
        report.summary,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [reports, search]);

  const sentCount = reports.filter((report) => report.status === "Sent").length;
  const readyCount = reports.filter((report) => report.status === "Ready").length;

  const createReport = (status: ReportStatus) => {
    if (!subject.trim() || !summary.trim()) {
      return;
    }

    const sentAt =
      status === "Sent"
        ? new Date().toLocaleString("en-GB", {
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "-";

    const nextReport: EmployeeReport = {
      id: `employee-report-${Date.now()}`,
      subject: subject.trim(),
      reportType,
      recipient,
      period: period.trim() || "-",
      deliveryMethod,
      summary: summary.trim(),
      status,
      sentAt,
    };

    setReports((current) => [nextReport, ...current]);
    setSelectedId(nextReport.id);
    setMessage(status === "Sent" ? `Sent to ${recipient}.` : `${status} report saved.`);
  };

  const loadSelectedReport = () => {
    if (!selectedReport) {
      return;
    }

    setSubject(selectedReport.subject);
    setReportType(selectedReport.reportType as (typeof reportTypes)[number]);
    setRecipient(selectedReport.recipient as (typeof recipients)[number]);
    setPeriod(selectedReport.period);
    setDeliveryMethod(selectedReport.deliveryMethod as (typeof deliveryMethods)[number]);
    setSummary(selectedReport.summary);
    setMessage("Loaded selected report.");
  };

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Training Report"
        title="Training Report"
        detail="Prepare, preview, and send employee training reports to HRD or supervisor."
      />

      <div className={styles.employeeReportSummary}>
        <article>
          <span>Completed Hours</span>
          <strong>{completedHours}</strong>
        </article>
        <article>
          <span>Training Records</span>
          <strong>{recordCourses.length}</strong>
        </article>
        <article>
          <span>Ready</span>
          <strong>{readyCount}</strong>
        </article>
        <article>
          <span>Sent</span>
          <strong>{sentCount}</strong>
        </article>
      </div>

      <div className={styles.reportWorkspace}>
        <section className={styles.reportControlPanel} aria-label="Compose employee report">
          <div className={styles.panelHeader}>
            <div>
              <p>Compose Report</p>
              <h2>Employee Report</h2>
            </div>
            <span>{reportType}</span>
          </div>

          <form className={styles.recordRequestForm}>
            <label>
              Report Type
              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value as (typeof reportTypes)[number])}
              >
                {reportTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Recipient
              <select
                value={recipient}
                onChange={(event) => setRecipient(event.target.value as (typeof recipients)[number])}
              >
                {recipients.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Period
              <input value={period} onChange={(event) => setPeriod(event.target.value)} />
            </label>
            <label>
              Delivery
              <select
                value={deliveryMethod}
                onChange={(event) =>
                  setDeliveryMethod(event.target.value as (typeof deliveryMethods)[number])
                }
              >
                {deliveryMethods.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Enter report subject"
              />
            </label>
            <label>
              Summary
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Summarize training record, request, or follow-up detail"
              />
            </label>
          </form>

          <div className={styles.employeeReportActions}>
            <button type="button" onClick={() => createReport("Draft")}>Save Draft</button>
            <button type="button" onClick={() => createReport("Ready")}>Prepare</button>
            <button type="button" onClick={() => createReport("Sent")}>Send Report</button>
          </div>
          {message ? <p className={styles.requestSubmitMessage}>{message}</p> : null}
        </section>

        <section className={styles.reportResultPanel} aria-label="Employee report preview">
          <div className={styles.panelHeader}>
            <div>
              <p>Preview</p>
              <h2>{subject || "Report subject"}</h2>
            </div>
            <span>{recipient}</span>
          </div>

          <div className={styles.employeeReportPreview}>
            <article>
              <span>Report Type</span>
              <strong>{reportType}</strong>
            </article>
            <article>
              <span>Period</span>
              <strong>{period || "-"}</strong>
            </article>
            <article>
              <span>Delivery</span>
              <strong>{deliveryMethod}</strong>
            </article>
            <article>
              <span>Training Hours</span>
              <strong>{completedHours}</strong>
            </article>
          </div>
          <div className={styles.employeeReportBody}>
            <span>Summary</span>
            <p>{summary || "Report summary will appear here."}</p>
          </div>
        </section>
      </div>

      <section className={styles.reportResultPanel} aria-label="Employee report history">
        <div className={styles.panelHeader}>
          <div>
            <p>History / Queue</p>
            <h2>Submitted Reports</h2>
          </div>
          <span>{visibleReports.length} reports</span>
        </div>

        <div className={styles.reportSearchBar}>
          <input
            aria-label="Search employee reports"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search report history"
          />
          <button type="button" onClick={loadSelectedReport} disabled={!selectedReport}>
            Load Selected
          </button>
        </div>

        <div className={styles.savedReportList}>
          {visibleReports.map((report) => (
            <button
              className={report.id === selectedId ? styles.activeSavedReport : styles.savedReportButton}
              key={report.id}
              type="button"
              onClick={() => setSelectedId(report.id)}
            >
              <div>
                <strong>{report.subject}</strong>
                <span>{report.reportType} / To: {report.recipient} / {report.period}</span>
                <span>{report.summary}</span>
              </div>
              <b>{report.status}</b>
            </button>
          ))}
          {visibleReports.length === 0 ? (
            <div className={styles.recordEmpty}>No report found.</div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
