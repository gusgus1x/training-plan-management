"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  getCourseDisplayName,
  isWorkflowOwner,
  type WorkflowCourse,
  type WorkflowOwner,
} from "../../../../lib/trainingWorkflow";
import { getCourseOutlineFileName } from "../../../../lib/courseOutlineExport";
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
  endDate: string;
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
export const yearOptions = ["2026", "2025", "2024"] as const;

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
    endDate: record.endDate || record.trainingDate,
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
  endDate: string;
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
  endDate: "",
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
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [exportingPlanId, setExportingPlanId] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [deletedSessionDbIds, setDeletedSessionDbIds] = useState<string[]>([]);

  const loadWorkspace = async () => {
    try {
      const [oapData, rollingData] = await Promise.all([
        listOapPlans({ search: null, status: null }),
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

  const isFactoryUser = user?.roleCode === "HRD_FACTORY";

  const oapSources = useMemo(
    () =>
      oapPlans.filter(
        (plan) =>
          plan.status !== "Cancel" &&
          isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode) &&
          (!isFactoryUser || plan.owner === "FACTORY" || plan.ownerCompany === userCompanyCode),
      ),
    [oapPlans, user?.roleCode, userCompanyCode, isFactoryUser],
  );
  const selectedOap = oapSources.find((source) => source.id === form.oapId) ?? null;
  const scopedRollingPlans = useMemo(
    () =>
      rollingPlans.filter((plan) => {
        if (isFactoryUser) {
          // Factory users see plans from their factory OR plans from CENTER (which target all companies / factory)
          const isCenter = plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.owner === "CENTER" || plan.company === "All Companies";
          const isOwnFactory = plan.ownerCompany === userCompanyCode || plan.company === userCompanyCode;
          return isCenter || isOwnFactory;
        }
        return isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode);
      }),
    [rollingPlans, isFactoryUser, user?.roleCode, userCompanyCode],
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
        .filter((plan) => {
          if (companyFilter !== "all") {
            const planCompanies = getRollingPlanCompanies(plan);
            const matchesCompany =
              companyFilter === "CENTER"
                ? plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.company === "All Companies"
                : planCompanies.includes(companyFilter) ||
                  plan.ownerCompany === companyFilter ||
                  plan.company === companyFilter;
            if (!matchesCompany) return false;
          }
          return (
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
              .includes(search.toLowerCase())
          );
        }),
    [companyFilter, scopedRollingPlans, search, selectedMonth, selectedYear, statusFilter],
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
  const isSelectedGroupCenter = selectedGroup
    ? (selectedGroup.plans[0]?.ownerScope === "CENTER" ||
       selectedGroup.plans[0]?.ownerCompany === "HRD Center" ||
       selectedGroup.plans[0]?.ownerName === "Center HRD" ||
       selectedGroup.plans[0]?.provider === "HRD Center")
    : false;
  const isSelectedGroupReadOnlyForFactory = isFactoryUser && isSelectedGroupCenter;

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
    const sessionToRemove = form.sessions.find((s) => s.id === sessionId);
    if (sessionToRemove?.dbId) {
      setDeletedSessionDbIds((prev) => [...prev, sessionToRemove.dbId!]);
    }
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
      // 1. Delete any sessions removed from the form
      for (const dbId of deletedSessionDbIds) {
        await deleteRollingPlan(dbId);
      }
      setDeletedSessionDbIds([]);

      // 2. Save or update remaining sessions
      for (const session of form.sessions) {
        const startDate = session.trainingDate || today;
        const input = {
          oapPlanId: selectedOap.id,
          batchName: session.batchName.trim() || null,
          venue: session.location.trim(),
          trainingDate: startDate,
          endDate: session.endDate || startDate,
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

  const handleEditGroup = (group: { id: string; plans: RollingPlan[] }) => {
    const plan = group.plans[0];
    setDeletedSessionDbIds([]);
    setForm({
      oapId: plan.oapId,
      sessions: group.plans.map((p, index) => ({
        id: p.rollingId || `session-${index}`,
        dbId: p.rollingId,
        batchName: p.batch,
        location: p.location,
        trainingDate: p.trainingDate,
        endDate: p.endDate || p.trainingDate,
        startTime: p.startTime || "09:00",
        endTime: p.endTime || "16:00",
      })),
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleDeleteGroup = async (group: { id: string; plans: RollingPlan[] }) => {
    const courseName = group.plans[0]?.course.name || "selected plan";
    if (!confirm(`Are you sure you want to delete all ${group.plans.length} session(s) for "${courseName}"?`)) {
      return;
    }
    try {
      for (const plan of group.plans) {
        await deleteRollingPlan(plan.rollingId);
      }
      setSelectedGroupId("");
      if (openDetailId === group.id) {
        setOpenDetailId("");
      }
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to delete Training Rolling plan", error);
      alert("Failed to delete Training Rolling plan");
    }
  };

  const handleEditSession = (plan: RollingPlan) => {
    setDeletedSessionDbIds([]);
    setForm({
      oapId: plan.oapId,
      sessions: [
        {
          id: plan.rollingId,
          dbId: plan.rollingId,
          batchName: plan.batch,
          location: plan.location,
          trainingDate: plan.trainingDate,
          endDate: plan.endDate || plan.trainingDate,
          startTime: plan.startTime,
          endTime: plan.endTime,
        },
      ],
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleDelete = async (rollingId: string) => {
    if (!confirm("Are you sure you want to delete this session?")) {
      return;
    }
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

  const handleExportOutline = async (plan: RollingPlan) => {
    const oapPlan = oapPlans.find((item) => item.id === plan.oapId) ?? null;
    const course: WorkflowCourse = oapPlan?.course ?? {
      id: plan.course.code,
      courseCode: plan.course.code,
      courseNameTh: plan.course.name,
      courseNameEn: plan.course.name,
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
      remark: "",
      status: "Active",
      updatedAt: plan.updatedAt,
      owner: plan.owner,
      ownerCompany: plan.ownerCompany,
      createdBy: plan.ownerName,
    };

    setExportingPlanId(plan.rollingId);
    setExportMessage("");

    try {
      const response = await fetch("/api/course-master/course-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course, standard: null, oapPlan }),
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
      downloadLink.download = getCourseOutlineFileName(course);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      setExportMessage(`Exported Course Outline: ${course.courseCode}`);
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
    setForm(createEmptyForm());
    setIsNewOpen(false);
    setOpenDetailId("");
    setSelectedGroupId("");
    setExportMessage("");
    setSearch("");
    setSelectedYear("2026");
    setSelectedMonth("all");
    setStatusFilter("all");
  };

  const handleNew = () => {
    setForm(createEmptyForm());
    setOpenDetailId("");
    setSelectedGroupId("");
    setExportMessage("");
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

        <section className={styles.toolbar} aria-label="Training Rolling toolbar">
          <div className={styles.filterRow}>
            <div className={styles.searchWrapper}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={styles.searchInput}
                aria-label="Search monthly rolling plan"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search course code, name, batch, location, status..."
              />
            </div>
            <div className={styles.filterGroup}>
              {user?.roleCode === "HRD_CENTER" ? (
                <label className={styles.filterLabel}>
                  <span>Company</span>
                  <select
                    className={styles.selectInput}
                    aria-label="Filter company"
                    value={companyFilter}
                    onChange={(event) => setCompanyFilter(event.target.value)}
                  >
                    <option value="all">All Companies</option>
                    <option value="CENTER">HRD Center</option>
                    <option value="ATA">ATA</option>
                    <option value="TEP">TEP</option>
                    <option value="ATFB">ATFB</option>
                    <option value="NIC">NIC</option>
                    <option value="SATI">SATI</option>
                    <option value="SNF">SNF</option>
                  </select>
                </label>
              ) : null}
              <label className={styles.filterLabel}>
                <span>Year</span>
                <select className={styles.selectInput} aria-label="Filter year" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                  {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className={styles.filterLabel}>
                <span>Month</span>
                <select className={styles.selectInput} aria-label="Filter month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                  <option value="all">All Year</option>
                  {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                </select>
              </label>
              <label className={styles.filterLabel}>
                <span>Status</span>
                <select className={styles.selectInput} aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | RollingStatus)}>
                  <option value="all">All status</option>
                  <option value="Planning">Planning</option>
                  <option value="Planned">Planned</option>
                </select>
              </label>
            </div>
          </div>
          <div className={styles.actionRow}>
            <button
              className={styles.primaryButton}
              disabled={oapSources.length === 0}
              title={oapSources.length === 0 ? "Create a Training OAP before creating a rolling plan." : "Create monthly rolling plan"}
              type="button"
              onClick={handleNew}
            >
              + New
            </button>
            <button
              className={styles.secondaryButton}
              disabled={!selectedGroup || isSelectedGroupReadOnlyForFactory}
              title={isSelectedGroupReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้ (ส่งผู้เข้าร่วมได้ใน Training Accept Survey)" : "Edit monthly rolling plan"}
              type="button"
              onClick={() => selectedGroup && !isSelectedGroupReadOnlyForFactory && handleEditGroup(selectedGroup)}
            >
              Edit
            </button>
            <button
              className={styles.dangerButton}
              disabled={!selectedGroup || isSelectedGroupReadOnlyForFactory}
              title={isSelectedGroupReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : "Delete monthly rolling plan"}
              type="button"
              onClick={() => selectedGroup && !isSelectedGroupReadOnlyForFactory && void handleDeleteGroup(selectedGroup)}
            >
              Delete
            </button>
            <button
              className={styles.secondaryButton}
              disabled={!selectedGroup || Boolean(exportingPlanId)}
              type="button"
              onClick={() => selectedGroup && void handleExportOutline(selectedGroup.plans[0])}
            >
              {exportingPlanId ? "Preparing..." : "Export Outline"}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => void handleRefresh()}>
              Refresh
            </button>
          </div>
        </section>

        <p className={styles.selectionHint} aria-live="polite">
          {selectedGroup
            ? `Selected: ${selectedGroup.plans[0]?.course.code} / ${selectedGroup.plans[0]?.course.name}`
            : "Click on any course row to select, Edit, Delete, Export Outline or view details."}
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
                          <span>Start Date (วันที่เริ่ม) <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            type="date"
                            value={session.trainingDate}
                            onClick={(e) => {
                              try {
                                e.currentTarget.showPicker?.();
                              } catch {}
                            }}
                            onChange={(event) => {
                              const newDate = event.target.value;
                              updateSession(session.id, "trainingDate", newDate);
                              if (!session.endDate || session.endDate < newDate) {
                                updateSession(session.id, "endDate", newDate);
                              }
                            }}
                          />
                        </label>
                        <label>
                          <span>End Date (วันที่สิ้นสุด) <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            type="date"
                            min={session.trainingDate}
                            value={session.endDate || session.trainingDate}
                            onClick={(e) => {
                              try {
                                e.currentTarget.showPicker?.();
                              } catch {}
                            }}
                            onChange={(event) =>
                              updateSession(session.id, "endDate", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Start Time (เวลาเริ่ม) <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            type="time"
                            value={session.startTime}
                            onClick={(e) => {
                              try {
                                e.currentTarget.showPicker?.();
                              } catch {}
                            }}
                            onChange={(event) =>
                              updateSession(session.id, "startTime", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>End Time (เวลาสิ้นสุด) <span className={styles.required}>*</span></span>
                          <input
                            disabled={!selectedOap}
                            type="time"
                            value={session.endTime}
                            onClick={(e) => {
                              try {
                                e.currentTarget.showPicker?.();
                              } catch {}
                            }}
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
                      <span>🎯 วัตถุประสงค์และเนื้อหา (Objectives & Content)</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>วัตถุประสงค์</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.objective || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>หัวข้อการเรียนรู้</span>
                      <span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>
                        {selectedOap.course.learningContent || "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>วิธีการอบรม</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.methodology || "-"}</span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>👥 ข้อมูลการจัดอบรม (Planning Details)</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>ผู้เข้าอบรม</span>
                      <span className={styles.previewFieldValue}>{selectedOap.participants} ท่าน</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>ชั่วโมงอบรม</span>
                      <span className={styles.previewFieldValue}>{selectedOap.hours} ชม.</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>งบประมาณ</span>
                      <span className={styles.previewFieldValue}>
                        ฿{Number(selectedOap.budget).toLocaleString("en-US")}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>วิทยากร</span>
                      <span className={styles.previewFieldValue}>{selectedOap.trainer || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>สถาบัน / ผู้ให้บริการ</span>
                      <span className={styles.previewFieldValue}>{selectedOap.providerName || "-"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>ขอบเขต</span>
                      <span className={styles.previewFieldValue}>{selectedOap.owner === "CENTER" ? "ทุกบริษัท (All Companies)" : selectedOap.ownerCompany}</span>
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
                const isCenterGroup = plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.ownerName === "Center HRD" || plan.provider === "HRD Center";
                const isRowReadOnlyForFactory = isFactoryUser && isCenterGroup;
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
                    <tr
                      className={`${group.id === selectedGroupId ? styles.selectedRow : ""} ${styles.clickableRow}`}
                      onClick={() => setSelectedGroupId(group.id === selectedGroupId ? "" : group.id)}
                    >
                      <td>
                        <label className={styles.selectionControl} onClick={(e) => e.stopPropagation()}>
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
                      <td className={styles.actionCell} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.actionButtons}>
                          <button className={styles.detailButton} type="button" onClick={() => setOpenDetailId(isOpen ? "" : group.id)}>
                            {isOpen ? "Hide" : "Details"}
                          </button>
                          <button
                            className={styles.secondaryButton}
                            disabled={isRowReadOnlyForFactory}
                            title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้ (ส่งผู้เข้าร่วมได้ใน Training Accept Survey)" : undefined}
                            type="button"
                            onClick={() => {
                              if (isRowReadOnlyForFactory) return;
                              setSelectedGroupId(group.id);
                              handleEditGroup(group);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className={styles.dangerButton}
                            disabled={isRowReadOnlyForFactory}
                            title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : undefined}
                            type="button"
                            onClick={() => {
                              if (isRowReadOnlyForFactory) return;
                              setSelectedGroupId(group.id);
                              void handleDeleteGroup(group);
                            }}
                          >
                            Delete
                          </button>
                          <button
                            className={styles.primaryButton}
                            disabled={allPublished || isRowReadOnlyForFactory}
                            title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถเผยแพร่ได้" : undefined}
                            type="button"
                            onClick={() => !isRowReadOnlyForFactory && handleConfirmGroup(group.plans)}
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
                              <div className={styles.panelHeaderActions}>
                                <button
                                  className={styles.secondaryButton}
                                  disabled={Boolean(exportingPlanId)}
                                  type="button"
                                  onClick={() => void handleExportOutline(plan)}
                                >
                                  {exportingPlanId === plan.rollingId ? "Preparing..." : "Export Outline"}
                                </button>
                                <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>Close</button>
                              </div>
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
                              <div><span>ผู้เข้าอบรม (Participants)</span><strong>{plan.participants} ท่าน</strong></div>
                              <div><span>ชั่วโมงอบรม (Training Hours)</span><strong>{plan.hours} ชม.</strong></div>
                              <div><span>งบประมาณ (Budget)</span><strong>฿{Number(plan.budget).toLocaleString("en-US")}</strong></div>
                              <div><span>วิทยากร (Trainer)</span><strong>{plan.trainer || "-"}</strong></div>
                              <div><span>สถาบัน / ผู้ให้บริการ (Provider)</span><strong>{plan.provider || "-"}</strong></div>
                              <div><span>ขอบเขต (Scope)</span><strong>{formatRollingPlanCompanies(plan)}</strong></div>
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
                                    <button
                                      className={styles.detailButton}
                                      disabled={isRowReadOnlyForFactory}
                                      title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้" : undefined}
                                      type="button"
                                      onClick={() => !isRowReadOnlyForFactory && handleEditSession(session)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className={styles.primaryButton}
                                      disabled={session.status === "Planned" || isRowReadOnlyForFactory}
                                      title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถเผยแพร่ได้" : undefined}
                                      type="button"
                                      onClick={() => !isRowReadOnlyForFactory && void handleConfirm(session.rollingId)}
                                    >
                                      {session.status === "Planned" ? "Published" : "Publish"}
                                    </button>
                                    <button
                                      className={styles.dangerButton}
                                      disabled={isRowReadOnlyForFactory}
                                      title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : undefined}
                                      type="button"
                                      onClick={() => !isRowReadOnlyForFactory && void handleDelete(session.rollingId)}
                                    >
                                      Delete
                                    </button>
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
              <strong>{oapSources.length === 0 ? "No Training OAP found" : "No rolling plans found"}</strong>
              <span>
                {oapSources.length === 0
                  ? "Create a Training OAP plan first before creating a monthly rolling plan."
                  : "Try changing the month, year, status, or search text."}
              </span>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
