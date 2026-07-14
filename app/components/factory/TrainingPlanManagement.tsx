"use client";

import { useState } from "react";
import Navbar from "../Navbar";
import styles from "./TrainingPlanManagement.module.css";

const planItems = [
  {
    title: "Training OAP",
    subtitle: "แผนประจำปี",
    description: "วางแผนอบรมประจำปี กำหนดหลักสูตร งบประมาณ และผู้รับผิดชอบ",
  },
  {
    title: "Training Rolling",
    subtitle: "แผนประจำเดือน",
    description: "ติดตามแผนอบรมรายเดือน ปรับรอบอบรม และตรวจสอบสถานะล่าสุด",
  },
  {
    title: "Request Training Need",
    subtitle: "คำขอจัดอบรม",
    description: "ตรวจสอบคำร้องขอให้จัดอบรมที่ผ่านการอนุมัติ และให้ HRD Center กดรับเพื่อจัดอบรม",
  },
  {
    title: "Training Accept Survey",
    subtitle: "สำรวจผู้เข้าอบรม",
    description: "สำรวจและจัดการรายชื่อผู้เข้าอบรมของแผนหรือหลักสูตรที่ HRD รับดำเนินการแล้ว",
  },
];

const approvalInbox = [
  {
    course: "Leadership Essentials",
    requestBy: "Operations",
    participants: 24,
    status: "รออนุมัติ",
  },
  {
    course: "Service Mind for Frontline",
    requestBy: "Customer Service",
    participants: 18,
    status: "อบรมไปแล้ว",
  },
  {
    course: "Data Privacy Awareness",
    requestBy: "IT Governance",
    participants: 36,
    status: "รออนุมัติ",
  },
] as const;

const trainingNeedRequests = [
  {
    key: "need-001",
    course: "Data Privacy Awareness",
    requestBy: "IT Governance",
    approvedBy: "Somchai P.",
    participants: 36,
    objective: "อบรมความเข้าใจเรื่องข้อมูลส่วนบุคคลสำหรับทีมที่ดูแลระบบและข้อมูลลูกค้า",
    preferredPeriod: "July 2026",
    status: "Waiting HRD accept",
  },
  {
    key: "need-002",
    course: "Advanced Excel for Planning",
    requestBy: "Production Planning",
    approvedBy: "Naree T.",
    participants: 18,
    objective: "เพิ่มทักษะการวิเคราะห์แผนผลิตและสรุปรายงานประจำสัปดาห์",
    preferredPeriod: "August 2026",
    status: "Waiting HRD accept",
  },
  {
    key: "need-003",
    course: "Service Recovery Workshop",
    requestBy: "Customer Service",
    approvedBy: "Krit S.",
    participants: 22,
    objective: "เตรียมทีมรับมือข้อร้องเรียนและออกแบบแนวทางติดตามผลหลังให้บริการ",
    preferredPeriod: "July 2026",
    status: "Accepted by HRD",
  },
] as const;

const rollingYears = ["2026", "2027"] as const;

const rollingMonths = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const initialRollingTrainings = [
  {
    key: "rolling-2026-07-01",
    year: "2026",
    month: "07",
    courseCode: "ROL-2607-001",
    courseName: "Service Mind for Frontline",
    date: "8 Jul 2026",
    time: "09:00 - 16:00",
    participants: 24,
    trainer: "Maliwan P.",
    room: "Training Room B",
    status: "Confirmed",
    objective: "อบรมทักษะบริการสำหรับทีมที่ต้องประสานงานกับลูกค้าและหน่วยงานภายใน",
    preTest: "Pre-test",
    postTest: "Post-test",
    evaluation: "แบบประเมินหลังอบรม",
    owner: "HRD-FACTORY",
    budget: "฿62,000",
  },
  {
    key: "rolling-2026-07-02",
    year: "2026",
    month: "07",
    courseCode: "ROL-2607-002",
    courseName: "Data Privacy Awareness",
    date: "15 Jul 2026",
    time: "09:30 - 11:30",
    participants: 36,
    trainer: "IT Governance",
    room: "Online",
    status: "Open register",
    objective: "ทบทวนข้อกำหนด PDPA และแนวทางจัดการข้อมูลส่วนบุคคลในการทำงาน",
    preTest: "Pre-test",
    postTest: "Post-test",
    evaluation: "แบบประเมินหลังอบรม",
    owner: "HRD-FACTORY",
    budget: "฿38,500",
  },
  {
    key: "rolling-2026-07-03",
    year: "2026",
    month: "07",
    courseCode: "ROL-2607-003",
    courseName: "Advanced Excel for Planning",
    date: "24 Jul 2026",
    time: "13:00 - 16:30",
    participants: 18,
    trainer: "External trainer",
    room: "Computer Lab",
    status: "Draft",
    objective: "เพิ่มทักษะ Excel สำหรับการวางแผนและการติดตามงานประจำเดือน",
    preTest: "Pre-test",
    postTest: "Post-test",
    evaluation: "แบบประเมินหลังอบรม",
    owner: "HRD-FACTORY",
    budget: "฿45,000",
  },
  {
    key: "rolling-2026-08-01",
    year: "2026",
    month: "08",
    courseCode: "ROL-2608-001",
    courseName: "Leadership Essentials",
    trainingDate: "15 Jul 2026",
    date: "7 Aug 2026",
    time: "09:00 - 16:00",
    participants: 20,
    trainer: "Nattapong K.",
    room: "Training Room A",
    status: "Planned",
    objective: "พัฒนาทักษะหัวหน้างานและการติดตามผลทีม",
    preTest: "Pre-test",
    postTest: "Post-test",
    evaluation: "แบบประเมินหลังอบรม",
    owner: "HRD-FACTORY",
    budget: "฿85,000",
  },
  {
    key: "rolling-2026-08-02",
    year: "2026",
    month: "08",
    courseCode: "ROL-2608-002",
    courseName: "Safety & Compliance Basics",
    date: "21 Aug 2026",
    time: "10:00 - 12:00",
    participants: 42,
    trainer: "Safety Team",
    room: "Auditorium",
    status: "Confirmed",
    objective: "อบรมข้อกำหนดความปลอดภัยพื้นฐานและการปฏิบัติงานตามมาตรฐาน",
    preTest: "Pre-test",
    postTest: "Post-test",
    evaluation: "แบบประเมินหลังอบรม",
    owner: "HRD-FACTORY",
    budget: "฿48,500",
  },
  {
    key: "rolling-2027-01-01",
    year: "2027",
    month: "01",
    courseCode: "ROL-2701-001",
    courseName: "New Year Compliance Refresh",
    date: "14 Jan 2027",
    time: "09:00 - 12:00",
    participants: 48,
    trainer: "Compliance Team",
    room: "Online",
    status: "Planned",
    objective: "ทบทวน compliance ประจำปีสำหรับพนักงานทุกกลุ่ม",
    preTest: "Pre-test",
    postTest: "Post-test",
    evaluation: "แบบประเมินหลังอบรม",
    owner: "HRD-FACTORY",
    budget: "฿52,000",
  },
] as const;

