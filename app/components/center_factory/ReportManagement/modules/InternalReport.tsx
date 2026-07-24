"use client";

import { useMemo, useState } from "react";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import styles from "./InternalReport.module.css";

type ReportStatus = "Draft" | "Ready" | "Sent";

type AttachmentRecord = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type ReportRecord = {
  id: string;
  senderEmail: string;
  subject: string;
  reportType: string;
  recipientType: string;
  recipientTarget: string;
  recipientGroup: string;
  companyScope: string;
  period: string;
  dueDate: string;
  summary: string;
  attachments?: AttachmentRecord[];
  status: ReportStatus;
  sentAt: string;
};

type ComposeForm = Omit<ReportRecord, "id" | "senderEmail" | "status" | "sentAt">;

export type InternalReportDraft = Partial<ComposeForm>;

export const internalReportModule = {
  title: "Internal Report",
  subtitle: "Internal communication",
  description:
    "Prepare, preview, and send internal training reports to HRD Center, factory HR, management, and related departments.",
} as const;

export const internalReportTitle = internalReportModule.title;

const recipientTypes = ["Person", "Company"] as const;
const companyRecipients = ["All Companies", "ATA", "TEP", "ATFB", "NIC", "SATI", "SNF"] as const;

const createInitialForm = (): ComposeForm => ({
  subject: "Monthly training summary",
  reportType: "Monthly Training Summary",
  recipientType: "Person",
  recipientTarget: "factory.hr@attg.local",
  recipientGroup: "factory.hr@attg.local",
  companyScope: "All Companies",
  period: "2026-07-24",
  dueDate: "2026-07-31",
  summary: "Please review the attached training report and confirm any required follow-up actions.",
});

const initialReports: ReportRecord[] = [
  {
    id: "report-001",
    senderEmail: "center.hrd@attg.local",
    subject: "Monthly training summary",
    reportType: "Monthly Training Summary",
    recipientType: "Company",
    recipientTarget: "All Companies",
    recipientGroup: "Factory HR",
    companyScope: "All Companies",
    period: "2026-07-01",
    dueDate: "2026-06-30",
    summary: "Monthly training status, participant completion, and expense overview.",
    status: "Sent",
    sentAt: "2026-07-01 09:30",
  },
  {
    id: "report-002",
    senderEmail: "factory.hr@attg.local",
    subject: "Evaluation follow up",
    reportType: "Evaluation Follow Up",
    recipientType: "Person",
    recipientTarget: "department.owner@attg.local",
    recipientGroup: "department.owner@attg.local",
    companyScope: "SNF",
    period: "2026-07-24",
    dueDate: "2026-07-25",
    summary: "Pending 30-day evaluations by department owner.",
    status: "Ready",
    sentAt: "-",
  },
  {
    id: "report-003",
    senderEmail: "finance.coordinator@attg.local",
    subject: "Budget clarification",
    reportType: "Training Expense Summary",
    recipientType: "Person",
    recipientTarget: "finance@attg.local",
    recipientGroup: "finance@attg.local",
    companyScope: "All Companies",
    period: "2026-07-15",
    dueDate: "2026-07-15",
    summary: "Training expense detail for finance review.",
    status: "Draft",
    sentAt: "-",
  },
];

const statusClass: Record<ReportStatus, string> = {
  Draft: "statusDraft",
  Ready: "statusReady",
  Sent: "statusSent",
};

type InternalReportProps = {
  preparedDraft?: InternalReportDraft | null;
};

