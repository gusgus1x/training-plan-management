"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  APPROVED_TRAINING_NEED_STORAGE_KEY,
  type EmployeeTrainingNeedRequest,
} from "../../../../lib/trainingRequests";
import {
  TRAINING_WORKFLOW_KEYS,
  isWorkflowOwner,
  readWorkflowCollection,
  writeWorkflowCollection,
  type WorkflowCourse,
  type WorkflowOapPlan,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import styles from "./TrainingOAP.module.css";

export const trainingOapModule = {
  title: "Training OAP",
  subtitle: "Annual training plan",
  description: "Plan annual training courses, budget, trainer, provider, and target participants.",
} as const;

type OapStatus = "Planning" | "Planned" | "Cancel";

type OapPlan = WorkflowOapPlan;

type TrainingOAPProps = {
  username?: string;
};

const emptyForm = {
  courseCode: "",
  participants: "",
  hours: "",
  budget: "",
  trainer: "",
  provider: "",
};

const readApprovedTrainingNeed = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
    return storedValue ? (JSON.parse(storedValue) as EmployeeTrainingNeedRequest) : null;
  } catch {
    return null;
  }
};

const buildRequestCourse = (request: EmployeeTrainingNeedRequest): WorkflowCourse => ({
  id: `request-${request.id}`,
  courseCode: `REQ-${request.requestNo}`,
  courseNameEn: request.courseNeed,
  courseNameTh: request.courseNeed,
  objective: request.reason,
  learningContent: request.expectedBenefit,
  targetGroup: `${request.employeeName} / ${request.company} / ${request.functionName}`,
  methodology: "To be defined by HRD",
  preTest: "To be defined",
  postTest: "To be defined",
  evaluation: "Course evaluation",
  evaluationAfter30Day: "HRD follow-up after training",
  lifeCycleMonth: "12",
  courseType: request.sourceCourseOwner === "Factory" ? "FACTORY REQUEST" : "CENTER REQUEST",
  courseGroup: "Training Need",
  remark: "Created from an approved employee training need.",
  status: "Active",
  updatedAt: new Date().toISOString().slice(0, 10),
  owner: request.sourceCourseOwner === "Factory" ? "FACTORY" : "CENTER",
  ownerCompany: request.sourceCourseOwner === "Factory" ? request.company : "HRD Center",
  createdBy: request.employeeName,
});

