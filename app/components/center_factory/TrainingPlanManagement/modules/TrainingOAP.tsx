"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  APPROVED_TRAINING_NEED_STORAGE_KEY,
  type EmployeeTrainingNeedRequest,
} from "../../../../lib/trainingRequests";
import {
  getCourseDisplayName,
  getCourseSecondaryName,
  isWorkflowOwner,
  type WorkflowCourse,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { getCourseOutlineFileName } from "../../../../lib/courseOutlineExport";
import { listInstructors } from "../../../../lib/instructors/client";
import type { InstructorRecord } from "../../../../lib/instructors/types";
import { listCourses } from "../../../../lib/courses/client";
import { listOapPlans, createOapPlan, updateOapPlan, deleteOapPlan } from "../../../../lib/trainingOap/client";
import type { OapPlanRecord } from "../../../../lib/trainingOap/types";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import styles from "./TrainingOAP.module.css";

export const trainingOapModule = {
  title: "Training OAP",
  subtitle: "Annual training plan",
  description: "Plan annual training courses, budget, trainer, provider, and target participants.",
} as const;

type OapStatus = "Planning" | "Planned" | "Cancel";

type OapPlan = OapPlanRecord;

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
  const [courses, setCourses] = useState<WorkflowCourse[]>([]);
  const [standards, setStandards] = useState<WorkflowStandard[]>([]);
  const [plans, setPlans] = useState<OapPlan[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [approvedRequest, setApprovedRequest] = useState<EmployeeTrainingNeedRequest | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [exportingPlanId, setExportingPlanId] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OapStatus>("all");
  const [instructors, setInstructors] = useState<InstructorRecord[]>([]);
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

  useEffect(() => {
    let current = true;
    listInstructors({ status: "ACTIVE" })
      .then((result) => {
        if (current) setInstructors(result.items);
      })
      .catch(() => {
        if (current) setInstructors([]);
      });
    return () => {
      current = false;
    };
  }, []);

  const loadWorkspace = async () => {
    try {
      const [courseData, oapData] = await Promise.all([
        listCourses({ search: "", status: null }),
        listOapPlans({ search: null, status: null }),
      ]);
      setCourses(courseData.courses || []);
      setStandards(courseData.standards || []);
      setPlans(oapData.oapPlans || []);
    } catch (error) {
      console.error("Failed to load Training OAP workspace", error);
      setCourses([]);
      setStandards([]);
      setPlans([]);
    }
  };

  useEffect(() => {
    void loadWorkspace();
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
    courseOptions.find((course) => course.courseCode === form.courseCode) ?? null;
  const selectedCourseStandard = useMemo(() => {
    if (!selectedCourse) {
      return null;
    }
    return (
      standards.find(
        (item) =>
          item.courseId === selectedCourse.id ||
          item.courseCode === selectedCourse.courseCode,
      ) ?? null
    );
  }, [selectedCourse, standards]);
  const scopedPlans = useMemo(
    () =>
      plans.filter((plan) =>
        isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode),
      ),
    [plans, user?.roleCode, userCompanyCode],
  );

  const visiblePlans = useMemo(
    () =>
      scopedPlans
        .filter((plan) =>
          [
            plan.course.courseCode,
            plan.course.courseNameTh,
            plan.course.courseNameEn,
            plan.status,
            plan.trainer,
            plan.provider,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .filter((plan) => statusFilter === "all" || plan.status === statusFilter),
    [scopedPlans, search, statusFilter],
  );
  const selectedPlan =
    visiblePlans.find((plan) => plan.id === selectedPlanId) ?? null;

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resolveInstructorId = (trainerName: string) => {
    const trimmed = trainerName.trim();
    const matched = instructors.find(
      (instructor) => `${instructor.firstName} ${instructor.lastName}`.trim() === trimmed,
    );
    return matched?.instructorId ?? null;
  };

  const handleSave = async () => {
    if (!selectedCourse) {
      return;
    }

    const input = {
      courseId: selectedCourse.id,
      participants: Number(form.participants) || 0,
      hours: Number(form.hours) || 0,
      budget: form.budget.trim() || "0",
      trainerName: form.trainer.trim(),
      instructorId: resolveInstructorId(form.trainer),
      providerName: form.provider.trim(),
    };

    try {
      if (editingId) {
        await updateOapPlan(editingId, input);
      } else {
        await createOapPlan({ ...input, planYear: new Date().getFullYear(), status: "Planning" });
      }
      setEditingId("");
      setForm(emptyForm);
      setApprovedRequest(null);
      window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
      setIsNewOpen(false);
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to save Training OAP plan", error);
      alert("Failed to save Training OAP plan");
    }
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

  const handleDelete = async (planId: string) => {
    try {
      await deleteOapPlan(planId);
      if (selectedPlanId === planId) {
        setSelectedPlanId("");
      }
      if (openDetailId === planId) {
        setOpenDetailId("");
      }
      if (editingId === planId) {
        setEditingId("");
        setForm(emptyForm);
        setIsNewOpen(false);
      }
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to delete Training OAP plan", error);
      alert("Failed to delete Training OAP plan");
    }
  };

  const updateStatus = async (planId: string, status: OapStatus) => {
    try {
      await updateOapPlan(planId, { status });
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to update Training OAP plan status", error);
      alert("Failed to update Training OAP plan status");
    }
  };

  const handleExportOutline = async (plan: OapPlan) => {
    const standard =
      standards.find(
        (item) =>
          item.courseId === plan.course.id ||
          item.courseCode === plan.course.courseCode,
      ) ?? null;
    setExportingPlanId(plan.id);
    setExportMessage("");

    try {
      const response = await fetch("/api/course-master/course-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course: plan.course, standard, oapPlan: plan }),
      });
      const errorPayload = response.ok
        ? null
        : ((await response.json().catch(() => null)) as { error?: string } | null);
      if (!response.ok) {
        throw new Error(errorPayload?.error || "Unable to create Course Outline.");
      }

      const file = await response.blob();
      const downloadUrl = URL.createObjectURL(file);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = getCourseOutlineFileName(plan.course);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      setExportMessage(`Exported Course Outline: ${plan.course.courseCode}`);
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : "Unable to export Course Outline.",
      );
    } finally {
      setExportingPlanId("");
    }
  };

  const handleRefresh = async () => {
    await loadWorkspace();
    setForm(emptyForm);
    setApprovedRequest(null);
    window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
    setIsNewOpen(false);
    setEditingId("");
    setOpenDetailId("");
    setSelectedPlanId("");
    setExportMessage("");
    setSearch("");
    setStatusFilter("all");
  };

  const handleNew = () => {
    setEditingId("");
    setForm(emptyForm);
    setApprovedRequest(null);
    setOpenDetailId("");
    setSelectedPlanId("");
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
            <button className={styles.secondaryButton} disabled={!selectedPlan} type="button" onClick={() => selectedPlan && handleEdit(selectedPlan)}>Edit</button>
            <button className={styles.dangerButton} disabled={!selectedPlan} type="button" onClick={() => selectedPlan && void handleDelete(selectedPlan.id)}>Delete</button>
            <button
              className={styles.secondaryButton}
              disabled={!selectedPlan || Boolean(exportingPlanId)}
              type="button"
              onClick={() => selectedPlan && void handleExportOutline(selectedPlan)}
            >
              {exportingPlanId ? "Preparing..." : "Export Outline"}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>Refresh</button>
          </div>
        </div>

        <p className={styles.selectionHint} aria-live="polite">
          {selectedPlan
            ? `Selected: ${selectedPlan.course.courseCode} / ${getCourseDisplayName(selectedPlan.course)}`
            : "Select a row using the circle under Seq. to Edit, Delete, or Export Outline."}
        </p>

        {exportMessage ? (
          <p className={styles.exportStatus} role="status">
            {exportMessage}
          </p>
        ) : null}

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
                <span>Course Name <span className={styles.required}>*</span></span>
                <select value={form.courseCode} onChange={(event) => updateForm("courseCode", event.target.value)}>
                  <option value="">Select course first</option>
                  {courseOptions.map((course) => {
                    const secondaryName = getCourseSecondaryName(course);
                    const displayName = getCourseDisplayName(course);
                    const groupOrType = course.courseGroup || course.courseType;
                    return (
                      <option key={course.courseCode} value={course.courseCode}>
                        [{course.courseCode}] {displayName}
                        {secondaryName ? ` (${secondaryName})` : ""}
                        {groupOrType ? ` • ${groupOrType}` : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                <span>Participants / Group <span className={styles.required}>*</span></span>
                <input
                  disabled={!selectedCourse}
                  inputMode="numeric"
                  placeholder="Enter participants per group, e.g. 20"
                  value={form.participants}
                  onChange={(event) => updateForm("participants", event.target.value)}
                />
              </label>
              <label>
                <span>Training Hours <span className={styles.required}>*</span></span>
                <input
                  disabled={!selectedCourse}
                  inputMode="numeric"
                  placeholder="Enter total training hours, e.g. 6"
                  value={form.hours}
                  onChange={(event) => updateForm("hours", event.target.value)}
                />
              </label>
              <label>
                <span>Budget <span className={styles.required}>*</span></span>
                <input
                  disabled={!selectedCourse}
                  inputMode="numeric"
                  placeholder="Enter budget amount, e.g. 15000"
                  value={form.budget}
                  onChange={(event) => updateForm("budget", event.target.value)}
                />
              </label>
              <label>
                Trainer Name
                <input
                  list="instructor-master-options"
                  disabled={!selectedCourse}
                  value={form.trainer}
                  onChange={(event) => updateForm("trainer", event.target.value)}
                  placeholder="Select from Instructor Master or enter another name"
                />
                <datalist id="instructor-master-options">
                  {instructors.map((instructor) => {
                    const fullName = `${instructor.firstName} ${instructor.lastName}`.trim();
                    return <option key={instructor.instructorId} value={fullName}>{instructor.education}</option>;
                  })}
                </datalist>
              </label>
              <label>
                Institute / Provider
                <input
                  disabled={!selectedCourse}
                  placeholder="Enter provider, e.g. HRD Center or institute name"
                  value={form.provider}
                  onChange={(event) => updateForm("provider", event.target.value)}
                />
              </label>
            </div>
            {selectedCourse ? (
              <div className={styles.coursePreview}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitleWrap}>
                    <div className={styles.previewTitleMain}>
                      <span className={styles.previewCodeBadge}>{selectedCourse.courseCode}</span>
                      <strong>{getCourseDisplayName(selectedCourse)}</strong>
                    </div>
                    {getCourseSecondaryName(selectedCourse) ? (
                      <span className={styles.previewTitleSecondary}>{getCourseSecondaryName(selectedCourse)}</span>
                    ) : null}
                  </div>
                  <div className={styles.previewBadges}>
                    {selectedCourse.courseType ? (
                      <span className={`${styles.previewBadge} ${styles.previewBadgeHighlight}`}>
                        🏷️ {selectedCourse.courseType}
                      </span>
                    ) : null}
                    {selectedCourse.courseGroup ? (
                      <span className={styles.previewBadge}>
                        📂 {selectedCourse.courseGroup}
                      </span>
                    ) : null}
                    <span className={styles.previewBadge}>
                      ⏱️ {selectedCourse.lifeCycleMonth || "12"} Months
                    </span>
                    <span className={styles.previewBadge}>
                      🏢 {selectedCourse.ownerCompany || selectedCourse.owner}
                    </span>
                  </div>
                </div>

                <div className={styles.previewSections}>
                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>🎯 Objectives & Content</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Objective</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.objective || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Learning Content</span>
                      <span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>
                        {selectedCourse.learningContent || "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Methodology</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.methodology || "-"}</span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>👥 Target & Standard Mapping</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Target Group</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.targetGroup || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Function</span>
                      <span className={styles.previewFieldValue}>
                        {selectedCourseStandard?.functionName
                          ? `${selectedCourseStandard.functionName} (${selectedCourseStandard.functionCode || "N/A"})`
                          : "General / All Functions"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Positions</span>
                      <span className={styles.previewFieldValue}>
                        {selectedCourseStandard?.positions?.length
                          ? selectedCourseStandard.positions.join(", ")
                          : "All positions in function"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Levels</span>
                      <span className={styles.previewFieldValue}>
                        {selectedCourseStandard?.levels?.length
                          ? selectedCourseStandard.levels.join(", ")
                          : "All levels"}
                      </span>
                    </div>
                  </div>

                  <div className={`${styles.previewCard} ${styles.previewCardFull}`}>
                    <div className={styles.previewCardHeader}>
                      <span>📋 Assessments & Evaluation</span>
                    </div>
                    <div className={styles.assessmentGrid}>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Pre-Test</span>
                        <strong className={styles.previewFieldValue}>{selectedCourse.preTest || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Post-Test</span>
                        <strong className={styles.previewFieldValue}>{selectedCourse.postTest || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Course Evaluation</span>
                        <strong className={styles.previewFieldValue}>{selectedCourse.evaluation || "Standard"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>30-Day Follow-Up</span>
                        <strong className={styles.previewFieldValue}>{selectedCourse.evaluationAfter30Day || "Standard"}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={styles.formActions}>
              <button className={styles.primaryButton} disabled={!selectedCourse} type="button" onClick={handleSave}>{editingId ? "Save changes" : "Save Draft"}</button>
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
                <th>Status</th>
                <th>Actions</th>
                <th>Participants</th>
                <th>Hours</th>
                <th>Budget</th>
                <th>Trainer</th>
                <th>Provider</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlans.map((plan) => {
                const isOpen = openDetailId === plan.id;
                return (
                  <Fragment key={plan.id}>
                    <tr className={plan.id === selectedPlanId ? styles.selectedRow : undefined}>
                      <td>
                        <label className={styles.selectionControl}>
                          <input
                            aria-label={`Select ${plan.course.courseCode}`}
                            checked={plan.id === selectedPlanId}
                            name="selected-oap-plan"
                            type="radio"
                            onChange={() => setSelectedPlanId(plan.id)}
                          />
                          <span>{plan.sequence}</span>
                        </label>
                      </td>
                      <td>
                        <strong>{getCourseDisplayName(plan.course)}</strong>
                        <span>
                          {plan.course.courseCode}
                          {getCourseSecondaryName(plan.course)
                            ? ` / ${getCourseSecondaryName(plan.course)}`
                            : ""}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusPill} ${styles[`status${plan.status}`]}`}>
                          <span className={styles.statusDot} />
                          {plan.status === "Planned" ? "วางแผนแล้ว" : plan.status === "Planning" ? "รอวางแผน" : plan.status === "Cancel" ? "ยกเลิก" : plan.status}
                        </span>
                      </td>
                      <td className={styles.actionCell}>
                        <div className={styles.actionButtons}>
                          <button
                            aria-expanded={isOpen}
                            className={`${styles.rowActionButton} ${styles.detailsAction}`}
                            type="button"
                            onClick={() => {
                              setSelectedPlanId(plan.id);
                              setOpenDetailId(isOpen ? "" : plan.id);
                            }}
                          >
                            {isOpen ? "Hide" : "Details"}
                          </button>
                          {plan.status === "Planning" ? (
                            <button
                              className={`${styles.rowActionButton} ${styles.confirmAction}`}
                              type="button"
                              onClick={() => {
                                setSelectedPlanId(plan.id);
                                void updateStatus(plan.id, "Planned");
                              }}
                            >
                              Confirm
                            </button>
                          ) : (
                            <span
                              className={`${styles.rowActionState} ${
                                plan.status === "Planned"
                                  ? styles.confirmedAction
                                  : styles.cancelledAction
                              }`}
                            >
                              {plan.status === "Planned" ? "Confirmed" : "Cancelled"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{plan.participants}</td>
                      <td>{plan.hours}</td>
                      <td>{Number(plan.budget).toLocaleString("en-US")}</td>
                      <td>{plan.trainer}</td>
                      <td>{plan.provider}</td>
                      <td>{plan.createdBy}</td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detailRow}>
                        <td colSpan={10}>
                          <section className={styles.detailPanel}>
                            <div className={styles.panelHeader}>
                              <div>
                                <p className={styles.kicker}>Course detail from Course Master</p>
                                <h3>{getCourseDisplayName(plan.course)}</h3>
                              </div>
                              <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>Close</button>
                            </div>
                            <div className={styles.detailGrid}>
                              <div><span>Course Code</span><strong>{plan.course.courseCode}</strong></div>
                              <div><span>Course Name (TH)</span><strong>{plan.course.courseNameTh}</strong></div>
                              <div><span>Course Name (EN)</span><strong>{plan.course.courseNameEn}</strong></div>
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
                              <button className={styles.primaryButton} disabled={plan.status !== "Planning"} type="button" onClick={() => void updateStatus(plan.id, "Planned")}>Confirm</button>
                              <button className={styles.dangerButton} disabled={plan.status === "Cancel"} type="button" onClick={() => void updateStatus(plan.id, "Cancel")}>Cancel Plan</button>
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
