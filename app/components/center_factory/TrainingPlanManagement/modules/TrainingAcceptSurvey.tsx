"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { type WorkflowStandard } from "../../../../lib/trainingWorkflow";
import {
  getLevelRank,
  normalizeEmployeeLevel,
} from "../../../../lib/employeeMasterData";
import {
  getAttendanceSheetFileName,
  localizeAndSortAttendanceParticipants,
} from "../../../../lib/attendanceSheetExport";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import {
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "./TrainingRolling";
import TypewriterLoader from "../../../TypewriterLoader";
import { UNDER_DEVELOPMENT } from "../../../../lib/underDevelopment";
import { listCourses } from "../../../../lib/courses/client";
import { listEmployees } from "../../../../lib/employees/client";
import type { EmployeeRecord } from "../../../../lib/employees/types";
import { createEnrollment, EnrollmentApiError, listEnrollments, updateEnrollmentStatus } from "../../../../lib/trainingEnrollment/client";
import type { EnrollmentRecord, EnrollmentSource, EnrollmentStatus } from "../../../../lib/trainingEnrollment/types";
import { defaultFunctionRows } from "../../MasterDataManagement/modules/FunctionData";
import { listPositions } from "../../../../lib/positions/client";
import { getCurrentCalendarDate } from "../../../../lib/calendarDate";
import styles from "./TrainingAcceptSurvey.module.css";

export const trainingAcceptSurveyModule = {
  title: "Training Accept Survey",
  subtitle: "Target & approval workflow",
  description:
    "Survey target employees from Course Standard, collect factory submissions, and approve training participants.",
} as const;

type RoleMode = "center" | "factory";
type CourseOwnerFilter = RoleMode | "";

type CourseSurvey = {
  id: string;
  groupId: string;
  code: string;
  title: string;
  owner: RoleMode;
  ownerCompany: string;
  date: string;
  batch?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
  trainer?: string;
  capacity: number;
  courseType: string;
  courseGroup: string;
  objective: string;
  targetGroup?: string;
  standardName: string;
  targetFunctionCode: string;
  targetFunctionName: string;
  targetPositions: string[];
  targetLevels: string[];
  companies: string[];
};

type CourseSurveyGroup = {
  id: string;
  code: string;
  title: string;
  owner: RoleMode;
  ownerCompany: string;
  sessions: CourseSurvey[];
};

type SurveyEmployee = {
  id: string;
  employeeCode: string;
  name: string;
  nameTh?: string;
  nameEn?: string;
  company: string;
  departmentCode: string | null;
  functionName?: string;
  division?: string;
  department: string;
  section?: string;
  position: string;
  level: string;
  prefix: string;
  firstName: string;
  lastName: string;
  titleTh?: string | null;
  titleEn?: string | null;
  firstNameTh?: string;
  lastNameTh?: string;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
};

const companies = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

const statusClass: Record<EnrollmentStatus, string> = {
  "Pending Approval": styles.statusTarget,
  "Factory Approved": styles.statusFactoryApproved,
  "Center Approved": styles.statusCenterApproved,
  Rejected: styles.statusRejected,
  Cancelled: styles.statusTarget,
};

const sourceLabel: Record<EnrollmentSource, string> = {
  EMPLOYEE: "Employee Registration",
  HRD_FACTORY: "Submitted by Factory",
  HRD_CENTER: "Added by Center",
};

const sourceClass: Record<EnrollmentSource, string> = {
  EMPLOYEE: styles.sourceAuto,
  HRD_FACTORY: styles.sourceFactory,
  HRD_CENTER: styles.sourceCenter,
};

const toSurveyEmployee = (employee: EmployeeRecord): SurveyEmployee => {
  const thaiName = [employee.firstNameTh, employee.lastNameTh].filter(Boolean).join(" ");
  const engName = [employee.firstNameEn, employee.lastNameEn].filter(Boolean).join(" ");
  const rawPrefix = employee.titleTh || (employee.titleEn === "Ms." ? "นางสาว" : employee.titleEn === "Mrs." ? "นาง" : employee.titleEn || "");
  const prefix = (!rawPrefix || rawPrefix === "-") ? "นาย" : rawPrefix;

  const section = employee.sectionName || employee.sectionCode || "-";
  const division = employee.divisionName || employee.divisionCode || employee.functionName || "-";
  const department = employee.departmentName || employee.departmentCode || employee.functionName || "-";

  return {
    id: employee.employeeId,
    employeeCode: employee.employeeCode ?? "",
    name: thaiName || engName || employee.employeeCode || "-",
    nameTh: thaiName,
    nameEn: engName,
    company: employee.companyCode,
    departmentCode: employee.functionCode,
    functionName: employee.functionName || "-",
    section,
    division,
    department,
    position: employee.positionName || "-",
    level: normalizeEmployeeLevel(employee.levelKey || employee.levelCode || "-") || employee.levelKey || employee.levelCode || "-",
    prefix,
    firstName: employee.firstNameTh || employee.firstNameEn || "-",
    lastName: employee.lastNameTh || employee.lastNameEn || "-",
    titleTh: employee.titleTh,
    titleEn: employee.titleEn,
    firstNameTh: employee.firstNameTh,
    lastNameTh: employee.lastNameTh,
    firstNameEn: employee.firstNameEn,
    lastNameEn: employee.lastNameEn,
  };
};

const getEmployeeNameProfile = (employee: {
  name: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  titleTh?: string | null;
  titleEn?: string | null;
  firstNameTh?: string;
  lastNameTh?: string;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
}) => {
  const prefix =
    employee.titleTh ||
    (employee.prefix && employee.prefix !== "-" ? employee.prefix : "") ||
    (employee.titleEn === "Ms." ? "นางสาว" : employee.titleEn === "Mrs." ? "นาง" : "นาย");

  if (employee.firstNameTh || employee.lastNameTh) {
    return {
      prefix,
      firstName: employee.firstNameTh || employee.firstName || employee.name,
      lastName: employee.lastNameTh || employee.lastName || "-",
    };
  }
  if (employee.firstName || employee.lastName) {
    return {
      prefix,
      firstName: employee.firstName || employee.name,
      lastName: employee.lastName || "-",
    };
  }
  if (employee.firstNameEn || employee.lastNameEn) {
    return {
      prefix,
      firstName: employee.firstNameEn || employee.name,
      lastName: employee.lastNameEn || "-",
    };
  }

  const nameParts = employee.name.trim().split(/\s+/);
  return {
    prefix,
    firstName: nameParts[0] || employee.name,
    lastName: nameParts.slice(1).join(" ") || "-",
  };
};

const getEmployeePositionLevelDisplay = (emp: { position?: string; level?: string }) => {
  const pos = emp.position && emp.position !== "-" ? emp.position : "";
  const lvl = emp.level && emp.level !== "-" ? emp.level : "";
  if (pos && lvl) return `${pos} (${lvl})`;
  if (pos) return pos;
  if (lvl) return lvl;
  return "-";
};

const POSITION_RANKS: Record<string, number> = {
  president: 13,
  "executive vice president": 12,
  "vice president": 11,
  "senior advisor": 10,
  advisor: 9,
  "executive general manager": 8,
  "senior general manager": 7,
  "plant manager": 6,
  "senior executive coordinator": 5,
  "general manager": 4,
  "assistant general manager": 3,
  "section head": 2,
  supervisor: 1,
  engineer: 1,
  officer: 1,
  foreman: 0,
  staff: 0,
  operator: -1,
};

const getEmployeeRank = (emp: { level?: string; position?: string }) => {
  const lvlRank = getLevelRank(emp.level || "");
  const normPos = (emp.position || "").trim().toLowerCase();
  const posRank = POSITION_RANKS[normPos] ?? 0;
  return lvlRank * 100 + posRank;
};

const sortEmployeesDescending = <T extends { level?: string; position?: string; employeeCode?: string; id?: string }>(
  list: T[],
): T[] => {
  return [...list].sort((a, b) => {
    const rankDiff = getEmployeeRank(b) - getEmployeeRank(a);
    if (rankDiff !== 0) return rankDiff;
    return (a.employeeCode || a.id || "").localeCompare(b.employeeCode || b.id || "");
  });
};

type PaginatedEmployeeGridProps = {
  employees: SurveyEmployee[];
  targetActionLabel: string;
  onAddEmployee: (employee: SurveyEmployee) => void | Promise<void>;
  emptyMessage?: string;
  pageSize?: number;
  enrollments?: EnrollmentRecord[];
  draftSubmittedEmployees?: SurveyEmployee[];
};

function PaginatedEmployeeGrid({
  employees,
  targetActionLabel,
  onAddEmployee,
  emptyMessage = "ไม่มีรายชื่อพนักงานสำหรับบริษัทนี้",
  pageSize = 25,
  enrollments = [],
  draftSubmittedEmployees = [],
}: PaginatedEmployeeGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const nameProfile = getEmployeeNameProfile(emp);
      const text = [
        emp.employeeCode,
        nameProfile.prefix,
        nameProfile.firstName,
        nameProfile.lastName,
        emp.company,
        emp.section,
        emp.division,
        emp.department,
        emp.position,
        emp.level,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [employees, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const pageEmployees = filteredEmployees.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getVisiblePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, activePage - 2);
    let end = start + 4;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - 4);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const visiblePages = getVisiblePages();
  const windowStart = visiblePages[0] ?? 1;
  const windowEnd = visiblePages[visiblePages.length - 1] ?? 1;
  const showLeftArrows = totalPages > 5 && windowStart > 1;
  const showRightArrows = totalPages > 5 && windowEnd < totalPages;

  return (
    <div className={styles.paginatedContainer}>
      <div className={styles.dropdownToolbar}>
        <div className={styles.dropdownSearchWrap}>
          <input
            className={styles.dropdownSearchInput}
            type="text"
            placeholder="🔍 ค้นหาพนักงาน (รหัส, คำนำหน้า, ชื่อ, นามสกุล, ส่วนงาน, ฝ่าย, แผนก, ตำแหน่ง, ระดับ)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery ? (
            <button
              className={styles.dropdownSearchClear}
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
              }}
              title="ล้างคำค้นหา"
            >
              ✕
            </button>
          ) : null}
        </div>
        <span className={styles.dropdownSearchCount}>
          {filteredEmployees.length === 0
            ? "ไม่พบพนักงาน"
            : `แสดง ${startIndex + 1}-${Math.min(startIndex + pageSize, filteredEmployees.length)} จากทั้งหมด ${filteredEmployees.length} คน`}
        </span>
      </div>

      <div className={styles.dropdownScroll}>
        <div className={styles.relatedPeopleGrid}>
          <div className={`${styles.targetEmployeeHeader} ${styles.targetListHeader}`}>
            <span>จัดการ</span>
            <div className={`${styles.targetEmployeeLine} ${styles.targetListLine}`}>
              <span>รหัสพนักงาน</span>
              <span>สถานะ</span>
              <span>คำนำหน้า</span>
              <span>ชื่อ</span>
              <span>นามสกุล</span>
              <span>บริษัท</span>
              <span>ส่วนงาน</span>
              <span>ฝ่าย</span>
              <span>แผนก</span>
              <span>ตำแหน่ง</span>
              <span>ระดับ</span>
            </div>
          </div>
          {pageEmployees.map((employee) => {
            const nameProfile = getEmployeeNameProfile(employee);

            const isDraft = draftSubmittedEmployees.some(
              (emp) => emp.id === employee.id || emp.employeeCode === employee.employeeCode,
            );
            const enrollment = enrollments.find(
              (c) =>
                (c.employeeCode === employee.employeeCode || c.employeeId === employee.id) &&
                c.status !== "Rejected" &&
                c.status !== "Cancelled",
            ) || enrollments.find(
              (c) => c.employeeCode === employee.employeeCode || c.employeeId === employee.id,
            );

            let statusBadge = <span className={styles.badgeNone}>⚪ ยังไม่ลงทะเบียน</span>;
            let buttonLabel = targetActionLabel;
            let isBtnDisabled = false;

            if (isDraft) {
              statusBadge = (
                <span className={styles.badgeDraft}>
                  <span className={styles.glowingDotYellow}></span> ดราฟ
                </span>
              );
              buttonLabel = "✓ ในดราฟแล้ว";
              isBtnDisabled = true;
            } else if (enrollment) {
              if (enrollment.status === "Pending Approval") {
                statusBadge = (
                  <span className={styles.badgePending}>
                    <span className={styles.glowingDotBlue}></span> รออนุมัติ
                  </span>
                );
                buttonLabel = "✓ รออนุมัติ";
                isBtnDisabled = true;
              } else if (enrollment.status === "Factory Approved" || enrollment.status === "Center Approved") {
                statusBadge = (
                  <span className={styles.badgeApproved}>
                    <span className={styles.glowingDotGreen}></span> อนุมัติแล้ว
                  </span>
                );
                buttonLabel = "✓ อนุมัติแล้ว";
                isBtnDisabled = true;
              } else if (enrollment.status === "Rejected") {
                statusBadge = (
                  <span className={styles.badgeRejected}>
                    <span className={styles.glowingDotRed}></span> ถูกปฏิเสธ
                  </span>
                );
                buttonLabel = "+ เลือกใหม่";
                isBtnDisabled = false;
              }
            }

            return (
              <article className={`${styles.employeeRow} ${styles.targetListRow}`} key={employee.id}>
                <button
                  className={`${styles.addTargetButton} ${isBtnDisabled ? styles.addedBtn : ""}`}
                  type="button"
                  disabled={isBtnDisabled}
                  onClick={() => void onAddEmployee(employee)}
                >
                  {buttonLabel}
                </button>
                <div className={`${styles.targetEmployeeLine} ${styles.targetListLine}`}>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={employee.employeeCode}>{employee.employeeCode}</span>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>
                    {statusBadge}
                  </span>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={nameProfile.prefix}>{nameProfile.prefix}</span>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={nameProfile.firstName}>{nameProfile.firstName}</span>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={nameProfile.lastName}>{nameProfile.lastName}</span>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={employee.company}>{employee.company}</span>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={employee.section || "-"}>
                    {employee.section || "-"}
                  </span>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={employee.division || "-"}>
                    {employee.division || "-"}
                  </span>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={employee.department || "-"}>
                    {employee.department || "-"}
                  </span>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={employee.position || "-"}>
                    {employee.position || "-"}
                  </span>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={employee.level || "-"}>
                    {employee.level || "-"}
                  </span>
                </div>
              </article>
            );
          })}
          {pageEmployees.length === 0 ? (
            <div className={styles.emptyCompact}>{emptyMessage}</div>
          ) : null}
        </div>
      </div>

      {totalPages > 1 ? (
        <div className={styles.dropdownPagination}>
          <span className={styles.paginationInfo}>
            หน้า {activePage} จาก {totalPages} (ทั้งหมด {filteredEmployees.length} คน)
          </span>
          <div className={styles.paginationNav}>
            {showLeftArrows ? (
              <>
                <button
                  className={styles.pageBtn}
                  type="button"
                  onClick={() => handlePageChange(1)}
                  title="ไปหน้าแรก"
                >
                  «
                </button>
                <button
                  className={styles.pageBtn}
                  type="button"
                  onClick={() => handlePageChange(activePage - 1)}
                  title="หน้าก่อนหน้า"
                >
                  ‹
                </button>
              </>
            ) : null}

            {visiblePages.map((p) => (
              <button
                key={p}
                className={`${styles.pageBtn} ${p === activePage ? styles.pageBtnActive : ""}`}
                type="button"
                onClick={() => handlePageChange(p)}
              >
                {p}
              </button>
            ))}

            {showRightArrows ? (
              <>
                <button
                  className={styles.pageBtn}
                  type="button"
                  onClick={() => handlePageChange(activePage + 1)}
                  title="หน้าถัดไป"
                >
                  ›
                </button>
                <button
                  className={styles.pageBtn}
                  type="button"
                  onClick={() => handlePageChange(totalPages)}
                  title="ไปหน้าสุดท้าย"
                >
                  »
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof window === "undefined") return false;

  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback if blocked or non-secure HTTP context
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "2em";
    textarea.style.height = "2em";
    textarea.style.padding = "0";
    textarea.style.border = "none";
    textarea.style.outline = "none";
    textarea.style.boxShadow = "none";
    textarea.style.background = "transparent";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error("Clipboard copy failed", err);
    return false;
  }
};

export default function TrainingAcceptSurvey() {
  const user = useAuthenticatedUser();
  const [urlCourseId, setUrlCourseId] = useState<string | null>(null);
  // Declared here, above the effect that sets it. Separate from isTargetLoading, which is reused
  // when switching course: only the very first load should replace the whole page.
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setUrlCourseId(params.get("courseId"));
    }
  }, []);

  const confirm = useConfirm();
  const toast = useToast();
  const roleMode: RoleMode = user?.roleCode === "HRD_CENTER" ? "center" : "factory";
  const userCompanyCode = companies.find((company) => company === user?.companyCode) ?? "SNF";
  const userCompanyLabel =
    roleMode === "center"
      ? "All Companies"
      : profileValue(user?.companyName ?? userCompanyCode);
  const [selectedCourseOwner, setSelectedCourseOwner] = useState<CourseOwnerFilter>(
    "",
  );
  const [selectedCourseGroupId, setSelectedCourseGroupId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [standards, setStandards] = useState<WorkflowStandard[]>([]);
  const [masterEmployees, setMasterEmployees] = useState<SurveyEmployee[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [draftSubmittedEmployees, setDraftSubmittedEmployees] = useState<SurveyEmployee[]>([]);
  const [isExportingAttendance, setIsExportingAttendance] = useState(false);
  const [isSendingLineNotify, setIsSendingLineNotify] = useState(false);
  const [showNominationModal, setShowNominationModal] = useState(false);
  const [copiedUrlSuccess, setCopiedUrlSuccess] = useState(false);
  const [copiedPresetSuccess, setCopiedPresetSuccess] = useState(false);
  useEffect(() => {
    let active = true;
    setIsTargetLoading(true);
    // Four requests, one of them the whole employee master. Until they land the page rendered its
    // shell with empty lists and no sign anything was happening, so it read as broken rather than
    // busy - the loader below only covers the target panel, which is not even reached yet.
    // isInitialLoading starts true and this effect runs once, so it only needs clearing.
    void Promise.all([
      loadWorkflowRollingPlans().catch(() => []),
      listCourses({ search: "", status: null }).catch(() => ({ standards: [] })),
      listEmployees().catch(() => ({ items: [] })),
      listEnrollments({ planId: null, employeeId: null, employeeUserId: null }).catch(() => ({ enrollments: [] })),
    ]).then(([plans, courseResult, empResult, enrollResult]) => {
      if (!active) return;
      setRollingPlans(plans);
      setStandards(courseResult.standards || []);
      // No fabricated fallback. This used to seed the nomination picker from the generated demo
      // master (450 invented people, with no NODE_ENV guard), so an empty or failed employee fetch
      // let HRD nominate names that do not exist.
      setMasterEmployees((empResult.items ?? []).map(toSurveyEmployee));
      setEnrollments(enrollResult.enrollments || []);
    }).finally(() => {
      if (active) {
        setIsTargetLoading(false);
        setIsInitialLoading(false);
      }
    });

    return () => { active = false; };
  }, []);



  const [calendarToday] = useState(getCurrentCalendarDate);
  const todayStr = `${calendarToday.year}-${calendarToday.month}-${String(calendarToday.day).padStart(2, "0")}`;

  const courseSurveys = useMemo<CourseSurvey[]>(
    () =>
      rollingPlans
        .filter((plan) => {
          if (plan.status !== "Planned") return false;
          const endDateStr = plan.endDate || plan.trainingDate;
          const isEnded = plan.dbStatus === "COMPLETED" || (Boolean(endDateStr) && endDateStr < todayStr);
          return !isEnded;
        })
        .map((plan) => {
          const planCourseId = plan.course?.id || "";
          const planCourseCode = (plan.course?.code || "").trim().toUpperCase();
          const planCourseName = (plan.course?.name || "").trim().toLowerCase();

          const standard = standards.find(
            (item) =>
              (item.courseId && planCourseId && item.courseId === planCourseId) ||
              (item.courseCode && planCourseCode && item.courseCode.trim().toUpperCase() === planCourseCode) ||
              (item.courseId && (item.courseId === plan.id || item.courseId === plan.rollingId || item.courseId === plan.oapId)) ||
              (item.courseName && planCourseName && item.courseName.trim().toLowerCase() === planCourseName),
          );
          const isCenterPlan =
            (plan.ownerScope && plan.ownerScope.toUpperCase() === "CENTER") ||
            (plan.owner && plan.owner.toUpperCase() === "CENTER") ||
            plan.ownerCompany === "CENTER" ||
            plan.ownerCompany === "HRD Center" ||
            plan.provider === "HRD Center" ||
            plan.company === "All Companies" ||
            plan.company === "CENTER";
          const standardCompanies =
            standard?.companies && standard.companies.length > 0
              ? standard.companies
              : [];
          const planCompanies = getRollingPlanCompanies(plan).filter(
            (c) => c !== "HRD Center" && c !== "All Companies",
          );
          const targetCompanies =
            standardCompanies.length > 0
              ? standardCompanies
              : planCompanies.length > 0
                ? planCompanies
                : ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"];

          return {
            id: plan.rollingId,
            groupId: plan.scheduleGroupId,
            code: plan.course.code,
            title: plan.course.name,
            owner: isCenterPlan ? "center" : "factory",
            ownerCompany:
              isCenterPlan
                ? "HRD Center"
                : plan.ownerCompany ?? plan.company,
            date: plan.trainingDate,
            batch: plan.batch,
            location: plan.location,
            startTime: plan.startTime,
            endTime: plan.endTime,
            trainer: plan.trainer,
            capacity: Number(plan.participants || 0),
            courseType: plan.course.courseType,
            courseGroup: plan.course.courseGroup,
            objective: plan.course.objective,
            targetGroup: plan.course.targetGroup || "",
            standardName: standard
              ? `${standard.functionName || "All Function"} target standard`
              : "No Course Standard",
            targetFunctionCode: standard?.functionCode ?? "",
            targetFunctionName: standard?.functionName ?? "All Function",
            targetPositions: standard?.positions ?? [],
            targetLevels: standard?.levels ?? [],
            companies: targetCompanies,
          };
        }),
    [rollingPlans, standards],
  );

  useEffect(() => {
    if (urlCourseId && courseSurveys.length > 0) {
      const target = courseSurveys.find(
        (item) => item.id === urlCourseId || item.code === urlCourseId
      );
      if (target) {
        setSelectedCourseOwner(target.owner);
        setSelectedCourseGroupId(target.groupId);
        setSelectedCourseId(target.id);
      }
    }
  }, [urlCourseId, courseSurveys]);

  const courseOwnerOptions =
    roleMode === "center"
      ? [
        { value: "center" as const, label: "Center" },
        { value: "factory" as const, label: "Factory" },
      ]
      : [
        { value: "" as const, label: "ทั้งหมด (Center & Factory)" },
        { value: "factory" as const, label: "Factory" },
        { value: "center" as const, label: "Center" },
      ];
  const availableCourseGroups = useMemo<CourseSurveyGroup[]>(() => {
    const ownerFilteredSessions =
      roleMode === "center"
        ? (selectedCourseOwner
          ? courseSurveys.filter((course) => course.owner === selectedCourseOwner)
          : courseSurveys.filter((course) => course.owner === "center"))
        : (selectedCourseOwner === ""
          ? courseSurveys.filter(
            (course) =>
              (course.owner === "factory" && (course.ownerCompany === userCompanyCode || course.companies.includes(userCompanyCode))) ||
              (course.owner === "center" && course.companies.includes(userCompanyCode)),
          )
          : courseSurveys.filter((course) =>
            selectedCourseOwner === "factory"
              ? course.owner === "factory" && (course.ownerCompany === userCompanyCode || course.companies.includes(userCompanyCode))
              : course.owner === "center" && course.companies.includes(userCompanyCode),
          ));
    const groups = new Map<string, CourseSurvey[]>();

    ownerFilteredSessions.forEach((session) => {
      groups.set(session.groupId, [...(groups.get(session.groupId) ?? []), session]);
    });

    return [...groups.entries()].map(([id, sessions]) => {
      const sortedSessions = [...sessions].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startTime ?? "").localeCompare(b.startTime ?? ""),
      );
      const firstSession = sortedSessions[0];

      return {
        id,
        code: firstSession.code,
        title: firstSession.title,
        owner: firstSession.owner,
        ownerCompany: firstSession.ownerCompany,
        sessions: sortedSessions,
      };
    });
  }, [courseSurveys, roleMode, selectedCourseOwner, userCompanyCode]);

  const selectedCourseGroup =
    availableCourseGroups.find(
      (group) => group.id === selectedCourseGroupId,
    ) ?? null;
  const availableSessions = selectedCourseGroup?.sessions ?? [];
  const selectedCourse = selectedCourseGroup
    ? (availableSessions.find((course) => course.id === selectedCourseId) ??
      availableSessions[0] ??
      null)
    : null;

  useEffect(() => {
    setDraftSubmittedEmployees([]);
    if (!selectedCourse) {
      setEnrollments([]);
      setIsTargetLoading(false);
      return;
    }
    let active = true;
    setIsTargetLoading(true);
    listEnrollments({ planId: selectedCourse.id, employeeId: null, employeeUserId: null })
      .then((result) => {
        if (active) setEnrollments(result.enrollments || []);
      })
      .catch((error) => {
        console.error("Failed to load candidates", error);
        if (active) setEnrollments([]);
      })
      .finally(() => {
        if (active) {
          setTimeout(() => setIsTargetLoading(false), 300);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedCourse?.id]);

  const reloadEnrollments = async () => {
    if (!selectedCourse) return;
    try {
      const result = await listEnrollments({ planId: selectedCourse.id, employeeId: null, employeeUserId: null });
      setEnrollments(result.enrollments || []);
    } catch (error) {
      console.error("Failed to reload candidates", error);
    }
  };
  const isFactoryOwnedByUser =
    roleMode === "factory" &&
    selectedCourse?.owner === "factory" &&
    selectedCourse.ownerCompany === userCompanyCode;
  const hasSelectedCourse = selectedCourse !== null;
  const canShowAcceptanceList = hasSelectedCourse;

  const accessibleCompanies: string[] =
    roleMode === "center"
      ? (selectedCourse?.companies && selectedCourse.companies.length > 0
        ? selectedCourse.companies
        : ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"])
      : [userCompanyCode];

  const normalizeTargetPosition = (position: string) => {
    const normalized = (position || "").trim().toLowerCase().replace(/[\.\-_]/g, " ").replace(/\s+/g, " ");
    const aliases: Record<string, string> = {
      sh: "section head",
      office: "supervisor",
      "manager up": "manager",
      "manager++": "manager",
      "force man": "foreman",
      asst: "assistant",
      "asst manager": "assistant manager",
      "asst. manager": "assistant manager",
    };
    return aliases[normalized] ?? normalized;
  };

  const checkEmployeeTargetStatus = (employee: SurveyEmployee) => {
    if (!selectedCourse) {
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    }

    // 1. Company check: for center mode, check against target companies in Course Standard
    if (roleMode === "center") {
      const targetCompanies =
        selectedCourse.companies && selectedCourse.companies.length > 0
          ? selectedCourse.companies
          : ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"];
      if (!targetCompanies.includes(employee.company)) {
        return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
      }
    }

    // 2. Function check:
    const targetFn = (selectedCourse.targetFunctionName || "").trim();
    const targetCode = (selectedCourse.targetFunctionCode || "").trim().toUpperCase();
    const isAllFunction =
      !targetCode ||
      targetCode === "ALL" ||
      !targetFn ||
      targetFn.toLowerCase().includes("all function") ||
      targetFn.toLowerCase() === "all" ||
      targetFn === "ทุกฝ่ายงาน";

    const cleanStr = (s: string) => s.toLowerCase().replace(/[\s\.\(\)\-_'"]/g, "");
    const empFnCode = (employee.departmentCode || "").trim().toUpperCase();
    const empFnName = (employee.functionName || employee.department || "").trim();
    const fnMatches =
      isAllFunction ||
      Boolean(
        (targetCode && empFnCode && empFnCode === targetCode) ||
        (targetFn && empFnName && cleanStr(empFnName).includes(cleanStr(targetFn))) ||
        (targetFn && empFnName && cleanStr(targetFn).includes(cleanStr(empFnName)))
      );

    if (!fnMatches) {
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    }

    // 3. Level & Position matching:
    const hasPositions = Boolean(selectedCourse.targetPositions && selectedCourse.targetPositions.length > 0);
    const hasLevels = Boolean(selectedCourse.targetLevels && selectedCourse.targetLevels.length > 0);

    let lvlMatches = false;
    if (hasLevels) {
      const empLvlNorm = normalizeEmployeeLevel(employee.level);
      const empLvlRaw = (employee.level || "").replace(/[\.\s\-_]/g, "").toUpperCase();

      lvlMatches = selectedCourse.targetLevels.some((lvl) => {
        const targetLvlNorm = normalizeEmployeeLevel(lvl);
        const targetLvlRaw = (lvl || "").replace(/[\.\s\-_]/g, "").toUpperCase();

        if (targetLvlNorm && empLvlNorm && targetLvlNorm === empLvlNorm) return true;
        if (targetLvlRaw && empLvlRaw && targetLvlRaw === empLvlRaw) return true;

        return false;
      });
    }

    let posMatches = false;
    if (hasPositions) {
      const empPosNorm = normalizeTargetPosition(employee.position);
      posMatches = selectedCourse.targetPositions.some((pos) => {
        const targetPosNorm = normalizeTargetPosition(pos);
        if (targetPosNorm === empPosNorm) return true;
        if (empPosNorm && targetPosNorm && (empPosNorm.includes(targetPosNorm) || targetPosNorm.includes(empPosNorm))) {
          return true;
        }
        return false;
      });
    }

    if (hasLevels && hasPositions) {
      // Both Level and Position are defined: Exact match requires BOTH
      if (lvlMatches && posMatches) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      if (lvlMatches && !posMatches) {
        return { isExactMatch: false, isLevelOnlyMatch: true, isOutMatch: false };
      }
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    } else if (hasLevels) {
      // Only Level is defined
      if (lvlMatches) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    } else if (hasPositions) {
      // Only Position is defined
      if (posMatches) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    }

    const targetGroupStr = (selectedCourse.targetGroup || "").trim();
    if (targetGroupStr && !targetGroupStr.toLowerCase().includes("all") && !targetGroupStr.includes("ทุกกลุ่ม") && targetGroupStr !== "-") {
      const cleanTg = targetGroupStr.toLowerCase();
      const empPosNorm = normalizeTargetPosition(employee.position);
      const empLvlNorm = (normalizeEmployeeLevel(employee.level) || employee.level || "").toLowerCase();

      const tgMatchesPos = Boolean(empPosNorm && (cleanTg.includes(empPosNorm) || empPosNorm.includes(cleanTg)));
      const tgMatchesLvl = Boolean(empLvlNorm && (cleanTg.includes(empLvlNorm) || empLvlNorm.includes(cleanTg)));

      if (tgMatchesPos && tgMatchesLvl) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      if (tgMatchesLvl && !tgMatchesPos) {
        return { isExactMatch: false, isLevelOnlyMatch: true, isOutMatch: false };
      }
      if (tgMatchesPos) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    }

    return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
  };

  const matchesCourseTarget = (employee: SurveyEmployee) =>
    checkEmployeeTargetStatus(employee).isExactMatch;
  const matchesCourseLevelOnly = (employee: SurveyEmployee) =>
    checkEmployeeTargetStatus(employee).isLevelOnlyMatch;

  const targetEmployees = masterEmployees.filter(
    (employee) =>
      accessibleCompanies.includes(employee.company) &&
      matchesCourseTarget(employee),
  );

  const levelOnlyEmployees = masterEmployees.filter(
    (employee) =>
      accessibleCompanies.includes(employee.company) &&
      matchesCourseLevelOnly(employee),
  );

  const acceptedParticipants = sortEmployeesDescending(
    enrollments.filter(
      (candidate) =>
        selectedCourse !== null &&
        candidate.planId === selectedCourse.id &&
        (roleMode === "factory" ? candidate.company === userCompanyCode : true) &&
        (selectedCourse.owner === "factory"
          ? candidate.status === "Factory Approved" || candidate.status === "Center Approved"
          : candidate.status === "Center Approved"),
    ),
  );
  const activeEmployeeIds = new Set(
    enrollments
      .filter((candidate) =>
        ["Pending Approval", "Factory Approved", "Center Approved"].includes(candidate.status),
      )
      .map((candidate) => candidate.employeeId),
  );
  const availableEmployees = masterEmployees.filter(
    (employee) =>
      accessibleCompanies.includes(employee.company) &&
      !activeEmployeeIds.has(employee.id),
  );
  const availableTargetEmployees = availableEmployees.filter(
    matchesCourseTarget,
  );
  const availableLevelOnlyEmployees = availableEmployees.filter(
    matchesCourseLevelOnly,
  );
  const additionalEmployees = availableEmployees.filter(
    (employee) => checkEmployeeTargetStatus(employee).isOutMatch,
  );

  const targetEmployeeGroups = accessibleCompanies
    .map((company) => {
      const emps = sortEmployeesDescending(
        targetEmployees.filter(
          (employee) => employee.company === company,
        ),
      );
      return {
        company,
        employees: emps,
        targetCount: emps.length,
      };
    })
    .filter((group) => group.employees.length > 0);

  const levelOnlyEmployeeGroups = accessibleCompanies
    .map((company) => {
      const emps = sortEmployeesDescending(
        levelOnlyEmployees.filter(
          (employee) => employee.company === company,
        ),
      );
      return {
        company,
        employees: emps,
        targetCount: emps.length,
      };
    })
    .filter((group) => group.employees.length > 0);

  const additionalEmployeeGroups = accessibleCompanies
    .map((company) => {
      const emps = sortEmployeesDescending(
        masterEmployees.filter(
          (employee) =>
            accessibleCompanies.includes(employee.company) &&
            checkEmployeeTargetStatus(employee).isOutMatch &&
            employee.company === company,
        ),
      );
      return {
        company,
        employees: emps,
      };
    })
    .filter((group) => group.employees.length > 0);

  const visibleCandidates =
    roleMode === "center"
      ? enrollments.filter(
        (candidate) =>
          selectedCourse !== null &&
          candidate.planId === selectedCourse.id &&
          candidate.status !== "Center Approved" &&
          candidate.status !== "Rejected" &&
          candidate.status !== "Cancelled",
      )
      : enrollments.filter(
        (candidate) =>
          selectedCourse !== null &&
          candidate.planId === selectedCourse.id &&
          candidate.company === userCompanyCode &&
          candidate.status !== "Factory Approved" &&
          candidate.status !== "Center Approved" &&
          candidate.status !== "Cancelled",
      );

  const approvalQueue = sortEmployeesDescending(
    visibleCandidates.filter((candidate) => candidate.status === "Pending Approval"),
  );

  const submittedToCenterCandidates = sortEmployeesDescending(
    roleMode === "factory" && selectedCourse?.owner === "center"
      ? [
        ...enrollments
          .filter(
            (candidate) =>
              candidate.company === userCompanyCode &&
              candidate.status !== "Center Approved" &&
              candidate.status !== "Cancelled" &&
              candidate.status !== "Rejected",
          )
          .map((c) => ({
            id: c.id,
            employeeId: c.employeeId,
            employeeCode: c.employeeCode,
            employeeName: c.employeeName,
            company: c.company,
            department: c.department,
            position: c.position,
            level: c.level,
            status: c.status,
            isDraft: false,
          })),
        ...draftSubmittedEmployees.map((emp) => ({
          id: `draft-${emp.id}`,
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeName: emp.name,
          company: emp.company,
          department: emp.department,
          position: emp.position,
          level: emp.level,
          status: "Draft",
          isDraft: true,
        })),
      ]
      : [],
  );

  const canCenterApprove = roleMode === "center";
  const canFactoryApprove = roleMode === "factory";
  const canNominateEmployees = hasSelectedCourse;
  const targetActionLabel =
    roleMode === "factory"
      ? selectedCourse?.owner === "factory"
        ? "+ Add"
        : "+ Submit"
      : "+ Add";

  // Tries the enrollment as usual; if the server refuses because the employee has not completed a
  // prerequisite course, asks HRD to confirm by name before resending with the override flag.
  // Returns false when HRD cancels (nothing was created) or true once the enrolment exists.
  // Any other failure is rethrown so the caller's own catch block handles it as before.
  const enrollWithPrerequisiteCheck = async (
    employee: SurveyEmployee,
    planId: string,
    source: EnrollmentSource,
    courseTitle: string,
  ): Promise<boolean> => {
    try {
      await createEnrollment({ planId, employeeId: employee.id, employeeUserId: null, source });
      return true;
    } catch (error) {
      if (!(error instanceof EnrollmentApiError) || error.code !== "PREREQUISITE_NOT_MET") throw error;
      const details = error.details as { missingCourseNames?: string } | undefined;
      const missingNames = (details?.missingCourseNames || "").split(",").filter(Boolean).join(", ");
      const ok = await confirm({
        title: { th: "ยังไม่ผ่านหลักสูตรก่อนหน้า", en: "Prerequisite not completed" },
        message: {
          th: `พนักงาน ${employee.name} (${employee.employeeCode}) ยังไม่ผ่านการอบรมหลักสูตร ${missingNames}\nยืนยันที่จะให้เข้าร่วมหลักสูตร ${courseTitle} หรือไม่?`,
          en: `${employee.name} (${employee.employeeCode}) has not completed ${missingNames}. Enrol them in ${courseTitle} anyway?`,
        },
        confirmLabel: { th: "ยืนยันให้เข้าร่วม", en: "Enrol anyway" },
        cancelLabel: { th: "ยกเลิก", en: "Cancel" },
        danger: true,
      });
      if (!ok) return false;
      await createEnrollment({ planId, employeeId: employee.id, employeeUserId: null, source, acknowledgePrerequisite: true });
      return true;
    }
  };

  const handleAddEmployee = async (employee: SurveyEmployee) => {
    if (!selectedCourse) return;

    if (roleMode === "factory" && selectedCourse?.owner === "center") {
      const isAlreadyDraft = draftSubmittedEmployees.some(
        (emp) => emp.id === employee.id || emp.employeeCode === employee.employeeCode,
      );
      const isAlreadyEnrolled = enrollments.some(
        (candidate) =>
          (candidate.employeeCode === employee.employeeCode || candidate.employeeId === employee.id) &&
          candidate.status !== "Rejected" &&
          candidate.status !== "Cancelled",
      );
      if (isAlreadyDraft || isAlreadyEnrolled) {
        toast.info(`พนักงาน ${employee.employeeCode} อยู่ในรายการแล้ว`);
        return;
      }
      setDraftSubmittedEmployees((prev) => [...prev, employee]);
      toast.success(
        `เพิ่ม ${employee.name} (${employee.employeeCode}) ในรายการเตรียมส่งแล้ว (กรุณากด "บันทึกและยืนยัน" ด้านบนเพื่อส่งให้ส่วนกลาง)`,
      );
      return;
    }

    try {
      const enrolled = await enrollWithPrerequisiteCheck(
        employee,
        selectedCourse.id,
        roleMode === "center" ? "HRD_CENTER" : "HRD_FACTORY",
        selectedCourse.title,
      );
      if (!enrolled) return;
      await reloadEnrollments();
      toast.success(
        `เพิ่ม ${employee.name} (${employee.employeeCode}) เข้าอบรมแล้ว / Added ${employee.employeeCode} to this course`,
      );
    } catch (error) {
      console.error("Failed to add employee", error);
      toast.error("เพิ่มพนักงานไม่สำเร็จ / Failed to add employee.");
    }
  };

  const handleApprove = async (enrollmentId: string) => {
    try {
      await updateEnrollmentStatus(enrollmentId, { action: "approve" });
      await reloadEnrollments();
      toast.success("อนุมัติผู้เข้าอบรมแล้ว / Candidate approved");
    } catch (error) {
      console.error("Failed to approve candidate", error);
      toast.error("อนุมัติไม่สำเร็จ / Failed to approve candidate.");
    }
  };

  const handleReject = async (enrollmentId: string) => {
    if (!(await confirm({ message: { th: "ยืนยันที่จะปฏิเสธผู้สมัครคนนี้หรือไม่?", en: "Confirm rejecting this candidate?" }, danger: true }))) return;
    try {
      await updateEnrollmentStatus(enrollmentId, { action: "reject" });
      await reloadEnrollments();
      toast.success("ปฏิเสธผู้เข้าอบรมแล้ว / Candidate rejected");
    } catch (error) {
      console.error("Failed to reject candidate", error);
      toast.error("ปฏิเสธไม่สำเร็จ / Failed to reject candidate.");
    }
  };

  const handleCancelEnrollment = async (enrollmentId: string) => {
    if (!(await confirm({ message: { th: "ยืนยันที่จะยกเลิกการลงทะเบียนนี้หรือไม่?", en: "Confirm cancelling this enrollment?" }, danger: true }))) return;
    try {
      await updateEnrollmentStatus(enrollmentId, { action: "cancel" });
      await reloadEnrollments();
      toast.success("ยกเลิกการเข้าอบรมแล้ว / Enrollment cancelled");
    } catch (error) {
      console.error("Failed to remove candidate", error);
      toast.error("ยกเลิกไม่สำเร็จ / Failed to remove candidate.");
    }
  };

  // NOT REAL. There is no LINE endpoint anywhere in app/api — this waits then claims the message
  // reached every accepted participant. The button is disabled; kept only as the shape the real
  // call will take. Do not re-enable it until something actually sends.
  const handleSendLineNotification = async () => {
    if (!selectedCourse || acceptedParticipants.length === 0) {
      return;
    }

    setIsSendingLineNotify(true);

    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSendingLineNotify(false);
    toast.success(
      `💬 [LINE OA] ส่งข้อความแจ้งเตือนเข้าร่วมการอบรมวิชา "${selectedCourse.title}" ไปยังพนักงาน ${acceptedParticipants.length} ท่าน ผ่าน LINE Official Account เรียบร้อยแล้ว`,
    );
  };

  const handleCopyNominationLink = async () => {
    if (!selectedCourse) return;

    const nominationUrl = `${window.location.origin}/training-plan/training-accept-survey?courseId=${selectedCourse.id}`;
    await copyTextToClipboard(nominationUrl);
    setCopiedUrlSuccess(true);
    setTimeout(() => setCopiedUrlSuccess(false), 2000);
    setShowNominationModal(true);
  };

  const handleExportAttendanceSheet = async () => {
    if (!selectedCourse || acceptedParticipants.length === 0) {
      return;
    }

    setIsExportingAttendance(true);

    try {
      const positionRows = await listPositions()
        .then((result) => result.items)
        .catch(() => []);
      const employeeRecords = masterEmployees.map((emp) => ({
        empCode: emp.employeeCode,
        company: emp.company,
        nameTh: emp.firstNameTh || emp.firstName,
        surnameTh: emp.lastNameTh || emp.lastName,
        titleEn: emp.titleTh || (emp.prefix && emp.prefix !== "-" ? emp.prefix : "") || emp.titleEn || "นาย",
        functionName: emp.functionName || emp.department,
        positionName: emp.position,
      }));
      const response = await fetch(
        "/api/training-accept-survey/attendance-sheet",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course: selectedCourse,
            participants: localizeAndSortAttendanceParticipants(
              acceptedParticipants.map((candidate) => ({
                id: candidate.employeeCode,
                name: candidate.employeeName,
                company: candidate.company,
                department: candidate.department,
                position: candidate.position,
              })),
              // Lookup table for resolving Thai names and positions by employee code. Falling back
              // to the demo master meant a printed attendance sheet could take a name from a
              // fabricated record whose code happened to collide with a real one.
              employeeRecords,
              positionRows.map((position) => ({
                positionNameTh: position.positionNameTh,
                positionNameEn: position.positionNameEn ?? "",
              })),
            ),
          }),
        },
      );
      const errorPayload = response.ok
        ? null
        : ((await response.json().catch(() => null)) as { error?: string } | null);

      if (!response.ok) {
        throw new Error(errorPayload?.error || "Unable to create attendance sheet.");
      }

      const file = await response.blob();
      const downloadUrl = URL.createObjectURL(file);
      const downloadLink = document.createElement("a");

      downloadLink.href = downloadUrl;
      downloadLink.download = getAttendanceSheetFileName(selectedCourse);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      toast.success("ดาวน์โหลดใบเซ็นชื่อเรียบร้อย / Attendance sheet exported");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "ส่งออกใบเซ็นชื่อไม่สำเร็จ / Unable to export attendance sheet.",
      );
    } finally {
      setIsExportingAttendance(false);
    }
  };

  const [isTargetLoading, setIsTargetLoading] = useState(false);

  // Same shape the Master Data screens use: keep the hero so the page does not jump, and put the
  // loader where the content will appear.
  if (isInitialLoading) {
    return (
      <section className={styles.page} aria-label="Training Accept Survey module">
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{trainingAcceptSurveyModule.subtitle}</p>
            <h2>{trainingAcceptSurveyModule.title}</h2>
            <p>{trainingAcceptSurveyModule.description}</p>
          </div>
        </section>
        <TypewriterLoader label="กำลังโหลดข้อมูลหลักสูตรและรายชื่อพนักงาน..." />
      </section>
    );
  }

  return (
    <section className={styles.page} aria-label="Training Accept Survey module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingAcceptSurveyModule.subtitle}</p>
          <h2>{trainingAcceptSurveyModule.title}</h2>
          <p>{trainingAcceptSurveyModule.description}</p>
        </div>
      </section>

      <section className={styles.controlPanel} aria-label="Survey controls">
        {/* TOP TIER: ACCESS & SCOPE STATUS BAR */}
        <div className={styles.controlHeaderBar}>
          <div className={styles.accessBadge}>
            <span className={roleMode === "center" ? styles.glowingDotBlue : styles.glowingDotGreen}></span>
            <span>สิทธิ์การใช้งานปัจจุบัน:</span>
            <strong>{roleMode === "center" ? "HRD Center Functions" : `HRD Factory Functions (${userCompanyCode})`}</strong>
            <span style={{ opacity: 0.7, fontWeight: 500 }}>— {userCompanyLabel}</span>
          </div>
          <div className={styles.scopeBadge}>
            <span>🎯 ขอบเขตการทำงาน:</span>
            <strong>
              {!selectedCourse
                ? "กรุณาเลือกหลักสูตรด้านล่างเพื่อเริ่มต้นจัดการรายชื่อ"
                : roleMode === "center"
                  ? "ดูภาพรวมพนักงานทุกบริษัท / อนุมัติรายชื่อที่โรงงานส่งมา"
                  : isFactoryOwnedByUser
                    ? `จัดการผู้เข้าร่วมอบรมสำหรับหลักสูตรของโรงงาน ${userCompanyCode}`
                    : `ส่งรายชื่อพนักงาน ${userCompanyCode} เข้าอบรมกลางกับ Center`}
            </strong>
          </div>
        </div>

        {/* BOTTOM TIER: 3-STEP SELECTION GRID */}
        <div className={styles.controlGrid}>
          <div className={styles.controlStepLabel}>
            <div className={styles.controlStepTitle}>
              <span>1️⃣</span>
              <span>ผู้ดูแลหลักสูตร (Course Owner)</span>
            </div>
            <select
              className={styles.controlSelect}
              value={selectedCourseOwner}
              onChange={(event) => {
                setSelectedCourseOwner(event.target.value as CourseOwnerFilter);
                setSelectedCourseGroupId("");
                setSelectedCourseId("");
              }}
            >
              <option value="">เลือกผู้ดูแลหลักสูตร</option>
              {courseOwnerOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.controlStepLabel}>
            <div className={styles.controlStepTitle}>
              <span>2️⃣</span>
              <span>หลักสูตรรายเดือนที่เผยแพร่แล้ว (Published Course)</span>
            </div>
            <select
              className={styles.controlSelect}
              value={selectedCourseGroup?.id ?? ""}
              disabled={availableCourseGroups.length === 0}
              onChange={(event) => {
                const newGroupId = event.target.value;
                setSelectedCourseGroupId(newGroupId);
                const group = availableCourseGroups.find((g) => g.id === newGroupId);
                if (group && group.sessions.length > 0) {
                  setSelectedCourseId(group.sessions[0].id);
                } else {
                  setSelectedCourseId("");
                }
              }}
            >
              <option value="">
                {availableCourseGroups.length === 0 ? "ไม่พบหลักสูตรที่เปิดรับในขณะนี้" : "เลือกหลักสูตรที่ต้องการจัดการ"}
              </option>
              {availableCourseGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  [{group.code}] {group.title} ({group.sessions.length} รอบ)
                </option>
              ))}
            </select>
          </div>

          <div className={styles.controlStepLabel}>
            <div className={styles.controlStepTitle}>
              <span>3️⃣</span>
              <span>รอบการอบรม (Training Session)</span>
            </div>
            <select
              className={styles.controlSelect}
              value={selectedCourseId}
              disabled={!selectedCourseGroup}
              onChange={(event) => {
                const newSessionId = event.target.value;
                setSelectedCourseId(newSessionId);
              }}
            >
              <option value="">
                {selectedCourseGroup ? "เลือกรอบการอบรม" : "⚡ กรุณาเลือกหลักสูตรก่อน"}
              </option>
              {availableSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  รอบ {session.batch ?? "1"} / {session.date} / {session.startTime ?? "-"}-{session.endTime ?? "-"} / {session.location ?? "-"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {selectedCourse ? (
        <Fragment>
          <section className={styles.coursePanel}>
            <div>
              <p className={styles.kicker}>Course detail</p>
              <h3>{selectedCourse.title}</h3>
              <p>{selectedCourse.objective}</p>
            </div>
            <div className={styles.standardGrid}>
              <article>
                <span>Course Code</span>
                <strong>{selectedCourse.code}</strong>
              </article>
              <article>
                <span>Owner</span>
                <strong>{selectedCourse.owner === "center" ? "Center" : selectedCourse.ownerCompany}</strong>
              </article>
              <article>
                <span>Training Date</span>
                <strong>{selectedCourse.date}</strong>
              </article>
              <article>
                <span>Batch</span>
                <strong>{selectedCourse.batch ?? "-"}</strong>
              </article>
              <article>
                <span>Time</span>
                <strong>{selectedCourse.startTime ?? "-"} - {selectedCourse.endTime ?? "-"}</strong>
              </article>
              <article>
                <span>Location</span>
                <strong>{selectedCourse.location ?? "-"}</strong>
              </article>
              <article>
                <span>Capacity</span>
                <strong>{selectedCourse.capacity}</strong>
              </article>
              <article>
                <span>Accepted</span>
                <strong>{acceptedParticipants.length}</strong>
              </article>
              <article>
                <span>Course Type</span>
                <strong>{selectedCourse.courseType}</strong>
              </article>
              <article>
                <span>Course Group</span>
                <strong>{selectedCourse.courseGroup}</strong>
              </article>
              <article>
                <span>Course Standard</span>
                <strong>{selectedCourse.standardName}</strong>
              </article>
              <article>
                <span>Target Found</span>
                <strong>{targetEmployees.length}</strong>
              </article>
              {selectedCourse && (selectedCourse.targetLevels.length > 0 || levelOnlyEmployees.length > 0) && (
                <article>
                  <span>Level Matches</span>
                  <strong>{levelOnlyEmployees.length}</strong>
                </article>
              )}
            </div>
            <div className={styles.ruleRow}>
              <span>Function: {selectedCourse.targetFunctionName || "ALL FUNCTION"}</span>
              <span>
                Position:{" "}
                {selectedCourse.targetPositions.length > 0
                  ? Array.from(
                    new Set(
                      selectedCourse.targetPositions.map((p) => {
                        const cleanP = p.trim();
                        if (cleanP === "ผู้จัดการแผนก") return "SECTION HEAD";
                        if (cleanP === "ผู้จัดการฝ่าย") return "GENERAL MANAGER";
                        if (cleanP === "วิศวกร") return "ENGINEER";
                        if (cleanP === "เจ้าหน้าที่") return "OFFICER";
                        if (cleanP === "หัวหน้างาน") return "SUPERVISOR";
                        if (cleanP === "พนักงานปฏิบัติการ") return "OPERATOR";
                        return cleanP;
                      })
                    )
                  ).join(", ")
                  : selectedCourse.targetGroup && selectedCourse.targetGroup !== "-"
                    ? selectedCourse.targetGroup
                    : "All Positions"}
              </span>
              <span>
                Level:{" "}
                {selectedCourse.targetLevels.length > 0
                  ? Array.from(
                    new Set(
                      selectedCourse.targetLevels
                        .map((l) => {
                          const norm = normalizeEmployeeLevel(l);
                          return norm || l.trim();
                        })
                        .filter((l) => l && l !== "-" && l !== "บ" && l !== "จ" && l !== "ป" && l !== "S")
                    )
                  )
                    .sort((a, b) => getLevelRank(b) - getLevelRank(a))
                    .join(", ")
                  : selectedCourse.targetGroup && selectedCourse.targetGroup !== "-"
                    ? selectedCourse.targetGroup
                    : "All Levels"}
              </span>
              <span>Company: {selectedCourse.companies.length > 0 ? selectedCourse.companies.join(", ") : "All Companies"}</span>
            </div>
          </section>

          <div className={styles.surveySplit}>
            <section className={styles.participantPanel}>
              <div className={styles.workspaceHeader}>
                <div>
                  <p className={styles.kicker}>Training participants</p>
                  <h3>Course participant list</h3>
                </div>
                <div className={styles.participantActions}>
                  <span>{acceptedParticipants.length} / {selectedCourse.capacity} seats</span>
                  <button
                    className={styles.shareLinkButton}
                    type="button"
                    title="คัดลอกลิ้งก์ส่งให้ Section Head / หัวหน้างาน เพื่อเข้าเลือกและเสนอชื่อพนักงานเข้าอบรมเอง"
                    onClick={() => void handleCopyNominationLink()}
                  >
                    <span className={styles.folderContainer}>
                      <svg className={styles.fileBack} viewBox="0 0 146 113" fill="none">
                        <path d="M0 4C0 1.79 1.79 0 4 0H50.38C51.83 0 53.2 0.63 54.15 1.72L64.33 13.44C65.28 14.53 66.66 15.16 68.1 15.16H141.51C143.72 15.16 145.51 16.95 145.51 19.16V109C145.51 111.21 143.72 113 141.51 113H4C1.79 113 0 111.21 0 109V4Z" fill="url(#link_back)" />
                        <defs>
                          <linearGradient id="link_back" x1="0" y1="0" x2="72.9" y2="95.5" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#4f46e5" />
                            <stop offset="1" stopColor="#3730a3" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <svg className={styles.filePage} viewBox="0 0 88 99" fill="none">
                        <rect width="88" height="99" rx="6" fill="#ffffff" />
                      </svg>
                      <svg className={styles.fileFront} viewBox="0 0 160 79" fill="none">
                        <path d="M0.29 12.25C0.13 9.38 2.41 6.97 5.28 6.97H58.19C59.57 6.97 60.93 6.56 62.08 5.79L68.98 1.18C70.13 0.41 71.48 0 72.87 0H155.46C157.87 0 159.73 2.11 159.43 4.5L150.44 75.5C150.19 77.5 148.49 79 146.47 79H7.78C5.66 79 3.91 77.34 3.79 75.22L0.29 12.25Z" fill="url(#link_front)" />
                        <defs>
                          <linearGradient id="link_front" x1="38.76" y1="8.71" x2="66.91" y2="82.83" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#818cf8" />
                            <stop offset="1" stopColor="#4f46e5" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </span>
                    คัดลอกลิ้งก์ให้ Section Head
                  </button>
                  <button
                    className={styles.lineNotifyButton}
                    type="button"
                    disabled
                    title={`${UNDER_DEVELOPMENT.th} / ${UNDER_DEVELOPMENT.en}`}
                  >
                    <span className={styles.folderContainer}>
                      <svg className={styles.fileBack} viewBox="0 0 146 113" fill="none">
                        <path d="M0 4C0 1.79 1.79 0 4 0H50.38C51.83 0 53.2 0.63 54.15 1.72L64.33 13.44C65.28 14.53 66.66 15.16 68.1 15.16H141.51C143.72 15.16 145.51 16.95 145.51 19.16V109C145.51 111.21 143.72 113 141.51 113H4C1.79 113 0 111.21 0 109V4Z" fill="url(#line_back)" />
                        <defs>
                          <linearGradient id="line_back" x1="0" y1="0" x2="72.9" y2="95.5" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#059669" />
                            <stop offset="1" stopColor="#047857" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <svg className={styles.filePage} viewBox="0 0 88 99" fill="none">
                        <rect width="88" height="99" rx="6" fill="#ffffff" />
                      </svg>
                      <svg className={styles.fileFront} viewBox="0 0 160 79" fill="none">
                        <path d="M0.29 12.25C0.13 9.38 2.41 6.97 5.28 6.97H58.19C59.57 6.97 60.93 6.56 62.08 5.79L68.98 1.18C70.13 0.41 71.48 0 72.87 0H155.46C157.87 0 159.73 2.11 159.43 4.5L150.44 75.5C150.19 77.5 148.49 79 146.47 79H7.78C5.66 79 3.91 77.34 3.79 75.22L0.29 12.25Z" fill="url(#line_front)" />
                        <defs>
                          <linearGradient id="line_front" x1="38.76" y1="8.71" x2="66.91" y2="82.83" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#10b981" />
                            <stop offset="1" stopColor="#059669" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </span>
                    {isSendingLineNotify ? "กำลังส่ง LINE..." : "ส่งแจ้งเตือน LINE OA"}
                  </button>
                  <button
                    className={styles.exportAttendanceButton}
                    type="button"
                    disabled={acceptedParticipants.length === 0 || isExportingAttendance}
                    title={
                      acceptedParticipants.length === 0
                        ? "เพิ่มผู้เข้าอบรมอย่างน้อย 1 คนก่อนส่งออกไฟล์ Excel"
                        : "ส่งออกตารางเช็คชื่อเข้าอบรมเป็นไฟล์ Excel (Attendance Sheet)"
                    }
                    onClick={() => void handleExportAttendanceSheet()}
                  >
                    <span className={styles.folderContainer}>
                      <svg className={styles.fileBack} viewBox="0 0 146 113" fill="none">
                        <path d="M0 4C0 1.79 1.79 0 4 0H50.38C51.83 0 53.2 0.63 54.15 1.72L64.33 13.44C65.28 14.53 66.66 15.16 68.1 15.16H141.51C143.72 15.16 145.51 16.95 145.51 19.16V109C145.51 111.21 143.72 113 141.51 113H4C1.79 113 0 111.21 0 109V4Z" fill="url(#excel_back)" />
                        <defs>
                          <linearGradient id="excel_back" x1="0" y1="0" x2="72.9" y2="95.5" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#107c41" />
                            <stop offset="1" stopColor="#0d6334" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <svg className={styles.filePage} viewBox="0 0 88 99" fill="none">
                        <rect width="88" height="99" rx="6" fill="#ffffff" />
                      </svg>
                      <svg className={styles.fileFront} viewBox="0 0 160 79" fill="none">
                        <path d="M0.29 12.25C0.13 9.38 2.41 6.97 5.28 6.97H58.19C59.57 6.97 60.93 6.56 62.08 5.79L68.98 1.18C70.13 0.41 71.48 0 72.87 0H155.46C157.87 0 159.73 2.11 159.43 4.5L150.44 75.5C150.19 77.5 148.49 79 146.47 79H7.78C5.66 79 3.91 77.34 3.79 75.22L0.29 12.25Z" fill="url(#excel_front)" />
                        <defs>
                          <linearGradient id="excel_front" x1="38.76" y1="8.71" x2="66.91" y2="82.83" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#22c55e" />
                            <stop offset="1" stopColor="#16a34a" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </span>
                    {isExportingAttendance
                      ? "กำลังสร้างไฟล์ Excel..."
                      : "ส่งออก Excel (Attendance Sheet)"}
                  </button>
                </div>
              </div>
              <div className={styles.employeeRows}>
                {acceptedParticipants.length > 0 ? (
                  <div className={`${styles.targetEmployeeHeader} ${styles.participantEmployeeHeader}`}>
                    <span>จัดการ</span>
                    <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                      <span>รหัสพนักงาน</span>
                      <span>สถานะ</span>
                      <span>คำนำหน้า</span>
                      <span>ชื่อ</span>
                      <span>นามสกุล</span>
                      <span>บริษัท</span>
                      <span>ส่วนงาน</span>
                      <span>ฝ่าย</span>
                      <span>แผนก</span>
                      <span>ตำแหน่ง</span>
                      <span>ระดับ</span>
                    </div>
                  </div>
                ) : null}
                {acceptedParticipants.map((participant) => {
                  const masterEmp = masterEmployees.find(
                    (emp) =>
                      emp.employeeCode === participant.employeeCode ||
                      emp.id === participant.employeeId,
                  );
                  const nameProfile = getEmployeeNameProfile(masterEmp || { name: participant.employeeName });

                  return (
                    <article className={`${styles.employeeRow} ${styles.participantEmployeeRow}`} key={participant.id}>
                      <button
                        className={styles.withdrawButton}
                        type="button"
                        onClick={() => void handleCancelEnrollment(participant.id)}
                      >
                        ถอดรายชื่อ
                      </button>
                      <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={participant.employeeCode}>{participant.employeeCode}</span>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>
                          <span className={styles.badgeApproved}>
                            <span className={styles.glowingDotGreen}></span> อนุมัติแล้ว
                          </span>
                        </span>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.prefix}>{nameProfile.prefix}</span>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.firstName}>{nameProfile.firstName}</span>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.lastName}>{nameProfile.lastName}</span>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={participant.company}>{participant.company}</span>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.section || "-"}>
                          {masterEmp?.section || "-"}
                        </span>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.division || "-"}>
                          {masterEmp?.division || "-"}
                        </span>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.department || participant.department || "-"}>
                          {masterEmp?.department || participant.department || "-"}
                        </span>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={participant.position || "-"}>
                          {participant.position || "-"}
                        </span>
                        <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={participant.level || "-"}>
                          {participant.level || "-"}
                        </span>
                      </div>
                    </article>
                  );
                })}
                {acceptedParticipants.length === 0 ? (
                  <div className={styles.emptyCompact}>ยังไม่มีผู้เข้าร่วมที่ผ่านการอนุมัติ</div>
                ) : null}
              </div>
            </section>

            {canShowAcceptanceList ? (
              roleMode === "center" ? (
                <section className={styles.approvalPanel} style={{ marginTop: "16px", marginBottom: "16px" }}>
                  <div className={styles.workspaceHeader}>
                    <div>
                      <p className={styles.kicker} style={{ color: "#818cf8" }}>Candidate Approval (Center Mode)</p>
                      <h3>รายการพนักงานส่งจากโรงงานรอการอนุมัติเข้าอบรม ({visibleCandidates.length} คน)</h3>
                    </div>
                    <div className={styles.participantActions}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#818cf8", fontWeight: 700, fontSize: "0.82rem" }}>
                        <span className={styles.glowingDotBlue}></span> รออนุมัติ {approvalQueue.length} คน
                      </span>
                      <button
                        className={styles.batchApproveBtn}
                        type="button"
                        disabled={approvalQueue.length === 0}
                        onClick={async () => {
                          if (approvalQueue.length === 0) return;
                          try {
                            for (const candidate of approvalQueue) {
                              await updateEnrollmentStatus(candidate.id, { action: "approve" });
                            }
                            await reloadEnrollments();
                            toast.success(`อนุมัติพนักงานทั้งหมด ${approvalQueue.length} คนเรียบร้อยแล้ว / Batch approved ${approvalQueue.length} candidates`);
                          } catch (err) {
                            console.error("Failed batch approve", err);
                            toast.error("เกิดข้อผิดพลาดในการอนุมัติทั้งหมด / Failed to batch approve");
                          }
                        }}
                      >
                        ✓ อนุมัติทั้งหมด ({approvalQueue.length})
                      </button>
                    </div>
                  </div>

                  <div className={styles.employeeRows}>
                    {visibleCandidates.length > 0 ? (
                      <div className={`${styles.targetEmployeeHeader} ${styles.participantEmployeeHeader}`}>
                        <span>จัดการ</span>
                        <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                          <span>รหัสพนักงาน</span>
                          <span>สถานะ</span>
                          <span>คำนำหน้า</span>
                          <span>ชื่อ</span>
                          <span>นามสกุล</span>
                          <span>บริษัท</span>
                          <span>ส่วนงาน</span>
                          <span>ฝ่าย</span>
                          <span>แผนก</span>
                          <span>ตำแหน่ง</span>
                          <span>ระดับ</span>
                        </div>
                      </div>
                    ) : null}
                    {visibleCandidates.map((candidate) => {
                      const masterEmp = masterEmployees.find(
                        (emp) =>
                          emp.employeeCode === candidate.employeeCode ||
                          emp.id === candidate.employeeId,
                      );
                      const nameProfile = masterEmp
                        ? getEmployeeNameProfile(masterEmp)
                        : getEmployeeNameProfile({ name: candidate.employeeName });

                      const canApprove = candidate.status === "Pending Approval";
                      const canReject = candidate.status !== "Rejected";

                      return (
                        <article className={`${styles.employeeRow} ${styles.participantEmployeeRow}`} key={candidate.id}>
                          <div className={styles.actionCellBtns}>
                            <button
                              className={styles.approveCandidateBtn}
                              type="button"
                              disabled={!canApprove}
                              onClick={() => void handleApprove(candidate.id)}
                            >
                              ✓ อนุมัติ
                            </button>
                            <button
                              className={styles.rejectCandidateBtn}
                              type="button"
                              disabled={!canReject}
                              onClick={() => void handleReject(candidate.id)}
                            >
                              ✕ ปฏิเสธ
                            </button>
                          </div>
                          <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.employeeCode}>{candidate.employeeCode}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>
                              {candidate.status === "Pending Approval" ? (
                                <span className={styles.badgePending}>
                                  <span className={styles.glowingDotBlue}></span> รออนุมัติ
                                </span>
                              ) : candidate.status === "Center Approved" || candidate.status === "Factory Approved" ? (
                                <span className={styles.badgeApproved}>
                                  <span className={styles.glowingDotGreen}></span> อนุมัติแล้ว
                                </span>
                              ) : candidate.status === "Rejected" ? (
                                <span className={styles.badgeRejected}>
                                  <span className={styles.glowingDotRed}></span> ถูกปฏิเสธ
                                </span>
                              ) : (
                                <span>{candidate.status}</span>
                              )}
                            </span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.prefix}>{nameProfile.prefix}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.firstName}>{nameProfile.firstName}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.lastName}>{nameProfile.lastName}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.company}>{candidate.company}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.section || "-"}>{masterEmp?.section || "-"}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.division || "-"}>{masterEmp?.division || "-"}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.department || candidate.department || "-"}>{masterEmp?.department || candidate.department || "-"}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.position || "-"}>{candidate.position || "-"}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.level || "-"}>{candidate.level || "-"}</span>
                          </div>
                        </article>
                      );
                    })}
                    {visibleCandidates.length === 0 ? (
                      <div className={styles.emptyDraftBox}>
                        📋 ไม่มีรายการส่งพนักงานจากโรงงานที่รออนุมัติในขณะนี้
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : selectedCourse?.owner === "center" ? (
                <>
                  {/* PANEL 1: DRAFT UNSAVED SUBMISSIONS */}
                  <section className={styles.draftPanel} style={{ marginTop: "16px", marginBottom: "16px" }}>
                    <div className={styles.workspaceHeader}>
                      <div>
                        <p className={styles.kicker} style={{ color: "#eab308" }}>Draft Submissions (Unsaved)</p>
                        <h3>รายการเตรียมส่งคนเข้าอบรมกลาง ({draftSubmittedEmployees.length} คน)</h3>
                      </div>
                      <div className={styles.participantActions}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#eab308", fontWeight: 700, fontSize: "0.82rem" }}>
                          <span className={styles.glowingDotYellow}></span> {draftSubmittedEmployees.length} คนรอส่ง
                        </span>
                        <button
                          className={styles.saveSubmissionButton}
                          type="button"
                          disabled={draftSubmittedEmployees.length === 0}
                          onClick={async () => {
                            if (!selectedCourse) return;
                            if (draftSubmittedEmployees.length === 0) return;
                            // HRD is asked once per employee who has not completed a prerequisite;
                            // anyone they decline stays in the draft list rather than being
                            // silently dropped from the batch.
                            const skipped: SurveyEmployee[] = [];
                            let submittedCount = 0;
                            try {
                              for (const emp of draftSubmittedEmployees) {
                                const enrolled = await enrollWithPrerequisiteCheck(
                                  emp,
                                  selectedCourse.id,
                                  "HRD_FACTORY",
                                  selectedCourse.title,
                                );
                                if (enrolled) submittedCount += 1;
                                else skipped.push(emp);
                              }
                              setDraftSubmittedEmployees(skipped);
                              await reloadEnrollments();
                              if (submittedCount > 0) {
                                toast.success(
                                  skipped.length > 0
                                    ? `ส่งรายชื่อพนักงานเข้าอบรมกลางแล้ว ${submittedCount} คน (ข้าม ${skipped.length} คน) / Submitted ${submittedCount}, skipped ${skipped.length}`
                                    : `บันทึกและยืนยันส่งรายชื่อพนักงานเข้าอบรมกลางเรียบร้อยแล้ว รวม ${submittedCount} คน / Submitted ${submittedCount} employee(s) to HRD Center`,
                                );
                              } else if (skipped.length > 0) {
                                toast.info("ไม่มีรายชื่อถูกส่ง / No candidates were submitted");
                              }
                            } catch (error) {
                              console.error("Failed to submit candidates to center", error);
                              toast.error("เกิดข้อผิดพลาดในการบันทึก / Failed to submit candidates to center");
                            }
                          }}
                        >
                          💾 บันทึกและยืนยันส่งรายชื่อเข้าอบรมกลาง ({draftSubmittedEmployees.length})
                        </button>
                      </div>
                    </div>
                    <div className={styles.employeeRows}>
                      {draftSubmittedEmployees.length > 0 ? (
                        <div className={`${styles.targetEmployeeHeader} ${styles.participantEmployeeHeader}`}>
                          <span>จัดการ</span>
                          <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                            <span>รหัสพนักงาน</span>
                            <span>สถานะ</span>
                            <span>คำนำหน้า</span>
                            <span>ชื่อ</span>
                            <span>นามสกุล</span>
                            <span>บริษัท</span>
                            <span>ส่วนงาน</span>
                            <span>ฝ่าย</span>
                            <span>แผนก</span>
                            <span>ตำแหน่ง</span>
                            <span>ระดับ</span>
                          </div>
                        </div>
                      ) : null}
                      {draftSubmittedEmployees.map((emp) => {
                        const nameProfile = getEmployeeNameProfile(emp);

                        return (
                          <article className={`${styles.employeeRow} ${styles.participantEmployeeRow}`} key={`draft-${emp.id}`}>
                            <button
                              className={styles.removeDraftButton}
                              type="button"
                              onClick={() => {
                                setDraftSubmittedEmployees((prev) => prev.filter((e) => e.id !== emp.id));
                                toast.info(`นำ ${emp.employeeCode} ออกจากรายการเตรียมส่งแล้ว`);
                              }}
                            >
                              นำออก (Draft)
                            </button>
                            <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={emp.employeeCode}>{emp.employeeCode}</span>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>
                                <span className={styles.badgeDraft}>
                                  <span className={styles.glowingDotYellow}></span> ดราฟ (ยังไม่บันทึก)
                                </span>
                              </span>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.prefix}>{nameProfile.prefix}</span>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.firstName}>{nameProfile.firstName}</span>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.lastName}>{nameProfile.lastName}</span>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={emp.company}>{emp.company}</span>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={emp.section || "-"}>{emp.section || "-"}</span>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={emp.division || "-"}>{emp.division || "-"}</span>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={emp.department || "-"}>{emp.department || "-"}</span>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={emp.position || "-"}>{emp.position || "-"}</span>
                              <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={emp.level || "-"}>{emp.level || "-"}</span>
                            </div>
                          </article>
                        );
                      })}
                      {draftSubmittedEmployees.length === 0 ? (
                        <div className={styles.emptyDraftBox}>
                          📋 ยังไม่มีพนักงานในดราฟ (กรุณากดเลือกพนักงานจากตารางกลุ่มเป้าหมายด้านล่างเพื่อเตรียมส่งเข้าอบรมกลาง)
                        </div>
                      ) : null}
                    </div>
                  </section>

                  {/* PANEL 2: OFFICIAL SUBMITTED TO CENTER CANDIDATES */}
                  {(() => {
                    const savedCandidates = enrollments.filter(
                      (candidate) =>
                        selectedCourse !== null &&
                        candidate.planId === selectedCourse.id &&
                        candidate.company === userCompanyCode &&
                        candidate.status !== "Center Approved" &&
                        candidate.status !== "Cancelled" &&
                        candidate.status !== "Rejected",
                    );

                    return (
                      <section className={styles.submittedPanel} style={{ marginTop: "16px", marginBottom: "16px" }}>
                        <div className={styles.workspaceHeader}>
                          <div>
                            <p className={styles.kicker}>Submitted to Center (Saved)</p>
                            <h3>รายการส่งคนเข้าอบรมกลางแล้ว ({savedCandidates.length} คน)</h3>
                          </div>
                          <div className={styles.participantActions}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#60a5fa", fontWeight: 700, fontSize: "0.82rem" }}>
                              <span className={styles.glowingDotBlue}></span> {savedCandidates.length} คนส่งแล้ว
                            </span>
                          </div>
                        </div>
                        <div className={styles.employeeRows}>
                          {savedCandidates.length > 0 ? (
                            <div className={`${styles.targetEmployeeHeader} ${styles.participantEmployeeHeader}`}>
                              <span>จัดการ</span>
                              <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                                <span>รหัสพนักงาน</span>
                                <span>สถานะ</span>
                                <span>คำนำหน้า</span>
                                <span>ชื่อ</span>
                                <span>นามสกุล</span>
                                <span>บริษัท</span>
                                <span>ส่วนงาน</span>
                                <span>ฝ่าย</span>
                                <span>แผนก</span>
                                <span>ตำแหน่ง</span>
                                <span>ระดับ</span>
                              </div>
                            </div>
                          ) : null}
                          {savedCandidates.map((candidate) => {
                            const masterEmp = masterEmployees.find(
                              (emp) =>
                                emp.employeeCode === candidate.employeeCode ||
                                emp.id === candidate.employeeId,
                            );
                            const nameProfile = masterEmp
                              ? getEmployeeNameProfile(masterEmp)
                              : getEmployeeNameProfile({ name: candidate.employeeName });

                            return (
                              <article className={`${styles.employeeRow} ${styles.participantEmployeeRow}`} key={candidate.id}>
                                <button
                                  className={styles.removeSubmittedButton}
                                  type="button"
                                  onClick={() => void handleCancelEnrollment(candidate.id)}
                                >
                                  ยกเลิกการส่ง
                                </button>
                                <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.employeeCode}>{candidate.employeeCode}</span>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>
                                    {candidate.status === "Pending Approval" ? (
                                      <span className={styles.badgePending}>
                                        <span className={styles.glowingDotBlue}></span> รออนุมัติ
                                      </span>
                                    ) : candidate.status === "Center Approved" || candidate.status === "Factory Approved" ? (
                                      <span className={styles.badgeApproved}>
                                        <span className={styles.glowingDotGreen}></span> อนุมัติแล้ว
                                      </span>
                                    ) : candidate.status === "Rejected" ? (
                                      <span className={styles.badgeRejected}>
                                        <span className={styles.glowingDotRed}></span> ถูกปฏิเสธ
                                      </span>
                                    ) : (
                                      <span>{candidate.status}</span>
                                    )}
                                  </span>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.prefix}>{nameProfile.prefix}</span>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.firstName}>{nameProfile.firstName}</span>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.lastName}>{nameProfile.lastName}</span>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.company}>{candidate.company}</span>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.section || "-"}>{masterEmp?.section || "-"}</span>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.division || "-"}>{masterEmp?.division || "-"}</span>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.department || candidate.department || "-"}>{masterEmp?.department || candidate.department || "-"}</span>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.position || "-"}>{candidate.position || "-"}</span>
                                  <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.level || "-"}>{candidate.level || "-"}</span>
                                </div>
                              </article>
                            );
                          })}
                          {savedCandidates.length === 0 ? (
                            <div className={styles.emptyCompact}>
                              ยังไม่มีพนักงานที่บันทึกส่งไปยัง Center แล้ว
                            </div>
                          ) : null}
                        </div>
                      </section>
                    );
                  })()}
                </>
              ) : (
                <section className={styles.approvalPanel} style={{ marginTop: "16px", marginBottom: "16px" }}>
                  <div className={styles.workspaceHeader}>
                    <div>
                      <p className={styles.kicker} style={{ color: "#38bdf8" }}>Candidate Approval (Factory Mode)</p>
                      <h3>รายการพนักงานลงทะเบียน / สมัครเข้าอบรมโรงงานรอการอนุมัติ ({visibleCandidates.length} คน)</h3>
                    </div>
                    <div className={styles.participantActions}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#38bdf8", fontWeight: 700, fontSize: "0.82rem" }}>
                        <span className={styles.glowingDotBlue}></span> รออนุมัติ {approvalQueue.length} คน
                      </span>
                      <button
                        className={styles.batchApproveBtn}
                        type="button"
                        disabled={approvalQueue.length === 0}
                        onClick={async () => {
                          if (approvalQueue.length === 0) return;
                          try {
                            for (const candidate of approvalQueue) {
                              await updateEnrollmentStatus(candidate.id, { action: "approve" });
                            }
                            await reloadEnrollments();
                            toast.success(`อนุมัติพนักงานทั้งหมด ${approvalQueue.length} คนเรียบร้อยแล้ว / Batch approved ${approvalQueue.length} candidates`);
                          } catch (err) {
                            console.error("Failed batch approve", err);
                            toast.error("เกิดข้อผิดพลาดในการอนุมัติทั้งหมด / Failed to batch approve");
                          }
                        }}
                      >
                        ✓ อนุมัติทั้งหมด ({approvalQueue.length})
                      </button>
                    </div>
                  </div>

                  <div className={styles.employeeRows}>
                    {visibleCandidates.length > 0 ? (
                      <div className={`${styles.targetEmployeeHeader} ${styles.participantEmployeeHeader}`}>
                        <span>จัดการ</span>
                        <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                          <span>รหัสพนักงาน</span>
                          <span>สถานะ</span>
                          <span>คำนำหน้า</span>
                          <span>ชื่อ</span>
                          <span>นามสกุล</span>
                          <span>บริษัท</span>
                          <span>ส่วนงาน</span>
                          <span>ฝ่าย</span>
                          <span>แผนก</span>
                          <span>ตำแหน่ง</span>
                          <span>ระดับ</span>
                        </div>
                      </div>
                    ) : null}
                    {visibleCandidates.map((candidate) => {
                      const masterEmp = masterEmployees.find(
                        (emp) =>
                          emp.employeeCode === candidate.employeeCode ||
                          emp.id === candidate.employeeId,
                      );
                      const nameProfile = masterEmp
                        ? getEmployeeNameProfile(masterEmp)
                        : getEmployeeNameProfile({ name: candidate.employeeName });

                      const canApprove = candidate.status === "Pending Approval";
                      const canReject = candidate.status !== "Rejected";

                      return (
                        <article className={`${styles.employeeRow} ${styles.participantEmployeeRow}`} key={candidate.id}>
                          <div className={styles.actionCellBtns}>
                            {canApprove ? (
                              <button
                                className={styles.approveCandidateBtn}
                                type="button"
                                onClick={() => void handleApprove(candidate.id)}
                              >
                                ✓ อนุมัติ
                              </button>
                            ) : null}
                            {canReject ? (
                              <button
                                className={styles.rejectCandidateBtn}
                                type="button"
                                onClick={() => void handleReject(candidate.id)}
                              >
                                ✗ ปฏิเสธ
                              </button>
                            ) : null}
                          </div>
                          <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.employeeCode}>{candidate.employeeCode}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>
                              {candidate.status === "Pending Approval" ? (
                                <span className={styles.badgePending}>
                                  <span className={styles.glowingDotYellow}></span> รออนุมัติ
                                </span>
                              ) : candidate.status === "Factory Approved" || candidate.status === "Center Approved" ? (
                                <span className={styles.badgeApproved}>
                                  <span className={styles.glowingDotGreen}></span> อนุมัติแล้ว
                                </span>
                              ) : candidate.status === "Rejected" ? (
                                <span className={styles.badgeRejected}>
                                  <span className={styles.glowingDotRed}></span> ถูกปฏิเสธ
                                </span>
                              ) : (
                                <span>{candidate.status}</span>
                              )}
                            </span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.prefix}>{nameProfile.prefix}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.firstName}>{nameProfile.firstName}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.lastName}>{nameProfile.lastName}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.company}>{candidate.company}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.section || "-"}>{masterEmp?.section || "-"}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.division || "-"}>{masterEmp?.division || "-"}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.department || candidate.department || "-"}>{masterEmp?.department || candidate.department || "-"}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.position || "-"}>{candidate.position || "-"}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.level || "-"}>{candidate.level || "-"}</span>
                          </div>
                        </article>
                      );
                    })}
                    {visibleCandidates.length === 0 ? (
                      <div className={styles.emptyDraftBox}>
                        📋 ยังไม่มีรายการพนักงานลงทะเบียนรออนุมัติในขณะนี้
                      </div>
                    ) : null}
                  </div>
                </section>
              )
            ) : null}
          </div>

          {isTargetLoading ? (
            <TypewriterLoader label="กำลังประมวลผลและดึงข้อมูลกลุ่มเป้าหมาย..." />
          ) : canNominateEmployees ? (
            <Fragment>
              <section className={styles.targetPanel}>
                <div className={styles.workspaceHeader}>
                  <div>
                    <p className={styles.kicker}>Automatic target group</p>
                    <h3>Course Standard target employees</h3>
                  </div>
                  <span>
                    {availableTargetEmployees.length} available / {targetEmployees.length} target
                  </span>
                </div>
                <p className={styles.targetRuleNote}>
                  Automatically matched from position and level in Course Standard.
                </p>
                <div className={styles.companyGroupGrid}>
                  {targetEmployeeGroups.map((group) => {
                    const isUserCompanyCard = roleMode === "factory" && group.company === userCompanyCode;
                    return (
                      <details
                        className={`${styles.companyGroupCard} ${isUserCompanyCard ? styles.ownCompanySectionHeader : ""}`}
                        key={group.company}
                        open
                      >
                        <summary className={styles.companyGroupHeader}>
                          <div className={styles.companySectionTitle}>
                            <span className={styles.companyIcon}>{group.company === "HRD Center" ? "🏢" : "🏬"}</span>
                            <h4>บริษัท {group.company}</h4>
                            {isUserCompanyCard ? (
                              <span className={styles.ownCompanySectionTag}>
                                ⭐ บริษัทของฉัน ({userCompanyCode})
                              </span>
                            ) : null}
                          </div>
                          <span className={styles.companyCountBadge}>
                            {group.employees.length} available / {group.targetCount} target
                          </span>
                        </summary>
                        <PaginatedEmployeeGrid
                          employees={group.employees}
                          targetActionLabel={targetActionLabel}
                          onAddEmployee={handleAddEmployee}
                          emptyMessage="ไม่มีรายชื่อพนักงานสำหรับบริษัทนี้"
                          enrollments={enrollments}
                          draftSubmittedEmployees={draftSubmittedEmployees}
                        />
                      </details>
                    );
                  })}
                  {availableTargetEmployees.length === 0 ? (
                    <div className={styles.emptyCompact}>
                      ไม่มีพนักงานกลุ่มเป้าหมาย Course Standard ที่เหลืออยู่
                    </div>
                  ) : null}
                </div>
              </section>

              {selectedCourse &&
                (selectedCourse.targetLevels.length > 0 || levelOnlyEmployees.length > 0) && (
                  <section className={styles.targetPanel} style={{ marginBottom: "16px" }}>
                    <div className={styles.workspaceHeader}>
                      <div>
                        <p className={styles.kicker}>Target Level group (Other positions)</p>
                        <h3>Employees matching Target Level (Other positions)</h3>
                      </div>
                      <span>
                        {availableLevelOnlyEmployees.length} available / {levelOnlyEmployees.length} in level
                      </span>
                    </div>
                    <p className={styles.targetRuleNote}>
                      💡 พนักงานที่มี Level ตรงตามกำหนด ({[...selectedCourse.targetLevels].sort((a, b) => getLevelRank(b) - getLevelRank(a)).join(", ")}) แต่ตำแหน่งอยู่นอกเหนือจาก {selectedCourse.targetPositions.join(", ")}
                    </p>
                    <div className={styles.companyGroupGrid}>
                      {levelOnlyEmployeeGroups.map((group) => {
                        const isUserCompanyCard = roleMode === "factory" && group.company === userCompanyCode;
                        return (
                          <details
                            className={`${styles.companyGroupCard} ${isUserCompanyCard ? styles.ownCompanySectionHeader : ""}`}
                            key={group.company}
                            open
                          >
                            <summary className={styles.companyGroupHeader}>
                              <div className={styles.companySectionTitle}>
                                <span className={styles.companyIcon}>{group.company === "HRD Center" ? "🏢" : "🏬"}</span>
                                <h4>บริษัท {group.company}</h4>
                                {isUserCompanyCard ? (
                                  <span className={styles.ownCompanySectionTag}>
                                    ⭐ บริษัทของฉัน ({userCompanyCode})
                                  </span>
                                ) : null}
                              </div>
                              <span className={styles.companyCountBadge}>
                                {group.employees.length} available / {group.targetCount} in level
                              </span>
                            </summary>
                            <PaginatedEmployeeGrid
                              employees={group.employees}
                              targetActionLabel={targetActionLabel}
                              onAddEmployee={handleAddEmployee}
                              emptyMessage="ไม่มีรายชื่อพนักงานสำหรับบริษัทนี้"
                              enrollments={enrollments}
                              draftSubmittedEmployees={draftSubmittedEmployees}
                            />
                          </details>
                        );
                      })}
                      {availableLevelOnlyEmployees.length === 0 ? (
                        <div className={styles.emptyCompact}>
                          ไม่มีพนักงานที่มี Level ตรงตามกำหนดในตำแหน่งอื่น
                        </div>
                      ) : null}
                    </div>
                  </section>
                )}

              <section className={styles.targetPanel}>
                <div className={styles.workspaceHeader}>
                  <div>
                    <p className={styles.kicker}>Out-of-target group</p>
                    <h3>Add employees outside the target group</h3>
                  </div>
                  <span>{additionalEmployees.length} available</span>
                </div>
                <p className={styles.targetRuleNote}>
                  💡 เลือกบริษัทด้านล่างเพื่อดูและเพิ่มพนักงานที่ตำแหน่งหรือระดับไม่ตรงตาม Course Standard
                </p>
                <div className={styles.companyGroupGrid}>
                  {additionalEmployeeGroups.map((group) => {
                    const isUserCompanyCard = roleMode === "factory" && group.company === userCompanyCode;
                    return (
                      <details
                        className={`${styles.companyGroupCard} ${styles.additionalDisclosure} ${isUserCompanyCard ? styles.ownCompanySectionHeader : ""}`}
                        key={group.company}
                      >
                        <summary className={styles.companyGroupHeader}>
                          <div className={styles.companySectionTitle}>
                            <span className={styles.companyIcon}>{group.company === "HRD Center" ? "🏢" : "🏬"}</span>
                            <h4>บริษัท {group.company}</h4>
                            {isUserCompanyCard ? (
                              <span className={styles.ownCompanySectionTag}>
                                ⭐ บริษัทของฉัน ({userCompanyCode})
                              </span>
                            ) : null}
                          </div>
                          <span className={styles.companyCountBadge}>
                            {group.employees.length} available
                          </span>
                        </summary>
                        <PaginatedEmployeeGrid
                          employees={group.employees}
                          targetActionLabel={targetActionLabel}
                          onAddEmployee={handleAddEmployee}
                          emptyMessage="ไม่มีพนักงานเพิ่มเติมสำหรับบริษัทนี้"
                          enrollments={enrollments}
                          draftSubmittedEmployees={draftSubmittedEmployees}
                        />
                      </details>
                    );
                  })}
                  {additionalEmployees.length === 0 ? (
                    <div className={styles.emptyCompact}>
                      ไม่มีพนักงานเพิ่มเติมที่สามารถเลือกได้
                    </div>
                  ) : null}
                </div>
              </section>
            </Fragment>
          ) : null}
        </Fragment>
      ) : (
        <section className={styles.selectionPrompt}>
          <strong>Select a course first to show training actual details.</strong>
        </section>
      )}

      {showNominationModal && selectedCourse ? (
        <div className={styles.modalBackdrop} onClick={() => setShowNominationModal(false)}>
          <div className={styles.nominationModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitle}>
                <span aria-hidden="true">🔗</span>
                <div>
                  <h3>ส่งต่อลิ้งก์เสนอชื่อเข้าอบรม</h3>
                  <small style={{ color: "var(--ui-30-muted)" }}>
                    Section Head / Supervisor Nomination Link
                  </small>
                </div>
              </div>
              <button
                className={styles.modalCloseBtn}
                type="button"
                onClick={() => setShowNominationModal(false)}
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            <div className={styles.courseSummaryBadge}>
              <strong>วิชา: {selectedCourse.title}</strong>
              <div className={styles.courseSummaryMeta}>
                <span>🗓️ วันที่: {selectedCourse.date || "ไม่ระบุ"}</span>
                <span>⏰ เวลา: {selectedCourse.startTime && selectedCourse.endTime ? `${selectedCourse.startTime} - ${selectedCourse.endTime}` : "ไม่ระบุ"}</span>
                <span>👥 โควต้า: {selectedCourse.capacity} Seats</span>
              </div>
            </div>

            <div className={styles.urlInputContainer}>
              <label>🔗 ลิ้งก์สำหรับส่งต่อให้หัวหน้างาน (Direct Link):</label>
              <div className={styles.urlBoxWrapper}>
                <input
                  className={styles.urlInputText}
                  type="text"
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/training-plan/training-accept-survey?courseId=${selectedCourse.id}`}
                />
                <button
                  className={`${styles.copyUrlBtn} ${copiedUrlSuccess ? styles.copyUrlSuccess : ""}`}
                  type="button"
                  onClick={async () => {
                    const url = `${window.location.origin}/training-plan/training-accept-survey?courseId=${selectedCourse.id}`;
                    await copyTextToClipboard(url);
                    setCopiedUrlSuccess(true);
                    setTimeout(() => setCopiedUrlSuccess(false), 2000);
                  }}
                >
                  {copiedUrlSuccess ? "✓ คัดลอกแล้ว!" : "📋 คัดลอก URL"}
                </button>
              </div>
            </div>

            <div className={styles.sharePresetContainer}>
              <label>💬 ตัวอย่างข้อความสำเร็จรูปสำหรับส่งต่อ (LINE / Email Preset):</label>
              <div className={styles.presetMessageBox}>
                {`📌 ขอเรียนเชิญหัวหน้างาน / Section Head เสนอชื่อพนักงานเข้าอบรม\n📚 วิชา: ${selectedCourse.title}\n🗓️ วันที่อบรม: ${selectedCourse.date || "ตามกำหนดการ"}\n🔗 ลิ้งก์เสนอชื่อพนักงาน: ${typeof window !== "undefined" ? window.location.origin : ""}/training-plan/training-accept-survey?courseId=${selectedCourse.id}`}
              </div>
            </div>

            <div className={styles.modalActionButtons}>
              <button
                className={styles.copyPresetBtn}
                type="button"
                onClick={async () => {
                  const msg = `📌 ขอเรียนเชิญหัวหน้างาน / Section Head เสนอชื่อพนักงานเข้าอบรม\n📚 วิชา: ${selectedCourse.title}\n🗓️ วันที่อบรม: ${selectedCourse.date || "ตามกำหนดการ"}\n🔗 ลิ้งก์เสนอชื่อพนักงาน: ${window.location.origin}/training-plan/training-accept-survey?courseId=${selectedCourse.id}`;
                  await copyTextToClipboard(msg);
                  setCopiedPresetSuccess(true);
                  setTimeout(() => setCopiedPresetSuccess(false), 2000);
                }}
              >
                <span className={styles.folderContainer}>
                  <svg className={styles.fileBack} viewBox="0 0 146 113" fill="none">
                    <path d="M0 4C0 1.79 1.79 0 4 0H50.38C51.83 0 53.2 0.63 54.15 1.72L64.33 13.44C65.28 14.53 66.66 15.16 68.1 15.16H141.51C143.72 15.16 145.51 16.95 145.51 19.16V109C145.51 111.21 143.72 113 141.51 113H4C1.79 113 0 111.21 0 109V4Z" fill="url(#preset_back)" />
                    <defs>
                      <linearGradient id="preset_back" x1="0" y1="0" x2="72.9" y2="95.5" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#8f88c2" />
                        <stop offset="1" stopColor="#5c52a2" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <svg className={styles.filePage} viewBox="0 0 88 99" fill="none">
                    <rect width="88" height="99" rx="6" fill="#ffffff" />
                  </svg>
                  <svg className={styles.fileFront} viewBox="0 0 160 79" fill="none">
                    <path d="M0.29 12.25C0.13 9.38 2.41 6.97 5.28 6.97H58.19C59.57 6.97 60.93 6.56 62.08 5.79L68.98 1.18C70.13 0.41 71.48 0 72.87 0H155.46C157.87 0 159.73 2.11 159.43 4.5L150.44 75.5C150.19 77.5 148.49 79 146.47 79H7.78C5.66 79 3.91 77.34 3.79 75.22L0.29 12.25Z" fill="url(#preset_front)" />
                    <defs>
                      <linearGradient id="preset_front" x1="38.76" y1="8.71" x2="66.91" y2="82.83" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#c3bbff" />
                        <stop offset="1" stopColor="#51469a" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
                {copiedPresetSuccess ? "✓ คัดลอกข้อความแล้ว!" : "คัดลอกข้อความส่ง LINE / Email"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