const initialOapCourses = [
  {
    key: "oap-2026-a",
    statusLabel: "Planned",
    courseCode: "OAP-TRN-001",
    courseName: "Leadership Essentials",
    trainingDate: "15 Jul 2026",
    startTime: "09:00",
    endTime: "16:00",
    organizerUnit: "ATA",
    company: "ATFB",
    trainingRound: "รุ่น 1 / 2026",
    trainingStatus: "ยังไม่อบรม",
    courseType: "Mandatory",
    budget: "฿85,000",
    trainer: "Nattapong K.",
    department: "HRD Learning & Development",
    owner: "hrd.admin",
    planDetail:
      "อบรมสำหรับกลุ่มหัวหน้างานใหม่ เน้นทักษะการสื่อสาร การมอบหมายงาน และการติดตามผลทีม",
    preTest: "แบบทดสอบก่อนเรียน 20 ข้อ",
    postTest: "แบบทดสอบหลังเรียน 20 ข้อ",
    evaluation: "แบบประเมินความพึงพอใจและการนำไปใช้",
    targetUsers: [
      { id: "EMP-004", name: "Somchai P.", department: "Operations" },
      { id: "EMP-012", name: "Naree T.", department: "Production" },
      { id: "EMP-028", name: "Maliwan P.", department: "Customer Service" },
      { id: "EMP-041", name: "Thanakorn S.", department: "Quality" },
    ],
  },
  {
    key: "oap-2026-b",
    statusLabel: "รอ confirm",
    courseCode: "OAP-TRN-014",
    courseName: "Service Mind for Frontline",
    trainingDate: "8 Sep 2026",
    startTime: "13:00",
    endTime: "16:30",
    organizerUnit: "ATA",
    company: "SATI",
    trainingRound: "รุ่น 2 / 2026",
    trainingStatus: "ยังไม่อบรม",
    courseType: "Core",
    budget: "฿62,000",
    trainer: "Maliwan P.",
    department: "Corporate Training",
    owner: "sup.001",
    planDetail:
      "อบรมทักษะบริการสำหรับทีมปฏิบัติการที่ต้องประสานงานกับลูกค้าและหน่วยงานภายใน",
    preTest: "Pre-test ด้าน service mindset",
    postTest: "Post-test หลัง workshop",
    evaluation: "แบบประเมินผู้สอน เนื้อหา และกิจกรรม",
    targetUsers: [
      { id: "EMP-017", name: "Krit N.", department: "Sales Support" },
      { id: "EMP-033", name: "Pimchanok R.", department: "Customer Service" },
      { id: "EMP-052", name: "Anucha W.", department: "Warehouse" },
    ],
  },
  {
    key: "oap-2026-c",
    statusLabel: "Planned",
    courseCode: "OAP-TRN-022",
    courseName: "Safety & Compliance Basics",
    trainingDate: "21 Aug 2026",
    startTime: "10:00",
    endTime: "12:00",
    organizerUnit: "ATA",
    company: "SNF",
    trainingRound: "รุ่น 1 / 2026",
    trainingStatus: "อบรมแล้ว",
    courseType: "Compliance",
    budget: "฿48,500",
    trainer: "Workshop Team",
    department: "Safety & Compliance",
    owner: "emp.024",
    planDetail:
      "คอร์สพื้นฐานด้านความปลอดภัยและข้อบังคับองค์กรสำหรับพนักงานใหม่ทุกหน่วยงาน",
    preTest: "แบบทดสอบความรู้พื้นฐานก่อนอบรม",
    postTest: "แบบทดสอบหลังอบรมเพื่อยืนยันความเข้าใจ",
    evaluation: "แบบประเมินหลักสูตร Safety & Compliance",
    targetUsers: [
      { id: "EMP-006", name: "Suda K.", department: "Production" },
      { id: "EMP-019", name: "Worawit C.", department: "Maintenance" },
      { id: "EMP-027", name: "Pitchaya L.", department: "QA" },
      { id: "EMP-030", name: "Narong M.", department: "Logistics" },
    ],
  },
] as const;

const acceptSurveyPlans = [
  {
    key: "oap",
    title: "Training OAP",
    subtitle: "แผนประจำปี",
    detail: "กลุ่มอบรมหลักตามแผนประจำปี",
    courses: [
      {
        key: "course-a",
        title: "Course A",
        year: "2026",
        month: "07",
        date: "15 Jul 2026",
        detail: "คอร์สสำหรับกลุ่มเป้าหมายหลักในรอบ OAP",
        employees: ["hrd.admin", "sup.001", "emp.024", "emp.031"],
      },
      {
        key: "course-b",
        title: "Course B",
        year: "2026",
        month: "07",
        date: "21 Jul 2026",
        detail: "คอร์สเสริมสำหรับกลุ่มที่ต้องเข้าร่วมเพิ่มเติม",
        employees: ["emp.005", "emp.012", "emp.019"],
      },
      {
        key: "course-c",
        title: "Course C",
        year: "2026",
        month: "09",
        date: "8 Sep 2026",
        detail: "คอร์ส OAP สำหรับกลุ่มที่ต้องพัฒนาทักษะบริการ",
        employees: ["emp.004", "emp.009", "emp.017", "emp.022"],
      },
      {
        key: "course-d",
        title: "Course D",
        year: "2027",
        month: "01",
        date: "14 Jan 2027",
        detail: "คอร์ส OAP รอบต้นปีสำหรับทบทวนข้อกำหนดประจำปี",
        employees: ["emp.028", "emp.033", "emp.041"],
      },
    ],
  },
] as const;

const employeeDirectory = [
  { id: "HRD-001", name: "HRD-FACTORY", department: "HRD", company: "ATA" },
  { id: "EMP-004", name: "Somchai P.", department: "Operations", company: "ATFB" },
  { id: "EMP-005", name: "Kanda S.", department: "Production", company: "SNF" },
  { id: "EMP-009", name: "Wichai T.", department: "Maintenance", company: "NIC" },
  { id: "EMP-012", name: "Naree T.", department: "Production", company: "ATFB" },
  { id: "EMP-017", name: "Krit N.", department: "Sales Support", company: "SATI" },
  { id: "EMP-019", name: "Worawit C.", department: "Maintenance", company: "SNF" },
  { id: "EMP-022", name: "Patchara M.", department: "Logistics", company: "TEP" },
  { id: "EMP-024", name: "emp.024", department: "Quality", company: "ATFB" },
  { id: "EMP-028", name: "Maliwan P.", department: "Customer Service", company: "SATI" },
  { id: "EMP-031", name: "emp.031", department: "Operations", company: "ATFB" },
  { id: "EMP-033", name: "Pimchanok R.", department: "Customer Service", company: "SATI" },
  { id: "EMP-041", name: "Thanakorn S.", department: "Quality", company: "NIC" },
  { id: "SUP-001", name: "sup.001", department: "Supervisor", company: "ATFB" },
] as const;

const targetGroups = ["all", ...Array.from(new Set(employeeDirectory.map((employee) => employee.department)))] as const;
const employeeCompanies = ["all", "ATA", "ATFB", "NIC", "SATI", "SNF", "TEP"] as const;

type AcceptSurveyCourseKey = (typeof acceptSurveyPlans)[number]["courses"][number]["key"];
type AcceptSurveyApprovalStatus = "draft" | "sent" | "waiting" | "approved" | "rejected" | "directApproved";
type SentSurveyParticipant = {
  name: string;
  company: string;
  status: "draft" | "waiting" | "approved";
};
type OapTargetUser = {
  id: string;
  name: string;
  department: string;
};

type OapCourse = {
  key: string;
  statusLabel: string;
  courseCode: string;
  courseName: string;
  trainingDate: string;
  startTime: string;
  endTime: string;
  organizerUnit: string;
  company: string;
  trainingRound: string;
  trainingStatus: string;
  courseType: string;
  budget: string;
  trainer: string;
  department: string;
  owner: string;
  planDetail: string;
  preTest: string;
  postTest: string;
  evaluation: string;
  targetUsers: readonly OapTargetUser[];
};
type RollingYear = (typeof rollingYears)[number];
type RollingMonth = (typeof rollingMonths)[number]["value"];
type AcceptSurveyMonth = RollingMonth | "all";
type RollingTraining = {
  key: string;
  year: RollingYear;
  month: RollingMonth;
  courseCode: string;
  courseName: string;
  date: string;
  time: string;
  participants: number;
  trainer: string;
  room: string;
  status: string;
  objective: string;
  preTest: string;
  postTest: string;
  evaluation: string;
  owner: string;
  budget: string;
};

type RollingTrainingForm = {
  courseCode: string;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  participants: string;
  trainer: string;
  room: string;
  status: string;
  objective: string;
  preTest: string;
  postTest: string;
  evaluation: string;
  owner: string;
  budget: string;
};

const emptyRollingTrainingForm: RollingTrainingForm = {
  courseCode: "",
  courseName: "",
  date: "",
  startTime: "",
  endTime: "",
  participants: "",
  trainer: "",
  room: "",
  status: "Draft",
  objective: "",
  preTest: "",
  postTest: "",
  evaluation: "",
  owner: "",
  budget: "",
};

const emptyOapCourseForm = {
  courseCode: "",
  courseName: "",
  trainingDate: "",
  startTime: "",
  endTime: "",
  company: "ATFB",
  trainingRound: "",
  trainingStatus: "ยังไม่อบรม",
  courseType: "",
  budget: "",
  trainer: "",
  department: "",
  owner: "",
  planDetail: "",
  preTest: "",
  postTest: "",
  evaluation: "",
};

type TrainingPlanManagementProps = {
  username: string;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
};

