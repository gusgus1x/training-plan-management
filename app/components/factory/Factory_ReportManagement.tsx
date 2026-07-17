"use client";

import { useState } from "react";
import Navbar from "../Navbar";
import styles from "./Factory_ReportManagement.module.css";

const resultReportTitle = "Keep Pre/Post Test and Evaluation";
const internalReportTitle = "Report";

const reportItems = [
  {
    title: "Schedule calendar",
    subtitle: "กำหนดการอบรม",
    description: "เปิดมุมมองกำหนดการอบรมแบบแยกหัวข้อ",
  },
] as const;

const extraReportItems = [
  {
    title: internalReportTitle,
    subtitle: "ส่งข้อมูลภายใน",
    description: "ส่งข้อมูลให้พนักงานหรือ HRD Center โดยระบุบริษัท แผนก และหมายเหตุ พร้อมติดตามข้อมูลตอบกลับ",
  },
] as const;

const factoryReportItems = [...reportItems, ...extraReportItems] as const;

const calendarYears = ["2026", "2027"] as const;

const calendarMonths = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const trainingCalendar = [
  {
    id: "CAL-001",
    date: "2026-07-02",
    title: "Leadership Essentials",
    code: "OAP-TRN-001",
    time: "09:00 - 16:00",
    company: "ATFB / SNF / NIC",
    companyBreakdown: [
      { company: "ATFB", participants: 10, completed: 10, evaluation: 10 },
      { company: "SNF", participants: 8, completed: 7, evaluation: 7 },
      { company: "NIC", participants: 6, completed: 6, evaluation: 6 },
    ],
    status: "Planned",
  },
  {
    id: "CAL-002",
    date: "2026-07-08",
    title: "Safety & Compliance Basics",
    code: "OAP-TRN-022",
    time: "10:00 - 12:00",
    company: "SNF / ATA / TEP",
    companyBreakdown: [
      { company: "SNF", participants: 20, completed: 19, evaluation: 19 },
      { company: "ATA", participants: 12, completed: 12, evaluation: 11 },
      { company: "TEP", participants: 10, completed: 9, evaluation: 9 },
    ],
    status: "Completed",
  },
  {
    id: "CAL-003",
    date: "2026-07-15",
    title: "Service Mind for Frontline",
    code: "OAP-TRN-014",
    time: "13:00 - 16:30",
    company: "SATI / ATFB",
    companyBreakdown: [
      { company: "SATI", participants: 10, completed: 10, evaluation: 10 },
      { company: "ATFB", participants: 8, completed: 8, evaluation: 8 },
    ],
    status: "Planned",
  },
  {
    id: "CAL-004",
    date: "2026-08-21",
    title: "Quality Control Basics",
    code: "OAP-TRN-031",
    time: "09:00 - 12:00",
    company: "NIC",
    status: "Planned",
  },
  {
    id: "CAL-005",
    date: "2026-09-08",
    title: "Data Privacy Awareness",
    code: "OAP-TRN-044",
    time: "09:30 - 11:30",
    company: "TEP",
    status: "Planned",
  },
  {
    id: "CAL-006",
    date: "2027-01-14",
    title: "Annual Compliance Refresh",
    code: "OAP-TRN-101",
    time: "09:00 - 12:00",
    company: "ATFB / SNF / NIC",
    companyBreakdown: [
      { company: "ATFB", participants: 20, completed: 20, evaluation: 0 },
      { company: "SNF", participants: 16, completed: 16, evaluation: 0 },
      { company: "NIC", participants: 12, completed: 12, evaluation: 0 },
    ],
    status: "Planned",
  },
] as const;

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const reportCourses = [
  {
    id: "RPT-001",
    date: "2026-07-02",
    title: "Leadership Essentials",
    code: "OAP-TRN-001",
    company: "ATFB / SNF / NIC",
    companyBreakdown: [
      { company: "ATFB", participants: 10, completed: 10, evaluation: 10 },
      { company: "SNF", participants: 8, completed: 7, evaluation: 7 },
      { company: "NIC", participants: 6, completed: 6, evaluation: 6 },
    ],
    participants: 24,
    completed: 23,
    preTest: "74%",
    postTest: "91%",
    evaluation: 23,
    resultStatus: "Verified",
    instructor: 35000,
    room: 12000,
    material: 4800,
    food: 9600,
    travel: 6500,
  },
  {
    id: "RPT-002",
    date: "2026-07-08",
    title: "Safety & Compliance Basics",
    code: "OAP-TRN-022",
    company: "SNF / ATA / TEP",
    companyBreakdown: [
      { company: "SNF", participants: 20, completed: 19, evaluation: 19 },
      { company: "ATA", participants: 12, completed: 12, evaluation: 11 },
      { company: "TEP", participants: 10, completed: 9, evaluation: 9 },
    ],
    participants: 42,
    completed: 40,
    preTest: "68%",
    postTest: "89%",
    evaluation: 39,
    resultStatus: "Verified",
    instructor: 22000,
    room: 15000,
    material: 6200,
    food: 12600,
    travel: 3500,
  },
  {
    id: "RPT-003",
    date: "2026-09-08",
    title: "Service Mind for Frontline",
    code: "OAP-TRN-014",
    company: "SATI / ATFB",
    companyBreakdown: [
      { company: "SATI", participants: 10, completed: 10, evaluation: 10 },
      { company: "ATFB", participants: 8, completed: 8, evaluation: 8 },
    ],
    participants: 18,
    completed: 18,
    preTest: "71%",
    postTest: "93%",
    evaluation: 18,
    resultStatus: "Checked",
    instructor: 28000,
    room: 9000,
    material: 3600,
    food: 5400,
    travel: 4200,
  },
  {
    id: "RPT-004",
    date: "2027-01-14",
    title: "Annual Compliance Refresh",
    code: "OAP-TRN-101",
    company: "ATFB / SNF / NIC",
    companyBreakdown: [
      { company: "ATFB", participants: 20, completed: 20, evaluation: 0 },
      { company: "SNF", participants: 16, completed: 16, evaluation: 0 },
      { company: "NIC", participants: 12, completed: 12, evaluation: 0 },
    ],
    participants: 48,
    completed: 48,
    preTest: "76%",
    postTest: "94%",
    evaluation: 0,
    resultStatus: "Planned",
    instructor: 18000,
    room: 0,
    material: 4200,
    food: 0,
    travel: 0,
  },
  {
    id: "RPT-005",
    date: "2026-07-24",
    title: "HRD Policy Refresh",
    code: "ATA-TRN-001",
    company: "ATA / SATI",
    companyBreakdown: [
      { company: "ATA", participants: 9, completed: 9, evaluation: 9 },
      { company: "SATI", participants: 7, completed: 7, evaluation: 7 },
    ],
    participants: 16,
    completed: 16,
    preTest: "79%",
    postTest: "95%",
    evaluation: 16,
    resultStatus: "Verified",
    instructor: 12000,
    room: 0,
    material: 2500,
    food: 3200,
    travel: 0,
  },
] as const;

