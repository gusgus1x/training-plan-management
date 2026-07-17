"use client";

import { useState } from "react";
import Navbar from "../Navbar";
import styles from "./Factory_TrainingRecordManagement.module.css";

const recordItems = [
  {
    title: "Training Actual",
    subtitle: "บันทึกเข้าอบรมจริง",
    description: "บันทึกอบรมที่สำเร็จ จำนวนผู้เข้าอบรมจริง และค่าใช้จ่ายจริงของหลักสูตร",
  },
  {
    title: "Training Record",
    subtitle: "ประวัติ ผลทดสอบ และค่าใช้จ่าย",
    description: "รวมประวัติการอบรม Pre/Post Test & Evaluation และ Training Expense ของแต่ละหลักสูตรไว้ในที่เดียว",
  },
];

const actualTrainings = [
  {
    key: "actual-001",
    courseCode: "ACT-TRN-001",
    courseName: "Leadership Essentials",
    trainingName: "Leadership Essentials",
    company: "ATTG Training plan management",
    organizerCompany: "ATFB",
    date: "15 Jul 2026",
    month: "2026-07",
    startTime: "09:00",
    endTime: "16:00",
    hours: "6",
    round: "รุ่น 1 / 2026",
    trainer: "Nattapong K.",
    department: "HRD Learning & Development",
    groupName: "Operations",
    participants: 24,
    completed: 23,
    status: "Completed",
    preTest: "แบบทดสอบก่อนเรียน 20 ข้อ สำหรับวัดพื้นฐานภาวะผู้นำ",
    postTest: "แบบทดสอบหลังเรียน 20 ข้อ พร้อมสรุปคะแนนผ่านเกณฑ์",
    evaluation: "แบบประเมินความพึงพอใจ เนื้อหา ผู้สอน และการนำไปใช้",
    registeredUsers: [
      { id: "EMP-001", name: "Somchai P.", department: "Operations", attended: true },
      { id: "EMP-014", name: "Naree T.", department: "Operations", attended: true },
      { id: "EMP-028", name: "Krit S.", department: "Production", attended: false },
      { id: "EMP-031", name: "Maliwan P.", department: "Customer Service", attended: true },
    ],
    walkInUsers: [
      { id: "WALK-001", name: "Anan K.", department: "Production" },
      { id: "WALK-002", name: "Pimchanok R.", department: "Warehouse" },
    ],
    costs: [
      { label: "Instructor", amount: "35000" },
      { label: "Traveling", amount: "6500" },
      { label: "Seminar Room", amount: "12000" },
      { label: "Accommodation", amount: "8000" },
      { label: "Material", amount: "4800" },
      { label: "Food & Beverage", amount: "9600" },
    ],
  },
  {
    key: "actual-002",
    courseCode: "ACT-TRN-002",
    courseName: "Safety & Compliance Basics",
    trainingName: "Safety & Compliance Basics",
    company: "ATTG Training plan management",
    organizerCompany: "ATFB",
    date: "21 Aug 2026",
    month: "2026-08",
    startTime: "10:00",
    endTime: "12:00",
    hours: "2",
    round: "รุ่น 2 / 2026",
    trainer: "Safety Team",
    department: "Safety & Compliance",
    groupName: "Safety",
    participants: 42,
    completed: 40,
    status: "Completed",
    preTest: "Pre-test ความรู้ Safety & Compliance ก่อนอบรม",
    postTest: "Post-test หลังอบรมเพื่อยืนยันความเข้าใจข้อกำหนด",
    evaluation: "แบบประเมินหลักสูตร Safety & Compliance และความพร้อมใช้งานจริง",
    registeredUsers: [
      { id: "EMP-044", name: "Suda M.", department: "Safety", attended: true },
      { id: "EMP-052", name: "Prawit C.", department: "Production", attended: true },
      { id: "EMP-063", name: "Warin T.", department: "Maintenance", attended: true },
      { id: "EMP-071", name: "Kanda L.", department: "Warehouse", attended: false },
    ],
    walkInUsers: [{ id: "WALK-003", name: "Jirawat P.", department: "Production" }],
    costs: [
      { label: "Instructor", amount: "22000" },
      { label: "Traveling", amount: "3500" },
      { label: "Seminar Room", amount: "15000" },
      { label: "Accommodation", amount: "0" },
      { label: "Material", amount: "6200" },
      { label: "Food & Beverage", amount: "12600" },
    ],
  },
  {
    key: "actual-003",
    courseCode: "ACT-TRN-003",
    courseName: "Service Mind for Frontline",
    trainingName: "Service Mind for Frontline",
    company: "ATTG Training plan management",
    organizerCompany: "ATSB",
    date: "8 Sep 2026",
    month: "2026-09",
    startTime: "09:00",
    endTime: "16:30",
    hours: "6.5",
    round: "รุ่น 1 / 2026",
    trainer: "Maliwan P.",
    department: "Corporate Training",
    groupName: "Customer Service",
    participants: 18,
    completed: 18,
    status: "Completed",
    preTest: "Pre-test ด้าน service mindset และการรับมือสถานการณ์ลูกค้า",
    postTest: "Post-test หลัง workshop พร้อม case scenario",
    evaluation: "แบบประเมินผู้สอน กิจกรรม และความมั่นใจหลังอบรม",
    registeredUsers: [
      { id: "EMP-082", name: "Ploy S.", department: "Customer Service", attended: true },
      { id: "EMP-084", name: "Thanawat B.", department: "Frontline", attended: true },
      { id: "EMP-091", name: "Siriporn A.", department: "Customer Service", attended: true },
    ],
    walkInUsers: [
      { id: "WALK-004", name: "Noppadol Y.", department: "Service Desk" },
      { id: "WALK-005", name: "Rattana V.", department: "Sales Support" },
    ],
    costs: [
      { label: "Instructor", amount: "28000" },
      { label: "Traveling", amount: "4200" },
      { label: "Seminar Room", amount: "9000" },
      { label: "Accommodation", amount: "5000" },
      { label: "Material", amount: "3600" },
      { label: "Food & Beverage", amount: "5400" },
    ],
  },
] as const;

