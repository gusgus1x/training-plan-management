"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadHandoffRequests,
  matchCourseForRequest,
  needRequestQuery,
  requestedCourseTitle,
  useNeedRequestIds,
} from "./needRequestHandoff";
import { useSearchParams } from "next/navigation";
import type { NeedRequestRecord } from "../../../../lib/trainingNeedRequests/types";
import {
  getCourseDisplayName,
  getCourseSecondaryName,
  isWorkflowOwner,
  type PlanTargetGroupSnapshot,
  type WorkflowCourse,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { listInstructors } from "../../../../lib/instructors/client";
import type { InstructorRecord } from "../../../../lib/instructors/types";
import { listInstituteProviders } from "../../../../lib/instituteProviders/client";
import type { InstituteProviderRecord } from "../../../../lib/instituteProviders/types";
import { listCourses } from "../../../../lib/courses/client";
import { calculateBudgetEstimate, formatBaht } from "../../../../lib/trainingBudgetEstimate";
import { listOapPlans, createOapPlan, updateOapPlan, deleteOapPlan } from "../../../../lib/trainingOap/client";
import type { OapPlanRecord } from "../../../../lib/trainingOap/types";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import TypewriterLoader from "../../../TypewriterLoader";
import SearchableSelect from "../../../SearchableSelect";
import {
  FileText,
  Target,
  BookOpen,
  Users,
  Settings,
  Briefcase,
  Star,
  Building2,
  Tag,
  Folder,
  FileEdit,
  ClipboardList,
  Search,
  Pin,
  X,
  User,
  Factory,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Coins,
  Wallet,
  Eye,
  Trash2,
  Calendar,
} from "../../../icons/LucideIcons";
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
  planYear: new Date().getFullYear().toString(),
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
  instructorId: "",
  instructorUniversity: "",
  instructorEducation: "",
  instructorOrganization: "",
  instructorTelephone: "",
  instructorEmail: "",
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

const RequiredIndicator = ({ isFilled }: { isFilled: boolean }) => (
  <span
    className={isFilled ? styles.indicatorDone : styles.indicatorPending}
    title={isFilled ? "กรอกข้อมูลเรียบร้อยแล้ว / Completed" : "จำเป็นต้องกรอก / Required field"}
  >
    <span className={styles.indicatorDot} />
  </span>
);

const resolvePlanStandard = (plan: OapPlan, standards: WorkflowStandard[]) => {
  const snapshot = (plan as unknown as { targetSnapshot?: PlanTargetGroupSnapshot }).targetSnapshot;
  const courseAny = plan.course as unknown as {
    targetPositions?: string[];
    targetLevels?: string[];
    targetCompanies?: string[];
    orgScope?: {
      functionName?: string;
      division?: string;
      department?: string;
      section?: string;
    };
  };

  if (snapshot) {
    return {
      companies: snapshot.targetCompanies || [],
      positions: snapshot.targetPositions || [],
      levels: snapshot.targetLevels || [],
      functionName: snapshot.orgScope?.functionName || "",
      division: snapshot.orgScope?.division || "",
      department: snapshot.orgScope?.department || "",
      section: snapshot.orgScope?.section || "",
      targetGroup: snapshot.targetGroup || plan.course.targetGroup,
      isSnapshot: true,
    };
  }

  if (
    courseAny?.targetPositions?.length ||
    courseAny?.targetLevels?.length ||
    courseAny?.targetCompanies?.length ||
    courseAny?.orgScope
  ) {
    return {
      companies: courseAny.targetCompanies || [],
      positions: courseAny.targetPositions || [],
      levels: courseAny.targetLevels || [],
      functionName: courseAny.orgScope?.functionName || "",
      division: courseAny.orgScope?.division || "",
      department: courseAny.orgScope?.department || "",
      section: courseAny.orgScope?.section || "",
      targetGroup: plan.course.targetGroup,
      isSnapshot: true,
    };
  }

  // Fallback 1: match standard by courseId AND planYear
  const yearMatched = standards.find(
    (item) =>
      item.courseId === plan.course.id &&
      (item as unknown as { standardYear?: number }).standardYear === plan.planYear,
  );
  if (yearMatched) return { ...yearMatched, isSnapshot: false };

  // Fallback 2: match standard by courseId
  const courseMatched = standards.find((item) => item.courseId === plan.course.id);
  if (courseMatched) return { ...courseMatched, isSnapshot: false };

  return null;
};

export default function TrainingOAP({ username = "Current user" }: TrainingOAPProps) {
  const router = useRouter();
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);
  const user = useAuthenticatedUser();

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
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();
  const [courses, setCourses] = useState<WorkflowCourse[]>([]);
  const [standards, setStandards] = useState<WorkflowStandard[]>([]);
  const [plans, setPlans] = useState<OapPlan[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [approvedRequest, setApprovedRequest] = useState<NeedRequestRecord | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const activeDetailPlan = useMemo(() => plans.find((p) => p.id === openDetailId), [plans, openDetailId]);

  useEffect(() => {
    if (isNewOpen || Boolean(openDetailId)) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpenDetailId("");
          setIsNewOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isNewOpen, openDetailId]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OapStatus>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [instructors, setInstructors] = useState<InstructorRecord[]>([]);
  const [providers, setProviders] = useState<InstituteProviderRecord[]>([]);
  const userCompanyCode = profileValue(user?.companyCode);

  const currentCalendarYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    // ครอบคลุมย้อนหลัง 5 ปี และวางแผนล่วงหน้าได้ถึง 6 ปีจากปีปัจจุบันแบบ Dynamic
    for (let y = currentCalendarYear - 5; y <= currentCalendarYear + 6; y++) {
      yearSet.add(y);
    }
    // และรวบรวมทุกปีที่มีบันทึกอยู่ในฐานข้อมูลจริงเข้ามาเสมอ (ไม่ว่าจะเป็นปีไหน)
    plans.forEach((p) => {
      if (p.planYear) yearSet.add(p.planYear);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [plans, currentCalendarYear]);

  // Approved training need requests on their way to Training Rolling, carried in the address. This
  // screen only visits when the course had no plan yet: it prefills one, then sends them on.
  const handoffIds = useNeedRequestIds();
  // Set when Course Master has just created the course these requests asked for.
  const handoffCourseId = useSearchParams().get("courseId")?.trim() ?? "";

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

  const [isLoading, setIsLoading] = useState(true);

  const loadWorkspace = async () => {
    setIsLoading(true);
    try {
      const [courseData, oapData] = await Promise.all([
        listCourses({ search: "", status: null }),
        listOapPlans({ search: null, status: null }),
      ]);
      const loadedCourses = courseData.courses || [];
      setCourses(loadedCourses);
      setStandards(courseData.standards || []);
      setPlans(oapData.oapPlans || []);

      const [pendingRequest] = await loadHandoffRequests(handoffIds).catch(() => []);
      if (pendingRequest && !approvedRequest) {
        setApprovedRequest(pendingRequest);
        const matched =
          (handoffCourseId ? loadedCourses.find((course) => course.id === handoffCourseId) : undefined) ??
          matchCourseForRequest(pendingRequest.requestedCourseName, loadedCourses);
        setForm({
          ...emptyForm,
          courseCode: matched ? matched.courseCode : "",
          participants: "1",
          provider: "HRD Center",
        });
        setEditingId("");
        setOpenDetailId("");
        setIsNewOpen(true);
      }
    } catch (error) {
      console.error("Failed to load Training OAP workspace", error);
      setCourses([]);
      setStandards([]);
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
    // Once on mount, like every workspace here; the request ids it reads never change after load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const standardCourseIds = useMemo(
    () => new Set(standards.map((standard) => standard.courseId)),
    [standards],
  );
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const isCenterUser = user?.roleCode === "HRD_CENTER";
  const courseOptions = useMemo(
    () => {
      const standardizedCourses = courses.filter(
        (course) => {
          if (course.status === "Inactive") return false;
          if (isFactoryUser) {
            // Factory users only select courses belonging to their own factory
            return (
              course.ownerCompany === userCompanyCode &&
              course.owner !== "CENTER" &&
              course.ownerCompany !== "HRD Center" &&
              course.ownerCompany !== "CENTER"
            );
          }
          if (isCenterUser) {
            // Center users can see all courses
            return true;
          }
          return isWorkflowOwner(course.owner, course.ownerCompany, user?.roleCode, userCompanyCode);
        },
      );
      return standardizedCourses;
    },
    [courses, isFactoryUser, isCenterUser, user?.roleCode, userCompanyCode],
  );
  const selectedCourse =
    courseOptions.find((course) => course.courseCode === form.courseCode) ?? null;
  const isSelectedCourseCenter = selectedCourse
    ? selectedCourse.owner === "CENTER" ||
      selectedCourse.ownerCompany === "CENTER" ||
      selectedCourse.ownerCompany === "HRD Center" ||
      !selectedCourse.ownerCompany
    : false;
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
        if (isFactoryUser) {
          // Factory users only see plans belonging to their own factory
          return (
            plan.ownerCompany === userCompanyCode &&
            plan.owner !== "CENTER" &&
            plan.ownerCompany !== "HRD Center" &&
            plan.ownerCompany !== "CENTER"
          );
        }
        return isWorkflowOwner(plan.owner, plan.ownerCompany, user?.roleCode, userCompanyCode);
      }),
    [plans, isFactoryUser, user?.roleCode, userCompanyCode],
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
          if (yearFilter !== "all") {
            if (String(plan.planYear) !== yearFilter) return false;
          }
          if (companyFilter !== "all") {
            const matchesCompany =
              companyFilter === "CENTER"
                ? plan.owner === "CENTER" || plan.ownerCompany === "HRD Center" || plan.ownerCompany === "CENTER"
                : plan.ownerCompany === companyFilter;
            if (!matchesCompany) return false;
          }
          return true;
        })
        .filter((plan) => {
          const primaryName = getCourseDisplayName(plan.course);
          const secondaryName = getCourseSecondaryName(plan.course);
          const planYearStr = plan.planYear ? String(plan.planYear) : "";
          const beYearStr = plan.planYear ? String(plan.planYear + 543) : "";
          return [
            plan.course.courseCode,
            plan.course.courseNameTh,
            plan.course.courseNameEn,
            primaryName,
            secondaryName,
            plan.course.courseGroup,
            plan.course.courseType,
            plan.status,
            getStatusLabel(plan.status),
            plan.trainer,
            plan.providerName,
            plan.owner === "CENTER" ? "HRD Center" : plan.ownerCompany,
            planYearStr,
            beYearStr,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase());
        })
        .filter((plan) => statusFilter === "all" || plan.status === statusFilter)
        .sort((a, b) => {
          if ((b.planYear || 0) !== (a.planYear || 0)) {
            return (b.planYear || 0) - (a.planYear || 0);
          }
          const weightA = getCompanySortWeight(a);
          const weightB = getCompanySortWeight(b);
          if (weightA !== weightB) return weightA - weightB;

          const companyA = a.owner === "CENTER" ? "HRD Center" : a.ownerCompany || "";
          const companyB = b.owner === "CENTER" ? "HRD Center" : b.ownerCompany || "";
          if (companyA !== companyB) return companyA.localeCompare(companyB);

          return a.sequence - b.sequence;
        })
        .map((plan, index) => ({ ...plan, sequence: index + 1 })),
    [companyFilter, scopedPlans, search, statusFilter, yearFilter, userCompanyCode, language],
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

  const isCenterOwnedOap = (plan: OapPlan | null) => {
    if (!plan) return false;
    return (
      plan.owner === "CENTER" ||
      plan.ownerCompany === "HRD Center" ||
      plan.course?.owner === "CENTER"
    );
  };

  const selectedPlan =
    visiblePlans.find((plan) => plan.id === selectedPlanId) ?? null;
  const isSelectedPlanReadOnlyForFactory = isFactoryUser && isCenterOwnedOap(selectedPlan);

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateBudgetPart = (field: (typeof BUDGET_PART_FIELDS)[number], value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      return { ...next, budget: String(sumBudgetParts(next)) };
    });
  };

  const formatInstructorFullName = (ins: InstructorRecord | null | undefined): string => {
    if (!ins) return "";
    return [ins.title, ins.firstName, ins.lastName].filter(Boolean).join(" ").trim();
  };

  const resolveInstructorId = (trainerName: string) => {
    if (form.instructorId) return form.instructorId;
    const trimmed = trainerName.trim();
    if (!trimmed) return null;
    const matched = instructors.find(
      (instructor) =>
        formatInstructorFullName(instructor).toLowerCase() === trimmed.toLowerCase() ||
        `${instructor.firstName} ${instructor.lastName}`.trim().toLowerCase() === trimmed.toLowerCase() ||
        instructor.instructorCode.toLowerCase() === trimmed.toLowerCase(),
    );
    return matched?.instructorId ?? null;
  };

  const selectedInstructor = useMemo(() => {
    if (form.instructorId) {
      const byId = instructors.find((ins) => ins.instructorId === form.instructorId);
      if (byId) return byId;
    }
    if (!form.trainer.trim()) return null;
    const t = form.trainer.trim().toLowerCase();
    return (
      instructors.find(
        (ins) =>
          formatInstructorFullName(ins).toLowerCase() === t ||
          `${ins.firstName} ${ins.lastName}`.trim().toLowerCase() === t ||
          ins.instructorCode.toLowerCase() === t,
      ) ?? null
    );
  }, [form.instructorId, form.trainer, instructors]);

  const instructorOptions = useMemo(() => {
    return instructors.map((ins) => {
      const fullName = formatInstructorFullName(ins);
      const details = [ins.university, ins.education, ins.organizationName].filter(Boolean).join(" • ");
      return {
        value: ins.instructorId,
        label: `[${ins.instructorCode}] ${fullName}`,
        secondaryLabel: details || "ไม่มีข้อมูลสังกัด/มหาวิทยาลัย",
        badge: ins.university || ins.organizationName || "Master",
      };
    });
  }, [instructors]);

  const handleSelectInstructor = (value: string) => {
    const ins = instructors.find((item) => item.instructorId === value);
    if (ins) {
      const fullName = formatInstructorFullName(ins);
      setForm((current) => ({
        ...current,
        instructorId: ins.instructorId,
        trainer: fullName,
        instructorUniversity: ins.university ?? "",
        instructorEducation: ins.education ?? "",
        instructorOrganization: ins.organizationName ?? "",
        instructorTelephone: ins.telephone ?? "",
        instructorEmail: ins.email ?? "",
      }));
    } else {
      setForm((current) => ({
        ...current,
        instructorId: "",
      }));
    }
  };

  const resolveProviderId = (providerName: string) => {
    const trimmed = providerName.trim();
    const matched = providers.find(
      (provider) => provider.instituteProviderName.trim() === trimmed,
    );
    return matched?.instituteProviderId ?? null;
  };

  const handleSave = async () => {
    const missingFields: string[] = [];

    if (!selectedCourse) {
      missingFields.push("หลักสูตร (Course) — เลือกหลักสูตรจากตารางก่อน");
    }
    if (!form.participants.trim()) {
      missingFields.push("จำนวนผู้เข้าอบรมต่อรุ่น (Participants)");
    }
    if (!form.hours.trim()) {
      missingFields.push("จำนวนชั่วโมงอบรม (Training Hours)");
    }
    if (!form.budget.trim()) {
      missingFields.push("งบประมาณรวม (Total Budget)");
    }

    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    if (!selectedCourse) {
      return;
    }

    const selectedPlanYear = parseInt(form.planYear, 10) || new Date().getFullYear();
    const input = {
      courseId: selectedCourse.id,
      planYear: selectedPlanYear,
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
      instructorTelephone: form.instructorTelephone?.trim() || "",
      instructorEmail: form.instructorEmail?.trim() || "",
      instructorEducation: form.instructorEducation?.trim() || "",
      instructorOrganization: form.instructorOrganization?.trim() || "",
      instructorUniversity: form.instructorUniversity?.trim() || "",
      providerName: form.provider.trim(),
      providerId: resolveProviderId(form.provider),
    };

    const wasEditing = Boolean(editingId);

    try {
      if (editingId) {
        await updateOapPlan(editingId, input);
      } else {
        await createOapPlan({ ...input, planYear: selectedPlanYear, status: "Planned" });
      }
      setEditingId("");
      setForm(emptyForm);
      const cameFromRequests = !wasEditing && approvedRequest !== null;
      setApprovedRequest(null);
      setIsNewOpen(false);
      if (cameFromRequests) {
        // The plan exists now; the requests carry on to Training Rolling to get their batch.
        router.push(`/training-plan/training-rolling${needRequestQuery(handoffIds)}`);
        return;
      }
      await loadWorkspace();
      toast.success(
        wasEditing
          ? "บันทึกการแก้ไขแผน OAP แล้ว / Training OAP plan updated"
          : "บันทึกแผน OAP ใหม่แล้ว / Training OAP plan saved",
      );
    } catch (error) {
      console.error("Failed to save Training OAP plan", error);
      toast.error("บันทึกแผน OAP ไม่สำเร็จ / Failed to save Training OAP plan");
    }
  };

  const handleEdit = (plan: OapPlan) => {
    if (isFactoryUser && isCenterOwnedOap(plan)) {
      toast.warning(t("แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้", "Center plan cannot be edited by factory users"));
      return;
    }
    setEditingId(plan.id);
    const matched = instructors.find(
      (ins) =>
        (plan.instructorId && ins.instructorId === plan.instructorId) ||
        formatInstructorFullName(ins).toLowerCase() === plan.trainer.trim().toLowerCase() ||
        `${ins.firstName} ${ins.lastName}`.trim().toLowerCase() === plan.trainer.trim().toLowerCase() ||
        ins.instructorCode.toLowerCase() === plan.trainer.trim().toLowerCase(),
    );
    setForm({
      courseCode: plan.course.courseCode,
      planYear: (plan.planYear ?? new Date().getFullYear()).toString(),
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
      instructorId: matched?.instructorId ?? "",
      instructorUniversity: plan.instructorUniversity || matched?.university || "",
      instructorEducation: plan.instructorEducation || matched?.education || "",
      instructorOrganization: plan.instructorOrganization || matched?.organizationName || "",
      instructorTelephone: plan.instructorTelephone || matched?.telephone || "",
      instructorEmail: plan.instructorEmail || matched?.email || "",
      provider: plan.providerName,
    });
    setIsNewOpen(true);
    setOpenDetailId("");
  };

  const handleDelete = async (planId: string) => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (isFactoryUser && isCenterOwnedOap(targetPlan ?? null)) {
      toast.warning(t("แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้", "Center plan cannot be deleted by factory users"));
      return;
    }
    if (!(await confirm({ message: { th: "ยืนยันที่จะลบแผน OAP นี้พร้อมรุ่นการอบรมทั้งหมดหรือไม่?", en: "Confirm deleting this OAP plan and all its sessions?" }, danger: true }))) {
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
      toast.success("ลบแผน OAP แล้ว / Training OAP plan deleted");
    } catch (error) {
      console.error("Failed to delete Training OAP plan", error);
      toast.error("ลบแผน OAP ไม่สำเร็จ / Failed to delete Training OAP plan");
    }
  };

  const updateStatus = async (planId: string, status: OapStatus) => {
    try {
      await updateOapPlan(planId, { status });
      await loadWorkspace();
      toast.success(
        `เปลี่ยนสถานะแผนเป็น ${getStatusLabel(status)} แล้ว / Plan status changed to ${status}`,
      );
    } catch (error) {
      console.error("Failed to update Training OAP plan status", error);
      toast.error("เปลี่ยนสถานะแผนไม่สำเร็จ / Failed to update Training OAP plan status");
    }
  };

  const handleRefresh = async () => {
    await loadWorkspace();
    setForm(emptyForm);
    setApprovedRequest(null);
    setIsNewOpen(false);
    setEditingId("");
    setOpenDetailId("");
    setSelectedPlanId("");
    setSearch("");
    setStatusFilter("all");
    setYearFilter("all");
  };

  const handleNew = () => {
    setEditingId("");
    setForm({
      ...emptyForm,
      planYear: yearFilter !== "all" ? yearFilter : new Date().getFullYear().toString(),
    });
    setApprovedRequest(null);
    setOpenDetailId("");
    setSelectedPlanId("");
    setIsNewOpen(true);
  };

  if (isLoading) {
    return (
      <section className={styles.page} aria-label="Training OAP annual plan">
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{trainingOapModule.subtitle}</p>
            <h2>{trainingOapModule.title}</h2>
            <p>{trainingOapModule.description}</p>
          </div>
        </section>
        <TypewriterLoader label={t("กำลังโหลดข้อมูลแผนการอบรมประจำปี (OAP)...", "Loading annual training plan (OAP)...")} />
      </section>
    );
  }

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
              <Search size={16} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                aria-label="Search annual training plan"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("ค้นหารหัสหลักสูตร, ชื่อ, วิทยากร, สถาบัน, สถานะ...", "Search course code, name, trainer, provider, status...")}
              />
            </div>
            {user?.roleCode === "HRD_CENTER" ? (
              <label className={styles.filterLabel}>
                <span>{t("บริษัท", "Company")}</span>
                <select
                  className={styles.statusSelect}
                  aria-label="Filter company"
                  value={companyFilter}
                  onChange={(event) => setCompanyFilter(event.target.value)}
                >
                  <option value="all">{t("ทุกบริษัท", "All Companies")}</option>
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
              <span>{t("ปีของแผน", "Plan Year")}</span>
              <select
                className={styles.statusSelect}
                aria-label="Filter plan year"
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
              >
                <option value="all">{t("ทุกปี (All Years)", "All Years")}</option>
                {availableYears.map((yr) => {
                  const beYear = yr + 543;
                  const isCurrent = yr === currentCalendarYear;
                  return (
                    <option key={yr} value={String(yr)}>
                      {language === "th"
                        ? `ปี พ.ศ. ${beYear} (${yr})${isCurrent ? " • ปัจจุบัน" : ""}`
                        : `FY ${yr} (BE ${beYear})${isCurrent ? " • Current" : ""}`}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className={styles.filterLabel}>
              <span>{t("สถานะ", "Status")}</span>
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
            <button
              className={styles.secondaryButton}
              disabled={!selectedPlan || isSelectedPlanReadOnlyForFactory}
              title={isSelectedPlanReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้" : "Edit Training OAP"}
              type="button"
              onClick={() => selectedPlan && !isSelectedPlanReadOnlyForFactory && handleEdit(selectedPlan)}
            >
              Edit
            </button>
            <button
              className={styles.dangerButton}
              disabled={!selectedPlan || isSelectedPlanReadOnlyForFactory}
              title={isSelectedPlanReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : "Delete Training OAP"}
              type="button"
              onClick={() => selectedPlan && !isSelectedPlanReadOnlyForFactory && void handleDelete(selectedPlan.id)}
            >
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
          <div
            className={styles.modalOverlay}
            onClick={() => {
              setForm(emptyForm);
              setEditingId("");
              setIsNewOpen(false);
            }}
          >
            <div
              className={styles.modalDialog}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className={styles.modalHeader}>
                <div>
                  <p className={styles.kicker}>{editingId ? "Edit plan" : "New plan"}</p>
                  <h3 className={styles.modalTitle}>
                    {editingId ? t("แก้ไขแผนอบรมประจำปี (Edit Training OAP)", "Edit Training OAP") : t("สร้างแผนอบรมประจำปี (Create Training OAP)", "Create Training OAP")}
                  </h3>
                </div>
                <div className={styles.modalHeaderActions}>
                  <button
                    className={styles.modalCloseButton}
                    type="button"
                    onClick={() => {
                      setForm(emptyForm);
                      setEditingId("");
                      setIsNewOpen(false);
                    }}
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className={styles.modalBody}>
                <section className={styles.formPanel} style={{ padding: 0, border: "none", boxShadow: "none", background: "transparent" }}>
            {approvedRequest ? (
              <div className={styles.approvedRequestBanner}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 800, color: "#007a3d", fontSize: "0.84rem" }}>
                    <><Pin size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("สร้างแผนจากคำขอฝึกอบรม", "Created from Training Request")} #{approvedRequest.requestNo}</>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setApprovedRequest(null);
                    }}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "0.76rem" }}
                  >
                    <><X size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("ยกเลิกการเชื่อมโยงคำขอ", "Unlink request")}</>
                  </button>
                </div>
                <strong style={{ fontSize: "0.95rem" }}>{approvedRequest.requestedCourseName}</strong>
                <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#475569" }}>
                  <><User size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{approvedRequest.employeeName} ({approvedRequest.companyCode} / {approvedRequest.functionName || "-"}</>
                  {approvedRequest.requestReason ? ` • เหตุผลที่ขอ: "${approvedRequest.requestReason}"` : ""}
                </p>
                {/* A topic the employee typed may name no course at all; the plan needs one first. */}
                {!form.courseCode ? (
                  <div className={styles.newCourseHandoff}>
                    <span>
                      {t(
                        "ไม่พบหลักสูตรนี้ใน Course Master เลือกหลักสูตรที่มีอยู่จากช่องด้านล่าง หรือสร้างหลักสูตรใหม่",
                        "This course is not in Course Master yet. Pick an existing course below, or create it.",
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/training-course/course-master-standard?newCourseName=${encodeURIComponent(
                            requestedCourseTitle(approvedRequest.requestedCourseName),
                          )}&needRequestIds=${handoffIds.join(",")}`,
                        )
                      }
                    >
                      {t("สร้างหลักสูตรใหม่ใน Course Master", "Create the course in Course Master")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className={styles.formGrid}>
              <label style={{ gridColumn: "span 2" }}>
                <span>
                  {t("ปีของแผนการอบรม (Plan Year)", "Annual Plan Year")}{" "}
                  <RequiredIndicator isFilled={Boolean(form.planYear.trim())} />
                </span>
                <select
                  aria-label="Annual Plan Year"
                  value={form.planYear}
                  onChange={(e) => updateForm("planYear", e.target.value)}
                >
                  {availableYears.map((yr) => {
                    const beYear = yr + 543;
                    const isCurrent = yr === currentCalendarYear;
                    return (
                      <option key={yr} value={String(yr)}>
                        {language === "th"
                          ? `ประจำปี พ.ศ. ${beYear} (${yr})${isCurrent ? " • ปีปัจจุบัน" : ""}`
                          : `Annual Plan FY ${yr} (BE ${beYear})${isCurrent ? " • Current" : ""}`}
                      </option>
                    );
                  })}
                </select>
              </label>
              <div className={styles.fullField} style={{ gridColumn: "span 4" }}>
                <span>{t("หลักสูตร (Course Name)", "Course Name")} <RequiredIndicator isFilled={Boolean(form.courseCode.trim())} /></span>
                <SearchableSelect
                  options={courseOptions.map((course) => {
                    const secondaryName = getCourseSecondaryName(course);
                    const displayName = getCourseDisplayName(course);
                    const isCenter =
                      course.owner === "CENTER" ||
                      course.ownerCompany === "CENTER" ||
                      course.ownerCompany === "HRD Center" ||
                      !course.ownerCompany;
                    const ownerTag = isCenter
                      ? "Center (ส่วนกลาง)"
                      : `Factory (${course.ownerCompany || "โรงงาน"})`;
                    const tag = course.courseGroup || course.courseType;
                    const enName = course.courseNameEn?.trim() || "";
                    const thName = course.courseNameTh?.trim() || "";

                    return {
                      value: course.courseCode,
                      label: `[${course.courseCode}] ${displayName}`,
                      secondaryLabel: secondaryName ? `${secondaryName} • ${ownerTag}` : ownerTag,
                      badge: tag || (isCenter ? "Center" : (course.ownerCompany || "Factory")),
                      keywords: `${enName} ${thName} ${course.courseCode} ${tag || ""} ${ownerTag}`,
                    };
                  })}
                  value={form.courseCode}
                  onChange={(code) => updateForm("courseCode", code)}
                  placeholder="พิมพ์เพื่อค้นหาหลักสูตร (รหัส/ชื่อ)... / Search course..."
                />
              </div>
              {selectedCourse ? (
                <div className={styles.fullField}>
                  <div
                    className={
                      isSelectedCourseCenter
                        ? styles.courseOwnerBannerCenter
                        : styles.courseOwnerBannerFactory
                    }
                  >
                    <span className={styles.courseOwnerIcon}>{isSelectedCourseCenter ? <Building2 size={16} /> : <Factory size={16} />}</span>
                    <div className={styles.courseOwnerContent}>
                      <div className={styles.courseOwnerTitleRow}>
                        <strong>
                          {isSelectedCourseCenter
                            ? (language === "th" ? "หลักสูตรส่วนกลาง (HRD Center Course)" : "Center Course (HRD Center)")
                            : (language === "th" ? `หลักสูตรโรงงาน (Factory Course: ${selectedCourse.ownerCompany || "Factory"})` : `Factory Course (${selectedCourse.ownerCompany || "Factory"})`)}
                        </strong>
                        <span
                          className={
                            isSelectedCourseCenter
                              ? styles.courseOwnerTagCenter
                              : styles.courseOwnerTagFactory
                          }
                        >
                          {isSelectedCourseCenter
                            ? "Center (ส่วนกลาง)"
                            : `Factory (${selectedCourse.ownerCompany || "โรงงาน"})`}
                        </span>
                      </div>
                      <p className={styles.courseOwnerDesc}>
                        {isSelectedCourseCenter
                          ? (language === "th" ? "หลักสูตรมาตรฐานส่วนกลาง พัฒนาและดูแลโดย HRD Center (ส่วนกลาง)" : "Standard center course developed and maintained by HRD Center")
                          : (language === "th" ? `หลักสูตรเฉพาะสร้างขึ้นโดยโรงงาน ${selectedCourse.ownerCompany || ""}` : `Custom course created by ${selectedCourse.ownerCompany || "Factory"}`)}
                      </p>
                    </div>
                  </div>


                </div>
              ) : null}
              {/* === CAPACITY & BUDGET SECTION === */}
              <div className={styles.budgetSectionContainer}>
                <div className={styles.budgetSectionHeader}>
                  <div className={styles.budgetSectionTitle}>
                    <div>
                      <strong>ประมาณการงบประมาณและจำนวนผู้เข้าอบรม (Capacity & Budget Planning)</strong>
                      <p>{t("กำหนดจำนวนผู้เข้าอบรม ชั่วโมง และแจกแจงค่าใช้จ่ายเพื่อคำนวณงบประมาณรวมอัตโนมัติ (THB)", "Set participants, hours and cost breakdown to calculate total budget automatically (THB)")}</p>
                    </div>
                  </div>
                  <div className={styles.budgetTotalBadge}>
                    <span className={styles.budgetTotalBadgeLabel}>Total Budget:</span>
                    <span className={styles.budgetTotalBadgeValue}>
                      ฿{form.budget ? Number(form.budget).toLocaleString("en-US") : "0"}
                    </span>
                    {Number(form.participants) > 0 && Number(form.budget) > 0 ? (
                      <span className={styles.budgetPerHeadBadge}>
                        (~฿{Math.round(Number(form.budget) / Number(form.participants)).toLocaleString("en-US")} / {t("คน", "person")})
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className={styles.budgetCapacityRow}>
                  <label>
                    <span>{t("ผู้เข้าอบรม / รุ่น (Participants / Group)", "Participants / Batch")} <RequiredIndicator isFilled={Boolean(form.participants.trim())} /></span>
                    <input
                      disabled={!selectedCourse}
                      inputMode="numeric"
                      placeholder={t("ใส่จำนวนผู้เข้าอบรมต่อรุ่น เช่น 20 คน", "e.g. 20 participants per batch")}
                      value={form.participants}
                      onChange={(event) => updateForm("participants", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t("ชั่วโมงอบรม (Training Hours)", "Training Hours")} <RequiredIndicator isFilled={Boolean(form.hours.trim())} /></span>
                    <input
                      disabled={!selectedCourse}
                      inputMode="numeric"
                      placeholder={t("ใส่จำนวนชั่วโมงอบรมทั้งหมด เช่น 6 ชั่วโมง", "e.g. 6 hours")}
                      value={form.hours}
                      onChange={(event) => updateForm("hours", event.target.value)}
                    />
                  </label>
                </div>

                <div className={styles.budgetInputsGrid}>
                  <label>
                    <span>{t("ค่าวิทยากร (Instructor Budget)", "Instructor Budget")}</span>
                    <input
                      disabled={!selectedCourse}
                      inputMode="numeric"
                      placeholder="0"
                      value={form.budgetInstructor}
                      onChange={(event) => updateBudgetPart("budgetInstructor", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t("ค่าเดินทาง (Traveling Budget)", "Traveling Budget")}</span>
                    <input
                      disabled={!selectedCourse}
                      inputMode="numeric"
                      placeholder="0"
                      value={form.budgetTraveling}
                      onChange={(event) => updateBudgetPart("budgetTraveling", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t("ค่าห้องสัมมนา / สถานที่ (Seminar Room)", "Seminar Room / Venue")}</span>
                    <input
                      disabled={!selectedCourse}
                      inputMode="numeric"
                      placeholder="0"
                      value={form.budgetSeminarRoom}
                      onChange={(event) => updateBudgetPart("budgetSeminarRoom", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t("ค่าที่พัก (Accommodation Budget)", "Accommodation Budget")}</span>
                    <input
                      disabled={!selectedCourse}
                      inputMode="numeric"
                      placeholder="0"
                      value={form.budgetAccommodation}
                      onChange={(event) => updateBudgetPart("budgetAccommodation", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t("ค่าเอกสารและอุปกรณ์ (Material)", "Material / Equipment")}</span>
                    <input
                      disabled={!selectedCourse}
                      inputMode="numeric"
                      placeholder="0"
                      value={form.budgetMaterial}
                      onChange={(event) => updateBudgetPart("budgetMaterial", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t("ค่าอาหารและเครื่องดื่ม (Food & Beverage)", "Food & Beverage")}</span>
                    <input
                      disabled={!selectedCourse}
                      inputMode="numeric"
                      placeholder="0"
                      value={form.budgetFoodBeverage}
                      onChange={(event) => updateBudgetPart("budgetFoodBeverage", event.target.value)}
                    />
                  </label>
                </div>
              </div>
              {/* === INSTRUCTOR SECTION === */}
              <div className={styles.instructorSectionContainer}>
                <div className={styles.instructorSectionHeader}>
                  <div className={styles.instructorSectionTitle}>
                    <div>
                      <strong>{t("ข้อมูลวิทยากรและสถาบันฝึกอบรม (Instructor & Provider)", "Instructor & Provider Details")}</strong>
                      <p>{t("เลือกวิทยากรจากทะเบียน Master Data เพื่อดึงข้อมูลอัตโนมัติ หรือกรอกข้อมูลวิทยากรและสถาบันผู้ให้บริการ", "Select instructor from Master Data or enter manually")}</p>
                    </div>
                  </div>
                  {form.trainer || form.instructorUniversity || form.instructorEducation || form.instructorOrganization || form.instructorTelephone || form.instructorEmail || form.provider ? (
                    <button
                      type="button"
                      className={styles.instructorClearBtn}
                      onClick={() => {
                        setForm((curr) => ({
                          ...curr,
                          instructorId: "",
                          trainer: "",
                          instructorUniversity: "",
                          instructorEducation: "",
                          instructorOrganization: "",
                          instructorTelephone: "",
                          instructorEmail: "",
                          provider: "",
                        }));
                      }}
                    >
                      <><X size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> {t("ล้างข้อมูลวิทยากร", "Clear Instructor")}</>
                    </button>
                  ) : null}
                </div>

                <div className={styles.instructorSelectorWrap}>
                  <span className={styles.fieldLabel}>{t("เลือกจากทะเบียนวิทยากร (Select from Instructor Master)", "Select from Instructor Master")}</span>
                  <SearchableSelect
                    options={instructorOptions}
                    value={form.instructorId}
                    onChange={handleSelectInstructor}
                    placeholder={t("ค้นหาวิทยากรด้วยชื่อ, รหัส, มหาวิทยาลัย หรือสังกัดเพื่อดึงข้อมูลอัตโนมัติ...", "Search instructor by name, code, university or organization...")}
                    disabled={!selectedCourse}
                  />
                </div>

                <div className={styles.externalFieldsGrid}>
                  <label className={styles.spanFullOrHalf}>
                    <span>{t("ชื่อ - นามสกุล วิทยากร (Trainer Name) *", "Trainer Name *")}</span>
                    <input
                      disabled={!selectedCourse}
                      placeholder={t("เช่น ผศ.ดร. สมชาย ใจดี", "e.g. Dr. John Doe")}
                      value={form.trainer}
                      onChange={(e) => updateForm("trainer", e.target.value)}
                    />
                  </label>
                  <label className={styles.spanFullOrHalf}>
                    <span>{t("สถาบัน / ผู้ให้บริการฝึกอบรม (Institute / Provider)", "Institute / Provider")}</span>
                    <input
                      list="institute-provider-options"
                      disabled={!selectedCourse}
                      value={form.provider}
                      onChange={(event) => updateForm("provider", event.target.value)}
                      placeholder={t("เลือกจาก Institute/Provider Master หรือพิมพ์ระบุเอง", "Select from Institute/Provider Master or enter custom")}
                    />
                    <datalist id="institute-provider-options">
                      {providers.map((provider) => (
                        <option key={provider.instituteProviderId} value={provider.instituteProviderName}>
                          {provider.instituteProviderCode}
                        </option>
                      ))}
                    </datalist>
                  </label>
                  <label>
                    <span>{t("มหาวิทยาลัย (University)", "University")}</span>
                    <input
                      disabled={!selectedCourse}
                      placeholder={t("เช่น จุฬาลงกรณ์มหาวิทยาลัย", "e.g. Chulalongkorn University")}
                      value={form.instructorUniversity}
                      onChange={(e) => updateForm("instructorUniversity", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t("ระดับการศึกษา / วุฒิ (Education)", "Education")}</span>
                    <input
                      disabled={!selectedCourse}
                      placeholder={t("เช่น ปริญญาโท วิศวกรรมศาสตร์", "e.g. Master in Engineering")}
                      value={form.instructorEducation}
                      onChange={(e) => updateForm("instructorEducation", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t("หน่วยงาน / บริษัท / สังกัด (Organization)", "Organization")}</span>
                    <input
                      disabled={!selectedCourse}
                      placeholder={t("เช่น บริษัท นวัตกรรม จำกัด หรือ สถาบันวิจัย", "e.g. Innovation Co., Ltd.")}
                      value={form.instructorOrganization}
                      onChange={(e) => updateForm("instructorOrganization", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t("เบอร์โทรศัพท์ (Telephone)", "Telephone")}</span>
                    <input
                      disabled={!selectedCourse}
                      placeholder={t("เช่น 081-234-5678", "e.g. 081-234-5678")}
                      value={form.instructorTelephone}
                      onChange={(e) => updateForm("instructorTelephone", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t("อีเมล (Email)", "Email")}</span>
                    <input
                      type="email"
                      disabled={!selectedCourse}
                      placeholder={t("เช่น trainer@example.com", "e.g. trainer@example.com")}
                      value={form.instructorEmail}
                      onChange={(e) => updateForm("instructorEmail", e.target.value)}
                    />
                  </label>
                </div>
              </div>
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
                        <><Tag size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{selectedCourse.courseType}</>
                      </span>
                    ) : null}
                    {selectedCourse.courseGroup ? (
                      <span className={styles.previewBadge} translate="no">
                        <><Folder size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{selectedCourse.courseGroup}</>
                      </span>
                    ) : null}
                    <span className={styles.previewBadge}>
                      <><Clock size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{!selectedCourse.lifeCycleMonth || selectedCourse.lifeCycleMonth === "0" || Number(selectedCourse.lifeCycleMonth) === 0 ? t("ไม่มีการหมดอายุ", "No Expiration") : `${selectedCourse.lifeCycleMonth} ${t("เดือน", "Months")}`}</>
                    </span>
                    <span className={styles.previewBadge}>
                      <><Building2 size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{selectedCourse.ownerCompany || selectedCourse.owner}</>
                    </span>
                  </div>
                </div>

                <div className={styles.previewSections}>
                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span><Target size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />Objectives & Content</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ที่มา (Background)", "Background")}</span>
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
                      <span><Users size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />Target & Standard</span>
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
                      <span><ClipboardCheck size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />Assessment Forms</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Pre-Test</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.preTest || selectedCourse.preTestLink || "None"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Post-Test</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.postTest || selectedCourse.postTestLink || "None"}</span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span><Star size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />Evaluation Forms</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Evaluation</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.evaluation || selectedCourse.evaluationLink || "None"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>30-Day Follow-Up</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.evaluationAfter30Day || selectedCourse.evaluationAfter30DayLink || "None"}</span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span><User size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("รายละเอียดวิทยากร (Instructor Details)", "Instructor Details")}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ชื่อวิทยากร", "Instructor Name")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedInstructor
                          ? formatInstructorFullName(selectedInstructor)
                          : form.trainer.trim() || "-"}
                      </span>
                    </div>
                    {selectedInstructor?.instructorCode ? (
                      <div className={styles.previewFieldRow}>
                        <span className={styles.previewFieldLabel}>{t("รหัสวิทยากร", "Instructor Code")}</span>
                        <span className={styles.previewFieldValue}>{selectedInstructor.instructorCode}</span>
                      </div>
                    ) : null}
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("มหาวิทยาลัย", "University")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedInstructor?.university || form.instructorUniversity || "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("วุฒิการศึกษา", "Education")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedInstructor?.education || form.instructorEducation || "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("หน่วยงาน / สังกัด", "Organization")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedInstructor?.organizationName || form.instructorOrganization || "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("เบอร์โทรศัพท์", "Telephone")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedInstructor?.telephone || form.instructorTelephone || "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("อีเมล", "Email")}</span>
                      <span className={styles.previewFieldValue}>
                        {selectedInstructor?.email || form.instructorEmail || "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("สถาบัน / ผู้ให้บริการ", "Provider")}</span>
                      <span className={styles.previewFieldValue}>{form.provider || "-"}</span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>{t("ประมาณการงบประมาณและการจัด (Budget & Capacity)", "Budget & Capacity Estimation")}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ผู้เข้าอบรมต่อรุ่น", "Participants / Batch")}</span>
                      <span className={styles.previewFieldValue}>
                        {form.participants.trim() ? (language === "th" ? `${form.participants} คน / รุ่น` : `${form.participants} seats / batch`) : "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ชั่วโมงการอบรม", "Training Hours")}</span>
                      <span className={styles.previewFieldValue}>
                        {form.hours.trim() ? (language === "th" ? `${form.hours} ชั่วโมง` : `${form.hours} hours`) : "-"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าวิทยากร", "Instructor")}</span>
                      <span className={styles.previewFieldValue}>
                        {form.budgetInstructor ? `฿${Number(form.budgetInstructor).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าเดินทาง", "Traveling")}</span>
                      <span className={styles.previewFieldValue}>
                        {form.budgetTraveling ? `฿${Number(form.budgetTraveling).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าห้องสัมมนา", "Seminar Room")}</span>
                      <span className={styles.previewFieldValue}>
                        {form.budgetSeminarRoom ? `฿${Number(form.budgetSeminarRoom).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าที่พัก", "Accommodation")}</span>
                      <span className={styles.previewFieldValue}>
                        {form.budgetAccommodation ? `฿${Number(form.budgetAccommodation).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าเอกสาร/อุปกรณ์", "Material")}</span>
                      <span className={styles.previewFieldValue}>
                        {form.budgetMaterial ? `฿${Number(form.budgetMaterial).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>{t("ค่าอาหาร/เครื่องดื่ม", "Food & Beverage")}</span>
                      <span className={styles.previewFieldValue}>
                        {form.budgetFoodBeverage ? `฿${Number(form.budgetFoodBeverage).toLocaleString("en-US")}` : "฿0"}
                      </span>
                    </div>
                    <div className={`${styles.previewFieldRow} ${styles.previewBudgetTotalRow}`}>
                      <span className={styles.previewFieldLabel}><strong>{t("งบประมาณรวม (Total Budget)", "Total Budget")}</strong></span>
                      <span className={styles.previewFieldValue}>
                        <strong className={styles.previewBudgetTotalText}>
                          ฿{form.budget ? Number(form.budget).toLocaleString("en-US") : "0"}
                        </strong>
                        {Number(form.participants) > 0 && Number(form.budget) > 0 ? (
                          <span className={styles.previewBudgetPerHead}>
                            (~฿{Math.round(Number(form.budget) / Number(form.participants)).toLocaleString("en-US")} / {t("คน", "person")})
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
                </section>
              </div>
              <div className={styles.modalFooter}>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => void handleSave()}
                >
                  {editingId ? "Save changes" : "Save Draft"}
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => {
                    setForm(emptyForm);
                    setEditingId("");
                    setIsNewOpen(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeDetailPlan ? (() => {
          const std = resolvePlanStandard(activeDetailPlan, standards);
          const matchedPlanInstructor = instructors.find(
            (ins) =>
              (activeDetailPlan.instructorId && ins.instructorId === activeDetailPlan.instructorId) ||
              formatInstructorFullName(ins).toLowerCase() === activeDetailPlan.trainer.trim().toLowerCase() ||
              `${ins.firstName} ${ins.lastName}`.trim().toLowerCase() === activeDetailPlan.trainer.trim().toLowerCase() ||
              ins.instructorCode.toLowerCase() === activeDetailPlan.trainer.trim().toLowerCase(),
          );
          const displayTrainer = (matchedPlanInstructor ? formatInstructorFullName(matchedPlanInstructor) : activeDetailPlan.trainer) || "-";
          const companies = std?.companies ?? [];
          const estimate = calculateBudgetEstimate({
            totalBudget: activeDetailPlan.budget,
            participants: activeDetailPlan.participants,
            companyCount: companies.length,
          });

          return (
            <div className={styles.modalOverlay} onClick={() => setOpenDetailId("")}>
              <div
                className={styles.modalDialog}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className={styles.modalHeader}>
                  <div>
                    <p className={styles.kicker}>{t("รายละเอียดแผนการอบรมประจำปี (OAP Detail)", "Annual Training Plan Detail")}</p>
                    <h3 className={styles.modalTitle}>
                      [{activeDetailPlan.course.courseCode}] {getCourseDisplayName(activeDetailPlan.course)}
                    </h3>
                  </div>
                  <div className={styles.modalHeaderActions}>
                    <span className={`${styles.statusPill} ${styles[`status${activeDetailPlan.status}`]}`}>
                      <span className={styles.statusDot} />
                      {getStatusLabel(activeDetailPlan.status)}
                    </span>
                    <button
                      className={styles.modalCloseButton}
                      type="button"
                      onClick={() => setOpenDetailId("")}
                      aria-label="Close modal"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className={styles.modalBody}>
                  <div className={styles.previewSections}>
                    <div className={`${styles.previewCard} ${styles.previewCardFull}`}>
                      <div className={styles.previewCardHeader}><span><BookOpen size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("หลักสูตร (Course)", "Course Details")}</span></div>
                      <div className={styles.previewFieldGrid}>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ปีของแผนการอบรม (Plan Year)", "Annual Plan Year")}</span><span className={styles.previewFieldValue} style={{ fontWeight: 800, color: "var(--ui-30-primary, #2563eb)" }}>{activeDetailPlan.planYear ? (language === "th" ? `ปี พ.ศ. ${activeDetailPlan.planYear + 543} (ค.ศ. ${activeDetailPlan.planYear})` : `FY ${activeDetailPlan.planYear} (BE ${activeDetailPlan.planYear + 543})`) : "-"}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("กลุ่มหลักสูตร", "Course Group")}</span><span className={styles.previewFieldValue} translate="no">{activeDetailPlan.course.courseGroup || "-"}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("รหัสหลักสูตร", "Course Code")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.course.courseCode}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ชื่อหลักสูตร (ไทย)", "Course Name (TH)")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.course.courseNameTh}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ชื่อหลักสูตร (อังกฤษ)", "Course Name (EN)")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.course.courseNameEn}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("ที่มา (Background)", "Background")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{activeDetailPlan.course.remark || "-"}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("วัตถุประสงค์การเรียนรู้", "Learning Objective")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{activeDetailPlan.course.objective}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("หัวข้อการเรียนรู้", "Learning Content")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{activeDetailPlan.course.learningContent}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("วิธีการอบรม", "Methodology")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{activeDetailPlan.course.methodology}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ประเภทหลักสูตร", "Course Type")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.course.courseType}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("อายุหลักสูตร (เดือน)", "Validity (Months)")}</span><span className={styles.previewFieldValue}>{!activeDetailPlan.course.lifeCycleMonth || activeDetailPlan.course.lifeCycleMonth === "0" || Number(activeDetailPlan.course.lifeCycleMonth) === 0 ? "ไม่มีการหมดอายุ" : activeDetailPlan.course.lifeCycleMonth}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ผู้เข้าอบรม / รุ่น", "Participants / Batch")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.participants}</span></div>
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ชั่วโมงอบรม", "Training Hours")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.hours}</span></div>
                      </div>
                    </div>

                    <div className={styles.previewCard}>
                      <div className={styles.previewCardHeader}>
                        <span>
                          <Target size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                          {t("กลุ่มเป้าหมาย (Target Group)", "Target Group")}
                          {std?.isSnapshot ? (
                            <span style={{ marginLeft: 8, fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4, background: "rgba(34, 197, 94, 0.1)", color: "#16a34a", border: "1px solid rgba(34, 197, 94, 0.25)", fontWeight: 500 }}>
                              {t("เกณฑ์ ณ วันบันทึกแผน", "Saved Plan Target")}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("กลุ่มผู้เข้าอบรม", "Target Audience")}</span><span className={styles.previewFieldValue}>{std?.targetGroup || activeDetailPlan.course.targetGroup}</span></div>
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

                    <div className={styles.previewCard}>
                      <div className={styles.previewCardHeader}><span><User size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("ข้อมูลวิทยากร & สถาบัน (Instructor & Provider)", "Instructor & Provider Details")}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ชื่อวิทยากร", "Instructor Name")}</span><span className={styles.previewFieldValue}>{displayTrainer}</span></div>
                      {matchedPlanInstructor?.instructorCode ? (
                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("รหัสวิทยากร", "Instructor Code")}</span><span className={styles.previewFieldValue}>{matchedPlanInstructor.instructorCode}</span></div>
                      ) : null}
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("มหาวิทยาลัย", "University")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.instructorUniversity || matchedPlanInstructor?.university || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("วุฒิการศึกษา", "Education")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.instructorEducation || matchedPlanInstructor?.education || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("หน่วยงาน / สังกัด", "Organization")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.instructorOrganization || matchedPlanInstructor?.organizationName || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("เบอร์โทรศัพท์", "Telephone")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.instructorTelephone || matchedPlanInstructor?.telephone || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("อีเมล", "Email")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.instructorEmail || matchedPlanInstructor?.email || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ผู้ให้บริการ", "Provider")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.providerName || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Created By</span><span className={styles.previewFieldValue}>{activeDetailPlan.owner === "CENTER" ? "Center" : activeDetailPlan.ownerCompany}</span></div>
                    </div>

                    <div className={styles.previewCard}>
                      <div className={styles.previewCardHeader}><span><ClipboardCheck size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("แบบทดสอบ / แบบประเมิน", "Test / Evaluation")}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("แบบทดสอบก่อนเรียน", "Pre-Test")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.course.preTest || activeDetailPlan.course.preTestLink || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("แบบทดสอบหลังเรียน", "Post-Test")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.course.postTest || activeDetailPlan.course.postTestLink || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("แบบประเมิน", "Evaluation")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.course.evaluation || activeDetailPlan.course.evaluationLink || "-"}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("แบบประเมินหลัง 30 วัน", "30-Day Evaluation")}</span><span className={styles.previewFieldValue}>{activeDetailPlan.course.evaluationAfter30Day || activeDetailPlan.course.evaluationAfter30DayLink || "-"}</span></div>
                    </div>

                    <div className={styles.previewCard}>
                      <div className={styles.previewCardHeader}><span><Coins size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />Budget</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Instructor Budget</span><span className={styles.previewFieldValue}>฿{Number(activeDetailPlan.budgetInstructor || 0).toLocaleString("en-US")}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Traveling Budget</span><span className={styles.previewFieldValue}>฿{Number(activeDetailPlan.budgetTraveling || 0).toLocaleString("en-US")}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Seminar Room Budget</span><span className={styles.previewFieldValue}>฿{Number(activeDetailPlan.budgetSeminarRoom || 0).toLocaleString("en-US")}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Accommodation Budget</span><span className={styles.previewFieldValue}>฿{Number(activeDetailPlan.budgetAccommodation || 0).toLocaleString("en-US")}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Material Budget</span><span className={styles.previewFieldValue}>฿{Number(activeDetailPlan.budgetMaterial || 0).toLocaleString("en-US")}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Food &amp; Beverage Budget</span><span className={styles.previewFieldValue}>฿{Number(activeDetailPlan.budgetFoodBeverage || 0).toLocaleString("en-US")}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewTotalRow}`}><span className={styles.previewFieldLabel}>Total Budget</span><span className={styles.previewFieldValue}>฿{Number(activeDetailPlan.budget).toLocaleString("en-US")}</span></div>
                    </div>

                    <div className={styles.previewCard}>
                      <div className={styles.previewCardHeader}><span><Wallet size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("ค่าใช้จ่ายประมาณการ", "Estimated Expenses")}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}>
                        <span className={styles.previewFieldLabel}>{t("จำนวนที่แต่ละบริษัทส่งได้", "Quota per Company")}</span>
                        <span className={styles.previewFieldValue}>
                          {estimate.seatsPerCompany === null ? "-" : (language === "th" ? `${estimate.seatsPerCompany} คน` : `${estimate.seatsPerCompany} seats`)}
                        </span>
                      </div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("งบประมาณรวม", "Total Budget")}</span><span className={styles.previewFieldValue}>{formatBaht(estimate.totalBudget)}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ค่าใช้จ่ายประมาณการต่อคน (กรณีเต็มจำนวน)", "Est. Cost per Person (full capacity)")}</span><span className={styles.previewFieldValue}>{formatBaht(estimate.costPerPerson)}</span></div>
                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewTotalRow}`}><span className={styles.previewFieldLabel}>{t("ค่าใช้จ่ายประมาณการต่อบริษัท (กรณีเต็มจำนวน)", "Est. Cost per Company (full capacity)")}</span><span className={styles.previewFieldValue}>{formatBaht(estimate.costPerCompany)}</span></div>
                    </div>
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button
                    className={styles.dangerButton}
                    disabled={activeDetailPlan.status === "Cancel"}
                    type="button"
                    onClick={() => {
                      void confirm({
                        message: { th: "ยืนยันที่จะยกเลิกแผนฝึกอบรมประจำปีนี้หรือไม่?", en: "Confirm cancelling this annual training plan?" },
                        danger: true,
                      }).then((ok) => {
                        if (ok) {
                          void updateStatus(activeDetailPlan.id, "Cancel");
                          setOpenDetailId("");
                        }
                      });
                    }}
                  >
                    Cancel Plan
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => setOpenDetailId("")}
                  >
                    {t("ปิด", "Close")}
                  </button>
                </div>
              </div>
            </div>
          );
        })() : null}

        <div className={styles.companySectionsContainer}>
          {companySections.map((section) => (
            <div key={section.companyName} className={styles.companySectionBlock}>
              <div className={`${styles.companySectionHeader} ${section.isUserCompany ? styles.ownCompanySectionHeader : ""}`}>
                <div className={styles.companySectionTitle}>
                  <span className={styles.companyIcon}>{section.companyName === "HRD Center" ? <Building2 size={18} /> : <Factory size={18} />}</span>
                  <h4>{t(`แผนอบรม ${section.companyName}`, `Training Plan - ${section.companyName}`)}</h4>
                  {section.isUserCompany ? <span className={styles.ownCompanySectionTag}><Star size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t(`บริษัทของฉัน (${userCompanyCode || "HRD Center"})`, `My Company (${userCompanyCode || "HRD Center"})`)}</span> : null}
                </div>
                <span className={styles.companyCountBadge}>{section.plans.length} {t("หลักสูตร", "courses")}</span>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.planTable}>
                  <thead>
                    <tr>
                      <th>Seq.</th>
                      <th>{t("ปีของแผน", "Plan Year")}</th>
                      <th>Course Name</th>
                      <th>Actions</th>
                      <th>Course Group</th>
                      <th>Status</th>
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
                      const isCenterPlan = isCenterOwnedOap(plan);
                      const isRowReadOnlyForFactory = isFactoryUser && isCenterPlan;
                      const matchedPlanInstructor = instructors.find(
                        (ins) =>
                          (plan.instructorId && ins.instructorId === plan.instructorId) ||
                          formatInstructorFullName(ins).toLowerCase() === plan.trainer.trim().toLowerCase() ||
                          `${ins.firstName} ${ins.lastName}`.trim().toLowerCase() === plan.trainer.trim().toLowerCase() ||
                          ins.instructorCode.toLowerCase() === plan.trainer.trim().toLowerCase(),
                      );
                      const displayTrainer = (matchedPlanInstructor ? formatInstructorFullName(matchedPlanInstructor) : plan.trainer) || "-";
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
                              <span
                                className={styles.yearBadge}
                                title={t(
                                  `แผนการอบรมประจำปี พ.ศ. ${plan.planYear ? plan.planYear + 543 : "-"} (${plan.planYear || "-"})`,
                                  `Annual Training Plan FY ${plan.planYear || "-"} (BE ${plan.planYear ? plan.planYear + 543 : "-"})`,
                                )}
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <Calendar size={13} />
                                  <strong>{plan.planYear ? (language === "th" ? `${plan.planYear + 543}` : `${plan.planYear}`) : "-"}</strong>
                                </span>
                                <small>
                                  {plan.planYear ? (language === "th" ? `(${plan.planYear})` : `(BE ${plan.planYear + 543})`) : ""}
                                </small>
                              </span>
                            </td>
                            <td>
                              <strong>{getCourseDisplayName(plan.course)}</strong>
                              <span>
                                {plan.course.courseCode}
                                {getCourseSecondaryName(plan.course)
                                  ? ` / ${getCourseSecondaryName(plan.course)}`
                                  : ""}
                              </span>
                              {isCenterPlan ? (
                                <div>
                                  <span className={styles.creatorBadgeCenter}>
                                    <Building2 size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                                    {t("จัดหลักสูตรโดย HRD Center", "Organized by HRD Center")}
                                  </span>
                                </div>
                              ) : plan.ownerCompany ? (
                                <div>
                                  <span className={styles.creatorBadgeFactory}>
                                    <Factory size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                                    {t(`จัดหลักสูตรโดย ${plan.ownerCompany}`, `Organized by ${plan.ownerCompany}`)}
                                  </span>
                                </div>
                              ) : null}
                            </td>
                            <td className={styles.actionCell} onClick={(e) => e.stopPropagation()}>
                              <div className={styles.actionButtons}>
                                <button
                                  className={`${styles.rowActionButton} ${styles.detailsAction}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlanId(plan.id);
                                    setOpenDetailId(plan.id);
                                  }}
                                  title={t("ดูรายละเอียด", "Details")}
                                >
                                  {t("รายละเอียด", "Details")}
                                </button>
                                <button
                                  className={`${styles.rowActionButton} ${styles.secondaryButton}`}
                                  disabled={isRowReadOnlyForFactory || plan.status === "Cancel"}
                                  title={isRowReadOnlyForFactory ? t("แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้", "Center plan cannot be edited by factory users") : undefined}
                                  type="button"
                                  onClick={() => {
                                    if (isRowReadOnlyForFactory) return;
                                    setSelectedPlanId(plan.id);
                                    handleEdit(plan);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className={`${styles.rowActionButton} ${styles.dangerAction}`}
                                  disabled={isRowReadOnlyForFactory}
                                  title={isRowReadOnlyForFactory ? t("แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้", "Center plan cannot be deleted by factory users") : undefined}
                                  type="button"
                                  onClick={() => {
                                    if (isRowReadOnlyForFactory) return;
                                    setSelectedPlanId(plan.id);
                                    void handleDelete(plan.id);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                            <td translate="no">{plan.course.courseGroup || "-"}</td>
                            <td>
                              <span className={`${styles.statusPill} ${styles[`status${plan.status}`]}`}>
                                <span className={styles.statusDot} />
                                {getStatusLabel(plan.status)}
                              </span>
                            </td>
                            <td>{plan.participants}</td>
                            <td>{plan.hours}</td>
                            <td>{Number(plan.budget).toLocaleString("en-US")}</td>
                            <td>{displayTrainer}</td>
                            <td>{plan.providerName}</td>
                          </tr>
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
              <strong>{t("ไม่พบแผนการอบรม", "No training plans found")}</strong>
              <span>{t("ลองเปลี่ยนคำค้นหา ปีของแผน หรือตัวกรองสถานะ", "Try changing the search text, plan year, or status filter.")}</span>
            </div>
          ) : null}
        </div>
      </section>


    </section>
  );
}
