"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TRAINING_MASTER_EVENT,
  TRAINING_WORKFLOW_KEYS,
  readWorkflowCollection,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import {
  getLevelRank,
  normalizeEmployeeLevel,
  readEmployeeMasterData,
} from "../../../../lib/employeeMasterData";
import {
  getAttendanceSheetFileName,
  localizeAndSortAttendanceParticipants,
} from "../../../../lib/attendanceSheetExport";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import {
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "./TrainingRolling";
import { listCourses } from "../../../../lib/courses/client";
import { listEmployees } from "../../../../lib/employees/client";
import type { EmployeeRecord } from "../../../../lib/employees/types";
import { createEnrollment, listEnrollments, updateEnrollmentStatus } from "../../../../lib/trainingEnrollment/client";
import type { EnrollmentRecord, EnrollmentSource, EnrollmentStatus } from "../../../../lib/trainingEnrollment/types";
import { defaultFunctionRows } from "../../MasterDataManagement/modules/FunctionData";
import { listPositions } from "../../../../lib/positions/client";
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
    employeeCode: employee.employeeCode,
    name: thaiName || engName || employee.employeeCode,
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

const masterRecordToSurveyEmployee = (emp: {
  id: string;
  empCode: string;
  company: string;
  nameTh?: string;
  surnameTh?: string;
  titleEn?: string;
  nameEn?: string;
  surnameEn?: string;
  functionCode?: string;
  functionName?: string;
  division?: string;
  department?: string;
  section?: string;
  positionName?: string;
  levelKey?: string;
}): SurveyEmployee => {
  const thaiName = [emp.nameTh, emp.surnameTh].filter(Boolean).join(" ");
  const engName = [emp.nameEn, emp.surnameEn].filter(Boolean).join(" ");
  const prefix = emp.titleEn === "Ms." ? "นางสาว" : emp.titleEn === "Mrs." ? "นาง" : "นาย";

  const division = emp.division || emp.functionName || "-";
  const department = emp.department || emp.functionName || "-";
  const section = emp.section || "-";

  return {
    id: emp.id,
    employeeCode: emp.empCode,
    name: thaiName || engName || emp.empCode,
    nameTh: thaiName,
    nameEn: engName,
    company: emp.company,
    departmentCode: emp.functionCode || null,
    functionName: emp.functionName || "-",
    section,
    division,
    department,
    position: emp.positionName || "-",
    level: normalizeEmployeeLevel(emp.levelKey || "-") || emp.levelKey || "-",
    prefix,
    firstName: emp.nameTh || emp.nameEn || "-",
    lastName: emp.surnameTh || emp.surnameEn || "-",
    titleTh: null,
    titleEn: emp.titleEn || null,
    firstNameTh: emp.nameTh,
    lastNameTh: emp.surnameTh,
    firstNameEn: emp.nameEn,
    lastNameEn: emp.surnameEn,
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
};

function PaginatedEmployeeGrid({
  employees,
  targetActionLabel,
  onAddEmployee,
  emptyMessage = "ไม่มีรายชื่อพนักงานสำหรับบริษัทนี้",
  pageSize = 25,
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

            return (
              <article className={`${styles.employeeRow} ${styles.targetListRow}`} key={employee.id}>
                <button
                  className={styles.addTargetButton}
                  type="button"
                  onClick={() => void onAddEmployee(employee)}
                >
                  {targetActionLabel}
                </button>
                <div className={`${styles.targetEmployeeLine} ${styles.targetListLine}`}>
                  <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={employee.employeeCode}>{employee.employeeCode}</span>
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

export default function TrainingAcceptSurvey() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isExportingAttendance, setIsExportingAttendance] = useState(false);

  useEffect(() => {
    void loadWorkflowRollingPlans().then(setRollingPlans);
    void listCourses({ search: "", status: null })
      .then((result) => setStandards(result.standards || []))
      .catch(() => {
        try {
          const fallback = readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards);
          setStandards(fallback || []);
        } catch {
          setStandards([]);
        }
      });
    void listEmployees()
      .then((result) => {
        if (result.items && result.items.length > 0) {
          setMasterEmployees(result.items.map(toSurveyEmployee));
        } else {
          setMasterEmployees(readEmployeeMasterData().map(masterRecordToSurveyEmployee));
        }
      })
      .catch((error) => {
        console.error("Failed to load employee master, falling back to local master data", error);
        setMasterEmployees(readEmployeeMasterData().map(masterRecordToSurveyEmployee));
      });
  }, []);

  const courseSurveys = useMemo<CourseSurvey[]>(
    () =>
      rollingPlans
        .filter((plan) => plan.status === "Planned")
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
            plan.ownerScope === "CENTER" ||
            plan.ownerCompany === "HRD Center" ||
            plan.provider === "HRD Center";
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

  const courseOwnerOptions =
    roleMode === "center"
      ? [
          { value: "center" as const, label: "Center" },
          { value: "factory" as const, label: "Factory" },
        ]
      : [
          { value: "factory" as const, label: "Factory" },
          { value: "center" as const, label: "Center" },
        ];
  const availableCourseGroups = useMemo<CourseSurveyGroup[]>(() => {
    const ownerFilteredSessions =
      selectedCourseOwner === ""
        ? []
        : roleMode === "center"
          ? courseSurveys.filter(
              (course) => course.owner === selectedCourseOwner,
            )
          : courseSurveys.filter((course) =>
              selectedCourseOwner === "factory"
                ? course.owner === "factory" &&
                  course.ownerCompany === userCompanyCode
                : course.owner === "center" &&
                  course.companies.includes(userCompanyCode),
            );
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
    if (!selectedCourse) {
      setEnrollments([]);
      return;
    }
    let active = true;
    listEnrollments({ planId: selectedCourse.id, employeeId: null })
      .then((result) => {
        if (active) setEnrollments(result.enrollments || []);
      })
      .catch((error) => {
        console.error("Failed to load candidates", error);
        if (active) setEnrollments([]);
      });
    return () => {
      active = false;
    };
  }, [selectedCourse?.id]);

  const reloadEnrollments = async () => {
    if (!selectedCourse) return;
    try {
      const result = await listEnrollments({ planId: selectedCourse.id, employeeId: null });
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

    // 3. Level & Position matching:
    const hasPositions = Boolean(selectedCourse.targetPositions && selectedCourse.targetPositions.length > 0);
    const hasLevels = Boolean(selectedCourse.targetLevels && selectedCourse.targetLevels.length > 0);

    let lvlMatches = false;
    if (hasLevels) {
      const empLvlNorm = normalizeEmployeeLevel(employee.level);
      const empLvlRaw = (employee.level || "").trim().toUpperCase();

      lvlMatches = selectedCourse.targetLevels.some((lvl) => {
        const targetLvlNorm = normalizeEmployeeLevel(lvl);
        const targetLvlRaw = (lvl || "").trim().toUpperCase();

        if (targetLvlNorm && empLvlNorm && targetLvlNorm === empLvlNorm) return true;
        if (targetLvlRaw && empLvlRaw && (targetLvlRaw.includes(empLvlRaw) || empLvlRaw.includes(targetLvlRaw))) return true;

        const isTargetMgmt = /MANAGEMENT|EXEC|MANAGER|จัดการ|M/i.test(targetLvlRaw);
        const isTargetSup = /SUPERVISOR|SPECIALIST|บังคับบัญชา|S/i.test(targetLvlRaw);
        const isTargetOp = /OPERATOR|OPERATION|STAFF|ปฏิบัติการ|O|L/i.test(targetLvlRaw);

        if (isTargetMgmt && (empLvlNorm.startsWith("M") || /จ/i.test(empLvlRaw))) return true;
        if (isTargetSup && (empLvlNorm.startsWith("S") || /บ/i.test(empLvlRaw))) return true;
        if (isTargetOp && (empLvlNorm.startsWith("O") || /ป/i.test(empLvlRaw))) return true;

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
      if (fnMatches && lvlMatches && posMatches) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      if (lvlMatches) {
        return { isExactMatch: false, isLevelOnlyMatch: true, isOutMatch: false };
      }
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    } else if (hasLevels) {
      if (fnMatches && lvlMatches) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      if (lvlMatches) {
        return { isExactMatch: false, isLevelOnlyMatch: true, isOutMatch: false };
      }
      return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
    } else if (hasPositions) {
      if (fnMatches && posMatches) {
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

      if (fnMatches && (tgMatchesPos || tgMatchesLvl)) {
        return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
      }
      if (tgMatchesLvl) {
        return { isExactMatch: false, isLevelOnlyMatch: true, isOutMatch: false };
      }
    }

    if (fnMatches) {
      return { isExactMatch: true, isLevelOnlyMatch: false, isOutMatch: false };
    }

    return { isExactMatch: false, isLevelOnlyMatch: false, isOutMatch: true };
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
        availableTargetEmployees.filter(
          (employee) => employee.company === company,
        ),
      );
      const totalTargetEmps = targetEmployees.filter(
        (employee) => employee.company === company,
      );
      return {
        company,
        employees: emps,
        targetCount: totalTargetEmps.length,
      };
    })
    .filter((group) => group.employees.length > 0);

  const levelOnlyEmployeeGroups = accessibleCompanies
    .map((company) => {
      const emps = sortEmployeesDescending(
        availableLevelOnlyEmployees.filter(
          (employee) => employee.company === company,
        ),
      );
      const totalLevelEmps = levelOnlyEmployees.filter(
        (employee) => employee.company === company,
      );
      return {
        company,
        employees: emps,
        targetCount: totalLevelEmps.length,
      };
    })
    .filter((group) => group.employees.length > 0);

  const additionalEmployeeGroups = accessibleCompanies
    .map((company) => {
      const emps = sortEmployeesDescending(
        additionalEmployees.filter(
          (employee) => employee.company === company,
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
            candidate.status !== "Center Approved" &&
            candidate.status !== "Rejected" &&
            candidate.status !== "Cancelled",
        )
      : enrollments.filter(
          (candidate) =>
            candidate.company === userCompanyCode &&
            candidate.status !== "Factory Approved" &&
            candidate.status !== "Center Approved" &&
            candidate.status !== "Cancelled",
        );

  const approvalQueue = sortEmployeesDescending(
    visibleCandidates.filter((candidate) => candidate.status === "Pending Approval"),
  );

  const submittedToCenterCandidates = sortEmployeesDescending(
    roleMode === "factory"
      ? enrollments.filter(
          (candidate) =>
            candidate.company === userCompanyCode &&
            candidate.status !== "Center Approved" &&
            candidate.status !== "Cancelled" &&
            candidate.status !== "Rejected",
        )
      : [],
  );

  const canCenterApprove = roleMode === "center";
  const canFactoryApprove = roleMode === "factory";
  const targetActionLabel = roleMode === "factory" ? "+ Submit" : "+ Add";

  const handleAddEmployee = async (employee: SurveyEmployee) => {
    if (!selectedCourse) return;

    try {
      await createEnrollment({
        planId: selectedCourse.id,
        employeeId: employee.id,
        source: roleMode === "center" ? "HRD_CENTER" : "HRD_FACTORY",
      });
      await reloadEnrollments();
      setActionMessage(null);
    } catch (error) {
      console.error("Failed to add employee", error);
      setActionMessage("Failed to add employee.");
    }
  };

  const handleApprove = async (enrollmentId: string) => {
    try {
      await updateEnrollmentStatus(enrollmentId, { action: "approve" });
      await reloadEnrollments();
    } catch (error) {
      console.error("Failed to approve candidate", error);
      setActionMessage("Failed to approve candidate.");
    }
  };

  const handleReject = async (enrollmentId: string) => {
    if (!(await confirm({ message: "Reject this candidate?", confirmLabel: "Reject", danger: true }))) return;
    try {
      await updateEnrollmentStatus(enrollmentId, { action: "reject" });
      await reloadEnrollments();
    } catch (error) {
      console.error("Failed to reject candidate", error);
      setActionMessage("Failed to reject candidate.");
    }
  };

  const handleCancelEnrollment = async (enrollmentId: string) => {
    if (!(await confirm({ message: "Cancel this enrollment?", confirmLabel: "Cancel Enrollment", danger: true }))) return;
    try {
      await updateEnrollmentStatus(enrollmentId, { action: "cancel" });
      await reloadEnrollments();
    } catch (error) {
      console.error("Failed to remove candidate", error);
      setActionMessage("Failed to remove candidate.");
    }
  };

  const handleExportAttendanceSheet = async () => {
    if (!selectedCourse || acceptedParticipants.length === 0) {
      return;
    }

    setIsExportingAttendance(true);
    setActionMessage(null);

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
              employeeRecords.length > 0 ? employeeRecords : readEmployeeMasterData(),
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
      setActionMessage("Attendance sheet exported from the v2 template.");
    } catch (error) {
      setActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to export attendance sheet.",
      );
    } finally {
      setIsExportingAttendance(false);
    }
  };

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
        <div className={styles.accessCard}>
          <span>Current access</span>
          <strong>{roleMode === "center" ? "Center functions" : "Factory functions"}</strong>
          <small>{userCompanyLabel}</small>
        </div>

        <label>
          Course owner
          <select
            value={selectedCourseOwner}
            onChange={(event) => {
              setSelectedCourseOwner(event.target.value as CourseOwnerFilter);
              setSelectedCourseGroupId("");
              setSelectedCourseId("");
              setActionMessage(null);
            }}
          >
            <option value="">Select owner</option>
            {courseOwnerOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          Published Rolling Course
          <select
            value={selectedCourseGroup?.id ?? ""}
            disabled={selectedCourseOwner === ""}
            onChange={(event) => {
              const newGroupId = event.target.value;
              setSelectedCourseGroupId(newGroupId);
              const targetGroup = availableCourseGroups.find((g) => g.id === newGroupId);
              setSelectedCourseId(targetGroup?.sessions[0]?.id ?? "");
              setActionMessage(null);
            }}
          >
            <option value="">
              {selectedCourseOwner === "" ? "Select owner first" : "Select course"}
            </option>
            {availableCourseGroups.map((group) => (
              <option key={group.id} value={group.id}>
                [{group.code}] {group.title} / {group.sessions.length} sessions
              </option>
            ))}
          </select>
        </label>

        <label>
          Training Session
          <select
            value={selectedCourse?.id ?? ""}
            disabled={!selectedCourseGroup}
            onChange={(event) => {
              setSelectedCourseId(event.target.value);
              setActionMessage(null);
            }}
          >
            <option value="">
              {selectedCourseGroup ? "Select training session" : "Select course first"}
            </option>
            {availableSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.batch ?? "-"} / {session.date} / {session.startTime ?? "-"}-{session.endTime ?? "-"} / {session.location ?? "-"}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.scopeCard}>
          <span>Function scope</span>
          <strong>
            {!selectedCourse
              ? "Select a course to open this survey"
              : roleMode === "center"
                ? "View all companies / approve factory submissions"
                : isFactoryOwnedByUser
                  ? `Add participants for ${userCompanyCode} factory courses`
                  : `Submit ${userCompanyCode} employees to Center`}
          </strong>
        </div>
      </section>

      {selectedCourse ? (
        <>
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
                ).join(", ")
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
                className={styles.exportAttendanceButton}
                type="button"
                disabled={acceptedParticipants.length === 0 || isExportingAttendance}
                title={
                  acceptedParticipants.length === 0
                    ? "Add at least one participant before exporting."
                    : "Export attendance sheet"
                }
                onClick={() => void handleExportAttendanceSheet()}
              >
                {isExportingAttendance
                  ? "Preparing Excel..."
                  : "Export Excel"}
              </button>
            </div>
          </div>
          {actionMessage ? (
            <p className={styles.savedState} role="status">
              {actionMessage}
            </p>
          ) : null}
          <div className={styles.employeeRows}>
            {acceptedParticipants.length > 0 ? (
              <div className={`${styles.targetEmployeeHeader} ${styles.participantEmployeeHeader}`}>
                <span>จัดการ</span>
                <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                  <span>รหัสพนักงาน</span>
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
                    Withdraw
                  </button>
                  <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={participant.employeeCode}>{participant.employeeCode}</span>
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
          <section className={styles.workspace} style={{ marginTop: "16px", marginBottom: "16px" }}>
            <div className={styles.workspaceHeader}>
              <div>
                <p className={styles.kicker}>Candidate approval</p>
                <h3>Employee acceptance list</h3>
              </div>
              <span>{visibleCandidates.length} shown / {approvalQueue.length} waiting</span>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Company</th>
                    <th>Position / Level</th>
                    <th>Match</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Remark</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCandidates.map((candidate) => {
                    const canApprove = candidate.status === "Pending Approval";

                    return (
                      <tr key={candidate.id}>
                        <td>
                          <strong>{candidate.employeeName}</strong>
                          <span>{candidate.employeeCode} / {candidate.department}</span>
                        </td>
                        <td>{candidate.company}</td>
                        <td>{candidate.position} / {candidate.level}</td>
                        <td>
                          <span className={candidate.targetMatchStatus === "MATCHED" ? styles.matchPill : styles.manualPill}>
                            {candidate.targetMatchStatus === "MATCHED" ? "Position + Level" : "Manual add"}
                          </span>
                        </td>
                        <td><span className={`${styles.sourcePill} ${sourceClass[candidate.source]}`}>{sourceLabel[candidate.source]}</span></td>
                        <td><span className={`${styles.statusPill} ${statusClass[candidate.status]}`}>{candidate.status}</span></td>
                        <td>{candidate.remark}</td>
                        <td className={styles.actionCell}>
                          <button
                            className={styles.approveButton}
                            disabled={!canApprove}
                            type="button"
                            onClick={() => void handleApprove(candidate.id)}
                          >
                            Approve
                          </button>
                          <button
                            className={styles.rejectButton}
                            disabled={candidate.status === "Rejected"}
                            type="button"
                            onClick={() => void handleReject(candidate.id)}
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleCandidates.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>No factory submissions</strong>
                  <span>Factory submitted employees will appear here before they become training participants.</span>
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <section className={styles.submittedPanel} style={{ marginTop: "16px", marginBottom: "16px" }}>
            <div className={styles.workspaceHeader}>
              <div>
                <p className={styles.kicker}>Submitted to Center</p>
                <h3>รายการส่งคนเข้าอบรมกลาง ({submittedToCenterCandidates.length} คน)</h3>
              </div>
              <div className={styles.participantActions}>
                <span>{submittedToCenterCandidates.length} submitted</span>
                <button
                  className={styles.saveSubmissionButton}
                  type="button"
                  disabled={submittedToCenterCandidates.length === 0}
                  onClick={async () => {
                    await reloadEnrollments();
                    setActionMessage(
                      `✅ บันทึกและยืนยันส่งรายชื่อพนักงานเข้าอบรมกลางเรียบร้อยแล้ว (รวม ${submittedToCenterCandidates.length} คน)`
                    );
                  }}
                >
                  💾 บันทึกและยืนยันส่งรายชื่อเข้าอบรมกลาง
                </button>
              </div>
            </div>
            {actionMessage ? (
              <p className={styles.savedState} role="status">
                {actionMessage}
              </p>
            ) : null}
            <div className={styles.employeeRows}>
              {submittedToCenterCandidates.length > 0 ? (
                <div className={`${styles.targetEmployeeHeader} ${styles.participantEmployeeHeader}`}>
                  <span>จัดการ</span>
                  <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                    <span>รหัสพนักงาน</span>
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
              {submittedToCenterCandidates.map((candidate) => {
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
                      Remove
                    </button>
                    <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                      <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.employeeCode}>{candidate.employeeCode}</span>
                      <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.prefix}>{nameProfile.prefix}</span>
                      <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.firstName}>{nameProfile.firstName}</span>
                      <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={nameProfile.lastName}>{nameProfile.lastName}</span>
                      <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.company}>{candidate.company}</span>
                      <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.section || "-"}>
                        {masterEmp?.section || "-"}
                      </span>
                      <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.division || "-"}>
                        {masterEmp?.division || "-"}
                      </span>
                      <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={masterEmp?.department || candidate.department || "-"}>
                        {masterEmp?.department || candidate.department || "-"}
                      </span>
                      <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.position || "-"}>
                        {candidate.position || "-"}
                      </span>
                      <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.level || "-"}>
                        {candidate.level || "-"}
                      </span>
                    </div>
                  </article>
                );
              })}
              {submittedToCenterCandidates.length === 0 ? (
                <div className={styles.emptyCompact}>
                  ยังไม่มีพนักงานที่เลือกส่งไปยัง Center (กรุณากดเลือกพนักงานจากตารางกลุ่มเป้าหมายด้านล่าง)
                </div>
              ) : null}
            </div>
          </section>
        )
      ) : null}

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
      </div>

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
            💡 พนักงานที่มี Level ตรงตามกำหนด ({selectedCourse.targetLevels.join(", ")}) แต่ตำแหน่งอยู่นอกเหนือจาก {selectedCourse.targetPositions.join(", ")}
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
        </>
      ) : (
        <section className={styles.selectionPrompt}>
          <strong>Select a course first to show training actual details.</strong>
        </section>
      )}
    </section>
  );
}