export default function InternalReport({ preparedDraft }: InternalReportProps = {}) {
  const authenticatedUser = useAuthenticatedUser();
  const senderEmail = profileValue(authenticatedUser?.email);
  const [form, setForm] = useState<ComposeForm>(() => ({
    ...createInitialForm(),
    ...(preparedDraft ?? {}),
  }));
  const [reports, setReports] = useState<ReportRecord[]>(initialReports);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialReports[0]?.id ?? "");
  const [sendMessage, setSendMessage] = useState("");
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const attachments = form.attachments ?? [];

  const selectedReport = reports.find((report) => report.id === selectedId) ?? null;
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
        report.recipientGroup,
        report.period,
        report.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [reports, search]);

  const readyCount = reports.filter((report) => report.status === "Ready").length;
  const sentCount = reports.filter((report) => report.status === "Sent").length;

  const updateForm = (field: keyof ComposeForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSendMessage("");
  };

  const updateRecipientType = (value: string) => {
    const nextTarget = value === "Company" ? companyRecipients[0] : "";

    setForm((current) => ({
      ...current,
      recipientType: value,
      recipientTarget: nextTarget,
      recipientGroup: nextTarget,
      companyScope: value === "Company" ? nextTarget : current.companyScope,
    }));
    setSendMessage("");
  };

  const updateRecipientTarget = (value: string) => {
    setForm((current) => ({
      ...current,
      recipientTarget: value,
      recipientGroup: value,
      companyScope: current.recipientType === "Company" ? value : current.companyScope,
    }));
    setSendMessage("");
  };

  const formatFileSize = (size: number) => {
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(size / 1024))} KB`;
  };

  const handleFileChange = (files: FileList | null) => {
    if (!files) {
      return;
    }

    const nextAttachments: AttachmentRecord[] = Array.from(files).map((file, index) => ({
      id: `attachment-${file.name}-${file.lastModified}-${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      type: file.type || "Unknown file type",
    }));

    setForm((current) => ({
      ...current,
      attachments: [...(current.attachments ?? []), ...nextAttachments],
    }));
    setSendMessage("");
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setForm((current) => ({
      ...current,
      attachments: (current.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
    }));
    setSendMessage("");
  };

  const handleReset = () => {
    setForm(createInitialForm());
    setSendMessage("");
    setAttachmentInputKey((current) => current + 1);
  };

  const handleClearData = () => {
    setForm({
      subject: "",
      reportType: "Monthly Training Summary",
      recipientType: "Person",
      recipientTarget: "factory.hr@attg.local",
      recipientGroup: "factory.hr@attg.local",
      companyScope: "All Companies",
      period: "",
      dueDate: "",
      summary: "",
      attachments: [],
    });
    setSendMessage("Composer cleared.");
    setAttachmentInputKey((current) => current + 1);
  };

  const handleSaveDraft = () => {
    const nextReport: ReportRecord = {
      id: `report-${Date.now()}`,
      senderEmail,
      ...form,
      status: "Draft",
      sentAt: "-",
    };

    setReports((current) => [nextReport, ...current]);
    setSelectedId(nextReport.id);
    setSendMessage(`Draft saved with ${attachments.length} attachments.`);
  };

  const handlePrepare = () => {
    const nextReport: ReportRecord = {
      id: `report-${Date.now()}`,
      senderEmail,
      ...form,
      status: "Ready",
      sentAt: "-",
    };

    setReports((current) => [nextReport, ...current]);
    setSelectedId(nextReport.id);
    setSendMessage(`Report prepared with ${attachments.length} attachments.`);
  };

  const handleSend = () => {
    const sentAt = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      year: "numeric",
    });
    const nextReport: ReportRecord = {
      id: `report-${Date.now()}`,
      senderEmail,
      ...form,
      status: "Sent",
      sentAt,
    };

    setReports((current) => [nextReport, ...current]);
    setSelectedId(nextReport.id);
    setSendMessage(`Sent from ${senderEmail} to ${form.recipientTarget} with ${attachments.length} attachments.`);
  };

  const loadSelectedReport = () => {
    if (!selectedReport) {
      return;
    }

    setForm({
      subject: selectedReport.subject,
      reportType: selectedReport.reportType,
      recipientType: selectedReport.recipientType,
      recipientTarget: selectedReport.recipientTarget,
      recipientGroup: selectedReport.recipientGroup,
      companyScope: selectedReport.companyScope,
      period: selectedReport.period,
      dueDate: selectedReport.dueDate,
      summary: selectedReport.summary,
      attachments: selectedReport.attachments ?? [],
    });
    setSendMessage("Loaded selected report into composer.");
    setAttachmentInputKey((current) => current + 1);
  };

  return (
    <section className={styles.page} aria-label="Internal Report module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{internalReportModule.subtitle}</p>
          <h2>{internalReportModule.title}</h2>
          <p>{internalReportModule.description}</p>
        </div>
        <div className={styles.heroStats}>
          <article>
            <strong>{reports.length}</strong>
            <span>Total</span>
          </article>
          <article>
            <strong>{readyCount}</strong>
            <span>Ready</span>
          </article>
          <article>
            <strong>{sentCount}</strong>
            <span>Sent</span>
          </article>
        </div>
      </section>

      <section className={styles.composeGrid}>
        <section className={styles.composePanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Compose</span>
              <h3>Report Setup</h3>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.fullWidth}>
              Subject
              <input
                value={form.subject}
                onChange={(event) => updateForm("subject", event.target.value)}
                placeholder="Report subject"
              />
            </label>
            <label className={styles.recipientTypeField}>
              Send To
              <select
                value={form.recipientType}
                onChange={(event) => updateRecipientType(event.target.value)}
              >
                {recipientTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.recipientTargetField}>
              {form.recipientType === "Company" ? "Company" : "Person Email"}
              {form.recipientType === "Company" ? (
                <select
                  value={form.recipientTarget}
                  onChange={(event) => updateRecipientTarget(event.target.value)}
                >
                  {companyRecipients.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="email"
                  value={form.recipientTarget}
                  onChange={(event) => updateRecipientTarget(event.target.value)}
                  placeholder="name@company.com"
                />
              )}
            </label>
            <label className={styles.sendDateField}>
              Send Date
              <input
                type="date"
                value={form.period}
                onChange={(event) => updateForm("period", event.target.value)}
              />
            </label>
            <label className={styles.messageField}>
              Message
              <textarea
                value={form.summary}
                onChange={(event) => updateForm("summary", event.target.value)}
                placeholder="Write email message"
              />
            </label>
            <label className={`${styles.fullWidth} ${styles.attachmentInput} ${styles.fileField}`}>
              Attach Files
              <input
                key={attachmentInputKey}
                type="file"
                multiple
                onChange={(event) => handleFileChange(event.target.files)}
              />
            </label>
          </div>

          <div className={styles.attachmentPanel}>
            <div className={styles.attachmentHeader}>
              <span>Attachments</span>
              <strong>{attachments.length} files</strong>
            </div>
            {attachments.length > 0 ? (
              <ul className={styles.attachmentList}>
                {attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <div>
                      <strong>{attachment.name}</strong>
                      <span>{formatFileSize(attachment.size)} / {attachment.type}</span>
                    </div>
                    <button type="button" onClick={() => handleRemoveAttachment(attachment.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyAttachments}>No files attached.</p>
            )}
          </div>

          <div className={styles.formActions}>
            <button className={styles.secondaryButton} type="button" onClick={handleClearData}>
              Clear Data
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleReset}>
              Reset
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleSaveDraft}>
              Save Draft
            </button>
            <button className={styles.prepareButton} type="button" onClick={handlePrepare}>
              Prepare
            </button>
            <button className={styles.sendButton} type="button" onClick={handleSend}>
              Send Report
            </button>
          </div>
          {sendMessage ? <p className={styles.sendMessage}>{sendMessage}</p> : null}
        </section>

        <aside className={styles.previewPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Preview</span>
              <h3>{form.subject || "Untitled report"}</h3>
            </div>
          </div>
          <dl className={styles.previewList}>
            <div>
              <dt>From</dt>
              <dd>{senderEmail}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{form.recipientTarget}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{form.recipientType}</dd>
            </div>
            <div>
              <dt>Send Date</dt>
              <dd>{form.period}</dd>
            </div>
            <div>
              <dt>Files</dt>
              <dd>{attachments.length}</dd>
            </div>
          </dl>
          <div className={styles.previewFiles}>
            <span>Attached files</span>
            {attachments.length > 0 ? (
              <ul>
                {attachments.map((attachment) => (
                  <li key={attachment.id}>
                    {attachment.name}
                    <small>{formatFileSize(attachment.size)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No attachment selected.</p>
            )}
          </div>
          <div className={styles.previewMessage}>
            <span>Message</span>
            <p>{form.summary || "No summary provided."}</p>
          </div>
        </aside>
      </section>

      <section className={styles.historyPanel}>
        <div className={styles.panelHeader}>
          <div>
            <span>History</span>
            <h3>Internal Report Queue</h3>
          </div>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={loadSelectedReport}
            disabled={!selectedReport}
          >
            Load Selected
          </button>
        </div>

        <div className={styles.toolbar}>
          <input
            aria-label="Search internal report history"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search report history"
          />
          <button className={styles.secondaryButton} type="button" onClick={() => setSearch("")}>
            Clear
          </button>
        </div>

        <div className={styles.historyGrid}>
          <div className={styles.tableWrap}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Recipient</th>
                  <th>Send Date</th>
                  <th>Files</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleReports.map((report) => (
                  <tr
                    className={report.id === selectedId ? styles.selectedRow : undefined}
                    key={report.id}
                    onClick={() => setSelectedId(report.id)}
                  >
                    <td>
                      <strong>{report.subject}</strong>
                      <span>{report.senderEmail}</span>
                    </td>
                    <td>
                      <strong>{report.recipientTarget}</strong>
                      <span>{report.recipientType}</span>
                    </td>
                    <td>{report.period}</td>
                    <td>{report.attachments?.length ?? 0}</td>
                    <td>
                      <span className={`${styles.statusPill} ${styles[statusClass[report.status]]}`}>
                        {report.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {visibleReports.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No report history found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <aside className={styles.historyDetailPanel} aria-label="Selected report detail">
            {selectedReport ? (
              <>
                <div className={styles.historyDetailHeader}>
                  <span className={`${styles.statusPill} ${styles[statusClass[selectedReport.status]]}`}>
                    {selectedReport.status}
                  </span>
                  <h4>{selectedReport.subject}</h4>
                  <p>{selectedReport.sentAt === "-" ? "Not sent yet" : `Sent at ${selectedReport.sentAt}`}</p>
                </div>
                <dl className={styles.historyDetailList}>
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
                    <dd>{selectedReport.period}</dd>
                  </div>
                </dl>
                <div className={styles.historyMessage}>
                  <span>Message</span>
                  <p>{selectedReport.summary || "No message provided."}</p>
                </div>
                <div className={styles.historyFiles}>
                  <span>Files</span>
                  {(selectedReport.attachments?.length ?? 0) > 0 ? (
                    <ul>
                      {selectedReport.attachments?.map((attachment) => (
                        <li key={attachment.id}>
                          <strong>{attachment.name}</strong>
                          <small>{formatFileSize(attachment.size)}</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No files attached.</p>
                  )}
                </div>
              </>
            ) : (
              <p className={styles.emptyAttachments}>Select a report to view details.</p>
            )}
          </aside>
        </div>
      </section>
    </section>
  );
}
