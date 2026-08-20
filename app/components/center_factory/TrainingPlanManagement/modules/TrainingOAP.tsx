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
import { listInstructors } from "../../../../lib/instructors/client";
import type { InstructorRecord } from "../../../../lib/instructors/types";
import { listInstituteProviders } from "../../../../lib/instituteProviders/client";
import type { InstituteProviderRecord } from "../../../../lib/instituteProviders/types";
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
  budgetInstructor: "",
  budgetTraveling: "",
  budgetSeminarRoom: "",
  budgetAccommodation: "",
  budgetMaterial: "",
  budgetFoodBeverage: "",
  trainer: "",
  provider: "",
};

const BUDGET_PART_FIELDS = [
  "budgetInstructor",
  "budgetTraveling",
  "budgetSeminarRoom",
  "budgetAccommodation",
  "budgetMaterial",
  "budgetFoodBeverage",
] as const;

const sumBudgetParts = (form: Record<(typeof BUDGET_PART_FIELDS)[number], string>) =>
  BUDGET_PART_FIELDS.reduce((total, field) => total + (Number(form[field]) || 0), 0);

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
  courseNameTh: request.courseNeed,
  courseNameEn: request.courseNeed,
  objective: request.reason,
  learningContent: request.expectedBenefit,
  targetGroup: `${request.employeeName} / ${request.company} / ${request.functionName}`,
  methodology: "Classroom / Workshop",
  preTest: "",
  postTest: "",
  evaluation: "Course Evaluation",
  evaluationAfter30Day: "Follow-up evaluation",
  lifeCycleMonth: "12",
  courseType: request.sourceCourseOwner === "Factory" ? "Factory Specific" : "Center Standard",
  courseGroup: request.company,
  remark: `Approved from request #${request.requestNo} by ${request.employeeName}`,
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OapStatus>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [instructors, setInstructors] = useState<InstructorRecord[]>([]);
  const [providers, setProviders] = useState<InstituteProviderRecord[]>([]);
  const userCompanyCode = profileValue(user?.companyCode);

  useEffect(() => {
    const syncApprovedRequest = () => {
      const request = readApprovedTrainingNeed();

      if (!request) {
        return;
      }

      setApprovedRequest(request);
      setForm({
        ...emptyForm,
        courseCode: `REQ-${request.requestNo}`,
        participants: "1",
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

  useEffect(() => {
    let current = true;
    listInstituteProviders({ status: "ACTIVE" })
      .then((result) => {
        if (current) setProviders(result.items);
      })
      .catch(() => {
        if (current) setProviders([]);
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
    () => new Set(standards.map((standard) => standard.courseId)),
    [standards],
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

  const allCompanyCodes = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

  const companyColumns = useMemo(() => {
    const userComp = userCompanyCode && userCompanyCode !== "CENTER" ? userCompanyCode : "";
    if (userComp && allCompanyCodes.includes(userComp as any)) {
      return [userComp, ...allCompanyCodes.filter((c) => c !== userComp)];
    }
    return [...allCompanyCodes];
  }, [userCompanyCode]);

  const isCompanyIncludedInOap = (plan: OapPlan, company: string) => {
    if (plan.owner === "CENTER" || plan.ownerCompany === "HRD Center" || plan.ownerCompany === "CENTER") {
      return true;
    }
    return plan.ownerCompany === company;
  };

  const isCompanyOwnerOfOap = (plan: OapPlan, company: string) => {
    if (plan.owner === "CENTER" || plan.ownerCompany === "HRD Center") {
      return false;
    }
    return plan.ownerCompany === company;
  };

  const getCompanySortWeight = (plan: OapPlan) => {
    const planCompany = plan.owner === "CENTER" ? "CENTER" : plan.ownerCompany;
    const currentUserCompany = userCompanyCode || "CENTER";

    if (
      planCompany === currentUserCompany ||
      (currentUserCompany === "CENTER" && (plan.owner === "CENTER" || plan.ownerCompany === "HRD Center"))
    ) {
      return 0;
    }
    if (plan.owner === "CENTER" || plan.ownerCompany === "HRD Center") {
      return 1;
    }
    return 2;
  };

  const visiblePlans = useMemo(
    () =>
      scopedPlans
        .filter((plan) => {
          if (companyFilter !== "all") {
            const matchesCompany =
              companyFilter === "CENTER"
                ? plan.owner === "CENTER" || plan.ownerCompany === "HRD Center" || plan.ownerCompany === "CENTER"
                : plan.ownerCompany === companyFilter;
            if (!matchesCompany) return false;
          }
          return true;
        })
        .filter((plan) =>
          [
            plan.course.courseCode,
            plan.course.courseNameTh,
            plan.course.courseNameEn,
            plan.status,
            plan.trainer,
            plan.providerName,
            plan.owner === "CENTER" ? "HRD Center" : plan.ownerCompany,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .filter((plan) => statusFilter === "all" || plan.status === statusFilter)
        .sort((a, b) => {
          const weightA = getCompanySortWeight(a);
          const weightB = getCompanySortWeight(b);
          if (weightA !== weightB) return weightA - weightB;

          const companyA = a.owner === "CENTER" ? "HRD Center" : a.ownerCompany || "";
          const companyB = b.owner === "CENTER" ? "HRD Center" : b.ownerCompany || "";
          if (companyA !== companyB) return companyA.localeCompare(companyB);

          return a.sequence - b.sequence;
        })
        .map((plan, index) => ({ ...plan, sequence: index + 1 })),
    [companyFilter, scopedPlans, search, statusFilter, userCompanyCode],
  );

  const companySections = useMemo(() => {
    const groupsMap = new Map<string, OapPlan[]>();

    visiblePlans.forEach((plan) => {
      const compKey = plan.owner === "CENTER" ? "HRD Center" : (plan.ownerCompany || "Other");
      groupsMap.set(compKey, [...(groupsMap.get(compKey) ?? []), plan]);
    });

    const userCompLabel = userCompanyCode && userCompanyCode !== "CENTER" ? userCompanyCode : "";

    const entries = [...groupsMap.entries()].map(([companyName, planList]) => ({
      companyName,
      plans: planList,
      isUserCompany: userCompLabel ? companyName === userCompLabel : companyName === "HRD Center",
    }));

    return entries.sort((a, b) => {
      if (a.isUserCompany && !b.isUserCompany) return -1;
      if (!a.isUserCompany && b.isUserCompany) return 1;

      if (a.companyName === "HRD Center") return -1;
      if (b.companyName === "HRD Center") return 1;

      return a.companyName.localeCompare(b.companyName);
    });
  }, [visiblePlans, userCompanyCode]);
  const selectedPlan =
    visiblePlans.find((plan) => plan.id === selectedPlanId) ?? null;

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateBudgetPart = (field: (typeof BUDGET_PART_FIELDS)[number], value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      return { ...next, budget: String(sumBudgetParts(next)) };
    });
  };

  const resolveInstructorId = (trainerName: string) => {
    const trimmed = trainerName.trim();
    const matched = instructors.find(
      (instructor) => `${instructor.firstName} ${instructor.lastName}`.trim() === trimmed,
    );
    return matched?.instructorId ?? null;
  };

  const resolveProviderId = (providerName: string) => {
    const trimmed = providerName.trim();
    const matched = providers.find(
      (provider) => provider.instituteProviderName.trim() === trimmed,
    );
    return matched?.instituteProviderId ?? null;
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
      budgetInstructor: form.budgetInstructor.trim() || "0",
      budgetTraveling: form.budgetTraveling.trim() || "0",
      budgetSeminarRoom: form.budgetSeminarRoom.trim() || "0",
      budgetAccommodation: form.budgetAccommodation.trim() || "0",
      budgetMaterial: form.budgetMaterial.trim() || "0",
      budgetFoodBeverage: form.budgetFoodBeverage.trim() || "0",
      trainerName: form.trainer.trim(),
      instructorId: resolveInstructorId(form.trainer),
      providerName: form.provider.trim(),
      providerId: resolveProviderId(form.provider),
    };

    try {
      if (editingId) {
        await updateOapPlan(editingId, input);
      } else {
        await createOapPlan({ ...input, planYear: new Date().getFullYear(), status: "Planned" });
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
      budgetInstructor: plan.budgetInstructor,
      budgetTraveling: plan.budgetTraveling,
      budgetSeminarRoom: plan.budgetSeminarRoom,
      budgetAccommodation: plan.budgetAccommodation,
      budgetMaterial: plan.budgetMaterial,
      budgetFoodBeverage: plan.budgetFoodBeverage,
      trainer: plan.trainer,
      provider: plan.providerName,
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this OAP plan and all associated sessions?")) {
      return;
    }
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

  const handleRefresh = async () => {
    await loadWorkspace();
    setForm(emptyForm);
    setApprovedRequest(null);
    window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
    setIsNewOpen(false);
    setEditingId("");
    setOpenDetailId("");
    setSelectedPlanId("");
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

        <section className={styles.toolbar} aria-label="Training OAP toolbar">
          <div className={styles.filterRow}>
            <div className={styles.searchWrapper}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={styles.searchInput}
                aria-label="Search annual training plan"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search course code, name, trainer, provider, status..."
              />
            </div>
            {user?.roleCode === "HRD_CENTER" ? (
              <label className={styles.filterLabel}>
                <span>Company</span>
                <select
                  className={styles.statusSelect}
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
              <span>Status</span>
              <select
                className={styles.statusSelect}
                aria-label="Filter status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | OapStatus)}
              >
                <option value="all">All status</option>
                <option value="Planning">Planning</option>
                <option value="Planned">Planned</option>
                <option value="Cancel">Cancel</option>
              </select>
            </label>
          </div>
          <div className={styles.actionRow}>
            <button className={styles.primaryButton} disabled={courseOptions.length === 0} type="button" onClick={handleNew}>
              + New
            </button>
            <button className={styles.secondaryButton} disabled={!selectedPlan} type="button" onClick={() => selectedPlan && handleEdit(selectedPlan)}>
              Edit
            </button>
            <button className={styles.dangerButton} disabled={!selectedPlan} type="button" onClick={() => selectedPlan && void handleDelete(selectedPlan.id)}>
              Delete
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
              Refresh
            </button>
          </div>
        </section>

        <p className={styles.selectionHint} aria-live="polite">
          {selectedPlan
            ? `Selected: ${selectedPlan.course.courseCode} / ${getCourseDisplayName(selectedPlan.course)}`
            : "Click on any course row to select, Edit, or Delete."}
        </p>

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
                <span>Instructor Budget</span>
                <input
                  disabled={!selectedCourse}
                  inputMode="numeric"
                  placeholder="0"
                  value={form.budgetInstructor}
                  onChange={(event) => updateBudgetPart("budgetInstructor", event.target.value)}
                />
              </label>
              <label>
                <span>Traveling Budget</span>
                <input
                  disabled={!selectedCourse}
                  inputMode="numeric"
                  placeholder="0"
                  value={form.budgetTraveling}
                  onChange={(event) => updateBudgetPart("budgetTraveling", event.target.value)}
                />
              </label>
              <label>
                <span>Seminar Room Budget</span>
                <input
                  disabled={!selectedCourse}
                  inputMode="numeric"
                  placeholder="0"
                  value={form.budgetSeminarRoom}
                  onChange={(event) => updateBudgetPart("budgetSeminarRoom", event.target.value)}
                />
              </label>
              <label>
                <span>Accommodation Budget</span>
                <input
                  disabled={!selectedCourse}
                  inputMode="numeric"
                  placeholder="0"
                  value={form.budgetAccommodation}
                  onChange={(event) => updateBudgetPart("budgetAccommodation", event.target.value)}
                />
              </label>
              <label>
                <span>Material Budget</span>
                <input
                  disabled={!selectedCourse}
                  inputMode="numeric"
                  placeholder="0"
                  value={form.budgetMaterial}
                  onChange={(event) => updateBudgetPart("budgetMaterial", event.target.value)}
                />
              </label>
              <label>
                <span>Food &amp; Beverage Budget</span>
                <input
                  disabled={!selectedCourse}
                  inputMode="numeric"
                  placeholder="0"
                  value={form.budgetFoodBeverage}
                  onChange={(event) => updateBudgetPart("budgetFoodBeverage", event.target.value)}
                />
              </label>
              <label className={styles.totalBudgetField}>
                <span>Total Budget <span className={styles.required}>*</span></span>
                <input
                  disabled
                  readOnly
                  value={form.budget ? Number(form.budget).toLocaleString("en-US") : "0"}
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
                  list="institute-provider-options"
                  disabled={!selectedCourse}
                  value={form.provider}
                  onChange={(event) => updateForm("provider", event.target.value)}
                  placeholder="Select from Institute/Provider Master or enter another name"
                />
                <datalist id="institute-provider-options">
                  {providers.map((provider) => (
                    <option key={provider.instituteProviderId} value={provider.instituteProviderName}>
                      {provider.instituteProviderCode}
                    </option>
                  ))}
                </datalist>
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
                      <span className={styles.previewFieldLabel}>ที่มา (Background)</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.remark || "-"}</span>
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
                      <span>👥 Target & Standard</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Target Group</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.targetGroup || "-"}</span>
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                      <span className={styles.previewFieldLabel}>Companies</span>
                      {selectedCourseStandard?.companies?.length ? (
                        <span className={styles.previewBadges}>
                          {selectedCourseStandard.companies.map((company) => (
                            <span key={company} className={styles.previewBadge}>{company}</span>
                          ))}
                        </span>
                      ) : (
                        <span className={styles.previewFieldValue}>All Companies</span>
                      )}
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                      <span className={styles.previewFieldLabel}>Org Scope</span>
                      <span className={styles.previewFieldValue}>
                        {selectedCourseStandard
                          ? [selectedCourseStandard.functionName, selectedCourseStandard.division, selectedCourseStandard.department, selectedCourseStandard.section].filter(Boolean).join(" / ") || "All Function"
                          : "No standard defined"}
                      </span>
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                      <span className={styles.previewFieldLabel}>Positions</span>
                      {selectedCourseStandard?.positions.length ? (
                        <span className={styles.previewBadges}>
                          {selectedCourseStandard.positions.map((position) => (
                            <span key={position} className={styles.previewBadge}>{position}</span>
                          ))}
                        </span>
                      ) : (
                        <span className={styles.previewFieldValue}>All Positions</span>
                      )}
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                      <span className={styles.previewFieldLabel}>Levels</span>
                      {selectedCourseStandard?.levels.length ? (
                        <span className={styles.previewBadges}>
                          {selectedCourseStandard.levels.map((level) => (
                            <span key={level} className={styles.previewBadge}>{level}</span>
                          ))}
                        </span>
                      ) : (
                        <span className={styles.previewFieldValue}>All Levels</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>📝 Assessment Forms</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Pre-Test</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.preTest || "None"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Post-Test</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.postTest || "None"}</span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>⭐ Evaluation Forms</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Evaluation</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.evaluation || "Standard"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>30-Day Follow-Up</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.evaluationAfter30Day || "Standard"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                disabled={!selectedCourse || !form.participants || !form.hours || !form.budget}
                type="button"
                onClick={() => void handleSave()}
              >
                {editingId ? "Save changes" : "Save Draft"}
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => { setForm(emptyForm); setEditingId(""); setIsNewOpen(false); }}>Cancel</button>
            </div>
          </section>
        ) : null}

        <div className={styles.companySectionsContainer}>
          {companySections.map((section) => (
            <div key={section.companyName} className={styles.companySectionBlock}>
              <div className={`${styles.companySectionHeader} ${section.isUserCompany ? styles.ownCompanySectionHeader : ""}`}>
                <div className={styles.companySectionTitle}>
                  <span className={styles.companyIcon}>{section.companyName === "HRD Center" ? "🏢" : "🏬"}</span>
                  <h4>แผนอบรม {section.companyName}</h4>
                  {section.isUserCompany ? <span className={styles.ownCompanySectionTag}>⭐ บริษัทของฉัน ({userCompanyCode || "HRD Center"})</span> : null}
                </div>
                <span className={styles.companyCountBadge}>{section.plans.length} หลักสูตร</span>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.planTable}>
                  <thead>
                    <tr>
                      <th>Seq.</th>
                      <th>Course Name</th>
                      <th>Course Group</th>
                      <th>Status</th>
                      <th>Actions</th>
                      <th>Participants</th>
                      <th>Hours</th>
                      <th>Budget (THB)</th>
                      <th>Trainer Name</th>
                      <th>Institute / Provider</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.plans.map((plan, index) => {
                      const isOpen = openDetailId === plan.id;
                      return (
                        <Fragment key={plan.id}>
                          <tr
                            className={`${plan.id === selectedPlanId ? styles.selectedRow : ""} ${styles.clickableRow}`}
                            onClick={() => setSelectedPlanId(plan.id === selectedPlanId ? "" : plan.id)}
                          >
                            <td>
                              <label className={styles.selectionControl} onClick={(e) => e.stopPropagation()}>
                                <input
                                  aria-label={`Select ${plan.course.courseCode}`}
                                  checked={plan.id === selectedPlanId}
                                  name="selected-oap-plan"
                                  type="radio"
                                  onChange={() => setSelectedPlanId(plan.id)}
                                />
                                <span>{index + 1}</span>
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
                            <td>{plan.course.courseGroup || "-"}</td>
                            <td>
                              <span className={`${styles.statusPill} ${styles[`status${plan.status}`]}`}>
                                <span className={styles.statusDot} />
                                {plan.status === "Planned" ? "วางแผนแล้ว" : plan.status === "Planning" ? "รอวางแผน" : plan.status === "Cancel" ? "ยกเลิก" : plan.status}
                              </span>
                            </td>
                            <td className={styles.actionCell} onClick={(e) => e.stopPropagation()}>
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
                                <button
                                  className={`${styles.rowActionButton} ${styles.detailsAction}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlanId(plan.id);
                                    handleEdit(plan);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className={`${styles.rowActionButton} ${styles.dangerAction}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlanId(plan.id);
                                    void handleDelete(plan.id);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                            <td>{plan.participants}</td>
                            <td>{plan.hours}</td>
                            <td>{Number(plan.budget).toLocaleString("en-US")}</td>
                            <td>{plan.trainer}</td>
                            <td>{plan.providerName}</td>
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
                                  <div className={styles.previewSections}>
                                    <div className={`${styles.previewCard} ${styles.previewCardFull}`}>
                                      <div className={styles.previewCardHeader}><span>📘 หลักสูตร (Course)</span></div>
                                      <div className={styles.previewFieldGrid}>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>กลุ่มหลักสูตร</span><span className={styles.previewFieldValue}>{plan.course.courseGroup || "-"}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>รหัสหลักสูตร</span><span className={styles.previewFieldValue}>{plan.course.courseCode}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ชื่อหลักสูตร (ไทย)</span><span className={styles.previewFieldValue}>{plan.course.courseNameTh}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ชื่อหลักสูตร (อังกฤษ)</span><span className={styles.previewFieldValue}>{plan.course.courseNameEn}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>ที่มา (Background)</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.remark || "-"}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>วัตถุประสงค์การเรียนรู้</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.objective}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>หัวข้อการเรียนรู้</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.learningContent}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>วิธีการอบรม</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.methodology}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ประเภทหลักสูตร</span><span className={styles.previewFieldValue}>{plan.course.courseType}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>อายุหลักสูตร (เดือน)</span><span className={styles.previewFieldValue}>{plan.course.lifeCycleMonth}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ผู้เข้าอบรม / รุ่น</span><span className={styles.previewFieldValue}>{plan.participants}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ชั่วโมงอบรม</span><span className={styles.previewFieldValue}>{plan.hours}</span></div>
                                      </div>
                                    </div>

                                    {(() => {
                                      const std = standards.find((item) => item.courseId === plan.course.id);
                                      return (
                                        <div className={styles.previewCard}>
                                          <div className={styles.previewCardHeader}><span>🎯 กลุ่มเป้าหมาย (Target Group)</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>กลุ่มผู้เข้าอบรม</span><span className={styles.previewFieldValue}>{plan.course.targetGroup}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                                            <span className={styles.previewFieldLabel}>Standard Companies</span>
                                            {std?.companies?.length ? (
                                              <span className={styles.previewBadges}>
                                                {std.companies.map((company) => (
                                                  <span key={company} className={styles.previewBadge}>{company}</span>
                                                ))}
                                              </span>
                                            ) : (
                                              <span className={styles.previewFieldValue}>All Companies</span>
                                            )}
                                          </div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                                            <span className={styles.previewFieldLabel}>Org Scope</span>
                                            <span className={styles.previewFieldValue}>
                                              {std
                                                ? [std.functionName, std.division, std.department, std.section].filter(Boolean).join(" / ") || "All Function"
                                                : "No standard defined"}
                                            </span>
                                          </div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                                            <span className={styles.previewFieldLabel}>Standard Positions</span>
                                            {std?.positions.length ? (
                                              <span className={styles.previewBadges}>
                                                {std.positions.map((position) => (
                                                  <span key={position} className={styles.previewBadge}>{position}</span>
                                                ))}
                                              </span>
                                            ) : (
                                              <span className={styles.previewFieldValue}>All Positions</span>
                                            )}
                                          </div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                                            <span className={styles.previewFieldLabel}>Standard Levels</span>
                                            {std?.levels.length ? (
                                              <span className={styles.previewBadges}>
                                                {std.levels.map((level) => (
                                                  <span key={level} className={styles.previewBadge}>{level}</span>
                                                ))}
                                              </span>
                                            ) : (
                                              <span className={styles.previewFieldValue}>All Levels</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    <div className={styles.previewCard}>
                                      <div className={styles.previewCardHeader}><span>📝 แบบทดสอบ / แบบประเมิน</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>แบบทดสอบก่อนเรียน</span><span className={styles.previewFieldValue}>{plan.course.preTest || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>แบบทดสอบหลังเรียน</span><span className={styles.previewFieldValue}>{plan.course.postTest || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>แบบประเมิน</span><span className={styles.previewFieldValue}>{plan.course.evaluation || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>แบบประเมินหลัง 30 วัน</span><span className={styles.previewFieldValue}>{plan.course.evaluationAfter30Day || "-"}</span></div>
                                    </div>

                                    <div className={styles.previewCard}>
                                      <div className={styles.previewCardHeader}><span>💰 Budget</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Instructor Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetInstructor || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Traveling Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetTraveling || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Seminar Room Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetSeminarRoom || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Accommodation Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetAccommodation || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Material Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetMaterial || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Food &amp; Beverage Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetFoodBeverage || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewTotalRow}`}><span className={styles.previewFieldLabel}>Total Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budget).toLocaleString("en-US")}</span></div>
                                    </div>

                                    <div className={styles.previewCard}>
                                      <div className={styles.previewCardHeader}><span>🏫 Institute / Provider</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>วิทยากร</span><span className={styles.previewFieldValue}>{plan.trainer || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ผู้ให้บริการ</span><span className={styles.previewFieldValue}>{plan.providerName || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Created By</span><span className={styles.previewFieldValue}>{plan.owner === "CENTER" ? "Center" : plan.ownerCompany}</span></div>
                                    </div>
                                  </div>
                                  <div className={styles.formActions}>
                                    <button className={styles.dangerButton} disabled={plan.status === "Cancel"} type="button" onClick={() => void updateStatus(plan.id, "Cancel")}>Cancel Plan</button>
                                    <button className={styles.secondaryButton} type="button" onClick={() => setOpenDetailId("")}>Close</button>
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
            </div>
          ))}
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
