"use client";

import { useEffect, useMemo, useState } from "react";
import { listCourses } from "../../lib/courses/client";
import {
  getCourseDisplayName,
  getCourseSecondaryName,
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
import { loadWorkflowRollingPlans, type RollingPlan } from "../center_factory/TrainingPlanManagement/modules/TrainingRolling";
import { useUiLanguage } from "../ThaiUiLocalization";
import ModuleHeader from "./ModuleHeader";
import styles from "./RoadmapModule.module.css";

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
  const t = val.trim();
  if (/officer|เจ้าหน้าที่/i.test(t)) return "OFFICER";
  if (/engineer|วิศวกร/i.test(t)) return "ENGINEER";
  if (/section\s*head|หัวหน้างาน|หัวหน้าแผนก/i.test(t)) return "SECTION HEAD";
  if (/technician|ช่างเทคนิค/i.test(t)) return "TECHNICIAN";
  if (/staff|พนักงาน/i.test(t)) return "STAFF";
  if (/manager|ผู้จัดการ/i.test(t)) return "MANAGER";
  return t.toUpperCase();
};

// Helper function to check if a value matches target checklist (strictly matching user's position or level)
const isTargetMatch = (targets: readonly string[] | undefined, userValue: string, isLevel = false, isPosition = false) => {
  if (!targets || targets.length === 0) return false;
  const rawUser = (userValue || "").trim();
  if (!rawUser || rawUser === "-") return false;

  const normalizedUser = isLevel
    ? normalizeLevel(rawUser)
    : isPosition
    ? normalizePosition(rawUser)
    : rawUser.toLowerCase();

  return targets.some((target) => {
    const t = target.trim().toLowerCase();
    if (
      t === "all" ||
      t === "all function" ||
      t === "all companies" ||
      t === "all positions" ||
      t === "all levels" ||
      t === "ทุกตำแหน่ง" ||
      t === "ทุกระดับ" ||
      t === "ทุกกลุ่ม" ||
      t === "พนักงานทุกกลุ่ม"
    ) {
      return false; // General/All does not count as a specific target match for Roadmap
    }

    const targetNorm = isLevel
      ? normalizeLevel(target)
      : isPosition
      ? normalizePosition(target)
      : target.trim().toLowerCase();

    return (
      targetNorm === normalizedUser ||
      targetNorm.includes(normalizedUser) ||
      normalizedUser.includes(targetNorm)
    );
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
  const employeeFunction = profileValue(authenticatedUser?.functionName);
  const employeePosition = profileValue(authenticatedUser?.positionName);
  const employeeLevel = profileValue(authenticatedUser?.levelName);

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
    const missingPrerequisitesFor = (masterCourse: WorkflowCourse | undefined) =>
      (masterCourse?.prerequisites ?? []).filter(
        (p) => !completedCourseCodes.has(p.courseCode.trim().toLowerCase()),
      );

    // 1. Load from Rolling Plans (Most active scheduled plans)
    for (const rp of rollingPlans) {
      if (!rp.course || !rp.course.code) continue;
      const code = rp.course.code;
      if (itemMap.has(code)) continue;

      const std = standards.find(
        (s) =>
          (s.courseCode && s.courseCode.trim().toLowerCase() === code.trim().toLowerCase()) ||
          (s.courseId && String(s.courseId) === String(rp.course.id))
      );
      const masterCourse = courses.find(
        (c) => c.id === rp.course.id || c.courseCode === code
      );

      const ownerComp = rp.ownerCompany || rp.company || employeeCompany;

      const rawPositions = (rp.course as unknown as Record<string, unknown>)?.targetPositions as string[] | undefined
        || (masterCourse as unknown as Record<string, unknown>)?.targetPositions as string[] | undefined
        || std?.positions
        || [];

      const rawLevels = (rp.course as unknown as Record<string, unknown>)?.targetLevels as string[] | undefined
        || (masterCourse as unknown as Record<string, unknown>)?.targetLevels as string[] | undefined
        || std?.levels
        || [];

      const rawCompanies = (rp.course as unknown as Record<string, unknown>)?.targetCompanies as string[] | undefined
        || (masterCourse as unknown as Record<string, unknown>)?.targetCompanies as string[] | undefined
        || std?.companies
        || rp.relatedCompanies
        || [];

      const isCenter = rp.owner === "CENTER";

      const isEnded = isCourseEnded(rp.trainingDate || "", rp.endDate || rp.trainingDate);
      const isRollingOpen = !isEnded;
      const trainingStatus = isEnded
        ? t("เสร็จสิ้นการอบรมแล้ว", "Training ended")
        : t("เปิดรับสมัคร", "Open registration");

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
        ownerCompany: ownerComp,
        courseOwner: isCenter ? "CENTER" : "FACTORY",
        targetGroupDesc: rp.course.targetGroup || masterCourse?.targetGroup || t("พนักงานระดับบังคับบัญชาและระดับปฏิบัติการที่เกี่ยวข้อง", "Targeted Employees & Related Groups"),
        targetCompanies: (rawCompanies.length > 0) ? rawCompanies : (isCenter ? ["All Companies"] : [ownerComp]),
        targetFunctions: std?.functionName ? [std.functionName] : ["All Function"],
        targetPositions: (rawPositions.length > 0) ? rawPositions : ["All Positions"],
        targetLevels: (rawLevels.length > 0) ? rawLevels : ["All Levels"],
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
        missingPrerequisites: missingPrerequisitesFor(masterCourse),
      });
    }

    // 3. Load from standards
    for (const standard of standards) {
      const code = standard.courseCode;
      if (!code || itemMap.has(code)) continue;

      const masterCourse = courses.find((c) => c.id === standard.courseId || c.courseCode === standard.courseCode);
      const ownerComp = standard.ownerCompany || masterCourse?.ownerCompany || employeeCompany;
      const isCenter = standard.owner === "CENTER";

      itemMap.set(code, {
        id: standard.id,
        code,
        title: masterCourse ? getCourseDisplayName(masterCourse) : standard.courseName,
        titleEn: masterCourse ? getCourseSecondaryName(masterCourse) : "",
        category: masterCourse?.courseGroup || t("ทั่วไป", "General"),
        objective: masterCourse?.objective || t("ไม่มีคำอธิบายเป้าหมาย", "No objective provided"),
        learningContent: masterCourse?.learningContent || notSpecified,
        methodology: masterCourse?.methodology || notSpecified,
        courseType: masterCourse?.courseType || notSpecified,
        ownerCompany: ownerComp,
        courseOwner: isCenter ? "CENTER" : "FACTORY",
        targetGroupDesc: masterCourse?.targetGroup || t("พนักงานระดับบังคับบัญชาและระดับปฏิบัติการที่เกี่ยวข้อง", "Targeted Employees & Related Groups"),
        targetCompanies: (standard.companies && standard.companies.length > 0) ? standard.companies : (isCenter ? ["All Companies"] : [ownerComp]),
        targetFunctions: standard.functionName ? [standard.functionName] : ["All Function"],
        targetPositions: (standard.positions && standard.positions.length > 0) ? standard.positions : ["All Positions"],
        targetLevels: (standard.levels && standard.levels.length > 0) ? standard.levels : ["All Levels"],
        round: "-",
        trainingDate: "-",
        trainingStatus: t("อยู่ในแผนประจำปี", "Annual plan pending"),
        hours: notSpecified,
        budget: "-",
        trainer: notSpecified,
        provider: ownerComp,
        place: notSpecified,
        approvalFlow: isCenter ? t("พนักงาน > HRD Center", "Employee > HRD Center") : t("พนักงาน > Factory HRD", "Employee > Factory HRD"),
        contact: isCenter ? t("HRD ส่วนกลาง", "HRD Center") : `${ownerComp} HRD`,
        remarks: masterCourse?.remark || notSpecified,
        isRollingOpen: false,
        isEnded: false,
        preTestLink: masterCourse?.preTestLink,
        postTestLink: masterCourse?.postTestLink,
        evaluationLink: masterCourse?.evaluationLink,
        missingPrerequisites: missingPrerequisitesFor(masterCourse),
      });
    }

    // 4. Compute matching & visibility for each item (Only specifically targeted courses)
    return Array.from(itemMap.values()).map((item) => {
      const isCompanyTargeted = item.courseOwner === "CENTER"
        ? (item.targetCompanies.length === 0 || item.targetCompanies.some((c) => c.toLowerCase() === "all" || c.toLowerCase() === "all companies" || !employeeCompany || employeeCompany === "-" || c.toUpperCase() === employeeCompany.toUpperCase()))
        : (!employeeCompany || employeeCompany === "-" || item.ownerCompany.toUpperCase() === employeeCompany.toUpperCase() || item.targetCompanies.some((c) => c.toUpperCase() === employeeCompany.toUpperCase()));

      const matchPosition = isTargetMatch(item.targetPositions, employeePosition, false, true);
      const matchLevel = isTargetMatch(item.targetLevels, employeeLevel, true, false);
      const matchFunction = isTargetMatch(item.targetFunctions, employeeFunction);

      // Course is relevant if Company matches AND (Position matches OR Level matches)
      const isRelevantForRoadmap = isCompanyTargeted && (matchPosition || matchLevel || matchFunction);
      const isBothPositionAndLevelMatch = matchPosition && matchLevel && isCompanyTargeted;

      return {
        ...item,
        isCompanyTargeted,
        matchPosition,
        matchLevel,
        matchFunction,
        isBothPositionAndLevelMatch,
        isRelevantForRoadmap,
      };
    });
  }, [courses, employeeCompany, employeeFunction, employeeLevel, employeePosition, enrollments, rollingPlans, standards, t]);

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

    // The button is disabled for this case already; this only guards a stale click. The real gate
    // is the server, which rejects the request regardless of what the client believes.
    if (item.missingPrerequisites.length > 0) return;

    const confirmed = window.confirm(
      t(
        `ยืนยันการสมัครอบรมหลักสูตร:\n• ${item.title} (${item.code})\n• กำหนดการ: ${item.trainingDate}\n• วิทยากร: ${item.trainer}`,
        `Confirm registration for course:\n• ${item.title} (${item.code})\n• Date: ${item.trainingDate}\n• Trainer: ${item.trainer}`
      )
    );

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      // The route pins both employee keys to the session for an EMPLOYEE caller, so nothing sent
      // from here decides who is enrolled. See the same call in RegisterTrainingModule.
      await createEnrollment({
        planId: item.id,
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
          : t("สมัครอบรมไม่สำเร็จ", "Could not submit the registration")
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

      {/* Control Panel Card Inspired by RegisterTrainingModule */}
      <section className={styles.controlPanelCard} aria-label="Roadmap Filters & Search">
        {/* User Profile Bar */}
        <div className={styles.profileRow}>
          <div className={styles.profileMeta}>
            <div className={styles.avatarBadge}>👤</div>
            <div className={styles.profileText}>
              <h2>{employeeName}</h2>
              <p>Your Target Group Profile</p>
            </div>
          </div>
          <div className={styles.profileBadges}>
            <span className={styles.profileBadgeItem}>🏢 Company: <strong>{employeeCompany}</strong></span>
            <span className={styles.profileBadgeItem}>💼 Position: <strong>{toEnglishText(employeePosition)}</strong></span>
            <span className={styles.profileBadgeItem}>⭐ Level: <strong>{toEnglishText(employeeLevel)}</strong></span>
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
              🌐 {showCompleted ? t("คอร์สเป้าหมายทั้งหมด", "All Target Courses") : t("คอร์สเป้าหมายที่สมัครได้", "Available Target Courses")}
              <span className={styles.tabBadge}>{totalCount}</span>
            </button>
            <button
              type="button"
              className={`${styles.scopeTab} ${selectedTab === "CENTER" ? styles.activeScopeTab : ""}`}
              onClick={() => setSelectedTab("CENTER")}
            >
              🏛️ {t("ส่วนกลาง (Center)", "Center Mandatory")}
              <span className={styles.tabBadge}>{centerCount}</span>
            </button>
            <button
              type="button"
              className={`${styles.scopeTab} ${selectedTab === "COMPANY" ? styles.activeScopeTab : ""}`}
              onClick={() => setSelectedTab("COMPANY")}
            >
              🏭 {employeeCompany || t("โรงงาน (Factory)", "Factory")}
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
            <span className={styles.searchIcon}>🔍</span>
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
                ✕
              </button>
            ) : null}
          </div>

          <div className={styles.categorySelectWrap}>
            <select
              className={styles.categorySelect}
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="ALL">-- {t("ทุกหมวดหมู่หลักสูตร", "All Categories")} --</option>
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
                    {isCenter ? "🏛️ Center Mandatory" : `🏭 ${item.ownerCompany}`}
                  </span>
                  <span className={styles.categoryPill}>{item.category}</span>

                  {/* Target Match Badge */}
                  {item.isBothPositionAndLevelMatch ? (
                    <span className={`${styles.targetMatchPill} ${styles.exactTargetPill}`}>
                      🎯 {t("ตรงกลุ่มเป้าหมายหลัก", "Direct Target Match")}
                    </span>
                  ) : item.matchLevel ? (
                    <span className={`${styles.targetMatchPill} ${styles.levelMatchPill}`}>
                      ⭐ {t("ตรงระดับงาน", "Level Match")}: {employeeLevel}
                    </span>
                  ) : item.matchPosition ? (
                    <span className={`${styles.targetMatchPill} ${styles.positionMatchPill}`}>
                      💼 {t("ตรงตำแหน่งงาน", "Position Match")}: {employeePosition}
                    </span>
                  ) : (
                    <span className={`${styles.targetMatchPill} ${styles.generalMatchPill}`}>
                      🏢 {t("หลักสูตรทั่วไป", "General Course")}
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
                      className={styles.detailBtn}
                      type="button"
                      disabled
                      style={{ opacity: 0.65, cursor: "not-allowed", color: "var(--ui-30-muted)" }}
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
                      className={styles.registerBtn}
                      type="button"
                      disabled
                      style={{ opacity: 0.65, cursor: "not-allowed" }}
                      title={t(
                        `ต้องผ่านหลักสูตร ${item.missingPrerequisites.map((p) => p.courseName).join(", ")} ก่อน`,
                        `Requires completing ${item.missingPrerequisites.map((p) => p.courseName).join(", ")} first`,
                      )}
                    >
                      {t("ต้องผ่านหลักสูตรก่อนหน้าก่อน", "Prerequisite not completed")}
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
                      🎯 {t("รายละเอียดกลุ่มเป้าหมาย (TARGET GROUP DETAILS)", "TARGET GROUP DETAILS")}
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
                        💻 {t("วัตถุประสงค์ & เนื้อหาการเรียนรู้", "Objective & Learning Content")}
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
                        🏫 {t("รายละเอียดชั้นเรียน & ผู้จัด", "Class Details & Provider")}
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
                        ⚙️ {t("ข้อกำหนด & การอนุมัติ", "Requirements & Approval")}
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
                            🔗 {t("เปิดทำแบบทดสอบก่อนอบรม", "Open Pre-Test")}
                          </a>
                        </div>
                      ) : null}

                      {item.postTestLink ? (
                        <div className={styles.detailColField}>
                          <span className={styles.fieldLabel}>{t("ลิงก์แบบทดสอบหลังอบรม (POST-TEST)", "POST-TEST LINK")}</span>
                          <a className={styles.testLink} href={item.postTestLink} target="_blank" rel="noopener noreferrer">
                            🔗 {t("เปิดทำแบบทดสอบหลังอบรม", "Open Post-Test")}
                          </a>
                        </div>
                      ) : null}

                      {item.evaluationLink ? (
                        <div className={styles.detailColField}>
                          <span className={styles.fieldLabel}>{t("ลิงก์แบบประเมินผลหลังอบรม (EVALUATION)", "EVALUATION FORM LINK")}</span>
                          <a className={styles.testLink} href={item.evaluationLink} target="_blank" rel="noopener noreferrer">
                            🔗 {t("เปิดทำแบบประเมินผล", "Open Evaluation Form")}
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
            <div className={styles.emptyIcon}>🎯</div>
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
    </main>
  );
}
