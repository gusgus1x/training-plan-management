"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { APPROVED_TRAINING_NEED_STORAGE_KEY } from "../../../../lib/trainingRequests";
import type { NeedRequestRecord } from "../../../../lib/trainingNeedRequests/types";
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

export type MissingCourseField = {
  key: string;
  category: "target" | "detail" | "evaluation";
  labelTh: string;
  labelEn: string;
  icon: React.ReactNode;
};

const getMissingCourseFields = (
  course: WorkflowCourse | null,
  standard: WorkflowStandard | null,
): MissingCourseField[] => {
  if (!course) return [];
  const missing: MissingCourseField[] = [];

  // 1. ที่มา (Background / Reason)
  if (!course.remark?.trim()) {
    missing.push({ key: "remark", category: "detail", labelTh: "ที่มา (Background / Reason)", labelEn: "Background / Reason", icon: <FileText size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }

  // 2. วัตถุประสงค์การเรียนรู้ (Objective)
  if (!course.objective?.trim()) {
    missing.push({ key: "objective", category: "detail", labelTh: "วัตถุประสงค์การเรียนรู้ (Objective)", labelEn: "Learning Objective", icon: <Target size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }

  // 3. หัวข้อการเรียนรู้ (Learning Content)
  if (!course.learningContent?.trim()) {
    missing.push({ key: "learningContent", category: "detail", labelTh: "หัวข้อการเรียนรู้ (Learning Content)", labelEn: "Learning Content", icon: <BookOpen size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }

  // 4. กลุ่มผู้เข้าอบรม (Target Group)
  if (!course.targetGroup?.trim()) {
    missing.push({ key: "targetGroup", category: "target", labelTh: "กลุ่มผู้เข้าอบรม (Target Group)", labelEn: "Target Group", icon: <Users size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }

  // 5. วิธีการอบรม (Methodology)
  if (!course.methodology?.trim()) {
    missing.push({ key: "methodology", category: "detail", labelTh: "วิธีการอบรม (Methodology)", labelEn: "Methodology", icon: <Settings size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }

  // 6. ตำแหน่งกลุ่มเป้าหมาย (Target Positions)
  const hasPositions = standard?.positions && standard.positions.length > 0;
  if (!hasPositions) {
    missing.push({ key: "positions", category: "target", labelTh: "ตำแหน่งกลุ่มเป้าหมาย (Target Positions)", labelEn: "Target Positions", icon: <Briefcase size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }

  // 7. ระดับกลุ่มเป้าหมาย (Target Levels)
  const hasLevels = standard?.levels && standard.levels.length > 0;
  if (!hasLevels) {
    missing.push({ key: "levels", category: "target", labelTh: "ระดับกลุ่มเป้าหมาย (Target Levels)", labelEn: "Target Levels", icon: <Star size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }

  // 8. สายงานกลุ่มเป้าหมาย (Target Function)
  const hasFunction = Boolean(standard?.functionName?.trim() || standard?.functionCode?.trim());
  if (!hasFunction) {
    missing.push({ key: "function", category: "target", labelTh: "สายงานกลุ่มเป้าหมาย (Target Function)", labelEn: "Target Function", icon: <Building2 size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }

  // 9. กลุ่มและประเภทหลักสูตร
  if (!course.courseGroup?.trim()) {
    missing.push({ key: "courseGroup", category: "detail", labelTh: "กลุ่มหลักสูตร (Course Group)", labelEn: "Course Group", icon: <Tag size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }
  if (!course.courseType?.trim()) {
    missing.push({ key: "courseType", category: "detail", labelTh: "ประเภทหลักสูตร (Course Type)", labelEn: "Course Type", icon: <Folder size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }

  // 10. แบบทดสอบและแบบประเมิน
  if (!course.preTestId && !course.preTestLink && !course.preTest?.trim()) {
    missing.push({ key: "preTest", category: "evaluation", labelTh: "แบบทดสอบก่อนเรียน (Pre-Test)", labelEn: "Pre-Test Form", icon: <FileEdit size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }
  if (!course.postTestId && !course.postTestLink && !course.postTest?.trim()) {
    missing.push({ key: "postTest", category: "evaluation", labelTh: "แบบทดสอบหลังเรียน (Post-Test)", labelEn: "Post-Test Form", icon: <ClipboardList size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }
  if (!course.evaluationId && !course.evaluationLink && !course.evaluation?.trim()) {
    missing.push({ key: "evaluation", category: "evaluation", labelTh: "แบบประเมินผลการอบรม (Evaluation Form)", labelEn: "Evaluation Form", icon: <Star size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> });
  }

  return missing;
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

const readApprovedTrainingNeed = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
    return storedValue ? (JSON.parse(storedValue) as NeedRequestRecord) : null;
  } catch {
    return null;
  }
};

const matchCourseForRequest = (requestName: string, courseList: WorkflowCourse[]): WorkflowCourse | null => {
  if (!requestName || !courseList.length) return null;
  const trimmed = requestName.trim();

  // 1. Extract course code in brackets e.g. "[SY-000002]"
  const codeInBrackets = trimmed.match(/\[([A-Za-z0-9_-]+)\]/);
  if (codeInBrackets) {
    const code = codeInBrackets[1].toLowerCase();
    const found = courseList.find((c) => c.courseCode.toLowerCase() === code);
    if (found) return found;
  }

  // 2. Exact match on courseCode
  const exactCode = courseList.find((c) => trimmed.toLowerCase().startsWith(c.courseCode.toLowerCase()));
  if (exactCode) return exactCode;

  // 3. Exact match on courseNameTh or courseNameEn
  const exactName = courseList.find(
    (c) =>
      trimmed.includes(c.courseNameTh) ||
      (c.courseNameEn && trimmed.includes(c.courseNameEn)),
  );
  if (exactName) return exactName;

  return null;
};

const RequiredIndicator = ({ isFilled }: { isFilled: boolean }) => (
  <span
    className={isFilled ? styles.indicatorDone : styles.indicatorPending}
    title={isFilled ? "กรอกข้อมูลเรียบร้อยแล้ว / Completed" : "จำเป็นต้องกรอก / Required field"}
  >
    <span className={styles.indicatorDot} />
  </span>
);

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OapStatus>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [instructors, setInstructors] = useState<InstructorRecord[]>([]);
  const [providers, setProviders] = useState<InstituteProviderRecord[]>([]);
  const [showTargetWarningModal, setShowTargetWarningModal] = useState(false);
  const lastWarnedCourseRef = useRef<string | null>(null);
  const userCompanyCode = profileValue(user?.companyCode);

  useEffect(() => {
    const handleApprovedTrainingNeed = () => {
      const request = readApprovedTrainingNeed();
      if (!request) return;

      // Consume once and immediately clear from localStorage
      window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);

      setApprovedRequest(request);
      const matched = matchCourseForRequest(request.requestedCourseName, courses);
      setForm({
        ...emptyForm,
        courseCode: matched ? matched.courseCode : "",
        participants: "1",
        provider: "HRD Center",
      });
      setEditingId("");
      setOpenDetailId("");
      setIsNewOpen(true);
    };

    window.addEventListener("approved-training-need-changed", handleApprovedTrainingNeed);

    return () => {
      window.removeEventListener("approved-training-need-changed", handleApprovedTrainingNeed);
    };
  }, [courses]);

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

      const pendingRequest = readApprovedTrainingNeed();
      if (pendingRequest) {
        window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
        setApprovedRequest(pendingRequest);
        const matched = matchCourseForRequest(pendingRequest.requestedCourseName, loadedCourses);
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

  const missingCourseFields = useMemo(
    () => getMissingCourseFields(selectedCourse, selectedCourseStandard),
    [selectedCourse, selectedCourseStandard],
  );

  const popupTriggerMissingFields = useMemo(
    () => missingCourseFields.filter((f) => f.category !== "evaluation"),
    [missingCourseFields],
  );

  const hasTargetGroupMissing = useMemo(
    () => missingCourseFields.some((f) => f.key === "positions" || f.key === "levels"),
    [missingCourseFields],
  );

  const missingTargetFields = useMemo(
    () => missingCourseFields.filter((f) => f.category === "target"),
    [missingCourseFields],
  );

  const missingDetailFields = useMemo(
    () => missingCourseFields.filter((f) => f.category === "detail"),
    [missingCourseFields],
  );

  useEffect(() => {
    if (!isNewOpen || !selectedCourse) {
      if (!isNewOpen) {
        lastWarnedCourseRef.current = null;
        setShowTargetWarningModal(false);
      }
      return;
    }

    if (lastWarnedCourseRef.current !== selectedCourse.courseCode) {
      lastWarnedCourseRef.current = selectedCourse.courseCode;
      if (popupTriggerMissingFields.length > 0) {
        setShowTargetWarningModal(true);
      } else {
        setShowTargetWarningModal(false);
      }
    }
  }, [isNewOpen, selectedCourse, popupTriggerMissingFields]);

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
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase());
        })
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
    [companyFilter, scopedPlans, search, statusFilter, userCompanyCode, language],
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

  const resolveInstructorId = (trainerName: string) => {
    if (form.instructorId) return form.instructorId;
    const trimmed = trainerName.trim();
    if (!trimmed) return null;
    const matched = instructors.find(
      (instructor) =>
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
          `${ins.firstName} ${ins.lastName}`.trim().toLowerCase() === t ||
          ins.instructorCode.toLowerCase() === t,
      ) ?? null
    );
  }, [form.instructorId, form.trainer, instructors]);

  const instructorOptions = useMemo(() => {
    return instructors.map((ins) => {
      const fullName = `${ins.firstName} ${ins.lastName}`.trim();
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
      const fullName = `${ins.firstName} ${ins.lastName}`.trim();
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

    const wasEditing = Boolean(editingId);

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
        `${ins.firstName} ${ins.lastName}`.trim().toLowerCase() === plan.trainer.trim().toLowerCase() ||
        ins.instructorCode.toLowerCase() === plan.trainer.trim().toLowerCase(),
    );
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
      instructorId: matched?.instructorId ?? "",
      instructorUniversity: matched?.university ?? "",
      instructorEducation: matched?.education ?? "",
      instructorOrganization: matched?.organizationName ?? "",
      instructorTelephone: matched?.telephone ?? "",
      instructorEmail: matched?.email ?? "",
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 800, color: "#007a3d", fontSize: "0.84rem" }}>
                    <><Pin size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("สร้างแผนจากคำขอฝึกอบรม", "Created from Training Request")} #{approvedRequest.requestNo}</>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setApprovedRequest(null);
                      window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
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
              </div>
            ) : null}
            <div className={styles.formGrid}>
              <div className={styles.fullField}>
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

                  {/* Course Master Completeness Notification */}
                  {missingCourseFields.length > 0 ? (
                    <div className={styles.incompleteCourseAlert}>
                      <div className={styles.incompleteAlertHeader}>
                        <span className={styles.incompleteAlertIcon}><AlertTriangle size={18} color="#f59e0b" /></span>
                        <div className={styles.incompleteAlertTitle}>
                          <strong>{t("ข้อมูลใน Course Master ยังไม่ครบถ้วน", "Course Master Information Incomplete")}</strong>
                          <span>
                            {t(
                              `หลักสูตร [${selectedCourse.courseCode}] ยังขาดข้อมูล ${missingCourseFields.length} ส่วน:`,
                              `Course [${selectedCourse.courseCode}] is missing ${missingCourseFields.length} field(s):`,
                            )}
                          </span>
                        </div>
                      </div>

                      {hasTargetGroupMissing && (
                        <div className={styles.targetWarningCallout} style={{ margin: "4px 0 10px" }}>
                          <span className={styles.targetWarningCalloutIcon}><AlertTriangle size={18} /></span>
                          <div className={styles.targetWarningCalloutText}>
                            <strong>
                              {t(
                                "⚠️ ข้อควรระวัง: ยังไม่ได้ระบุตำแหน่งกลุ่มเป้าหมาย หรือระดับกลุ่มเป้าหมาย",
                                "⚠️ Warning: Target Positions or Levels are not specified",
                              )}
                            </strong>
                            <span>
                              {t(
                                "หากไม่ใส่ตำแหน่งและระดับกลุ่มเป้าหมาย จะทำให้คุณไม่ทราบกลุ่มเป้าหมายที่ชัดเจน และระบบจะไม่สามารถจับคู่คัดกรองพนักงานในแบบตอบรับการอบรม (Training Accept Survey) ได้",
                                "Without specifying target positions and levels, you will not know the exact target audience, and the system cannot match employees in the Training Accept Survey.",
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className={styles.missingPillsList}>
                        {missingCourseFields.map((field) => (
                          <span
                            key={field.key}
                            className={
                              field.key === "positions" || field.key === "levels"
                                ? styles.targetWarningPillHigh
                                : styles.missingPill
                            }
                          >
                            {field.icon} {t(field.labelTh, field.labelEn)}
                          </span>
                        ))}
                      </div>

                      <div className={styles.incompleteAlertFooter}>
                        <p className={styles.incompleteAlertQuestion}>
                          <><MessageSquare size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("ต้องการไปกรอกข้อมูลใน Course Master ก่อน หรือสร้างแผน OAP ต่อได้เลย?", "Would you like to complete the Course Master details first, or proceed with OAP anyway?")}</>
                        </p>
                        <div className={styles.incompleteAlertActions}>
                          <button
                            type="button"
                            className={styles.goToCourseMasterBtn}
                            onClick={() => {
                              const targetUrl = selectedCourse
                                ? `/training-course/course-master-standard?editCourse=${encodeURIComponent(selectedCourse.courseCode)}`
                                : "/training-course/course-master-standard";
                              router.push(targetUrl);
                            }}
                          >
                            <><FileEdit size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("ไปกรอกข้อมูลใน Course Master ก่อน", "Go to Course Master")}</>
                          </button>
                          <span className={styles.orDivider}>{t("หรือ", "or")}</span>
                          <span className={styles.proceedNote}>
                            {t("กรอกข้อมูลด้านล่างแล้วสร้างแผน OAP ต่อได้เลย", "Fill in details below and create OAP plan directly")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.completeCourseBadge}>
                      <span><CheckCircle2 size={14} color="#10b981" style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />{t("ข้อมูลใน Course Master ครบถ้วนสมบูรณ์แล้ว", "Course Master information is complete")}</span>
                    </div>
                  )}
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
                        (~฿{Math.round(Number(form.budget) / Number(form.participants)).toLocaleString("en-US")} / " + t("คน", "person") + ")
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
                      placeholder={t("เช่น อ.สมชาย ใจดี", "e.g. Dr. John Doe")}
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
                          ? `${selectedInstructor.firstName} ${selectedInstructor.lastName}`
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
                            (~฿{Math.round(Number(form.budget) / Number(form.participants)).toLocaleString("en-US")} / " + t("คน", "person") + ")
                          </span>
                        ) : null}
                      </span>
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
                                      <div className={styles.previewCardHeader}><span><BookOpen size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("หลักสูตร (Course)", "Course Details")}</span></div>
                                      <div className={styles.previewFieldGrid}>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("กลุ่มหลักสูตร", "Course Group")}</span><span className={styles.previewFieldValue} translate="no">{plan.course.courseGroup || "-"}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("รหัสหลักสูตร", "Course Code")}</span><span className={styles.previewFieldValue}>{plan.course.courseCode}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ชื่อหลักสูตร (ไทย)", "Course Name (TH)")}</span><span className={styles.previewFieldValue}>{plan.course.courseNameTh}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ชื่อหลักสูตร (อังกฤษ)", "Course Name (EN)")}</span><span className={styles.previewFieldValue}>{plan.course.courseNameEn}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("ที่มา (Background)", "Background")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.remark || "-"}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("วัตถุประสงค์การเรียนรู้", "Learning Objective")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.objective}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("หัวข้อการเรียนรู้", "Learning Content")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.learningContent}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>{t("วิธีการอบรม", "Methodology")}</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.methodology}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ประเภทหลักสูตร", "Course Type")}</span><span className={styles.previewFieldValue}>{plan.course.courseType}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("อายุหลักสูตร (เดือน)", "Validity (Months)")}</span><span className={styles.previewFieldValue}>{!plan.course.lifeCycleMonth || plan.course.lifeCycleMonth === "0" || Number(plan.course.lifeCycleMonth) === 0 ? "ไม่มีการหมดอายุ" : plan.course.lifeCycleMonth}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ผู้เข้าอบรม / รุ่น", "Participants / Batch")}</span><span className={styles.previewFieldValue}>{plan.participants}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ชั่วโมงอบรม", "Training Hours")}</span><span className={styles.previewFieldValue}>{plan.hours}</span></div>
                                      </div>
                                    </div>

                                    {(() => {
                                      const std = standards.find((item) => item.courseId === plan.course.id);
                                      return (
                                        <div className={styles.previewCard}>
                                          <div className={styles.previewCardHeader}><span><Target size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("กลุ่มเป้าหมาย (Target Group)", "Target Group")}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("กลุ่มผู้เข้าอบรม", "Target Audience")}</span><span className={styles.previewFieldValue}>{plan.course.targetGroup}</span></div>
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

                                    {(() => {
                                      const matchedPlanInstructor = instructors.find(
                                        (ins) =>
                                          `${ins.firstName} ${ins.lastName}`.trim().toLowerCase() === plan.trainer.trim().toLowerCase() ||
                                          ins.instructorCode.toLowerCase() === plan.trainer.trim().toLowerCase(),
                                      );
                                      return (
                                        <div className={styles.previewCard}>
                                          <div className={styles.previewCardHeader}><span><User size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("ข้อมูลวิทยากร & สถาบัน (Instructor & Provider)", "Instructor & Provider Details")}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ชื่อวิทยากร", "Instructor Name")}</span><span className={styles.previewFieldValue}>{plan.trainer || "-"}</span></div>
                                          {matchedPlanInstructor?.instructorCode ? (
                                            <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("รหัสวิทยากร", "Instructor Code")}</span><span className={styles.previewFieldValue}>{matchedPlanInstructor.instructorCode}</span></div>
                                          ) : null}
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("มหาวิทยาลัย", "University")}</span><span className={styles.previewFieldValue}>{matchedPlanInstructor?.university || "-"}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("วุฒิการศึกษา", "Education")}</span><span className={styles.previewFieldValue}>{matchedPlanInstructor?.education || "-"}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("หน่วยงาน / สังกัด", "Organization")}</span><span className={styles.previewFieldValue}>{matchedPlanInstructor?.organizationName || "-"}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("เบอร์โทรศัพท์", "Telephone")}</span><span className={styles.previewFieldValue}>{matchedPlanInstructor?.telephone || "-"}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("อีเมล", "Email")}</span><span className={styles.previewFieldValue}>{matchedPlanInstructor?.email || "-"}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("ผู้ให้บริการ", "Provider")}</span><span className={styles.previewFieldValue}>{plan.providerName || "-"}</span></div>
                                          <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Created By</span><span className={styles.previewFieldValue}>{plan.owner === "CENTER" ? "Center" : plan.ownerCompany}</span></div>
                                        </div>
                                      );
                                    })()}

                                    <div className={styles.previewCard}>
                                      <div className={styles.previewCardHeader}><span><ClipboardCheck size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />{t("แบบทดสอบ / แบบประเมิน", "Test / Evaluation")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("แบบทดสอบก่อนเรียน", "Pre-Test")}</span><span className={styles.previewFieldValue}>{plan.course.preTest || plan.course.preTestLink || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("แบบทดสอบหลังเรียน", "Post-Test")}</span><span className={styles.previewFieldValue}>{plan.course.postTest || plan.course.postTestLink || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("แบบประเมิน", "Evaluation")}</span><span className={styles.previewFieldValue}>{plan.course.evaluation || plan.course.evaluationLink || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>{t("แบบประเมินหลัง 30 วัน", "30-Day Evaluation")}</span><span className={styles.previewFieldValue}>{plan.course.evaluationAfter30Day || plan.course.evaluationAfter30DayLink || "-"}</span></div>
                                    </div>

                                    <div className={styles.previewCard}>
                                      <div className={styles.previewCardHeader}><span><Coins size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />Budget</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Instructor Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetInstructor || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Traveling Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetTraveling || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Seminar Room Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetSeminarRoom || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Accommodation Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetAccommodation || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Material Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetMaterial || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Food &amp; Beverage Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budgetFoodBeverage || 0).toLocaleString("en-US")}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewTotalRow}`}><span className={styles.previewFieldLabel}>Total Budget</span><span className={styles.previewFieldValue}>฿{Number(plan.budget).toLocaleString("en-US")}</span></div>
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
                                      );
                                    })()}
                                  </div>
                                  <div className={styles.formActions}>
                                    <button className={styles.dangerButton} disabled={plan.status === "Cancel"} type="button" onClick={() => { void confirm({ message: { th: "ยืนยันที่จะยกเลิกแผนฝึกอบรมประจำปีนี้หรือไม่?", en: "Confirm cancelling this annual training plan?" }, danger: true }).then((ok) => { if (ok) void updateStatus(plan.id, "Cancel"); }); }}>Cancel Plan</button>
                                    <button className={styles.secondaryButton} type="button" onClick={() => setOpenDetailId("")}>{t("ปิด", "Close")}</button>
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

      {/* Target Group & Course Details Warning Modal */}
      {showTargetWarningModal && selectedCourse && (
        <div
          className={styles.targetWarningBackdrop}
          onClick={() => setShowTargetWarningModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="target-warning-modal-title"
        >
          <div
            className={styles.targetWarningModal}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.targetWarningHeader}>
              <div className={styles.targetWarningHeaderTitle}>
                <div className={styles.targetWarningHeaderIcon}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 id="target-warning-modal-title">
                    {t(
                      "แจ้งเตือน: ข้อมูลหลักสูตรใน Course Master ยังไม่ครบถ้วน",
                      "Warning: Course Master Information Incomplete",
                    )}
                  </h3>
                  <p>
                    {t(
                      `หลักสูตร: [${selectedCourse.courseCode}] ${getCourseDisplayName(selectedCourse)}`,
                      `Course: [${selectedCourse.courseCode}] ${getCourseDisplayName(selectedCourse)}`,
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={styles.targetWarningCloseBtn}
                onClick={() => setShowTargetWarningModal(false)}
                title={t("ปิดหน้าต่าง", "Close")}
              >
                <X size={20} />
              </button>
            </div>

            {/* Special Emphasized Callout for Target Positions / Levels */}
            {hasTargetGroupMissing && (
              <div className={styles.targetWarningCallout}>
                <div className={styles.targetWarningCalloutIcon}>
                  <AlertTriangle size={22} />
                </div>
                <div className={styles.targetWarningCalloutText}>
                  <strong>
                    {t(
                      "⚠️ ข้อควรระวัง: ยังไม่ได้ระบุตำแหน่งกลุ่มเป้าหมาย และระดับกลุ่มเป้าหมาย",
                      "⚠️ Warning: Target Positions and Target Levels are not specified",
                    )}
                  </strong>
                  <span>
                    {t(
                      "หากไม่ใส่ตำแหน่งและระดับกลุ่มเป้าหมาย คุณจะไม่ทราบกลุ่มเป้าหมายที่ชัดเจน และระบบจะไม่สามารถจับคู่คัดกรองพนักงานในแบบตอบรับการอบรม (Training Accept Survey) ได้",
                      "Without specifying target positions and levels, you will not know the exact target audience, and the system cannot match/filter employees in the Training Accept Survey.",
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Target Group Section */}
            {missingTargetFields.length > 0 && (
              <div className={styles.targetWarningSection}>
                <div className={styles.targetWarningSectionLabel}>
                  <Users size={14} />
                  <span>{t("ข้อมูลกลุ่มเป้าหมายที่ยังไม่ได้ระบุ:", "Missing Target Group Information:")}</span>
                </div>
                <div className={styles.targetWarningPillsList}>
                  {missingTargetFields.map((field) => (
                    <span
                      key={field.key}
                      className={
                        field.key === "positions" || field.key === "levels"
                          ? styles.targetWarningPillHigh
                          : styles.targetWarningPillNormal
                      }
                    >
                      {field.icon} {t(field.labelTh, field.labelEn)}
                      {(field.key === "positions" || field.key === "levels") && (
                        <span style={{ fontSize: "0.72rem", opacity: 0.9, marginLeft: 4 }}>({t("จำเป็นต่อ Survey", "Required for Survey")})</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Course Details Section */}
            {missingDetailFields.length > 0 && (
              <div className={styles.targetWarningSection}>
                <div className={styles.targetWarningSectionLabel}>
                  <FileText size={14} />
                  <span>{t("รายละเอียดภายในหลักสูตรที่ยังไม่ได้ระบุ:", "Missing Course Internal Details:")}</span>
                </div>
                <div className={styles.targetWarningPillsList}>
                  {missingDetailFields.map((field) => (
                    <span key={field.key} className={styles.targetWarningPillNormal}>
                      {field.icon} {t(field.labelTh, field.labelEn)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-note for Evaluation and Pre/Post tests */}
            <p className={styles.targetWarningSubNote}>
              {t(
                "💡 หมายเหตุ: แบบทดสอบก่อน/หลังเรียน และแบบประเมินผล สามารถกำหนดเพิ่มเติมในภายหลังได้ และจะไม่ขัดขวางการวางแผน OAP",
                "💡 Note: Pre/Post-tests and Evaluation forms can be configured later and will not block OAP planning.",
              )}
            </p>

            {/* Action Buttons */}
            <div className={styles.targetWarningActions}>
              <button
                type="button"
                className={styles.targetWarningSecondaryBtn}
                onClick={() => setShowTargetWarningModal(false)}
              >
                {t("รับทราบ และสร้างแผน OAP ต่อ", "Acknowledge & Proceed with OAP")}
              </button>
              <button
                type="button"
                className={styles.targetWarningPrimaryBtn}
                onClick={() => {
                  setShowTargetWarningModal(false);
                  const targetUrl = selectedCourse
                    ? `/training-course/course-master-standard?editCourse=${encodeURIComponent(selectedCourse.courseCode)}`
                    : "/training-course/course-master-standard";
                  router.push(targetUrl);
                }}
              >
                <FileEdit size={16} />
                {t("ไปกรอกข้อมูลใน Course Master ก่อน", "Go to Course Master")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
