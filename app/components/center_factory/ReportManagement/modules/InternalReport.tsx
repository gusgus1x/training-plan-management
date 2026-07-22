"use client";

import { useMemo, useState } from "react";
import styles from "./InternalReport.module.css";

type ReportStatus = "Draft" | "Ready" | "Sent";

type ReportRecord = {
  id: string;
  subject: string;
  reportType: string;
  recipientGroup: string;
  companyScope: string;
  period: string;
  dueDate: string;
  deliveryMethod: string;
  summary: string;
  status: ReportStatus;
  sentAt: string;
};

type ComposeForm = Omit<ReportRecord, "id" | "status" | "sentAt">;

export const internalReportModule = {
  title: "Internal Report",
  subtitle: "Internal communication",
  description:
    "Prepare, preview, and send internal training reports to HRD Center, factory HR, management, and related departments.",
} as const;

export const internalReportTitle = internalReportModule.title;

const reportTypes = [
  "Monthly Training Summary",
  "Training Expense Summary",
  "Evaluation Follow Up",
  "Training Plan Progress",
  "Compliance Alert",
] as const;

const recipientGroups = [
  "HRD Center",
  "Factory HR",
  "Management",
  "Finance",
  "Department Owner",
] as const;

const companyScopes = ["All Companies", "ATA", "TEP", "ATFB", "NIC", "SATI", "SNF"] as const;
const deliveryMethods = ["Email", "Dashboard Notice", "Email + Dashboard"] as const;

const createInitialForm = (): ComposeForm => ({
  subject: "Monthly training summary",
  reportType: "Monthly Training Summary",
  recipientGroup: "Factory HR",
  companyScope: "All Companies",
  period: "July 2026",
  dueDate: "2026-07-31",
  deliveryMethod: "Email + Dashboard",
  summary:
    "สรุปภาพรวมการอบรมประจำเดือน จำนวนหลักสูตร สถานะการเข้าร่วม ค่าใช้จ่าย และรายการที่ต้องติดตามต่อ",
});

const initialReports: ReportRecord[] = [
  {
    id: "report-001",
    subject: "Monthly training summary",
    reportType: "Monthly Training Summary",
    recipientGroup: "Factory HR",
    companyScope: "All Companies",
    period: "June 2026",
    dueDate: "2026-06-30",
    deliveryMethod: "Email + Dashboard",
    summary: "Monthly training status, participant completion, and expense overview.",
    status: "Sent",
    sentAt: "2026-07-01 09:30",
  },
  {
    id: "report-002",
    subject: "Evaluation follow up",
    reportType: "Evaluation Follow Up",
    recipientGroup: "Department Owner",
    companyScope: "SNF",
    period: "July 2026",
    dueDate: "2026-07-25",
    deliveryMethod: "Dashboard Notice",
    summary: "Pending 30-day evaluations by department owner.",
    status: "Ready",
    sentAt: "-",
  },
  {
    id: "report-003",
    subject: "Budget clarification",
    reportType: "Training Expense Summary",
    recipientGroup: "Finance",
    companyScope: "All Companies",
    period: "Q2 2026",
    dueDate: "2026-07-15",
    deliveryMethod: "Email",
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

export default function InternalReport() {
  const [form, setForm] = useState<ComposeForm>(createInitialForm);
  const [reports, setReports] = useState<ReportRecord[]>(initialReports);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialReports[0]?.id ?? "");
  const [sendMessage, setSendMessage] = useState("");

  const selectedReport = reports.find((report) => report.id === selectedId) ?? null;
  const visibleReports = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return reports;
    }

    return reports.filter((report) =>
      [
        report.subject,
        report.reportType,
        report.recipientGroup,
        report.companyScope,
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

  const handleReset = () => {
    setForm(createInitialForm());
    setSendMessage("");
  };

  const handleSaveDraft = () => {
    const nextReport: ReportRecord = {
      id: `report-${Date.now()}`,
      ...form,
      status: "Draft",
      sentAt: "-",
    };

    setReports((current) => [nextReport, ...current]);
    setSelectedId(nextReport.id);
    setSendMessage("Draft saved.");
  };

  const handlePrepare = () => {
    const nextReport: ReportRecord = {
      id: `report-${Date.now()}`,
      ...form,
      status: "Ready",
      sentAt: "-",
    };

    setReports((current) => [nextReport, ...current]);
    setSelectedId(nextReport.id);
    setSendMessage("Report prepared and ready to send.");
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
      ...form,
      status: "Sent",
      sentAt,
    };

    setReports((current) => [nextReport, ...current]);
    setSelectedId(nextReport.id);
    setSendMessage(`Sent to ${form.recipientGroup} via ${form.deliveryMethod}.`);
  };

  const loadSelectedReport = () => {
    if (!selectedReport) {
      return;
    }

    setForm({
      subject: selectedReport.subject,
      reportType: selectedReport.reportType,
      recipientGroup: selectedReport.recipientGroup,
      companyScope: selectedReport.companyScope,
      period: selectedReport.period,
      dueDate: selectedReport.dueDate,
      deliveryMethod: selectedReport.deliveryMethod,
      summary: selectedReport.summary,
    });
    setSendMessage("Loaded selected report into composer.");
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
            <label>
              Report Type
              <select
                value={form.reportType}
                onChange={(event) => updateForm("reportType", event.target.value)}
              >
                {reportTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Recipient
              <select
                value={form.recipientGroup}
                onChange={(event) => updateForm("recipientGroup", event.target.value)}
              >
                {recipientGroups.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Company Scope
              <select
                value={form.companyScope}
                onChange={(event) => updateForm("companyScope", event.target.value)}
              >
                {companyScopes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Period
              <input
                value={form.period}
                onChange={(event) => updateForm("period", event.target.value)}
                placeholder="July 2026"
              />
            </label>
            <label>
              Due Date
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => updateForm("dueDate", event.target.value)}
              />
            </label>
            <label>
              Delivery
              <select
                value={form.deliveryMethod}
                onChange={(event) => updateForm("deliveryMethod", event.target.value)}
              >
                {deliveryMethods.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fullWidth}>
              Summary Message
              <textarea
                value={form.summary}
                onChange={(event) => updateForm("summary", event.target.value)}
                placeholder="Write report summary"
              />
            </label>
          </div>

          <div className={styles.formActions}>
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
              <dt>Type</dt>
              <dd>{form.reportType}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{form.recipientGroup}</dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>{form.companyScope}</dd>
            </div>
            <div>
              <dt>Period</dt>
              <dd>{form.period}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{form.deliveryMethod}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{form.dueDate}</dd>
            </div>
          </dl>
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

        <div className={styles.tableWrap}>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Type</th>
                <th>Recipient</th>
                <th>Scope</th>
                <th>Period</th>
                <th>Delivery</th>
                <th>Status</th>
                <th>Sent At</th>
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
                    <span>{report.summary}</span>
                  </td>
                  <td>{report.reportType}</td>
                  <td>{report.recipientGroup}</td>
                  <td>{report.companyScope}</td>
                  <td>{report.period}</td>
                  <td>{report.deliveryMethod}</td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[statusClass[report.status]]}`}>
                      {report.status}
                    </span>
                  </td>
                  <td>{report.sentAt}</td>
                </tr>
              ))}
              {visibleReports.length === 0 ? (
                <tr>
                  <td colSpan={8}>No report history found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
