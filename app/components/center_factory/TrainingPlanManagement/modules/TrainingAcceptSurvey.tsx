"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TRAINING_MASTER_EVENT,
  TRAINING_MASTER_KEYS,
  readMasterCollection,
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
import { defaultPositionRows } from "../../MasterDataManagement/modules/PositionData";
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
  company: string;
  departmentCode: string | null;
  functionName?: string;
  department: string;
  position: string;
  level: string;
  prefix: string;
  firstName: string;
  lastName: string;
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

const toSurveyEmployee = (employee: EmployeeRecord): SurveyEmployee => ({
  id: employee.employeeId,
  employeeCode: employee.employeeCode,
  name:
    [employee.firstNameEn, employee.lastNameEn].filter(Boolean).join(" ") ||
    [employee.firstNameTh, employee.lastNameTh].filter(Boolean).join(" "),
  company: employee.companyCode,
  departmentCode: employee.functionCode,
  department: employee.functionName || "-",
  position: employee.positionName || "-",
  level: employee.levelKey ? normalizeEmployeeLevel(employee.levelKey) || "-" : "-",
  prefix: employee.titleEn || employee.titleTh || "-",
  firstName: employee.firstNameEn || employee.firstNameTh,
  lastName: employee.lastNameEn || employee.lastNameTh,
});

const getEmployeeNameProfile = (employee: { name: string; prefix?: string; firstName?: string; lastName?: string }) => {
  if (employee.firstName || employee.lastName) {
    return {
      prefix: employee.prefix || "นาย",
      firstName: employee.firstName || employee.name,
      lastName: employee.lastName || "-",
    };
  }

  const nameParts = employee.name.trim().split(/\s+/);
  return {
    prefix: "นาย",
    firstName: nameParts[0] || employee.name,
    lastName: nameParts.slice(1).join(" ") || "-",
  };
};

const getEmployeeFunctionDisplay = (emp: { departmentCode?: string | null; functionName?: string; department?: string }) => {
  if (emp.functionName && emp.functionName !== "-") {
    return emp.functionName;
  }
  return emp.department || "-";
};

const getEmployeePositionLevelDisplay = (emp: { position?: string; level?: string }) => {
  const parts = [emp.position, emp.level].filter((p) => p && p !== "-");
  return parts.length > 0 ? parts.join(" / ") : "-";
};

