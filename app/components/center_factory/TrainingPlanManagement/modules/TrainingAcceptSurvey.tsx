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
  functionName?: string;
  department: string;
  position: string;
  level: string;
  legacyLabel: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
};

type Candidate = WorkflowAcceptance & {
  functionName?: string;
};

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
  { id: "ATA-1001", name: "อนันต์ ศรีสุข", prefix: "นาย", firstName: "อนันต์", lastName: "ศรีสุข", company: "ATA", department: "Production", position: "Supervisor", level: "L3", legacyLabel: "SV-A" },
  { id: "ATA-1002", name: "มาลี เกษมสุข", prefix: "นางสาว", firstName: "มาลี", lastName: "เกษมสุข", company: "ATA", department: "Quality", position: "Engineer", level: "L2", legacyLabel: "QE-B" },
  { id: "ATA-1003", name: "ภัทรพล เลิศปัญญา", prefix: "นาย", firstName: "ภัทรพล", lastName: "เลิศปัญญา", company: "ATA", department: "Assembly", position: "Section Head", level: "L4", legacyLabel: "SH-A" },
  { id: "ATFB-2101", name: "สมชาย พร้อมใจ", prefix: "นาย", firstName: "สมชาย", lastName: "พร้อมใจ", company: "ATFB", department: "Production", position: "Section Head", level: "L4", legacyLabel: "SH-A" },
  { id: "ATFB-2102", name: "นรินทร์ ทองชัย", prefix: "นาย", firstName: "นรินทร์", lastName: "ทองชัย", company: "ATFB", department: "Maintenance", position: "Technician", level: "L2", legacyLabel: "MT-B" },
  { id: "ATFB-2103", name: "อรสา จันทร์ดี", prefix: "นางสาว", firstName: "อรสา", lastName: "จันทร์ดี", company: "ATFB", department: "Casting", position: "Supervisor", level: "L3", legacyLabel: "SV-C" },
  { id: "ATFB-2111", name: "ปกรณ์ อินแก้ว", prefix: "นาย", firstName: "ปกรณ์", lastName: "อินแก้ว", company: "ATFB", department: "ฝ่ายผลิต", position: "Operator", level: "L1", legacyLabel: "OP-B" },
  { id: "ATFB-2123", name: "รัตนา พิพัทธ์ชัย", prefix: "นาย", firstName: "รัตนา", lastName: "พิพัทธ์ชัย", company: "ATFB", department: "คลังสินค้า", position: "Operator", level: "L1", legacyLabel: "OP-B" },
  { id: "NIC-3201", name: "กานดา รุ่งเรือง", prefix: "นางสาว", firstName: "กานดา", lastName: "รุ่งเรือง", company: "NIC", department: "Quality", position: "Supervisor", level: "L3", legacyLabel: "SV-Q" },
  { id: "NIC-3202", name: "ปรีชา วงศ์สว่าง", prefix: "นาย", firstName: "ปรีชา", lastName: "วงศ์สว่าง", company: "NIC", department: "Production", position: "Operator", level: "L1", legacyLabel: "OP-C" },
  { id: "NIC-3203", name: "ศิริลักษณ์ เดชาพงศ์", prefix: "นางสาว", firstName: "ศิริลักษณ์", lastName: "เดชาพงศ์", company: "NIC", department: "Warehouse", position: "Section Head", level: "L4", legacyLabel: "SH-N" },
  { id: "SATI-4301", name: "วิภาดา ชัยพร", prefix: "นางสาว", firstName: "วิภาดา", lastName: "ชัยพร", company: "SATI", department: "Engineering", position: "Engineer", level: "L3", legacyLabel: "EN-A" },
  { id: "SATI-4302", name: "ชัยวัฒน์ นิลประภา", prefix: "นาย", firstName: "ชัยวัฒน์", lastName: "นิลประภา", company: "SATI", department: "Production", position: "Supervisor", level: "L4", legacyLabel: "SV-S" },
  { id: "SATI-4303", name: "ณัฐธิดา วิชัย", prefix: "นางสาว", firstName: "ณัฐธิดา", lastName: "วิชัย", company: "SATI", department: "QA", position: "Supervisor", level: "L3", legacyLabel: "SV-Q" },
  { id: "SNF-5401", name: "สุดา มั่นคง", prefix: "นางสาว", firstName: "สุดา", lastName: "มั่นคง", company: "SNF", department: "Safety", position: "Technician", level: "L2", legacyLabel: "ST-B" },
  { id: "SNF-5402", name: "กฤต อรุณรุ่ง", prefix: "นาย", firstName: "กฤต", lastName: "อรุณรุ่ง", company: "SNF", department: "Production", position: "Operator", level: "L1", legacyLabel: "OP-S" },
  { id: "SNF-5403", name: "วริศ หิรัญศักดิ์", prefix: "นาย", firstName: "วริศ", lastName: "หิรัญศักดิ์", company: "SNF", department: "Production", position: "Supervisor", level: "L3", legacyLabel: "SV-S" },
  { id: "TEP-6501", name: "เบญจมาศ ยอดมณี", prefix: "นางสาว", firstName: "เบญจมาศ", lastName: "ยอดมณี", company: "TEP", department: "Production", position: "Operator", level: "L2", legacyLabel: "OP-T" },
  { id: "TEP-6502", name: "ธนกร บุญมี", prefix: "นาย", firstName: "ธนกร", lastName: "บุญมี", company: "TEP", department: "Engineering", position: "Supervisor", level: "L3", legacyLabel: "SV-T" },
  { id: "TEP-6503", name: "พิมพ์ชนก เอกรัตน์", prefix: "นางสาว", firstName: "พิมพ์ชนก", lastName: "เอกรัตน์", company: "TEP", department: "Process", position: "Section Head", level: "L4", legacyLabel: "SH-T" },
  { id: "ATA-1004", name: "รัชชานนท์ พรสวัสดิ์", prefix: "นาย", firstName: "รัชชานนท์", lastName: "พรสวัสดิ์", company: "ATA", department: "Maintenance", position: "Technician", level: "L2", legacyLabel: "MT-A" },
  { id: "ATFB-2104", name: "ภาวิณี ศรีสุวรรณ", prefix: "นางสาว", firstName: "ภาวิณี", lastName: "ศรีสุวรรณ", company: "ATFB", department: "Quality", position: "Engineer", level: "L3", legacyLabel: "QE-C" },
  { id: "NIC-3204", name: "ฐิติวัฒน์ คงแก้ว", prefix: "นาย", firstName: "ฐิติวัฒน์", lastName: "คงแก้ว", company: "NIC", department: "Production", position: "Operator", level: "L2", legacyLabel: "OP-N" },
  { id: "SATI-4304", name: "อารีวรรณ เฟื่องฟ้า", prefix: "นางสาว", firstName: "อารีวรรณ", lastName: "เฟื่องฟ้า", company: "SATI", department: "Casting", position: "Section Head", level: "L4", legacyLabel: "SH-S" },
  { id: "SNF-5404", name: "จิรวัฒน์ องอาจ", prefix: "นาย", firstName: "จิรวัฒน์", lastName: "องอาจ", company: "SNF", department: "Engineering", position: "Engineer", level: "L2", legacyLabel: "EN-S" },
  { id: "TEP-6504", name: "กนกวรรณ อุดมสิน", prefix: "นางสาว", firstName: "กนกวรรณ", lastName: "อุดมสิน", company: "TEP", department: "Quality", position: "Supervisor", level: "L4", legacyLabel: "SV-Q" },
  { id: "ATA-1005", name: "ศรัณย์ มีชัย", prefix: "นาย", firstName: "ศรัณย์", lastName: "มีชัย", company: "ATA", department: "Production", position: "Operator", level: "L1", legacyLabel: "OP-A" },
  { id: "ATFB-2105", name: "ดวงกมล เรืองฤทธิ์", prefix: "นางสาว", firstName: "ดวงกมล", lastName: "เรืองฤทธิ์", company: "ATFB", department: "HR", position: "Staff", level: "L1", legacyLabel: "STF-B" },
  { id: "NIC-3205", name: "พงศกร อินทรพร", prefix: "นาย", firstName: "พงศกร", lastName: "อินทรพร", company: "NIC", department: "Safety", position: "Technician", level: "L2", legacyLabel: "ST-N" },
  { id: "SNF-5405", name: "ณิชา ลิ้มสกุล", prefix: "นางสาว", firstName: "ณิชา", lastName: "ลิ้มสกุล", company: "SNF", department: "Production", position: "Section Head", level: "L3", legacyLabel: "SH-S" },
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

