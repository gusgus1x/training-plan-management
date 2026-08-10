"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  isWorkflowOwner,
  readWorkflowCollection,
} from "../../lib/trainingWorkflow";
import DashboardLayout from "../DashboardLayout";
import {
  buildProfileItems,
  profileValue,
  useAuthenticatedUser,
} from "../AuthenticatedUserContext";
import {
  formatRollingPlanCompanies,
  getRollingPlanCompanies,
  type RollingPlan,
} from "./TrainingPlanManagement/modules/TrainingRolling";
import {
  buildCalendarYearOptions,
  getCurrentCalendarDate,
} from "../../lib/calendarDate";
import { useUiLanguage } from "../ThaiUiLocalization";
import styles from "./CenterFactory_Dashboard.module.css";

const CourseIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="7" y="4" width="18" height="24" rx="3" fill="#3B82F6" />
    <rect x="7" y="24" width="18" height="2" fill="#EC4899" />
    <line x1="12" y1="4" x2="12" y2="26" stroke="#1D4EDB" strokeWidth="1.5" />
  </svg>
);

const PlanIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="6" width="22" height="22" rx="3" fill="#0EA5E9" />
    <path d="M5 12h22" stroke="#ffffff" strokeWidth="2" />
    <circle cx="11" cy="17" r="1.5" fill="#ffffff" />
    <circle cx="16" cy="17" r="1.5" fill="#ffffff" />
    <circle cx="21" cy="17" r="1.5" fill="#ffffff" />
    <circle cx="11" cy="22" r="1.5" fill="#ffffff" />
    <circle cx="16" cy="22" r="1.5" fill="#ffffff" />
    <path d="M10 4v4M22 4v4" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const RecordIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="6" y="6" width="20" height="22" rx="3" fill="#F59E0B" />
    <rect x="11" y="4" width="10" height="4" rx="1.5" fill="#D97706" />
    <path d="M11 15l3 3 7-7" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ReportIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="5" width="22" height="22" rx="3" fill="#EF4444" />
    <rect x="9" y="16" width="3" height="7" rx="1" fill="#ffffff" />
    <rect x="14.5" y="11" width="3" height="12" rx="1" fill="#ffffff" />
    <rect x="20" y="8" width="3" height="15" rx="1" fill="#ffffff" />
  </svg>
);

const MasterIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
    <rect x="5" y="7" width="22" height="18" rx="3" fill="#14B8A6" />
    <path d="M5 12h22" stroke="#0D9488" strokeWidth="1.5" />
    <circle cx="10" cy="18" r="2" fill="#ffffff" />
    <line x1="15" y1="18" x2="22" y2="18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const calendarMonths = [
  { value: "all", label: "All year" },
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

type DashboardTraining = {
  date: string;
  course: string;
  shortName: string;
  time: string;
  room: string;
  status: string;
  company: string;
  isCenterPlan: boolean;
};

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

