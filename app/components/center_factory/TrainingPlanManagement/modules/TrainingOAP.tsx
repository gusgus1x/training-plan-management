"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  APPROVED_TRAINING_NEED_STORAGE_KEY,
  type EmployeeTrainingNeedRequest,
} from "../../../../lib/trainingRequests";
import {
  TRAINING_MASTER_EVENT,
  TRAINING_MASTER_KEYS,
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  getCourseDisplayName,
  getCourseSecondaryName,
  isWorkflowOwner,
  readMasterCollection,
  readWorkflowCollection,
  writeWorkflowCollection,
  type WorkflowCourse,
  type WorkflowOapPlan,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import {
  defaultInstructorRows,
  type InstructorRecord,
} from "../../MasterDataManagement/modules/InstructorData";
import {
  defaultInstituteProviderRows,
  type InstituteProviderRecord,
} from "../../MasterDataManagement/modules/InstituteProviderData";
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

const generateUUID = () => {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OapStatus>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [createdSuccessNotice, setCreatedSuccessNotice] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<InstructorRecord[]>(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.instructors, defaultInstructorRows),
  );
  const [instituteProviders, setInstituteProviders] = useState<InstituteProviderRecord[]>(() =>
    readMasterCollection(
      TRAINING_MASTER_KEYS.instituteProviders,
      defaultInstituteProviderRows,
    ),
  );
  const userCompanyCode = profileValue(user?.companyCode);

  useEffect(() => {
    const syncWorkflowData = () => {
      setCourses(readWorkflowCollection<WorkflowCourse>(TRAINING_WORKFLOW_KEYS.courses));
      setStandards(readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards));
      setPlans(readWorkflowCollection<OapPlan>(TRAINING_WORKFLOW_KEYS.oapPlans));
    };

    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncWorkflowData);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncWorkflowData);
  }, []);

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
    const syncInstructorMaster = () =>
      setInstructors(
        readMasterCollection(
          TRAINING_MASTER_KEYS.instructors,
          defaultInstructorRows,
        ),
      );

    window.addEventListener(TRAINING_MASTER_EVENT, syncInstructorMaster);
    return () =>
      window.removeEventListener(TRAINING_MASTER_EVENT, syncInstructorMaster);
  }, []);

  useEffect(() => {
    const syncInstituteProviderMaster = () =>
      setInstituteProviders(
        readMasterCollection(
          TRAINING_MASTER_KEYS.instituteProviders,
          defaultInstituteProviderRows,
        ),
      );

    window.addEventListener(TRAINING_MASTER_EVENT, syncInstituteProviderMaster);
    return () =>
      window.removeEventListener(TRAINING_MASTER_EVENT, syncInstituteProviderMaster);
  }, []);

  const isFactoryUser = user?.roleCode === "HRD_FACTORY";

  const standardCourseIds = useMemo(
    () =>
      new Set(
        standards
          .filter((standard) => {
            if (isFactoryUser && userCompanyCode) {
              // Factory user: only see standards owned by their own company
              return (
                standard.ownerCompany === userCompanyCode ||
                standard.ownerCompany === "All Companies"
              );
            }
            // Center user: only see Center-owned standards
            return (
              standard.owner === "CENTER" ||
              standard.ownerCompany === "HRD Center" ||
              standard.ownerCompany === "All Companies" ||
              !standard.ownerCompany
            );
          })
          .map((standard) => standard.courseId),
      ),
    [standards, userCompanyCode, isFactoryUser],
  );
  const courseOptions = useMemo(
    () => {
      const standardizedCourses = courses.filter((course) => {
        if (isFactoryUser && userCompanyCode) {
          // Factory user: only show their own company's courses in New OAP dropdown
          return (
            standardCourseIds.has(course.id) &&
            course.ownerCompany === userCompanyCode
          );
        }
        // Center user: only show Center-owned courses in New OAP dropdown
        return (
          standardCourseIds.has(course.id) &&
          (course.owner === "CENTER" ||
            course.ownerCompany === "HRD Center" ||
            course.ownerCompany === "All Companies" ||
            !course.ownerCompany)
        );
      });
      return approvedRequest
        ? [buildRequestCourse(approvedRequest), ...standardizedCourses]
        : standardizedCourses;
    },
    [approvedRequest, courses, standardCourseIds, userCompanyCode, isFactoryUser],
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
      plans.filter((plan) => {
        if (isFactoryUser && userCompanyCode) {
          // Factory users: ONLY see their own company's OAP plans
          return plan.ownerCompany === userCompanyCode;
        }
        return true;
      }),
    [plans, userCompanyCode, isFactoryUser],
  );

  const availableCompanies = useMemo(() => {
    const baseList = ["ATA", "TEP", "ATFB", "NIC", "SATI", "SNF"];
    const planCompanies = scopedPlans
      .map((p) => p.ownerCompany || p.course.ownerCompany)
      .filter((c): c is string => Boolean(c) && c !== "HRD Center" && c !== "All Companies");
    const unique = Array.from(new Set([...baseList, ...planCompanies])).sort();
    return unique;
  }, [scopedPlans]);

  const centerPlanCount = useMemo(
    () =>
      scopedPlans.filter(
        (p) =>
          p.owner === "CENTER" ||
          p.ownerCompany === "HRD Center" ||
          p.course.owner === "CENTER" ||
          p.course.ownerCompany === "HRD Center",
      ).length,
    [scopedPlans],
  );

  const getCompanyPlanCount = (comp: string) => {
    return scopedPlans.filter((plan) => {
      const planStd = standards.find(
        (s) => s.courseId === plan.course.id || s.courseCode === plan.course.courseCode,
      );
      const stdCompanies = planStd?.companies ?? [];
      return (
        plan.ownerCompany === comp ||
        plan.course.ownerCompany === comp ||
        plan.provider === comp ||
        stdCompanies.includes(comp)
      );
    }).length;
  };

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    const planYears = scopedPlans
      .map((plan) => plan.year ?? (plan.course.updatedAt ? plan.course.updatedAt.slice(0, 4) : currentYear))
      .filter(Boolean);
    const uniqueYears = Array.from(new Set([currentYear, "2026", "2025", "2027", ...planYears])).sort((a, b) =>
      b.localeCompare(a),
    );
    return uniqueYears;
  }, [scopedPlans]);

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
            plan.ownerCompany,
            plan.course.ownerCompany,
            plan.year ?? (plan.course.updatedAt ? plan.course.updatedAt.slice(0, 4) : "2026"),
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .filter((plan) => statusFilter === "all" || plan.status === statusFilter)
        .filter((plan) => {
          if (yearFilter === "all") {
            return true;
          }
          const planYear = plan.year ?? (plan.course.updatedAt ? plan.course.updatedAt.slice(0, 4) : "2026");
          return planYear === yearFilter;
        })
        .filter((plan) => {
          if (isFactoryUser) {
            return true;
          }
          if (companyFilter === "all") {
            return true;
          }
          if (companyFilter === "center" || companyFilter === "HRD Center") {
            return (
              plan.owner === "CENTER" ||
              plan.ownerCompany === "HRD Center" ||
              plan.course.owner === "CENTER" ||
              plan.course.ownerCompany === "HRD Center"
            );
          }
          const planStd = standards.find(
            (s) => s.courseId === plan.course.id || s.courseCode === plan.course.courseCode,
          );
          const stdCompanies = planStd?.companies ?? [];
          return (
            plan.ownerCompany === companyFilter ||
            plan.course.ownerCompany === companyFilter ||
            plan.provider === companyFilter ||
            stdCompanies.includes(companyFilter)
          );
        }),
    [scopedPlans, search, statusFilter, yearFilter, companyFilter, standards, isFactoryUser],
  );
  const selectedPlan =
    visiblePlans.find((plan) => plan.id === selectedPlanId) ?? null;

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
      id: `oap-${generateUUID()}`,
      sequence: scopedPlans.length + 1,
      course: selectedCourse,
      participants: form.participants.trim() || "0",
      hours: form.hours.trim() || "0",
      budget: form.budget.trim() || "0",
      trainer: form.trainer.trim() || "Pending trainer",
      provider: form.provider.trim() || "Pending provider",
      createdBy: username,
      status: "Planned",
      year: yearFilter === "all" ? new Date().getFullYear().toString() : yearFilter,
      owner: isFactoryUser ? "FACTORY" : selectedCourse.owner,
      ownerCompany: isFactoryUser
        ? userCompanyCode || "Factory"
        : selectedCourse.ownerCompany ?? "HRD Center",
    };
    savePlans([nextPlan, ...plans]);

    // Automatically create corresponding Rolling Plan entry for Training Rolling
    const existingRolling = readWorkflowCollection<any>(TRAINING_WORKFLOW_KEYS.rollingPlans);
    const newRollingEntry = {
      id: `rolling-${nextPlan.id}`,
      rollingId: `rolling-${nextPlan.id}`,
      sequence: existingRolling.length + 1,
      company: nextPlan.ownerCompany || "All Companies",
      year: nextPlan.year || new Date().getFullYear().toString(),
      month: "01",
      course: {
        code: selectedCourse.courseCode,
        name: getCourseDisplayName(selectedCourse),
        nameTh: selectedCourse.courseNameTh,
        nameEn: selectedCourse.courseNameEn,
        objective: selectedCourse.objective,
        learningContent: selectedCourse.learningContent,
        targetGroup: selectedCourse.targetGroup,
        methodology: selectedCourse.methodology,
        preTest: selectedCourse.preTest,
        postTest: selectedCourse.postTest,
        evaluation: selectedCourse.evaluation,
        evaluationAfter30Day: selectedCourse.evaluationAfter30Day,
        lifeCycleMonth: selectedCourse.lifeCycleMonth,
        courseType: selectedCourse.courseType,
        courseGroup: selectedCourse.courseGroup,
      },
      participants: nextPlan.participants,
      hours: nextPlan.hours,
      budget: nextPlan.budget,
      trainer: nextPlan.trainer,
      provider: nextPlan.provider,
      location: "Pending location",
      trainingDate: `${nextPlan.year || "2026"}-01-15`,
      startTime: "09:00",
      endTime: "16:00",
      status: "Planned",
      owner: nextPlan.createdBy,
      ownerScope: nextPlan.owner,
      ownerCompany: nextPlan.ownerCompany,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    writeWorkflowCollection(TRAINING_WORKFLOW_KEYS.rollingPlans, [newRollingEntry, ...existingRolling]);

    setForm(emptyForm);
    setApprovedRequest(null);
    window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
    setIsNewOpen(false);
    setCreatedSuccessNotice(
      `🎉 บันทึกแผน OAP (${selectedCourse.courseCode}) สำเร็จ! ระบบได้เพิ่มข้อมูลเข้าหน้า Training Rolling ให้เรียบร้อยแล้ว สามารถสลับไปกำหนดวันและรอบอบรมต่อในหน้า Rolling Plan ได้ทันที`
    );
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
    setSelectedPlanId("");
    setSearch("");
    setCompanyFilter("all");
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
        {createdSuccessNotice ? (
          <div className={styles.successNoticeBanner}>
            <span>{createdSuccessNotice}</span>
            <button
              className={styles.successNoticeCloseBtn}
              type="button"
              onClick={() => setCreatedSuccessNotice(null)}
            >
              รับทราบ (Close)
            </button>
          </div>
        ) : null}

        <div className={styles.workspaceHeader}>
          <div>
            <p className={styles.kicker}>Annual plan list</p>
            <h3>Training OAP records</h3>
          </div>
          <span>{visiblePlans.length} shown</span>
        </div>

        {isFactoryUser ? (
          <div className={styles.companyFilterBar}>
            <div className={styles.companyFilterHeader}>
              <span>🏢 Factory Scope</span>
            </div>
            <div className={styles.companyFilterBtnGroup}>
              <span className={`${styles.companyFilterBtn} ${styles.companyFilterBtnActive}`}>
                🏢 โรงงานของคุณ ({userCompanyCode || "Factory Scope"})
                <span className={styles.companyCountBadge}>{scopedPlans.length}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.companyFilterBar}>
            <div className={styles.companyFilterHeader}>
              <span>🏢 Company Filter</span>
            </div>
            <div className={styles.companyFilterBtnGroup}>
              <button
                type="button"
                className={`${styles.companyFilterBtn} ${
                  companyFilter === "all" ? styles.companyFilterBtnActive : ""
                }`}
                onClick={() => setCompanyFilter("all")}
              >
                🌐 ทุกบริษัท (All)
                <span className={styles.companyCountBadge}>{scopedPlans.length}</span>
              </button>

              <button
                type="button"
                className={`${styles.companyFilterBtn} ${
                  companyFilter === "center" ? styles.companyFilterBtnActive : ""
                }`}
                onClick={() => setCompanyFilter("center")}
              >
                🏢 ของตัวเอง ({userCompanyCode && userCompanyCode !== "HRD Center" ? userCompanyCode : "Center"})
                <span className={styles.companyCountBadge}>{centerPlanCount}</span>
              </button>

              {availableCompanies.map((comp) => {
                const count = getCompanyPlanCount(comp);
                return (
                  <button
                    key={comp}
                    type="button"
                    className={`${styles.companyFilterBtn} ${
                      companyFilter === comp ? styles.companyFilterBtnActive : ""
                    }`}
                    onClick={() => setCompanyFilter(comp)}
                  >
                    {comp}
                    <span className={styles.companyCountBadge}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            <label className={styles.filterBox}>
              <span>Company</span>
              <select
                disabled={isFactoryUser}
                value={isFactoryUser ? (userCompanyCode || "factory") : companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
              >
                {isFactoryUser ? (
                  <option value={userCompanyCode || "factory"}>
                    {userCompanyCode || "Factory Scope"} (โรงงานของคุณ)
                  </option>
                ) : (
                  <>
                    <option value="all">ทุกบริษัท (All Companies)</option>
                    <option value="center">
                      ของตัวเอง ({userCompanyCode && userCompanyCode !== "HRD Center" ? userCompanyCode : "Center"})
                    </option>
                    {availableCompanies.map((comp) => (
                      <option key={comp} value={comp}>
                        {comp}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>
            <label className={styles.filterBox}>
              <span>Year</span>
              <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                <option value="all">All years</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
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
            <label className={styles.searchBox}>
              <span>Search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Course, trainer, provider, status" />
            </label>
          </div>
          <div className={styles.toolbarActions}>
            <button className={styles.primaryButton} disabled={courseOptions.length === 0} type="button" onClick={handleNew}>New</button>
            <button className={styles.secondaryButton} disabled={!selectedPlan} type="button" onClick={() => selectedPlan && handleEdit(selectedPlan)}>Edit</button>
            <button className={styles.dangerButton} disabled={!selectedPlan} type="button" onClick={() => selectedPlan && handleDelete(selectedPlan.id)}>Delete</button>
            <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>Refresh</button>
          </div>
        </div>

        <p className={styles.selectionHint} aria-live="polite">
          {selectedPlan
            ? `Selected: ${selectedPlan.course.courseCode} / ${getCourseDisplayName(selectedPlan.course)}`
            : "Select a row using the circle under Seq. to Edit or Delete."}
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
                    return <option key={instructor.id} value={fullName}>{instructor.education}</option>;
                  })}
                </datalist>
              </label>
              <label>
                Institute / Provider
                <input
                  list="institute-provider-master-options"
                  disabled={!selectedCourse}
                  placeholder="Enter provider, e.g. HRD Center or institute name"
                  value={form.provider}
                  onChange={(event) => updateForm("provider", event.target.value)}
                />
                <datalist id="institute-provider-master-options">
                  <option value="HRD Center">HRD Center</option>
                  {instituteProviders.map((provider) => (
                    <option key={provider.id} value={provider.name}>
                      {provider.code !== provider.name
                        ? `[${provider.code}] ${provider.name}`
                        : provider.name}
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
                    {selectedCourseStandard?.section ? (
                      <div className={styles.previewFieldRow}>
                        <span className={styles.previewFieldLabel}>Section (แผนก)</span>
                        <span className={styles.previewFieldValue}>{selectedCourseStandard.section}</span>
                      </div>
                    ) : null}
                    {selectedCourseStandard?.department ? (
                      <div className={styles.previewFieldRow}>
                        <span className={styles.previewFieldLabel}>Department (ส่วน)</span>
                        <span className={styles.previewFieldValue}>{selectedCourseStandard.department}</span>
                      </div>
                    ) : null}
                    {selectedCourseStandard?.division ? (
                      <div className={styles.previewFieldRow}>
                        <span className={styles.previewFieldLabel}>Division (ฝ่าย)</span>
                        <span className={styles.previewFieldValue}>{selectedCourseStandard.division}</span>
                      </div>
                    ) : null}
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
                    <tr
                      className={plan.id === selectedPlanId ? styles.selectedRow : undefined}
                      onClick={() => setSelectedPlanId(plan.id)}
                      style={{ cursor: "pointer" }}
                    >
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
                          {" · "}
                          <span className={styles.companyBadgeInline}>
                            🏢 {plan.ownerCompany || plan.course.ownerCompany || "HRD Center"}
                          </span>
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