const csvColumns = [
  "course_id",
  "course_code",
  "course_title",
  "company",
  "training_date",
  "participants",
  "completed",
  "pre_test_pass_percent",
  "post_test_pass_percent",
  "evaluation_completed",
  "evaluation_pending",
  "status",
] as const;

const escapeCsvValue = (value: string | number) => {
  const csvValue = String(value);

  if (/[",\n\r]/.test(csvValue)) {
    return `"${csvValue.replaceAll("\"", "\"\"")}"`;
  }

  return csvValue;
};

type ReportCourse = (typeof reportCourses)[number];

type SentFactoryMessage = {
  id: string;
  sender: string;
  recipient: string;
  company: string;
  department: string;
  subject: string;
  message: string;
  sentAt: string;
};

const factoryMessageCompanies = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;
const factoryMessageDepartments = ["HRD", "Production", "Operations", "Quality", "Maintenance", "Safety"] as const;

const buildEvaluationCsv = (
  courses: readonly ReportCourse[],
  companyFilter?: string,
) => {
  const rows = courses.flatMap((course) =>
    course.companyBreakdown
      .filter((companyReport) => !companyFilter || companyReport.company === companyFilter)
      .map((companyReport) => [
        course.id,
        course.code,
        course.title,
        companyReport.company,
        course.date,
        companyReport.participants,
        companyReport.completed,
        course.preTest,
        course.postTest,
        companyReport.evaluation,
        companyReport.participants - companyReport.evaluation,
        course.resultStatus,
      ]),
  );

  return [csvColumns, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");
};

type ReportManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
};

export default function ReportManagement({
  username,
  onBack,
  onHome,
  onLogout,
}: ReportManagementProps) {
  const [selectedReport, setSelectedReport] = useState<{
    readonly title: string;
    readonly subtitle: string;
    readonly description: string;
  } | null>(null);
  const [selectedCalendarYear, setSelectedCalendarYear] = useState<(typeof calendarYears)[number]>("2026");
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState("07");
  const [selectedReportYear, setSelectedReportYear] = useState<(typeof calendarYears)[number]>("2026");
  const [selectedReportMonth, setSelectedReportMonth] = useState("07");
  const [factoryMessageRecipient, setFactoryMessageRecipient] = useState("Employee");
  const [factoryMessageCompany, setFactoryMessageCompany] = useState<(typeof factoryMessageCompanies)[number]>("ATA");
  const [factoryMessageDepartment, setFactoryMessageDepartment] =
    useState<(typeof factoryMessageDepartments)[number]>("HRD");
  const [factoryMessageSubject, setFactoryMessageSubject] = useState("");
  const [factoryMessageBody, setFactoryMessageBody] = useState("");
  const [sentFactoryMessages, setSentFactoryMessages] = useState<SentFactoryMessage[]>([]);
  const shouldShowFactoryCompany = factoryMessageRecipient !== "HRD Center";
  const shouldShowFactoryDepartment = factoryMessageRecipient === "Employee";

  const selectedMonthLabel =
    calendarMonths.find((month) => month.value === selectedCalendarMonth)?.label ?? calendarMonths[0].label;

  const visibleCalendarTrainings = trainingCalendar.filter((training) =>
    training.date.startsWith(`${selectedCalendarYear}-${selectedCalendarMonth}`),
  );
  const visibleReportCourses = reportCourses.filter((course) =>
    course.date.startsWith(`${selectedReportYear}-${selectedReportMonth}`),
  );
  const totalReportExpense = visibleReportCourses.reduce(
    (total, course) => total + course.instructor + course.room + course.material + course.food + course.travel,
    0,
  );

  const firstDayOfMonth = new Date(Number(selectedCalendarYear), Number(selectedCalendarMonth) - 1, 1);
  const daysInMonth = new Date(Number(selectedCalendarYear), Number(selectedCalendarMonth), 0).getDate();
  const leadingBlankDays = (firstDayOfMonth.getDay() + 6) % 7;
  const calendarCells = Array.from({ length: leadingBlankDays + daysInMonth }, (_, index) => {
    if (index < leadingBlankDays) {
      return null;
    }

    return index - leadingBlankDays + 1;
  });
  const paddedCalendarCells = [
    ...calendarCells,
    ...Array.from({ length: (7 - (calendarCells.length % 7)) % 7 }, () => null),
  ];

  const handleBack = () => {
    if (selectedReport) {
      setSelectedReport(null);
      return;
    }

    onBack();
  };

  const downloadEvaluationFile = (
    courses: readonly ReportCourse[],
    fileScope: string,
    companyFilter?: string,
  ) => {
    const csv = buildEvaluationCsv(courses, companyFilter);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `hrd-factory-evaluation-${fileScope}-${selectedReportYear}-${selectedReportMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendFactoryMessage = () => {
    if (!factoryMessageSubject.trim() || !factoryMessageBody.trim()) {
      return;
    }

    const sentAt = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    setSentFactoryMessages((current) => [
      {
        id: `MSG-${Date.now()}`,
        sender: "HRD Factory",
        recipient: factoryMessageRecipient,
        company: shouldShowFactoryCompany ? factoryMessageCompany : "",
        department: shouldShowFactoryDepartment ? factoryMessageDepartment : "",
        subject: factoryMessageSubject,
        message: factoryMessageBody,
        sentAt,
      },
      ...current,
    ]);
    setFactoryMessageSubject("");
    setFactoryMessageBody("");
  };

  return (
    <main className={styles.page}>
      <Navbar username={username} onHome={onHome} onLogout={onLogout} />

      <section className={styles.header}>
        <button className={styles.backButton} type="button" onClick={handleBack}>
          Back
        </button>
        <p className={styles.kicker}>Report Management</p>
        <h1>{selectedReport ? selectedReport.title : "Report Management"}</h1>
      </section>

      {selectedReport?.title === "Schedule calendar" ? (
        <section className={styles.calendarPanel} aria-label="Training schedule calendar">
          <div className={styles.calendarHeader}>
            <div>
              <p className={styles.panelKicker}>Training Calendar</p>
              <h2>{selectedMonthLabel} {selectedCalendarYear}</h2>
            </div>

            <div className={styles.calendarFilters}>
              <label>
                <span>Year</span>
                <select
                  value={selectedCalendarYear}
                  onChange={(event) =>
                    setSelectedCalendarYear(event.target.value as (typeof calendarYears)[number])
                  }
                >
                  {calendarYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Month</span>
                <select
                  value={selectedCalendarMonth}
                  onChange={(event) => setSelectedCalendarMonth(event.target.value)}
                >
                  {calendarMonths.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className={styles.calendarGrid} aria-label={`Training schedule in ${selectedMonthLabel} ${selectedCalendarYear}`}>
            {weekDays.map((day) => (
              <div className={styles.weekDay} key={day}>{day}</div>
            ))}

            {paddedCalendarCells.map((day, index) => {
              const dayTrainings = day
                ? visibleCalendarTrainings.filter((training) => Number(training.date.slice(8, 10)) === day)
                : [];

              return (
                <div
                  className={`${styles.dayCell} ${day ? "" : styles.mutedDay}`}
                  key={`${selectedCalendarYear}-${selectedCalendarMonth}-${index}`}
                >
                  <span>{day ?? ""}</span>
                  {dayTrainings.map((training) => (
                    <article className={styles.calendarTraining} key={training.id}>
                      <strong>{training.title}</strong>
                      <small>{training.time} / {training.company}</small>
                    </article>
                  ))}
                </div>
              );
            })}
          </div>

          <section className={styles.calendarSummary} aria-label="Training courses in selected month">
            <div className={styles.summaryHeader}>
              <p className={styles.panelKicker}>Course list</p>
              <span className={styles.summaryCount}>{visibleCalendarTrainings.length} courses</span>
            </div>

            <div className={styles.summaryList}>
              {visibleCalendarTrainings.length > 0 ? (
                visibleCalendarTrainings.map((training) => (
                  <article className={styles.summaryRow} key={training.id}>
                    <time dateTime={training.date}>{training.date.slice(8, 10)} {selectedMonthLabel}</time>
                    <div>
                      <strong>{training.title}</strong>
                      <span>{training.code} / {training.time} / {training.company}</span>
                    </div>
                    <b>{training.status}</b>
                  </article>
                ))
              ) : (
                <div className={styles.emptyMonth}>No training scheduled for this month</div>
              )}
            </div>
          </section>
        </section>
      ) : selectedReport?.title === resultReportTitle ? (
        <section className={styles.reportWorkspace} aria-label="Training result report">
          <section className={styles.reportToolbar}>
            <div>
              <p className={styles.panelKicker}>Keep result</p>
              <h2>{resultReportTitle}</h2>
            </div>
            <div className={styles.toolbarActions}>
              <div className={styles.calendarFilters}>
                <label>
                  <span>Year</span>
                  <select
                    value={selectedReportYear}
                    onChange={(event) =>
                      setSelectedReportYear(event.target.value as (typeof calendarYears)[number])
                    }
                  >
                    {calendarYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Month</span>
                  <select
                    value={selectedReportMonth}
                    onChange={(event) => setSelectedReportMonth(event.target.value)}
                  >
                    {calendarMonths.map((month) => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className={styles.exportButton}
                type="button"
                onClick={() => downloadEvaluationFile(visibleReportCourses, "all-company")}
                disabled={visibleReportCourses.length === 0}
              >
                Download Evaluation File
              </button>
            </div>
          </section>

          <div className={styles.reportTable}>
            {visibleReportCourses.map((course) => (
              <article className={styles.reportResultRow} key={course.id}>
                <div>
                  <strong>{course.title}</strong>
                  <span>{course.code} / {course.date} / {course.company}</span>
                  <button
                    className={styles.inlineExportButton}
                    type="button"
                    onClick={() => downloadEvaluationFile([course], course.code.toLowerCase())}
                  >
                    Download Course Evaluation
                  </button>
                </div>
                <p>
                  <span>Pre-test</span>
                  <b>{course.preTest}</b>
                </p>
                <p>
                  <span>Post-test</span>
                  <b>{course.postTest}</b>
                </p>
                <p>
                  <span>Evaluation</span>
                  <b>{course.evaluation}/{course.participants} คน</b>
                </p>
                <em>{course.resultStatus}</em>
              </article>
            ))}
            {visibleReportCourses.length === 0 ? (
              <div className={styles.emptyMonth}>No report data for this month</div>
            ) : null}
          </div>
        </section>
      ) : selectedReport?.title === "Training Expense" ? (
        <section className={styles.reportWorkspace} aria-label="Training expense report">
          <section className={styles.reportToolbar}>
            <div>
              <p className={styles.panelKicker}>Actual expense</p>
              <h2>รายงานค่าใช้จ่ายจริง</h2>
              <span className={styles.reportTotal}>THB {totalReportExpense.toLocaleString("en-US")}</span>
            </div>
            <div className={styles.calendarFilters}>
              <label>
                <span>Year</span>
                <select
                  value={selectedReportYear}
                  onChange={(event) =>
                    setSelectedReportYear(event.target.value as (typeof calendarYears)[number])
                  }
                >
                  {calendarYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Month</span>
                <select
                  value={selectedReportMonth}
                  onChange={(event) => setSelectedReportMonth(event.target.value)}
                >
                  {calendarMonths.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <div className={styles.expenseList}>
            {visibleReportCourses.map((course) => {
              const totalCourseExpense = course.instructor + course.room + course.material + course.food + course.travel;

              return (
                <article className={styles.expenseCard} key={course.id}>
                  <div className={styles.expenseTitle}>
                    <div>
                      <strong>{course.title}</strong>
                      <span>{course.code} / {course.company} / {course.date}</span>
                    </div>
                    <b>THB {totalCourseExpense.toLocaleString("en-US")}</b>
                  </div>
                  <div className={styles.expenseBreakdown}>
                    <span>Instructor {course.instructor.toLocaleString("en-US")}</span>
                    <span>Room {course.room.toLocaleString("en-US")}</span>
                    <span>Material {course.material.toLocaleString("en-US")}</span>
                    <span>Food {course.food.toLocaleString("en-US")}</span>
                    <span>Travel {course.travel.toLocaleString("en-US")}</span>
                  </div>
                </article>
              );
            })}
            {visibleReportCourses.length === 0 ? (
              <div className={styles.emptyMonth}>No expense data for this month</div>
            ) : null}
          </div>
        </section>
      ) : selectedReport?.title === internalReportTitle ? (
        <section className={styles.reportWorkspace} aria-label="HRD Factory export">
          <section className={styles.reportToolbar}>
            <div>
              <p className={styles.panelKicker}>HRD Factory</p>
              <h2>ระบบส่งข้อความ</h2>
              <span>{sentFactoryMessages.length} messages</span>
            </div>
          </section>

          <section className={styles.factoryPanel}>
            <section className={styles.factoryFormPanel} aria-label="Send internal report message">
              <div className={styles.factoryPanelHeader}>
                <div>
                <p className={styles.panelKicker}>Compose</p>
                <h3>ส่งข้อความ</h3>
                </div>
              </div>

              <form className={styles.messageFormGrid}>
                <label>
                  <span>ส่งให้ใคร</span>
                  <select
                    value={factoryMessageRecipient}
                    onChange={(event) => setFactoryMessageRecipient(event.target.value)}
                  >
                    <option value="Employee">Employee</option>
                    <option value="HRD Factory">HRD Factory</option>
                    <option value="HRD Center">HRD Center</option>
                  </select>
                </label>

                {shouldShowFactoryCompany ? (
                  <label>
                    <span>เธเธฃเธดเธฉเธฑเธ—</span>
                    <select
                      value={factoryMessageCompany}
                      onChange={(event) =>
                        setFactoryMessageCompany(event.target.value as (typeof factoryMessageCompanies)[number])
                      }
                    >
                      {factoryMessageCompanies.map((company) => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {shouldShowFactoryDepartment ? (
                  <label>
                    <span>เนเธเธเธ</span>
                    <select
                      value={factoryMessageDepartment}
                      onChange={(event) =>
                        setFactoryMessageDepartment(event.target.value as (typeof factoryMessageDepartments)[number])
                      }
                    >
                      {factoryMessageDepartments.map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label>
                  <span>หัวข้อเรื่อง</span>
                  <input
                    type="text"
                    value={factoryMessageSubject}
                    onChange={(event) => setFactoryMessageSubject(event.target.value)}
                    placeholder="ระบุหัวข้อเรื่อง"
                  />
                </label>
              <label>
                <span>ข้อความ</span>
                <textarea
                  value={factoryMessageBody}
                  onChange={(event) => setFactoryMessageBody(event.target.value)}
                  placeholder="พิมพ์ข้อความที่ต้องการส่ง"
                />
              </label>

              
                <button
                  className={styles.sendButton}
                  type="button"
                  disabled={!factoryMessageSubject.trim() || !factoryMessageBody.trim()}
                  onClick={handleSendFactoryMessage}
                >
                  ส่งข้อความ
                </button>
              </form>
            </section>

            <section className={styles.factoryReplyPanel} aria-label="Sent report replies">
              <div className={styles.factoryPanelHeader}>
                <div>
                <p className={styles.panelKicker}>Inbox</p>
                <h3>ข้อมูลที่ส่งมา</h3>
                </div>
                <span>{sentFactoryMessages.length} messages</span>
              </div>

              <div className={styles.factoryReplyList}>
                {sentFactoryMessages.length > 0 ? (
                  sentFactoryMessages.map((message) => (
                    <article className={styles.factoryReplyItem} key={message.id}>
                      <div>
                        <strong>{message.subject}</strong>
                        <span className={styles.replyMeta}>
                          From: {message.sender} / To: {message.recipient}
                          {message.company ? ` / Company: ${message.company}` : ""}
                          {message.department ? ` / Department: ${message.department}` : ""}
                        </span>
                        <p>{message.message}</p>
                      </div>
                      <time>{message.sentAt}</time>
                    </article>
                  ))
                ) : (
                  <div className={styles.emptyMonth}>ยังไม่มีข้อความ</div>
                )}
              </div>
            </section>
          </section>
        </section>
      ) : (
        <section className={styles.reportGrid} aria-label="Report management menu">
          {factoryReportItems.map((item) => (
            <button
              key={item.title}
              className={`${styles.reportCard} ${styles.clickableCard}`}
              type="button"
              onClick={() => setSelectedReport(item)}
            >
              <span className={styles.badge}>{item.subtitle}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
