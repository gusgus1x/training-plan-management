"use client";

import { useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../AuthenticatedUserContext";
import { useNotice } from "../NoticeDialog";
import { useToast } from "../ToastHost";
import { useUiLanguage } from "../ThaiUiLocalization";
import ModuleHeader from "./ModuleHeader";
import shell from "../shared/ModuleShell.module.css";
import styles from "./UserDashboard.module.css";

type ReportModuleProps = {
  completedHours: number;
  completedCount: number;
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

const createInitialMessage = (completedHours: number, completedCount: number) =>
  `Please review my training records. I have completed ${completedHours} training hours and ${completedCount} records are available.`;

const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

export default function ReportModule({ completedHours, completedCount }: ReportModuleProps) {
  const authenticatedUser = useAuthenticatedUser();
  const senderEmail = profileValue(authenticatedUser?.email);
  const today = new Date().toISOString().slice(0, 10);

  const [subject, setSubject] = useState("My training summary");
  const [recipientType, setRecipientType] = useState<RecipientType>("Person");
  const [recipientTarget, setRecipientTarget] = useState("");
  const [sendDate, setSendDate] = useState(today);
  const [messageBody, setMessageBody] = useState(createInitialMessage(completedHours, completedCount));
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const notice = useNotice();
  const toast = useToast();
  const { language } = useUiLanguage();
  // One language at a time - a "ไทย / English" label shows both to a reader who asked for one.
  const t = (th: string, en: string) => (language === "th" ? th : en);

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
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };

  const clearComposer = () => {
    setSubject("");
    setRecipientType("Person");
    setRecipientTarget("");
    setSendDate(today);
    setMessageBody("");
    setAttachments([]);
    setAttachmentInputKey((current) => current + 1);
    toast.info(t("ล้างแบบฟอร์มแล้ว", "Composer cleared"));
  };

  const resetComposer = () => {
    setSubject("My training summary");
    setRecipientType("Person");
    setRecipientTarget("");
    setSendDate(today);
    setMessageBody(createInitialMessage(completedHours, completedCount));
    setAttachments([]);
    setAttachmentInputKey((current) => current + 1);
  };

  const createReport = async (status: ReportStatus) => {
    const missingFields: string[] = [];
    if (!subject.trim()) missingFields.push("หัวข้อรายงาน (Subject)");
    if (!recipientTarget.trim()) missingFields.push("ผู้รับรายงาน (Recipient)");
    if (!messageBody.trim()) missingFields.push("เนื้อหารายงาน (Message)");
    if (missingFields.length > 0) {
      await notice({ missingFields });
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
    toast.success(
      status === "Sent"
        ? t(`ส่งรายงานถึง ${recipientTarget} แล้ว`, `Sent to ${recipientTarget}`)
        : t(
            `บันทึกรายงานสถานะ ${status} พร้อมไฟล์แนบ ${attachments.length} ไฟล์`,
            `${status} report saved with ${attachments.length} attachment(s)`,
          ),
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
    toast.info(t("โหลดรายงานที่เลือกแล้ว", "Loaded selected report"));
  };

  return (
    <section className={shell.moduleWorkspace}>
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
          <strong>{completedCount}</strong>
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

      <div className={shell.contentGrid}>
        <section
          className={`${shell.panel} ${styles.reportControlPanel}`}
          aria-label="Compose employee report"
        >
          <div className={shell.panelHeader}>
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
            <button type="button" onClick={() => void createReport("Draft")}>Save Draft</button>
            <button type="button" onClick={() => void createReport("Ready")}>Prepare</button>
            <button type="button" onClick={() => void createReport("Sent")}>Send Report</button>
          </div>
        </section>

        <section className={shell.panel} aria-label="Employee report preview">
          <div className={shell.panelHeader}>
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

      <section className={shell.panel} aria-label="Employee report history">
        <div className={shell.panelHeader}>
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
          <button
            type="button"
            onClick={loadSelectedReport}
            disabled={!selectedReport}
            title={!selectedReport ? "เลือกรายงานจากรายการก่อน (Select a report from the list first)" : undefined}
          >
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
              <div className={shell.emptyState}>No report found.</div>
            ) : null}
          </div>

          <aside className={shell.detailPanel}>
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
              <div className={shell.emptyState}>Select a report to view details.</div>
            )}
          </aside>
        </div>
      </section>
    </section>
  );
}
