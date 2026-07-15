"use client";

import { useMemo, useState } from "react";
import DashboardLayout from "../DashboardLayout";
import {
  availableCourses,
  employeeCalendarTrainings,
  employeeProfile,
  history,
  moduleCards,
  type UserModule,
} from "./data";
import RecordModule from "./RecordModule";
import RegisterTrainingModule from "./RegisterTrainingModule";
import ReportModule from "./ReportModule";
import RequestTrainingModule from "./RequestTrainingModule";
import RoadmapModule from "./RoadmapModule";
import styles from "./UserDashboard.module.css";

type UserDashboardProps = {
  username: string;
  onHome: () => void;
  onLogout: () => void;
};

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const calendarYears = ["2026", "2027"] as const;

const calendarMonths = [
  { value: "all", label: "ทั้งปี" },
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

export default function UserDashboard({ username, onHome, onLogout }: UserDashboardProps) {
  const [activeModule, setActiveModule] = useState<UserModule | null>(null);
  const [trainingNeed, setTrainingNeed] = useState("Advanced Quality Control");
  const [reason, setReason] = useState("ต้องการเพิ่มทักษะสำหรับงานตรวจสอบคุณภาพในไลน์ผลิต");
  const [selectedCalendarYear, setSelectedCalendarYear] = useState<(typeof calendarYears)[number]>("2026");
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState<(typeof calendarMonths)[number]["value"]>("07");

  const completedHours = useMemo(
    () => history.reduce((total, item) => total + Number(item.hours), 0),
    [],
  );

  const selectedMonthLabel =
    calendarMonths.find((month) => month.value === selectedCalendarMonth)?.label ?? "July";

  const filteredCalendarTrainings = employeeCalendarTrainings.filter((training) => {
    const [year, month] = training.date.split("-");
    return year === selectedCalendarYear && (selectedCalendarMonth === "all" || month === selectedCalendarMonth);
  });

  const calendarDays =
    selectedCalendarMonth === "all"
      ? []
      : (() => {
          const year = Number(selectedCalendarYear);
          const month = Number(selectedCalendarMonth);
          const firstDay = new Date(year, month - 1, 1);
          const daysInMonth = new Date(year, month, 0).getDate();
          const leadingBlankDays = (firstDay.getDay() + 6) % 7;
          const baseDays = Array.from({ length: leadingBlankDays + daysInMonth }, (_, index) => {
            if (index < leadingBlankDays) {
              return { day: null, trainings: [] as typeof employeeCalendarTrainings[number][] };
            }

            const day = index - leadingBlankDays + 1;
            const trainings = filteredCalendarTrainings.filter(
              (training) => Number(training.date.slice(8, 10)) === day,
            );

            return { day, trainings };
          });

          return [
            ...baseDays,
            ...Array.from({ length: (7 - (baseDays.length % 7)) % 7 }, () => ({
              day: null,
              trainings: [] as typeof employeeCalendarTrainings[number][],
            })),
          ];
        })();

  const handleHome = () => {
    if (activeModule) {
      setActiveModule(null);
      return;
    }

    onHome();
  };

  return (
    <DashboardLayout
      pageClassName={styles.page}
      workspaceClassName={styles.workspace}
      workspaceLabel="User dashboard"
      username={username}
      userLevel="User"
      onHome={handleHome}
      onLogout={onLogout}
    >
        {activeModule ? (
          <>
            {activeModule === "register" ? (
              <RegisterTrainingModule onBack={() => setActiveModule(null)} />
            ) : null}
            {activeModule === "roadmap" ? (
              <RoadmapModule onBack={() => setActiveModule(null)} />
            ) : null}
            {activeModule === "request" ? (
              <RequestTrainingModule
                onBack={() => setActiveModule(null)}
                reason={reason}
                setReason={setReason}
                setTrainingNeed={setTrainingNeed}
                trainingNeed={trainingNeed}
              />
            ) : null}
            {activeModule === "record" ? (
              <RecordModule completedHours={completedHours} onBack={() => setActiveModule(null)} />
            ) : null}
            {activeModule === "report" ? (
              <ReportModule completedHours={completedHours} onBack={() => setActiveModule(null)} />
            ) : null}
          </>
        ) : (
          <>
            <div className={styles.topRow}>
              <section className={styles.employeePanel} aria-label="My employee information">
                <div className={styles.employeeProfile}>
                  <div className={styles.avatar} aria-hidden="true">
                    EU
                  </div>
                  <div className={styles.profileCopy}>
                    <span>Employee Profile</span>
                    <h1>{username}</h1>
                    <p>Production Staff / Production</p>
                  </div>
                  <b className={styles.employeeStatus}>Online</b>
                </div>

                <div className={styles.employeeProfileGrid}>
                  {employeeProfile.map((item) => (
                    <article key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </article>
                  ))}
                </div>

                <div className={styles.profileStats}>
                  <article>
                    <span>หลักสูตรที่ลงทะเบียน</span>
                    <strong>{availableCourses.length}</strong>
                  </article>
                  <article>
                    <span>ชั่วโมงอบรมสะสม</span>
                    <strong>{completedHours}</strong>
                  </article>
                  <article>
                    <span>คำขอรออนุมัติ</span>
                    <strong>2</strong>
                  </article>
                </div>
              </section>

              <section className={styles.calendarPanel} aria-label="Employee training calendar">
                <div className={styles.panelHeader}>
                  <div>
                    <h2>ปฏิทินอบรมประจำเดือน</h2>
                    <p>{selectedMonthLabel} {selectedCalendarYear} / {filteredCalendarTrainings.length} courses</p>
                  </div>
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
                      onChange={(event) =>
                        setSelectedCalendarMonth(event.target.value as (typeof calendarMonths)[number]["value"])
                      }
                    >
                      {calendarMonths.map((month) => (
                        <option key={month.value} value={month.value}>{month.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {selectedCalendarMonth === "all" ? null : (
                  <div className={styles.calendarGrid} aria-label={`Training calendar in ${selectedMonthLabel} ${selectedCalendarYear}`}>
                    {weekDays.map((day) => (
                      <b key={day}>{day}</b>
                    ))}
                    {calendarDays.map((item, index) => (
                      <div
                        className={`${styles.calendarDay} ${item.trainings.length > 0 ? styles.trainingDay : ""}`}
                        key={`${item.day ?? "empty"}-${index}`}
                        aria-label={
                          item.day
                            ? item.trainings.length > 0
                              ? `${selectedMonthLabel} ${item.day}: ${item.trainings.map((training) => training.title).join(", ")}`
                              : `${selectedMonthLabel} ${item.day}: no training`
                            : "Empty calendar day"
                        }
                      >
                        {item.day ? (
                          <>
                            <span>{item.day}</span>
                            {item.trainings.map((training) => (
                              <small key={training.title}>{training.shortName}</small>
                            ))}
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.calendarTrainingList}>
                  {filteredCalendarTrainings.map((training) => {
                    const date = new Date(`${training.date}T00:00:00`);
                    const dateLabel = date.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    });

                    return (
                    <article key={training.title}>
                      <time dateTime={training.date}>
                        {dateLabel}
                      </time>
                      <div>
                        <strong>{training.title}</strong>
                        <span>
                          {training.time} / {training.place}
                        </span>
                      </div>
                      <b>{training.status}</b>
                    </article>
                    );
                  })}
                </div>
              </section>
            </div>

            <section className={styles.modulePanel} aria-label="User modules">
              <div className={styles.panelHeader}>
                <div>
                  <h2>เมนูที่ใช้งานได้</h2>
                </div>
              </div>

              <div className={styles.moduleGrid}>
                {moduleCards.map((module) => (
                  <button
                    className={styles.moduleCard}
                    key={module.key}
                    type="button"
                    onClick={() => setActiveModule(module.key)}
                  >
                    <small>{module.eyebrow}</small>
                    <strong>{module.title}</strong>
                    <span>{module.detail}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
    </DashboardLayout>
  );
}
