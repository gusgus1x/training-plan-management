"use client";

import { useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../AuthenticatedUserContext";
import { recordCourses } from "./data";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type ReportModuleProps = {
  completedHours: number;
};

type ReportStatus = "Draft" | "Ready" | "Sent";
type RecipientType = "Person" | "Company";

type AttachmentRecord = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type EmployeeReport = {
  id: string;
  senderEmail: string;
  subject: string;
  recipientType: RecipientType;
  recipientTarget: string;
  sendDate: string;
  message: string;
  attachments: AttachmentRecord[];
  status: ReportStatus;
  sentAt: string;
};

const companyRecipients = ["All Companies", "ATA", "TEP", "ATFB", "NIC", "SATI", "SNF"] as const;

const initialReports: EmployeeReport[] = [
  {
    id: "employee-report-001",
    senderEmail: "employee.test@attg.local",
    subject: "Training record follow up",
    recipientType: "Person",
    recipientTarget: "factory.hr@attg.local",
    sendDate: "2026-07-24",
    message: "Please review my training record status and approval result.",
    attachments: [],
    status: "Sent",
    sentAt: "18 Jul 2026, 09:40",
  },
  {
    id: "employee-report-002",
    senderEmail: "employee.test@attg.local",
    subject: "Certificate request",
    recipientType: "Person",
    recipientTarget: "hrd.center@attg.local",
    sendDate: "2026-07-24",
    message: "Please support a certificate copy for my completed 5S Awareness training.",
    attachments: [],
    status: "Ready",
    sentAt: "-",
  },
];

const createInitialMessage = (completedHours: number) =>
  `Please review my training records. I have completed ${completedHours} training hours and ${recordCourses.length} records are available.`;

const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

export default function ReportModule({ completedHours }: ReportModuleProps) {
  const authenticatedUser = useAuthenticatedUser();
  const senderEmail = profileValue(authenticatedUser?.email);
  const today = new Date().toISOString().slice(0, 10);

  const [subject, setSubject] = useState("My training summary");
  const [recipientType, setRecipientType] = useState<RecipientType>("Person");
  const [recipientTarget, setRecipientTarget] = useState("");
  const [sendDate, setSendDate] = useState(today);
  const [messageBody, setMessageBody] = useState(createInitialMessage(completedHours));
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
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
        report.senderEmail,
        report.recipientType,
        report.recipientTarget,
        report.sendDate,
        report.status,
        report.message,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [reports, search]);

  const sentCount = reports.filter((report) => report.status === "Sent").length;
  const readyCount = reports.filter((report) => report.status === "Ready").length;

  const updateRecipientType = (value: RecipientType) => {
    setRecipientType(value);
    setRecipientTarget(value === "Company" ? companyRecipients[0] : "");
    setMessage("");
  };

  const handleFileChange = (files: FileList | null) => {
    if (!files) {
      return;
    }

    const nextAttachments = Array.from(files).map((file, index) => ({
      id: `employee-attachment-${file.name}-${file.lastModified}-${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      type: file.type || "Unknown file type",
    }));

    setAttachments((current) => [...current, ...nextAttachments]);
    setMessage("");
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
    setMessage("");
  };

  const clearComposer = () => {
    setSubject("");
    setRecipientType("Person");
    setRecipientTarget("");
    setSendDate(today);
    setMessageBody("");
    setAttachments([]);
    setAttachmentInputKey((current) => current + 1);
    setMessage("Composer cleared.");
  };

  const resetComposer = () => {
    setSubject("My training summary");
    setRecipientType("Person");
    setRecipientTarget("");
    setSendDate(today);
    setMessageBody(createInitialMessage(completedHours));
    setAttachments([]);
    setAttachmentInputKey((current) => current + 1);
    setMessage("");
  };

  const createReport = (status: ReportStatus) => {
    if (!subject.trim() || !recipientTarget.trim() || !messageBody.trim()) {
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
      senderEmail,
      subject: subject.trim(),
      recipientType,
      recipientTarget: recipientTarget.trim(),
      sendDate,
      message: messageBody.trim(),
      attachments,
      status,
      sentAt,
    };

    setReports((current) => [nextReport, ...current]);
    setSelectedId(nextReport.id);
    setMessage(
      status === "Sent"
        ? `Sent from ${senderEmail} to ${recipientTarget}.`
        : `${status} report saved with ${attachments.length} attachments.`,
    );
  };

  const loadSelectedReport = () => {
    if (!selectedReport) {
      return;
    }

    setSubject(selectedReport.subject);
    setRecipientType(selectedReport.recipientType);
    setRecipientTarget(selectedReport.recipientTarget);
    setSendDate(selectedReport.sendDate);
    setMessageBody(selectedReport.message);
    setAttachments(selectedReport.attachments);
    setAttachmentInputKey((current) => current + 1);
    setMessage("Loaded selected report.");
  };

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="Training Report"
        title="Training Report"
        detail="Prepare and send employee training reports by email."
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
              <p>Compose</p>
              <h2>Email Setup</h2>
            </div>
            <span>{senderEmail}</span>
          </div>

          <form className={styles.recordRequestForm}>
            <label className={styles.employeeReportFullWidth}>
              Subject
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Enter email subject"
              />
            </label>
            <label>
              Send To
              <select
                value={recipientType}
                onChange={(event) => updateRecipientType(event.target.value as RecipientType)}
              >
                <option>Person</option>
                <option>Company</option>
              </select>
            </label>
            <label>
              {recipientType === "Company" ? "Company" : "Person Email"}
              {recipientType === "Company" ? (
                <select
                  value={recipientTarget}
                  onChange={(event) => setRecipientTarget(event.target.value)}
                >
                  {companyRecipients.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="email"
                  value={recipientTarget}
                  onChange={(event) => setRecipientTarget(event.target.value)}
                  placeholder="name@company.com"
                />
              )}
            </label>
            <label>
              Send Date
              <input type="date" value={sendDate} onChange={(event) => setSendDate(event.target.value)} />
            </label>
            <label className={styles.employeeReportFullWidth}>
              Message
              <textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="Write message"
              />
            </label>
            <label className={styles.employeeReportFullWidth}>
              Attach Files
              <input
                key={attachmentInputKey}
                type="file"
                multiple
                onChange={(event) => handleFileChange(event.target.files)}
              />
            </label>
          </form>

          <div className={styles.employeeReportAttachmentPanel}>
            <div>
              <span>Attachments</span>
              <strong>{attachments.length} files</strong>
            </div>
            {attachments.length > 0 ? (
              <ul>
                {attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <div>
                      <strong>{attachment.name}</strong>
                      <span>{formatFileSize(attachment.size)} / {attachment.type}</span>
                    </div>
                    <button type="button" onClick={() => removeAttachment(attachment.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No files attached.</p>
            )}
          </div>

          <div className={styles.employeeReportActions}>
            <button type="button" onClick={clearComposer}>Clear Data</button>
            <button type="button" onClick={resetComposer}>Reset</button>
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
              <h2>{subject || "Email subject"}</h2>
            </div>
            <span>{recipientTarget || "No recipient"}</span>
          </div>

          <div className={styles.employeeReportPreview}>
            <article>
              <span>From</span>
              <strong>{senderEmail}</strong>
            </article>
            <article>
              <span>To</span>
              <strong>{recipientTarget || "-"}</strong>
            </article>
            <article>
              <span>Send Date</span>
              <strong>{sendDate || "-"}</strong>
            </article>
            <article>
              <span>Files</span>
              <strong>{attachments.length}</strong>
            </article>
          </div>
          <div className={styles.employeeReportBody}>
            <span>Message</span>
            <p>{messageBody || "Message will appear here."}</p>
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

        <div className={styles.employeeReportHistoryGrid}>
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
                  <span>{report.recipientType} / {report.recipientTarget} / {report.sendDate}</span>
                  <span>{report.senderEmail}</span>
                </div>
                <b>{report.status}</b>
              </button>
            ))}
            {visibleReports.length === 0 ? (
              <div className={styles.recordEmpty}>No report found.</div>
            ) : null}
          </div>

          <aside className={styles.employeeReportDetailPanel}>
            {selectedReport ? (
              <>
                <div className={styles.employeeReportDetailHeader}>
                  <b>{selectedReport.status}</b>
                  <h3>{selectedReport.subject}</h3>
                  <span>{selectedReport.sentAt === "-" ? "Not sent yet" : `Sent at ${selectedReport.sentAt}`}</span>
                </div>
                <dl className={styles.employeeReportDetailList}>
                  <div>
                    <dt>From</dt>
                    <dd>{selectedReport.senderEmail}</dd>
                  </div>
                  <div>
                    <dt>To</dt>
                    <dd>{selectedReport.recipientTarget}</dd>
                  </div>
                  <div>
                    <dt>Send To</dt>
                    <dd>{selectedReport.recipientType}</dd>
                  </div>
                  <div>
                    <dt>Send Date</dt>
                    <dd>{selectedReport.sendDate}</dd>
                  </div>
                </dl>
                <div className={styles.employeeReportBody}>
                  <span>Message</span>
                  <p>{selectedReport.message || "No message provided."}</p>
                </div>
                <div className={styles.employeeReportAttachmentPanel}>
                  <div>
                    <span>Files</span>
                    <strong>{selectedReport.attachments.length} files</strong>
                  </div>
                  {selectedReport.attachments.length > 0 ? (
                    <ul>
                      {selectedReport.attachments.map((attachment) => (
                        <li key={attachment.id}>
                          <div>
                            <strong>{attachment.name}</strong>
                            <span>{formatFileSize(attachment.size)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No files attached.</p>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.recordEmpty}>Select a report to view details.</div>
            )}
          </aside>
        </div>
      </section>
    </section>
  );
}