type DashboardMenuItem = {
  badge: string;
  step: string;
  icon: React.ReactNode;
  title: string;
  subTitle: string;
  description: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentGlow: string;
  onClick: () => void;
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
  const { language } = useUiLanguage();
  const isThai = language === "th";

  const fullEmployeeProfileItems = useMemo(() => {
    const userAny = authenticatedUser as any;
    return [
      {
        label: isThai ? "ชื่อ-นามสกุล / Full Name" : "Full Name / ชื่อ-นามสกุล",
        value: profileValue(authenticatedUser?.displayName ?? username),
      },
      {
        label: isThai ? "รหัสพนักงาน / Employee Code" : "Employee Code",
        value: profileValue(authenticatedUser?.employeeCode),
      },
      {
        label: isThai ? "ตำแหน่ง / Position" : "Position / ตำแหน่ง",
        value: profileValue(authenticatedUser?.positionName),
      },
      {
        label: isThai ? "หน่วยงาน / Department" : "Department / หน่วยงาน",
        value: profileValue(authenticatedUser?.functionName),
      },
      {
        label: isThai ? "วันเริ่มงาน / Start Date" : "Start Date / วันเริ่มงาน",
        value: profileValue(userAny?.startDate ?? "01 ม.ค. 2024"),
      },
      {
        label: isThai ? "วันเกิด / Date of Birth" : "Date of Birth / วันเกิด",
        value: profileValue(userAny?.birthDate ?? "15 ก.ย. 1992"),
      },
      {
        label: isThai ? "บริษัท / Company" : "Company / บริษัท",
        value:
          authenticatedUser?.roleCode === "HRD_CENTER"
            ? isThai ? "ทุกบริษัท (All Companies)" : "All Companies (ทุกบริษัท)"
            : profileValue(authenticatedUser?.companyName ?? authenticatedUser?.companyCode),
      },
    ];
  }, [authenticatedUser, username, isThai]);
  const isCenterDashboard = authenticatedUser?.roleCode === "HRD_CENTER";
  const userCompanyCode = profileValue(authenticatedUser?.companyCode);
  const dashboardScope = isCenterDashboard ? "Center" : "Factory";
  const dashboardTitle = isThai
    ? `${dashboardScope === "Center" ? "ศูนย์ฝึกอบรม" : "โรงงาน"} แดชบอร์ด`
    : `${dashboardScope} Dashboard`;
  const [calendarToday] = useState(getCurrentCalendarDate);
  const [selectedCalendarYear, setSelectedCalendarYear] = useState(
    calendarToday.year,
  );
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(
    calendarToday.month,
  );
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("all");
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>(() =>
    readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
  );

  useEffect(() => {
    const syncRollingPlans = () => {
      setRollingPlans(
        readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
      );
    };

    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncRollingPlans);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncRollingPlans);
  }, []);

  const scopedRollingPlans = useMemo(
    () =>
      rollingPlans.filter((plan) => {
        const planCompanies = getRollingPlanCompanies(plan);
        const isCenterPlan =
          plan.ownerScope === "CENTER" ||
          plan.ownerCompany === "HRD Center" ||
          plan.provider === "HRD Center" ||
          plan.owner === "admin.hrd";

        if (isCenterDashboard) {
          if (selectedCompanyFilter === "all" || selectedCompanyFilter === "All Companies") {
            return true;
          }
          return (
            plan.company === selectedCompanyFilter ||
            planCompanies.includes(selectedCompanyFilter) ||
            plan.company === "All Companies"
          );
        }

        const isOwnCompany =
          plan.company === userCompanyCode ||
          planCompanies.includes(userCompanyCode || "");

        if (isCenterPlan) {
          return (
            plan.company === "All Companies" ||
            isOwnCompany ||
            planCompanies.length === 0 ||
            planCompanies.includes(userCompanyCode || "")
          );
        }

        return isOwnCompany;
      }),
    [isCenterDashboard, rollingPlans, selectedCompanyFilter, userCompanyCode],
  );
  const trainingSchedule = useMemo<DashboardTraining[]>(
    () =>
      scopedRollingPlans.map((plan) => {
        const isCenterPlan =
          plan.ownerScope === "CENTER" ||
          plan.ownerCompany === "HRD Center" ||
          plan.provider === "HRD Center" ||
          plan.owner === "admin.hrd";

        return {
          date: plan.trainingDate,
          course: plan.course.name,
          shortName: plan.course.code,
          time: `${plan.startTime} - ${plan.endTime}`,
          room: plan.location,
          status: plan.status === "Planned" ? "Published" : "Draft",
          company: formatRollingPlanCompanies(plan),
          isCenterPlan,
        };
      }),
    [scopedRollingPlans],
  );
  const calendarYears = useMemo(
    () =>
      buildCalendarYearOptions(
        calendarToday.year,
        rollingPlans.map((plan) => plan.trainingDate),
      ),
    [calendarToday.year, rollingPlans],
  );

  const selectedMonthLabel =
    calendarMonths.find((month) => month.value === selectedCalendarMonth)?.label ??
    "Selected month";
  const isViewingCurrentMonth =
    selectedCalendarYear === calendarToday.year &&
    selectedCalendarMonth === calendarToday.month;

  const filteredTrainingSchedule = trainingSchedule.filter((item) => {
    const [year, month] = item.date.split("-");
    return (
      year === selectedCalendarYear &&
      (selectedCalendarMonth === "all" || month === selectedCalendarMonth)
    );
  });
  const employeeTrainingSummary = [
    {
      label: isThai ? "คอร์สเดือนนี้" : "This Month",
      value: String(filteredTrainingSchedule.length),
      helper: isThai ? "หลักสูตร" : "courses",
    },
    {
      label: isThai ? "ชั่วโมงอบรม" : "Training Hours",
      value: String(
        scopedRollingPlans.reduce(
          (total, plan) => total + Number(plan.hours || 0),
          0,
        ),
      ),
      helper: isThai ? "ชม." : "hours",
    },
    {
      label: isThai ? "เผยแพร่แล้ว" : "Published",
      value: String(
        scopedRollingPlans.filter((plan) => plan.status === "Planned").length,
      ),
      helper: isThai ? "หลักสูตร" : "courses",
    },
  ];

  const calendarDays =
    selectedCalendarMonth === "all"
      ? []
      : (() => {
        const year = Number(selectedCalendarYear);
        const month = Number(selectedCalendarMonth);
        const firstDay = new Date(year, month - 1, 1);
        const daysInMonth = new Date(year, month, 0).getDate();
        const leadingBlankDays = firstDay.getDay();
        const baseDays = Array.from(
          { length: leadingBlankDays + daysInMonth },
          (_, index) => {
            if (index < leadingBlankDays) {
              return { day: null, trainings: [] as DashboardTraining[] };
            }

            const day = index - leadingBlankDays + 1;
            const trainings = filteredTrainingSchedule.filter(
              (item) => Number(item.date.slice(8, 10)) === day,
            );

            return { day, trainings };
          },
        );

        return [
          ...baseDays,
          ...Array.from({ length: (7 - (baseDays.length % 7)) % 7 }, () => ({
            day: null,
            trainings: [] as DashboardTraining[],
          })),
        ];
      })();

  const menuItems: DashboardMenuItem[] = [
    {
      badge: isThai ? "จัดการหลักสูตร" : "COURSE MANAGEMENT",
      step: "01",
      icon: "📚",
      title: isThai ? "หลักสูตรอบรม" : "Training Course",
      subTitle: "Training Course Management",
      description: isThai
        ? "ดูแลฐานข้อมูลหลักสูตร มาตรฐานกลุ่มเป้าหมาย ประเภทหลักสูตร และแบบทดสอบก่อน-หลังอบรม"
        : "Manage course master, target standards, course types, and pre/post evaluation forms.",
      accent: "var(--ui-30-primary)",
      accentSoft: "var(--ui-30-primary-soft)",
      accentBorder: "var(--ui-30-primary)",
      accentGlow: "rgba(0, 122, 61, 0.18)",
      onClick: onOpenTrainingCourse,
    },
    {
      badge: isThai ? "จัดการแผนอบรม" : "PLAN MANAGEMENT",
      step: "02",
      icon: "📅",
      title: isThai ? "แผนการอบรม" : "Training Plan",
      subTitle: "Training Plan Management",
      description: isThai
        ? "จัดการแผน OAP ประจำปี คำขอฝึกอบรม แบบตอบรับจากบริษัท และแผนอบรมรายเดือน"
        : "Annual OAP plans, training needs, company acceptance surveys, and monthly rolling schedules.",
      accent: "var(--ui-30-primary)",
      accentSoft: "var(--ui-30-primary-soft)",
      accentBorder: "var(--ui-30-primary)",
      accentGlow: "rgba(0, 122, 61, 0.18)",
      onClick: onOpenTrainingPlan,
    },
    {
      badge: isThai ? "บันทึกผลอบรม" : "RECORD MANAGEMENT",
      step: "03",
      icon: "📋",
      title: isThai ? "ประวัติการอบรม" : "Training Record",
      subTitle: "Training Record Management",
      description: isThai
        ? "บันทึกผู้เข้าอบรมจริง ผลประเมินหลังอบรม ค่าใช้จ่าย และรายชื่อที่เพิ่มภายหลัง"
        : "Record actual attendance, post-training evaluations, expenses, and participant additions.",
      accent: "var(--ui-30-primary)",
      accentSoft: "var(--ui-30-primary-soft)",
      accentBorder: "var(--ui-30-primary)",
      accentGlow: "rgba(0, 122, 61, 0.18)",
      onClick: onOpenTrainingRecord,
    },
    {
      badge: isThai ? "รายงาน" : "REPORT MANAGEMENT",
      step: "04",
      icon: "📊",
      title: isThai ? "รายงานและวิเคราะห์ผล" : "Reports & Analytics",
      subTitle: "Reports & Analytics Management",
      description: isThai
        ? "ดูปฏิทินอบรม สรุปความคืบหน้า ค่าใช้จ่าย และร่างอีเมลรายงาน"
        : "Training schedule calendars, progress summaries, expense breakdowns, and email drafts.",
      accent: "var(--ui-30-primary)",
      accentSoft: "var(--ui-30-primary-soft)",
      accentBorder: "var(--ui-30-primary)",
      accentGlow: "rgba(0, 122, 61, 0.18)",
      onClick: onOpenReport,
    },
    {
      badge: isThai ? "ข้อมูลหลัก" : "MASTER DATA",
      step: "05",
      icon: "🗃️",
      title: isThai ? "ข้อมูลหลัก" : "Master Data",
      subTitle: "Master Data Management",
      description: isThai
        ? "ข้อมูลหลักของบริษัท พนักงาน วิทยากร ระดับ ตำแหน่ง และหน่วยงาน"
        : "Companies, employees, instructors, levels, positions, and function master data.",
      accent: "var(--ui-30-primary)",
      accentSoft: "var(--ui-30-primary-soft)",
      accentBorder: "var(--ui-30-primary)",
      accentGlow: "rgba(0, 122, 61, 0.18)",
      onClick: onOpenMasterData,
    },
  ];

  return (
    <DashboardLayout
      pageClassName={styles.page}
      workspaceClassName={styles.workspace}
      workspaceLabel={`HRD ${dashboardScope} dashboard`}
      username={username}
      onHome={onHome}
      onLogout={onLogout}
    >
      <div className={styles.workspaceBadge}>{dashboardScope} Workspace</div>

      <section className={styles.heroPanel} aria-label="Dashboard overview">
        <div className={styles.heroCopy}>
          <span>{isThai ? "ระบบบริหารจัดการการฝึกอบรม HRD" : `HRD Training ${dashboardScope}`}</span>
          <h1>{dashboardTitle}</h1>
          <p>
            {isThai
              ? "จัดการแผนการอบรม ข้อมูลหลักสูตร ประวัติการฝึกอบรม และรายงานวิเคราะห์ผล ทั้งกลุ่มบริษัท AISIN TAKAOKA Thailand"
              : "Manage training plans, course data, records, and reports across the AISIN TAKAOKA Thailand group."}
          </p>
        </div>
      </section>

      <div className={styles.topRow}>
        <section className={styles.employeePanel} aria-label="Employee profile">
          <div className={styles.profileHeaderBanner}>
            <div className={styles.photoBox} aria-hidden="true">
              {username ? username.slice(0, 2).toUpperCase() : "HC"}
            </div>
            <div className={styles.profileMetaBox}>
              <div className={styles.profileTagRow}>
                <span className={styles.userRoleTag}>
                  {authenticatedUser?.roleCode?.replace("_", " ") ?? "USER"}
                </span>
                <span className={styles.onlineBadge}>
                  <span className={styles.onlineDot} aria-hidden="true" />
                  Online
                </span>
              </div>
              <strong className={styles.profileName}>{username}</strong>
              <p className={styles.profileSubText}>
                {profileValue(authenticatedUser?.positionName)}
              </p>
            </div>
          </div>

          <div className={styles.employeeDetailsGrid}>
            {fullEmployeeProfileItems.map((item) => (
              <div className={styles.detailCard} key={item.label}>
                <span className={styles.detailLabel}>{item.label}</span>
                <strong className={styles.detailValue} title={item.value}>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className={styles.kpiSummaryBar} aria-label="Training summary">
            {employeeTrainingSummary.map((item) => (
              <div className={styles.kpiCol} key={item.label}>
                <span className={styles.kpiLabel}>{item.label}</span>
                <div className={styles.kpiValueRow}>
                  <strong className={styles.kpiValue}>{item.value}</strong>
                  <small className={styles.kpiHelper}>{item.helper}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.calendarPanel} aria-label="Training calendar">
          <div className={styles.panelHeader}>
            <div>
              <span>{selectedMonthLabel} {selectedCalendarYear}</span>
              <h2>{isThai ? "ปฏิทินการฝึกอบรม" : "Training Calendar"}</h2>
            </div>
            <div className={styles.calendarHeaderActions}>
              <b className={styles.courseCountBadge}>{filteredTrainingSchedule.length} {isThai ? "หลักสูตร" : "courses"}</b>
            </div>
          </div>

          <div className={styles.calendarFilters}>
            <div className={styles.filterItem}>
              <span className={styles.filterTitle}>{isThai ? "บริษัท" : "Company"}</span>
              <div className={styles.selectWrapper}>
                <select
                  className={styles.filterSelect}
                  disabled={!isCenterDashboard}
                  value={isCenterDashboard ? selectedCompanyFilter : userCompanyCode}
                  onChange={(event) => setSelectedCompanyFilter(event.target.value)}
                >
                  <option value="all">
                    {isCenterDashboard ? (isThai ? "ทุกบริษัท (All)" : "All Companies") : `${userCompanyCode} + Center`}
                  </option>
                  <option value="ATA">ATA</option>
                  <option value="ATFB">ATFB</option>
                  <option value="NIC">NIC</option>
                  <option value="SATI">SATI</option>
                  <option value="SNF">SNF</option>
                  <option value="TEP">TEP</option>
                </select>
                <svg className={styles.selectChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <div className={styles.filterItem}>
              <span className={styles.filterTitle}>{isThai ? "ปี" : "Year"}</span>
              <div className={styles.selectWrapper}>
                <select
                  className={styles.filterSelect}
                  value={selectedCalendarYear}
                  onChange={(event) => setSelectedCalendarYear(event.target.value)}
                >
                  {calendarYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <svg className={styles.selectChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <div className={styles.filterItem}>
              <span className={styles.filterTitle}>{isThai ? "เดือน" : "Month"}</span>
              <div className={styles.selectWrapper}>
                <select
                  className={styles.filterSelect}
                  value={selectedCalendarMonth}
                  onChange={(event) => setSelectedCalendarMonth(event.target.value)}
                >
                  {calendarMonths.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
                <svg className={styles.selectChevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>

          {selectedCalendarMonth === "all" ? null : (
            <div
              className={styles.calendarGrid}
              aria-label={`Training schedule in ${selectedMonthLabel} ${selectedCalendarYear}`}
            >
              {weekDays.map((day, index) => (
                <b key={`${day}-${index}`}>{day}</b>
              ))}
              {calendarDays.map((item, index) => {
                const className = [
                  styles.calendarDay,
                  item.trainings.length > 0 ? styles.trainingDay : "",
                  isViewingCurrentMonth && item.day === calendarToday.day
                    ? styles.today
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div className={className} key={`${item.day ?? "empty"}-${index}`}>
                    {item.day ? (
                      <>
                        <span>{item.day}</span>
                        {item.trainings.map((training) => {
                          const displayCompany =
                            training.company === "All Companies"
                              ? "ALL"
                              : training.company;

                          return (
                            <small
                              key={`${training.date}-${training.course}-${training.time}`}
                              title={`${training.course} (${training.company})`}
                            >
                              <b style={{ color: training.isCenterPlan ? "#007a3d" : "#475569" }}>
                                [{displayCompany}]
                              </b>{" "}
                              {training.shortName}
                            </small>
                          );
                        })}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {filteredTrainingSchedule.length > 0 ? (
            <div className={styles.trainingList} aria-label="Upcoming training courses">
              {filteredTrainingSchedule.map((item) => {
                const date = new Date(`${item.date}T00:00:00`);
                const dateLabel = date.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                });

                return (
                  <article className={styles.trainingItem} key={`${item.date}-${item.course}-${item.time}`}>
                    <time dateTime={item.date}>{dateLabel}</time>
                    <div>
                      <strong>{item.course}</strong>
                      <span>
                        <b style={{ color: item.isCenterPlan ? "#007a3d" : "#0f172a", fontWeight: 700 }}>
                          {item.isCenterPlan ? "HRD Center" : item.company}
                        </b>{" "}
                        ({item.company}) • {item.time} / {item.room}
                      </span>
                    </div>
                    <b>{item.status}</b>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>

      <section className={styles.menuPanel} aria-label="Main workspace menu">
        <div className={styles.menuHeader}>
          <div>
            <span>{isThai ? "เมนูการทำงาน" : "Workspace Operations"}</span>
            <h2>{isThai ? "เลือกโมดูลที่ต้องการใช้งาน" : "Select a Workspace Module"}</h2>
          </div>
          <p className={styles.coreModulesBadge}>5 Core Modules</p>
        </div>

        <div className={styles.menuRow}>
          {menuItems.map((item) => (
            <button
              className={styles.menuBox}
              key={item.title}
              style={{
                "--card-accent": item.accent,
                "--card-accent-soft": item.accentSoft,
                "--card-accent-border": item.accentBorder,
              } as CSSProperties}
              type="button"
              onClick={item.onClick}
            >
              <div className={styles.cardHeaderRow}>
                <div className={styles.cardIconBox} aria-hidden="true">
                  <span className={styles.cardEmojiIcon}>{item.icon}</span>
                </div>
                <span className={styles.cardIndexPill} aria-hidden="true">
                  {item.step}
                </span>
              </div>

              <div className={styles.cardBodyContent}>
                <span className={styles.cardKicker}>{item.badge}</span>
                <strong className={styles.cardMainTitle}>{item.title}</strong>
                <p className={styles.cardDescText}>{item.description}</p>
              </div>

              <div className={styles.cardFooterAction}>
                <span className={styles.openBtn}>{isThai ? "เปิด" : "Open"}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}