const actualYears = [
  { label: "ทุกปี", value: "all" },
  { label: "2026", value: "2026" },
] as const;

const actualMonths = [
  { label: "ทุกเดือน", value: "all" },
  { label: "July", value: "07" },
  { label: "August", value: "08" },
  { label: "September", value: "09" },
] as const;

type TrainingRecordManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
};

const getTotalActualCost = (costs: (typeof actualTrainings)[number]["costs"]) =>
  costs.reduce((total, item) => total + Number(item.amount), 0);

type ActualTrainingKey = (typeof actualTrainings)[number]["key"];

type EvaluationCompany = {
  company: string;
  employees: Array<{
    id: string;
    name: string;
    department: string;
    contentScore: number;
    trainerScore: number;
    applicationScore: number;
    comment: string;
  }>;
};

const assessmentResults: Record<ActualTrainingKey, { prePassed: number; preTotal: number; postPassed: number; postTotal: number }> = {
  "actual-001": { prePassed: 14, preTotal: 23, postPassed: 21, postTotal: 23 },
  "actual-002": { prePassed: 25, preTotal: 40, postPassed: 37, postTotal: 40 },
  "actual-003": { prePassed: 11, preTotal: 18, postPassed: 17, postTotal: 18 },
};

const evaluationCompanies: Record<ActualTrainingKey, EvaluationCompany[]> = {
  "actual-001": [{ company: "ATFB", employees: [
    { id: "EMP-001", name: "Somchai P.", department: "Operations", contentScore: 5, trainerScore: 5, applicationScore: 4, comment: "นำไปใช้กับทีมได้" },
    { id: "EMP-014", name: "Naree T.", department: "Operations", contentScore: 4, trainerScore: 5, applicationScore: 5, comment: "กิจกรรมชัดเจน" },
    { id: "EMP-031", name: "Maliwan P.", department: "Customer Service", contentScore: 5, trainerScore: 4, applicationScore: 4, comment: "ต้องการ workshop เพิ่ม" },
  ] }],
  "actual-002": [{ company: "ATFB", employees: [
    { id: "EMP-044", name: "Suda M.", department: "Safety", contentScore: 5, trainerScore: 5, applicationScore: 5, comment: "เข้าใจข้อกำหนดมากขึ้น" },
    { id: "EMP-052", name: "Prawit C.", department: "Production", contentScore: 4, trainerScore: 5, applicationScore: 4, comment: "ตัวอย่างใช้งานได้จริง" },
    { id: "EMP-063", name: "Warin T.", department: "Maintenance", contentScore: 4, trainerScore: 4, applicationScore: 5, comment: "ควรเพิ่มเวลาอบรม" },
  ] }],
  "actual-003": [{ company: "ATSB", employees: [
    { id: "EMP-082", name: "Ploy S.", department: "Customer Service", contentScore: 5, trainerScore: 5, applicationScore: 5, comment: "ฝึกสถานการณ์ได้ดี" },
    { id: "EMP-084", name: "Thanawat B.", department: "Frontline", contentScore: 4, trainerScore: 5, applicationScore: 5, comment: "พร้อมนำไปใช้" },
    { id: "EMP-091", name: "Siriporn A.", department: "Customer Service", contentScore: 5, trainerScore: 4, applicationScore: 4, comment: "เนื้อหากระชับ" },
  ] }],
};

