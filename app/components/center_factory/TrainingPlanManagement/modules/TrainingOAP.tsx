"use client";

import { Fragment, useMemo, useState } from "react";
import styles from "./TrainingOAP.module.css";

export const trainingOapModule = {
  title: "Training OAP",
  subtitle: "Annual training plan",
  description: "Plan annual training courses, budget, trainer, provider, and target participants.",
} as const;

type CourseMasterDetail = {
  code: string;
  name: string;
  nameTh: string;
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

type OapStatus = "Planning" | "Planned" | "Cancel";

type OapPlan = {
  id: string;
  sequence: number;
  course: CourseMasterDetail;
  participants: string;
  hours: string;
  budget: string;
  trainer: string;
  provider: string;
  createdBy: string;
  status: OapStatus;
};

type TrainingOAPProps = {
  username?: string;
};

const courseMasterOptions: CourseMasterDetail[] = [
  {
    code: "CRS-001",
    name: "Leadership Essentials",
    nameTh: "Leadership TH",
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
  {
    code: "CRS-022",
    name: "Safety Basics",
    nameTh: "Safety TH",
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
  {
    code: "CRS-041",
    name: "Quality Control Basics",
    nameTh: "Quality TH",
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
];

const initialPlans: OapPlan[] = [
  {
    id: "oap-001",
    sequence: 1,
    course: courseMasterOptions[0],
    participants: "24",
    hours: "6",
    budget: "45000",
    trainer: "Somchai P.",
    provider: "HRD Center",
    createdBy: "admin.hrd",
    status: "Planned",
  },
  {
    id: "oap-002",
    sequence: 2,
    course: courseMasterOptions[1],
    participants: "42",
    hours: "3",
    budget: "28500",
    trainer: "Safety Team",
    provider: "Safety Department",
    createdBy: "factory.hrd",
    status: "Planning",
  },
];

const emptyForm = {
  courseCode: courseMasterOptions[0].code,
  participants: "",
  hours: "",
  budget: "",
  trainer: "",
  provider: "",
};

export default function TrainingOAP({ username = "Current user" }: TrainingOAPProps) {
  const [plans, setPlans] = useState<OapPlan[]>(initialPlans);
  const [form, setForm] = useState(emptyForm);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OapStatus>("all");

  const selectedCourse = courseMasterOptions.find((course) => course.code === form.courseCode) ?? courseMasterOptions[0];
  const visiblePlans = useMemo(
    () =>
      plans.filter((plan) =>
        [plan.course.code, plan.course.name, plan.status, plan.trainer, plan.provider]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
      .filter((plan) => statusFilter === "all" || plan.status === statusFilter),
    [plans, search, statusFilter],
  );

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    if (editingId) {
      setPlans((current) =>
        current.map((plan) =>
          plan.id === editingId
            ? {
                ...plan,
                course: selectedCourse,
                participants: form.participants.trim() || "0",
                hours: form.hours.trim() || "0",
                budget: form.budget.trim() || "0",
                trainer: form.trainer.trim() || "Pending trainer",
                provider: form.provider.trim() || "Pending provider",
              }
            : plan,
        ),
      );
      setEditingId("");
      setForm(emptyForm);
      setIsNewOpen(false);
      return;
    }

    const nextPlan: OapPlan = {
      id: `oap-${Date.now()}`,
      sequence: plans.length + 1,
      course: selectedCourse,
      participants: form.participants.trim() || "0",
      hours: form.hours.trim() || "0",
      budget: form.budget.trim() || "0",
      trainer: form.trainer.trim() || "Pending trainer",
      provider: form.provider.trim() || "Pending provider",
      createdBy: username,
      status: "Planning",
    };
    setPlans((current) => [nextPlan, ...current]);
    setForm(emptyForm);
    setIsNewOpen(false);
  };

  const handleEdit = (plan: OapPlan) => {
    setEditingId(plan.id);
    setForm({
      courseCode: plan.course.code,
      participants: plan.participants,
      hours: plan.hours,
      budget: plan.budget,
      trainer: plan.trainer,
      provider: plan.provider,
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleDelete = (planId: string) => {
    setPlans((current) => current.filter((plan) => plan.id !== planId));
    if (openDetailId === planId) {
      setOpenDetailId("");
    }
    if (editingId === planId) {
      setEditingId("");
      setForm(emptyForm);
      setIsNewOpen(false);
    }
  };

  const updateStatus = (planId: string, status: OapStatus) => {
    setPlans((current) => current.map((plan) => plan.id === planId ? { ...plan, status } : plan));
  };

  const handleRefresh = () => {
    setPlans(initialPlans);
    setForm(emptyForm);
    setIsNewOpen(false);
    setEditingId("");
    setOpenDetailId("");
    setSearch("");
    setStatusFilter("all");
  };

  const handleNew = () => {
    setEditingId("");
    setForm(emptyForm);
    setOpenDetailId("");
    setIsNewOpen(true);
  };

  return (
    <section className={styles.page} aria-label="Training OAP annual plan">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingOapModule.subtitle}</p>
          <h2>{trainingOapModule.title}</h2>
          <p>{trainingOapModule.description}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.workspaceHeader}>
          <div>
            <p className={styles.kicker}>Annual plan list</p>
            <h3>Training OAP records</h3>
          </div>
          <span>{visiblePlans.length} shown</span>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.searchBox}>
            <span>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Course, trainer, provider, status" />
          </label>
          <label className={styles.filterBox}>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | OapStatus)}>
              <option value="all">All status</option>
              <option value="Planning">Planning</option>
              <option value="Planned">Planned</option>
              <option value="Cancel">Cancel</option>
            </select>
          </label>
          <div className={styles.toolbarActions}>
            <button className={styles.primaryButton} type="button" onClick={handleNew}>New</button>
            <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>Refresh</button>
          </div>
        </div>

        {isNewOpen ? (
          <section className={styles.formPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>New annual plan</p>
                <h3>{editingId ? "Edit Training OAP" : "Create Training OAP"}</h3>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => setIsNewOpen(false)}>Close</button>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.fullField}>
                Course Name
                <select value={form.courseCode} onChange={(event) => updateForm("courseCode", event.target.value)}>
                  {courseMasterOptions.map((course) => <option key={course.code} value={course.code}>{course.name}</option>)}
                </select>
              </label>
              <label>Participants / Group<input value={form.participants} inputMode="numeric" onChange={(event) => updateForm("participants", event.target.value)} /></label>
              <label>Training Hours<input value={form.hours} inputMode="numeric" onChange={(event) => updateForm("hours", event.target.value)} /></label>
              <label>Budget<input value={form.budget} inputMode="numeric" onChange={(event) => updateForm("budget", event.target.value)} /></label>
              <label>Trainer Name<input value={form.trainer} onChange={(event) => updateForm("trainer", event.target.value)} /></label>
              <label>Institute / Provider<input value={form.provider} onChange={(event) => updateForm("provider", event.target.value)} /></label>
            </div>
            <div className={styles.coursePreview}>
              <strong>{selectedCourse.code} / {selectedCourse.name}</strong>
              <span>{selectedCourse.objective}</span>
              <span>{selectedCourse.courseType} / {selectedCourse.courseGroup}</span>
            </div>
            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="button" onClick={handleSave}>{editingId ? "Save changes" : "Save plan"}</button>
              <button className={styles.secondaryButton} type="button" onClick={() => { setEditingId(""); setForm(emptyForm); setIsNewOpen(false); }}>Cancel</button>
            </div>
          </section>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.planTable}>
            <thead>
              <tr>
                <th>Seq.</th>
                <th>Course Name</th>
                <th>Participants</th>
                <th>Hours</th>
                <th>Budget</th>
                <th>Trainer</th>
                <th>Provider</th>
                <th>Created By</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlans.map((plan) => {
                const isOpen = openDetailId === plan.id;
                return (
                  <Fragment key={plan.id}>
                    <tr>
                      <td>{plan.sequence}</td>
                      <td><strong>{plan.course.name}</strong><span>{plan.course.code}</span></td>
                      <td>{plan.participants}</td>
                      <td>{plan.hours}</td>
                      <td>{Number(plan.budget).toLocaleString("en-US")}</td>
                      <td>{plan.trainer}</td>
                      <td>{plan.provider}</td>
                      <td>{plan.createdBy}</td>
                      <td><span className={`${styles.statusPill} ${styles[`status${plan.status}`]}`}>{plan.status}</span></td>
                      <td className={styles.actionCell}>
                        <button className={styles.detailButton} type="button" onClick={() => setOpenDetailId(isOpen ? "" : plan.id)}>
                          {isOpen ? "Hide" : "Details"}
                        </button>
                        <button className={styles.detailButton} type="button" onClick={() => handleEdit(plan)}>Edit</button>
                        <button className={styles.dangerButton} type="button" onClick={() => handleDelete(plan.id)}>Delete</button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detailRow}>
                        <td colSpan={10}>
                          <section className={styles.detailPanel}>
                            <div className={styles.panelHeader}>
                              <div>
                                <p className={styles.kicker}>Course detail from Course Master</p>
                                <h3>{plan.course.name}</h3>
                              </div>
                              <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>Close</button>
                            </div>
                            <div className={styles.detailGrid}>
                              <div><span>Course Code</span><strong>{plan.course.code}</strong></div>
                              <div><span>Course Name (TH)</span><strong>{plan.course.nameTh}</strong></div>
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
                              <div><span>Participants / Group</span><strong>{plan.participants}</strong></div>
                              <div><span>Training Hours</span><strong>{plan.hours}</strong></div>
                              <div><span>Budget</span><strong>{Number(plan.budget).toLocaleString("en-US")}</strong></div>
                              <div><span>Trainer</span><strong>{plan.trainer}</strong></div>
                              <div><span>Provider</span><strong>{plan.provider}</strong></div>
                              <div><span>Created By</span><strong>{plan.createdBy}</strong></div>
                            </div>
                            <div className={styles.formActions}>
                              <button className={styles.primaryButton} disabled={plan.status !== "Planning"} type="button" onClick={() => updateStatus(plan.id, "Planned")}>Confirm</button>
                              <button className={styles.dangerButton} disabled={plan.status === "Cancel"} type="button" onClick={() => updateStatus(plan.id, "Cancel")}>Cancel Plan</button>
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
              <strong>No training plans found</strong>
              <span>Try changing the search text or status filter.</span>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