export default function TrainingPlanManagement({
  username,
  onBack,
  onHome,
  onLogout,
}: TrainingPlanManagementProps) {
  const [selectedPlan, setSelectedPlan] = useState<(typeof planItems)[number] | null>(null);
  const isAcceptSurvey = selectedPlan?.title === "Training Accept Survey";
  const isRequestTrainingNeed = selectedPlan?.title === "Request Training Need";
  const isTrainingOap = selectedPlan?.title === "Training OAP";
  const isTrainingRolling = selectedPlan?.title === "Training Rolling";
  const [selectedRollingYear, setSelectedRollingYear] = useState<RollingYear>("2026");
  const [selectedRollingMonth, setSelectedRollingMonth] = useState<RollingMonth>("07");
  const [rollingTrainings, setRollingTrainings] = useState<RollingTraining[]>([...initialRollingTrainings]);
  const [selectedRollingTraining, setSelectedRollingTraining] = useState<string>("");
  const [isRollingNewFormOpen, setIsRollingNewFormOpen] = useState(false);
  const [rollingTrainingForm, setRollingTrainingForm] = useState<RollingTrainingForm>(emptyRollingTrainingForm);
  const [oapCourses, setOapCourses] = useState<OapCourse[]>([...initialOapCourses]);
  const [isOapNewFormOpen, setIsOapNewFormOpen] = useState(false);
  const [oapCourseForm, setOapCourseForm] = useState(emptyOapCourseForm);
  const [selectedAcceptSurveyCourse, setSelectedAcceptSurveyCourse] = useState<AcceptSurveyCourseKey>(
    acceptSurveyPlans[0].courses[0].key,
  );
  const [selectedAcceptSurveyYear, setSelectedAcceptSurveyYear] = useState<RollingYear>("2026");
  const [selectedAcceptSurveyMonth, setSelectedAcceptSurveyMonth] = useState<AcceptSurveyMonth>("07");
  const [acceptSurveyEmployees, setAcceptSurveyEmployees] = useState<Record<string, string[]>>({});
  const [acceptSurveyApprovalStatus, setAcceptSurveyApprovalStatus] = useState<
    Record<string, AcceptSurveyApprovalStatus>
  >({});
  const [sentSurveyParticipants, setSentSurveyParticipants] = useState<
    Record<string, SentSurveyParticipant[]>
  >({});
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedTargetGroup, setSelectedTargetGroup] = useState<(typeof targetGroups)[number]>("all");
  const [selectedEmployeeCompany, setSelectedEmployeeCompany] =
    useState<(typeof employeeCompanies)[number]>("all");

  const acceptSurveyCourses = acceptSurveyPlans.flatMap((plan) =>
    plan.courses.map((course) => ({
      ...course,
      planDetail: plan.detail,
      planSubtitle: plan.subtitle,
      planTitle: plan.title,
    })),
  );

  const visibleAcceptSurveyCourses = acceptSurveyCourses.filter(
    (course) =>
      course.year === selectedAcceptSurveyYear &&
      (selectedAcceptSurveyMonth === "all" || course.month === selectedAcceptSurveyMonth),
  );

  const selectedSurveyCourse =
    visibleAcceptSurveyCourses.find((course) => course.key === selectedAcceptSurveyCourse) ??
    visibleAcceptSurveyCourses[0] ??
    acceptSurveyCourses[0];

  const selectedSurveyEmployees = acceptSurveyEmployees[selectedSurveyCourse.key] ?? [];
  const selectedSurveyApprovalStatus =
    acceptSurveyApprovalStatus[selectedSurveyCourse.key] ?? "draft";
  const selectedSentSurveyParticipants = sentSurveyParticipants[selectedSurveyCourse.key] ?? [];
  const selectedFactoryCourseParticipants = selectedSurveyEmployees.map((employeeName) => {
    const employee = employeeDirectory.find((item) => item.name === employeeName);

    return {
      name: employeeName,
      company: employee?.company ?? "ATA",
      department: employee?.department ?? "General",
    };
  });
  const selectedSurveyCompanyRepresentatives = selectedSurveyEmployees.reduce<
    { name: string; company: string }[]
  >((representatives, employeeName) => {
    const employee = employeeDirectory.find((item) => item.name === employeeName);
    const company = employee?.company ?? "ATA";

    if (representatives.some((item) => item.company === company)) {
      return representatives;
    }

    return [
      ...representatives,
      {
        name: employeeName,
        company,
      },
    ];
  }, []);
  const isHrdCenterCourse = selectedSurveyCourse.key === "course-a" || selectedSurveyCourse.key === "course-d";

  const filteredEmployees = employeeDirectory.filter((employee) => {
    const searchValue = employeeSearch.trim().toLowerCase();
    const matchesSearch =
      !searchValue ||
      `${employee.id} ${employee.name} ${employee.department} ${employee.company}`
        .toLowerCase()
        .includes(searchValue);
    const matchesTargetGroup =
      selectedTargetGroup === "all" || employee.department === selectedTargetGroup;
    const matchesCompany =
      selectedEmployeeCompany === "all" || employee.company === selectedEmployeeCompany;
    const isAlreadySelected = selectedSurveyEmployees.includes(employee.name);

    return matchesSearch && matchesTargetGroup && matchesCompany && !isAlreadySelected;
  });

  const [selectedOapCourse, setSelectedOapCourse] = useState<string>("");
  const selectedRollingMonthLabel =
    rollingMonths.find((month) => month.value === selectedRollingMonth)?.label ?? rollingMonths[0].label;

  const selectedRollingTrainings = rollingTrainings.filter(
    (training) =>
      training.year === selectedRollingYear && training.month === selectedRollingMonth,
  );

  const handleAddSurveyEmployee = (employeeName: string) => {
    setAcceptSurveyEmployees((current) => ({
      ...current,
      [selectedSurveyCourse.key]: [
        ...(current[selectedSurveyCourse.key] ?? []),
        employeeName,
      ],
    }));
  };

  const handleRemoveSurveyEmployee = (employeeName: string) => {
    setAcceptSurveyEmployees((current) => ({
      ...current,
      [selectedSurveyCourse.key]: (current[selectedSurveyCourse.key] ?? []).filter(
        (name) => name !== employeeName,
      ),
    }));
    setSentSurveyParticipants((current) => ({
      ...current,
      [selectedSurveyCourse.key]: (current[selectedSurveyCourse.key] ?? []).filter(
        (participant) => participant.name !== employeeName,
      ),
    }));
  };

  const handleSetAcceptSurveyStatus = (nextStatus: AcceptSurveyApprovalStatus) => {
    setAcceptSurveyApprovalStatus((current) => ({
      ...current,
      [selectedSurveyCourse.key]: nextStatus,
    }));
  };

  const handleSendSurveyParticipants = () => {
    const submittedParticipants = selectedSurveyCompanyRepresentatives.map((participant) => ({
      name: participant.name,
      company: participant.company,
      status: "waiting" as const,
    }));

    setSentSurveyParticipants((current) => ({
      ...current,
      [selectedSurveyCourse.key]: submittedParticipants,
    }));
    handleSetAcceptSurveyStatus("waiting");
  };

  const handleMarkSurveyApprovedByCenter = () => {
    setSentSurveyParticipants((current) => ({
      ...current,
      [selectedSurveyCourse.key]: (current[selectedSurveyCourse.key] ?? []).map((participant) => ({
        ...participant,
        status: "approved",
      })),
    }));
    handleSetAcceptSurveyStatus("approved");
  };

  const handleAcceptSurveyFilterChange = (nextYear: RollingYear, nextMonth: AcceptSurveyMonth) => {
    setSelectedAcceptSurveyYear(nextYear);
    setSelectedAcceptSurveyMonth(nextMonth);
    setEmployeeSearch("");
    setSelectedTargetGroup("all");
    setSelectedEmployeeCompany("all");

    const nextCourse = acceptSurveyCourses.find(
      (course) => course.year === nextYear && (nextMonth === "all" || course.month === nextMonth),
    );

    if (nextCourse) {
      setSelectedAcceptSurveyCourse(nextCourse.key);
    }
  };

  const handleBack = () => {
    if (selectedPlan) {
      if (isAcceptSurvey) {
        setSelectedAcceptSurveyCourse(acceptSurveyPlans[0].courses[0].key);
        setSelectedAcceptSurveyYear("2026");
        setSelectedAcceptSurveyMonth("07");
        setEmployeeSearch("");
        setSelectedTargetGroup("all");
        setSelectedEmployeeCompany("all");
      }

      if (isTrainingOap) {
        setSelectedOapCourse("");
        setIsOapNewFormOpen(false);
        setOapCourseForm(emptyOapCourseForm);
      }

      if (isTrainingRolling) {
        setSelectedRollingYear("2026");
        setSelectedRollingMonth("07");
        setSelectedRollingTraining("");
        setIsRollingNewFormOpen(false);
        setRollingTrainingForm(emptyRollingTrainingForm);
      }

      setSelectedPlan(null);
      return;
    }

    onBack();
  };

  const handleOpenWorkflow = (actionTitle: (typeof planItems)[number]["title"]) => {
    const nextPlan = planItems.find((item) => item.title === actionTitle) ?? null;
    setSelectedPlan(nextPlan);
  };

  const handleOapFormChange = (field: keyof typeof emptyOapCourseForm, value: string) => {
    setOapCourseForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleRollingFormChange = (field: keyof RollingTrainingForm, value: string) => {
    setRollingTrainingForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const formatRollingDate = (dateValue: string) => {
    if (!dateValue) {
      return `${selectedRollingMonthLabel} ${selectedRollingYear}`;
    }

    const date = new Date(`${dateValue}T00:00:00`);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleCreateRollingTraining = () => {
    const courseNumber = String(selectedRollingTrainings.length + 1).padStart(3, "0");
    const nextTraining: RollingTraining = {
      key: `rolling-new-${Date.now()}`,
      year: selectedRollingYear,
      month: selectedRollingMonth,
      courseCode:
        rollingTrainingForm.courseCode.trim() ||
        `ROL-${selectedRollingYear.slice(2)}${selectedRollingMonth}-${courseNumber}`,
      courseName: rollingTrainingForm.courseName.trim() || "New monthly training",
      date: formatRollingDate(rollingTrainingForm.date),
      time:
        rollingTrainingForm.startTime && rollingTrainingForm.endTime
          ? `${rollingTrainingForm.startTime} - ${rollingTrainingForm.endTime}`
          : "09:00 - 16:00",
      participants: Number(rollingTrainingForm.participants) || 0,
      trainer: rollingTrainingForm.trainer.trim() || "HRD-FACTORY",
      room: rollingTrainingForm.room.trim() || "Training Room",
      status: rollingTrainingForm.status,
      objective: rollingTrainingForm.objective.trim() || "รายการอบรมประจำเดือนที่เพิ่มใหม่",
      preTest: rollingTrainingForm.preTest.trim() || "Pre-test",
      postTest: rollingTrainingForm.postTest.trim() || "Post-test",
      evaluation: rollingTrainingForm.evaluation.trim() || "แบบประเมินหลังอบรม",
      owner: rollingTrainingForm.owner.trim() || username,
      budget: rollingTrainingForm.budget.trim() || "รอระบุ",
    };

    setRollingTrainings((current) => [nextTraining, ...current]);
    setSelectedRollingTraining(nextTraining.key);
    setRollingTrainingForm(emptyRollingTrainingForm);
    setIsRollingNewFormOpen(false);
  };

  const handleDeleteRollingTraining = () => {
    if (!selectedRollingTraining) {
      return;
    }

    setRollingTrainings((current) =>
      current.filter((training) => training.key !== selectedRollingTraining),
    );
    setSelectedRollingTraining("");
  };

  const handleRefreshRollingTrainings = () => {
    setRollingTrainings([...initialRollingTrainings]);
    setSelectedRollingTraining("");
    setIsRollingNewFormOpen(false);
    setRollingTrainingForm(emptyRollingTrainingForm);
  };

  const handleCreateOapCourse = () => {
    const courseNumber = String(oapCourses.length + 1).padStart(3, "0");
    const nextCourse: OapCourse = {
      key: `oap-new-${Date.now()}`,
      statusLabel: "New",
      courseCode: oapCourseForm.courseCode.trim() || `OAP-TRN-${courseNumber}`,
      courseName: oapCourseForm.courseName.trim() || "New training course",
      trainingDate: oapCourseForm.trainingDate || "รอระบุวันที่",
      startTime: oapCourseForm.startTime || "09:00",
      endTime: oapCourseForm.endTime || "16:00",
      organizerUnit: "ATA",
      company: oapCourseForm.company || "ATFB",
      trainingRound: oapCourseForm.trainingRound.trim() || "รุ่นใหม่ / 2026",
      trainingStatus: oapCourseForm.trainingStatus,
      courseType: oapCourseForm.courseType.trim() || "General",
      budget: oapCourseForm.budget.trim() || "รอระบุ",
      trainer: oapCourseForm.trainer.trim() || "รอระบุ",
      department: oapCourseForm.department.trim() || "HRD Learning & Development",
      owner: oapCourseForm.owner.trim() || username,
      planDetail: oapCourseForm.planDetail.trim() || "รายละเอียดหลักสูตรใหม่",
      preTest: oapCourseForm.preTest.trim() || "Pre-test",
      postTest: oapCourseForm.postTest.trim() || "Post-test",
      evaluation: oapCourseForm.evaluation.trim() || "แบบประเมินหลังอบรม",
      targetUsers: [
        { id: "EMP-NEW", name: "รอระบุกลุ่มเป้าหมาย", department: "Target group" },
      ],
    };

    setOapCourses((current) => [nextCourse, ...current]);
    setSelectedOapCourse(nextCourse.key);
    setOapCourseForm(emptyOapCourseForm);
    setIsOapNewFormOpen(false);
  };

  const handleSetOapCourseStatus = (courseKey: string, statusLabel: "Planning" | "Planned") => {
    setOapCourses((current) =>
      current.map((course) =>
        course.key === courseKey
          ? {
              ...course,
              statusLabel,
            }
          : course,
      ),
    );
  };

  return (
    <main className={styles.page}>
      <Navbar username={username} onHome={onHome} onLogout={onLogout} />

      <section className={styles.header}>
        <button className={styles.backButton} type="button" onClick={handleBack}>
          Back
        </button>
        <p className={styles.kicker}>Training Plan</p>
        <h1>{selectedPlan ? selectedPlan.title : "Training Plan Management"}</h1>
      </section>

      {selectedPlan ? isRequestTrainingNeed ? (
        <section className={styles.requestNeedWorkspace} aria-label={`${selectedPlan.title} page`}>
          <div className={styles.requestNeedGrid}>
            <section className={styles.requestListPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>Request inbox</p>
                  <h3>คำร้องขอให้จัดอบรม</h3>
                </div>
                <span className={styles.panelTag}>{trainingNeedRequests.length} requests</span>
              </div>

              <div className={styles.requestNeedList}>
                {trainingNeedRequests.map((request) => (
                  <article className={styles.requestNeedCard} key={request.key}>
                    <div className={styles.requestNeedMain}>
                      <span className={styles.queueBadge}>{request.status}</span>
                      <h4>{request.course}</h4>
                      <p>{request.objective}</p>
                    </div>

                    <dl className={styles.queueMeta}>
                      <div>
                        <dt>Request by</dt>
                        <dd>{request.requestBy}</dd>
                      </div>
                      <div>
                        <dt>Approved by</dt>
                        <dd>{request.approvedBy}</dd>
                      </div>
                      <div>
                        <dt>Participants</dt>
                        <dd>{request.participants} people</dd>
                      </div>
                      <div>
                        <dt>Period</dt>
                        <dd>{request.preferredPeriod}</dd>
                      </div>
                    </dl>

                    <div className={styles.requestActions}>
                      <button
                        className={styles.oapInlineButton}
                        type="button"
                        onClick={() => handleOpenWorkflow("Training OAP")}
                      >
                        รับจัดอบรม
                      </button>
                      <button
                        className={styles.oapInlineButton}
                        type="button"
                        onClick={() => handleOpenWorkflow("Training Accept Survey")}
                      >
                        ไปสำรวจผู้เข้าอบรม
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

          </div>
        </section>
      ) : isAcceptSurvey ? (
        <section className={styles.acceptSurveyWorkspace} aria-label={`${selectedPlan.title} page`}>
          <div className={styles.acceptSurveyGrid}>
            <section className={styles.coursePickerPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>Course list</p>
                  <h3>คอร์ส OAP</h3>
                </div>
                <span className={styles.panelTag}>{visibleAcceptSurveyCourses.length} courses</span>
              </div>

              <div className={styles.acceptSurveyFilters}>
                <label>
                  <span>Year</span>
                  <select
                    value={selectedAcceptSurveyYear}
                    onChange={(event) =>
                      handleAcceptSurveyFilterChange(event.target.value as RollingYear, selectedAcceptSurveyMonth)
                    }
                  >
                    {rollingYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Month</span>
                  <select
                    value={selectedAcceptSurveyMonth}
                    onChange={(event) =>
                      handleAcceptSurveyFilterChange(selectedAcceptSurveyYear, event.target.value as AcceptSurveyMonth)
                    }
                  >
                    <option value="all">ทั้งปี</option>
                    {rollingMonths.map((month) => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.coursePickerList}>
                {visibleAcceptSurveyCourses.map((course) => {
                  const isSelected = course.key === selectedSurveyCourse.key;

                  return (
                    <button
                      key={course.key}
                      className={`${styles.coursePickerCard} ${isSelected ? styles.coursePickerCardActive : ""}`}
                      type="button"
                      onClick={() => setSelectedAcceptSurveyCourse(course.key)}
                    >
                      <div className={styles.coursePickerTopline}>
                        <span className={styles.coursePickerBadge}>{course.planTitle}</span>
                        {isSelected ? <span className={styles.activeTag}>Selected</span> : null}
                      </div>
                      <h4>{course.title}</h4>
                      <span className={styles.courseDateText}>{course.date}</span>
                      <p>{course.detail}</p>
                    </button>
                  );
                })}

                {visibleAcceptSurveyCourses.length === 0 ? (
                  <div className={styles.employeeEmpty}>ไม่มีคอร์ส OAP ในเดือนนี้</div>
                ) : null}
              </div>
            </section>

            <section className={styles.respondentPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>Employee Search</p>
                  <h3>{selectedSurveyCourse.title}</h3>
                </div>
                <span className={styles.panelTag}>{selectedSurveyEmployees.length} people</span>
              </div>

              <div className={styles.courseSummaryCard}>
                <span>{selectedSurveyCourse.planSubtitle}</span>
                <strong>{selectedSurveyCourse.title}</strong>
                <p>{selectedSurveyCourse.planDetail}</p>
                <p>{selectedSurveyCourse.detail}</p>
              </div>

              <section className={styles.factoryAcceptSimple} aria-label="Factory sent participant approval">
                <div className={styles.factorySimpleHeader}>
                  <div>
                    <p className={styles.panelKicker}>
                      {isHrdCenterCourse ? "HRD Center approval" : "Factory course roster"}
                    </p>
                    <h3 className={styles.factoryDynamicTitle}>
                      {isHrdCenterCourse
                        ? "ส่งรายชื่อให้ Center อนุมัติ"
                        : "รายชื่อผู้เข้าอบรมของ Factory"}
                    </h3>
                    <h3>ส่งรายชื่อให้ Center อนุมัติ</h3>
                  </div>
                  <span className={styles.panelTag}>
                    {isHrdCenterCourse ? "Center course" : "Factory course"}
                  </span>
                </div>

                {isHrdCenterCourse ? (
                  <>
                    <div className={styles.factorySimpleActions}>
                      <div>
                        <span>ตัวแทนบริษัทที่จะส่ง</span>
                        <strong>{selectedSurveyCompanyRepresentatives.length} บริษัท</strong>
                      </div>
                      <button className={styles.oapInlineButton} type="button" onClick={handleSendSurveyParticipants}>
                        ส่งรายชื่อ
                      </button>
                    </div>

                    <div className={styles.companyRepresentativeList}>
                      {(selectedSentSurveyParticipants.length > 0
                        ? selectedSentSurveyParticipants
                        : selectedSurveyCompanyRepresentatives.map((participant) => ({
                            ...participant,
                            status: "draft" as const,
                          }))
                      ).length > 0 ? (
                        (selectedSentSurveyParticipants.length > 0
                          ? selectedSentSurveyParticipants
                          : selectedSurveyCompanyRepresentatives.map((participant) => ({
                              ...participant,
                              status: "draft" as const,
                            }))
                        ).map((participant) => (
                          <article key={`${participant.company}-${participant.name}`}>
                            <div>
                              <span>{participant.company}</span>
                              <strong>{participant.name}</strong>
                            </div>
                            <b
                              className={
                                participant.status === "approved"
                                  ? styles.approvedStatus
                                  : participant.status === "waiting"
                                    ? styles.waitingStatus
                                    : styles.draftStatus
                              }
                            >
                              {participant.status === "approved"
                                ? "อนุมัติแล้ว"
                                : participant.status === "waiting"
                                  ? "รออนุมัติ"
                                  : "เตรียมส่ง"}
                            </b>
                            <button
                              className={styles.removeParticipantButton}
                              type="button"
                              onClick={() => handleRemoveSurveyEmployee(participant.name)}
                            >
                              ถอน
                            </button>
                          </article>
                        ))
                      ) : (
                        <div className={styles.factoryResultBox}>เลือกรายชื่อก่อนส่งให้ Center อนุมัติ</div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.factorySimpleActions}>
                      <div>
                        <span>รายชื่อในคอร์ส Factory</span>
                        <strong>{selectedFactoryCourseParticipants.length} คน</strong>
                      </div>
                    </div>

                    <div className={styles.companyRepresentativeList}>
                      {selectedFactoryCourseParticipants.length > 0 ? (
                        selectedFactoryCourseParticipants.map((participant) => (
                          <article key={`${participant.company}-${participant.name}`}>
                            <div>
                              <span>{participant.company}</span>
                              <strong>{participant.name}</strong>
                              <small>{participant.department}</small>
                            </div>
                            <b className={styles.directStatus}>ลงชื่อแล้ว</b>
                            <button
                              className={styles.removeParticipantButton}
                              type="button"
                              onClick={() => handleRemoveSurveyEmployee(participant.name)}
                            >
                              ถอน
                            </button>
                          </article>
                        ))
                      ) : (
                        <div className={styles.factoryResultBox}>
                          เลือกรายชื่อผู้เข้าอบรมของ Factory จากด้านล่าง รายชื่อจะแสดงที่นี่ทันที
                        </div>
                      )}
                    </div>
                  <div className={styles.factoryResultBox}>คอร์สนี้เป็นของ Factory ไม่ต้องส่งให้ Center อนุมัติ</div>
                  </>
                )}
              </section>

              <section className={`${styles.factoryAcceptFlow} ${styles.factoryAcceptFlowHidden}`} aria-label="Factory sent participant approval">
                <div className={styles.factoryFlowHeader}>
                  <div>
                    <p className={styles.panelKicker}>HRD Center approval</p>
                    <h3>ส่งรายชื่อผู้เข้าอบรมให้ Center อนุมัติ</h3>
                  </div>
                  <span className={styles.panelTag}>
                    {isHrdCenterCourse ? "Center course" : "Factory course"}
                  </span>
                </div>

                {isHrdCenterCourse ? (
                  <>
                    <div className={styles.factorySubmitBox}>
                      <div>
                        <span>รายชื่อที่เลือกไว้</span>
                        <strong>{selectedSurveyEmployees.length} คน</strong>
                      </div>
                      <button
                        className={styles.oapInlineButton}
                        type="button"
                        onClick={handleSendSurveyParticipants}
                      >
                        ส่งรายชื่อให้ Center อนุมัติ
                      </button>
                      <button
                        className={styles.oapInlineButton}
                        type="button"
                        onClick={handleMarkSurveyApprovedByCenter}
                      >
                        อัปเดตผลอนุมัติจาก Center
                      </button>
                    </div>

                    <div className={styles.sentParticipantList} aria-label="Submitted participants">
                      {selectedSentSurveyParticipants.length > 0 ? (
                        selectedSentSurveyParticipants.map((participant) => (
                          <article key={participant.name}>
                            <strong>{participant.name}</strong>
                            <span
                              className={
                                participant.status === "approved"
                                  ? styles.approvedStatus
                                  : styles.waitingStatus
                              }
                            >
                              {participant.status === "approved" ? "อนุมัติแล้ว" : "กำลังรออนุมัติ"}
                            </span>
                          </article>
                        ))
                      ) : (
                        <div className={styles.factoryResultBox}>
                          ยังไม่ได้ส่งรายชื่อให้ Center อนุมัติ
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={styles.factoryResultBox}>
                    คอร์สนี้เป็นของ Factory จึงไม่ต้องส่งรายชื่อให้ Center อนุมัติ
                  </div>
                )}
              </section>

              <section className={`${styles.factoryAcceptFlow} ${styles.factoryAcceptFlowHidden}`} aria-label="Factory accept survey workflow">
                <div className={styles.factoryFlowHeader}>
                  <div>
                    <p className={styles.panelKicker}>Factory workflow</p>
                    <h3>สำรวจผู้เข้าอบรม</h3>
                  </div>
                  <span className={styles.panelTag}>
                    {isHrdCenterCourse ? "HRD Center course" : "Factory course"}
                  </span>
                </div>

                <div className={styles.factoryFlowSteps}>
                  <article>
                    <span>1</span>
                    <strong>ส่งรายชื่อผู้เข้าอบรม</strong>
                  </article>
                  <article>
                    <span>2</span>
                    <strong>ดูรายงานแบบอบรม</strong>
                  </article>
                  <article>
                    <span>3</span>
                    <strong>ตรวจสอบผู้ลงทะเบียน</strong>
                  </article>
                  <article>
                    <span>4</span>
                    <strong>เพิ่มรายชื่อผู้เข้าอบรม</strong>
                  </article>
                </div>

                <div className={styles.factoryDecisionPanel}>
                  <div>
                    <span>เป็นคอร์สที่ HRD Center สร้างไหม</span>
                    <strong>{isHrdCenterCourse ? "Yes" : "No"}</strong>
                  </div>
                  <div>
                    <span>สถานะ</span>
                    <strong>
                      {selectedSurveyApprovalStatus === "draft"
                        ? "เตรียมรายชื่อ"
                        : selectedSurveyApprovalStatus === "sent"
                          ? "ส่งรายชื่อให้ HRD Center"
                          : selectedSurveyApprovalStatus === "waiting"
                            ? "รอการอนุมัติจาก HRD Center"
                            : selectedSurveyApprovalStatus === "approved"
                              ? "Approved ยืนยันผู้เข้าอบรม"
                              : selectedSurveyApprovalStatus === "rejected"
                                ? "Rejected"
                                : "อนุมัติทันที"}
                    </strong>
                  </div>
                </div>

                <div className={styles.factoryAcceptActions}>
                  {isHrdCenterCourse ? (
                    <>
                      <button
                        className={styles.oapInlineButton}
                        type="button"
                        onClick={() => handleSetAcceptSurveyStatus("sent")}
                      >
                        ส่งรายชื่อไป HRD Center
                      </button>
                      <button
                        className={styles.oapInlineButton}
                        type="button"
                        onClick={() => handleSetAcceptSurveyStatus("waiting")}
                      >
                        รอการอนุมัติ
                      </button>
                      <button
                        className={styles.oapInlineButton}
                        type="button"
                        onClick={() => handleSetAcceptSurveyStatus("approved")}
                      >
                        HRD Center อนุมัติ
                      </button>
                      <button
                        className={styles.oapInlineButton}
                        type="button"
                        onClick={() => handleSetAcceptSurveyStatus("rejected")}
                      >
                        Rejected
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.oapInlineButton}
                      type="button"
                      onClick={() => handleSetAcceptSurveyStatus("directApproved")}
                    >
                      อนุมัติทันที
                    </button>
                  )}
                </div>

                <div className={styles.factoryResultBox}>
                  แสดงผลการอนุมัติจาก HRD:{" "}
                  <strong>
                    {selectedSurveyApprovalStatus === "approved" ||
                    selectedSurveyApprovalStatus === "directApproved"
                      ? "Approved"
                      : selectedSurveyApprovalStatus === "rejected"
                        ? "Rejected"
                        : "Pending"}
                  </strong>
                </div>
              </section>

              <label className={styles.employeeSearchBox}>
                <span>ค้นหาชื่อพนักงาน</span>
                <input
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  placeholder="ค้นหาด้วยชื่อ รหัส แผนก หรือบริษัท"
                />
              </label>

              <label className={styles.employeeSearchBox}>
                <span>กลุ่มเป้าหมาย</span>
                <select
                  value={selectedTargetGroup}
                  onChange={(event) =>
                    setSelectedTargetGroup(event.target.value as (typeof targetGroups)[number])
                  }
                >
                  {targetGroups.map((group) => (
                    <option key={group} value={group}>
                      {group === "all" ? "ทุกกลุ่มเป้าหมาย" : group}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.employeeSearchBox}>
                <span>บริษัท</span>
                <select
                  value={selectedEmployeeCompany}
                  onChange={(event) =>
                    setSelectedEmployeeCompany(event.target.value as (typeof employeeCompanies)[number])
                  }
                >
                  {employeeCompanies.map((company) => (
                    <option key={company} value={company}>
                      {company === "all" ? "ทุกบริษัท" : company}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.employeeSearchTable}>
                <div className={styles.employeeSearchHead}>
                  <span>พนักงาน</span>
                  <span>แผนก/บริษัท</span>
                  <span>เพิ่มเข้า course</span>
                </div>

                {filteredEmployees.map((employee) => (
                  <article className={styles.employeeSearchRow} key={employee.id}>
                    <div>
                      <strong>{employee.name}</strong>
                      <span>{employee.id}</span>
                    </div>
                    <div>
                      <strong>{employee.department}</strong>
                      <span>{employee.company}</span>
                    </div>
                    <button
                      className={styles.oapInlineButton}
                      type="button"
                      onClick={() => handleAddSurveyEmployee(employee.name)}
                    >
                      เพิ่ม
                    </button>
                  </article>
                ))}

                {filteredEmployees.length === 0 ? (
                  <div className={styles.employeeEmpty}>ไม่พบพนักงานที่ค้นหา หรืออยู่ในคอร์สแล้ว</div>
                ) : null}
              </div>

              <div className={styles.factoryHiddenRespondentList}>
                {selectedSurveyEmployees.map((employee, index) => (
                  <article className={styles.respondentItem} key={employee}>
                    <div>
                      <strong>{employee}</strong>
                      <span>Target participant #{index + 1}</span>
                    </div>
                    <b>Survey</b>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      ) : isTrainingOap ? (
        <section className={styles.oapWorkspace} aria-label={`${selectedPlan.title} page`}>
          <div className={styles.oapToolbar}>
            <p className={styles.oapToolbarLabel}>Course actions</p>
            <div className={styles.oapActionBar}>
            <button
              className={styles.actionButton}
              type="button"
              onClick={() => setIsOapNewFormOpen((current) => !current)}
            >
              New
            </button>
            <button className={styles.actionButton} type="button">Edit</button>
            <button className={styles.actionButton} type="button">Delete</button>
            <button className={styles.actionButton} type="button">Refresh</button>
            </div>
          </div>

          {isOapNewFormOpen ? (
            <section className={styles.oapNewCoursePanel} aria-label="New OAP course form">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>New course</p>
                  <h3>เพิ่มข้อมูลหลักสูตร</h3>
                </div>
                <span className={styles.panelTag}>Draft</span>
              </div>

              <div className={styles.oapNewCourseForm}>
                <label>
                  <span>รหัสคอร์ส</span>
                  <input
                    value={oapCourseForm.courseCode}
                    onChange={(event) => handleOapFormChange("courseCode", event.target.value)}
                    placeholder="OAP-TRN-025"
                  />
                </label>
                <label>
                  <span>ชื่อคอร์ส</span>
                  <input
                    value={oapCourseForm.courseName}
                    onChange={(event) => handleOapFormChange("courseName", event.target.value)}
                    placeholder="Course name"
                  />
                </label>
                <label>
                  <span>วันที่อบรม</span>
                  <input
                    type="date"
                    value={oapCourseForm.trainingDate}
                    onChange={(event) => handleOapFormChange("trainingDate", event.target.value)}
                  />
                </label>
                <label>
                  <span>เวลาเริ่ม</span>
                  <input
                    type="time"
                    value={oapCourseForm.startTime}
                    onChange={(event) => handleOapFormChange("startTime", event.target.value)}
                  />
                </label>
                <label>
                  <span>เวลาเลิก</span>
                  <input
                    type="time"
                    value={oapCourseForm.endTime}
                    onChange={(event) => handleOapFormChange("endTime", event.target.value)}
                  />
                </label>
                <label>
                  <span>บริษัทที่จัด</span>
                  <select
                    value={oapCourseForm.company}
                    onChange={(event) => handleOapFormChange("company", event.target.value)}
                  >
                    <option value="ATA">ATA</option>
                    <option value="ATFB">ATFB</option>
                    <option value="NIC">NIC</option>
                    <option value="SATI">SATI</option>
                    <option value="SNF">SNF</option>
                    <option value="TEP">TEP</option>
                  </select>
                </label>
                <label>
                  <span>รุ่นอบรม</span>
                  <input
                    value={oapCourseForm.trainingRound}
                    onChange={(event) => handleOapFormChange("trainingRound", event.target.value)}
                    placeholder="รุ่น 1 / 2026"
                  />
                </label>
                <label>
                  <span>สถานะอบรม</span>
                  <select
                    value={oapCourseForm.trainingStatus}
                    onChange={(event) => handleOapFormChange("trainingStatus", event.target.value)}
                  >
                    <option value="ยังไม่อบรม">ยังไม่อบรม</option>
                    <option value="กำลังอบรม">กำลังอบรม</option>
                    <option value="อบรมแล้ว">อบรมแล้ว</option>
                  </select>
                </label>
                <label>
                  <span>ประเภทคอร์ส</span>
                  <input
                    value={oapCourseForm.courseType}
                    onChange={(event) => handleOapFormChange("courseType", event.target.value)}
                    placeholder="Mandatory / Core / Compliance"
                  />
                </label>
                <label>
                  <span>งบประมาณ</span>
                  <input
                    value={oapCourseForm.budget}
                    onChange={(event) => handleOapFormChange("budget", event.target.value)}
                    placeholder="฿50,000"
                  />
                </label>
                <label>
                  <span>วิทยากร</span>
                  <input
                    value={oapCourseForm.trainer}
                    onChange={(event) => handleOapFormChange("trainer", event.target.value)}
                    placeholder="Trainer name"
                  />
                </label>
                <label>
                  <span>หน่วยงานจัดอบรม</span>
                  <input
                    value={oapCourseForm.department}
                    onChange={(event) => handleOapFormChange("department", event.target.value)}
                    placeholder="Department"
                  />
                </label>
                <label>
                  <span>Owner</span>
                  <input
                    value={oapCourseForm.owner}
                    onChange={(event) => handleOapFormChange("owner", event.target.value)}
                    placeholder={username}
                  />
                </label>
                <label className={styles.oapFormWide}>
                  <span>รายละเอียดหลักสูตร</span>
                  <textarea
                    value={oapCourseForm.planDetail}
                    onChange={(event) => handleOapFormChange("planDetail", event.target.value)}
                    placeholder="รายละเอียด วัตถุประสงค์ หรือกลุ่มเป้าหมายของหลักสูตร"
                  />
                </label>
                <label>
                  <span>Pre-test</span>
                  <textarea
                    value={oapCourseForm.preTest}
                    onChange={(event) => handleOapFormChange("preTest", event.target.value)}
                    placeholder="รายละเอียดแบบทดสอบก่อนเรียน หรือลิงก์แบบทดสอบ"
                  />
                </label>
                <label>
                  <span>Post-test</span>
                  <textarea
                    value={oapCourseForm.postTest}
                    onChange={(event) => handleOapFormChange("postTest", event.target.value)}
                    placeholder="รายละเอียดแบบทดสอบหลังเรียน หรือลิงก์แบบทดสอบ"
                  />
                </label>
                <label>
                  <span>แบบประเมิน</span>
                  <textarea
                    value={oapCourseForm.evaluation}
                    onChange={(event) => handleOapFormChange("evaluation", event.target.value)}
                    placeholder="รายละเอียดแบบประเมิน หรือลิงก์แบบประเมิน"
                  />
                </label>
              </div>

              <div className={styles.oapFormActions}>
                <button className={styles.secondaryButton} type="button" onClick={() => setIsOapNewFormOpen(false)}>
                  Cancel
                </button>
                <button className={styles.primaryButton} type="button" onClick={handleCreateOapCourse}>
                  Save course
                </button>
              </div>
            </section>
          ) : null}

          <div className={styles.oapTablePanel}>
            <div className={styles.oapTableHeader}>
              <p className={styles.panelKicker}>Course list</p>
              <span className={styles.panelTag}>{oapCourses.length} courses</span>
            </div>

            <div className={styles.oapTable} role="table" aria-label="OAP course plan table">
              <div className={styles.oapTableHead} role="row">
                <div role="columnheader">Course plan</div>
                <div role="columnheader">Status</div>
              </div>

              {oapCourses.map((course) => {
                const isSelected = course.key === selectedOapCourse;

                return (
                  <div className={styles.oapTableGroup} key={course.key} role="rowgroup">
                    <div className={styles.oapTableRow} role="row">
                      <div className={styles.oapCourseCell} role="cell">
                        <div className={styles.oapCourseMain}>
                          <strong>{course.courseName}</strong>
                          <p>{course.courseCode}</p>
                        </div>
                        <div className={styles.oapCourseMeta}>
                          <span>{course.trainingDate}</span>
                          <span>{course.startTime} - {course.endTime}</span>
                          <span>{course.company}</span>
                        </div>
                      </div>
                      <div className={styles.oapActionCell} role="cell">
                        <span className={styles.oapCourseBadge}>{course.statusLabel}</span>
                        <div className={styles.oapDecisionGroup}>
                          <button
                            className={`${styles.oapInlineButton} ${styles.oapConfirmButton}`}
                            type="button"
                            onClick={() => handleSetOapCourseStatus(course.key, "Planning")}
                          >
                            Confirm
                          </button>
                          <button
                            className={styles.oapInlineButton}
                            type="button"
                            onClick={() => handleSetOapCourseStatus(course.key, "Planned")}
                          >
                            Cancel
                          </button>
                        </div>
                        <button
                          className={`${styles.oapInlineButton} ${styles.oapDetailToggleButton}`}
                          type="button"
                          onClick={() => setSelectedOapCourse(isSelected ? "" : course.key)}
                        >
                          {isSelected ? "ซ่อนรายละเอียด" : "แสดงรายละเอียด"}
                        </button>
                      </div>
                    </div>

                    {isSelected ? (
                      <div className={styles.oapDetailRow} role="row">
                        <div className={styles.oapDetailPanelFull} role="cell">
                          <p className={styles.planDetailLabel}>รายละเอียดเกี่ยวกับ course</p>
                          <p className={styles.planDetailText}>{course.planDetail}</p>

                          <div className={styles.oapDetailGrid}>
                            <article className={styles.oapInfoCard}>
                              <span>รหัสคอร์ด</span>
                              <strong>{course.courseCode}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>ชื่อคอร์ด</span>
                              <strong>{course.courseName}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>รุ่นอบรม</span>
                              <strong>{course.trainingRound}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>วันที่อบรม</span>
                              <strong>{course.trainingDate}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>เวลาจัดอบรม</span>
                              <strong>{course.startTime} - {course.endTime}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>หน่วยงานจัดอบรม</span>
                              <strong>{course.organizerUnit}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>บริษัทที่จัด</span>
                              <strong>{course.company}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>status ว่าอบรมหรือยัง</span>
                              <strong>{course.trainingStatus}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>ประเภทคอร์ด</span>
                              <strong>{course.courseType}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>งบประมาณ</span>
                              <strong>{course.budget}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>วิทยากร</span>
                              <strong>{course.trainer}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>หน่วยงานจัดอบรม</span>
                              <strong>{course.department}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>owner</span>
                              <strong>{course.owner}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>Pre-test</span>
                              <strong>{course.preTest}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>Post-test</span>
                              <strong>{course.postTest}</strong>
                            </article>
                            <article className={styles.oapInfoCard}>
                              <span>แบบประเมิน</span>
                              <strong>{course.evaluation}</strong>
                            </article>
                          </div>

                          <section className={styles.oapTargetPanel}>
                            <div className={styles.oapTargetHeader}>
                              <p className={styles.planDetailLabel}>รายชื่อคนที่อยู่ในเป้าหมาย</p>
                              <span className={styles.panelTag}>{course.targetUsers.length} users</span>
                            </div>
                            <div className={styles.oapTargetList}>
                              {course.targetUsers.map((user) => (
                                <div className={styles.oapTargetRow} key={`${course.key}-${user.id}`}>
                                  <strong>{user.name}</strong>
                                  <span>{user.id}</span>
                                  <p>{user.department}</p>
                                </div>
                              ))}
                            </div>
                          </section>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : isTrainingRolling ? (
        <section className={styles.rollingWorkspace} aria-label={`${selectedPlan.title} page`}>
          <div className={styles.oapToolbar}>
            <p className={styles.oapToolbarLabel}>Course actions</p>
            <div className={styles.oapActionBar}>
              <button
                className={styles.actionButton}
                type="button"
                onClick={() => setIsRollingNewFormOpen((current) => !current)}
              >
                New
              </button>
              <button
                className={styles.actionButton}
                type="button"
                onClick={() => {
                  if (selectedRollingTraining) {
                    setIsRollingNewFormOpen(true);
                  }
                }}
              >
                Edit
              </button>
              <button className={styles.actionButton} type="button" onClick={handleDeleteRollingTraining}>
                Delete
              </button>
              <button className={styles.actionButton} type="button" onClick={handleRefreshRollingTrainings}>
                Refresh
              </button>
            </div>
          </div>

          <div className={styles.rollingToolbar}>
            <div>
              <p className={styles.panelKicker}>Monthly training list</p>
              <h3>{selectedRollingMonthLabel} {selectedRollingYear}</h3>
            </div>

            <div className={styles.rollingFilters}>
              <label>
                <span>Year</span>
                <select
                  value={selectedRollingYear}
                  onChange={(event) => {
                    setSelectedRollingYear(event.target.value as RollingYear);
                    setSelectedRollingTraining("");
                  }}
                >
                  {rollingYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Month</span>
                <select
                  value={selectedRollingMonth}
                  onChange={(event) => {
                    setSelectedRollingMonth(event.target.value as RollingMonth);
                    setSelectedRollingTraining("");
                  }}
                >
                  {rollingMonths.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {isRollingNewFormOpen ? (
            <section className={styles.rollingNewPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>New Rolling</p>
                  <h3>สร้างอบรมรายเดือน</h3>
                </div>
                <span className={styles.panelTag}>{selectedRollingMonthLabel} {selectedRollingYear}</span>
              </div>

              <div className={styles.rollingNewForm}>
                <label>
                  <span>รหัสคอร์ส</span>
                  <input
                    value={rollingTrainingForm.courseCode}
                    onChange={(event) => handleRollingFormChange("courseCode", event.target.value)}
                    placeholder="ROL-2607-004"
                  />
                </label>
                <label>
                  <span>ชื่อคอร์ส</span>
                  <input
                    value={rollingTrainingForm.courseName}
                    onChange={(event) => handleRollingFormChange("courseName", event.target.value)}
                    placeholder="Course name"
                  />
                </label>
                <label>
                  <span>วันที่อบรม</span>
                  <input
                    type="date"
                    value={rollingTrainingForm.date}
                    onChange={(event) => handleRollingFormChange("date", event.target.value)}
                  />
                </label>
                <label>
                  <span>เวลาเริ่ม</span>
                  <input
                    type="time"
                    value={rollingTrainingForm.startTime}
                    onChange={(event) => handleRollingFormChange("startTime", event.target.value)}
                  />
                </label>
                <label>
                  <span>เวลาเลิก</span>
                  <input
                    type="time"
                    value={rollingTrainingForm.endTime}
                    onChange={(event) => handleRollingFormChange("endTime", event.target.value)}
                  />
                </label>
                <label>
                  <span>ผู้เข้าอบรม</span>
                  <input
                    type="number"
                    min="0"
                    value={rollingTrainingForm.participants}
                    onChange={(event) => handleRollingFormChange("participants", event.target.value)}
                    placeholder="24"
                  />
                </label>
                <label>
                  <span>วิทยากร</span>
                  <input
                    value={rollingTrainingForm.trainer}
                    onChange={(event) => handleRollingFormChange("trainer", event.target.value)}
                    placeholder="Trainer"
                  />
                </label>
                <label>
                  <span>สถานที่</span>
                  <input
                    value={rollingTrainingForm.room}
                    onChange={(event) => handleRollingFormChange("room", event.target.value)}
                    placeholder="Training Room"
                  />
                </label>
                <label>
                  <span>สถานะ</span>
                  <select
                    value={rollingTrainingForm.status}
                    onChange={(event) => handleRollingFormChange("status", event.target.value)}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Open register">Open register</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Planned">Planned</option>
                  </select>
                </label>
                <label>
                  <span>งบประมาณ</span>
                  <input
                    value={rollingTrainingForm.budget}
                    onChange={(event) => handleRollingFormChange("budget", event.target.value)}
                    placeholder="฿50,000"
                  />
                </label>
                <label>
                  <span>Owner</span>
                  <input
                    value={rollingTrainingForm.owner}
                    onChange={(event) => handleRollingFormChange("owner", event.target.value)}
                    placeholder={username}
                  />
                </label>
                <label className={styles.rollingFormWide}>
                  <span>รายละเอียด</span>
                  <textarea
                    value={rollingTrainingForm.objective}
                    onChange={(event) => handleRollingFormChange("objective", event.target.value)}
                    placeholder="รายละเอียดหรือวัตถุประสงค์ของการอบรม"
                  />
                </label>
                <label>
                  <span>Pre-test</span>
                  <textarea
                    value={rollingTrainingForm.preTest}
                    onChange={(event) => handleRollingFormChange("preTest", event.target.value)}
                    placeholder="รายละเอียดแบบทดสอบก่อนเรียน หรือลิงก์แบบทดสอบ"
                  />
                </label>
                <label>
                  <span>Post-test</span>
                  <textarea
                    value={rollingTrainingForm.postTest}
                    onChange={(event) => handleRollingFormChange("postTest", event.target.value)}
                    placeholder="รายละเอียดแบบทดสอบหลังเรียน หรือลิงก์แบบทดสอบ"
                  />
                </label>
                <label>
                  <span>แบบประเมิน</span>
                  <textarea
                    value={rollingTrainingForm.evaluation}
                    onChange={(event) => handleRollingFormChange("evaluation", event.target.value)}
                    placeholder="รายละเอียดแบบประเมิน หรือลิงก์แบบประเมิน"
                  />
                </label>
              </div>

              <div className={styles.oapFormActions}>
                <button className={styles.secondaryButton} type="button" onClick={() => setIsRollingNewFormOpen(false)}>
                  Cancel
                </button>
                <button className={styles.primaryButton} type="button" onClick={handleCreateRollingTraining}>
                  Save rolling
                </button>
              </div>
            </section>
          ) : null}

          <section className={styles.rollingPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Training Rolling</p>
                <h3>รายชื่ออบรมประจำเดือน</h3>
              </div>
              <span className={styles.panelTag}>{selectedRollingTrainings.length} courses</span>
            </div>

            {selectedRollingTrainings.length > 0 ? (
              <div className={styles.rollingTable} role="table" aria-label="Monthly rolling training list">
                <div className={styles.rollingTableHead} role="row">
                  <div role="columnheader">หลักสูตร</div>
                  <div role="columnheader">วันที่/เวลา</div>
                  <div role="columnheader">ผู้เข้าอบรม</div>
                  <div role="columnheader">สถานะ</div>
                  <div role="columnheader">รายละเอียด</div>
                </div>

                {selectedRollingTrainings.map((training) => {
                  const isSelected = selectedRollingTraining === training.key;

                  return (
                    <div className={styles.rollingTableGroup} key={training.key} role="rowgroup">
                      <article className={styles.rollingTableRow} role="row">
                        <div className={styles.rollingCourseCell} role="cell">
                          <span>{training.courseCode}</span>
                          <strong>{training.courseName}</strong>
                          <small>{training.trainer} / {training.room}</small>
                        </div>
                        <div role="cell">
                          <strong>{training.date}</strong>
                          <span>{training.time}</span>
                        </div>
                        <div role="cell">
                          <strong>{training.participants}</strong>
                          <span>people</span>
                        </div>
                        <div role="cell">
                          <b>{training.status}</b>
                        </div>
                        <div className={styles.rollingActionCell} role="cell">
                          <button
                            className={styles.oapInlineButton}
                            type="button"
                            onClick={() => setSelectedRollingTraining(isSelected ? "" : training.key)}
                          >
                            {isSelected ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                          </button>
                        </div>
                      </article>

                      {isSelected ? (
                        <section className={styles.rollingDetailPanel}>
                          <p className={styles.planDetailLabel}>รายละเอียดอบรมรายเดือน</p>
                          <p className={styles.planDetailText}>{training.objective}</p>
                          <div className={styles.rollingDetailGrid}>
                            <article>
                              <span>รหัสคอร์ส</span>
                              <strong>{training.courseCode}</strong>
                            </article>
                            <article>
                              <span>ชื่อคอร์ส</span>
                              <strong>{training.courseName}</strong>
                            </article>
                            <article>
                              <span>วันที่อบรม</span>
                              <strong>{training.date}</strong>
                            </article>
                            <article>
                              <span>เวลา</span>
                              <strong>{training.time}</strong>
                            </article>
                            <article>
                              <span>วิทยากร</span>
                              <strong>{training.trainer}</strong>
                            </article>
                            <article>
                              <span>สถานที่</span>
                              <strong>{training.room}</strong>
                            </article>
                            <article>
                              <span>ผู้เข้าอบรม</span>
                              <strong>{training.participants} people</strong>
                            </article>
                            <article>
                              <span>งบประมาณ</span>
                              <strong>{training.budget}</strong>
                            </article>
                            <article>
                              <span>Owner</span>
                              <strong>{training.owner}</strong>
                            </article>
                            <article>
                              <span>Status</span>
                              <strong>{training.status}</strong>
                            </article>
                            <article>
                              <span>Pre-test</span>
                              <strong>{training.preTest}</strong>
                            </article>
                            <article>
                              <span>Post-test</span>
                              <strong>{training.postTest}</strong>
                            </article>
                            <article>
                              <span>แบบประเมิน</span>
                              <strong>{training.evaluation}</strong>
                            </article>
                          </div>
                        </section>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.rollingEmpty}>
                <strong>ยังไม่มีรายการอบรมในเดือนนี้</strong>
                <p>เลือกเดือนหรือปีอื่นเพื่อดูแผน Training Rolling ที่ถูกบันทึกไว้</p>
              </div>
            )}
          </section>
        </section>
      ) : (
        <section className={styles.blankWorkspace} aria-label={`${selectedPlan.title} page`}>
          <div className={styles.blankCanvas} />
        </section>
      ) : (
        <section className={styles.systemWorkspace} aria-label="Training plan system">
          <section className={styles.planMenuPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>Training Plan</p>
                <h3>เมนูหลัก</h3>
              </div>
              <span className={styles.panelTag}>{planItems.length} modules</span>
            </div>

            <div className={styles.planMenuGrid}>
              {planItems.map((item) => (
                <button
                  className={styles.planMenuCard}
                  key={item.title}
                  type="button"
                  onClick={() => handleOpenWorkflow(item.title)}
                >
                  <span>{item.subtitle}</span>
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.approvalPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>HRD Center</p>
                <h3>รายการที่กำลังจัดอยู่</h3>
              </div>
              <span className={styles.panelTag}>{approvalInbox.length} items</span>
            </div>

            <div className={styles.approvalList}>
              {approvalInbox.map((item) => (
                <article className={styles.approvalItem} key={item.course}>
                  <div>
                    <strong>{item.course}</strong>
                    <span>{item.requestBy} / {item.participants} people</span>
                  </div>
                  <b className={item.status === "อบรมไปแล้ว" ? styles.doneStatus : styles.pendingStatus}>
                    {item.status}
                  </b>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
