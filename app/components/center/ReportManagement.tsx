"use client";

import { useState } from "react";
import Navbar from "../Navbar";
import styles from "./ReportManagement.module.css";

const reportItems = [
  {
    title: "Schedule calendar",
    subtitle: "กำหนดการอบรม",
    description: "เปิดมุมมองกำหนดการอบรมแบบแยกหัวข้อ",
  },
  {
    title: "Monthly score",
    subtitle: "คะแนนรายเดือน",
    description: "เปิดมุมมองสรุปคะแนนรายเดือน",
  },
  {
    title: "Training Expense",
    subtitle: "ค่าใช้จ่ายฝึกอบรม",
    description: "เปิดมุมมองค่าใช้จ่ายสำหรับการฝึกอบรม",
  },
] as const;

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
    company: "ATFB",
    status: "Planned",
  },
  {
    id: "CAL-002",
    date: "2026-07-08",
    title: "Safety & Compliance Basics",
    code: "OAP-TRN-022",
    time: "10:00 - 12:00",
    company: "SNF",
    status: "Completed",
  },
  {
    id: "CAL-003",
    date: "2026-07-15",
    title: "Service Mind for Frontline",
    code: "OAP-TRN-014",
    time: "13:00 - 16:30",
    company: "SATI",
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
    company: "ATFB",
    status: "Planned",
  },
] as const;

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

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
  const [selectedReport, setSelectedReport] = useState<(typeof reportItems)[number] | null>(null);
  const [selectedCalendarYear, setSelectedCalendarYear] = useState<(typeof calendarYears)[number]>("2026");
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState("07");

  const selectedMonthLabel =
    calendarMonths.find((month) => month.value === selectedCalendarMonth)?.label ?? calendarMonths[0].label;

  const visibleCalendarTrainings = trainingCalendar.filter((training) =>
    training.date.startsWith(`${selectedCalendarYear}-${selectedCalendarMonth}`),
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
      ) : selectedReport ? (
        <section className={styles.blankWorkspace} aria-label={`${selectedReport.title} page`}>
          <div className={styles.blankCanvas} />
        </section>
      ) : (
        <section className={styles.reportGrid} aria-label="Report management menu">
          {reportItems.map((item) => (
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
