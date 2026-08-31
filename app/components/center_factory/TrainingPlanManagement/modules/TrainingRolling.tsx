"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  getCourseDisplayName,
  isWorkflowOwner,
  type WorkflowCourse,
  type WorkflowOwner,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { getCourseOutlineFileName } from "../../../../lib/courseOutlineExport";
import { listCourses } from "../../../../lib/courses/client";
import { calculateBudgetEstimate, formatBaht } from "../../../../lib/trainingBudgetEstimate";
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
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import TypewriterLoader from "../../../TypewriterLoader";
import SearchableSelect from "../../../SearchableSelect";
import styles from "./TrainingRolling.module.css";

export const trainingRollingModule = {
  title: "Training Rolling",
  subtitle: "Monthly training plan",
  description: "Convert annual OAP items into monthly rolling training schedules.",
} as const;

export type RollingStatus = "Planning" | "Planned" | "Cancel";

// Matches the bespoke course-detail shape every other rolling-plan consumer
// (TrainingAcceptSurvey, TrainingActual, TrainingRecord, ScheduleCalendar,
// SummaryDashboard, RegisterTrainingModule, UserDashboard, trainingFinanceSummary)
// already reads via plan.course.code / plan.course.name, kept separate from
// WorkflowCourse so those files don't need touching.
export type RollingCourseDetail = {
  id?: string;
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
  preTestLink?: string;
  postTestLink?: string;
  evaluationLink?: string;
  evaluationAfter30DayLink?: string;
  lifeCycleMonth: string;
  courseType: string;
  courseGroup: string;
  remark: string;
  targetPositions?: string[];
  targetLevels?: string[];
  targetCompanies?: string[];
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
  budgetInstructor: string;
  budgetTraveling: string;
  budgetSeminarRoom: string;
  budgetAccommodation: string;
  budgetMaterial: string;
  budgetFoodBeverage: string;
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
  dbStatus?: string;
  updatedAt: string;
};

const RequiredIndicator = ({ isFilled }: { isFilled: boolean }) => (
  <span
    className={isFilled ? styles.indicatorDone : styles.indicatorPending}
    title={isFilled ? "กรอกข้อมูลเรียบร้อยแล้ว / Completed" : "จำเป็นต้องกรอก / Required field"}
  >
    <span className={styles.indicatorDot} />
  </span>
);

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
  id: course.id,
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
  preTestLink: course.preTestLink,
  postTestLink: course.postTestLink,
  evaluationLink: course.evaluationLink,
  evaluationAfter30DayLink: course.evaluationAfter30DayLink,
  lifeCycleMonth: course.lifeCycleMonth,
  courseType: course.courseType,
  courseGroup: course.courseGroup,
  remark: course.remark || "",
  targetPositions: (course as unknown as Record<string, unknown>).targetPositions as string[] || [],
  targetLevels: (course as unknown as Record<string, unknown>).targetLevels as string[] || [],
  targetCompanies: (course as unknown as Record<string, unknown>).targetCompanies as string[] || [],
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
    budgetInstructor: record.oapBudgetInstructor,
    budgetTraveling: record.oapBudgetTraveling,
    budgetSeminarRoom: record.oapBudgetSeminarRoom,
    budgetAccommodation: record.oapBudgetAccommodation,
    budgetMaterial: record.oapBudgetMaterial,
    budgetFoodBeverage: record.oapBudgetFoodBeverage,
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
    status: record.status,
    dbStatus: record.dbStatus,
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
  status: RollingStatus;
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

