"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listCourses } from "../../lib/courses/client";
import {
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  readWorkflowCollection,
  type WorkflowCourse,
  type WorkflowStandard,
} from "../../lib/trainingWorkflow";
import {
  createEnrollment,
  listEnrollments,
  updateEnrollmentStatus,
} from "../../lib/trainingEnrollment/client";
import {
  ACTIVE_ENROLLMENT_STATUSES,
  type EnrollmentRecord,
} from "../../lib/trainingEnrollment/types";
import { useToast } from "../ToastHost";
import { profileValue, useAuthenticatedUser } from "../AuthenticatedUserContext";
import {
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "../center_factory/TrainingPlanManagement/modules/TrainingRolling";
import { useUiLanguage } from "../ThaiUiLocalization";
import type { UserModule } from "./data";
import ModuleHeader from "./ModuleHeader";
import { getLocalDateString } from "../../lib/calendarDate";
import styles from "./RegisterTrainingModule.module.css";

export type AvailableCourseItem = {
  rollingId: string;
  registrationId: string | null;
  id: string;
  title: string;
  category: string;
  courseOwner: "Center" | "Factory";
  ownerCompany: string;
  description: string;
  objective: string;
  learningContent: string;
  methodology: string;
  date: string;
  endDate: string;
  monthKey: string;
  time: string;
  place: string;
  seats: string;
  status: string;
  round: string;
  type: string;
  duration: string;
  trainingStatus: "Not registered" | "Registered";
  trainer: string;
  provider: string;
  targetGroup: string;
  targetGroupDesc: string;
  targetCompanies: string[];
  targetPositions: string[];
  targetLevels: string[];
  preTestText: string;
  postTestText: string;
  evaluationText: string;
  hasPreOrPostTest: boolean;
  hasEvaluation: boolean;
  preTestLink: string;
  postTestLink: string;
  evaluationLink: string;
  approvalFlow: string;
  contact: string;
  remarks: string;
  isEnded: boolean;
  isPending: boolean;
  /** Prerequisite courses this employee has not completed yet. Empty means clear to register. */
  missingPrerequisites: Array<{ courseCode: string; courseName: string }>;
};

export type RegisterTrainingModuleProps = {
  initialCourseCode?: string | null;
  onNavigate?: (moduleName: UserModule | null) => void;
};

const toEnglishText = (value: string): string => {
  if (!value || value === "-") return "-";
  const trimmed = value.trim();

  // If already standard English code or name, keep as-is
  if (
    /^S[1-9]$/i.test(trimmed) ||
    /^M[1-9]$/i.test(trimmed) ||
    /^O[1-9]$/i.test(trimmed) ||
    /^LVL/i.test(trimmed) ||
    /^POS/i.test(trimmed) ||
    trimmed === "All Positions" ||
    trimmed === "All Levels" ||
    trimmed === "All Companies" ||
    trimmed === "All Function" ||
    trimmed === "Officer" ||
    trimmed === "Staff" ||
    trimmed === "Engineer" ||
    trimmed === "Technician" ||
    trimmed === "Section Head" ||
    trimmed === "Manager" ||
    trimmed === "General Manager" ||
    trimmed === "Plant Manager" ||
    trimmed === "President" ||
    trimmed === "Vice President" ||
    trimmed === "Advisor" ||
    trimmed === "Foreman"
  ) {
    return trimmed;
  }

  // Position Mappings (Thai -> English)
  if (trimmed === "เจ้าหน้าที่") return "Officer";
  if (trimmed === "พนักงาน") return "Staff";
  if (trimmed === "วิศวกร") return "Engineer";
  if (trimmed === "ช่างเทคนิค") return "Technician";
  if (trimmed === "หัวหน้างาน" || trimmed === "หัวหน้าแผนก") return "Section Head";
  if (trimmed === "ผู้จัดการ") return "Manager";
  if (trimmed === "ผู้จัดการฝ่าย" || trimmed === "ผู้จัดการทั่วไป") return "General Manager";
  if (trimmed === "ผู้จัดการโรงงาน") return "Plant Manager";
  if (trimmed === "ประธาน") return "President";
  if (trimmed === "รองประธาน") return "Vice President";
  if (trimmed === "ที่ปรึกษา") return "Advisor";
  if (trimmed === "หัวหน้าชุด") return "Foreman";
  if (trimmed === "หัวหน้าชุดอาวุโส") return "Senior Foreman";

  // Level Mappings (Thai -> English / Standard Code)
  if (trimmed === "บังคับบัญชา3" || trimmed === "บังคับบัญชา 3" || trimmed === "บ3" || trimmed === "บ.3") return "S3";
  if (trimmed === "บังคับบัญชา4" || trimmed === "บังคับบัญชา 4" || trimmed === "บ4" || trimmed === "บ.4") return "S4";
  if (trimmed === "บังคับบัญชา2" || trimmed === "บังคับบัญชา 2" || trimmed === "บ2" || trimmed === "บ.2") return "S2";
  if (trimmed === "บังคับบัญชา1" || trimmed === "บังคับบัญชา 1" || trimmed === "บ1" || trimmed === "บ.1") return "S1";
  if (trimmed === "จัดการ1" || trimmed === "จัดการ 1" || trimmed === "จ1" || trimmed === "จ.1") return "M1";
  if (trimmed === "จัดการ2" || trimmed === "จัดการ 2" || trimmed === "จ2" || trimmed === "จ.2") return "M2";
  if (trimmed === "จัดการ3" || trimmed === "จัดการ 3" || trimmed === "จ3" || trimmed === "จ.3") return "M3";
  if (trimmed === "จัดการ4" || trimmed === "จัดการ 4" || trimmed === "จ4" || trimmed === "จ.4") return "M4";
  if (trimmed === "ปฏิบัติการ1" || trimmed === "ปฏิบัติการ 1" || trimmed === "ป1" || trimmed === "ป.1") return "O1";
  if (trimmed === "ปฏิบัติการ2" || trimmed === "ปฏิบัติการ 2" || trimmed === "ป2" || trimmed === "ป.2") return "O2";
  if (trimmed === "ปฏิบัติการ3" || trimmed === "ปฏิบัติการ 3" || trimmed === "ป3" || trimmed === "ป.3") return "O3";
  if (trimmed === "ปฏิบัติการ4" || trimmed === "ปฏิบัติการ 4" || trimmed === "ป4" || trimmed === "ป.4") return "O4";

  return trimmed;
};

const renderFormattedText = (text: string): ReactNode => {
  if (!text || text === "-") return "-";
  const lines = text.split("\n");
  return lines.map((line, idx) => (
    <span key={idx} style={{ display: "block", marginBottom: idx < lines.length - 1 ? "4px" : "0" }}>
      {line}
    </span>
  ));
};

// Robust date check to determine if a course training date has passed
const isCourseEnded = (dateStr: string, endDateStr?: string): boolean => {
  if (!dateStr || dateStr === "-") return false;
  const targetStr = endDateStr || dateStr;

  let dateObj = new Date(targetStr);
  if (isNaN(dateObj.getTime())) {
    const parts = targetStr.split(/[\/\-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        dateObj = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  }

  if (isNaN(dateObj.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateObj.setHours(23, 59, 59, 999);

  return dateObj < today;
};

// Check if a rolling plan is relevant for the employee's company
const isPlanRelevantForEmployeeCompany = (plan: RollingPlan, empCompany: string) => {
  if (!empCompany || empCompany === "-") return true;
  const normEmpComp = empCompany.trim().toUpperCase();

  // 1. Plan belongs directly to employee's company
  const planOwnerComp = (plan.ownerCompany || plan.company || "").trim().toUpperCase();
  if (planOwnerComp === normEmpComp) return true;

  // 2. Plan belongs to Center and targets employee's company or All
  if (plan.owner === "CENTER") {
    const relComps = plan.relatedCompanies || [];
    if (relComps.length === 0) return true; // Unrestricted Center course
    return relComps.some((c) => {
      const normC = c.trim().toUpperCase();
      return normC === "ALL" || normC === "ALL COMPANIES" || normC === normEmpComp;
    });
  }

  // 3. Plan is a Factory plan that lists employee's company in relatedCompanies
  const relComps = plan.relatedCompanies || [];
  return relComps.some((c) => {
    const normC = c.trim().toUpperCase();
    return normC === "ALL" || normC === "ALL COMPANIES" || normC === normEmpComp;
  });
};

export default function RegisterTrainingModule({
  initialCourseCode,
}: RegisterTrainingModuleProps) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);

  const toast = useToast();
  const authenticatedUser = useAuthenticatedUser();
  // Only the company is still read here. Name, code, position and level were carried purely to
  // build the localStorage registration row; the server now takes all of that from the session.
  const employeeCompany = profileValue(authenticatedUser?.companyCode);

  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [apiStandards, setApiStandards] = useState<WorkflowStandard[]>([]);
  // Carries each course's prerequisites list, so the register button can be gated without a
  // separate API call per course.
  const [apiCourses, setApiCourses] = useState<WorkflowCourse[]>([]);
  const [localStandards, setLocalStandards] = useState<WorkflowStandard[]>([]);
  // Registrations live in training_enrollment, not localStorage. Until now this screen wrote only
  // to the browser, so an employee saw their registration stick and HRD never received it.
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedScope, setSelectedScope] = useState<"ALL" | "Center" | "Factory">("ALL");
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>(initialCourseCode || "");
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  // No employee filter is sent: the server scopes an EMPLOYEE caller to themselves. Same call the
  // dashboard and record screens already make.
  const reloadEnrollments = () =>
    listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then((result) => setEnrollments(result.enrollments || []))
      .catch(() => undefined);

  // Load Rolling Plans, Standards, and Registrations dynamically from API & Storage
  useEffect(() => {
    void loadWorkflowRollingPlans().then(setRollingPlans);
    void reloadEnrollments();
    setLocalStandards(readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards));

    // Fetch live API standards and courses (courses carry the prerequisites list)
    void listCourses({ search: null, status: null })
      .then((res) => {
        if (res && res.standards && res.standards.length > 0) {
          setApiStandards(res.standards);
        }
        if (res && res.courses) {
          setApiCourses(res.courses);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const syncData = () => {
      setLocalStandards(readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards));
    };

    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncData);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncData);
  }, []);

  // Merge local & API standards into a flat list, preserving exact courseId and courseCode matches
  const standards = useMemo(() => {
    const combined: WorkflowStandard[] = [...localStandards];
    for (const apiStd of apiStandards) {
      const idx = combined.findIndex(
        (s) =>
          (s.courseCode && apiStd.courseCode && s.courseCode.trim().toLowerCase() === apiStd.courseCode.trim().toLowerCase()) ||
          (s.courseId && apiStd.courseId && String(s.courseId) === String(apiStd.courseId)) ||
          (s.id && apiStd.id && String(s.id) === String(apiStd.id))
      );
      if (idx >= 0) {
        combined[idx] = {
          ...combined[idx],
          ...apiStd,
          positions: (apiStd.positions && apiStd.positions.length > 0) ? apiStd.positions : combined[idx].positions,
          levels: (apiStd.levels && apiStd.levels.length > 0) ? apiStd.levels : combined[idx].levels,
          companies: (apiStd.companies && apiStd.companies.length > 0) ? apiStd.companies : combined[idx].companies,
        };
      } else {
        combined.push(apiStd);
      }
    }
    return combined;
  }, [apiStandards, localStandards]);

  const todayStr = useMemo(() => getLocalDateString(), []);

  // Course codes this employee has a COMPLETED training_result for. "Completed" is the only
  // record this system keeps of a finished course; prerequisites are checked against it.
  const completedCourseCodes = useMemo(
    () =>
      new Set(
        enrollments
          .filter((enrollment) => enrollment.result?.completionStatus === "COMPLETED")
          .map((enrollment) => enrollment.plan.courseCode.trim().toLowerCase()),
      ),
    [enrollments],
  );

  // Compute Available Courses strictly matching TrainingRolling.tsx logic
  const allAvailableCourses: AvailableCourseItem[] = useMemo(
    () =>
      rollingPlans
        .filter(
          (plan) =>
            plan.status === "Planned" &&
            isPlanRelevantForEmployeeCompany(plan, employeeCompany),
        )
        .map((plan) => {
          const courseOwner = plan.owner === "CENTER" ? "Center" : "Factory";
          const ownerCompany = plan.ownerCompany || plan.company || employeeCompany;

          // Flexible matching identical to TrainingRolling.tsx
          const standard = standards.find(
            (s) =>
              (s.courseId && plan.course.id && String(s.courseId).trim() === String(plan.course.id).trim()) ||
              (s.courseCode && plan.course.code && s.courseCode.trim().toLowerCase() === plan.course.code.trim().toLowerCase()) ||
              (s.courseCode && plan.course.id && String(s.courseCode).trim().toLowerCase() === String(plan.course.id).trim().toLowerCase()) ||
              (s.courseId && plan.course.code && String(s.courseId).trim().toLowerCase() === String(plan.course.code).trim().toLowerCase()) ||
              (s.id && plan.course.id && String(s.id).trim() === String(plan.course.id).trim()) ||
              (s.id && plan.course.code && String(s.id).trim().toLowerCase() === String(plan.course.code).trim().toLowerCase()) ||
              (s.courseName && plan.course.name && s.courseName.trim().toLowerCase() === plan.course.name.trim().toLowerCase())
          );

          // Same flexible id/code matching as `standard` above - the rolling plan's course is a
          // separate read, not the same WorkflowCourse object the prerequisites live on.
          const apiCourse = apiCourses.find(
            (c) =>
              (plan.course.id && c.id === plan.course.id) ||
              (c.courseCode && plan.course.code && c.courseCode.trim().toLowerCase() === plan.course.code.trim().toLowerCase()),
          );
          const missingPrerequisites = (apiCourse?.prerequisites ?? []).filter(
            (p) => !completedCourseCodes.has(p.courseCode.trim().toLowerCase()),
          );

          const stdCompanies = standard?.companies;
          const targetCompanies = (stdCompanies && stdCompanies.length > 0)
            ? stdCompanies
            : ((plan.relatedCompanies && plan.relatedCompanies.length > 0)
              ? plan.relatedCompanies
              : (plan.owner === "CENTER" ? ["ATA", "TEP", "ATFB", "NIC", "SATI", "SNF"] : [ownerCompany]));

          const rawPositions = (plan.course as unknown as Record<string, unknown>)?.targetPositions as string[] | undefined;
          const rawLevels = (plan.course as unknown as Record<string, unknown>)?.targetLevels as string[] | undefined;

          // Extract exact positions from matched standard or course master
          const targetPositions = (standard?.positions && standard.positions.length > 0)
            ? standard.positions
            : ((rawPositions && rawPositions.length > 0)
              ? rawPositions
              : [t("ทุกตำแหน่ง", "All Positions")]);

          // Extract exact levels from matched standard or course master
          const targetLevels = (standard?.levels && standard.levels.length > 0)
            ? standard.levels
            : ((rawLevels && rawLevels.length > 0)
              ? rawLevels
              : [t("ทุกระดับ", "All Levels")]);

          const targetGroupDesc = plan.course.targetGroup || t("พนักงานระดับบังคับบัญชาและระดับปฏิบัติการที่เกี่ยวข้อง", "Targeted Employees & Related Groups");

          // The list is already scoped to this employee by the server, so matching on the plan is
          // enough. Rejected and Cancelled do not hold a seat, so those courses are open again.
          const activeReg = enrollments.find(
            (enrollment) =>
              enrollment.planId === plan.rollingId &&
              ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status),
          );

          const isRegistered = !!activeReg;

          const planDate = plan.trainingDate || todayStr;
          const planEndDate = plan.endDate || planDate;
          const isEnded = isCourseEnded(planDate, planEndDate);

          const dateObj = new Date(planDate);
          const monthKey = isNaN(dateObj.getTime())
            ? "2026-04"
            : `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;

          let statusLabel = t("เปิดรับสมัคร", "Open registration");
          if (isEnded) {
            statusLabel = t("เสร็จสิ้นแล้ว", "Finished / Ended");
          } else if (isRegistered) {
            statusLabel = t("ลงทะเบียนแล้ว", "Registered");
          }

          const hasPreTest = Boolean(plan.course.preTest && plan.course.preTest !== "-" && plan.course.preTest !== "ไม่มี");
          const hasPostTest = Boolean(plan.course.postTest && plan.course.postTest !== "-" && plan.course.postTest !== "ไม่มี");
          const hasEval = Boolean(plan.course.evaluation && plan.course.evaluation !== "-" && plan.course.evaluation !== "ไม่มี");

          const hasPreOrPostTest = hasPreTest || hasPostTest;
          const hasEvaluation = hasEval;

          let preTestText = t("ไม่มีแบบทดสอบก่อนเรียน", "No Pre-test");
          if (hasPreTest) {
            preTestText = `${t("ต้องทำแบบทดสอบก่อนเรียน", "Pre-test required")} (${plan.course.preTest})`;
          }

          let postTestText = t("ไม่มีแบบทดสอบหลังเรียน", "No Post-test");
          if (hasPostTest) {
            postTestText = `${t("ต้องทำแบบทดสอบหลังเรียน", "Post-test required")} (${plan.course.postTest})`;
          }

          let evaluationText = t("ไม่มีแบบประเมินผล", "No Evaluation Form");
          if (hasEval) {
            evaluationText = `${t("ต้องทำแบบประเมินผลหลังอบรม", "Evaluation form required")} (${plan.course.evaluation})`;
          }

          return {
            rollingId: plan.rollingId,
            registrationId: activeReg?.id ?? null,
            id: plan.course.code,
            title: plan.course.name,
            category: plan.course.courseGroup,
            courseOwner,
            ownerCompany,
            description: plan.course.objective || "-",
            objective: plan.course.objective || "-",
            learningContent: plan.course.learningContent || "-",
            methodology: plan.course.methodology || "-",
            date: plan.endDate && plan.endDate !== plan.trainingDate ? `${plan.trainingDate} - ${plan.endDate}` : plan.trainingDate,
            endDate: plan.endDate || plan.trainingDate,
            monthKey,
            time: `${plan.startTime} - ${plan.endTime}`,
            place: plan.location || "-",
            seats: `${plan.participants} ${t("ที่นั่ง", "seats")}`,
            status: statusLabel,
            round: plan.batch || "-",
            type: plan.course.courseType || "-",
            duration: `${plan.hours} ${t("ชม.", "hrs")}`,
            trainingStatus: isRegistered ? "Registered" : "Not registered",
            trainer: plan.trainer || "-",
            provider: plan.provider || "-",
            targetGroup: plan.course.targetGroup || t("พนักงานทุกกลุ่ม", "All Employees"),
            targetGroupDesc,
            targetCompanies,
            targetPositions,
            targetLevels,
            preTestText,
            postTestText,
            evaluationText,
            hasPreOrPostTest,
            hasEvaluation,
            preTestLink: plan.course.preTestLink || "",
            postTestLink: plan.course.postTestLink || "",
            evaluationLink: plan.course.evaluationLink || "",
            approvalFlow:
              courseOwner === "Center"
                ? t("พนักงาน > HRD Center", "Employee > HRD Center")
                : t("พนักงาน > Factory HRD", "Employee > Factory HRD"),
            contact:
              courseOwner === "Center"
                ? "HRD Center"
                : `${ownerCompany} HRD`,
            remarks: plan.course.remark || (courseOwner === "Center"
                ? t("หลักสูตรบังคับจากศูนย์กลาง", "Center Mandatory Course")
                : t("จัดโดย HRD โรงงาน", "Managed by Factory HRD")),
            isEnded,
            isPending: false,
            missingPrerequisites,
          };
        }),
    [employeeCompany, isThai, enrollments, rollingPlans, standards, apiCourses, completedCourseCodes, t, todayStr],
  );

  // Filtered courses - strictly hide ended courses unless showCompleted is checked
  const filteredCourses = useMemo(() => {
    return allAvailableCourses.filter((course) => {
      // Hide ended courses by default unless showCompleted is checked
      if (!showCompleted && course.isEnded) {
        return false;
      }
      // Month filter
      if (selectedMonth !== "all" && course.monthKey !== selectedMonth) {
        return false;
      }
      // Scope filter
      if (selectedScope !== "ALL" && course.courseOwner !== selectedScope) {
        return false;
      }
      // Search term
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const matchTitle = course.title.toLowerCase().includes(query);
        const matchCode = course.id.toLowerCase().includes(query);
        const matchCategory = course.category.toLowerCase().includes(query);
        const matchTrainer = course.trainer.toLowerCase().includes(query);
        const matchTargetGroup = course.targetGroup.toLowerCase().includes(query);
        if (!matchTitle && !matchCode && !matchCategory && !matchTrainer && !matchTargetGroup) return false;
      }
      return true;
    });
  }, [allAvailableCourses, showCompleted, selectedMonth, selectedScope, searchTerm]);

  // Month counts - calculated from active courses (or all if showCompleted checked)
  const monthCounts = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    for (const course of allAvailableCourses) {
      if (!showCompleted && course.isEnded) continue;
      map.all = (map.all || 0) + 1;
      map[course.monthKey] = (map[course.monthKey] || 0) + 1;
    }
    return map;
  }, [allAvailableCourses, showCompleted]);

  // Available unique months
  const monthList = useMemo(() => {
    const months = new Set<string>();
    for (const course of allAvailableCourses) {
      if (!showCompleted && course.isEnded) continue;
      months.add(course.monthKey);
    }
    return Array.from(months).sort();
  }, [allAvailableCourses, showCompleted]);

  const scopeCounts = useMemo(() => {
    const active = allAvailableCourses.filter((c) => showCompleted || !c.isEnded);
    return {
      all: active.length,
      center: active.filter((c) => c.courseOwner === "Center").length,
      factory: active.filter((c) => c.courseOwner === "Factory").length,
    };
  }, [allAvailableCourses, showCompleted]);

  const handleRegistration = async (course: AvailableCourseItem) => {
    if (course.isEnded || isSubmitting) return;
    // The button is disabled for this case already; this only guards a stale click. The real gate
    // is the server, which rejects the request regardless of what the client believes.
    if (course.trainingStatus !== "Registered" && course.missingPrerequisites.length > 0) return;

    if (course.trainingStatus === "Registered" && course.registrationId) {
      const confirmed = window.confirm(
        t(
          `คุณต้องการยกเลิกการลงทะเบียนหลักสูตร "${course.title}" ใช่หรือไม่?`,
          `Are you sure you want to cancel registration for "${course.title}"?`,
        ),
      );
      if (!confirmed) return;

      setIsSubmitting(true);
      try {
        await updateEnrollmentStatus(course.registrationId, { action: "cancel" });
        await reloadEnrollments();
        toast.success(t("ยกเลิกการลงทะเบียนแล้ว", "Registration cancelled"));
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("ยกเลิกไม่สำเร็จ", "Could not cancel the registration"),
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const confirmed = window.confirm(
      t(
        `ยืนยันการสมัครอบรมหลักสูตร:\n• ${course.title} (${course.id})\n• วันที่: ${course.date}\n• วิทยากร: ${course.trainer}`,
        `Confirm registration for course:\n• ${course.title} (${course.id})\n• Date: ${course.date}\n• Trainer: ${course.trainer}`,
      ),
    );

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      // The route pins both employee keys to the session for an EMPLOYEE caller, so what is sent
      // here cannot change who is enrolled. employeeId is still required by the validator, and the
      // session does not carry the durable key, hence the placeholder for an account linked only
      // by that key — the server replaces it before the repository ever reads it.
      await createEnrollment({
        planId: course.rollingId,
        employeeId: authenticatedUser?.employeeId ?? "0",
        employeeUserId: null,
        source: "EMPLOYEE",
      });
      await reloadEnrollments();
      toast.success(t("ส่งใบสมัครอบรมแล้ว รอ HRD อนุมัติ", "Registered. Awaiting HRD approval"));
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("สมัครอบรมไม่สำเร็จ", "Could not submit the registration"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatMonthLabel = (mKey: string) => {
    if (mKey === "all") return t("ทุกเดือน (All Months)", "All Months");
    const [yearStr, monthStr] = mKey.split("-");
    const monthIndex = parseInt(monthStr, 10) - 1;
    const date = new Date(parseInt(yearStr, 10), monthIndex, 1);
    if (isThai) {
      const thaiMonthNames = [
        "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
        "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
      ];
      const thaiYear = parseInt(yearStr, 10) + 543;
      return `${thaiMonthNames[monthIndex]} ${thaiYear}`;
    }
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  return (
    <main className={styles.page}>
      <ModuleHeader
        eyebrow={t("การลงทะเบียนอบรมพนักงานประจำเดือน", "Monthly Employee Training Registration")}
        title="Monthly Rolling Registration"
        detail={t(
          "เลือกลงทะเบียนอบรมตามแผนประจำเดือน (Rolling Plan) ที่เปิดรับสมัครสำหรับพนักงานสังกัดบริษัทของคุณ",
          "Register for open monthly training courses planned for your company and role.",
        )}
      />

      {/* Control Panel Card */}
      <section className={styles.controlPanelCard} aria-label="Course Filters & Search">
        {/* Month Navigation Tabs */}
        <div className={styles.monthNav} role="tablist" aria-label="Month Filters">
          <button
            type="button"
            className={`${styles.monthTab} ${selectedMonth === "all" ? styles.activeMonthTab : ""}`}
            onClick={() => setSelectedMonth("all")}
          >
            {t("ทุกเดือน", "All Months")}
            <span className={styles.monthTabCount}>{monthCounts.all || 0}</span>
          </button>
          {monthList.map((mKey) => (
            <button
              key={mKey}
              type="button"
              className={`${styles.monthTab} ${selectedMonth === mKey ? styles.activeMonthTab : ""}`}
              onClick={() => setSelectedMonth(mKey)}
            >
              {formatMonthLabel(mKey)}
              <span className={styles.monthTabCount}>{monthCounts[mKey] || 0}</span>
            </button>
          ))}
        </div>

        {/* Filter Controls Row */}
        <div className={styles.filterRow}>
          <div className={styles.scopePills}>
            <button
              type="button"
              className={`${styles.scopePill} ${selectedScope === "ALL" ? styles.activeScopePill : ""}`}
              onClick={() => setSelectedScope("ALL")}
            >
              🌐 {t("ทั้งหมด", "All Scopes")} ({scopeCounts.all})
            </button>
            <button
              type="button"
              className={`${styles.scopePill} ${selectedScope === "Center" ? styles.activeScopePill : ""}`}
              onClick={() => setSelectedScope("Center")}
            >
              🏛️ {t("ศูนย์กลาง", "Center")} ({scopeCounts.center})
            </button>
            <button
              type="button"
              className={`${styles.scopePill} ${selectedScope === "Factory" ? styles.activeScopePill : ""}`}
              onClick={() => setSelectedScope("Factory")}
            >
              🏭 {t("โรงงาน", "Factory Training")} ({scopeCounts.factory})
            </button>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
              {t("แสดงคอร์สที่จบไปแล้วด้วย", "Show ended courses")}
            </label>
          </div>

          <div className={styles.searchInputWrapper}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t("ค้นหารายชื่อคอร์ส, รหัสวิชา หรือ กลุ่มเป้าหมาย...", "Search course name, code, or target group...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Course Cards Container */}
      <div className={styles.courseList}>
        {filteredCourses.map((course) => {
          const isExpanded = course.rollingId === expandedCourseId;
          const isRegistered = course.trainingStatus === "Registered";
          const isCenter = course.courseOwner === "Center";
          const isEnded = course.isEnded;

          return (
            <article
              className={`${styles.courseCard} ${isCenter ? styles.centerCard : styles.factoryCard} ${isRegistered ? styles.registeredCard : ""} ${isEnded ? styles.endedCard : ""}`}
              key={course.rollingId}
            >
              {/* Card Header Row - Scope, Category, Target Group & Owner Company Badge */}
              <div className={styles.cardHeaderRow}>
                <div className={styles.tagGroup}>
                  <span className={`${styles.scopeBadge} ${isCenter ? styles.centerBadge : styles.factoryBadge}`}>
                    {isCenter ? "🏛️ Center Mandatory" : `🏭 ${course.ownerCompany}`}
                  </span>
                  <span className={styles.categoryPill}>{course.category}</span>
                  <span className={styles.targetGroupBadge}>
                    🏢 {t("บริษัทที่เกี่ยวข้อง", "Target Companies")}: <strong>{course.targetCompanies.join(", ")}</strong>
                  </span>
                  {isEnded ? <span className={styles.categoryPill} style={{ background: "rgba(100,116,139,0.15)", color: "#64748b" }}>🏁 {t("จบการอบรมแล้ว", "Ended")}</span> : null}
                </div>
                <span className={styles.codePill}>{course.id}</span>
              </div>

              {/* Main Body */}
              <div className={styles.cardMainBody}>
                <h3 className={styles.courseTitle} translate="no">{course.title}</h3>
                {course.description ? (
                  <p className={styles.courseObjective}>{course.description}</p>
                ) : null}
              </div>

              {/* Schedule Grid Box */}
              <div className={styles.scheduleGrid}>
                <div className={styles.scheduleItem}>
                  <span className={styles.scheduleLabel}>📅 {t("วันที่อบรม", "Date")}</span>
                  <strong className={styles.scheduleValue}>{course.date}</strong>
                </div>
                <div className={styles.scheduleItem}>
                  <span className={styles.scheduleLabel}>⏰ {t("เวลา / ระยะเวลา", "Time & Duration")}</span>
                  <strong className={styles.scheduleValue}>{course.time} ({course.duration})</strong>
                </div>
                <div className={styles.scheduleItem}>
                  <span className={styles.scheduleLabel}>📍 {t("สถานที่อบรม", "Venue / Place")}</span>
                  <strong className={styles.scheduleValue} title={course.place}>{course.place}</strong>
                </div>
                <div className={styles.scheduleItem}>
                  <span className={styles.scheduleLabel}>👨‍🏫 {t("วิทยากร / ที่นั่ง", "Trainer & Seats")}</span>
                  <strong className={styles.scheduleValue}>{course.trainer} • {course.seats}</strong>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className={styles.cardFooter}>
                <span className={`${styles.statusPill} ${isEnded ? styles.statusEnded : course.isPending ? styles.statusPending : isRegistered ? styles.statusRegistered : styles.statusOpen}`}>
                  {course.status}
                </span>

                <div className={styles.actionButtons}>
                  <button
                    className={styles.detailBtn}
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedCourseId(isExpanded ? null : course.rollingId)}
                  >
                    {isExpanded ? t("ซ่อนรายละเอียด", "Hide detail") : t("รายละเอียดกลุ่มเป้าหมาย", "Target Group Details")}
                  </button>
                  {isEnded ? (
                    <button className={styles.detailBtn} type="button" disabled style={{ opacity: 0.65, cursor: "not-allowed", color: "var(--ui-30-muted)" }}>
                      {isRegistered ? t("เข้าร่วมอบรมแล้ว", "Attended") : t("ผ่านเวลาไปแล้วไม่สามารถลงได้", "Past deadline - Cannot register")}
                    </button>
                  ) : isRegistered ? (
                    <button
                      className={styles.cancelBtn}
                      type="button"
                      onClick={() => void handleRegistration(course)}
                    >
                      {t("ยกเลิกการลงทะเบียน", "Cancel registration")}
                    </button>
                  ) : course.missingPrerequisites.length > 0 ? (
                    <button
                      className={styles.registerBtn}
                      type="button"
                      disabled
                      style={{ opacity: 0.65, cursor: "not-allowed" }}
                      title={t(
                        `ต้องผ่านหลักสูตร ${course.missingPrerequisites.map((p) => p.courseName).join(", ")} ก่อน`,
                        `Requires completing ${course.missingPrerequisites.map((p) => p.courseName).join(", ")} first`,
                      )}
                    >
                      {t("ต้องผ่านหลักสูตรก่อนหน้าก่อน", "Prerequisite not completed")}
                    </button>
                  ) : (
                    <button
                      className={styles.registerBtn}
                      type="button"
                      onClick={() => void handleRegistration(course)}
                    >
                      {t("ลงทะเบียนอบรม", "Register now")}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Detail Drawer with Target Group Breakdown matching Screenshot */}
              {isExpanded ? (
                <div className={styles.detailDrawer}>
                  {/* Screenshot-Matched Target Group Sub-Boxes */}
                  <div className={styles.targetGroupCardSection}>
                    <div className={styles.targetSectionHeader}>
                      🎯 {t("รายละเอียดกลุ่มเป้าหมาย (TARGET GROUP)", "TARGET GROUP DETAILS")}
                    </div>

                    <div className={styles.targetSubBox}>
                      <span className={styles.targetSubLabel}>{t("กลุ่มผู้เข้าอบรม", "Target Audience Description")}</span>
                      <p className={styles.targetSubValue}>{course.targetGroupDesc}</p>
                    </div>

                    <div className={styles.targetSubBox}>
                      <span className={styles.targetSubLabel}>STANDARD COMPANIES</span>
                      <div className={styles.badgePillsRow}>
                        {course.targetCompanies.map((comp) => (
                          <span key={comp} className={styles.targetPill}>{comp}</span>
                        ))}
                      </div>
                    </div>

                    <div className={styles.targetSubBox}>
                      <span className={styles.targetSubLabel}>STANDARD POSITIONS</span>
                      <div className={styles.badgePillsRow}>
                        {course.targetPositions.map((pos) => (
                          <span key={pos} className={styles.targetPill}>{toEnglishText(pos)}</span>
                        ))}
                      </div>
                    </div>

                    <div className={styles.targetSubBox}>
                      <span className={styles.targetSubLabel}>STANDARD LEVELS</span>
                      <div className={styles.badgePillsRow}>
                        {course.targetLevels.map((lvl) => (
                          <span key={lvl} className={styles.targetPill}>{toEnglishText(lvl)}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailGrid}>
                    {/* Section 1: Objective & Learning Content */}
                    <div className={styles.detailSectionCard}>
                      <h4>📖 {t("วัตถุประสงค์ & เนื้อหาการเรียนรู้", "Objective & Learning Content")}</h4>
                      <dl className={styles.detailDl}>
                        <div className={styles.detailItem}>
                          <dt>{t("วัตถุประสงค์ (Objective)", "Objective")}</dt>
                          <dd>{renderFormattedText(course.objective)}</dd>
                        </div>
                        <div className={styles.detailItem}>
                          <dt>{t("เนื้อหาการเรียนรู้ (Learning Content)", "Learning Content")}</dt>
                          <dd>{renderFormattedText(course.learningContent)}</dd>
                        </div>
                        <div className={styles.detailItem}>
                          <dt>{t("รูปแบบการอบรม (Methodology)", "Methodology")}</dt>
                          <dd>{renderFormattedText(course.methodology)}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Section 2: Class & Schedule Detail */}
                    <div className={styles.detailSectionCard}>
                      <h4>🏫 {t("รายละเอียดชั้นเรียน & ผู้จัด", "Class & Trainer Detail")}</h4>
                      <dl className={styles.detailDl}>
                        <div className={styles.detailItem}>
                          <dt>{t("รหัสวิชา / รุ่นการอบรม", "Course Code / Batch")}</dt>
                          <dd>{course.id} ({course.round})</dd>
                        </div>
                        <div className={styles.detailItem}>
                          <dt>{t("ประเภทวิชา (Course Type)", "Course Type")}</dt>
                          <dd>{course.type} / {course.category}</dd>
                        </div>
                        <div className={styles.detailItem}>
                          <dt>{t("วิทยากรผู้สอน (Trainer)", "Trainer")}</dt>
                          <dd>{course.trainer}</dd>
                        </div>
                        <div className={styles.detailItem}>
                          <dt>{t("สถาบัน/ผู้จัดอบรม (Provider)", "Provider")}</dt>
                          <dd>{course.provider}</dd>
                        </div>
                        <div className={styles.detailItem}>
                          <dt>{t("สถานที่อบรม (Venue)", "Location / Venue")}</dt>
                          <dd>{course.place}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Section 3: Requirements & Approval Flow */}
                    <div className={styles.detailSectionCard}>
                      <h4>⚙️ {t("ข้อกำหนด & การอนุมัติ", "Requirements & Approval")}</h4>
                      <dl className={styles.detailDl}>
                        {course.hasPreOrPostTest ? (
                          <div className={styles.detailItem}>
                            <dt>{t("แบบทดสอบก่อน-หลัง (Pre / Post Test)", "Pre / Post Test")}</dt>
                            <dd>{course.preTestText} / {course.postTestText}</dd>
                          </div>
                        ) : null}
                        {course.hasEvaluation ? (
                          <div className={styles.detailItem}>
                            <dt>{t("การประเมินผล (Evaluation Form)", "Evaluation")}</dt>
                            <dd>{course.evaluationText}</dd>
                          </div>
                        ) : null}
                        <div className={styles.detailItem}>
                          <dt>{t("สายการอนุมัติ (Approval Flow)", "Approval Flow")}</dt>
                          <dd>{course.approvalFlow}</dd>
                        </div>
                        <div className={styles.detailItem}>
                          <dt>{t("หน่วยงานรับผิดชอบ / หมายเหตุ", "Owner & Remarks")}</dt>
                          <dd>{course.contact} • {course.remarks}</dd>
                        </div>
                        {course.preTestLink ? (
                          <div className={styles.detailItem}>
                            <dt>{t("ลิงก์แบบทดสอบก่อนอบรม (Pre-Test)", "Pre-Test Link")}</dt>
                            <dd>
                              <a href={course.preTestLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ui-30-primary)", textDecoration: "underline", fontWeight: 800 }}>
                                🔗 {t("เปิดทำแบบทดสอบก่อนอบรม", "Open Pre-Test")}
                              </a>
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

        {filteredCourses.length === 0 ? (
          <div className={styles.emptyStateCard}>
            <div className={styles.emptyIcon}>📂</div>
            <div className={styles.emptyTitle}>
              {t("ไม่พบรายชื่อคอร์สฝึกอบรมที่ตรงตามเงื่อนไข", "No training courses found")}
            </div>
            <div className={styles.emptyDesc}>
              {t(
                "ขณะนี้ไม่มีคอร์สอบรมที่เปิดรับสมัครสำหรับสังกัดบริษัทของคุณในเดือนที่เลือก",
                "There are currently no open training courses available for your company in the selected month.",
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