const formatThaiPrefix = (titleEn?: string) => {
  if (!titleEn) return "นาย";
  const lower = titleEn.toLowerCase();
  if (lower.includes("ms") || lower.includes("miss")) return "นางสาว";
  if (lower.includes("mrs")) return "นาง";
  return "นาย";
};

const toSurveyEmployee = (employee: EmployeeMasterRecord): Employee => {
  const fName = employee.nameTh || employee.nameEn || "-";
  const lName = employee.surnameTh || employee.surnameEn || "-";
  const prefixTh = formatThaiPrefix(employee.titleEn);
  const fullName = `${fName} ${lName}`.trim();

  return {
    id: employee.empCode,
    name: fullName,
    company: employee.company,
    departmentCode: employee.functionCode,
    functionName: employee.functionName || "-",
    department: employee.department || employee.functionName || "-",
    position: employee.positionName || "-",
    level: normalizeEmployeeLevel(employee.levelKey) || "-",
    legacyLabel: [employee.positionName, employee.levelKey].filter(Boolean).join(" / "),
    prefix: prefixTh,
    firstName: fName,
    lastName: lName,
  };
};

const readSurveyEmployees = () => readEmployeeMasterData().map(toSurveyEmployee);

const getEmployeeNameProfile = (employee: Employee) => {
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

const getEmployeeFunctionDisplay = (emp: { departmentCode?: string; functionName?: string; department?: string }) => {
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
  const [functionRows, setFunctionRows] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.functions, defaultFunctionRows),
  );
  const [positionRows, setPositionRows] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.positions, defaultPositionRows),
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
    const syncEmployeeMaster = () => {
      setMasterEmployees(readSurveyEmployees());
      setFunctionRows(
        readMasterCollection(TRAINING_MASTER_KEYS.functions, defaultFunctionRows),
      );
      setPositionRows(
        readMasterCollection(TRAINING_MASTER_KEYS.positions, defaultPositionRows),
      );
    };

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
            (item) =>
              item.courseCode?.trim().toLowerCase() === plan.course.code?.trim().toLowerCase() ||
              item.courseId?.trim().toLowerCase() === plan.course.code?.trim().toLowerCase() ||
              (plan.id && item.courseId === plan.id),
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
    ) ?? null;
  const availableSessions = selectedCourseGroup?.sessions ?? [];
  const selectedCourse =
    availableSessions.find((course) => course.id === selectedCourseId) ?? null;
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
    const raw = position.trim().toLowerCase();
    const found = positionRows.find(
      (p) =>
        p.positionCode.toLowerCase() === raw ||
        p.positionNameEn.toLowerCase() === raw ||
        p.positionNameTh.toLowerCase() === raw,
    );
    if (found) {
      return found.positionCode.toLowerCase();
    }
    const aliases: Record<string, string> = {
      sh: "sh",
      "section head": "sh",
      "ผู้จัดการแผนก": "sh",
      office: "off",
      officer: "off",
      supervisor: "off",
      "เจ้าหน้าที่": "off",
      "manager up": "mgr",
      "manager++": "mgr",
      manager: "mgr",
      "ผู้จัดการ": "mgr",
      "force man": "fm",
      foreman: "fm",
      "โฟร์แมน": "fm",
      leader: "ld",
      "ลีดเดอร์": "ld",
      engineer: "eng",
      "วิศวกร": "eng",
      staff: "staff",
      "พนักงาน": "staff",
      operator: "op",
      "พนักงานปฏิบัติการ": "op",
    };
    return aliases[raw] ?? raw;
  };

  const matchesCourseTarget = (employee: Employee) => {
    if (!selectedCourse) return false;

    // 1. Function Matching
    const targetFunctionCode = (selectedCourse.targetFunctionCode || "").trim().toUpperCase();
    const targetFunctionName = (selectedCourse.targetFunctionName || "").trim().toLowerCase();

    const isAllFunction =
      !targetFunctionCode ||
      targetFunctionCode === "ALL" ||
      !targetFunctionName ||
      targetFunctionName === "all function" ||
      targetFunctionName === "all" ||
      targetFunctionName.includes("all function") ||
      targetFunctionName.includes("ทุกฝ่าย") ||
      targetFunctionName.includes("ทุก function");

    let matchesFunction = isAllFunction;

    if (!matchesFunction) {
      const empFunctionCode = (employee.departmentCode || "").trim().toUpperCase();
      const empFunctionName = (employee.functionName || employee.department || "").trim().toLowerCase();

      if (targetFunctionCode && empFunctionCode && targetFunctionCode === empFunctionCode) {
        matchesFunction = true;
      } else if (targetFunctionName && empFunctionName && targetFunctionName === empFunctionName) {
        matchesFunction = true;
      } else {
        // Cross-match via functionRows master data
        const matchedFunction = functionRows.find(
          (f) =>
            (targetFunctionCode && f.functionCode.toUpperCase() === targetFunctionCode) ||
            (targetFunctionName &&
              (f.functionNameEn.toLowerCase() === targetFunctionName ||
                f.functionNameTh.toLowerCase() === targetFunctionName ||
                f.functionCode.toLowerCase() === targetFunctionName)),
        );

        if (matchedFunction) {
          const mCode = matchedFunction.functionCode.toUpperCase();
          const mNameEn = matchedFunction.functionNameEn.toLowerCase();
          const mNameTh = matchedFunction.functionNameTh.toLowerCase();

          matchesFunction =
            (Boolean(empFunctionCode) && empFunctionCode === mCode) ||
            (Boolean(empFunctionName) &&
              (empFunctionName === mNameEn ||
                empFunctionName === mNameTh ||
                (Boolean(mNameEn) && empFunctionName.includes(mNameEn)) ||
                (Boolean(mNameTh) && empFunctionName.includes(mNameTh)) ||
                (Boolean(mNameEn) && mNameEn.includes(empFunctionName)) ||
                (Boolean(mNameTh) && mNameTh.includes(empFunctionName))));
        }
      }
    }

    if (!matchesFunction) return false;

    // 2. Position Matching
    const matchesPosition =
      selectedCourse.targetPositions.length === 0 ||
      selectedCourse.targetPositions.some(
        (position) =>
          normalizeTargetPosition(position) ===
          normalizeTargetPosition(employee.position),
      );

    if (!matchesPosition) return false;

    // 3. Level Matching
    const matchesLevel =
      selectedCourse.targetLevels.length === 0 ||
      selectedCourse.targetLevels.some(
        (level) =>
          normalizeEmployeeLevel(level) === normalizeEmployeeLevel(employee.level),
      );

    return matchesLevel;
  };
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

  const exportParticipants = useMemo(() => {
    if (acceptedParticipants.length > 0) {
      return acceptedParticipants;
    }
    return targetEmployees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      company: employee.company,
      department: employee.department,
      position: employee.position,
      prefix: employee.prefix ?? undefined,
      firstName: employee.firstName ?? undefined,
      lastName: employee.lastName ?? undefined,
    }));
  }, [acceptedParticipants, targetEmployees]);

  const handleExportAttendanceSheet = async () => {
    if (!selectedCourse || hasUnsavedParticipants) {
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
              exportParticipants,
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
      setParticipantSaveMessage("Attendance sheet exported from the ATA-F-HD004 v2 template.");
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
                  !selectedCourse ||
                  hasUnsavedParticipants ||
                  isExportingAttendance
                }
                title={
                  !selectedCourse
                    ? "Select a course first to export."
                    : hasUnsavedParticipants
                      ? "Save participant list before exporting."
                      : "Export participant list to Excel (ATA-F-HD004)"
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
                  <span>Function</span>
                  <span>Department</span>
                  <span>Position / Level</span>
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
                  <span>Function</span>
                  <span>Department</span>
                  <span>Position / Level</span>
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
          <strong>Select a course first to show training actual details.</strong>
        </section>
      )}
    </section>
  );
}