const escapeExcelText = (value: string | number) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const downloadEvaluationExcel = (
  training: (typeof actualTrainings)[number],
  evaluationCompany: EvaluationCompany,
) => {
  const rows = evaluationCompany.employees.map((employee) => {
    const average = ((employee.contentScore + employee.trainerScore + employee.applicationScore) / 3).toFixed(2);
    return `<tr><td>${escapeExcelText(employee.id)}</td><td>${escapeExcelText(employee.name)}</td><td>${escapeExcelText(employee.department)}</td><td>${employee.contentScore}</td><td>${employee.trainerScore}</td><td>${employee.applicationScore}</td><td>${average}</td><td>${escapeExcelText(employee.comment)}</td></tr>`;
  }).join("");
  const workbook = `\ufeff<html><head><meta charset="UTF-8"></head><body><h2>${escapeExcelText(training.courseName)}</h2><p>Company: ${escapeExcelText(evaluationCompany.company)} | Course: ${escapeExcelText(training.courseCode)} | Date: ${escapeExcelText(training.date)}</p><table border="1"><thead><tr><th>Employee ID</th><th>Employee name</th><th>Department</th><th>Content</th><th>Trainer</th><th>Application</th><th>Average</th><th>Comment</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${training.courseCode}-${evaluationCompany.company}-evaluation.xls`;
  link.click();
  URL.revokeObjectURL(url);
};

