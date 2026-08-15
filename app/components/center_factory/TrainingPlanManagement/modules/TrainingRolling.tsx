"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  getCourseDisplayName,
  isWorkflowOwner,
  type WorkflowCourse,
  type WorkflowOwner,
} from "../../../../lib/trainingWorkflow";
import { listOapPlans } from "../../../../lib/trainingOap/client";
import type { OapPlanRecord } from "../../../../lib/trainingOap/types";
import {
  createRollingPlan,
  deleteRollingPlan,
  listRollingPlans,
  updateRollingPlan,
} from "../../../../lib/trainingRolling/client";
import type { RollingPlanRecord } from "../../../../lib/trainingRolling/types";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import styles from "./TrainingRolling.module.css";

export const trainingRollingModule = {
  title: "Training Rolling",
  subtitle: "Monthly training plan",
  description: "Convert annual OAP items into monthly rolling training schedules.",
} as const;

export type RollingStatus = "Planning" | "Planned";

// Matches the bespoke course-detail shape every other rolling-plan consumer
// (TrainingAcceptSurvey, TrainingActual, TrainingRecord, ScheduleCalendar,
// SummaryDashboard, RegisterTrainingModule, UserDashboard, trainingFinanceSummary)
// already reads via plan.course.code / plan.course.name, kept separate from
// WorkflowCourse so those files don't need touching.
export type RollingCourseDetail = {
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

// Kept structurally identical to the legacy WorkflowRollingPlan shape (see
// app/lib/trainingWorkflow.ts) so every other module that already reads a rolling
// plan's fields (TrainingAcceptSurvey, TrainingActual, TrainingRecord, ScheduleCalendar,
// SummaryDashboard, RegisterTrainingModule, UserDashboard, trainingFinanceSummary) keeps
// working unchanged; only the data source underneath (real API instead of localStorage)
// and the write path (New form) changed.
export type RollingPlan = {
  // Alias of oapId, kept only because a few legacy call sites build a fallback
  // group key off plan.id from the pre-unification OapSource & {...} type.
  id: string;
  rollingId: string;
  scheduleGroupId: string;
  oapId: string;
  sequence: number;
  course: RollingCourseDetail;
  participants: string;
  hours: string;
  budget: string;
  trainer: string;
  provider: string;
  ownerName: string;
  owner: WorkflowOwner;
  // Duplicate of owner; a few legacy call sites still read ownerScope from
  // before owner/ownerCompany were unified with WorkflowRollingPlan's convention.
  ownerScope: WorkflowOwner;
  ownerCompany: string;
  batchNo: number;
  batch: string;
  location: string;
  trainingDate: string;
  startTime: string;
  endTime: string;
  company: string;
  relatedCompanies: string[];
  status: RollingStatus;
  updatedAt: string;
};

const rollingCompanyOptions = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

export const getRollingPlanCompanies = (plan: RollingPlan): string[] => {
  if (plan.relatedCompanies.length) {
    return plan.relatedCompanies;
  }

  return plan.company === "All Companies"
    ? [...rollingCompanyOptions]
    : [plan.company];
};

export const formatRollingPlanCompanies = (plan: RollingPlan): string => {
  const selectedCompanies = getRollingPlanCompanies(plan);

  return selectedCompanies.length === rollingCompanyOptions.length
    ? "All Companies"
    : selectedCompanies.join(", ");
};

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

const mapCourseDetail = (course: WorkflowCourse): RollingCourseDetail => ({
  code: course.courseCode,
  name: getCourseDisplayName(course),
  objective: course.objective,
  learningContent: course.learningContent,
  targetGroup: course.targetGroup,
  methodology: course.methodology,
  preTest: course.preTest,
  postTest: course.postTest,
  evaluation: course.evaluation,
  evaluationAfter30Day: course.evaluationAfter30Day,
  lifeCycleMonth: course.lifeCycleMonth,
  courseType: course.courseType,
  courseGroup: course.courseGroup,
});

const mapRecordToRollingPlan = (record: RollingPlanRecord): RollingPlan => {
  const isCentral = record.owner === "CENTER";
  return {
    id: record.oapPlanId,
    rollingId: record.id,
    scheduleGroupId: record.oapPlanId,
    oapId: record.oapPlanId,
    sequence: 0,
    course: mapCourseDetail(record.course),
    participants: record.oapParticipants,
    hours: record.oapHours,
    budget: record.oapBudget,
    trainer: record.oapTrainer,
    provider: record.oapProvider,
    ownerName: record.createdBy,
    owner: record.owner,
    ownerScope: record.owner,
    ownerCompany: record.ownerCompany,
    batchNo: record.batchNo,
    batch: record.batchName || `Batch ${record.batchNo}`,
    location: record.venue,
    trainingDate: record.trainingDate,
    startTime: record.startTime,
    endTime: record.endTime,
    company: isCentral ? "All Companies" : record.ownerCompany,
    relatedCompanies: isCentral ? [...rollingCompanyOptions] : [record.ownerCompany],
    status: record.status === "Cancel" ? "Planning" : record.status,
    updatedAt: record.updatedAt,
  };
};

export const loadWorkflowRollingPlans = async (): Promise<RollingPlan[]> => {
  try {
    const result = await listRollingPlans({ search: null, status: null, oapPlanId: null });
    return (result.rollingPlans || []).map(mapRecordToRollingPlan);
  } catch (error) {
    console.error("Failed to load Training Rolling plans", error);
    return [];
  }
};

type RollingSessionForm = {
  id: string;
  dbId: string | null;
  batchName: string;
  location: string;
  trainingDate: string;
  startTime: string;
  endTime: string;
};

type RollingForm = {
  oapId: string;
  sessions: RollingSessionForm[];
};

const createEmptySession = (index = 0): RollingSessionForm => ({
  id: `session-${Date.now()}-${index}`,
  dbId: null,
  batchName: "",
  location: "",
  trainingDate: "",
  startTime: "09:00",
  endTime: "16:00",
});

const createEmptyForm = (): RollingForm => ({
  oapId: "",
  sessions: [createEmptySession()],
});

export const getJobStatus = (trainingDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${trainingDate}T00:00:00`);
  return target < today ? "Completed" : "Rolling";
};

export default function TrainingRolling() {
  const user = useAuthenticatedUser();
  const userCompanyCode = profileValue(user?.companyCode);
  const [oapPlans, setOapPlans] = useState<OapPlanRecord[]>([]);
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [form, setForm] = useState<RollingForm>(createEmptyForm);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [openDetailId, setOpenDetailId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | RollingStatus>("all");

  const loadWorkspace = async () => {
    try {
      const [oapData, rollingData] = await Promise.all([
        listOapPlans({ search: null, status: "Planned" }),
        loadWorkflowRollingPlans(),
      ]);
      setOapPlans(oapData.oapPlans || []);
      setRollingPlans(rollingData);
    } catch (error) {
      console.error("Failed to load Training Rolling workspace", error);
      setOapPlans([]);
      setRollingPlans([]);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const oapSources = useMemo(
    () =>
      oapPlans.filter((plan) =>
        isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode),
      ),
    [oapPlans, user?.roleCode, userCompanyCode],
  );
  const selectedOap = oapSources.find((source) => source.id === form.oapId) ?? null;
  const scopedRollingPlans = useMemo(
    () =>
      rollingPlans.filter((plan) =>
        isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode),
      ),
    [rollingPlans, user?.roleCode, userCompanyCode],
  );
  const selectedMonthLabel =
    selectedMonth === "all"
      ? "All Year"
      : monthOptions.find((month) => month.value === selectedMonth)?.label ??
        "Selected month";
  const visiblePlans = useMemo(
    () =>
      [...scopedRollingPlans]
        .sort((a, b) => a.trainingDate.localeCompare(b.trainingDate))
        .map((plan, index) => ({ ...plan, sequence: index + 1 }))
        .filter((plan) =>
          plan.trainingDate.startsWith(`${selectedYear}-`) &&
          (selectedMonth === "all" ||
            plan.trainingDate.startsWith(`${selectedYear}-${selectedMonth}`)) &&
          (statusFilter === "all" || plan.status === statusFilter) &&
          [
            plan.course.name,
            plan.course.code,
            plan.batch,
            plan.location,
            formatRollingPlanCompanies(plan),
            plan.status,
            getJobStatus(plan.trainingDate),
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
        ),
    [scopedRollingPlans, search, selectedMonth, selectedYear, statusFilter],
  );
  const visiblePlanGroups = useMemo(() => {
    const groups = new Map<string, RollingPlan[]>();

    visiblePlans.forEach((plan) => {
      groups.set(plan.scheduleGroupId, [...(groups.get(plan.scheduleGroupId) ?? []), plan]);
    });

    return [...groups.entries()].map(([id, plans], index) => ({
      id,
      sequence: index + 1,
      plans: [...plans].sort(
        (a, b) =>
          a.trainingDate.localeCompare(b.trainingDate) ||
          a.startTime.localeCompare(b.startTime),
      ),
    }));
  }, [visiblePlans]);
  const selectedGroup =
    visiblePlanGroups.find((group) => group.id === selectedGroupId) ?? null;

  const updateOap = (value: string) => {
    setForm((current) => ({ ...current, oapId: value }));
  };

  const updateSession = (
    sessionId: string,
    field: Exclude<keyof RollingSessionForm, "id" | "dbId">,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId ? { ...session, [field]: value } : session,
      ),
    }));
  };

  const addSession = () => {
    setForm((current) => ({
      ...current,
      sessions: [
        ...current.sessions,
        createEmptySession(current.sessions.length),
      ],
    }));
  };

  const removeSession = (sessionId: string) => {
    setForm((current) => ({
      ...current,
      sessions:
        current.sessions.length === 1
          ? current.sessions
          : current.sessions.filter((session) => session.id !== sessionId),
    }));
  };

  const handleSave = async () => {
    if (!selectedOap) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    try {
      for (const session of form.sessions) {
        const input = {
          oapPlanId: selectedOap.id,
          batchName: session.batchName.trim() || null,
          venue: session.location.trim(),
          trainingDate: session.trainingDate || today,
          startTime: session.startTime || "09:00",
          endTime: session.endTime || "16:00",
        };

        if (session.dbId) {
          await updateRollingPlan(session.dbId, input);
        } else {
          await createRollingPlan({ ...input, status: "Planning" });
        }
      }

      setForm(createEmptyForm());
      setIsNewOpen(false);
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to save Training Rolling plan", error);
      alert("Failed to save Training Rolling plan");
    }
  };

  const handleEditSession = (plan: RollingPlan) => {
    setForm({
      oapId: plan.oapId,
      sessions: [
        {
          id: plan.rollingId,
          dbId: plan.rollingId,
          batchName: plan.batch,
          location: plan.location,
          trainingDate: plan.trainingDate,
          startTime: plan.startTime,
          endTime: plan.endTime,
        },
      ],
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleDelete = async (rollingId: string) => {
    try {
      await deleteRollingPlan(rollingId);
      if (openDetailId === rollingId) {
        setOpenDetailId("");
      }
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to delete Training Rolling plan", error);
      alert("Failed to delete Training Rolling plan");
    }
  };

  const handleRefresh = async () => {
    await loadWorkspace();
    setForm(createEmptyForm());
    setIsNewOpen(false);
    setOpenDetailId("");
    setSelectedGroupId("");
    setSearch("");
    setSelectedYear("2026");
    setSelectedMonth("all");
    setStatusFilter("all");
  };

  const handleNew = () => {
    setForm(createEmptyForm());
    setOpenDetailId("");
    setSelectedGroupId("");
    setIsNewOpen(true);
  };

  const handleConfirm = async (rollingId: string) => {
    try {
      await updateRollingPlan(rollingId, { status: "Planned" });
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to publish Training Rolling plan", error);
      alert("Failed to publish Training Rolling plan");
    }
  };

  const handleConfirmGroup = async (groupPlans: RollingPlan[]) => {
    try {
      for (const plan of groupPlans) {
        if (plan.status !== "Planned") {
          await updateRollingPlan(plan.rollingId, { status: "Planned" });
        }
      }
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to publish Training Rolling plans", error);
      alert("Failed to publish Training Rolling plans");
    }
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
              <option value="all">All Year</option>
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
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Course, batch, location, status" />
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
            <button className={styles.secondaryButton} type="button" onClick={() => void handleRefresh()}>Refresh</button>
          </div>
        </div>

        {isNewOpen ? (
          <section className={styles.formPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>New monthly plan</p>
                <h3>{form.sessions.some((session) => session.dbId) ? "Edit Training Rolling" : "Create Training Rolling"}</h3>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => setIsNewOpen(false)}>Close</button>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.fullField}>
                <span>Course Name <span className={styles.required}>*</span></span>
                <select value={form.oapId} onChange={(event) => updateOap(event.target.value)}>
                  <option value="">Select course first</option>
                  {oapSources.map((source) => {
                    const tag = source.course.courseGroup || source.course.courseType;
                    return (
                      <option key={source.id} value={source.id}>
                        [{source.course.courseCode}] {getCourseDisplayName(source.course)}
                        {tag ? ` • ${tag}` : ""} (Plan: {source.participants} pax, {source.hours} hrs)
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>Participants<input disabled value={selectedOap?.participants ?? ""} /></label>
              <label>Training Hours<input disabled value={selectedOap?.hours ?? ""} /></label>
              <label>Budget<input disabled value={selectedOap ? Number(selectedOap.budget).toLocaleString("en-US") : ""} /></label>
              <label>Trainer<input disabled value={selectedOap?.trainer ?? ""} /></label>
              <label>Institute / Provider<input disabled value={selectedOap?.provider ?? ""} /></label>
              <label>Scope<input disabled value={selectedOap ? (selectedOap.owner === "CENTER" ? "All Companies" : selectedOap.ownerCompany) : ""} /></label>

              <div className={`${styles.fullField} ${styles.sessionSection}`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <strong>Training sessions</strong>
                    <span>Add another session when the course has a different batch, date, time, or location.</span>
                  </div>
                  <button className={styles.addSessionButton} disabled={!selectedOap || form.sessions.some((session) => session.dbId)} type="button" onClick={addSession}>
                    Add session
                  </button>
                </div>

                <div className={styles.sessionList}>
                  {form.sessions.map((session, index) => (
                    <article className={styles.sessionCard} key={session.id}>
                      <div className={styles.sessionHeader}>
                        <strong>Session {index + 1}</strong>
                        <button
                          className={styles.removeSessionButton}
                          disabled={!selectedOap || form.sessions.length === 1 || Boolean(session.dbId)}
                          type="button"
                          onClick={() => removeSession(session.id)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className={styles.sessionGrid}>
                        <label>
                          <span>Batch <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            placeholder="Optional label, e.g. Supervisor batch"
                            value={session.batchName}
                            onChange={(event) =>
                              updateSession(session.id, "batchName", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Location <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            value={session.location}
                            onChange={(event) =>
                              updateSession(session.id, "location", event.target.value)
                            }
                          />
                        </label>

                        <label>
                          <span>Training Date <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            type="date"
                            value={session.trainingDate}
                            onChange={(event) =>
                              updateSession(session.id, "trainingDate", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Start Time <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            type="time"
                            value={session.startTime}
                            onChange={(event) =>
                              updateSession(session.id, "startTime", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>End Time <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            type="time"
                            value={session.endTime}
                            onChange={(event) =>
                              updateSession(session.id, "endTime", event.target.value)
                            }
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
            {selectedOap ? (
              <div className={styles.coursePreview}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitleWrap}>
                    <div className={styles.previewTitleMain}>
                      <span className={styles.previewCodeBadge}>{selectedOap.course.courseCode}</span>
                      <strong>{getCourseDisplayName(selectedOap.course)}</strong>
                    </div>
                  </div>
                  <div className={styles.previewBadges}>
                    {selectedOap.course.courseType ? (
                      <span className={`${styles.previewBadge} ${styles.previewBadgeHighlight}`}>
                        🏷️ {selectedOap.course.courseType}
                      </span>
                    ) : null}
                    {selectedOap.course.courseGroup ? (
                      <span className={styles.previewBadge}>
                        📂 {selectedOap.course.courseGroup}
                      </span>
                    ) : null}
                    <span className={styles.previewBadge}>
                      ⏱️ {selectedOap.course.lifeCycleMonth || "12"} Months
                    </span>
                    <span className={styles.previewBadge}>
                      🏢 {selectedOap.ownerCompany || selectedOap.owner}
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
                      <span className={styles.previewFieldValue}>{selectedOap.course.objective || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Learning Content</span>
                      <span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>
                        {selectedOap.course.learningContent || "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Methodology</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.methodology || "-"}</span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>👥 Target & Planning Basis</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Target Group</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.targetGroup || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>OAP Target</span>
                      <span className={styles.previewFieldValue}>
                        {selectedOap.participants} participants / {selectedOap.hours} hours
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>OAP Budget</span>
                      <span className={styles.previewFieldValue}>
                        ฿{Number(selectedOap.budget).toLocaleString("en-US")}
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
                        <strong className={styles.previewFieldValue}>{selectedOap.course.preTest || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Post-Test</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.postTest || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Course Evaluation</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.evaluation || "Standard"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>30-Day Follow-Up</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.evaluationAfter30Day || "Standard"}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={!selectedOap}
                type="button"
                onClick={() => void handleSave()}
              >
                {form.sessions.some((session) => session.dbId) ? "Save changes" : "Save Draft"}
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => { setForm(createEmptyForm()); setIsNewOpen(false); }}>Cancel</button>
            </div>
          </section>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.rollingTable}>
            <thead>
              <tr>
                <th>Seq.</th>
                <th>Course Name</th>
                <th>Status</th>
                <th>Job Status</th>
                <th>Actions</th>
                <th>Training Sessions</th>
                <th>Company</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlanGroups.map((group) => {
                const plan = group.plans[0];
                const isOpen = openDetailId === group.id;
                const dates = [
                  ...new Set(group.plans.map((item) => item.trainingDate)),
                ];
                const allPublished = group.plans.every(
                  (item) => item.status === "Planned",
                );
                const groupStatus: RollingStatus = allPublished
                  ? "Planned"
                  : "Planning";
                const groupJobStatus = group.plans.some(
                  (item) => getJobStatus(item.trainingDate) === "Rolling",
                )
                  ? "Rolling"
                  : "Completed";

                return (
                  <Fragment key={group.id}>
                    <tr className={group.id === selectedGroupId ? styles.selectedRow : undefined}>
                      <td>
                        <label className={styles.selectionControl}>
                          <input
                            aria-label={`Select ${plan.course.code}`}
                            checked={group.id === selectedGroupId}
                            name="selected-rolling-group"
                            type="radio"
                            onChange={() => setSelectedGroupId(group.id)}
                          />
                          <span>{group.sequence}</span>
                        </label>
                      </td>
                      <td>
                        <strong>{plan.course.name}</strong>
                        <span>{plan.course.code}</span>
                        {plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.ownerName === "Center HRD" || plan.provider === "HRD Center" ? (
                          <div>
                            <span className={styles.creatorBadgeCenter}>
                              🏢 จัดหลักสูตรโดย HRD Center
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className={styles.creatorBadgeFactory}>
                              🏬 จัดหลักสูตรโดย {plan.ownerCompany || plan.company}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.statusPill} ${styles[`status${groupStatus}`]}`}>
                          <span className={styles.statusDot} />
                          {groupStatus === "Planned" ? "วางแผนแล้ว" : groupStatus === "Planning" ? "รอวางแผน" : groupStatus === "Cancel" ? "ยกเลิก" : groupStatus}
                        </span>
                      </td>
                      <td><span className={`${styles.jobPill} ${styles[`job${groupJobStatus}`]}`}>{groupJobStatus}</span></td>
                      <td className={styles.actionCell}>
                        <div className={styles.actionButtons}>
                          <button className={styles.detailButton} type="button" onClick={() => setOpenDetailId(isOpen ? "" : group.id)}>
                            {isOpen ? "Hide" : "Details"}
                          </button>
                          <button
                            className={styles.primaryButton}
                            disabled={allPublished}
                            type="button"
                            onClick={() => handleConfirmGroup(group.plans)}
                          >
                            {allPublished ? "All published" : "Publish all"}
                          </button>
                        </div>
                      </td>
                      <td>
                        <strong>{group.plans.length} sessions</strong>
                        <span>
                          {dates.length === 1
                            ? dates[0]
                            : `${dates.length} dates`}{" "}
                          / Batches: {group.plans.map((item) => item.batch).join(", ")}
                        </span>
                      </td>
                      <td>{formatRollingPlanCompanies(plan)}</td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detailRow}>
                        <td colSpan={7}>
                          <section className={styles.detailPanel}>
                            <div className={styles.panelHeader}>
                              <div>
                                <p className={styles.kicker}>Rolling detail</p>
                                <h3>{plan.course.name}</h3>
                              </div>
                              <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>Close</button>
                            </div>
                            <div className={styles.detailGrid}>
                              <div><span>Course Sequence</span><strong>{group.sequence}</strong></div>
                              <div><span>Sessions</span><strong>{group.plans.length}</strong></div>
                              <div><span>Status</span><strong>{groupStatus}</strong></div>
                              <div><span>Job Status</span><strong>{groupJobStatus}</strong></div>
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
                              <div><span>Budget</span><strong>{Number(plan.budget).toLocaleString("en-US")}</strong></div>
                              <div><span>Scope</span><strong>{formatRollingPlanCompanies(plan)}</strong></div>
                              <div><span>Participants</span><strong>{plan.participants}</strong></div>
                              <div><span>Training Hours</span><strong>{plan.hours}</strong></div>
                              <div><span>Trainer</span><strong>{plan.trainer}</strong></div>
                              <div><span>Provider</span><strong>{plan.provider}</strong></div>
                              <div>
                                <span>Created By (ผู้จัดอบรม)</span>
                                <strong>
                                  {plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.ownerName === "Center HRD"
                                    ? `🏢 HRD Center (ส่วนกลางจัดอบรมให้บริษัท ${formatRollingPlanCompanies(plan)})`
                                    : `🏬 ${plan.ownerCompany || plan.company} (โรงงานจัดอบรมเอง)`}
                                </strong>
                              </div>
                              <div><span>Last Updated</span><strong>{plan.updatedAt}</strong></div>
                            </div>

                            <div className={styles.sessionDetailHeader}>
                              <div>
                                <strong>Session schedule</strong>
                                <span>Edit, publish, or remove each session independently.</span>
                              </div>
                              <span>{group.plans.length} sessions</span>
                            </div>
                            <div className={styles.sessionSummaryList}>
                              {group.plans.map((session, index) => (
                                <article key={session.rollingId}>
                                  <div>
                                    <span>Session {index + 1}</span>
                                    <strong>{session.batch}</strong>
                                  </div>
                                  <div>
                                    <span>Training Date</span>
                                    <strong>{session.trainingDate}</strong>
                                  </div>
                                  <div>
                                    <span>Time</span>
                                    <strong>{session.startTime} - {session.endTime}</strong>
                                  </div>
                                  <div>
                                    <span>Location</span>
                                    <strong>{session.location}</strong>
                                  </div>
                                  <div>
                                    <span>Status</span>
                                    <strong>
                                      <span className={`${styles.statusPill} ${styles[`status${session.status}`]}`}>
                                        <span className={styles.statusDot} />
                                        {session.status === "Planned" ? "วางแผนแล้ว" : session.status === "Planning" ? "รอวางแผน" : session.status === "Cancel" ? "ยกเลิก" : session.status}
                                      </span>
                                    </strong>
                                  </div>
                                  <div className={styles.sessionActions}>
                                    <button className={styles.detailButton} type="button" onClick={() => handleEditSession(session)}>Edit</button>
                                    <button
                                      className={styles.primaryButton}
                                      disabled={session.status === "Planned"}
                                      type="button"
                                      onClick={() => void handleConfirm(session.rollingId)}
                                    >
                                      {session.status === "Planned" ? "Published" : "Publish"}
                                    </button>
                                    <button className={styles.dangerButton} type="button" onClick={() => void handleDelete(session.rollingId)}>Delete</button>
                                  </div>
                                </article>
                              ))}
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
          {visiblePlanGroups.length === 0 ? (
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
