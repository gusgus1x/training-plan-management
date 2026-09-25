"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { listCourses } from "../../lib/courses/client";
import {
  getCourseDisplayName,
  getCourseSecondaryName,
  type PlanTargetGroupSnapshot,
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
import { buildRecords, type EmployeeTrainingRecord } from "./RecordModule";
import { profileValue, useAuthenticatedUser } from "../AuthenticatedUserContext";
import {
  loadWorkflowRollingPlans,
  resolveRollingPlanStandard,
  type RollingPlan,
} from "../center_factory/TrainingPlanManagement/modules/TrainingRolling";
import { normalizeEmployeeLevel } from "../../lib/employeeMasterData";
import { useUiLanguage } from "../ThaiUiLocalization";
import ModuleHeader from "./ModuleHeader";
import SearchableApproverSelect from "./SearchableApproverSelect";
import { formatDateDayMonthYear } from "../../lib/calendarDate";
import styles from "./RoadmapModule.module.css";
import {
  User,
  Building2,
  Briefcase,
  Star,
  Globe,
  Landmark,
  Factory,
  Search,
  X,
  Target,
  Lock,
  Laptop,
  GraduationCap,
  Settings,
  Link2,
  CheckCircle2,
  XCircle,
} from "../icons/LucideIcons";

type TargetScopeTab = "ALL" | "CENTER" | "COMPANY";

type RoadmapModuleProps = {
  onRequestRefresher?: (recordId: string) => void;
  onNavigate?: (module: string) => void;
};

// Translate Thai position, level, and function values to English
const toEnglishText = (value: string): string => {
  if (!value || value === "-") return "-";
  const trimmed = value.trim();

  // Position Mappings
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

  // Level Mappings
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

  // Function Mappings
  if (trimmed === "สนง.บริหารกลาง" || trimmed === "บริหารกลาง") return "General Administration Office";
  if (trimmed === "ทรัพยากรบุคคล" || trimmed === "ฝ่ายบุคคล") return "Human Resources";
  if (trimmed === "การเงินและบัญชี" || trimmed === "บัญชี") return "Account and Financial";
  if (trimmed === "ฝ่ายผลิต" || trimmed === "การผลิต") return "Production";
  if (trimmed === "วิศวกรรม" || trimmed === "ฝ่ายวิศวกรรม") return "Engineering and Maintenance";
  if (trimmed === "ประกันคุณภาพ" || trimmed === "ควบคุมคุณภาพ") return "Quality";
  if (trimmed === "ความปลอดภัยและสิ่งแวดล้อม") return "Safety and Environment";
  if (trimmed === "คลังสินค้า") return "Warehouse & Logistics";
  if (trimmed === "จัดซื้อ") return "Purchase";
  if (trimmed === "เทคโนโลยีสารสนเทศ" || trimmed === "ฝ่ายไอที") return "IT Promotion";
  if (trimmed === "การขาย") return "Sales";
  if (trimmed === "วางแผนการขาย") return "Sale Planning";
  if (trimmed === "วางแผนการผลิต") return "Production Planning";

  return trimmed;
};

// Normalize Level codes to standard codes (e.g. S3, S2, S1, S4, M1) for matching
const normalizeLevel = (val: string): string => {
  if (!val) return "";
  const t = val.trim();
  if (/s3|บังคับบัญชา\s*3|บ\.?\s*3|supervisor\s*level\s*3/i.test(t)) return "S3";
  if (/s2|บังคับบัญชา\s*2|บ\.?\s*2|officer\s*level\s*2/i.test(t)) return "S2";
  if (/s1|บังคับบัญชา\s*1|บ\.?\s*1|engineer\s*level\s*1/i.test(t)) return "S1";
  if (/s4|บังคับบัญชา\s*4|บ\.?\s*4|section\s*head\s*level\s*4/i.test(t)) return "S4";
  if (/m1|จัดการ\s*1|จ\.?\s*1/i.test(t)) return "M1";
  if (/m2|จัดการ\s*2|จ\.?\s*2/i.test(t)) return "M2";
  if (/m3|จัดการ\s*3|จ\.?\s*3/i.test(t)) return "M3";
  if (/m4|จัดการ\s*4|จ\.?\s*4/i.test(t)) return "M4";
  if (/o1|ปฏิบัติการ\s*1|ป\.?\s*1/i.test(t)) return "O1";
  if (/o2|ปฏิบัติการ\s*2|ป\.?\s*2/i.test(t)) return "O2";
  if (/o3|ปฏิบัติการ\s*3|ป\.?\s*3/i.test(t)) return "O3";
  if (/o4|ปฏิบัติการ\s*4|ป\.?\s*4/i.test(t)) return "O4";
  return t.toUpperCase();
};

// Normalize Position names for matching
const normalizePosition = (val: string): string => {
  if (!val) return "";
  const t = val.trim().toLowerCase().replace(/[\.\-_]/g, " ").replace(/\s+/g, " ");
  if (/general\s*manager|ผู้จัดการทั่วไป|ผู้จัดการฝ่าย|gm\b/.test(t)) return "general manager";
  if (/assistant\s*manager|asst\s*manager|ผู้ช่วยผู้จัดการ/.test(t)) return "assistant manager";
  if (/plant\s*manager|ผู้จัดการโรงงาน/.test(t)) return "plant manager";
  if (/section\s*head|หัวหน้างาน|หัวหน้าแผนก|ผู้จัดการแผนก|supervisor|sh\b/.test(t)) return "section head";
  if (/senior\s*foreman|หัวหน้าชุดอาวุโส/.test(t)) return "senior foreman";
  if (/foreman|หัวหน้าชุด|force\s*man/.test(t)) return "foreman";
  if (/leader|หัวหน้ากลุ่ม|หัวหน้ากะ/.test(t)) return "leader";
  if (/manager|ผู้จัดการ/.test(t)) return "manager";
  if (/officer|เจ้าหน้าที่|office\b/.test(t)) return "officer";
  if (/engineer|วิศวกร/.test(t)) return "engineer";
  if (/technician|ช่างเทคนิค|ช่าง/.test(t)) return "technician";
  if (/operator|พนักงานปฏิบัติการ|คนงาน/.test(t)) return "operator";
  if (/staff|พนักงาน/.test(t)) return "staff";
  if (/president|ประธาน/.test(t)) return "president";
  if (/vice\s*president|รองประธาน/.test(t)) return "vice president";
  if (/advisor|ที่ปรึกษา/.test(t)) return "advisor";
  return t;
};

// Helper function to check if a value matches target checklist (strictly matching user's position or level)
const isTargetMatch = (
  targets: readonly string[] | undefined,
  userValues: string | string[],
  isLevel = false,
  isPosition = false,
) => {
  const userVals = (Array.isArray(userValues) ? userValues : [userValues])
    .map((v) => (v || "").trim())
    .filter((v) => v && v !== "-");

  if (userVals.length === 0) return false;
  if (!targets || targets.length === 0) return false;

  return targets.some((target) => {
    const t = target.trim().toLowerCase();
    if (!t || t === "-") return false;

    // If target specifies all positions / levels / everyone, it matches all users
    if (
      t === "all" ||
      t === "all function" ||
      t === "all companies" ||
      t === "all positions" ||
      t === "all levels" ||
      t === "ทุกตำแหน่ง" ||
      t === "ทุกระดับ" ||
      t === "ทุกกลุ่ม" ||
      t === "พนักงานทุกกลุ่ม" ||
      t === "พนักงานทุกคน"
    ) {
      return true;
    }

    const targetNorm = isLevel
      ? normalizeEmployeeLevel(target)
      : isPosition
      ? normalizePosition(target)
      : target.trim().toLowerCase();

    return userVals.some((rawUser) => {
      const normalizedUser = isLevel
        ? normalizeEmployeeLevel(rawUser)
        : isPosition
        ? normalizePosition(rawUser)
        : rawUser.trim().toLowerCase();

      return (
        Boolean(targetNorm && normalizedUser && targetNorm === normalizedUser) ||
        Boolean(targetNorm && normalizedUser && (targetNorm.includes(normalizedUser) || normalizedUser.includes(targetNorm))) ||
        target.trim().toLowerCase() === rawUser.trim().toLowerCase() ||
        target.trim().toLowerCase().includes(rawUser.trim().toLowerCase()) ||
        rawUser.trim().toLowerCase().includes(target.trim().toLowerCase())
      );
    });
  });
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

export default function RoadmapModule({ onRequestRefresher, onNavigate }: RoadmapModuleProps = {}) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  /**
   * Shown where HRD has not filled a field in yet. These slots used to carry invented stand-ins -
   * an instructor called "กัส เอฟ", room "212224", and "ทดสอบระบบการทำงานจริง" as the course
   * content - on the screen an employee reads to decide whether to sign up, with nothing marking
   * them as placeholders.
   */
  const notSpecified = t("ยังไม่ระบุ", "Not specified");

  const toast = useToast();
  const authenticatedUser = useAuthenticatedUser();
  // employeeCode is gone: it only ever matched rows in the localStorage registration list. The
  // server identifies the employee from the session now.
  const employeeName = profileValue(authenticatedUser?.username);
  const employeeCompany = profileValue(authenticatedUser?.companyCode);
  const employeeCompanyName = profileValue(authenticatedUser?.companyName);
  const employeeFunction = profileValue(authenticatedUser?.functionName);
  const employeePosition = profileValue(authenticatedUser?.positionName);
  const employeePositionEn = profileValue(authenticatedUser?.positionNameEn);
  const employeePositionCode = profileValue(authenticatedUser?.positionCode);
  const employeeLevel = profileValue(authenticatedUser?.levelName);
  const employeeLevelCode = profileValue(authenticatedUser?.levelCode);
  const employeeLevelEn = profileValue(authenticatedUser?.levelNameEn);
  const employeePl = profileValue(authenticatedUser?.pl);

  const [courses, setCourses] = useState<WorkflowCourse[]>([]);
  const [apiStandards, setApiStandards] = useState<WorkflowStandard[]>([]);
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  // Registrations live in training_enrollment, not localStorage. This screen used to write only to
  // the browser, so a registration made here never reached HRD.
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedRecords, setCompletedRecords] = useState<EmployeeTrainingRecord[]>([]);

  const [selectedTab, setSelectedTab] = useState<TargetScopeTab>("ALL");
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  // Approvals queue for managers / section heads / executives
  const [pendingTeamEnrollments, setPendingTeamEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isDecidingEnrollmentId, setIsDecidingEnrollmentId] = useState<string | null>(null);

  // Client-side mounted flag for React Portal
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Modal state for registration confirmation and approver selection
  const [registeringPlan, setRegisteringPlan] = useState<{
    id: string;
    title: string;
    code: string;
    trainingDate: string;
    trainer: string;
    venue?: string;
  } | null>(null);
  const [approverCandidates, setApproverCandidates] = useState<Array<{
    reviewerUserId: string;
    employeeUserId: string;
    employeeCode: string;
    name: string;
    position: string;
    rank: number;
    rankTitleEn: string;
    rankTitleTh: string;
    company: string;
    department: string;
    section: string;
  }>>([]);
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  const [approverMeta, setApproverMeta] = useState<{
    isPresident: boolean;
    requesterRank: number;
    targetRank: number;
    targetRankInfo: { rank: number; nameTh: string; nameEn: string } | null;
  } | null>(null);
  const [isLoadingApprovers, setIsLoadingApprovers] = useState(false);

  const reloadPendingApprovals = () => {
    fetch("/api/training-plan/enrollments?pendingForApprover=true", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.data?.enrollments) {
          setPendingTeamEnrollments(data.data.enrollments);
        }
      })
      .catch(() => {});
  };

  // One request feeds both the completed history and the "already registered" check, so the
  // registration state can no longer disagree with the record shown beside it.
  const applyEnrollments = (loaded: EnrollmentRecord[]) => {
    setEnrollments(loaded);
    setCompletedRecords(buildRecords(loaded));
  };

  const reloadEnrollments = () =>
    listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then(({ enrollments: loaded }) => applyEnrollments(loaded || []))
      .catch((err) => console.error("Failed to load enrollments in Roadmap", err));

  useEffect(() => {
    let cancelled = false;
    reloadPendingApprovals();
    listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then(({ enrollments: loaded }) => {
        if (!cancelled) applyEnrollments(loaded || []);
      })
      .catch((err) => console.error("Failed to load enrollments in Roadmap", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const completedMap = useMemo(() => {
    const map = new Map<string, EmployeeTrainingRecord>();
    for (const rec of completedRecords) {
      if (rec.courseCode) {
        map.set(rec.courseCode.trim().toLowerCase(), rec);
      }
      if (rec.courseTitle) {
        map.set(rec.courseTitle.trim().toLowerCase(), rec);
      }
    }
    return map;
  }, [completedRecords]);

  useEffect(() => {
    void loadWorkflowRollingPlans().then((plans) => {
      setRollingPlans(plans || []);
    });

    void listCourses({ search: null, status: null })
      .then((res) => {
        if (res) {
          if (res.courses && res.courses.length > 0) setCourses(res.courses);
          if (res.standards && res.standards.length > 0) setApiStandards(res.standards);
        }
      })
      .catch(() => {});
  }, []);

  // A browser-storage copy of courses, standards and OAP plans used to be merged in here. Nothing
  // had written that store for a long time, so it only ever supplied empty arrays - and the sync it
  // ran on mount raced the API fetch above, blanking the course list whenever it landed second.
  const standards = useMemo(() => {
    const combined: WorkflowStandard[] = [];
    for (const apiStd of apiStandards) {
      // Match on the course, never on `id`: that is the course_standard document id, and
      // course_standard is unique per (company, year) - so every course added in the same year
      // shares one. Folding on it collapsed the whole year into a single entry, which dropped the
      // rest of the year's courses out of the roadmap entirely: with no standard to read targets
      // from they fell back to "All Positions", and isTargetMatch deliberately refuses to treat
      // "All" as a match, so isRelevantForRoadmap came out false and the item was filtered away.
      const idx = combined.findIndex(
        (s) =>
          (s.courseCode && apiStd.courseCode && s.courseCode.trim().toLowerCase() === apiStd.courseCode.trim().toLowerCase()) ||
          (s.courseId && apiStd.courseId && String(s.courseId) === String(apiStd.courseId))
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
  }, [apiStandards]);

  // Compute all standard courses combining ALL 4 SOURCES (Rolling, OAP, Standard, Master)
  const allRoadmapItems = useMemo(() => {
    const itemMap = new Map<string, {
      id: string;
      code: string;
      title: string;
      titleEn: string;
      category: string;
      objective: string;
      learningContent: string;
      methodology: string;
      courseType: string;
      ownerCompany: string;
      courseOwner: "CENTER" | "FACTORY";
      targetGroupDesc: string;
      targetCompanies: string[];
      targetFunctions: string[];
      targetPositions: string[];
      targetLevels: string[];
      round: string;
      trainingDate: string;
      trainingStatus: string;
      hours: string;
      budget: string;
      trainer: string;
      provider: string;
      place: string;
      approvalFlow: string;
      contact: string;
      remarks: string;
      isRollingOpen: boolean;
      isEnded: boolean;
      preTestLink?: string;
      postTestLink?: string;
      evaluationLink?: string;
      missingPrerequisites: Array<{ courseCode: string; courseName: string }>;
    }>();

    // Course codes this employee has a COMPLETED training_result for. "Completed" is the only
    // record this system keeps of a finished course; prerequisites are checked against it.
    const completedCourseCodes = new Set(
      enrollments
        .filter((enrollment) => enrollment.result?.completionStatus === "COMPLETED")
        .map((enrollment) => enrollment.plan.courseCode.trim().toLowerCase()),
    );
    const missingPrerequisitesFor = (masterCourse: WorkflowCourse | undefined, ownerComp?: string, isCenterCourse?: boolean) =>
      (masterCourse?.prerequisites ?? [])
        .map((p) => {
          const matchingPlan = rollingPlans.find(
            (rp) =>
              (rp.course.id && p.id && String(rp.course.id) === String(p.id)) ||
              (rp.course.code && p.courseCode && rp.course.code.trim().toLowerCase() === p.courseCode.trim().toLowerCase()) ||
              (ownerComp && rp.course.code && rp.course.code.trim().toLowerCase() === `${ownerComp.toLowerCase()}-${p.courseCode.trim().toLowerCase()}`) ||
              (rp.course.name && p.courseName && rp.course.name.trim().toLowerCase() === p.courseName.trim().toLowerCase()),
          );
          const matchingCourse = courses.find(
            (c) =>
              (ownerComp && c.courseCode && c.courseCode.trim().toLowerCase() === `${ownerComp.toLowerCase()}-${p.courseCode.trim().toLowerCase()}`) ||
              (c.courseNameTh && p.courseName && c.courseNameTh.trim().toLowerCase() === p.courseName.trim().toLowerCase()),
          );

          let displayCode = matchingPlan?.course?.code || matchingCourse?.courseCode || p.courseCode;
          if (!isCenterCourse && ownerComp && ownerComp !== "CENTER" && !displayCode.toLowerCase().startsWith(`${ownerComp.toLowerCase()}-`)) {
            displayCode = `${ownerComp}-${displayCode}`;
          }

          const isCompleted =
            completedCourseCodes.has(p.courseCode.trim().toLowerCase()) ||
            completedCourseCodes.has(displayCode.trim().toLowerCase()) ||
            (matchingPlan?.course?.code && completedCourseCodes.has(matchingPlan.course.code.trim().toLowerCase())) ||
            (matchingCourse?.courseCode && completedCourseCodes.has(matchingCourse.courseCode.trim().toLowerCase()));

          return {
            courseCode: displayCode,
            courseName: p.courseName,
            isCompleted,
          };
        })
        .filter((p) => !p.isCompleted);

    // 1. Load from Rolling Plans (Most active scheduled plans)
    for (const rp of rollingPlans) {
      if (!rp.course || !rp.course.code) continue;
      const code = rp.course.code;

      // If we already have an entry for this course, only replace it if the existing
      // entry has ended (past date) AND this rolling plan has NOT yet ended. This
      // prevents an older OAP batch (already ended) from shadowing a later OAP batch
      // (still upcoming) for the same course code.
      const existingEntry = itemMap.get(code);
      const candidateEnded = isCourseEnded(rp.trainingDate || "", rp.endDate || rp.trainingDate);
      if (existingEntry) {
        // Keep the existing entry unless it's ended and the new candidate is still open
        if (!(existingEntry.isEnded && !candidateEnded)) continue;
      }

      const masterCourse = courses.find(
        (c) => c.id === rp.course.id || c.courseCode === code
      );

      const ownerComp = rp.ownerCompany || rp.company || employeeCompany;

      const isCenter =
        rp.owner === "CENTER" ||
        rp.ownerScope === "CENTER" ||
        (rp.ownerCompany || "").trim().toUpperCase() === "CENTER" ||
        (rp.company || "").trim().toUpperCase() === "ALL COMPANIES" ||
        (rp.course as unknown as Record<string, unknown>)?.owner === "CENTER" ||
        (masterCourse as unknown as Record<string, unknown>)?.owner === "CENTER";

      // Directly resolve exact Rolling Plan Checklist (Snapshot, Course Detail, or Standard)
      const std = resolveRollingPlanStandard(rp, standards);

      const isEnded = candidateEnded;
      const isRollingOpen = !isEnded;
      const trainingStatus = isEnded
        ? t("เสร็จสิ้นการอบรมแล้ว", "Training ended")
        : t("เปิดรับสมัคร", "Open registration");

      const targetPositions = std?.positions && std.positions.length > 0 ? std.positions : [];
      const targetLevels = std?.levels && std.levels.length > 0 ? std.levels : [];
      const targetCompanies = std?.companies && std.companies.length > 0
        ? std.companies
        : (isCenter ? ["All Companies"] : [ownerComp]);
      const targetFunctions = std?.functionName ? [std.functionName] : ["All Function"];

      itemMap.set(code, {
        id: rp.rollingId,
        code,
        title: rp.course.name || (masterCourse ? getCourseDisplayName(masterCourse) : code),
        titleEn: masterCourse ? getCourseSecondaryName(masterCourse) : "",
        category: rp.course.courseGroup || masterCourse?.courseGroup || t("ทั่วไป", "General"),
        objective: rp.course.objective || masterCourse?.objective || t("ไม่มีคำอธิบายเป้าหมาย", "No objective provided"),
        learningContent: rp.course.learningContent || masterCourse?.learningContent || notSpecified,
        methodology: rp.course.methodology || masterCourse?.methodology || notSpecified,
        courseType: rp.course.courseType || masterCourse?.courseType || notSpecified,
        ownerCompany: isCenter ? "CENTER" : ownerComp,
        courseOwner: isCenter ? "CENTER" : "FACTORY",
        targetGroupDesc: std?.targetGroup || rp.course.targetGroup || masterCourse?.targetGroup || "-",
        targetCompanies,
        targetFunctions,
        targetPositions: targetPositions.length > 0 ? targetPositions : ["All Positions"],
        targetLevels: targetLevels.length > 0 ? targetLevels : ["All Levels"],
        round: rp.batch || "-",
        trainingDate: rp.trainingDate || "-",
        trainingStatus,
        hours: rp.hours || notSpecified,
        budget: rp.budget ? `THB ${Number(rp.budget).toLocaleString("en-US")}` : "-",
        trainer: rp.trainer || notSpecified,
        provider: rp.provider || ownerComp,
        place: rp.location || notSpecified,
        approvalFlow: isCenter ? t("พนักงาน > HRD Center", "Employee > HRD Center") : t("พนักงาน > Factory HRD", "Employee > Factory HRD"),
        contact: isCenter ? t("HRD ส่วนกลาง", "HRD Center") : `${ownerComp} HRD`,
        remarks: rp.course.remark || notSpecified,
        isRollingOpen,
        isEnded,
        preTestLink: rp.course.preTestLink || masterCourse?.preTestLink,
        postTestLink: rp.course.postTestLink || masterCourse?.postTestLink,
        evaluationLink: rp.course.evaluationLink || masterCourse?.evaluationLink,
        missingPrerequisites: missingPrerequisitesFor(masterCourse, ownerComp, isCenter),
      });
    }

    // 4. Compute matching & visibility for each item strictly from Rolling checklist position & level
    return Array.from(itemMap.values()).map((item) => {
      const isCenter = item.courseOwner === "CENTER";

      // 1. Company matching
      const isCompanyTargeted = isCenter
        ? (item.targetCompanies.length === 0 || item.targetCompanies.some((c) => {
            const normC = c.trim().toUpperCase();
            return (
              normC === "ALL" ||
              normC === "ALL COMPANIES" ||
              !employeeCompany ||
              employeeCompany === "-" ||
              normC === employeeCompany.toUpperCase() ||
              (employeeCompanyName && normC === employeeCompanyName.toUpperCase()) ||
              normC.includes(employeeCompany.toUpperCase())
            );
          }))
        : (!employeeCompany || employeeCompany === "-" ||
            item.ownerCompany.toUpperCase() === employeeCompany.toUpperCase() ||
            (employeeCompanyName && item.ownerCompany.toUpperCase() === employeeCompanyName.toUpperCase()) ||
            item.targetCompanies.some((c) => {
              const normC = c.trim().toUpperCase();
              return (
                normC === "ALL" ||
                normC === "ALL COMPANIES" ||
                normC === employeeCompany.toUpperCase() ||
                (employeeCompanyName && normC === employeeCompanyName.toUpperCase()) ||
                normC.includes(employeeCompany.toUpperCase())
              );
            }));

      // 2. Function / Department matching
      const isAllFunction =
        item.targetFunctions.length === 0 ||
        item.targetFunctions.some((fn) => {
          const normFn = fn.trim().toLowerCase();
          return normFn === "" || normFn === "all" || normFn.includes("all function") || normFn === "ทุกฝ่ายงาน";
        });

      const matchFunction = isAllFunction || item.targetFunctions.some((targetFn) => {
        const clean = (s: string) => s.toLowerCase().replace(/[\s\.\(\)\-_'"]/g, "");
        const cleanTarget = clean(targetFn);
        const cleanUserFn = clean(employeeFunction || "");
        return Boolean(cleanUserFn && cleanTarget && (cleanUserFn.includes(cleanTarget) || cleanTarget.includes(cleanUserFn)));
      });

      // 3. Position & Level matching directly from Checklist
      const hasPositions = item.targetPositions.length > 0 && !item.targetPositions.every((p) => /^(all|all positions|ทุกตำแหน่ง|-)$/i.test(p.trim()));
      const hasLevels = item.targetLevels.length > 0 && !item.targetLevels.every((l) => /^(all|all levels|ทุกระดับ|-)$/i.test(l.trim()));

      const isPositionMatched = hasPositions && isTargetMatch(
        item.targetPositions,
        [employeePosition, employeePositionEn, employeePositionCode],
        false,
        true,
      );

      const isLevelMatched = hasLevels && isTargetMatch(
        item.targetLevels,
        [employeeLevel, employeeLevelCode, employeeLevelEn, employeePl],
        true,
        false,
      );

      // Match categorization:
      // 1. Level กับ Position ตรงกัน (หรือคอร์สกำหนดแค่อย่างใดอย่างหนึ่งแล้วตรง) -> ตรงกลุ่มเป้าหมาย (isExactTargetMatch)
      // 2. ตรงกับ Level แต่ไม่ตรง Position -> ตรงกับ Level (isLevelOnlyMatch)
      // 3. ตรงกับ Position แต่ไม่ตรง Level -> ตรงกับ Position (isPositionOnlyMatch)
      // 4. ไม่ได้จำกัด Position และ Level -> หลักสูตรทั่วไป (isGeneralCourse)
      let isExactTargetMatch = false;
      let isLevelOnlyMatch = false;
      let isPositionOnlyMatch = false;
      let isGeneralCourse = false;

      if (hasPositions && hasLevels) {
        if (isPositionMatched && isLevelMatched) {
          isExactTargetMatch = true;
        } else if (isLevelMatched && !isPositionMatched) {
          isLevelOnlyMatch = true;
        } else if (isPositionMatched && !isLevelMatched) {
          isPositionOnlyMatch = true;
        }
      } else if (hasPositions) {
        if (isPositionMatched) {
          isExactTargetMatch = true;
        }
      } else if (hasLevels) {
        if (isLevelMatched) {
          isExactTargetMatch = true;
        }
      } else {
        isGeneralCourse = true;
      }

      // Course is relevant if Company and Function match, AND either exact, level-only, position-only, or general course
      const isRelevantForRoadmap = isCompanyTargeted && matchFunction && (
        isExactTargetMatch || isLevelOnlyMatch || isPositionOnlyMatch || isGeneralCourse
      );

      return {
        ...item,
        isCompanyTargeted,
        matchPosition: isPositionMatched,
        matchLevel: isLevelMatched,
        matchFunction,
        isExactTargetMatch,
        isLevelOnlyMatch,
        isPositionOnlyMatch,
        isGeneralCourse,
        isRelevantForRoadmap,
      };
    });
  }, [courses, employeeCompany, employeeCompanyName, employeeFunction, employeeLevel, employeeLevelCode, employeeLevelEn, employeePl, employeePosition, employeePositionCode, employeePositionEn, enrollments, rollingPlans, standards, t]);

  // Filter items based on selected scope tab, category group, search query, and availability
  const filteredRoadmapItems = useMemo(() => {
    return allRoadmapItems.filter((item) => {
      // 1. Must be targeted for this employee (Company + Position / Level / Function match)
      if (!item.isRelevantForRoadmap) return false;

      // 2. If showCompleted is false:
      // - Exclude ended/past date courses
      // - Exclude courses already completed/passed by employee
      if (!showCompleted) {
        if (item.isEnded) return false;
        const isCompleted =
          completedMap.has(item.code.trim().toLowerCase()) ||
          completedMap.has(item.title.trim().toLowerCase());
        if (isCompleted) return false;
      }

      // 3. Filter by Scope Tab (Center / Company / All)
      if (selectedTab === "CENTER" && item.courseOwner !== "CENTER") return false;
      if (selectedTab === "COMPANY" && item.courseOwner !== "FACTORY") return false;

      // 4. Filter by Category Group
      if (selectedGroup !== "ALL" && item.category !== selectedGroup) return false;

      // 5. Filter by Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchCode = item.code.toLowerCase().includes(query);
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchCategory = item.category.toLowerCase().includes(query);
        const matchObjective = item.objective.toLowerCase().includes(query);
        if (!matchCode && !matchTitle && !matchCategory && !matchObjective) return false;
      }

      return true;
    });
  }, [allRoadmapItems, showCompleted, completedMap, selectedTab, selectedGroup, searchQuery]);

  // Unique course category groups for filter dropdown from relevant target items
  const categoryGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const item of allRoadmapItems) {
      if (!item.isRelevantForRoadmap) continue;
      if (!showCompleted) {
        if (item.isEnded) continue;
        const isCompleted =
          completedMap.has(item.code.trim().toLowerCase()) ||
          completedMap.has(item.title.trim().toLowerCase());
        if (isCompleted) continue;
      }
      if (item.category) {
        groups.add(item.category);
      }
    }
    return Array.from(groups).sort();
  }, [allRoadmapItems, showCompleted, completedMap]);

  // Counter metrics for target courses
  const totalCount = useMemo(() => {
    return allRoadmapItems.filter((item) => {
      if (!item.isRelevantForRoadmap) return false;
      if (!showCompleted) {
        if (item.isEnded) return false;
        const isCompleted =
          completedMap.has(item.code.trim().toLowerCase()) ||
          completedMap.has(item.title.trim().toLowerCase());
        if (isCompleted) return false;
      }
      return true;
    }).length;
  }, [allRoadmapItems, showCompleted, completedMap]);

  const centerCount = useMemo(() => {
    return allRoadmapItems.filter((item) => {
      if (!item.isRelevantForRoadmap) return false;
      if (!showCompleted) {
        if (item.isEnded) return false;
        const isCompleted =
          completedMap.has(item.code.trim().toLowerCase()) ||
          completedMap.has(item.title.trim().toLowerCase());
        if (isCompleted) return false;
      }
      return item.courseOwner === "CENTER";
    }).length;
  }, [allRoadmapItems, showCompleted, completedMap]);

  const companyCount = useMemo(() => {
    return allRoadmapItems.filter((item) => {
      if (!item.isRelevantForRoadmap) return false;
      if (!showCompleted) {
        if (item.isEnded) return false;
        const isCompleted =
          completedMap.has(item.code.trim().toLowerCase()) ||
          completedMap.has(item.title.trim().toLowerCase());
        if (isCompleted) return false;
      }
      return item.courseOwner === "FACTORY";
    }).length;
  }, [allRoadmapItems, showCompleted, completedMap]);

  // Registration handler for direct enrollment from Roadmap
  const handleRegisterCourse = async (item: (typeof filteredRoadmapItems)[number]) => {
    const completedRecord =
      completedMap.get(item.code.trim().toLowerCase()) ??
      completedMap.get(item.title.trim().toLowerCase()) ??
      null;

    if (completedRecord) {
      window.alert(
        t(
          `คุณได้ผ่านการอบรมหลักสูตร "${item.title}" เรียบร้อยแล้ว (เมื่อวันที่ ${completedRecord.completedDate})\nหากต้องการเข้าอบรมซ้ำ กรุณาใช้เมนู "ขอจัดอบรมทบทวน (Request Training Need)"`,
          `You have already completed "${item.title}" on ${completedRecord.completedDate}.\nIf you want to retake it, please use "Request Training Need" to request a refresher.`,
        ),
      );
      return;
    }

    if (item.isEnded) {
      window.alert(
        t(
          `หลักสูตร "${item.title}" ได้สิ้นสุดกำหนดการอบรมไปแล้ว (เมื่อวันที่ ${item.trainingDate})\nคุณสามารถใช้เมนู "ขอเปิดหลักสูตรฝึกอบรม (Request Training Need)" เพื่อขอให้ HRD เปิดรุ่นใหม่ได้ครับ`,
          `Training for "${item.title}" ended on ${item.trainingDate}.\nPlease use "Request Training Need" to ask HRD for a new session.`,
        ),
      );
      return;
    }

    if (isSubmitting) return;

    const activeReg = enrollments.find(
      (enrollment) =>
        enrollment.planId === item.id &&
        ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status)
    );

    if (activeReg) {
      const confirmed = window.confirm(
        t(
          `คุณต้องการยกเลิกการลงทะเบียนหลักสูตร "${item.title}" ใช่หรือไม่?`,
          `Are you sure you want to cancel registration for "${item.title}"?`
        )
      );
      if (!confirmed) return;

      setIsSubmitting(true);
      try {
        await updateEnrollmentStatus(activeReg.id, { action: "cancel" });
        await reloadEnrollments();
        toast.success(t("ยกเลิกการลงทะเบียนแล้ว", "Registration cancelled"));
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("ยกเลิกไม่สำเร็จ", "Could not cancel the registration")
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Open Modal and fetch approver candidates based on 19-rank hierarchy
    setRegisteringPlan({
      id: item.id,
      title: item.title,
      code: item.code,
      trainingDate: item.trainingDate,
      trainer: item.trainer,
      venue: item.place,
    });
    setIsLoadingApprovers(true);
    setSelectedApproverId("");
    try {
      const res = await fetch("/api/training-plan/enrollments/approvers", { credentials: "include" });
      const json = await res.json();
      if (json.ok && json.data) {
        const cands = json.data.candidates || [];
        setApproverCandidates(cands);
        setApproverMeta({
          isPresident: json.data.isPresident,
          requesterRank: json.data.requesterRank,
          targetRank: json.data.targetRank,
          targetRankInfo: json.data.targetRankInfo,
        });
        if (cands.length > 0) {
          setSelectedApproverId(cands[0].reviewerUserId);
        }
      }
    } catch {
      setApproverCandidates([]);
    } finally {
      setIsLoadingApprovers(false);
    }
  };

  const confirmRegistration = async () => {
    if (!registeringPlan) return;
    if (!approverMeta?.isPresident && approverCandidates.length > 0 && !selectedApproverId) {
      toast.error(t("กรุณาเลือกผู้อนุมัติ", "Please select an approver"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createEnrollment({
        planId: registeringPlan.id,
        employeeId: authenticatedUser?.employeeId ?? "0",
        employeeUserId: null,
        source: "EMPLOYEE",
        approverUserId: approverMeta?.isPresident ? null : selectedApproverId || null,
      });
      const chosenApprover = approverCandidates.find((c) => c.reviewerUserId === selectedApproverId);
      await reloadEnrollments();
      toast.success(
        approverMeta?.isPresident
          ? t("ลงทะเบียนสำเร็จและได้รับการอนุมัติเรียบร้อย", "Registered and auto-approved")
          : t(
              `ส่งใบสมัครอบรมและส่งการแจ้งเตือนไปยังคุณ ${chosenApprover?.name || "ผู้อนุมัติ"} เรียบร้อยแล้ว`,
              `Registration submitted and notification sent to ${chosenApprover?.name || "approver"}`,
            ),
      );
      setRegisteringPlan(null);
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

  return (
    <main className={styles.page}>
      <ModuleHeader
        eyebrow="Employee Target Training Roadmap"
        title="Training Roadmap"
        detail={t(
          "แสดงรายการหลักสูตรอบรมเป้าหมาย (Course Standard & Target Group) ที่ออกแบบสำหรับสังกัดบริษัท ตำแหน่ง และระดับงานของคุณ พร้อมระบบสมัครเข้าอบรมโดยตรง",
          "Targeted training courses designed specifically for your company, position, and job level with direct enrollment.",
        )}
      />

      {/* Pending Approvals Queue for Section Heads & Executives */}
      {pendingTeamEnrollments.length > 0 ? (
        <section className={styles.pendingApprovalsQueueCard} aria-label="Pending Team Approvals">
          <div className={styles.pendingQueueHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={20} style={{ color: "var(--ui-30-primary)" }} />
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--ui-30-primary)" }}>
                {t("คำขอลงทะเบียนฝึกอบรมที่รอการอนุมัติของคุณ", "Course Registrations Awaiting Your Approval")}
              </h3>
            </div>
            <span className={styles.approvalCountBadge}>
              {pendingTeamEnrollments.length} {t("รายการรอพิจารณา", "pending")}
            </span>
          </div>
          <div className={styles.pendingGrid}>
            {pendingTeamEnrollments.map((item) => (
              <div key={item.id} className={styles.pendingItemCard}>
                <div className={styles.pendingItemInfo}>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--ui-30-ink)" }}>
                    {item.employeeName} {item.employeeCode ? `(${item.employeeCode})` : ""}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--ui-30-muted)", marginTop: 2 }}>
                    {[item.position, item.department, item.company].filter(Boolean).join(" • ")}
                  </div>
                  <div style={{ marginTop: 8, fontSize: "0.88rem", fontWeight: 700, color: "var(--ui-30-ink)" }}>
                    📚 {item.plan.courseName} ({item.plan.courseCode})
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--ui-30-muted)", marginTop: 2 }}>
                    📅 {item.plan.startAt ? formatDateDayMonthYear(item.plan.startAt, isThai) : "-"}
                  </div>
                </div>
                <div className={styles.pendingItemActions}>
                  <button
                    type="button"
                    className={styles.approveBtn}
                    disabled={isDecidingEnrollmentId === item.id}
                    onClick={async () => {
                      setIsDecidingEnrollmentId(item.id);
                      try {
                        await updateEnrollmentStatus(item.id, { action: "approve" });
                        setPendingTeamEnrollments((prev) => prev.filter((p) => p.id !== item.id));
                        toast.success(t("อนุมัติการลงทะเบียนเรียบร้อยแล้ว", "Registration approved successfully"));
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : t("อนุมัติไม่สำเร็จ", "Could not approve"));
                      } finally {
                        setIsDecidingEnrollmentId(null);
                      }
                    }}
                  >
                    {isDecidingEnrollmentId === item.id ? "..." : t("อนุมัติ", "Approve")}
                  </button>
                  <button
                    type="button"
                    className={styles.rejectBtn}
                    disabled={isDecidingEnrollmentId === item.id}
                    onClick={async () => {
                      const reason = window.prompt(t("กรุณาระบุเหตุผลที่ไม่อนุมัติ (ถ้ามี):", "Please provide a rejection reason:"));
                      if (reason === null) return;
                      setIsDecidingEnrollmentId(item.id);
                      try {
                        await updateEnrollmentStatus(item.id, { action: "reject", reason });
                        setPendingTeamEnrollments((prev) => prev.filter((p) => p.id !== item.id));
                        toast.success(t("ปฏิเสธคำขอลงทะเบียนแล้ว", "Registration rejected"));
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : t("ปฏิเสธไม่สำเร็จ", "Could not reject"));
                      } finally {
                        setIsDecidingEnrollmentId(null);
                      }
                    }}
                  >
                    {t("ไม่อนุมัติ", "Reject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Control Panel Card Inspired by RegisterTrainingModule */}
      <section className={styles.controlPanelCard} aria-label="Roadmap Filters & Search">
        {/* User Profile Bar */}
        <div className={styles.profileRow}>
          <div className={styles.profileMeta}>
            <div className={styles.avatarBadge}>
              <User size={24} />
            </div>
            <div className={styles.profileText}>
              <h2>{employeeName}</h2>
              <p>Your Target Group Profile</p>
            </div>
          </div>
          <div className={styles.profileBadges}>
            <span className={styles.profileBadgeItem}>
              <Building2 size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> Company: <strong>{employeeCompany}</strong>
            </span>
            <span className={styles.profileBadgeItem}>
              <Briefcase size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> Position: <strong>{toEnglishText(employeePosition)}</strong>
            </span>
            <span className={styles.profileBadgeItem}>
              <Star size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} /> Level: <strong>{normalizeEmployeeLevel(employeeLevelCode || employeeLevel) || toEnglishText(employeeLevel)}</strong>
            </span>
          </div>
        </div>

        {/* Tab Scope Navigation */}
        <div className={styles.tabNavRow}>
          <div className={styles.scopeTabs} role="tablist">
            <button
              type="button"
              className={`${styles.scopeTab} ${selectedTab === "ALL" ? styles.activeScopeTab : ""}`}
              onClick={() => setSelectedTab("ALL")}
            >
              <Globe size={15} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
              {showCompleted ? t("คอร์สเป้าหมายทั้งหมด", "All Target Courses") : t("คอร์สเป้าหมายที่สมัครได้", "Available Target Courses")}
              <span className={styles.tabBadge}>{totalCount}</span>
            </button>
            <button
              type="button"
              className={`${styles.scopeTab} ${selectedTab === "CENTER" ? styles.activeScopeTab : ""}`}
              onClick={() => setSelectedTab("CENTER")}
            >
              <Landmark size={15} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
              {t("ส่วนกลาง (Center)", "Center Mandatory")}
              <span className={styles.tabBadge}>{centerCount}</span>
            </button>
            <button
              type="button"
              className={`${styles.scopeTab} ${selectedTab === "COMPANY" ? styles.activeScopeTab : ""}`}
              onClick={() => setSelectedTab("COMPANY")}
            >
              <Factory size={15} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
              {employeeCompany || t("โรงงาน (Factory)", "Factory")}
              <span className={styles.tabBadge}>{companyCount}</span>
            </button>
          </div>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            {t("แสดงคอร์สที่จบไปแล้วด้วย", "Show ended courses")}
          </label>
        </div>

        {/* Search & Category Filter Row */}
        <div className={styles.filterControlsRow}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder={t("ค้นหารหัส, ชื่อหลักสูตร, วิทยากร, เนื้อหา...", "Search code, title, instructor, content...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery ? (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className={styles.categorySelectWrap}>
            <select
              className={styles.categorySelect}
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="ALL">{t("ทุกหมวดหมู่หลักสูตร", "All Categories")}</option>
              {categoryGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Grid of Roadmap Course Cards */}
      <div className={styles.roadmapGrid}>
        {filteredRoadmapItems.map((item) => {
          const isCenter = item.courseOwner === "CENTER";
          const isExpanded = expandedCode === item.code;

          // Server-scoped to this employee already, so matching the plan is enough.
          const activeReg = enrollments.find(
            (enrollment) =>
              enrollment.planId === item.id &&
              ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status)
          );
          const isRegistered = Boolean(activeReg);
          const completedRecord =
            completedMap.get(item.code.trim().toLowerCase()) ??
            completedMap.get(item.title.trim().toLowerCase()) ??
            null;
          const isCompleted = Boolean(completedRecord);

          return (
            <article
              className={`${styles.courseCard} ${isCenter ? styles.centerCard : styles.factoryCard} ${isRegistered ? styles.registeredCard : ""}`}
              key={item.code}
            >
              {/* Header Row */}
              <div className={styles.cardHeaderRow}>
                <div className={styles.tagGroup}>
                  <span className={`${styles.scopeBadge} ${isCenter ? styles.centerBadge : styles.factoryBadge}`}>
                    {isCenter ? (
                      <>
                        <Landmark size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        Center Mandatory
                      </>
                    ) : (
                      <>
                        <Factory size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        {item.ownerCompany}
                      </>
                    )}
                  </span>
                  <span className={styles.categoryPill}>{item.category}</span>

                  {/* Target Match Badge according to user rules */}
                  {item.isExactTargetMatch ? (
                    <span className={`${styles.targetMatchPill} ${styles.exactTargetPill}`}>
                      <Target size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                      {t("ตรงกลุ่มเป้าหมาย", "Direct Target Match")}
                    </span>
                  ) : item.isLevelOnlyMatch ? (
                    <span className={`${styles.targetMatchPill} ${styles.levelMatchPill}`}>
                      <Star size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                      {t("ตรงกับ Level", `Level Match: ${normalizeEmployeeLevel(employeeLevelCode || employeeLevel) || toEnglishText(employeeLevel)}`)}
                    </span>
                  ) : item.isPositionOnlyMatch ? (
                    <span className={`${styles.targetMatchPill} ${styles.positionMatchPill}`}>
                      <Briefcase size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                      {t("ตรงกับ Position", `Position Match: ${toEnglishText(employeePosition)}`)}
                    </span>
                  ) : (
                    <span className={`${styles.targetMatchPill} ${styles.generalMatchPill}`}>
                      <Building2 size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                      {t("หลักสูตรทั่วไป", "General Course")}
                    </span>
                  )}
                </div>
                <span className={styles.codePill}>{item.code}</span>
              </div>

              {/* Card Body */}
              <div>
                <h3 className={styles.courseTitle} translate="no">{item.title}</h3>
                {item.titleEn ? <p className={styles.courseSubtitle}>{item.titleEn}</p> : null}
                <p className={styles.courseObjective}>{item.objective}</p>
              </div>

              {/* Info Grid (Schedule, Duration, Trainer) */}
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>{t("กำหนดการอบรม", "Schedule")}</span>
                  <span className={styles.infoValue}>{item.trainingDate} ({item.round})</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>{t("ระยะเวลา & งบประมาณ", "Duration & Budget")}</span>
                  <span className={styles.infoValue}>{item.hours} hrs • {item.budget}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>{t("วิทยากรผู้สอน", "Instructor")}</span>
                  <span className={styles.infoValue}>{item.trainer}</span>
                </div>
              </div>

              {/* Card Footer with Direct Registration Action */}
              <div className={styles.cardFooter}>
                <div className={styles.statusGroup}>
                  <span className={`${styles.statusPill} ${isCompleted || item.isEnded ? styles.statusEnded : isRegistered ? styles.statusOpen : item.isRollingOpen ? styles.statusOpen : styles.statusPlanned}`}>
                    {isCompleted ? t("เสร็จสิ้นการอบรมแล้ว", "Training ended") : item.trainingStatus}
                  </span>
                </div>

                <div className={styles.actionGroup}>
                  <button
                    className={styles.detailBtn}
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedCode(isExpanded ? null : item.code)}
                  >
                    {isExpanded ? t("ซ่อนรายละเอียด", "Hide detail") : t("รายละเอียดกลุ่มเป้าหมาย", "Target Group Details")}
                  </button>

                  {/* Course Status / Registration Action */}
                  {isCompleted ? (
                    <button
                      className={styles.detailBtn}
                      type="button"
                      disabled
                      style={{ opacity: 0.65, cursor: "not-allowed", color: "var(--ui-30-muted)" }}
                    >
                      {t("ผ่านการอบรมแล้ว", "Completed")}
                    </button>
                  ) : item.isEnded ? (
                    <button
                      className={styles.endedBtn}
                      type="button"
                      disabled
                    >
                      {isRegistered
                        ? t("เข้าร่วมอบรมแล้ว", "Attended")
                        : t("ผ่านเวลาไปแล้วไม่สามารถลงได้", "Past deadline - Cannot register")}
                    </button>
                  ) : isRegistered ? (
                    <button
                      className={styles.cancelBtn}
                      type="button"
                      onClick={() => void handleRegisterCourse(item)}
                      title={t("คลิกเพื่อยกเลิกการสมัคร", "Click to cancel registration")}
                    >
                      {t("ยกเลิกการลงทะเบียน", "Cancel registration")}
                    </button>
                  ) : item.missingPrerequisites.length > 0 ? (
                    <button
                      className={styles.lockedPrereqBtn}
                      type="button"
                      disabled
                      title={t(
                        `ต้องผ่านหลักสูตร ${item.missingPrerequisites.map((p) => `${p.courseCode} (${p.courseName})`).join(", ")} ก่อน`,
                        `Requires completing ${item.missingPrerequisites.map((p) => `${p.courseCode} (${p.courseName})`).join(", ")} first`,
                      )}
                    >
                      <Lock size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                      {t(
                        `ต้องผ่านหลักสูตร ${item.missingPrerequisites.map((p) => p.courseCode).join(", ")} ก่อน`,
                        `Must complete ${item.missingPrerequisites.map((p) => p.courseCode).join(", ")} first`,
                      )}
                    </button>
                  ) : (
                    <button
                      className={styles.registerBtn}
                      type="button"
                      onClick={() => void handleRegisterCourse(item)}
                    >
                      {t("ลงทะเบียนอบรม", "Register now")}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Details Drawer (5 Structured Sub-Boxes + 3-Column Grid Matching Screenshot Verbatim) */}
              {isExpanded ? (
                <div className={styles.detailDrawer}>
                  {/* Section 1: 5 Target Group Sub-Boxes */}
                  <div className={styles.targetGroupCardSection}>
                    <div className={styles.targetSectionHeader}>
                      <Target size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                      {t("รายละเอียดกลุ่มเป้าหมาย (TARGET GROUP DETAILS)", "TARGET GROUP DETAILS")}
                    </div>

                    <div className={styles.targetSubBox}>
                      <span className={styles.targetSubLabel}>{t("กลุ่มผู้เข้าอบรม", "Target Audience Description")}</span>
                      <p className={styles.targetSubValue}>{item.targetGroupDesc}</p>
                    </div>

                    <div className={styles.targetSubBox}>
                      <span className={styles.targetSubLabel}>STANDARD COMPANIES</span>
                      <div className={styles.badgePillsRow}>
                        {item.targetCompanies.map((comp) => (
                          <span key={comp} className={styles.targetPill}>{comp}</span>
                        ))}
                      </div>
                    </div>

                    <div className={styles.targetSubBox}>
                      <span className={styles.targetSubLabel}>ORG SCOPE</span>
                      <div className={styles.badgePillsRow}>
                        {item.targetFunctions.map((fn) => (
                          <span key={fn} className={styles.targetPill}>{toEnglishText(fn)}</span>
                        ))}
                      </div>
                    </div>

                    <div className={styles.targetSubBox}>
                      <span className={styles.targetSubLabel}>STANDARD POSITIONS</span>
                      <div className={styles.badgePillsRow}>
                        {item.targetPositions.map((pos) => (
                          <span key={pos} className={styles.targetPill}>{toEnglishText(pos)}</span>
                        ))}
                      </div>
                    </div>

                    <div className={styles.targetSubBox}>
                      <span className={styles.targetSubLabel}>STANDARD LEVELS</span>
                      <div className={styles.badgePillsRow}>
                        {item.targetLevels.map((lvl) => (
                          <span key={lvl} className={styles.targetPill}>{toEnglishText(lvl)}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: 3-Column Detail Cards Grid Matching User Screenshot Verbatim */}
                  <div className={styles.detailThreeGrid}>
                    {/* Column 1: วัตถุประสงค์ & เนื้อหาการเรียนรู้ */}
                    <div className={styles.detailColCard}>
                      <div className={styles.detailColHeader}>
                        <Laptop size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        {t("วัตถุประสงค์ & เนื้อหาการเรียนรู้", "Objective & Learning Content")}
                      </div>
                      <div className={styles.detailColField}>
                        <span className={styles.fieldLabel}>{t("วัตถุประสงค์ (OBJECTIVE)", "OBJECTIVE")}</span>
                        <span className={styles.fieldValue}>{item.objective}</span>
                      </div>
                      <div className={styles.detailColField}>
                        <span className={styles.fieldLabel}>{t("เนื้อหาการเรียนรู้ (LEARNING CONTENT)", "LEARNING CONTENT")}</span>
                        <span className={styles.fieldValue}>{item.learningContent}</span>
                      </div>
                      <div className={styles.detailColField}>
                        <span className={styles.fieldLabel}>{t("รูปแบบการอบรม (METHODOLOGY)", "METHODOLOGY")}</span>
                        <span className={styles.fieldValue}>{item.methodology}</span>
                      </div>
                    </div>

                    {/* Column 2: รายละเอียดชั้นเรียน & ผู้จัด */}
                    <div className={styles.detailColCard}>
                      <div className={styles.detailColHeader}>
                        <GraduationCap size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        {t("รายละเอียดชั้นเรียน & ผู้จัด", "Class Details & Provider")}
                      </div>
                      <div className={styles.detailColField}>
                        <span className={styles.fieldLabel}>{t("รหัสวิชา / รุ่นการอบรม", "Course Code / Batch")}</span>
                        <span className={styles.fieldValue}>{item.code} ({item.round})</span>
                      </div>
                      <div className={styles.detailColField}>
                        <span className={styles.fieldLabel}>{t("ประเภทวิชา (COURSE TYPE)", "COURSE TYPE")}</span>
                        <span className={styles.fieldValue}>{item.courseType} / {item.category}</span>
                      </div>
                      <div className={styles.detailColField}>
                        <span className={styles.fieldLabel}>{t("วิทยากรผู้สอน (TRAINER)", "TRAINER")}</span>
                        <span className={styles.fieldValue}>{item.trainer}</span>
                      </div>
                      <div className={styles.detailColField}>
                        <span className={styles.fieldLabel}>{t("สถาบัน/ผู้จัดอบรม (PROVIDER)", "PROVIDER")}</span>
                        <span className={styles.fieldValue}>{item.provider}</span>
                      </div>
                      <div className={styles.detailColField}>
                        <span className={styles.fieldLabel}>{t("สถานที่อบรม (VENUE)", "VENUE")}</span>
                        <span className={styles.fieldValue}>{item.place}</span>
                      </div>
                    </div>

                    {/* Column 3: ข้อกำหนด & การอนุมัติ */}
                    <div className={styles.detailColCard}>
                      <div className={styles.detailColHeader}>
                        <Settings size={16} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                        {t("ข้อกำหนด & การอนุมัติ", "Requirements & Approval")}
                      </div>
                      <div className={styles.detailColField}>
                        <span className={styles.fieldLabel}>{t("สายการอนุมัติ (APPROVAL FLOW)", "APPROVAL FLOW")}</span>
                        <span className={styles.fieldValue}>{item.approvalFlow}</span>
                      </div>
                      <div className={styles.detailColField}>
                        <span className={styles.fieldLabel}>{t("หน่วยงานรับผิดชอบ / หมายเหตุ", "Responsible Unit / Remarks")}</span>
                        <span className={styles.fieldValue}>{item.contact} • {item.remarks}</span>
                      </div>

                      {item.preTestLink ? (
                        <div className={styles.detailColField}>
                          <span className={styles.fieldLabel}>{t("ลิงก์แบบทดสอบก่อนอบรม (PRE-TEST)", "PRE-TEST LINK")}</span>
                          <a className={styles.testLink} href={item.preTestLink} target="_blank" rel="noopener noreferrer">
                            <Link2 size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                            {t("เปิดทำแบบทดสอบก่อนอบรม", "Open Pre-Test")}
                          </a>
                        </div>
                      ) : null}

                      {item.postTestLink ? (
                        <div className={styles.detailColField}>
                          <span className={styles.fieldLabel}>{t("ลิงก์แบบทดสอบหลังอบรม (POST-TEST)", "POST-TEST LINK")}</span>
                          <a className={styles.testLink} href={item.postTestLink} target="_blank" rel="noopener noreferrer">
                            <Link2 size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                            {t("เปิดทำแบบทดสอบหลังอบรม", "Open Post-Test")}
                          </a>
                        </div>
                      ) : null}

                      {item.evaluationLink ? (
                        <div className={styles.detailColField}>
                          <span className={styles.fieldLabel}>{t("ลิงก์แบบประเมินผลหลังอบรม (EVALUATION)", "EVALUATION FORM LINK")}</span>
                          <a className={styles.testLink} href={item.evaluationLink} target="_blank" rel="noopener noreferrer">
                            <Link2 size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                            {t("เปิดทำแบบประเมินผล", "Open Evaluation Form")}
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

        {filteredRoadmapItems.length === 0 ? (
          <div className={styles.emptyBox}>
            <div className={styles.emptyIcon}>
              <Target size={38} />
            </div>
            <div className={styles.emptyTitle}>
              {t("ไม่มีหลักสูตรเป้าหมายที่เปิดรับสมัครในขณะนี้", "No open target courses available")}
            </div>
            <div className={styles.emptyDesc}>
              {t(
                "ขณะนี้ไม่มีหลักสูตรอบรมเป้าหมายที่เปิดรับสมัครใหม่ หรือคุณอาจผ่านการอบรมตามแผนไปเรียบร้อยแล้ว หากต้องการขออบรมทบทวนความรู้เดิม สามารถไปที่เมนู \"ขอเปิดหลักสูตรฝึกอบรม (Request Training Need)\" ได้ครับ",
                "There are currently no active target courses open for enrollment, or you have already completed your target courses. You can request a refresher session in 'Request Training Need'.",
              )}
            </div>
          </div>
        ) : null}
      </div>
      {/* Registration Confirmation & Approver Selection Modal */}
      {isMounted && registeringPlan && typeof document !== "undefined"
        ? createPortal(
            <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="roadmap-modal-title">
              <div className={styles.modalDialog}>
                <div className={styles.modalHeader}>
                  <h3 className={styles.modalTitle} id="roadmap-modal-title">
                    {t("ยืนยันการสมัครอบรมหลักสูตรตาม Roadmap", "Confirm Roadmap Course Registration")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRegisteringPlan(null)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ui-30-muted)" }}
                    aria-label="Close"
                  >
                    <XCircle size={20} />
                  </button>
                </div>

                <div className={styles.modalBody}>
                  <div className={styles.modalCourseSummary}>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--ui-30-ink)" }}>
                      {registeringPlan.title}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--ui-30-muted)" }}>
                      <strong>{t("รหัสวิชา", "Course Code")}:</strong> {registeringPlan.code} • <strong>{t("วิทยากร", "Trainer")}:</strong> {registeringPlan.trainer || "-"}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--ui-30-muted)" }}>
                      <strong>{t("กำหนดการอบรม", "Date")}:</strong> {registeringPlan.trainingDate} • <strong>{t("สถานที่", "Venue")}:</strong> {registeringPlan.venue || "-"}
                    </div>
                  </div>

                  {isLoadingApprovers ? (
                    <div style={{ textAlign: "center", padding: "16px 0", color: "var(--ui-30-muted)", fontSize: "0.88rem" }}>
                      ⏳ {t("กำลังโหลดรายชื่อผู้อนุมัติตามลำดับขั้น...", "Loading eligible approvers by rank...")}
                    </div>
                  ) : approverMeta?.isPresident ? (
                    <div style={{ background: "var(--ui-30-primary-soft)", border: "1px solid var(--ui-30-primary-border)", borderRadius: 8, padding: 12, color: "var(--ui-30-primary)", fontSize: "0.88rem" }}>
                      ⭐ {t("ท่านดำรงตำแหน่งประธานบริษัท (President) ระบบจะทำการอนุมัติการลงทะเบียนอัตโนมัติ", "You hold the President position. Registration will be auto-approved.")}
                    </div>
                  ) : (
                    <div className={styles.approverSelectSection}>
                      <label className={styles.approverLabel}>
                        {approverMeta?.targetRank === 12
                          ? t("เลือก Section Head (ผู้จัดการแผนก) ในบริษัทของคุณเป็นผู้อนุมัติ:", "Select Section Head in your company as approver:")
                          : approverMeta?.targetRank === 11
                          ? t("เนื่องจากท่านเป็น Section Head กรุณาเลือก Manager (ผู้จัดการ) เป็นผู้อนุมัติ:", "As Section Head, select Manager in your company as approver:")
                          : approverMeta?.targetRank === 10
                          ? t("เนื่องจากท่านเป็น Manager กรุณาเลือก General Manager (ผู้จัดการทั่วไป) เป็นผู้อนุมัติ:", "As Manager, select General Manager as approver:")
                          : t(
                              `กรุณาเลือกผู้บังคับบัญชา (${approverMeta?.targetRankInfo?.nameEn || "Superior"}) ในบริษัทของคุณเป็นผู้อนุมัติ:`,
                              `Please select your superior (${approverMeta?.targetRankInfo?.nameEn || "Superior"}) in your company as approver:`
                            )}
                      </label>
                      {approverCandidates.length > 0 ? (
                        <SearchableApproverSelect
                          candidates={approverCandidates}
                          selectedApproverId={selectedApproverId}
                          onSelect={(id) => setSelectedApproverId(id)}
                        />
                      ) : (
                        <div style={{ background: "var(--ui-10-accent-soft)", border: "1px solid var(--ui-10-accent-border)", borderRadius: 8, padding: 12, color: "var(--ui-10-accent)", fontSize: "0.85rem" }}>
                          ⚠️ {t("ไม่พบรายชื่อผู้อนุมัติตามลำดับขั้นในบริษัทของคุณ (ระบบจะส่งต่อให้ผู้ดูแลระบบ/HRD พิจารณา)", "No direct approvers found at this rank in your company (Request will be routed to HRD/Admin)")}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.cancelRegisterBtn}
                    onClick={() => setRegisteringPlan(null)}
                    disabled={isSubmitting}
                  >
                    {t("ยกเลิก", "Cancel")}
                  </button>
                  <button
                    type="button"
                    className={styles.confirmRegisterBtn}
                    onClick={confirmRegistration}
                    disabled={isSubmitting || isLoadingApprovers}
                  >
                    {isSubmitting ? t("กำลังส่งคำขอ...", "Submitting...") : t("ยืนยันการสมัครอบรม", "Confirm Registration")}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </main>
  );
}
