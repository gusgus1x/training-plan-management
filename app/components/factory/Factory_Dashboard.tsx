"use client";

import { useState } from "react";
import DashboardLayout from "../DashboardLayout";
import styles from "./Factory_Dashboard.module.css";
import {
  buildProfileItems,
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";


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

const trainingSchedule = [
  {
    date: "2026-07-02",
    course: "Leadership Essentials",
    shortName: "Lead",
    time: "09:00 - 16:00",
    room: "Training Room A",
    status: "Confirmed",
  },
  {
    date: "2026-07-08",
    course: "Safety & Compliance Basics",
    shortName: "Safety",
    time: "10:00 - 12:00",
    room: "Online",
    status: "Mandatory",
  },
  {
    date: "2026-07-15",
    course: "Service Mind for Frontline",
    shortName: "Service",
    time: "13:00 - 16:30",
    room: "Training Room B",
    status: "Planned",
  },
  {
    date: "2026-07-24",
    course: "Data Privacy Awareness",
    shortName: "PDPA",
    time: "09:30 - 11:30",
    room: "Meeting Room 2",
    status: "Open",
  },
  {
    date: "2026-08-21",
    course: "Quality Control Basics",
    shortName: "Quality",
    time: "09:00 - 12:00",
    room: "Training Room A",
    status: "Planned",
  },
  {
    date: "2026-09-08",
    course: "Data Privacy Refresh",
    shortName: "PDPA",
    time: "09:30 - 11:30",
    room: "Online",
    status: "Planned",
  },
  {
    date: "2027-01-14",
    course: "Annual Compliance Refresh",
    shortName: "Annual",
    time: "09:00 - 12:00",
    room: "Online",
    status: "Planned",
  },
] as const;

const employeeTrainingSummary = [
  { label: "อบรมเดือนนี้", value: "4", helper: "หลักสูตร" },
  { label: "ชั่วโมงสะสม", value: "22", helper: "ชั่วโมง" },
  { label: "สถานะ", value: "Active", helper: "พร้อมอบรม" },
] as const;

type DashboardProps = {
  username: string;
  onHome: () => void;
  onLogout: () => void;
  onOpenTrainingPlan: () => void;
  onOpenTrainingRecord: () => void;
  onOpenTrainingCourse: () => void;
  onOpenMasterData: () => void;
  onOpenReport: () => void;
};

export default function Dashboard({
  username,
  onHome,
  onLogout,
  onOpenTrainingPlan,
  onOpenTrainingRecord,
  onOpenTrainingCourse,
  onOpenMasterData,
  onOpenReport,
}: DashboardProps) {
  const authenticatedUser = useAuthenticatedUser();
  const employeeInfo = buildProfileItems(authenticatedUser);
  const [selectedCalendarYear, setSelectedCalendarYear] = useState<(typeof calendarYears)[number]>("2026");
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState<(typeof calendarMonths)[number]["value"]>("07");

  const selectedMonthLabel =
    calendarMonths.find((month) => month.value === selectedCalendarMonth)?.label ?? "July";

  const filteredTrainingSchedule = trainingSchedule.filter((item) => {
    const [year, month] = item.date.split("-");
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
              return { day: null, trainings: [] as typeof trainingSchedule[number][] };
            }

            const day = index - leadingBlankDays + 1;
            const trainings = filteredTrainingSchedule.filter(
              (item) => Number(item.date.slice(8, 10)) === day,
            );

            return { day, trainings };
          });

          return [
            ...baseDays,
            ...Array.from({ length: (7 - (baseDays.length % 7)) % 7 }, () => ({
              day: null,
              trainings: [] as typeof trainingSchedule[number][],
            })),
          ];
        })();

  const menuItems = [
    {
      badge: "แผนอบรม",
      title: "Training Management",
      description: "วางแผนอบรมประจำปี กำหนดหลักสูตร งบประมาณ และผู้รับผิดชอบ",
      onClick: onOpenTrainingPlan,
    },
    {
      badge: "บันทึกประวัติอบรม",
      title: "Training Record Management",
      description: "บันทึกและตรวจสอบประวัติอบรมของพนักงาน พร้อมติดตามผลการเข้าร่วมหลักสูตร",
      onClick: onOpenTrainingRecord,
    },
    {
      badge: "รายงาน",
      title: "Training Report Management",
      description: "ดูรายงานสรุปผล แผนอบรม ปฏิทิน และข้อมูลสำหรับติดตามงาน",
      onClick: onOpenReport,
    },
    {
      badge: "แผน",
      title: "Course Type",
      description: "จัดการประเภทหลักสูตร รุ่นอบรม หัวข้อเรียน และรายละเอียดการฝึกอบรม",
      onClick: onOpenTrainingCourse,
    },
    {
      badge: "ข้อมูลหลัก",
      title: "Master Data",
      description: "ดูแลข้อมูลตั้งต้นของระบบ เช่น หน่วยงาน ตำแหน่ง และข้อมูลอ้างอิง",
      onClick: onOpenMasterData,
    },
  ];

  return (
    <DashboardLayout
      pageClassName={styles.page}
      workspaceClassName={styles.workspace}
      workspaceLabel="HRD Factory dashboard"
      username={username}
      onHome={onHome}
      onLogout={onLogout}
    >
        <div className={styles.topRow}>
          <section className={styles.employeePanel} aria-label="Employee">
            <div className={styles.employeeProfile}>
              <div className={styles.photoBox} aria-hidden="true">HA</div>
              <div className={styles.employeeTitle}>
                <span>Employee Profile</span>
                <strong>{username}</strong>
                <p>{profileValue(authenticatedUser?.positionName)} / {profileValue(authenticatedUser?.functionName)}</p>
              </div>
              <b className={styles.employeeStatus}>Online</b>
            </div>

            <div className={styles.employeeDetails}>
              {employeeInfo.map((item) => (
                <p key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </p>
              ))}
            </div>

            <div className={styles.employeeSummary} aria-label="Employee training summary">
              {employeeTrainingSummary.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.helper}</small>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.calendarPanel} aria-label="Calendar">
            <div className={styles.calendarHeader}>
              <div>
                <span>{selectedMonthLabel} {selectedCalendarYear}</span>
                <strong>Training Calendar</strong>
              </div>
              <p>{filteredTrainingSchedule.length} courses</p>
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
              <div className={styles.calendarGrid} aria-label={`Training schedule in ${selectedMonthLabel} ${selectedCalendarYear}`}>
                {weekDays.map((day, index) => (
                  <b key={`${day}-${index}`}>{day}</b>
                ))}
                {calendarDays.map((item, index) => {
                  const className = [
                    styles.calendarDay,
                    item.trainings.length > 0 ? styles.trainingDay : "",
                    item.day === 9 ? styles.today : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <div
                      className={className}
                      key={`${item.day ?? "empty"}-${index}`}
                      aria-label={
                        item.day
                          ? item.trainings.length > 0
                            ? `${selectedMonthLabel} ${item.day}: ${item.trainings.map((training) => training.course).join(", ")}`
                            : `${selectedMonthLabel} ${item.day}: no training`
                          : "Empty calendar day"
                      }
                    >
                      {item.day ? (
                        <>
                          <span>{item.day}</span>
                          {item.trainings.map((training) => (
                            <small key={training.course}>{training.shortName}</small>
                          ))}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.trainingList} aria-label="Upcoming training courses">
              {filteredTrainingSchedule.map((item) => {
                const date = new Date(`${item.date}T00:00:00`);
                const dateLabel = date.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                });

                return (
                <article className={styles.trainingItem} key={item.course}>
                  <time dateTime={item.date}>
                    {dateLabel}
                  </time>
                  <div>
                    <strong>{item.course}</strong>
                    <span>{item.time} / {item.room}</span>
                  </div>
                  <b>{item.status}</b>
                </article>
                );
              })}
            </div>
          </section>
        </div>

        <section className={styles.menuPanel} aria-label="Main menu">
          <h1>เมนูหลัก</h1>
          <div className={styles.menuRow}>
            {menuItems.map((item) => (
              <button className={styles.menuBox} key={item.title} type="button" onClick={item.onClick}>
                <span>{item.badge}</span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </section>
    </DashboardLayout>
  );
}
