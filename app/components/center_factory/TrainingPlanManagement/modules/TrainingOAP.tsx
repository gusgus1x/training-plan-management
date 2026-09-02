"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
  labelTh: string;
  labelEn: string;
  icon: string;
};

const getMissingCourseFields = (
  course: WorkflowCourse | null,
  standard: WorkflowStandard | null,
): MissingCourseField[] => {
  if (!course) return [];
  const missing: MissingCourseField[] = [];

  // 1. ที่มา (Background / Reason for training)
  if (!course.remark?.trim()) {
    missing.push({ key: "remark", labelTh: "ที่มา (Background / Reason)", labelEn: "Background / Reason", icon: "📜" });
  }

  // 2. วัตถุประสงค์การเรียนรู้ (Objective)
  if (!course.objective?.trim()) {
    missing.push({ key: "objective", labelTh: "วัตถุประสงค์การเรียนรู้ (Objective)", labelEn: "Learning Objective", icon: "🎯" });
  }

  // 3. หัวข้อการเรียนรู้ (Learning Content)
  if (!course.learningContent?.trim()) {
    missing.push({ key: "learningContent", labelTh: "หัวข้อการเรียนรู้ (Learning Content)", labelEn: "Learning Content", icon: "📚" });
  }

  // 4. กลุ่มผู้เข้าอบรม (Target Group)
  if (!course.targetGroup?.trim()) {
    missing.push({ key: "targetGroup", labelTh: "กลุ่มผู้เข้าอบรม (Target Group)", labelEn: "Target Group", icon: "👥" });
  }

  // 5. วิธีการอบรม (Methodology)
  if (!course.methodology?.trim()) {
    missing.push({ key: "methodology", labelTh: "วิธีการอบรม (Methodology)", labelEn: "Methodology", icon: "🛠️" });
  }

  // 6. ตำแหน่งกลุ่มเป้าหมาย (Target Positions)
  const hasPositions = standard?.positions && standard.positions.length > 0;
  if (!hasPositions) {
    missing.push({ key: "positions", labelTh: "ตำแหน่งกลุ่มเป้าหมาย (Target Positions)", labelEn: "Target Positions", icon: "💼" });
  }

  // 7. ระดับกลุ่มเป้าหมาย (Target Levels)
  const hasLevels = standard?.levels && standard.levels.length > 0;
  if (!hasLevels) {
    missing.push({ key: "levels", labelTh: "ระดับกลุ่มเป้าหมาย (Target Levels)", labelEn: "Target Levels", icon: "⭐" });
  }

  // 8. สายงานกลุ่มเป้าหมาย (Target Function)
  const hasFunction = Boolean(standard?.functionName?.trim() || standard?.functionCode?.trim());
  if (!hasFunction) {
    missing.push({ key: "function", labelTh: "สายงานกลุ่มเป้าหมาย (Target Function)", labelEn: "Target Function", icon: "🏢" });
  }

  // 9. กลุ่มและประเภทหลักสูตร
  if (!course.courseGroup?.trim()) {
    missing.push({ key: "courseGroup", labelTh: "กลุ่มหลักสูตร (Course Group)", labelEn: "Course Group", icon: "🏷️" });
  }
  if (!course.courseType?.trim()) {
    missing.push({ key: "courseType", labelTh: "ประเภทหลักสูตร (Course Type)", labelEn: "Course Type", icon: "📂" });
  }

  // 10. แบบทดสอบและแบบประเมิน
  if (!course.preTestId && !course.preTestLink && !course.preTest?.trim()) {
    missing.push({ key: "preTest", labelTh: "แบบทดสอบก่อนเรียน (Pre-Test)", labelEn: "Pre-Test Form", icon: "📝" });
  }
  if (!course.postTestId && !course.postTestLink && !course.postTest?.trim()) {
    missing.push({ key: "postTest", labelTh: "แบบทดสอบหลังเรียน (Post-Test)", labelEn: "Post-Test Form", icon: "📋" });
  }
  if (!course.evaluationId && !course.evaluationLink && !course.evaluation?.trim()) {
    missing.push({ key: "evaluation", labelTh: "แบบประเมินผลการอบรม (Evaluation Form)", labelEn: "Evaluation Form", icon: "🌟" });
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
          if (!standardCourseIds.has(course.id)) return false;
          if (isFactoryUser) {
            return (
              course.owner === "FACTORY" &&
              course.ownerCompany === userCompanyCode
            );
          }
          if (isCenterUser) {
            return (
              course.owner === "CENTER" ||
              course.ownerCompany === "CENTER" ||
              course.ownerCompany === "HRD Center" ||
              !course.ownerCompany
            );
          }
          return isWorkflowOwner(course.owner, course.ownerCompany, user?.roleCode, userCompanyCode);
        },
      );
      return standardizedCourses;
    },
    [courses, standardCourseIds, isFactoryUser, isCenterUser, user?.roleCode, userCompanyCode],
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
      toast.warning("แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้");
      return;
    }
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
    const targetPlan = plans.find((p) => p.id === planId);
    if (isFactoryUser && isCenterOwnedOap(targetPlan ?? null)) {
      toast.warning("แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้");
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
        <TypewriterLoader label="กำลังโหลดข้อมูลแผนการอบรมประจำปี (OAP)..." />
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
                    📌 {t("สร้างแผนจากคำขอฝึกอบรม", "Created from Training Request")} #{approvedRequest.requestNo}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setApprovedRequest(null);
                      window.localStorage.removeItem(APPROVED_TRAINING_NEED_STORAGE_KEY);
                    }}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "0.76rem" }}
                  >
                    ✕ {t("ยกเลิกการเชื่อมโยงคำขอ", "Unlink request")}
                  </button>
                </div>
                <strong style={{ fontSize: "0.95rem" }}>{approvedRequest.requestedCourseName}</strong>
                <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#475569" }}>
                  👤 {approvedRequest.employeeName} ({approvedRequest.companyCode} / {approvedRequest.functionName || "-"})
                  {approvedRequest.requestReason ? ` • เหตุผลที่ขอ: "${approvedRequest.requestReason}"` : ""}
                </p>
              </div>
            ) : null}
            <div className={styles.formGrid}>
              <div className={styles.fullField}>
                <span>Course Name <RequiredIndicator isFilled={Boolean(form.courseCode.trim())} /></span>
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
                      ? "🏢 Center (ส่วนกลาง)"
                      : `🏬 Factory (${course.ownerCompany || "โรงงาน"})`;

                    return {
                      value: course.courseCode,
                      label: `[${course.courseCode}] ${displayName}`,
                      secondaryLabel: secondaryName ? `${secondaryName} • ${ownerTag}` : ownerTag,
                      badge: isCenter ? "🏢 Center" : `🏬 ${course.ownerCompany || "Factory"}`,
                    };
                  })}
                  value={form.courseCode}
                  onChange={(code) => updateForm("courseCode", code)}
                  placeholder="🔍 พิมพ์เพื่อค้นหาหลักสูตร (รหัส/ชื่อ)... / Search course..."
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
                    <span className={styles.courseOwnerIcon}>{isSelectedCourseCenter ? "🏢" : "🏬"}</span>
                    <div className={styles.courseOwnerContent}>
                      <div className={styles.courseOwnerTitleRow}>
                        <strong>
                          {isSelectedCourseCenter
                            ? "หลักสูตรส่วนกลาง (HRD Center Course)"
                            : `หลักสูตรโรงงาน (Factory Course: ${selectedCourse.ownerCompany || "Factory"})`}
                        </strong>
                        <span
                          className={
                            isSelectedCourseCenter
                              ? styles.courseOwnerTagCenter
                              : styles.courseOwnerTagFactory
                          }
                        >
                          {isSelectedCourseCenter
                            ? "🏢 Center (ส่วนกลาง)"
                            : `🏬 Factory (${selectedCourse.ownerCompany || "โรงงาน"})`}
                        </span>
                      </div>
                      <p className={styles.courseOwnerDesc}>
                        {isSelectedCourseCenter
                          ? "หลักสูตรมาตรฐานส่วนกลาง พัฒนาและดูแลโดย HRD Center (ส่วนกลาง)"
                          : `หลักสูตรเฉพาะสร้างขึ้นโดยโรงงาน ${selectedCourse.ownerCompany || ""}`}
                      </p>
                    </div>
                  </div>

                  {/* Course Master Completeness Notification */}
                  {missingCourseFields.length > 0 ? (
                    <div className={styles.incompleteCourseAlert}>
                      <div className={styles.incompleteAlertHeader}>
                        <span className={styles.incompleteAlertIcon}>⚠️</span>
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

                      <div className={styles.missingPillsList}>
                        {missingCourseFields.map((field) => (
                          <span key={field.key} className={styles.missingPill}>
                            {field.icon} {t(field.labelTh, field.labelEn)}
                          </span>
                        ))}
                      </div>

                      <div className={styles.incompleteAlertFooter}>
                        <p className={styles.incompleteAlertQuestion}>
                          💬 {t("ต้องการไปกรอกข้อมูลใน Course Master ก่อน หรือสร้างแผน OAP ต่อได้เลย?", "Would you like to complete the Course Master details first, or proceed with OAP anyway?")}
                        </p>
                        <div className={styles.incompleteAlertActions}>
                          <button
                            type="button"
                            className={styles.goToCourseMasterBtn}
                            onClick={() => router.push("/training-course")}
                          >
                            ✏️ {t("ไปกรอกข้อมูลใน Course Master ก่อน", "Go to Course Master")}
                          </button>
                          <span className={styles.orDivider}>{t("หรือ", "or")}</span>
                          <span className={styles.proceedNote}>
                            👇 {t("กรอกข้อมูลด้านล่างแล้วสร้างแผน OAP ต่อได้เลย", "Fill in details below and create OAP plan directly")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.completeCourseBadge}>
                      <span>✅ {t("ข้อมูลใน Course Master ครบถ้วนสมบูรณ์แล้ว", "Course Master information is complete")}</span>
                    </div>
                  )}
                </div>
              ) : null}
              <label>
                <span>Participants / Group <RequiredIndicator isFilled={Boolean(form.participants.trim())} /></span>
                <input
                  disabled={!selectedCourse}
                  inputMode="numeric"
                  placeholder="Enter participants per group, e.g. 20"
                  value={form.participants}
                  onChange={(event) => updateForm("participants", event.target.value)}
                />
              </label>
              <label>
                <span>Training Hours <RequiredIndicator isFilled={Boolean(form.hours.trim())} /></span>
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
                      <span className={styles.previewBadge} translate="no">
                        📂 {selectedCourse.courseGroup}
                      </span>
                    ) : null}
                    <span className={styles.previewBadge}>
                      ⏱️ {!selectedCourse.lifeCycleMonth || selectedCourse.lifeCycleMonth === "0" || Number(selectedCourse.lifeCycleMonth) === 0 ? "ไม่มีการหมดอายุ" : `${selectedCourse.lifeCycleMonth} Months`}
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
                      <span className={styles.previewFieldValue}>{selectedCourse.preTest || selectedCourse.preTestLink || "None"}</span>
                    </div>
                    <div className={styles.previewFieldRow}>
                      <span className={styles.previewFieldLabel}>Post-Test</span>
                      <span className={styles.previewFieldValue}>{selectedCourse.postTest || selectedCourse.postTestLink || "None"}</span>
                    </div>
                  </div>

                  <div className={styles.previewCard}>
                    <div className={styles.previewCardHeader}>
                      <span>⭐ Evaluation Forms</span>
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
                            </td>
                            <td translate="no">{plan.course.courseGroup || "-"}</td>
                            <td>
                              <span className={`${styles.statusPill} ${styles[`status${plan.status}`]}`}>
                                <span className={styles.statusDot} />
                                {getStatusLabel(plan.status)}
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
                                  disabled={isRowReadOnlyForFactory || plan.status === "Cancel"}
                                  title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้" : undefined}
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
                                  title={isRowReadOnlyForFactory ? "แผนจัดอบรมของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : undefined}
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
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>กลุ่มหลักสูตร</span><span className={styles.previewFieldValue} translate="no">{plan.course.courseGroup || "-"}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>รหัสหลักสูตร</span><span className={styles.previewFieldValue}>{plan.course.courseCode}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ชื่อหลักสูตร (ไทย)</span><span className={styles.previewFieldValue}>{plan.course.courseNameTh}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ชื่อหลักสูตร (อังกฤษ)</span><span className={styles.previewFieldValue}>{plan.course.courseNameEn}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>ที่มา (Background)</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.remark || "-"}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>วัตถุประสงค์การเรียนรู้</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.objective}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>หัวข้อการเรียนรู้</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.learningContent}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn} ${styles.previewFieldFull}`}><span className={styles.previewFieldLabel}>วิธีการอบรม</span><span className={styles.previewFieldValue} style={{ whiteSpace: "pre-line" }}>{plan.course.methodology}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ประเภทหลักสูตร</span><span className={styles.previewFieldValue}>{plan.course.courseType}</span></div>
                                        <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>อายุหลักสูตร (เดือน)</span><span className={styles.previewFieldValue}>{!plan.course.lifeCycleMonth || plan.course.lifeCycleMonth === "0" || Number(plan.course.lifeCycleMonth) === 0 ? "ไม่มีการหมดอายุ" : plan.course.lifeCycleMonth}</span></div>
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
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>ผู้ให้บริการ</span><span className={styles.previewFieldValue}>{plan.providerName || "-"}</span></div>
                                      <div className={`${styles.previewFieldRow} ${styles.previewFieldColumn}`}><span className={styles.previewFieldLabel}>Created By</span><span className={styles.previewFieldValue}>{plan.owner === "CENTER" ? "Center" : plan.ownerCompany}</span></div>
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
                                  </div>
                                  <div className={styles.formActions}>
                                    <button className={styles.dangerButton} disabled={plan.status === "Cancel"} type="button" onClick={() => { void confirm({ message: { th: "ยืนยันที่จะยกเลิกแผนฝึกอบรมประจำปีนี้หรือไม่?", en: "Confirm cancelling this annual training plan?" }, danger: true }).then((ok) => { if (ok) void updateStatus(plan.id, "Cancel"); }); }}>Cancel Plan</button>
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
