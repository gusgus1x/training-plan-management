"use client";

import { Fragment, useMemo, useState } from "react";
import styles from "./TrainingRolling.module.css";

export const trainingRollingModule = {
  title: "Training Rolling",
  subtitle: "Monthly training plan",
  description: "Convert annual OAP items into monthly rolling training schedules.",
} as const;

type RollingStatus = "Planning" | "Planned";

type CourseMasterDetail = {
  code: string;
  name: string;
  objective: string;
  learningContent: string;
  targetGroup: string;
  methodology: string;
  preTest: string;
  postTest: string;
  evaluation: string;
  evaluationAfter30Day: string;
  lifeCycleMonth: string;
  courseType: string;
  courseGroup: string;
};

type OapSource = {
  id: string;
  course: CourseMasterDetail;
  participants: string;
  hours: string;
  budget: string;
  trainer: string;
  provider: string;
  owner: string;
};

type RollingPlan = OapSource & {
  rollingId: string;
  sequence: number;
  batch: string;
  location: string;
  trainingDate: string;
  startTime: string;
  endTime: string;
  company: string;
  status: RollingStatus;
  updatedAt: string;
};

const companies = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;
const monthOptions = [
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
const yearOptions = ["2026", "2027"] as const;

const oapSources: OapSource[] = [
  {
    id: "oap-001",
    course: {
      code: "CRS-001",
      name: "Leadership Essentials",
      objective: "Develop leadership capability for supervisors and team leaders.",
      learningContent: "Leader role, delegation, coaching, feedback, team follow-up.",
      targetGroup: "Supervisor / Section Head / Leader",
      methodology: "Classroom + Workshop",
      preTest: "Leadership pre-test",
      postTest: "Leadership post-test",
      evaluation: "Course satisfaction survey",
      evaluationAfter30Day: "Manager follow-up after 30 days",
      lifeCycleMonth: "24",
      courseType: "IN-HOUSE",
      courseGroup: "Management",
    },
    participants: "24",
    hours: "6",
    budget: "45000",
    trainer: "Somchai P.",
    provider: "HRD Center",
    owner: "admin.hrd",
  },
  {
    id: "oap-002",
    course: {
      code: "CRS-022",
      name: "Safety Basics",
      objective: "Ensure employees understand workplace safety rules.",
      learningContent: "Safety rules, PPE, emergency response, incident reporting.",
      targetGroup: "All employees",
      methodology: "Classroom",
      preTest: "Safety awareness pre-test",
      postTest: "Safety awareness post-test",
      evaluation: "Safety course evaluation",
      evaluationAfter30Day: "Supervisor confirms behavior after 30 days",
      lifeCycleMonth: "12",
      courseType: "ATA-TC",
      courseGroup: "Safety",
    },
    participants: "42",
    hours: "3",
    budget: "28500",
    trainer: "Safety Team",
    provider: "Safety Department",
    owner: "factory.hrd",
  },
  {
    id: "oap-003",
    course: {
      code: "CRS-041",
      name: "Quality Control Basics",
      objective: "Build basic quality control understanding for production teams.",
      learningContent: "Defect prevention, inspection points, quality records, escalation.",
      targetGroup: "Production / Quality / Operator",
      methodology: "Classroom + Case study",
      preTest: "Quality pre-test",
      postTest: "Quality post-test",
      evaluation: "Quality course evaluation",
      evaluationAfter30Day: "Quality issue follow-up after 30 days",
      lifeCycleMonth: "18",
      courseType: "PUBLIC",
      courseGroup: "Quality",
    },
    participants: "18",
    hours: "4",
    budget: "32000",
    trainer: "Quality Team",
    provider: "QA Department",
    owner: "quality.hrd",
  },
];

const initialRollingPlans: RollingPlan[] = [
  {
    ...oapSources[1],
    rollingId: "rolling-001",
    sequence: 1,
    batch: "1/2026",
    location: "Training Room A",
    trainingDate: "2026-07-08",
    startTime: "09:00",
    endTime: "12:00",
    company: "SNF",
    status: "Planned",
    updatedAt: "2026-07-01",
  },
  {
    ...oapSources[0],
    rollingId: "rolling-002",
    sequence: 2,
    batch: "2/2026",
    location: "HRD Center",
    trainingDate: "2026-08-15",
    startTime: "09:00",
    endTime: "16:00",
    company: "ATFB",
    status: "Planning",
    updatedAt: "2026-07-12",
  },
];

const emptyForm = {
  oapId: oapSources[0].id,
  batch: "",
  location: "",
  trainingDate: "",
  startTime: "09:00",
  endTime: "16:00",
  company: companies[0] as string,
};

const getJobStatus = (trainingDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${trainingDate}T00:00:00`);
  return target < today ? "Completed" : "Rolling";
};

export default function TrainingRolling() {
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>(initialRollingPlans);
  const [form, setForm] = useState(emptyForm);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedMonth, setSelectedMonth] = useState("07");

  const selectedOap = oapSources.find((source) => source.id === form.oapId) ?? oapSources[0];
  const selectedMonthLabel = monthOptions.find((month) => month.value === selectedMonth)?.label ?? "Selected month";
  const visiblePlans = useMemo(
    () =>
      [...rollingPlans]
        .sort((a, b) => a.trainingDate.localeCompare(b.trainingDate))
        .map((plan, index) => ({ ...plan, sequence: index + 1 }))
        .filter((plan) =>
          plan.trainingDate.startsWith(`${selectedYear}-${selectedMonth}`) &&
          [
            plan.course.name,
            plan.course.code,
            plan.batch,
            plan.location,
            plan.company,
            plan.status,
            getJobStatus(plan.trainingDate),
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
        ),
    [rollingPlans, search, selectedMonth, selectedYear],
  );

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    if (editingId) {
      setRollingPlans((current) =>
        current.map((plan) =>
          plan.rollingId === editingId
            ? {
                ...plan,
                ...selectedOap,
                batch: form.batch.trim() || "New batch",
                location: form.location.trim() || "Pending location",
                trainingDate: form.trainingDate || new Date().toISOString().slice(0, 10),
                startTime: form.startTime || "09:00",
                endTime: form.endTime || "16:00",
                company: form.company,
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : plan,
        ),
      );
      setEditingId("");
      setForm(emptyForm);
      setIsNewOpen(false);
      return;
    }

    const nextPlan: RollingPlan = {
      ...selectedOap,
      rollingId: `rolling-${Date.now()}`,
      sequence: rollingPlans.length + 1,
      batch: form.batch.trim() || "New batch",
      location: form.location.trim() || "Pending location",
      trainingDate: form.trainingDate || new Date().toISOString().slice(0, 10),
      startTime: form.startTime || "09:00",
      endTime: form.endTime || "16:00",
      company: form.company,
      status: "Planning",
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    setRollingPlans((current) => [nextPlan, ...current]);
    setForm(emptyForm);
    setIsNewOpen(false);
  };

  const handleEdit = (plan: RollingPlan) => {
    const matchedOap = oapSources.find((source) => source.course.code === plan.course.code);
    setEditingId(plan.rollingId);
    setForm({
      oapId: matchedOap?.id ?? oapSources[0].id,
      batch: plan.batch,
      location: plan.location,
      trainingDate: plan.trainingDate,
      startTime: plan.startTime,
      endTime: plan.endTime,
      company: plan.company,
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleDelete = (rollingId: string) => {
    setRollingPlans((current) => current.filter((plan) => plan.rollingId !== rollingId));
    if (openDetailId === rollingId) {
      setOpenDetailId("");
    }
    if (editingId === rollingId) {
      setEditingId("");
      setForm(emptyForm);
      setIsNewOpen(false);
    }
  };

  const handleRefresh = () => {
    setRollingPlans(initialRollingPlans);
    setForm(emptyForm);
    setIsNewOpen(false);
    setEditingId("");
    setOpenDetailId("");
    setSearch("");
    setSelectedYear("2026");
    setSelectedMonth("07");
  };

  return (
    <section className={styles.page} aria-label="Training Rolling monthly plan">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingRollingModule.subtitle}</p>
          <h2>{trainingRollingModule.title}</h2>
          <p>{trainingRollingModule.description}</p>
        </div>
        <div className={styles.metrics}>
          <div><span>Total</span><strong>{rollingPlans.length}</strong></div>
          <div><span>{selectedMonthLabel}</span><strong>{visiblePlans.length}</strong></div>
          <div><span>Rolling</span><strong>{visiblePlans.filter((plan) => getJobStatus(plan.trainingDate) === "Rolling").length}</strong></div>
        </div>
      </section>

      <section className={styles.workspace}>
        <section className={styles.monthPanel} aria-label="Monthly rolling plan filter">
          <div>
            <p className={styles.kicker}>Monthly view</p>
            <h3>{selectedMonthLabel} {selectedYear}</h3>
          </div>
          <div className={styles.monthControls}>
            <label>
              Year
              <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                {yearOptions.map((year) => <option key={year}>{year}</option>)}
              </select>
            </label>
            <label>
              Month
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        <div className={styles.toolbar}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search course, company, location, status" />
          <button className={styles.primaryButton} type="button" onClick={() => setIsNewOpen(true)}>New</button>
          <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>Refresh</button>
        </div>

        {isNewOpen ? (
          <section className={styles.formPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>New monthly plan</p>
                <h3>{editingId ? "Edit Training Rolling" : "Create Training Rolling"}</h3>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => setIsNewOpen(false)}>Close</button>
            </div>
            <div className={styles.formGrid}>
              <label>
                Course Name
                <select value={form.oapId} onChange={(event) => updateForm("oapId", event.target.value)}>
                  {oapSources.map((source) => <option key={source.id} value={source.id}>{source.course.name}</option>)}
                </select>
              </label>
              <label>Participants<input disabled value={selectedOap.participants} /></label>
              <label>Training Hours<input disabled value={selectedOap.hours} /></label>
              <label>Budget<input disabled value={Number(selectedOap.budget).toLocaleString("en-US")} /></label>
              <label>Trainer<input disabled value={selectedOap.trainer} /></label>
              <label>Institute / Provider<input disabled value={selectedOap.provider} /></label>
              <label>Batch<input value={form.batch} onChange={(event) => updateForm("batch", event.target.value)} /></label>
              <label>Location<input value={form.location} onChange={(event) => updateForm("location", event.target.value)} /></label>
              <label>Training Date<input type="date" value={form.trainingDate} onChange={(event) => updateForm("trainingDate", event.target.value)} /></label>
              <label>Start Time<input type="time" value={form.startTime} onChange={(event) => updateForm("startTime", event.target.value)} /></label>
              <label>End Time<input type="time" value={form.endTime} onChange={(event) => updateForm("endTime", event.target.value)} /></label>
              <label>
                Related Company
                <select value={form.company} onChange={(event) => updateForm("company", event.target.value)}>
                  {companies.map((company) => <option key={company}>{company}</option>)}
                </select>
              </label>
            </div>
            <div className={styles.coursePreview}>
              <strong>{selectedOap.course.code} / {selectedOap.course.name}</strong>
              <span>{selectedOap.course.objective}</span>
              <span>{selectedOap.course.courseType} / {selectedOap.course.courseGroup}</span>
            </div>
            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="button" onClick={handleSave}>{editingId ? "Save changes" : "Save rolling plan"}</button>
              <button className={styles.secondaryButton} type="button" onClick={() => { setEditingId(""); setForm(emptyForm); setIsNewOpen(false); }}>Cancel</button>
            </div>
          </section>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.rollingTable}>
            <thead>
              <tr>
                <th>Seq.</th>
                <th>Training Date</th>
                <th>Course Name</th>
                <th>Batch</th>
                <th>Company</th>
                <th>Status</th>
                <th>Job Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlans.map((plan) => {
                const isOpen = openDetailId === plan.rollingId;
                return (
                  <Fragment key={plan.rollingId}>
                    <tr>
                      <td>{plan.sequence}</td>
                      <td>{plan.trainingDate}</td>
                      <td><strong>{plan.course.name}</strong><span>{plan.course.code}</span></td>
                      <td>{plan.batch}</td>
                      <td>{plan.company}</td>
                      <td><span className={styles.statusPill}>{plan.status}</span></td>
                      <td><span className={styles.jobPill}>{getJobStatus(plan.trainingDate)}</span></td>
                      <td className={styles.actionCell}>
                        <button className={styles.detailButton} type="button" onClick={() => setOpenDetailId(isOpen ? "" : plan.rollingId)}>
                          {isOpen ? "Hide" : "Details"}
                        </button>
                        <button className={styles.detailButton} type="button" onClick={() => handleEdit(plan)}>Edit</button>
                        <button className={styles.dangerButton} type="button" onClick={() => handleDelete(plan.rollingId)}>Delete</button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detailRow}>
                        <td colSpan={8}>
                          <section className={styles.detailPanel}>
                            <div className={styles.panelHeader}>
                              <div>
                                <p className={styles.kicker}>Rolling detail</p>
                                <h3>{plan.course.name}</h3>
                              </div>
                              <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>Close</button>
                            </div>
                            <div className={styles.detailGrid}>
                              <div><span>Course Sequence</span><strong>{plan.sequence}</strong></div>
                              <div><span>Status</span><strong>{plan.status}</strong></div>
                              <div><span>Job Status</span><strong>{getJobStatus(plan.trainingDate)}</strong></div>
                              <div><span>Course Code</span><strong>{plan.course.code}</strong></div>
                              <div><span>Course Type</span><strong>{plan.course.courseType}</strong></div>
                              <div><span>Course Group</span><strong>{plan.course.courseGroup}</strong></div>
                              <div><span>Objective</span><p>{plan.course.objective}</p></div>
                              <div><span>Learning Content</span><p>{plan.course.learningContent}</p></div>
                              <div><span>Target Group</span><p>{plan.course.targetGroup}</p></div>
                              <div><span>Methodology</span><p>{plan.course.methodology}</p></div>
                              <div><span>Pre test</span><strong>{plan.course.preTest}</strong></div>
                              <div><span>Post test</span><strong>{plan.course.postTest}</strong></div>
                              <div><span>Evaluation</span><strong>{plan.course.evaluation}</strong></div>
                              <div><span>Evaluation After 30 Day</span><strong>{plan.course.evaluationAfter30Day}</strong></div>
                              <div><span>Life Cycle (Month)</span><strong>{plan.course.lifeCycleMonth}</strong></div>
                              <div><span>Batch</span><strong>{plan.batch}</strong></div>
                              <div><span>Budget</span><strong>{Number(plan.budget).toLocaleString("en-US")}</strong></div>
                              <div><span>Location</span><strong>{plan.location}</strong></div>
                              <div><span>Start Time</span><strong>{plan.startTime}</strong></div>
                              <div><span>End Time</span><strong>{plan.endTime}</strong></div>
                              <div><span>Related Company</span><strong>{plan.company}</strong></div>
                              <div><span>Participants</span><strong>{plan.participants}</strong></div>
                              <div><span>Training Hours</span><strong>{plan.hours}</strong></div>
                              <div><span>Trainer</span><strong>{plan.trainer}</strong></div>
                              <div><span>Provider</span><strong>{plan.provider}</strong></div>
                              <div><span>Owner</span><strong>{plan.owner}</strong></div>
                              <div><span>Last Updated</span><strong>{plan.updatedAt}</strong></div>
                            </div>
                          </section>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
