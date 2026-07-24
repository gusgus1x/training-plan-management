"use client";

import { Fragment, useMemo, useState } from "react";
import {
  TRAINING_WORKFLOW_KEYS,
  isWorkflowOwner,
  readWorkflowCollection,
  writeWorkflowCollection,
  type WorkflowOapPlan,
  type WorkflowOwner,
} from "../../../../lib/trainingWorkflow";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import styles from "./TrainingRolling.module.css";

export const trainingRollingModule = {
  title: "Training Rolling",
  subtitle: "Monthly training plan",
  description: "Convert annual OAP items into monthly rolling training schedules.",
} as const;

export type RollingStatus = "Planning" | "Planned";

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
  ownerScope?: WorkflowOwner;
  ownerCompany?: string;
};

export type RollingPlan = OapSource & {
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

const companies = ["All Companies", "ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;
export const monthOptions = [
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
export const yearOptions = ["2026", "2027"] as const;

const mockOapSources: OapSource[] = [
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

const legacyInitialRollingPlans: RollingPlan[] = [
  {
    ...mockOapSources[1],
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
    ...mockOapSources[0],
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

export const initialRollingPlans: RollingPlan[] = [];

const emptyForm = {
  oapId: "",
  batch: "",
  location: "",
  trainingDate: "",
  startTime: "09:00",
  endTime: "16:00",
  company: companies[0] as string,
};

export const getJobStatus = (trainingDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${trainingDate}T00:00:00`);
  return target < today ? "Completed" : "Rolling";
};

export default function TrainingRolling() {
  const user = useAuthenticatedUser();
  const userCompanyCode = profileValue(user?.companyCode);
  const [oapSources] = useState<OapSource[]>(() =>
    readWorkflowCollection<WorkflowOapPlan>(TRAINING_WORKFLOW_KEYS.oapPlans)
      .filter(
        (plan) =>
          plan.status === "Planned" &&
          isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode),
      )
      .map<OapSource>((plan) => ({
        id: plan.id,
        course: {
          code: plan.course.courseCode,
          name: plan.course.courseNameEn,
          objective: plan.course.objective,
          learningContent: plan.course.learningContent,
          targetGroup: plan.course.targetGroup,
          methodology: plan.course.methodology,
          preTest: plan.course.preTest,
          postTest: plan.course.postTest,
          evaluation: plan.course.evaluation,
          evaluationAfter30Day: plan.course.evaluationAfter30Day,
          lifeCycleMonth: plan.course.lifeCycleMonth,
          courseType: plan.course.courseType,
          courseGroup: plan.course.courseGroup,
        },
        participants: plan.participants,
        hours: plan.hours,
        budget: plan.budget,
        trainer: plan.trainer,
        provider: plan.provider,
        owner: plan.createdBy,
        ownerScope: plan.owner,
        ownerCompany: plan.ownerCompany,
      })),
  );
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>(() =>
    readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
  );
  const [form, setForm] = useState(emptyForm);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedMonth, setSelectedMonth] = useState("07");
  const [statusFilter, setStatusFilter] = useState<"all" | RollingStatus>("all");
  const selectedOap = oapSources.find((source) => source.id === form.oapId) ?? oapSources[0] ?? null;
  const scopedRollingPlans = useMemo(
    () =>
      rollingPlans.filter((plan) =>
        isWorkflowOwner(
          plan.ownerScope ?? (plan.owner === "admin.hrd" ? "CENTER" : "FACTORY"),
          plan.ownerCompany ?? plan.company,
          user?.roleCode,
          userCompanyCode,
        ),
      ),
    [rollingPlans, user?.roleCode, userCompanyCode],
  );
  const selectedMonthLabel = monthOptions.find((month) => month.value === selectedMonth)?.label ?? "Selected month";
  const visiblePlans = useMemo(
    () =>
      [...scopedRollingPlans]
        .sort((a, b) => a.trainingDate.localeCompare(b.trainingDate))
        .map((plan, index) => ({ ...plan, sequence: index + 1 }))
        .filter((plan) =>
          plan.trainingDate.startsWith(`${selectedYear}-${selectedMonth}`) &&
          (statusFilter === "all" || plan.status === statusFilter) &&
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
    [scopedRollingPlans, search, selectedMonth, selectedYear, statusFilter],
  );

  const saveRollingPlans = (nextPlans: RollingPlan[]) => {
    setRollingPlans(nextPlans);
    writeWorkflowCollection(TRAINING_WORKFLOW_KEYS.rollingPlans, nextPlans);
  };

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    if (!selectedOap) {
      return;
    }

    if (editingId) {
      saveRollingPlans(
        rollingPlans.map((plan) =>
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
      sequence: scopedRollingPlans.length + 1,
      batch: form.batch.trim() || "New batch",
      location: form.location.trim() || "Pending location",
      trainingDate: form.trainingDate || new Date().toISOString().slice(0, 10),
      startTime: form.startTime || "09:00",
      endTime: form.endTime || "16:00",
      company: form.company,
      status: "Planning",
      updatedAt: new Date().toISOString().slice(0, 10),
    };

    saveRollingPlans([nextPlan, ...rollingPlans]);
    setForm(emptyForm);
    setIsNewOpen(false);
  };

  const handleEdit = (plan: RollingPlan) => {
    const matchedOap = oapSources.find((source) => source.course.code === plan.course.code);
    setEditingId(plan.rollingId);
    setForm({
      oapId: matchedOap?.id ?? oapSources[0]?.id ?? "",
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
    saveRollingPlans(rollingPlans.filter((plan) => plan.rollingId !== rollingId));
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
    setRollingPlans(
      readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
    );
    setForm(emptyForm);
    setIsNewOpen(false);
    setEditingId("");
    setOpenDetailId("");
    setSearch("");
    setSelectedYear("2026");
    setSelectedMonth("07");
    setStatusFilter("all");
  };

  const handleNew = () => {
    setEditingId("");
    setForm({
      ...emptyForm,
      oapId: oapSources[0]?.id ?? "",
      company: user?.roleCode === "HRD_FACTORY" ? userCompanyCode : "All Companies",
    });
    setOpenDetailId("");
    setIsNewOpen(true);
  };

  const handleConfirm = (rollingId: string) => {
    saveRollingPlans(
      rollingPlans.map((plan) =>
        plan.rollingId === rollingId ? { ...plan, status: "Planned" } : plan,
      ),
    );
  };

  return (
    <section className={styles.page} aria-label="Training Rolling monthly plan">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingRollingModule.subtitle}</p>
          <h2>{trainingRollingModule.title}</h2>
          <p>{trainingRollingModule.description}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.workspaceHeader}>
          <div>
            <p className={styles.kicker}>Monthly view</p>
            <h3>{selectedMonthLabel} {selectedYear} rolling schedule</h3>
          </div>
          <span>{visiblePlans.length} shown</span>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.filterBox}>
            <span>Year</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {yearOptions.map((year) => <option key={year}>{year}</option>)}
            </select>
          </label>
          <label className={styles.filterBox}>
            <span>Month</span>
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
              {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
            </select>
          </label>
          <label className={styles.filterBox}>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | RollingStatus)}>
              <option value="all">All status</option>
              <option value="Planning">Planning</option>
              <option value="Planned">Planned</option>
            </select>
          </label>
          <label className={styles.searchBox}>
            <span>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Course, company, location, status" />
          </label>
          <div className={styles.toolbarActions}>
            <button
              className={styles.primaryButton}
              disabled={oapSources.length === 0}
              title={oapSources.length === 0 ? "Confirm a Training OAP before creating a rolling plan." : "Create monthly rolling plan"}
              type="button"
              onClick={handleNew}
            >
              New
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>Refresh</button>
          </div>
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
              <label className={styles.fullField}>
                Course Name
                <select value={form.oapId} onChange={(event) => updateForm("oapId", event.target.value)}>
                  {oapSources.map((source) => <option key={source.id} value={source.id}>{source.course.name}</option>)}
                </select>
              </label>
              <label>Participants<input disabled value={selectedOap?.participants ?? ""} /></label>
              <label>Training Hours<input disabled value={selectedOap?.hours ?? ""} /></label>
              <label>Budget<input disabled value={selectedOap ? Number(selectedOap.budget).toLocaleString("en-US") : ""} /></label>
              <label>Trainer<input disabled value={selectedOap?.trainer ?? ""} /></label>
              <label>Institute / Provider<input disabled value={selectedOap?.provider ?? ""} /></label>
              <label>Batch<input value={form.batch} onChange={(event) => updateForm("batch", event.target.value)} /></label>
              <label>Location<input value={form.location} onChange={(event) => updateForm("location", event.target.value)} /></label>
              <label>Training Date<input type="date" value={form.trainingDate} onChange={(event) => updateForm("trainingDate", event.target.value)} /></label>
              <label>Start Time<input type="time" value={form.startTime} onChange={(event) => updateForm("startTime", event.target.value)} /></label>
              <label>End Time<input type="time" value={form.endTime} onChange={(event) => updateForm("endTime", event.target.value)} /></label>
              <label>
                Related Company
                <select disabled={user?.roleCode === "HRD_FACTORY"} value={form.company} onChange={(event) => updateForm("company", event.target.value)}>
                  {(user?.roleCode === "HRD_FACTORY" ? [userCompanyCode] : companies).map((company) => <option key={company}>{company}</option>)}
                </select>
              </label>
            </div>
            {selectedOap ? (
              <div className={styles.coursePreview}>
                <strong>{selectedOap.course.code} / {selectedOap.course.name}</strong>
                <span>{selectedOap.course.objective}</span>
                <span>{selectedOap.course.courseType} / {selectedOap.course.courseGroup}</span>
              </div>
            ) : null}
            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="button" onClick={handleSave}>{editingId ? "Save changes" : "Save Draft"}</button>
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
                      <td><span className={`${styles.statusPill} ${styles[`status${plan.status}`]}`}>{plan.status}</span></td>
                      <td><span className={`${styles.jobPill} ${styles[`job${getJobStatus(plan.trainingDate)}`]}`}>{getJobStatus(plan.trainingDate)}</span></td>
                      <td className={styles.actionCell}>
                        <button className={styles.detailButton} type="button" onClick={() => setOpenDetailId(isOpen ? "" : plan.rollingId)}>
                          {isOpen ? "Hide" : "Details"}
                        </button>
                        <button className={styles.detailButton} type="button" onClick={() => handleEdit(plan)}>Edit</button>
                        <button
                          className={styles.primaryButton}
                          disabled={plan.status === "Planned"}
                          type="button"
                          onClick={() => handleConfirm(plan.rollingId)}
                        >
                          {plan.status === "Planned" ? "Published" : "Publish"}
                        </button>
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
                            <div className={styles.formActions}>
                              <button
                                className={styles.primaryButton}
                                disabled={plan.status === "Planned"}
                                type="button"
                                onClick={() => handleConfirm(plan.rollingId)}
                              >
                                {plan.status === "Planned"
                                  ? "Published to Registration & Accept Survey"
                                  : "Confirm & Send to Registration / Accept Survey"}
                              </button>
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
          {visiblePlans.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>{oapSources.length === 0 ? "No confirmed Training OAP" : "No rolling plans found"}</strong>
              <span>
                {oapSources.length === 0
                  ? "Open Training OAP and click Confirm on an annual plan before creating a monthly rolling plan."
                  : "Try changing the month, year, status, or search text."}
              </span>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