const createEmptySession = (index = 0, batchName = ""): RollingSessionForm => ({
  id: `session-${Date.now()}-${index}`,
  dbId: null,
  status: "Planning",
  batchName,
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

export const getJobStatus = (item: { status?: RollingStatus; trainingDate: string; dbStatus?: string }) => {
  if (item.status === "Planning" || item.status === "Cancel") {
    return "Planning";
  }
  if (item.dbStatus === "COMPLETED") {
    return "Completed";
  }
  return "Rolling";
};

// A published session can be pulled back until its training day arrives; after that the
// session has already run, so cancelling it would rewrite history instead of a plan.
// Only published sessions cancel — drafts are deleted outright.
export const canCancelSession = (
  plan: { status?: RollingStatus; trainingDate: string },
  now: Date = new Date(),
) => {
  if (plan.status !== "Planned") return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return new Date(`${plan.trainingDate}T00:00:00`) >= today;
};

const ROLLING_PAGE_SIZE = 25;
const PAGE_WINDOW_SIZE = 5;

// Same sliding page window Employee Data uses, so both screens paginate identically.
const pageWindow = (current: number, totalPages: number) => {
  if (totalPages <= PAGE_WINDOW_SIZE) return { start: 1, end: totalPages };
  let start = Math.max(1, current - Math.floor(PAGE_WINDOW_SIZE / 2));
  let end = start + PAGE_WINDOW_SIZE - 1;
  if (end > totalPages) {
    end = totalPages;
    start = end - PAGE_WINDOW_SIZE + 1;
  }
  return { start, end };
};

export default function TrainingRolling() {
  const { language } = useUiLanguage();
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();
  const userCompanyCode = profileValue(user?.companyCode);
  const [oapPlans, setOapPlans] = useState<OapPlanRecord[]>([]);
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [standards, setStandards] = useState<WorkflowStandard[]>([]);
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
  const [deletedSessionDbIds, setDeletedSessionDbIds] = useState<string[]>([]);
  // Tracks the CLOSED sections, not the open ones, so every section — including a company
  // that only appears after a filter change — starts expanded without seeding state for it.
  const [closedSections, setClosedSections] = useState<string[]>([]);
  const [sectionPage, setSectionPage] = useState<Record<string, number>>({});

  const isSectionOpen = (key: string) => !closedSections.includes(key);
  const toggleSection = (key: string) =>
    setClosedSections((current) =>
      current.includes(key) ? current.filter((closedKey) => closedKey !== key) : [...current, key],
    );

  const [isLoading, setIsLoading] = useState(true);

  const loadWorkspace = async () => {
    setIsLoading(true);
    try {
      const [oapData, rollingData, courseData] = await Promise.all([
        listOapPlans({ search: null, status: null }),
        loadWorkflowRollingPlans(),
        listCourses({ search: "", status: null }),
      ]);
      setOapPlans(oapData.oapPlans || []);
      setRollingPlans(rollingData);
      setStandards(courseData.standards || []);
    } catch (error) {
      console.error("Failed to load Training Rolling workspace", error);
      setOapPlans([]);
      setRollingPlans([]);
      setStandards([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const isCenterUser = user?.roleCode === "HRD_CENTER";

  const oapSources = useMemo(
    () =>
      oapPlans.filter(
        (plan) => {
          if (plan.status === "Cancel") return false;
          if (isFactoryUser) {
            return (
              plan.owner === "FACTORY" &&
              plan.ownerCompany === userCompanyCode
            );
          }
          if (isCenterUser) {
            return (
              plan.owner === "CENTER" ||
              plan.ownerCompany === "CENTER" ||
              plan.ownerCompany === "HRD Center" ||
              !plan.ownerCompany
            );
          }
          return isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode);
        },
      ),
    [oapPlans, user?.roleCode, userCompanyCode, isFactoryUser, isCenterUser],
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
        .sort(
          (a, b) =>
            a.trainingDate.localeCompare(b.trainingDate) ||
            (a.startTime || "").localeCompare(b.startTime || ""),
        )
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
              getJobStatus(plan),
            ]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase())
          );
        }),
    [companyFilter, scopedRollingPlans, search, selectedMonth, selectedYear, statusFilter],
  );

  const factoryCourseTypeAllowlist = ["IN-HOUSE", "PUBLIC", "OJT"];

  const getStatusLabel = (status: string) => {
    if (language === "en") {
      if (status === "Planned") return "Planned";
      if (status === "Planning") return "Planning";
      if (status === "Cancel") return "Cancelled";
      return status;
    }
    if (status === "Planned") return "วางแผนแล้ว";
    if (status === "Planning") return "รอวางแผน";
    if (status === "Cancel") return "ยกเลิก";
    return status;
  };

  // Same center-ownership test the group rows already do inline; named once so the
  // merged session table applies the identical factory read-only rule.
  const isCenterOwned = (plan: RollingPlan) =>
    plan.ownerScope === "CENTER" ||
    plan.ownerCompany === "HRD Center" ||
    plan.ownerName === "Center HRD" ||
    plan.provider === "HRD Center" ||
    plan.owner === "CENTER" ||
    plan.company === "All Companies";

  const allCompanyCodes = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

  const companyColumns = useMemo(() => {
    const userComp = userCompanyCode && userCompanyCode !== "CENTER" ? userCompanyCode : "";
    if (userComp && allCompanyCodes.includes(userComp as any)) {
      return [userComp, ...allCompanyCodes.filter((c) => c !== userComp)];
    }
    return [...allCompanyCodes];
  }, [userCompanyCode]);

  const isCompanyIncludedInRolling = (plan: RollingPlan, company: string) => {
    if (plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.company === "All Companies") {
      return true;
    }
    const companies = getRollingPlanCompanies(plan);
    return companies.includes(company) || plan.ownerCompany === company || plan.company === company;
  };

  const isCompanyOwnerOfRolling = (plan: RollingPlan, company: string) => {
    if (plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center") {
      return false;
    }
    return plan.ownerCompany === company || plan.company === company;
  };

  const getCompanySortWeight = (plan: RollingPlan) => {
    const currentUserCompany = userCompanyCode || "CENTER";
    const planCompanies = getRollingPlanCompanies(plan);
    const planOwner = plan.ownerCompany || plan.company;

    if (
      planOwner === currentUserCompany ||
      planCompanies.includes(currentUserCompany) ||
      (currentUserCompany === "CENTER" && (plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.company === "All Companies"))
    ) {
      return 0;
    }
    if (plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.company === "All Companies") {
      return 1;
    }
    return 2;
  };

  const visiblePlanGroups = useMemo(() => {
    const groups = new Map<string, RollingPlan[]>();

    visiblePlans.forEach((plan) => {
      groups.set(plan.scheduleGroupId, [...(groups.get(plan.scheduleGroupId) ?? []), plan]);
    });

    const mappedGroups = [...groups.entries()].map(([id, plans]) => {
      const sortedPlans = [...plans].sort(
        (a, b) =>
          a.trainingDate.localeCompare(b.trainingDate) ||
          (a.startTime || "").localeCompare(b.startTime || ""),
      );
      return {
        id,
        plans: sortedPlans,
        firstPlan: sortedPlans[0],
      };
    });

    return mappedGroups
      .sort((groupA, groupB) => {
        const dateA = groupA.firstPlan.trainingDate;
        const dateB = groupB.firstPlan.trainingDate;
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        const timeA = groupA.firstPlan.startTime || "";
        const timeB = groupB.firstPlan.startTime || "";
        if (timeA !== timeB) return timeA.localeCompare(timeB);

        const weightA = getCompanySortWeight(groupA.firstPlan);
        const weightB = getCompanySortWeight(groupB.firstPlan);
        if (weightA !== weightB) return weightA - weightB;

        const companyA = formatRollingPlanCompanies(groupA.firstPlan);
        const companyB = formatRollingPlanCompanies(groupB.firstPlan);
        return companyA.localeCompare(companyB);
      })
      .map((group, index) => ({
        id: group.id,
        plans: group.plans,
        sequence: index + 1,
      }));
  }, [visiblePlans, userCompanyCode]);
  const companyPlanGroups = useMemo(() => {
    const groupsMap = new Map<string, typeof visiblePlanGroups>();

    visiblePlanGroups.forEach((group) => {
      const plan = group.plans[0];
      const isCenter = plan?.ownerScope === "CENTER" || plan?.ownerCompany === "HRD Center" || plan?.ownerName === "Center HRD" || plan?.provider === "HRD Center";
      const compKey = isCenter ? "HRD Center" : (plan?.ownerCompany || plan?.company || "Other");

      groupsMap.set(compKey, [...(groupsMap.get(compKey) ?? []), group]);
    });

    const userCompLabel = userCompanyCode && userCompanyCode !== "CENTER" ? userCompanyCode : "";

    const entries = [...groupsMap.entries()].map(([companyName, groupList]) => ({
      companyName,
      groups: groupList,
      isUserCompany: userCompLabel ? companyName === userCompLabel : companyName === "HRD Center",
    }));

    return entries.sort((a, b) => {
      if (a.isUserCompany && !b.isUserCompany) return -1;
      if (!a.isUserCompany && b.isUserCompany) return 1;

      if (a.companyName === "HRD Center") return -1;
      if (b.companyName === "HRD Center") return 1;

      return a.companyName.localeCompare(b.companyName);
    });
  }, [visiblePlanGroups, userCompanyCode]);

  const selectedGroup =
    visiblePlanGroups.find((group) => group.id === selectedGroupId) ?? null;
  const isSelectedGroupCenter = selectedGroup
    ? (selectedGroup.plans[0]?.ownerScope === "CENTER" ||
       selectedGroup.plans[0]?.ownerCompany === "HRD Center" ||
       selectedGroup.plans[0]?.ownerName === "Center HRD" ||
       selectedGroup.plans[0]?.provider === "HRD Center")
    : false;
  const isSelectedGroupReadOnlyForFactory = isFactoryUser && isSelectedGroupCenter;

  const getNextBatchNumber = (oapId: string): string => {
    if (!oapId) return "1";
    const matchingPlans = rollingPlans.filter((p) => p.oapId === oapId);
    const targetOap = oapPlans.find((o) => o.id === oapId);
    const courseCode = targetOap?.course?.courseCode;
    const sameCoursePlans = courseCode
      ? rollingPlans.filter((p) => p.course?.code === courseCode || p.oapId === oapId)
      : matchingPlans;

    const plansToScan = sameCoursePlans.length > 0 ? sameCoursePlans : matchingPlans;
    if (plansToScan.length === 0) return "1";

    let maxBatch = 0;
    for (const plan of plansToScan) {
      if (typeof plan.batchNo === "number" && !isNaN(plan.batchNo) && plan.batchNo > maxBatch) {
        maxBatch = plan.batchNo;
      }
      if (plan.batch) {
        const matches = plan.batch.match(/\d+/g);
        if (matches) {
          for (const m of matches) {
            const num = parseInt(m, 10);
            if (!isNaN(num) && num > maxBatch) {
              maxBatch = num;
            }
          }
        }
      }
    }
    return String(maxBatch + 1);
  };

  const updateOap = (value: string) => {
    const nextBatch = getNextBatchNumber(value);
    setForm((current) => {
      const isInitialOrNumeric = current.sessions.every(
        (s) => !s.batchName || /^\d+$/.test(s.batchName.trim())
      );
      return {
        ...current,
        oapId: value,
        sessions: current.sessions.map((session) => ({
          ...session,
          batchName: isInitialOrNumeric || !session.batchName ? nextBatch : session.batchName,
        })),
      };
    });
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
    const prevSession = form.sessions[form.sessions.length - 1];
    const defaultBatch =
      prevSession?.batchName?.trim() || getNextBatchNumber(form.oapId);
    setForm((current) => ({
      ...current,
      sessions: [
        ...current.sessions,
        createEmptySession(current.sessions.length, defaultBatch),
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
    const missingFields: string[] = [];

    if (!selectedOap) {
      missingFields.push("แผน OAP (OAP Plan) — เลือกแผนจากตารางก่อน");
    }
    if (form.sessions.length === 0) {
      missingFields.push("รุ่นการอบรม (Session) — เพิ่มอย่างน้อย 1 รุ่น");
    }
    form.sessions.forEach((session, index) => {
      const label = session.batchName.trim() || `รุ่นที่ ${index + 1} (Session ${index + 1})`;
      if (!session.location.trim()) {
        missingFields.push(`สถานที่อบรมของ ${label} (Location)`);
      }
      if (!session.trainingDate) {
        missingFields.push(`วันที่เริ่มอบรมของ ${label} (Start Date)`);
      }
    });

    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    if (!selectedOap) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    // Read before the form is reset below, otherwise the toast reports 0.
    const sessionCount = form.sessions.length;

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
      toast.success(
        `บันทึกแผน Rolling ${sessionCount} รุ่นแล้ว / Saved ${sessionCount} session(s)`,
      );
    } catch (error) {
      console.error("Failed to save Training Rolling plan", error);
      toast.error("บันทึกแผน Rolling ไม่สำเร็จ / Failed to save Training Rolling plan");
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
        status: p.status,
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
    if (!(await confirm({ message: { th: `ยืนยันที่จะลบรุ่นการอบรมทั้ง ${group.plans.length} รุ่นของ "${courseName}" หรือไม่?`, en: `Confirm deleting all ${group.plans.length} session(s) for "${courseName}"?` }, danger: true }))) {
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
      toast.success(
        `ลบแผน Rolling ${group.plans.length} รุ่นแล้ว / Deleted ${group.plans.length} session(s)`,
      );
    } catch (error) {
      console.error("Failed to delete Training Rolling plan", error);
      toast.error("ลบแผน Rolling ไม่สำเร็จ / Failed to delete Training Rolling plan");
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
          status: plan.status,
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
    if (!(await confirm({ message: { th: "ยืนยันที่จะลบรุ่นการอบรมนี้หรือไม่?", en: "Confirm deleting this session?" }, danger: true }))) {
      return;
    }
    try {
      await deleteRollingPlan(rollingId);
      if (openDetailId === rollingId) {
        setOpenDetailId("");
      }
      await loadWorkspace();
      toast.success("ลบรุ่นการอบรมแล้ว / Session deleted");
    } catch (error) {
      console.error("Failed to delete Training Rolling plan", error);
      toast.error("ลบรุ่นการอบรมไม่สำเร็จ / Failed to delete Training Rolling plan");
    }
  };

  const handleCancelSession = async (plan: RollingPlan) => {
    if (
      !(await confirm({
        message: {
          th: "ยืนยันที่จะยกเลิกรุ่นการอบรมที่เผยแพร่แล้วหรือไม่? พนักงานจะไม่เห็นและลงทะเบียนไม่ได้อีก",
          en: "Confirm cancelling this published session? Employees can no longer see or enrol.",
        },
        danger: true,
      }))
    ) {
      return;
    }
    try {
      await updateRollingPlan(plan.rollingId, { status: "Cancel" });
      await loadWorkspace();
      toast.success("ยกเลิกรุ่นการอบรมที่เผยแพร่แล้ว / Published session cancelled");
    } catch (error) {
      console.error("Failed to cancel Training Rolling session", error);
      toast.error("ยกเลิกรุ่นการอบรมไม่สำเร็จ / Failed to cancel Training Rolling session");
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
      preTestLink: plan.course.preTestLink,
      postTestLink: plan.course.postTestLink,
      evaluationLink: plan.course.evaluationLink,
      evaluationAfter30DayLink: plan.course.evaluationAfter30DayLink,
      lifeCycleMonth: plan.course.lifeCycleMonth,
      courseType: plan.course.courseType,
      courseGroup: plan.course.courseGroup,
      remark: plan.course.remark || "",
      status: "Active",
      updatedAt: plan.updatedAt,
      owner: plan.owner,
      ownerCompany: plan.ownerCompany,
      createdBy: plan.ownerName,
    };

    const schedule = {
      date: plan.trainingDate || "",
      time: [plan.startTime, plan.endTime].filter(Boolean).join(" - ") || (plan.hours ? `${plan.hours} ชั่วโมง` : ""),
      location: plan.location || "",
    };

    const budget = {
      budgetInstructor: plan.budgetInstructor,
      budgetTraveling: plan.budgetTraveling,
      budgetSeminarRoom: plan.budgetSeminarRoom,
      budgetAccommodation: plan.budgetAccommodation,
      budgetMaterial: plan.budgetMaterial,
      budgetFoodBeverage: plan.budgetFoodBeverage,
      totalBudget: plan.budget,
    };

    setExportingPlanId(plan.rollingId);

    try {
      const response = await fetch("/api/course-master/course-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course,
          standard: standards.find((item) => item.courseId === course.id) ?? null,
          oapPlan,
          schedule,
          budget,
        }),
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
      downloadLink.download = getCourseOutlineFileName(course, schedule);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      toast.success(`ดาวน์โหลด Course Outline ${course.courseCode} แล้ว / Course Outline exported`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ส่งออก Course Outline ไม่สำเร็จ / Unable to export Course Outline",
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
    if (!(await confirm({ message: { th: "ยืนยันที่จะเผยแพร่รุ่นการอบรมนี้หรือไม่? พนักงานจะมองเห็นและลงทะเบียนได้ทันที", en: "Confirm publishing this session? Employees can see and enrol immediately." } }))) return;
    try {
      await updateRollingPlan(rollingId, { status: "Planned" });
      await loadWorkspace();
      toast.success("เผยแพร่รุ่นการอบรมแล้ว พนักงานลงทะเบียนได้ทันที / Session published");
    } catch (error) {
      console.error("Failed to publish Training Rolling plan", error);
      toast.error("เผยแพร่รุ่นการอบรมไม่สำเร็จ / Failed to publish Training Rolling plan");
    }
  };

  if (isLoading) {
    return (
      <section className={styles.page} aria-label="Training Rolling monthly plan">
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{trainingRollingModule.subtitle}</p>
            <h2>{trainingRollingModule.title}</h2>
            <p>{trainingRollingModule.description}</p>
          </div>
        </section>
        <TypewriterLoader label="กำลังโหลดข้อมูลแผนการอบรมรายเดือน (Rolling Plan)..." />
      </section>
    );
  }

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
                  <option value="Cancel">Cancel</option>
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
              <div className={styles.fullField}>
                <span>Course Name <RequiredIndicator isFilled={Boolean(form.oapId)} /></span>
                <SearchableSelect
                  options={oapSources.map((source) => {
                    const tag = source.course.courseGroup || source.course.courseType;
                    return {
                      value: source.id,
                      label: `[${source.course.courseCode}] ${getCourseDisplayName(source.course)}`,
                      secondaryLabel: `แผน OAP #${source.id}: ${source.participants} คน • ${source.hours} ชม. • ${source.ownerCompany || source.owner}`,
                      badge: tag || undefined,
                    };
                  })}
                  value={form.oapId}
                  onChange={(oapId) => updateOap(oapId)}
                  placeholder="🔍 พิมพ์เพื่อค้นหาหลักสูตร/แผน OAP... / Search course or OAP plan..."
                />
              </div>

              <div className={`${styles.fullField} ${styles.sessionSection}`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <strong>Training sessions</strong>
                    <span>Add another session when the course has a different batch, date, time, or location.</span>
                  </div>
                  <button className={styles.addSessionButton} disabled={!selectedOap} type="button" onClick={addSession}>
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
                          disabled={!selectedOap || form.sessions.length === 1 || session.status !== "Planning"}
                          title={session.status !== "Planning" ? "Published sessions must be cancelled from the detail panel." : undefined}
                          type="button"
                          onClick={() => removeSession(session.id)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className={styles.sessionGrid}>
                        <label>
                          <span>{language === 'th' ? 'รุ่นการอบรม (Batch)' : 'Batch'} <RequiredIndicator isFilled={Boolean(session.batchName.trim())} /></span>
                          <input
                            disabled={!selectedOap}
                            placeholder={language === 'th' ? "เช่น 1, 2 หรือระบุชื่อรุ่น" : "Optional label, e.g. 1, 2 or Batch label"}
                            value={session.batchName}
                            onChange={(event) =>
                              updateSession(session.id, "batchName", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Location <RequiredIndicator isFilled={Boolean(session.location.trim())} /></span>
                          <input
                            disabled={!selectedOap}
                            value={session.location}
                            onChange={(event) =>
                              updateSession(session.id, "location", event.target.value)
                            }
                          />
                        </label>

                        <label>
                          <span>Start Date (วันที่เริ่ม) <RequiredIndicator isFilled={Boolean(session.trainingDate.trim())} /></span>
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
                          <span>End Date (วันที่สิ้นสุด) <RequiredIndicator isFilled={Boolean((session.endDate || session.trainingDate).trim())} /></span>
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
                          <span>Start Time (เวลาเริ่ม) <RequiredIndicator isFilled={Boolean(session.startTime.trim())} /></span>
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
                          <span>End Time (เวลาสิ้นสุด) <RequiredIndicator isFilled={Boolean(session.endTime.trim())} /></span>
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
                      <span className={styles.previewBadge} translate="no">
                        📂 {selectedOap.course.courseGroup}
                      </span>
                    ) : null}
                    <span className={styles.previewBadge}>
                      ⏱️ {!selectedOap.course.lifeCycleMonth || selectedOap.course.lifeCycleMonth === "0" || Number(selectedOap.course.lifeCycleMonth) === 0 ? "ไม่มีการหมดอายุ" : `${selectedOap.course.lifeCycleMonth} Months`}
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
                      <span className={styles.previewFieldLabel}>ที่มา (Background)</span>
                      <span className={styles.previewFieldValue}>{selectedOap.course.remark || "-"}</span>
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

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>👥 กลุ่มเป้าหมายมาตรฐาน (Standard Target)</span>
                    </div>
                    {(() => {
                      const std = standards.find((item) => item.courseId === selectedOap.course.id);
                      return (
                        <>
                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                            <span className={styles.previewFieldLabel}>Companies</span>
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
                            <span className={styles.previewFieldLabel}>Positions</span>
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
                            <span className={styles.previewFieldLabel}>Levels</span>
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
                        </>
                      );
                    })()}
                  </div>

                  <div className={`${styles.previewCard} ${styles.previewCardFull}`}>
                    <div className={styles.previewCardHeader}>
                      <span>📋 Assessments & Evaluation</span>
                    </div>
                    <div className={styles.assessmentGrid}>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Pre-Test</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.preTest || selectedOap.course.preTestLink || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Post-Test</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.postTest || selectedOap.course.postTestLink || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>Course Evaluation</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.evaluation || selectedOap.course.evaluationLink || "None"}</strong>
                      </div>
                      <div className={styles.assessmentItem}>
                        <span className={styles.previewFieldLabel}>30-Day Follow-Up</span>
                        <strong className={styles.previewFieldValue}>{selectedOap.course.evaluationAfter30Day || selectedOap.course.evaluationAfter30DayLink || "None"}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={styles.formActions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => void handleSave()}
              >
                {form.sessions.some((session) => session.dbId) ? "Save changes" : "Save Draft"}
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => { setForm(createEmptyForm()); setIsNewOpen(false); }}>Cancel</button>
            </div>
          </section>
        ) : null}

        <div className={styles.companySectionsContainer}>
          {companyPlanGroups.map((companySection) => {
            const sessions = companySection.groups
              .flatMap((group) => group.plans.map((plan) => ({ ...plan, group })))
              .sort(
                (a, b) =>
                  a.trainingDate.localeCompare(b.trainingDate) ||
                  (a.startTime || "").localeCompare(b.startTime || ""),
              );
            const totalPages = Math.max(1, Math.ceil(sessions.length / ROLLING_PAGE_SIZE));
            const page = Math.min(sectionPage[companySection.companyName] ?? 1, totalPages);
            const pageStart = (page - 1) * ROLLING_PAGE_SIZE;
            const { start: windowStart, end: windowEnd } = pageWindow(page, totalPages);
            const goToPage = (pageNumber: number) =>
              setSectionPage((current) => ({ ...current, [companySection.companyName]: pageNumber }));
            const section = {
              ...companySection,
              pageStart,
              pageSessions: sessions.slice(pageStart, pageStart + ROLLING_PAGE_SIZE),
            };

            return (
            <div
              key={section.companyName}
              className={`${styles.companySectionBlock} ${isSectionOpen(section.companyName) ? styles.openSection : ""}`}
            >
              <button
                className={`${styles.companySectionHeader} ${section.isUserCompany ? styles.ownCompanySectionHeader : ""}`}
                type="button"
                aria-expanded={isSectionOpen(section.companyName)}
                onClick={() => toggleSection(section.companyName)}
              >
                <div className={styles.companySectionTitle}>
                  <span className={styles.chevron} aria-hidden="true" />
                  <span className={styles.companyIcon}>{section.companyName === "HRD Center" ? "🏢" : "🏬"}</span>
                  <h4>แผนอบรม {section.companyName}</h4>
                  {section.isUserCompany ? <span className={styles.ownCompanySectionTag}>⭐ บริษัทของฉัน ({userCompanyCode || "HRD Center"})</span> : null}
                </div>
                <span className={styles.companyCountBadge} translate="no">{sessions.length} รอบอบรม</span>
              </button>

              {!isSectionOpen(section.companyName) ? null : (
              <div className={styles.tableWrap}>
                <table className={styles.rollingTable}>
                  <thead>
                    <tr>
                      <th>Seq.</th>
                      <th>Course Name</th>
                      <th>Course Group</th>
                      <th>Batch</th>
                      <th>Date &amp; Time</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Job Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.pageSessions.map((plan, index) => {
                      const group = plan.group;
                      const isOpen = openDetailId === plan.rollingId;
                      const isCenterGroup = isCenterOwned(plan);
                      const isRowReadOnlyForFactory = isFactoryUser && isCenterGroup;
                      const jobStatus = getJobStatus(plan);

                      return (
                        <Fragment key={plan.rollingId}>
                          <tr
                            className={`${group.id === selectedGroupId ? styles.selectedRow : ""} ${styles.clickableRow}`}
                            onClick={() => setSelectedGroupId(group.id === selectedGroupId ? "" : group.id)}
                          >
                            <td>
                              <label className={styles.selectionControl} onClick={(e) => e.stopPropagation()}>
                                <input
                                  aria-label={`Select ${plan.course.code} ${plan.batch}`}
                                  checked={group.id === selectedGroupId}
                                  name="selected-rolling-group"
                                  type="radio"
                                  onChange={() => setSelectedGroupId(group.id)}
                                />
                                <span translate="no">{section.pageStart + index + 1}</span>
                              </label>
                            </td>
                            <td>
                              <strong>{plan.course.name}</strong>
                              <span>{plan.course.code}</span>
                              {isCenterGroup ? (
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
                            <td translate="no">{plan.course.courseGroup || "-"}</td>
                            <td translate="no">{plan.batch}</td>
                            <td translate="no">
                              {plan.trainingDate}
                              <span>{plan.startTime} - {plan.endTime}</span>
                            </td>
                            <td translate="no">{plan.location || "-"}</td>
                            <td>
                              <span className={`${styles.statusPill} ${styles[`status${plan.status}`]}`}>
                                <span className={styles.statusDot} />
                                {getStatusLabel(plan.status)}
                              </span>
                            </td>
                            <td><span className={`${styles.jobPill} ${styles[`job${jobStatus}`]}`}>{jobStatus}</span></td>
                            <td className={styles.actionCell} onClick={(e) => e.stopPropagation()}>
                              <div className={styles.actionButtons}>
                                <button className={styles.detailButton} type="button" onClick={() => setOpenDetailId(isOpen ? "" : plan.rollingId)}>
                                  {isOpen ? "Hide" : "Details"}
                                </button>
                                <button
                                  className={styles.secondaryButton}
                                  disabled={isRowReadOnlyForFactory || plan.status === "Cancel"}
                                  title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้ (ส่งผู้เข้าร่วมได้ใน Training Accept Survey)" : undefined}
                                  type="button"
                                  onClick={() => {
                                    if (isRowReadOnlyForFactory) return;
                                    setSelectedGroupId(group.id);
                                    handleEditSession(plan);
                                  }}
                                >
                                  Edit
                                </button>
                                {plan.status === "Planning" ? (
                                  <>
                                    <button
                                      className={styles.dangerButton}
                                      disabled={isRowReadOnlyForFactory}
                                      title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : undefined}
                                      type="button"
                                      onClick={() => !isRowReadOnlyForFactory && void handleDelete(plan.rollingId)}
                                    >
                                      Delete
                                    </button>
                                    <button
                                      className={styles.primaryButton}
                                      disabled={isRowReadOnlyForFactory}
                                      title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถเผยแพร่ได้" : undefined}
                                      type="button"
                                      onClick={() => !isRowReadOnlyForFactory && void handleConfirm(plan.rollingId)}
                                    >
                                      Publish
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className={styles.dangerButton}
                                    disabled={isRowReadOnlyForFactory || !canCancelSession(plan)}
                                    title={
                                      isRowReadOnlyForFactory
                                        ? "HRD Center sessions cannot be cancelled by a factory."
                                        : plan.status === "Cancel"
                                        ? "This session has already been cancelled."
                                        : !canCancelSession(plan)
                                        ? "The training date has passed, so this session can no longer be cancelled."
                                        : undefined
                                    }
                                    type="button"
                                    onClick={() => !isRowReadOnlyForFactory && void handleCancelSession(plan)}
                                  >
                                    {plan.status === "Cancel" ? "Cancelled" : "Cancel session"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isOpen ? (
                            <tr className={styles.detailRow}>
                              <td colSpan={9}>
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
                                  <div className={styles.previewSections}>
                                    <div className={`${styles.previewCard} ${styles.previewCardFull}`}>
                                      <div className={styles.previewCardHeader}><span>📘 หลักสูตร (Course)</span></div>
                                      <div className={styles.previewFieldGrid}>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>กลุ่มหลักสูตร</span><span className={styles.previewFieldValue} translate="no">{plan.course.courseGroup || "-"}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>รหัสหลักสูตร</span><span className={styles.previewFieldValue}>{plan.course.code}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>ที่มา (Background)</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.remark || "-"}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>วัตถุประสงค์การเรียนรู้</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.objective}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>หัวข้อการเรียนรู้</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.learningContent}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>วิธีการอบรม</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.methodology}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ประเภทหลักสูตร</span><span className={styles.previewFieldValue}>{plan.course.courseType}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>อายุหลักสูตร (เดือน)</span><span className={styles.previewFieldValue}>{!plan.course.lifeCycleMonth || plan.course.lifeCycleMonth === "0" || Number(plan.course.lifeCycleMonth) === 0 ? "ไม่มีการหมดอายุ" : plan.course.lifeCycleMonth}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ผู้เข้าอบรม / รุ่น</span><span className={styles.previewFieldValue}>{plan.participants} ท่าน</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ชั่วโมงอบรม</span><span className={styles.previewFieldValue}>{plan.hours} ชม.</span></div>
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
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>แบบทดสอบก่อนเรียน</span><span className={styles.previewFieldValue}>{plan.course.preTest || plan.course.preTestLink || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>แบบทดสอบหลังเรียน</span><span className={styles.previewFieldValue}>{plan.course.postTest || plan.course.postTestLink || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>แบบประเมิน</span><span className={styles.previewFieldValue}>{plan.course.evaluation || plan.course.evaluationLink || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>แบบประเมินหลัง 30 วัน</span><span className={styles.previewFieldValue}>{plan.course.evaluationAfter30Day || plan.course.evaluationAfter30DayLink || "-"}</span></div>
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
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ผู้ให้บริการ</span><span className={styles.previewFieldValue}>{plan.provider || "-"}</span></div>
                                    </div>

                                    {(() => {
                                      const std = standards.find((item) => item.courseId === plan.course.id);
                                      const companies = std?.companies ?? [];
                                      const estimate = calculateBudgetEstimate({
                                        totalBudget: plan.budget,
                                        participants: plan.participants,
                                        companyCount: companies.length,
                                      });

                                      return (
                                        <div className={styles.previewCard}>
                                          <div className={styles.previewCardHeader}><span>💵 ค่าใช้จ่ายประมาณการ</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                                            <span className={styles.previewFieldLabel}>จำนวนที่แต่ละบริษัทส่งได้</span>
                                            <span className={styles.previewFieldValue}>
                                              {estimate.seatsPerCompany === null ? "-" : `${estimate.seatsPerCompany} คน`}
                                            </span>
                                          </div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>งบประมาณรวม</span><span className={styles.previewFieldValue}>{formatBaht(estimate.totalBudget)}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ค่าใช้จ่ายประมาณการต่อคน (กรณีเต็มจำนวน)</span><span className={styles.previewFieldValue}>{formatBaht(estimate.costPerPerson)}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewTotalRow}`}><span className={styles.previewFieldLabel}>ค่าใช้จ่ายประมาณการต่อบริษัท (กรณีเต็มจำนวน)</span><span className={styles.previewFieldValue}>{formatBaht(estimate.costPerCompany)}</span></div>
                                        </div>
                                      );
                                    })()}

                                    <div className={`${styles.previewCard} ${styles.previewCardFull}`}>
                                      <div className={styles.previewCardHeader}><span>📅 กำหนดการ / สถานะ</span></div>
                                      <div className={styles.previewFieldGrid}>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ลำดับหลักสูตร</span><span className={styles.previewFieldValue} translate="no">{group.sequence}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>รุ่น (Sessions)</span><span className={styles.previewFieldValue}>{group.plans.length}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>สถานะ</span><span className={styles.previewFieldValue}>{getStatusLabel(plan.status)}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Job Status</span><span className={styles.previewFieldValue}>{getJobStatus(plan)}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ขอบเขต (Scope)</span><span className={styles.previewFieldValue}>{formatRollingPlanCompanies(plan)}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Last Updated</span><span className={styles.previewFieldValue}>{plan.updatedAt}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}>
                                          <span className={styles.previewFieldLabel}>Created By</span>
                                          <span className={styles.previewFieldValue}>
                                            {plan.ownerScope === "CENTER" || plan.ownerCompany === "HRD Center" || plan.ownerName === "Center HRD"
                                              ? `🏢 HRD Center (ส่วนกลางจัดอบรมให้บริษัท ${formatRollingPlanCompanies(plan)})`
                                              : `🏬 ${plan.ownerCompany || plan.company} (โรงงานจัดอบรมเอง)`}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
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
                {totalPages > 1 ? (
                  <div className={styles.pagination}>
                    {windowStart > 1 ? (
                      <>
                        <button className={styles.paginationButton} type="button" aria-label="First page" onClick={() => goToPage(1)}>«</button>
                        <button className={styles.paginationButton} type="button" aria-label="Previous page" onClick={() => goToPage(page - 1)}>‹</button>
                      </>
                    ) : null}
                    {Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        className={pageNumber === page ? styles.paginationButtonActive : styles.paginationButton}
                        type="button"
                        translate="no"
                        onClick={() => goToPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    {windowEnd < totalPages ? (
                      <>
                        <button className={styles.paginationButton} type="button" aria-label="Next page" onClick={() => goToPage(page + 1)}>›</button>
                        <button className={styles.paginationButton} type="button" aria-label="Last page" onClick={() => goToPage(totalPages)}>»</button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
              )}
            </div>
            );
          })}
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
