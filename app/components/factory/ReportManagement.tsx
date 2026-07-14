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

const extraReportItems = [
  {
    title: "HRD Factory Export",
    subtitle: "รายงานรวมให้ HRD Factory",
    description: "เลือกส่งข้อมูลรายงานรวมแยกบริษัทให้ HRD Factory จัดเก็บลงฐานข้อมูล",
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

const reportCourses = [
  {
    id: "RPT-001",
    date: "2026-07-02",
    title: "Leadership Essentials",
    code: "OAP-TRN-001",
    company: "ATFB",
    participants: 24,
    completed: 23,
    preTest: "74%",
    postTest: "91%",
    evaluation: "4.7/5",
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
    company: "SNF",
    participants: 42,
    completed: 40,
    preTest: "68%",
    postTest: "89%",
    evaluation: "4.5/5",
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
    company: "SATI",
    participants: 18,
    completed: 18,
    preTest: "71%",
    postTest: "93%",
    evaluation: "4.8/5",
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
    company: "ATFB",
    participants: 48,
    completed: 48,
    preTest: "76%",
    postTest: "94%",
    evaluation: "4.6/5",
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
    company: "ATA",
    participants: 16,
    completed: 16,
    preTest: "79%",
    postTest: "95%",
    evaluation: "4.9/5",
    resultStatus: "Verified",
    instructor: 12000,
    room: 0,
    material: 2500,
    food: 3200,
    travel: 0,
  },
] as const;

const factoryCompanies = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

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
  const [selectedReport, setSelectedReport] = useState<(typeof factoryReportItems)[number] | null>(null);
  const [selectedCalendarYear, setSelectedCalendarYear] = useState<(typeof calendarYears)[number]>("2026");
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState("07");
  const [selectedReportYear, setSelectedReportYear] = useState<(typeof calendarYears)[number]>("2026");
  const [selectedReportMonth, setSelectedReportMonth] = useState("07");
  const [selectedFactoryCompany, setSelectedFactoryCompany] =
    useState<(typeof factoryCompanies)[number]>("ATA");

  const selectedMonthLabel =
    calendarMonths.find((month) => month.value === selectedCalendarMonth)?.label ?? calendarMonths[0].label;

  const visibleCalendarTrainings = trainingCalendar.filter((training) =>
    training.date.startsWith(`${selectedCalendarYear}-${selectedCalendarMonth}`),
  );
  const visibleReportCourses = reportCourses.filter((course) =>
    course.date.startsWith(`${selectedReportYear}-${selectedReportMonth}`),
  );
  const visibleFactoryCourses = visibleReportCourses.filter(
    (course) => course.company === selectedFactoryCompany,
  );
  const totalReportExpense = visibleReportCourses.reduce(
    (total, course) => total + course.instructor + course.room + course.material + course.food + course.travel,
    0,
  );
  const totalFactoryRecords = visibleFactoryCourses.length;

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
      ) : selectedReport?.title === "Monthly score" ? (
        <section className={styles.reportWorkspace} aria-label="Training result report">
          <section className={styles.reportToolbar}>
            <div>
              <p className={styles.panelKicker}>Training result</p>
              <h2>รายงานผลอบรม ผลสอบ และผลประเมิน</h2>
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

          <div className={styles.reportTable}>
            {visibleReportCourses.map((course) => (
              <article className={styles.reportResultRow} key={course.id}>
                <div>
                  <strong>{course.title}</strong>
                  <span>{course.code} / {course.date} / {course.company}</span>
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
                  <b>{course.evaluation}</b>
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
      ) : selectedReport?.title === "HRD Factory Export" ? (
        <section className={styles.reportWorkspace} aria-label="HRD Factory export">
          <section className={styles.reportToolbar}>
            <div>
              <p className={styles.panelKicker}>HRD Factory</p>
              <h2>ระบบส่งรายงานรวมแต่ละบริษัท</h2>
              <span>{visibleFactoryCourses.length} records ready</span>
            </div>
            <div className={styles.calendarFilters}>
              <label>
                <span>Company</span>
                <select
                  value={selectedFactoryCompany}
                  onChange={(event) =>
                    setSelectedFactoryCompany(event.target.value as (typeof factoryCompanies)[number])
                  }
                >
                  {factoryCompanies.map((company) => (
                    <option key={company} value={company}>{company}</option>
                  ))}
                </select>
              </label>
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

          <section className={styles.factoryPanel}>
            <div className={styles.factorySteps}>
              <article>
                <span>1</span>
                <strong>เลือกส่งข้อมูลให้ HRD Factory</strong>
              </article>
              <article>
                <span>2</span>
                <strong>กรอกแบบรายงาน</strong>
              </article>
              <article>
                <span>3</span>
                <strong>ส่งข้อมูล</strong>
              </article>
              <article>
                <span>4</span>
                <strong>จัดเก็บลงฐานข้อมูล</strong>
              </article>
            </div>
            <div className={styles.factoryPayload}>
              {visibleFactoryCourses.map((course) => (
                <article key={course.id}>
                  <strong>{course.title}</strong>
                  <span>{course.code} / {course.date} / {course.resultStatus}</span>
                </article>
              ))}
              {visibleFactoryCourses.length === 0 ? (
                <div className={styles.emptyMonth}>No factory export records for this filter</div>
              ) : null}
            </div>
            <button className={styles.sendButton} type="button">
              ส่งข้อมูล {totalFactoryRecords} records
            </button>
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
