"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TRAINING_MASTER_EVENT,
  TRAINING_MASTER_KEYS,
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  readMasterCollection,
  readWorkflowCollection,
  writeWorkflowCollection,
  type WorkflowAcceptance,
  type WorkflowCompletedCourse,
  type WorkflowRegistration,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import {
  normalizeEmployeeLevel,
  readEmployeeMasterData,
  type EmployeeMasterRecord,
} from "../../../../lib/employeeMasterData";
import {
  getAttendanceSheetFileName,
  localizeAndSortAttendanceParticipants,
} from "../../../../lib/attendanceSheetExport";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import {
  getRollingPlanCompanies,
  type RollingPlan,
} from "./TrainingRolling";
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
type CandidateStatus =
  | "Pending Approval"
  | "Target"
  | "Factory Submitted"
  | "Factory Approved"
  | "Center Approved"
  | "Rejected";
type CandidateSource =
  | "Employee Registration"
  | "Auto Target"
  | "Added by Center"
  | "Submitted by Factory";

type CourseSurvey = {
  id: string;
  groupId?: string;
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

type Employee = {
  id: string;
  name: string;
  company: string;
  departmentCode?: string;
  department: string;
  position: string;
  level: string;
  legacyLabel: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
};

type Candidate = WorkflowAcceptance;

const companies = ["ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

const employeeNameProfiles: Record<string, { prefix: string; firstName: string; lastName: string }> = {
  "ATA-1001": { prefix: "Mr.", firstName: "Anan", lastName: "Sukprasert" },
  "ATA-1002": { prefix: "Ms.", firstName: "Mali", lastName: "Kittisak" },
  "ATA-1003": { prefix: "Mr.", firstName: "Pattarapon", lastName: "Lertpanya" },
  "ATFB-2101": { prefix: "Mr.", firstName: "Somchai", lastName: "Phromdee" },
  "ATFB-2102": { prefix: "Mr.", firstName: "Narin", lastName: "Thongchai" },
  "ATFB-2103": { prefix: "Ms.", firstName: "Orasa", lastName: "Jantawong" },
  "NIC-3201": { prefix: "Ms.", firstName: "Kanda", lastName: "Rattanakul" },
  "NIC-3202": { prefix: "Mr.", firstName: "Preecha", lastName: "Wongsa" },
  "NIC-3203": { prefix: "Ms.", firstName: "Sirilak", lastName: "Dechapong" },
  "SATI-4301": { prefix: "Ms.", firstName: "Wipada", lastName: "Chansiri" },
  "SATI-4302": { prefix: "Mr.", firstName: "Chaiwat", lastName: "Nanthawong" },
  "SATI-4303": { prefix: "Ms.", firstName: "Nattida", lastName: "Vichai" },
  "SNF-5401": { prefix: "Ms.", firstName: "Suda", lastName: "Maneerat" },
  "SNF-5402": { prefix: "Mr.", firstName: "Krit", lastName: "Akarapong" },
  "SNF-5403": { prefix: "Mr.", firstName: "Warit", lastName: "Hiranyasak" },
  "TEP-6501": { prefix: "Ms.", firstName: "Benjamas", lastName: "Yodmanee" },
  "TEP-6502": { prefix: "Mr.", firstName: "Thanakorn", lastName: "Boonmee" },
  "TEP-6503": { prefix: "Ms.", firstName: "Phimchanok", lastName: "Ekkarat" },
  "ATA-1004": { prefix: "Mr.", firstName: "Ratchanon", lastName: "Pornsawat" },
  "ATFB-2104": { prefix: "Ms.", firstName: "Pawinee", lastName: "Srisuwan" },
  "NIC-3204": { prefix: "Mr.", firstName: "Thitiwat", lastName: "Kongkaew" },
  "SATI-4304": { prefix: "Ms.", firstName: "Areewan", lastName: "Fuangfa" },
  "SNF-5404": { prefix: "Mr.", firstName: "Jirawat", lastName: "Ongart" },
  "TEP-6504": { prefix: "Ms.", firstName: "Kanokwan", lastName: "Udomsin" },
  "ATA-1005": { prefix: "Mr.", firstName: "Saran", lastName: "Meechai" },
  "ATFB-2105": { prefix: "Ms.", firstName: "Duangkamol", lastName: "Ruangrit" },
  "NIC-3205": { prefix: "Mr.", firstName: "Pongsakorn", lastName: "Intaraporn" },
  "SNF-5405": { prefix: "Ms.", firstName: "Nicha", lastName: "Limsakul" },
};

const legacyCourseSurveys: CourseSurvey[] = [
  {
    id: "survey-001",
    code: "CRS-001",
    title: "Leadership Essentials",
    owner: "center",
    ownerCompany: "HRD Center",
    date: "2026-08-15",
    capacity: 30,
    courseType: "IN-HOUSE",
    courseGroup: "Management",
    objective: "Develop leadership capability for supervisors and team leaders.",
    standardName: "Management supervisor standard",
    targetFunctionCode: "",
    targetFunctionName: "All Function",
    targetPositions: ["Supervisor", "Section Head"],
    targetLevels: ["L3", "L4"],
    companies: [...companies],
  },
  {
    id: "survey-002",
    code: "CRS-022",
    title: "Safety Basics",
    owner: "factory",
    ownerCompany: "SNF",
    date: "2026-07-08",
    capacity: 40,
    courseType: "ATA-TC",
    courseGroup: "Safety",
    objective: "Ensure employees understand workplace safety rules and daily safety behavior.",
    standardName: "Safety operator standard",
    targetFunctionCode: "",
    targetFunctionName: "All Function",
    targetPositions: ["Operator", "Technician"],
    targetLevels: ["L1", "L2"],
    companies: ["SNF", "TEP"],
  },
  {
    id: "survey-003",
    code: "CRS-041",
    title: "Quality Control Basics",
    owner: "center",
    ownerCompany: "HRD Center",
    date: "2026-09-10",
    capacity: 24,
    courseType: "PUBLIC",
    courseGroup: "Quality",
    objective: "Build basic quality control understanding for production and quality teams.",
    standardName: "Quality technical standard",
    targetFunctionCode: "",
    targetFunctionName: "All Function",
    targetPositions: ["Engineer", "Supervisor"],
    targetLevels: ["L2", "L3"],
    companies: ["ATA", "ATFB", "NIC", "SATI"],
  },
];

const employees: Employee[] = [
  { id: "ATA-1001", name: "Anan S.", company: "ATA", department: "Production", position: "Supervisor", level: "L3", legacyLabel: "SV-A" },
  { id: "ATA-1002", name: "Mali K.", company: "ATA", department: "Quality", position: "Engineer", level: "L2", legacyLabel: "QE-B" },
  { id: "ATA-1003", name: "Pattarapon L.", company: "ATA", department: "Assembly", position: "Section Head", level: "L4", legacyLabel: "SH-A" },
  { id: "ATFB-2101", name: "Somchai P.", company: "ATFB", department: "Production", position: "Section Head", level: "L4", legacyLabel: "SH-A" },
  { id: "ATFB-2102", name: "Narin T.", company: "ATFB", department: "Maintenance", position: "Technician", level: "L2", legacyLabel: "MT-B" },
  { id: "ATFB-2103", name: "Orasa J.", company: "ATFB", department: "Casting", position: "Supervisor", level: "L3", legacyLabel: "SV-C" },
  { id: "NIC-3201", name: "Kanda R.", company: "NIC", department: "Quality", position: "Supervisor", level: "L3", legacyLabel: "SV-Q" },
  { id: "NIC-3202", name: "Preecha W.", company: "NIC", department: "Production", position: "Operator", level: "L1", legacyLabel: "OP-C" },
  { id: "NIC-3203", name: "Sirilak D.", company: "NIC", department: "Warehouse", position: "Section Head", level: "L4", legacyLabel: "SH-N" },
  { id: "SATI-4301", name: "Wipada C.", company: "SATI", department: "Engineering", position: "Engineer", level: "L3", legacyLabel: "EN-A" },
  { id: "SATI-4302", name: "Chaiwat N.", company: "SATI", department: "Production", position: "Supervisor", level: "L4", legacyLabel: "SV-S" },
  { id: "SATI-4303", name: "Nattida V.", company: "SATI", department: "QA", position: "Supervisor", level: "L3", legacyLabel: "SV-Q" },
  { id: "SNF-5401", name: "Suda M.", company: "SNF", department: "Safety", position: "Technician", level: "L2", legacyLabel: "ST-B" },
  { id: "SNF-5402", name: "Krit A.", company: "SNF", department: "Production", position: "Operator", level: "L1", legacyLabel: "OP-S" },
  { id: "SNF-5403", name: "Warit H.", company: "SNF", department: "Production", position: "Supervisor", level: "L3", legacyLabel: "SV-S" },
  { id: "TEP-6501", name: "Benjamas Y.", company: "TEP", department: "Production", position: "Operator", level: "L2", legacyLabel: "OP-T" },
  { id: "TEP-6502", name: "Thanakorn B.", company: "TEP", department: "Engineering", position: "Supervisor", level: "L3", legacyLabel: "SV-T" },
  { id: "TEP-6503", name: "Phimchanok E.", company: "TEP", department: "Process", position: "Section Head", level: "L4", legacyLabel: "SH-T" },
  { id: "ATA-1004", name: "Ratchanon P.", company: "ATA", department: "Maintenance", position: "Technician", level: "L2", legacyLabel: "MT-A" },
  { id: "ATFB-2104", name: "Pawinee S.", company: "ATFB", department: "Quality", position: "Engineer", level: "L3", legacyLabel: "QE-C" },
  { id: "NIC-3204", name: "Thitiwat K.", company: "NIC", department: "Production", position: "Operator", level: "L2", legacyLabel: "OP-N" },
  { id: "SATI-4304", name: "Areewan F.", company: "SATI", department: "Casting", position: "Section Head", level: "L4", legacyLabel: "SH-S" },
  { id: "SNF-5404", name: "Jirawat O.", company: "SNF", department: "Engineering", position: "Engineer", level: "L2", legacyLabel: "EN-S" },
  { id: "TEP-6504", name: "Kanokwan U.", company: "TEP", department: "Quality", position: "Supervisor", level: "L4", legacyLabel: "SV-Q" },
  { id: "ATA-1005", name: "Saran M.", company: "ATA", department: "Production", position: "Operator", level: "L1", legacyLabel: "OP-A" },
  { id: "ATFB-2105", name: "Duangkamol R.", company: "ATFB", department: "HR", position: "Staff", level: "L1", legacyLabel: "STF-B" },
  { id: "NIC-3205", name: "Pongsakorn I.", company: "NIC", department: "Safety", position: "Technician", level: "L2", legacyLabel: "ST-N" },
  { id: "SNF-5405", name: "Nicha L.", company: "SNF", department: "Production", position: "Section Head", level: "L3", legacyLabel: "SH-S" },
];

const initialCandidates: Candidate[] = [
  {
    ...employees[0],
    courseId: "survey-001",
    source: "Auto Target",
    status: "Target",
    remark: "Position and level matched Course Standard.",
  },
  {
    ...employees[2],
    courseId: "survey-001",
    source: "Auto Target",
    status: "Factory Submitted",
    remark: "Factory nominated for leadership batch.",
  },
  {
    ...employees[4],
    courseId: "survey-001",
    source: "Submitted by Factory",
    status: "Factory Approved",
    remark: "Factory manager approved before center review.",
  },
  {
    ...employees[8],
    courseId: "survey-002",
    source: "Auto Target",
    status: "Factory Approved",
    remark: "Safety course owner is SNF factory.",
  },
  {
    ...employees[12],
    courseId: "survey-002",
    source: "Submitted by Factory",
    status: "Factory Submitted",
    remark: "Employee submitted for SNF factory-owned course.",
  },
  {
    ...employees[9],
    courseId: "survey-002",
    source: "Submitted by Factory",
    status: "Center Approved",
    remark: "Confirmed seat for Safety Basics.",
  },
];

const statusClass: Record<CandidateStatus, string> = {
  "Pending Approval": styles.statusTarget,
  Target: styles.statusTarget,
  "Factory Submitted": styles.statusSubmitted,
  "Factory Approved": styles.statusFactoryApproved,
  "Center Approved": styles.statusCenterApproved,
  Rejected: styles.statusRejected,
};

const sourceClass: Record<CandidateSource, string> = {
  "Employee Registration": styles.sourceAuto,
  "Auto Target": styles.sourceAuto,
  "Added by Center": styles.sourceCenter,
  "Submitted by Factory": styles.sourceFactory,
};

const mergeRegistrationCandidates = (
  savedCandidates: Candidate[],
  registrations: WorkflowRegistration[],
) => {
  const activeRegistrationKeys = new Set(
    registrations.map(
      (registration) => `${registration.rollingId}:${registration.employeeCode}`,
    ),
  );
  const nextCandidates = savedCandidates.filter(
    (candidate) =>
      candidate.source !== "Employee Registration" ||
      candidate.status !== "Pending Approval" ||
      activeRegistrationKeys.has(`${candidate.courseId}:${candidate.id}`),
  );

  registrations.forEach((registration) => {
    const exists = nextCandidates.some(
      (candidate) =>
        candidate.courseId === registration.rollingId &&
        candidate.id === registration.employeeCode,
    );

    if (!exists) {
      nextCandidates.push({
        id: registration.employeeCode,
        name: registration.employeeName,
        company: registration.company,
        department: registration.department,
        position: registration.position || "-",
        level: registration.level || "-",
        legacyLabel: "Registered",
        courseId: registration.rollingId,
        source: "Employee Registration",
        status: "Pending Approval",
        remark: "Employee registered from Register Training.",
      });
    }
  });

  return nextCandidates;
};

const toSurveyEmployee = (employee: EmployeeMasterRecord): Employee => ({
  id: employee.empCode,
  name:
    [employee.nameEn, employee.surnameEn].filter(Boolean).join(" ") ||
    [employee.nameTh, employee.surnameTh].filter(Boolean).join(" "),
  company: employee.company,
  departmentCode: employee.functionCode,
  department: employee.functionName || "-",
  position: employee.positionName || "-",
  level: normalizeEmployeeLevel(employee.levelKey) || "-",
  legacyLabel: [employee.positionName, employee.levelKey].filter(Boolean).join(" / "),
  prefix: employee.titleEn || "-",
  firstName: employee.nameEn || employee.nameTh,
  lastName: employee.surnameEn || employee.surnameTh,
});

const readSurveyEmployees = () => readEmployeeMasterData().map(toSurveyEmployee);

const getEmployeeNameProfile = (employee: Employee) => {
  if (employee.firstName || employee.lastName) {
    return {
      prefix: employee.prefix || "-",
      firstName: employee.firstName || employee.name,
      lastName: employee.lastName || "-",
    };
  }

  const nameParts = employee.name.trim().split(/\s+/);
  return {
    prefix: "-",
    firstName: nameParts[0] || employee.name,
    lastName: nameParts.slice(1).join(" ") || "-",
  };
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
    roleMode,
  );
  const [selectedCourseGroupId, setSelectedCourseGroupId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>(() =>
    readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
  );
  const [completedCourses, setCompletedCourses] = useState<WorkflowCompletedCourse[]>(() =>
    readWorkflowCollection<WorkflowCompletedCourse>(TRAINING_WORKFLOW_KEYS.completedCourses),
  );
  const [standards, setStandards] = useState<WorkflowStandard[]>(() =>
    readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards),
  );
  const [masterEmployees, setMasterEmployees] = useState<Employee[]>(
    readSurveyEmployees,
  );
  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    mergeRegistrationCandidates(
      readWorkflowCollection<Candidate>(TRAINING_WORKFLOW_KEYS.acceptances),
      readWorkflowCollection<WorkflowRegistration>(
        TRAINING_WORKFLOW_KEYS.registrations,
      ),
    ),
  );
  const [hasUnsavedParticipants, setHasUnsavedParticipants] = useState(false);
  const [participantSaveMessage, setParticipantSaveMessage] = useState<string | null>(null);
  const [isExportingAttendance, setIsExportingAttendance] = useState(false);

  useEffect(() => {
    const syncWorkflow = () => {
      const nextRegistrations = readWorkflowCollection<WorkflowRegistration>(
        TRAINING_WORKFLOW_KEYS.registrations,
      );
      const savedCandidates = readWorkflowCollection<Candidate>(
        TRAINING_WORKFLOW_KEYS.acceptances,
      );
      setRollingPlans(
        readWorkflowCollection<RollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
      );
      setCompletedCourses(
        readWorkflowCollection<WorkflowCompletedCourse>(TRAINING_WORKFLOW_KEYS.completedCourses),
      );
      setStandards(
        readWorkflowCollection<WorkflowStandard>(TRAINING_WORKFLOW_KEYS.standards),
      );
      setCandidates((current) =>
        mergeRegistrationCandidates(
          savedCandidates.concat(
            current.filter(
              (candidate) =>
                !savedCandidates.some(
                  (savedCandidate) =>
                    savedCandidate.courseId === candidate.courseId &&
                    savedCandidate.id === candidate.id,
                ),
            ),
          ),
          nextRegistrations,
        ),
      );
    };

    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncWorkflow);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncWorkflow);
  }, []);

  useEffect(() => {
    const syncEmployeeMaster = () => setMasterEmployees(readSurveyEmployees());

    window.addEventListener(TRAINING_MASTER_EVENT, syncEmployeeMaster);
    window.addEventListener("storage", syncEmployeeMaster);
    return () => {
      window.removeEventListener(TRAINING_MASTER_EVENT, syncEmployeeMaster);
      window.removeEventListener("storage", syncEmployeeMaster);
    };
  }, []);

  const completedRollingIds = useMemo(
    () => new Set(completedCourses.map((c) => c.rollingId).filter(Boolean)),
    [completedCourses],
  );

  const courseSurveys = useMemo<CourseSurvey[]>(
    () =>
      rollingPlans
        .filter((plan) => plan.status === "Planned" && !completedRollingIds.has(plan.rollingId))
        .map((plan) => {
          const standard = standards.find(
            (item) => item.courseCode === plan.course.code,
          );
          const isCenterPlan =
            plan.ownerScope === "CENTER" ||
            plan.ownerCompany === "HRD Center" ||
            plan.provider === "HRD Center" ||
            plan.owner === "admin.hrd";

          return {
            id: plan.rollingId,
            groupId:
              plan.scheduleGroupId ??
              `legacy-${plan.id}-${plan.course.code}-${getRollingPlanCompanies(plan).join("-")}`,
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
      const groupId =
        session.groupId ??
        `legacy-${session.code}-${session.ownerCompany}-${session.companies.join("-")}`;
      groups.set(groupId, [...(groups.get(groupId) ?? []), session]);
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
  const matchesCourseTarget = (employee: Employee) =>
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

  const courseCandidates = selectedCourse
    ? candidates.filter((candidate) => candidate.courseId === selectedCourse.id)
    : [];
  const acceptedParticipants = courseCandidates.filter(
    (candidate) =>
      selectedCourse !== null &&
      (roleMode === "factory" ? candidate.company === userCompanyCode : true) &&
      (selectedCourse.owner === "factory"
        ? candidate.status === "Factory Approved"
        : candidate.status === "Center Approved"),
  );
  const activeCourseCandidateIds = new Set(
    courseCandidates
      .filter((candidate) =>
        ["Pending Approval", "Factory Submitted", "Factory Approved", "Center Approved"].includes(candidate.status),
      )
      .map((candidate) => candidate.id),
  );
  const availableEmployees = masterEmployees.filter(
    (employee) =>
      accessibleCompanies.includes(employee.company) &&
      !activeCourseCandidateIds.has(employee.id),
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
      ? courseCandidates.filter(
          (candidate) =>
            candidate.status !== "Center Approved" &&
            candidate.status !== "Rejected" &&
            candidate.status !== "Target",
        )
      : isFactoryOwnedByUser
        ? courseCandidates.filter(
            (candidate) =>
              candidate.company === userCompanyCode &&
              candidate.status !== "Factory Approved" &&
              candidate.status !== "Center Approved",
          )
        : [];

  const approvalQueue = visibleCandidates.filter((candidate) =>
    roleMode === "center"
      ? candidate.status === "Pending Approval" ||
        candidate.status === "Factory Approved" ||
        candidate.status === "Factory Submitted"
      : isFactoryOwnedByUser &&
        candidate.company === userCompanyCode &&
        (candidate.status === "Pending Approval" ||
          candidate.status === "Target" ||
          candidate.status === "Factory Submitted"),
  );
  const submittedToCenterCandidates = isFactorySubmittingToCenter
    ? courseCandidates.filter(
        (candidate) =>
          candidate.company === userCompanyCode &&
          candidate.source === "Submitted by Factory" &&
          (candidate.status === "Factory Submitted" || candidate.status === "Factory Approved"),
      )
    : [];

  const isCenterOwned = selectedCourse?.owner === "center";
  const canCenterApprove = roleMode === "center" && isCenterOwned;
  const canFactoryApprove = isFactoryOwnedByUser;
  const targetActionLabel = isFactorySubmittingToCenter
    ? "Submit"
    : isFactoryOwnedByUser
      ? "+ Add"
      : "+ Add";

  const markParticipantsChanged = () => {
    setHasUnsavedParticipants(true);
    setParticipantSaveMessage(null);
  };

  const updateCandidateStatus = (employeeId: string, status: CandidateStatus) => {
    if (!selectedCourse) {
      return;
    }

    markParticipantsChanged();
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.courseId === selectedCourse.id && candidate.id === employeeId
          ? { ...candidate, status }
          : candidate,
      ),
    );
  };

  const handleAddEmployee = (employee: Employee) => {
    if (!selectedCourse) {
      return;
    }

    markParticipantsChanged();
    const nextStatus: CandidateStatus =
      roleMode === "center"
        ? "Center Approved"
        : isFactoryOwnedByUser
          ? "Factory Approved"
          : "Factory Submitted";
    const nextSource: CandidateSource =
      roleMode === "center" ? "Added by Center" : "Submitted by Factory";
    const isTargetMatch = matchesCourseTarget(employee);
    const nextRemark =
      roleMode === "center"
        ? isTargetMatch
          ? "Added from Course Standard target."
          : "Manually added outside Course Standard target."
        : isFactoryOwnedByUser
          ? isTargetMatch
            ? "Accepted Course Standard target by factory."
            : "Manually accepted outside Course Standard target by factory."
          : isTargetMatch
            ? "Submitted Course Standard target for center approval."
            : "Manually submitted outside Course Standard target for center approval.";

    setCandidates((current) => {
      const existingCandidate = current.some(
        (candidate) => candidate.courseId === selectedCourse.id && candidate.id === employee.id,
      );

      if (existingCandidate) {
        return current.map((candidate) =>
          candidate.courseId === selectedCourse.id && candidate.id === employee.id
            ? { ...candidate, status: nextStatus, source: nextSource, remark: nextRemark }
            : candidate,
        );
      }

      return [
        {
          ...employee,
          courseId: selectedCourse.id,
          source: nextSource,
          status: nextStatus,
          remark: nextRemark,
        },
        ...current,
      ];
    });
  };

  const handleWithdrawParticipant = (employeeId: string) => {
    if (!selectedCourse) {
      return;
    }

    markParticipantsChanged();
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.courseId === selectedCourse.id && candidate.id === employeeId
          ? { ...candidate, status: "Target", remark: "Withdrawn from training participants." }
          : candidate,
      ),
    );
  };

  const handleRemoveSubmittedEmployee = (employeeId: string) => {
    if (!selectedCourse) {
      return;
    }

    markParticipantsChanged();
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.courseId === selectedCourse.id && candidate.id === employeeId
          ? { ...candidate, status: "Target", remark: "Removed from factory submission." }
          : candidate,
      ),
    );
  };

  const handleSaveParticipants = () => {
    try {
      writeWorkflowCollection(TRAINING_WORKFLOW_KEYS.acceptances, candidates);
      setHasUnsavedParticipants(false);
      setParticipantSaveMessage("Changes saved.");
    } catch {
      setParticipantSaveMessage("Unable to save participants.");
    }
  };

  const handleExportAttendanceSheet = async () => {
    if (
      !selectedCourse ||
      hasUnsavedParticipants ||
      acceptedParticipants.length === 0
    ) {
      return;
    }

    setIsExportingAttendance(true);
    setParticipantSaveMessage(null);

    try {
      const response = await fetch(
        "/api/training-accept-survey/attendance-sheet",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course: selectedCourse,
            participants: localizeAndSortAttendanceParticipants(
              acceptedParticipants,
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
      setParticipantSaveMessage("Attendance sheet exported from the v2 template.");
    } catch (error) {
      setParticipantSaveMessage(
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
              setParticipantSaveMessage(null);
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
              setParticipantSaveMessage(null);
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
              setParticipantSaveMessage(null);
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
                className={styles.saveParticipantsButton}
                type="button"
                disabled={!hasUnsavedParticipants}
                onClick={handleSaveParticipants}
              >
                Save
              </button>
              <button
                className={styles.exportAttendanceButton}
                type="button"
                disabled={
                  hasUnsavedParticipants ||
                  acceptedParticipants.length === 0 ||
                  isExportingAttendance
                }
                title={
                  hasUnsavedParticipants
                    ? "Save participant list before exporting."
                    : acceptedParticipants.length === 0
                      ? "Add and save at least one participant before exporting."
                      : "Export participant list to Excel"
                }
                onClick={() => void handleExportAttendanceSheet()}
              >
                {isExportingAttendance
                  ? "Preparing Excel..."
                  : "Export Excel"}
              </button>
            </div>
          </div>
          {participantSaveMessage || hasUnsavedParticipants ? (
            <p className={hasUnsavedParticipants ? styles.unsavedState : styles.savedState} role="status">
              {hasUnsavedParticipants ? "Unsaved changes" : participantSaveMessage}
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
                  <span>Department</span>
                </div>
              </div>
            ) : null}
            {acceptedParticipants.map((participant) => {
              const nameProfile = getEmployeeNameProfile(participant);

              return (
                <article className={`${styles.employeeRow} ${styles.participantEmployeeRow}`} key={participant.id}>
                  <button
                    className={styles.withdrawButton}
                    type="button"
                    onClick={() => handleWithdrawParticipant(participant.id)}
                  >
                    Withdraw
                  </button>
                  <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{participant.id}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.prefix}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.firstName}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.lastName}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{participant.company}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{participant.department}</span>
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
                        <span>Department</span>
                      </div>
                    </div>
                    {group.employees.map((employee) => {
                      const nameProfile = getEmployeeNameProfile(employee);

                      return (
                        <article className={`${styles.employeeRow} ${styles.targetListRow}`} key={employee.id}>
                          <button
                            className={styles.addTargetButton}
                            type="button"
                            onClick={() => handleAddEmployee(employee)}
                          >
                            {targetActionLabel}
                          </button>
                          <div className={`${styles.targetEmployeeLine} ${styles.targetListLine}`}>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{employee.id}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{nameProfile.prefix}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{nameProfile.firstName}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{nameProfile.lastName}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{employee.company}</span>
                            <span className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}>{employee.department}</span>
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

      <section className={styles.additionalPanel}>
        <details className={styles.additionalDisclosure}>
          <summary className={styles.additionalSummary}>
            <div>
              <p className={styles.kicker}>Additional employees</p>
              <h3>Add employees outside the target group</h3>
            </div>
            <span>{additionalEmployees.length} available</span>
          </summary>
          <p className={styles.additionalNote}>
            Open this section only when you need to add an employee who does not
            match the Course Standard position and level.
          </p>
          <div className={styles.companyGroupGrid}>
            {additionalEmployeeGroups.map((group) => (
              <details className={styles.companyGroupCard} key={group.company}>
                <summary className={styles.companyGroupHeader}>
                  <div>
                    <strong>{group.company}</strong>
                    <span>{group.employees.length} outside target</span>
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
                        <span>Department</span>
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
                            onClick={() => handleAddEmployee(employee)}
                          >
                            {targetActionLabel}
                          </button>
                          <div
                            className={`${styles.targetEmployeeLine} ${styles.targetListLine}`}
                          >
                            <span
                              className={`${styles.targetEmployeeCell} ${styles.targetListCell}`}
                            >
                              {employee.id}
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
                            >
                              {employee.department}
                            </span>
                          </div>
                        </article>
                      );
                    })}
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
        </details>
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
              <button
                className={styles.saveParticipantsButton}
                type="button"
                disabled={!hasUnsavedParticipants}
                onClick={handleSaveParticipants}
              >
                Save
              </button>
            </div>
          </div>
          {participantSaveMessage || hasUnsavedParticipants ? (
            <p className={hasUnsavedParticipants ? styles.unsavedState : styles.savedState} role="status">
              {hasUnsavedParticipants ? "Unsaved submitted employees" : participantSaveMessage}
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
                  <span>Department</span>
                </div>
              </div>
            ) : null}
            {submittedToCenterCandidates.map((candidate) => {
              const nameProfile = getEmployeeNameProfile(candidate);

              return (
                <article className={`${styles.employeeRow} ${styles.participantEmployeeRow}`} key={candidate.id}>
                  <button
                    className={styles.removeSubmittedButton}
                    type="button"
                    onClick={() => handleRemoveSubmittedEmployee(candidate.id)}
                  >
                    Remove
                  </button>
                  <div className={`${styles.targetEmployeeLine} ${styles.participantEmployeeLine}`}>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{candidate.id}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.prefix}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.firstName}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{nameProfile.lastName}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{candidate.company}</span>
                    <span className={`${styles.targetEmployeeCell} ${styles.participantEmployeeCell}`}>{candidate.department}</span>
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
                const isMatched = matchesCourseTarget(candidate);
                const canApprove =
                  (canCenterApprove &&
                    (candidate.status === "Pending Approval" ||
                      candidate.status === "Factory Approved" ||
                      candidate.status === "Factory Submitted")) ||
                  (canFactoryApprove &&
                    (candidate.status === "Pending Approval" ||
                      candidate.status === "Target" ||
                      candidate.status === "Factory Submitted"));

                return (
                  <tr key={`${candidate.courseId}-${candidate.id}`}>
                    <td>
                      <strong>{candidate.name}</strong>
                      <span>{candidate.id} / {candidate.department}</span>
                    </td>
                    <td>{candidate.company}</td>
                    <td>{candidate.position} / {candidate.level}</td>
                    <td>
                      <span className={isMatched ? styles.matchPill : styles.manualPill}>
                        {isMatched ? "Position + Level" : "Manual add"}
                      </span>
                    </td>
                    <td><span className={`${styles.sourcePill} ${sourceClass[candidate.source]}`}>{candidate.source}</span></td>
                    <td><span className={`${styles.statusPill} ${statusClass[candidate.status]}`}>{candidate.status}</span></td>
                    <td>{candidate.remark}</td>
                    <td className={styles.actionCell}>
                      <button
                        className={styles.approveButton}
                        disabled={!canApprove}
                        type="button"
                        onClick={() =>
                          updateCandidateStatus(
                            candidate.id,
                            roleMode === "center" ? "Center Approved" : "Factory Approved",
                          )
                        }
                      >
                        {roleMode === "center" ? "Approve" : "Accept"}
                      </button>
                      <button
                        className={styles.rejectButton}
                        disabled={candidate.status === "Rejected"}
                        type="button"
                        onClick={() => updateCandidateStatus(candidate.id, "Rejected")}
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
          <p className={styles.kicker}>Published Rolling Course</p>
          <h3>No published Rolling course is available for this owner.</h3>
          <span>Open Training Rolling and click Publish, then the course will appear here automatically.</span>
        </section>
      )}
    </section>
  );
}