export default function TrainingOAP({ username = "Current user" }: TrainingOAPProps) {
  const user = useAuthenticatedUser();
  const [courses, setCourses] = useState<WorkflowCourse[]>(() =>
    readWorkflowCollection<WorkflowCourse>(TRAINING_WORKFLOW_KEYS.courses),
  );
  const [standards, setStandards] = useState<WorkflowStandard[]>(() =>
    readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards),
  );
  const [plans, setPlans] = useState<OapPlan[]>(() =>
    readWorkflowCollection<OapPlan>(TRAINING_WORKFLOW_KEYS.oapPlans),
  );
  const [form, setForm] = useState(emptyForm);
  const [approvedRequest, setApprovedRequest] = useState<EmployeeTrainingNeedRequest | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OapStatus>("all");
  const userCompanyCode = profileValue(user?.companyCode);

  useEffect(() => {
    const syncApprovedRequest = () => {
      const request = readApprovedTrainingNeed();

      if (!request) {
        return;
      }

      setApprovedRequest(request);
      setForm({
        courseCode: `REQ-${request.requestNo}`,
        participants: "1",
        hours: "",
        budget: "",
        trainer: "",
        provider: request.sourceCourseOwner === "Factory" ? request.company : "HRD Center",
      });
      setEditingId("");
      setOpenDetailId("");
      setIsNewOpen(true);
    };

    syncApprovedRequest();
    window.addEventListener("approved-training-need-changed", syncApprovedRequest);

    return () => {
      window.removeEventListener("approved-training-need-changed", syncApprovedRequest);
    };
  }, []);

  const standardCourseIds = useMemo(
    () =>
      new Set(
        standards
          .filter((standard) =>
            isWorkflowOwner(
              standard.owner,
              standard.ownerCompany,
              user?.roleCode,
              userCompanyCode,
            ),
          )
          .map((standard) => standard.courseId),
      ),
    [standards, user?.roleCode, userCompanyCode],
  );
  const courseOptions = useMemo(
    () => {
      const standardizedCourses = courses.filter(
        (course) =>
          course.status === "Active" &&
          standardCourseIds.has(course.id) &&
          isWorkflowOwner(course.owner, course.ownerCompany, user?.roleCode, userCompanyCode),
      );
      return approvedRequest
        ? [buildRequestCourse(approvedRequest), ...standardizedCourses]
        : standardizedCourses;
    },
    [approvedRequest, courses, standardCourseIds, user?.roleCode, userCompanyCode],
  );
  const selectedCourse =
    courseOptions.find((course) => course.courseCode === form.courseCode) ??
    courseOptions[0] ??
    null;
  const scopedPlans = useMemo(
    () =>
      plans.filter((plan) =>
        isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode),
      ),
    [plans, user?.roleCode, userCompanyCode],
  );
  const visiblePlans = useMemo(
    () =>
      scopedPlans.filter((plan) =>
        [plan.course.courseCode, plan.course.courseNameEn, plan.status, plan.trainer, plan.provider]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
      .filter((plan) => statusFilter === "all" || plan.status === statusFilter),
    [scopedPlans, search, statusFilter],
  );

  const savePlans = (nextPlans: OapPlan[]) => {
    setPlans(nextPlans);
    writeWorkflowCollection(TRAINING_WORKFLOW_KEYS.oapPlans, nextPlans);
  };

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    if (!selectedCourse) {
      return;
    }

    if (editingId) {
      savePlans(
        plans.map((plan) =>
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
      setApprovedRequest(null);
      window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
      setIsNewOpen(false);
      return;
    }

    const nextPlan: OapPlan = {
      id: `oap-${Date.now()}`,
      sequence: scopedPlans.length + 1,
      course: selectedCourse,
      participants: form.participants.trim() || "0",
      hours: form.hours.trim() || "0",
      budget: form.budget.trim() || "0",
      trainer: form.trainer.trim() || "Pending trainer",
      provider: form.provider.trim() || "Pending provider",
      createdBy: username,
      status: "Planning",
      owner: selectedCourse.owner,
      ownerCompany: selectedCourse.ownerCompany,
    };
    savePlans([nextPlan, ...plans]);
    setForm(emptyForm);
    setApprovedRequest(null);
    window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
    setIsNewOpen(false);
  };

  const handleEdit = (plan: OapPlan) => {
    setEditingId(plan.id);
    setForm({
      courseCode: plan.course.courseCode,
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
    savePlans(plans.filter((plan) => plan.id !== planId));
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
    savePlans(plans.map((plan) => plan.id === planId ? { ...plan, status } : plan));
  };

  const handleRefresh = () => {
    setCourses(readWorkflowCollection<WorkflowCourse>(TRAINING_WORKFLOW_KEYS.courses));
    setStandards(
      readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards),
    );
    setPlans(readWorkflowCollection<OapPlan>(TRAINING_WORKFLOW_KEYS.oapPlans));
    setForm(emptyForm);
    setApprovedRequest(null);
    window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
    setIsNewOpen(false);
    setEditingId("");
    setOpenDetailId("");
    setSearch("");
    setStatusFilter("all");
  };

  const handleNew = () => {
    setEditingId("");
    setForm({
      ...emptyForm,
      courseCode: courseOptions[0]?.courseCode ?? "",
    });
    setApprovedRequest(null);
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
            <button className={styles.primaryButton} disabled={courseOptions.length === 0} type="button" onClick={handleNew}>New</button>
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
            {approvedRequest ? (
              <div className={styles.approvedRequestBanner}>
                <span>Approved training need</span>
                <strong>{approvedRequest.courseNeed}</strong>
                <p>
                  From {approvedRequest.employeeName} / {approvedRequest.company} /{" "}
                  {approvedRequest.sourceCourseOwner ?? "Center"} course
                </p>
              </div>
            ) : null}
            <div className={styles.formGrid}>
              <label className={styles.fullField}>
                Course Name
                <select value={form.courseCode} onChange={(event) => updateForm("courseCode", event.target.value)}>
                  {courseOptions.map((course) => <option key={course.courseCode} value={course.courseCode}>{course.courseNameEn}</option>)}
                </select>
              </label>
              <label>Participants / Group<input value={form.participants} inputMode="numeric" onChange={(event) => updateForm("participants", event.target.value)} /></label>
              <label>Training Hours<input value={form.hours} inputMode="numeric" onChange={(event) => updateForm("hours", event.target.value)} /></label>
              <label>Budget<input value={form.budget} inputMode="numeric" onChange={(event) => updateForm("budget", event.target.value)} /></label>
              <label>Trainer Name<input value={form.trainer} onChange={(event) => updateForm("trainer", event.target.value)} /></label>
              <label>Institute / Provider<input value={form.provider} onChange={(event) => updateForm("provider", event.target.value)} /></label>
            </div>
            {selectedCourse ? (
              <div className={styles.coursePreview}>
                <strong>{selectedCourse.courseCode} / {selectedCourse.courseNameEn}</strong>
                <span>{selectedCourse.objective}</span>
                <span>{selectedCourse.courseType} / {selectedCourse.courseGroup}</span>
              </div>
            ) : null}
            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="button" onClick={handleSave}>{editingId ? "Save changes" : "Save Draft"}</button>
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
                      <td><strong>{plan.course.courseNameEn}</strong><span>{plan.course.courseCode}</span></td>
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
                        <button
                          className={styles.primaryButton}
                          disabled={plan.status !== "Planning"}
                          type="button"
                          onClick={() => updateStatus(plan.id, "Planned")}
                        >
                          {plan.status === "Planned"
                            ? "Confirmed"
                            : plan.status === "Cancel"
                              ? "Cancelled"
                              : "Confirm"}
                        </button>
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
                                <h3>{plan.course.courseNameEn}</h3>
                              </div>
                              <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>Close</button>
                            </div>
                            <div className={styles.detailGrid}>
                              <div><span>Course Code</span><strong>{plan.course.courseCode}</strong></div>
                              <div><span>Course Name (TH)</span><strong>{plan.course.courseNameTh}</strong></div>
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
