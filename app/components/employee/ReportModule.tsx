"use client";

import { useState } from "react";
import ModuleHeader from "./ModuleHeader";
import styles from "./UserDashboard.module.css";

type ReportModuleProps = {
  completedHours: number;
};

type SentReportMessage = {
  id: string;
  sender: string;
  recipient: string;
  company: string;
  department: string;
  subject: string;
  message: string;
  sentAt: string;
};

const reportMessageCompanies = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;
const reportMessageDepartments = ["HRD", "Production", "Operations", "Quality", "Maintenance", "Safety"] as const;

export default function ReportModule({ completedHours }: ReportModuleProps) {
  const [reportRecipient, setReportRecipient] = useState("Employee");
  const [reportCompany, setReportCompany] = useState<(typeof reportMessageCompanies)[number]>("ATA");
  const [reportDepartment, setReportDepartment] =
    useState<(typeof reportMessageDepartments)[number]>("HRD");
  const [reportSubject, setReportSubject] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [sentReportMessages, setSentReportMessages] = useState<SentReportMessage[]>([]);
  const shouldShowCompany = reportRecipient !== "HRD Center";
  const shouldShowDepartment = reportRecipient === "Employee";

  const handleSendReportMessage = () => {
    if (!reportSubject.trim() || !reportMessage.trim()) {
      return;
    }

    const sentAt = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    setSentReportMessages((current) => [
      {
        id: `USER-REPORT-${Date.now()}`,
        sender: "Employee",
        recipient: reportRecipient,
        company: shouldShowCompany ? reportCompany : "",
        department: shouldShowDepartment ? reportDepartment : "",
        subject: reportSubject,
        message: reportMessage,
        sentAt,
      },
      ...current,
    ]);
    setReportSubject("");
    setReportMessage("");
  };

  return (
    <section className={styles.modulePage}>
      <ModuleHeader
        eyebrow="User Report"
        title="Training Report"
        detail="Send training report messages and review the submitted report history."
      />

      <div className={styles.reportWorkspace}>
        <section className={styles.reportControlPanel} aria-label="Send report data">
          <div className={styles.panelHeader}>
            <div>
              <p>Compose</p>
              <h2>Send Report Message</h2>
            </div>
            <span>{completedHours} hours</span>
          </div>

          <form className={styles.recordRequestForm}>
            <label>
              Recipient
              <select value={reportRecipient} onChange={(event) => setReportRecipient(event.target.value)}>
                <option value="Employee">Employee</option>
                <option value="HRD Factory">HRD Factory</option>
                <option value="HRD Center">HRD Center</option>
              </select>
            </label>

            {shouldShowCompany ? (
              <label>
                Company
                <select
                  value={reportCompany}
                  onChange={(event) =>
                    setReportCompany(event.target.value as (typeof reportMessageCompanies)[number])
                  }
                >
                  {reportMessageCompanies.map((company) => (
                    <option key={company} value={company}>{company}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {shouldShowDepartment ? (
              <label>
                Department
                <select
                  value={reportDepartment}
                  onChange={(event) =>
                    setReportDepartment(event.target.value as (typeof reportMessageDepartments)[number])
                  }
                >
                  {reportMessageDepartments.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              Subject
              <input
                type="text"
                value={reportSubject}
                onChange={(event) => setReportSubject(event.target.value)}
                placeholder="Enter report subject"
              />
            </label>

            <label>
              Message
              <textarea
                value={reportMessage}
                onChange={(event) => setReportMessage(event.target.value)}
                placeholder="Type the report message"
              />
            </label>

            <button
              type="button"
              disabled={!reportSubject.trim() || !reportMessage.trim()}
              onClick={handleSendReportMessage}
            >
              Send Message
            </button>
          </form>
        </section>

        <section className={styles.reportResultPanel} aria-label="Receive report data">
          <div className={styles.panelHeader}>
            <div>
              <p>Inbox</p>
              <h2>Submitted Reports</h2>
            </div>
            <span>{sentReportMessages.length} messages</span>
          </div>

          <div className={styles.savedReportList}>
            {sentReportMessages.length > 0 ? (
              sentReportMessages.map((message) => (
                <article key={message.id}>
                  <div>
                    <strong>{message.subject}</strong>
                    <span>
                      From: {message.sender} / To: {message.recipient}
                      {message.company ? ` / Company: ${message.company}` : ""}
                      {message.department ? ` / Department: ${message.department}` : ""}
                    </span>
                    <span>{message.message}</span>
                  </div>
                  <b>{message.sentAt}</b>
                </article>
              ))
            ) : (
              <div className={styles.recordEmpty}>No report message has been sent yet.</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