export default function TrainingAcceptSurvey() {
  const user = useAuthenticatedUser();
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
    void listCourses({ search: "", status: null }).then((result) => setStandards(result.standards || []));
    void listEmployees()
      .then((result) => setMasterEmployees((result.items || []).map(toSurveyEmployee)))
      .catch((error) => {
        console.error("Failed to load employee master", error);
        setMasterEmployees([]);
      });
  }, []);

  const courseSurveys = useMemo<CourseSurvey[]>(
    () =>
      rollingPlans
        .filter((plan) => plan.status === "Planned")
        .map((plan) => {
          const standard = standards.find(
            (item) => item.courseCode === plan.course.code,
          );
          const isCenterPlan =
            plan.ownerScope === "CENTER" ||
            plan.ownerCompany === "HRD Center" ||
            plan.provider === "HRD Center";

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
            standardName: standard
              ? `${standard.functionName} target standard`
              : "No Course Standard",
            targetFunctionCode: standard?.functionCode ?? "",
            targetFunctionName: standard?.functionName ?? "All Function",
            targetPositions: standard?.positions ?? [],
            targetLevels: standard?.levels ?? [],
            companies: getRollingPlanCompanies(plan),
          };
        }),
    [rollingPlans, standards],
  );

  const courseOwnerOptions =
    roleMode === "center"
      ? [
          { value: "center" as const, label: "Center" },
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
    ) ??
    availableCourseGroups[0] ??
    null;
  const availableSessions = selectedCourseGroup?.sessions ?? [];
  const selectedCourse =
    availableSessions.find((course) => course.id === selectedCourseId) ??
    availableSessions[0] ??
    null;

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
  const isFactorySubmittingToCenter =
    roleMode === "factory" && selectedCourse?.owner === "center";
  const hasSelectedCourse = selectedCourse !== null;
  const canShowAcceptanceList = hasSelectedCourse && (roleMode === "center" || isFactoryOwnedByUser);

  const accessibleCompanies: string[] =
    roleMode === "center"
      ? (selectedCourse?.companies ?? [])
      : selectedCourse?.companies.includes(userCompanyCode)
        ? [userCompanyCode]
        : [];

  const normalizeTargetPosition = (position: string) => {
    const normalized = position.trim().toLowerCase();
    const aliases: Record<string, string> = {
      sh: "section head",
      office: "supervisor",
      "manager up": "manager",
      "manager++": "manager",
      "force man": "foreman",
    };
    return aliases[normalized] ?? normalized;
  };
  const matchesCourseTarget = (employee: SurveyEmployee) =>
    selectedCourse !== null &&
    (selectedCourse.targetFunctionName === "All Function" ||
      (selectedCourse.targetFunctionCode && employee.departmentCode
        ? employee.departmentCode === selectedCourse.targetFunctionCode
        : employee.department.trim().toLowerCase() ===
          selectedCourse.targetFunctionName.trim().toLowerCase())) &&
    selectedCourse.targetPositions.some(
      (position) =>
        normalizeTargetPosition(position) ===
        normalizeTargetPosition(employee.position),
    ) &&
    selectedCourse.targetLevels.some(
      (level) => normalizeEmployeeLevel(level) === employee.level,
    );
  const targetEmployees = masterEmployees.filter(
    (employee) =>
      accessibleCompanies.includes(employee.company) &&
      matchesCourseTarget(employee),
  );

  const acceptedParticipants = enrollments.filter(
    (candidate) =>
      selectedCourse !== null &&
      (roleMode === "factory" ? candidate.company === userCompanyCode : true) &&
      (selectedCourse.owner === "factory"
        ? candidate.status === "Factory Approved"
        : candidate.status === "Center Approved"),
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
  const additionalEmployees = availableEmployees.filter(
    (employee) => !matchesCourseTarget(employee),
  );
  const targetEmployeeGroups = accessibleCompanies
    .map((company) => ({
      company,
      employees: availableTargetEmployees.filter(
        (employee) => employee.company === company,
      ),
      targetCount: targetEmployees.filter((employee) => employee.company === company).length,
    }))
    .filter((group) => group.employees.length > 0);
  const additionalEmployeeGroups = accessibleCompanies
    .map((company) => ({
      company,
      employees: additionalEmployees.filter(
        (employee) => employee.company === company,
      ),
    }))
    .filter((group) => group.employees.length > 0);
  const visibleCandidates =
    roleMode === "center"
      ? enrollments.filter(
          (candidate) =>
            candidate.status !== "Center Approved" &&
            candidate.status !== "Rejected" &&
            candidate.status !== "Cancelled",
        )
      : isFactoryOwnedByUser
        ? enrollments.filter(
            (candidate) =>
              candidate.company === userCompanyCode &&
              candidate.status !== "Factory Approved" &&
              candidate.status !== "Center Approved" &&
              candidate.status !== "Cancelled",
          )
        : [];

  const approvalQueue = visibleCandidates.filter((candidate) =>
    roleMode === "center"
      ? candidate.status === "Pending Approval"
      : isFactoryOwnedByUser &&
        candidate.company === userCompanyCode &&
        candidate.status === "Pending Approval",
  );
  const submittedToCenterCandidates = isFactorySubmittingToCenter
    ? enrollments.filter(
        (candidate) =>
          candidate.company === userCompanyCode &&
          candidate.source === "HRD_FACTORY" &&
          candidate.status === "Pending Approval",
      )
    : [];

  const isCenterOwned = selectedCourse?.owner === "center";
  const canCenterApprove = roleMode === "center" && isCenterOwned;
  const canFactoryApprove = isFactoryOwnedByUser;
  const targetActionLabel = isFactorySubmittingToCenter
    ? "Submit"
    : "+ Add";

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
    try {
      await updateEnrollmentStatus(enrollmentId, { action: "reject" });
      await reloadEnrollments();
    } catch (error) {
      console.error("Failed to reject candidate", error);
      setActionMessage("Failed to reject candidate.");
    }
  };

  const handleCancelEnrollment = async (enrollmentId: string) => {
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
              readEmployeeMasterData(),
              readMasterCollection(
                TRAINING_MASTER_KEYS.positions,
                defaultPositionRows,
              ),
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
              setSelectedCourseGroupId(event.target.value);
              setSelectedCourseId("");
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
        </div>
        <div className={styles.ruleRow}>
          <span>Function: {selectedCourse.targetFunctionName}</span>
          <span>Position: {selectedCourse.targetPositions.join(", ")}</span>
          <span>Level: {selectedCourse.targetLevels.join(", ")}</span>
          <span>Company: {selectedCourse.companies.join(", ")}</span>
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
                <span>Action</span>
                <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                  <span>Employee ID</span>
                  <span>Prefix</span>
                  <span>First Name</span>
                  <span>Last Name</span>
                  <span>Company</span>
                  <span>Function</span>
                  <span>Department</span>
                  <span>Position / Level</span>
                </div>
              </div>
            ) : null}
            {acceptedParticipants.map((participant) => {
              const nameProfile = getEmployeeNameProfile({ name: participant.employeeName });

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
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{participant.employeeCode}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.prefix}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.firstName}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.lastName}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{participant.company}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={getEmployeeFunctionDisplay(participant)}>
                      {getEmployeeFunctionDisplay(participant)}
                    </span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={participant.department || "-"}>
                      {participant.department || "-"}
                    </span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>
                      {getEmployeePositionLevelDisplay(participant)}
                    </span>
                  </div>
                </article>
              );
            })}
            {acceptedParticipants.length === 0 ? (
              <div className={styles.emptyCompact}>No approved participants yet.</div>
            ) : null}
          </div>
        </section>

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
            {targetEmployeeGroups.map((group) => (
              <details
                className={styles.companyGroupCard}
                key={group.company}
                open
              >
                <summary className={styles.companyGroupHeader}>
                  <div>
                    <strong>{group.company}</strong>
                    <span>
                      {group.employees.length} available / {group.targetCount} target
                    </span>
                  </div>
                </summary>
                <div className={styles.dropdownScroll}>
                  <div className={styles.relatedPeopleGrid}>
                    <div className={`${styles.targetEmployeeHeader} ${styles.targetListHeader}`}>
                      <span>Action</span>
                      <div className={`${styles.targetEmployeeLine} ${styles.targetListLine}`}>
                        <span>Employee ID</span>
                        <span>Prefix</span>
                        <span>First Name</span>
                        <span>Last Name</span>
                        <span>Company</span>
                        <span>Function</span>
                        <span>Department</span>
                        <span>Position / Level</span>
                      </div>
                    </div>
                    {group.employees.map((employee) => {
                      const nameProfile = getEmployeeNameProfile(employee);

                      return (
                        <article className={`${styles.employeeRow} ${styles.targetListRow}`} key={employee.id}>
                          <button
                            className={styles.addTargetButton}
                            type="button"
                            onClick={() => void handleAddEmployee(employee)}
                          >
                            {targetActionLabel}
                          </button>
                          <div className={`${styles.targetEmployeeLine} ${styles.targetListLine}`}>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{employee.employeeCode}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{nameProfile.prefix}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{nameProfile.firstName}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{nameProfile.lastName}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{employee.company}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={getEmployeeFunctionDisplay(employee)}>
                              {getEmployeeFunctionDisplay(employee)}
                            </span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`} title={employee.department || "-"}>
                              {employee.department || "-"}
                            </span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>
                              {getEmployeePositionLevelDisplay(employee)}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                    {group.employees.length === 0 ? (
                      <div className={styles.emptyCompact}>No employees shown for this company.</div>
                    ) : null}
                  </div>
                </div>
              </details>
            ))}
            {availableTargetEmployees.length === 0 ? (
              <div className={styles.emptyCompact}>
                No remaining Course Standard target employees.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className={styles.targetPanel}>
        <div className={styles.workspaceHeader}>
          <div>
            <p className={styles.kicker}>Out-of-target group</p>
            <h3>Add employees outside the target group</h3>
          </div>
          <span>{additionalEmployees.length} available</span>
        </div>
        <p className={styles.targetRuleNote}>
          💡 Select a company below to view and add employees who do not match the Course Standard position and level.
        </p>
        <div className={styles.companyGroupGrid}>
          {additionalEmployeeGroups.map((group) => (
            <details
              className={`${styles.companyGroupCard} ${styles.additionalDisclosure}`}
              key={group.company}
            >
              <summary className={styles.companyGroupHeader}>
                <div>
                  <strong>{group.company}</strong>
                  <span>{group.employees.length} available</span>
                </div>
              </summary>
              <div className={styles.dropdownScroll}>
                <div className={styles.relatedPeopleGrid}>
                  <div
                    className={`${styles.targetEmployeeHeader} ${styles.targetListHeader}`}
                  >
                    <span>Action</span>
                    <div
                      className={`${styles.targetEmployeeLine} ${styles.targetListLine}`}
                    >
                      <span>Employee ID</span>
                      <span>Prefix</span>
                      <span>First Name</span>
                      <span>Last Name</span>
                      <span>Company</span>
                      <span>Function</span>
                      <span>Department</span>
                      <span>Position / Level</span>
                    </div>
                  </div>
                  {group.employees.map((employee) => {
                    const nameProfile = getEmployeeNameProfile(employee);

                    return (
                      <article
                        className={`${styles.employeeRow} ${styles.targetListRow}`}
                        key={employee.id}
                      >
                        <button
                          className={styles.addTargetButton}
                          type="button"
                          onClick={() => void handleAddEmployee(employee)}
                        >
                          {targetActionLabel}
                        </button>
                        <div
                          className={`${styles.targetEmployeeLine} ${styles.targetListLine}`}
                        >
                          <span
                            className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}
                          >
                            {employee.employeeCode}
                          </span>
                          <span
                            className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}
                          >
                            {nameProfile.prefix}
                          </span>
                          <span
                            className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}
                          >
                            {nameProfile.firstName}
                          </span>
                          <span
                            className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}
                          >
                            {nameProfile.lastName}
                          </span>
                          <span
                            className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}
                          >
                            {employee.company}
                          </span>
                          <span
                            className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}
                            title={getEmployeeFunctionDisplay(employee)}
                          >
                            {getEmployeeFunctionDisplay(employee)}
                          </span>
                          <span
                            className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}
                            title={employee.department || "-"}
                          >
                            {employee.department || "-"}
                          </span>
                          <span
                            className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}
                          >
                            {getEmployeePositionLevelDisplay(employee)}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                  {group.employees.length === 0 ? (
                    <div className={styles.emptyCompact}>No additional employees for this company.</div>
                  ) : null}
                </div>
              </div>
            </details>
          ))}
          {additionalEmployees.length === 0 ? (
            <div className={styles.emptyCompact}>
              No additional employees are available.
            </div>
          ) : null}
        </div>
      </section>

      {isFactorySubmittingToCenter ? (
        <section className={styles.submittedPanel}>
          <div className={styles.workspaceHeader}>
            <div>
              <p className={styles.kicker}>Submitted to Center</p>
              <h3>Factory submitted target employees</h3>
            </div>
            <div className={styles.participantActions}>
              <span>{submittedToCenterCandidates.length} submitted</span>
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
                <span>Action</span>
                <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                  <span>Employee ID</span>
                  <span>Prefix</span>
                  <span>First Name</span>
                  <span>Last Name</span>
                  <span>Company</span>
                  <span>Function</span>
                  <span>Department</span>
                  <span>Position / Level</span>
                </div>
              </div>
            ) : null}
            {submittedToCenterCandidates.map((candidate) => {
              const nameProfile = getEmployeeNameProfile({ name: candidate.employeeName });

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
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{candidate.employeeCode}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.prefix}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.firstName}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.lastName}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{candidate.company}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={getEmployeeFunctionDisplay(candidate)}>
                      {getEmployeeFunctionDisplay(candidate)}
                    </span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`} title={candidate.department || "-"}>
                      {candidate.department || "-"}
                    </span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>
                      {getEmployeePositionLevelDisplay(candidate)}
                    </span>
                  </div>
                </article>
              );
            })}
            {submittedToCenterCandidates.length === 0 ? (
              <div className={styles.emptyCompact}>No employees submitted to Center yet.</div>
            ) : null}
          </div>
        </section>
      ) : null}

      {canShowAcceptanceList ? (
      <section className={styles.workspace}>
        <div className={styles.workspaceHeader}>
          <div>
            <p className={styles.kicker}>{roleMode === "center" ? "Candidate approval" : "Factory course applicants"}</p>
            <h3>{roleMode === "center" ? "Employee acceptance list" : "Factory acceptance list"}</h3>
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
                const canApprove =
                  (canCenterApprove && candidate.status === "Pending Approval") ||
                  (canFactoryApprove && candidate.status === "Pending Approval");

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
                        {roleMode === "center" ? "Approve" : "Accept"}
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
              <strong>{roleMode === "center" ? "No factory submissions" : "No applicants"}</strong>
              <span>
                {roleMode === "center"
                  ? "Factory submitted employees will appear here before they become training participants."
                  : "Submitted employees for this factory-owned course will appear here before acceptance."}
              </span>
            </div>
          ) : null}
        </div>
      </section>
      ) : null}
        </>
      ) : (
        <section className={styles.selectionPrompt}>
          <strong>Select a course first to show training actual details.</strong>
        </section>
      )}
    </section>
  );
}