export default function TrainingRecordManagement({
  username,
  onBack,
  onHome,
  onLogout,
}: TrainingRecordManagementProps) {
  const [selectedRecord, setSelectedRecord] = useState<(typeof recordItems)[number] | null>(null);
  const [selectedActualYear, setSelectedActualYear] =
    useState<(typeof actualYears)[number]["value"]>("all");
  const [selectedActualMonth, setSelectedActualMonth] =
    useState<(typeof actualMonths)[number]["value"]>("all");
  const [selectedRecordYear, setSelectedRecordYear] =
    useState<(typeof actualYears)[number]["value"]>("all");
  const [selectedRecordMonth, setSelectedRecordMonth] =
    useState<(typeof actualMonths)[number]["value"]>("all");
  const [selectedEvaluationYear, setSelectedEvaluationYear] =
    useState<(typeof actualYears)[number]["value"]>("all");
  const [selectedEvaluationMonth, setSelectedEvaluationMonth] =
    useState<(typeof actualMonths)[number]["value"]>("all");
  const [expandedActualKey, setExpandedActualKey] = useState<ActualTrainingKey | "">(actualTrainings[0].key);
  const [expandedRecordKey, setExpandedRecordKey] = useState<ActualTrainingKey | "">(actualTrainings[0].key);
  const [expandedEvaluationKey, setExpandedEvaluationKey] =
    useState<ActualTrainingKey | "">(actualTrainings[0].key);

  const handleBack = () => {
    if (selectedRecord) {
      setSelectedRecord(null);
      return;
    }

    onBack();
  };

  const visibleActualTrainings = actualTrainings.filter((training) => {
    const [year, month] = training.month.split("-");
    const matchesYear = selectedActualYear === "all" || year === selectedActualYear;
    const matchesMonth = selectedActualMonth === "all" || month === selectedActualMonth;

    return matchesYear && matchesMonth;
  });

  const totalAllActualCost = visibleActualTrainings.reduce(
    (total, training) => total + getTotalActualCost(training.costs),
    0,
  );

  const visibleRecordTrainings = actualTrainings.filter((training) => {
    const [year, month] = training.month.split("-");
    const matchesYear = selectedRecordYear === "all" || year === selectedRecordYear;
    const matchesMonth = selectedRecordMonth === "all" || month === selectedRecordMonth;

    return matchesYear && matchesMonth;
  });

  const visibleEvaluationTrainings = actualTrainings.filter((training) => {
    const [year, month] = training.month.split("-");
    const matchesYear = selectedEvaluationYear === "all" || year === selectedEvaluationYear;
    const matchesMonth = selectedEvaluationMonth === "all" || month === selectedEvaluationMonth;

    return matchesYear && matchesMonth;
  });

  const totalRecordCost = visibleRecordTrainings.reduce(
    (total, training) => total + getTotalActualCost(training.costs),
    0,
  );

  const handleActualFilterChange = (
    nextYear: (typeof actualYears)[number]["value"],
    nextMonth: (typeof actualMonths)[number]["value"],
  ) => {
    const nextTrainings = actualTrainings.filter((training) => {
      const [year, month] = training.month.split("-");
      const matchesYear = nextYear === "all" || year === nextYear;
      const matchesMonth = nextMonth === "all" || month === nextMonth;

      return matchesYear && matchesMonth;
    });

    setSelectedActualYear(nextYear);
    setSelectedActualMonth(nextMonth);
    setExpandedActualKey(nextTrainings[0]?.key ?? "");
  };

  const handleRecordFilterChange = (
    nextYear: (typeof actualYears)[number]["value"],
    nextMonth: (typeof actualMonths)[number]["value"],
  ) => {
    const nextTrainings = actualTrainings.filter((training) => {
      const [year, month] = training.month.split("-");
      const matchesYear = nextYear === "all" || year === nextYear;
      const matchesMonth = nextMonth === "all" || month === nextMonth;

      return matchesYear && matchesMonth;
    });

    setSelectedRecordYear(nextYear);
    setSelectedRecordMonth(nextMonth);
    setExpandedRecordKey(nextTrainings[0]?.key ?? "");
  };

  const handleEvaluationFilterChange = (
    nextYear: (typeof actualYears)[number]["value"],
    nextMonth: (typeof actualMonths)[number]["value"],
  ) => {
    const nextTrainings = actualTrainings.filter((training) => {
      const [year, month] = training.month.split("-");
      const matchesYear = nextYear === "all" || year === nextYear;
      const matchesMonth = nextMonth === "all" || month === nextMonth;

      return matchesYear && matchesMonth;
    });

    setSelectedEvaluationYear(nextYear);
    setSelectedEvaluationMonth(nextMonth);
    setExpandedEvaluationKey(nextTrainings[0]?.key ?? "");
  };

  const renderArchiveDetail = (training: (typeof actualTrainings)[number]) => {
    const [year, month] = training.month.split("-");
    const actualUsers = training.registeredUsers.filter((user) => user.attended);
    const allAttendees = [...actualUsers, ...training.walkInUsers];
    const assessment = assessmentResults[training.key];
    const prePercentage = Math.round((assessment.prePassed / assessment.preTotal) * 100);
    const postPercentage = Math.round((assessment.postPassed / assessment.postTotal) * 100);
    const companyEvaluations = evaluationCompanies[training.key];

    return (
      <>
        <dl className={styles.recordArchiveMeta}>
          <div>
            <dt>ปี / เดือน</dt>
            <dd>{year} / {month}</dd>
          </div>
          <div>
            <dt>บริษัท</dt>
            <dd>{training.company}</dd>
          </div>
          <div>
            <dt>Company ผู้จัด</dt>
            <dd>{training.organizerCompany}</dd>
          </div>
          <div>
            <dt>เวลา</dt>
            <dd>
              {training.startTime} - {training.endTime}
            </dd>
          </div>
          <div>
            <dt>ชั่วโมงอบรม</dt>
            <dd>{training.hours} hours</dd>
          </div>
          <div>
            <dt>วิทยากร</dt>
            <dd>{training.trainer}</dd>
          </div>
          <div>
            <dt>Group</dt>
            <dd>{training.groupName}</dd>
          </div>
          <div>
            <dt>ผู้เข้าอบรมทั้งหมด</dt>
            <dd>{allAttendees.length} people</dd>
          </div>
        </dl>

        <section className={styles.recordIntegratedPanel} aria-label="Pre and post test with evaluation">
          <div className={styles.recordSectionHeader}>
            <div>
              <p className={styles.panelKicker}>Assessment &amp; Evaluation</p>
              <h3>Keep Pre/Post Test and Evaluation</h3>
            </div>
            <span>Completed</span>
          </div>
          <div className={styles.assessmentChartGrid}>
            <article className={styles.assessmentChartCard}>
              <div className={styles.pieChart} style={{ background: `conic-gradient(#16a34a 0 ${prePercentage}%, #fee2e2 ${prePercentage}% 100%)` }}><strong>{prePercentage}%</strong></div>
              <div><span>Pre-test</span><strong>{assessment.prePassed}/{assessment.preTotal} ผ่านเกณฑ์</strong><p>{training.preTest}</p></div>
            </article>
            <article className={styles.assessmentChartCard}>
              <div className={styles.pieChart} style={{ background: `conic-gradient(#16a34a 0 ${postPercentage}%, #fee2e2 ${postPercentage}% 100%)` }}><strong>{postPercentage}%</strong></div>
              <div><span>Post-test</span><strong>{assessment.postPassed}/{assessment.postTotal} ผ่านเกณฑ์</strong><p>{training.postTest}</p></div>
            </article>
          </div>
        </section>

        <section className={styles.recordIntegratedPanel} aria-label="Evaluation Excel downloads by company">
          <div className={styles.recordSectionHeader}>
            <div><p className={styles.panelKicker}>Evaluation</p><h3>ดาวน์โหลดแบบประเมินแยกตามบริษัท</h3></div>
            <span>{companyEvaluations.length} companies</span>
          </div>
          <p className={styles.evaluationDescription}>{training.evaluation}</p>
          <div className={styles.companyDownloadGrid}>
            {companyEvaluations.map((item) => (
              <article key={item.company}>
                <div><strong>{item.company}</strong><span>{item.employees.length} employees</span></div>
                <button type="button" onClick={() => downloadEvaluationExcel(training, item)}>Download {item.company} Excel</button>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.recordIntegratedPanel} aria-label="Training expense">
          <div className={styles.recordSectionHeader}>
            <div>
              <p className={styles.panelKicker}>Training Expense</p>
              <h3>สรุปค่าใช้จ่ายฝึกอบรม</h3>
            </div>
            <b>฿{getTotalActualCost(training.costs).toLocaleString("en-US")}</b>
          </div>
          <div className={styles.recordExpenseGrid}>
            {training.costs.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>฿{Number(item.amount).toLocaleString("en-US")}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.recordAttendeePanel}>
          <div className={styles.peopleHeader}>
            <h3>รายชื่อคนเข้าอบรม</h3>
            <span>{allAttendees.length} users</span>
          </div>
          <div className={styles.recordAttendeeList}>
            {allAttendees.map((user) => (
              <div className={styles.recordAttendeeRow} key={user.id}>
                <strong>{user.name}</strong>
                <span>
                  {user.id} / {user.department}
                </span>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  };

  return (
    <main className={styles.page}>
      <Navbar username={username} onHome={onHome} onLogout={onLogout} />

      <section className={styles.header}>
        <button className={styles.backButton} type="button" onClick={handleBack}>
          Back
        </button>
        <p className={styles.kicker}>Training Record</p>
        <h1>{selectedRecord ? selectedRecord.title : "Training Record Management"}</h1>
      </section>

      {selectedRecord?.title === "Training Actual" ? (
        <section className={styles.actualWorkspace} aria-label="Training actual record">
          <section className={styles.actualHero}>
            <div>
              <p className={styles.panelKicker}>Training actual</p>
              <h2>บันทึกอบรมที่สำเร็จ</h2>
              <span>{visibleActualTrainings.length} courses completed</span>
            </div>
            <div className={styles.actualMonthControl}>
              <label>
                <span>ปี</span>
                <select
                  value={selectedActualYear}
                  onChange={(event) =>
                    handleActualFilterChange(
                      event.target.value as (typeof actualYears)[number]["value"],
                      selectedActualMonth,
                    )
                  }
                >
                  {actualYears.map((year) => (
                    <option key={year.value} value={year.value}>
                      {year.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>เดือน</span>
                <select
                  value={selectedActualMonth}
                  onChange={(event) =>
                    handleActualFilterChange(
                      selectedActualYear,
                      event.target.value as (typeof actualMonths)[number]["value"],
                    )
                  }
                >
                  {actualMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
              <b>฿{totalAllActualCost.toLocaleString("en-US")}</b>
            </div>
          </section>

          <div className={styles.actualTrainingList}>
            {visibleActualTrainings.map((training) => {
              const isExpanded = expandedActualKey === training.key;
              const totalActualCost = getTotalActualCost(training.costs);

              return (
                <section className={styles.actualPanel} key={training.key}>
                  <div className={styles.actualCourseRow}>
                    <div>
                      <strong>{training.courseName}</strong>
                      <span>
                        {training.courseCode} / {training.date} / {training.round}
                      </span>
                    </div>
                    <b>{training.status}</b>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => setExpandedActualKey(isExpanded ? "" : training.key)}
                    >
                      {isExpanded ? "ซ่อนรายละเอียด" : "แสดงรายละเอียด"}
                    </button>
                  </div>

                  {isExpanded ? (
                    <>
                      <section className={styles.actualSummaryGrid}>
                        <article>
                          <span>ผู้เข้าอบรมจริง</span>
                          <strong>
                            {training.completed}/{training.participants}
                          </strong>
                        </article>
                        <article>
                          <span>วิทยากร</span>
                          <strong>{training.trainer}</strong>
                        </article>
                        <article>
                          <span>หน่วยงาน</span>
                          <strong>{training.department}</strong>
                        </article>
                        <article>
                          <span>ค่าใช้จ่ายจริงรวม</span>
                          <strong>฿{totalActualCost.toLocaleString("en-US")}</strong>
                        </article>
                      </section>

                      <section className={styles.actualPeopleGrid}>
                        <div className={styles.peoplePanel}>
                          <div className={styles.peopleHeader}>
                            <h3>รายชื่อลงทะเบียน</h3>
                            <span>{training.registeredUsers.length} users</span>
                          </div>
                          <div className={styles.peopleList}>
                            {training.registeredUsers.map((user) => (
                              <label className={styles.peopleRow} key={user.id}>
                                <input defaultChecked={user.attended} type="checkbox" />
                                <div>
                                  <strong>{user.name}</strong>
                                  <span>
                                    {user.id} / {user.department}
                                  </span>
                                </div>
                                <b>{user.attended ? "เข้าอบรมจริง" : "ไม่เข้าอบรม"}</b>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className={styles.peoplePanel}>
                          <div className={styles.peopleHeader}>
                            <h3>User no plan</h3>
                            <span>Walk in {training.walkInUsers.length}</span>
                          </div>
                          <div className={styles.peopleList}>
                            {training.walkInUsers.map((user) => (
                              <article className={styles.peopleRow} key={user.id}>
                                <div className={styles.walkInMark}>WI</div>
                                <div>
                                  <strong>{user.name}</strong>
                                  <span>
                                    {user.id} / {user.department}
                                  </span>
                                </div>
                                <button type="button">อนุมัติ</button>
                              </article>
                            ))}
                          </div>
                        </div>
                      </section>

                      <div className={styles.panelHeader}>
                        <div>
                          <p className={styles.panelKicker}>Actual cost</p>
                          <h2>บันทึกค่าใช้จ่ายจริง</h2>
                        </div>
                        <span className={styles.totalPill}>
                          ฿{totalActualCost.toLocaleString("en-US")}
                        </span>
                      </div>

                      <div className={styles.costGrid}>
                        {training.costs.map((item) => (
                          <article key={item.label}>
                            <div>
                              <span>{item.label}</span>
                            </div>
                            <label>
                              <span>ค่าใช้จ่าย</span>
                              <input
                                aria-label={`${item.label} cost`}
                                defaultValue={item.amount}
                                inputMode="numeric"
                              />
                            </label>
                          </article>
                        ))}
                      </div>

                      <div className={styles.actualActions}>
                        <button className={styles.secondaryButton} type="button">
                          Cancel
                        </button>
                        <button className={styles.primaryButton} type="button">
                          Save actual
                        </button>
                      </div>
                    </>
                  ) : null}
                </section>
              );
            })}
          </div>
        </section>
      ) : selectedRecord?.title === "Training Evaluation" ? (
        <section className={styles.actualWorkspace} aria-label="Training evaluation">
          <section className={styles.actualHero}>
            <div>
              <p className={styles.panelKicker}>Training Evaluation</p>
              <h2>Pre-test / Post-test / แบบประเมิน</h2>
              <span>{visibleEvaluationTrainings.length} courses</span>
            </div>
            <div className={styles.actualMonthControl}>
              <label>
                <span>ปี</span>
                <select
                  value={selectedEvaluationYear}
                  onChange={(event) =>
                    handleEvaluationFilterChange(
                      event.target.value as (typeof actualYears)[number]["value"],
                      selectedEvaluationMonth,
                    )
                  }
                >
                  {actualYears.map((year) => (
                    <option key={year.value} value={year.value}>
                      {year.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>เดือน</span>
                <select
                  value={selectedEvaluationMonth}
                  onChange={(event) =>
                    handleEvaluationFilterChange(
                      selectedEvaluationYear,
                      event.target.value as (typeof actualMonths)[number]["value"],
                    )
                  }
                >
                  {actualMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <div className={styles.actualTrainingList}>
            {visibleEvaluationTrainings.map((training) => {
              const isExpanded = expandedEvaluationKey === training.key;
              const [evaluationYear, evaluationMonth] = training.month.split("-");

              return (
                <section className={styles.actualPanel} key={training.key}>
                  <div className={styles.actualCourseRow}>
                    <div>
                      <strong>{training.courseName}</strong>
                      <span>
                        {training.courseCode} / {training.date} / {evaluationYear}-{evaluationMonth}
                      </span>
                    </div>
                    <b>{training.status}</b>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => setExpandedEvaluationKey(isExpanded ? "" : training.key)}
                    >
                      {isExpanded ? "ซ่อนรายละเอียด" : "แสดงรายละเอียด"}
                    </button>
                  </div>

                  {isExpanded ? (
                    <section className={styles.evaluationDetailGrid}>
                      <article>
                        <span>Pre-test</span>
                        <strong>{training.preTest}</strong>
                      </article>
                      <article>
                        <span>Post-test</span>
                        <strong>{training.postTest}</strong>
                      </article>
                      <article>
                        <span>แบบประเมิน</span>
                        <strong>{training.evaluation}</strong>
                      </article>
                    </section>
                  ) : null}
                </section>
              );
            })}

            {visibleEvaluationTrainings.length === 0 ? (
              <div className={styles.blankCanvas} />
            ) : null}
          </div>
        </section>
      ) : selectedRecord?.title === "Training Record" ? (
        <section className={styles.recordArchiveWorkspace} aria-label="Training record archive">
          <section className={styles.recordArchiveHeader}>
            <div>
              <p className={styles.panelKicker}>Training Record</p>
              <h2>ประวัติ ผลทดสอบ การประเมิน และค่าใช้จ่าย</h2>
              <span>{visibleRecordTrainings.length} courses archived</span>
            </div>
            <div className={styles.actualMonthControl}>
              <label>
                <span>ปี</span>
                <select
                  value={selectedRecordYear}
                  onChange={(event) =>
                    handleRecordFilterChange(
                      event.target.value as (typeof actualYears)[number]["value"],
                      selectedRecordMonth,
                    )
                  }
                >
                  {actualYears.map((year) => (
                    <option key={year.value} value={year.value}>
                      {year.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>เดือน</span>
                <select
                  value={selectedRecordMonth}
                  onChange={(event) =>
                    handleRecordFilterChange(
                      selectedRecordYear,
                      event.target.value as (typeof actualMonths)[number]["value"],
                    )
                  }
                >
                  {actualMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
              <b>฿{totalRecordCost.toLocaleString("en-US")}</b>
            </div>
          </section>

          <div className={styles.recordArchiveList}>
            {visibleRecordTrainings.map((training) => {
              const isExpanded = expandedRecordKey === training.key;
              const [recordYear, recordMonth] = training.month.split("-");
              const totalActualCost = getTotalActualCost(training.costs);

              return (
                <article className={styles.recordArchiveCard} key={training.key}>
                  <div
                    className={`${styles.recordArchiveTitle} ${
                      isExpanded ? styles.activeRecordArchiveTitle : ""
                    }`}
                  >
                    <div>
                      <strong>{training.trainingName}</strong>
                      <span>
                        {training.courseCode} / {training.courseName}
                      </span>
                    </div>
                    <div className={styles.recordArchivePeriod}>
                      <span>ปี / เดือน</span>
                      <strong>{recordYear} / {recordMonth}</strong>
                    </div>
                    <b>฿{totalActualCost.toLocaleString("en-US")}</b>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => setExpandedRecordKey(isExpanded ? "" : training.key)}
                    >
                      {isExpanded ? "ซ่อนรายละเอียด" : "แสดงรายละเอียด"}
                    </button>
                  </div>
                  {isExpanded ? renderArchiveDetail(training) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : selectedRecord ? (
        <section className={styles.blankWorkspace} aria-label={`${selectedRecord.title} page`}>
          <div className={styles.blankCanvas} />
        </section>
      ) : (
        <section className={styles.recordGrid} aria-label="Training record menu">
          {recordItems.map((item) => (
            <button
              className={styles.recordCard}
              key={item.title}
              type="button"
              onClick={() => setSelectedRecord(item)}
            >
              <div className={styles.cardTopline}>
                <span className={styles.badge}>{item.subtitle}</span>
              </div>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
