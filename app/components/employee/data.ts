export type UserModule = "register" | "roadmap" | "request" | "record" | "report";

export const moduleCards: Array<{
  key: UserModule;
  eyebrow: string;
  title: string;
  detail: string;
  metric: string;
}> = [
  {
    key: "register",
    eyebrow: "Register",
    title: "Register Train",
    detail: "เลือกหลักสูตรจากระบบ แล้วส่งให้ HRD ตรวจสอบและอนุมัติ",
    metric: "3 courses",
  },
  {
    key: "roadmap",
    eyebrow: "Roadmap",
    title: "Training Roadmap",
    detail: "ดูแผนพัฒนารายบุคคลและหลักสูตรที่ต้องเรียนตามช่วงเวลา",
    metric: "FY2026",
  },
  {
    key: "request",
    eyebrow: "Need",
    title: "Request Training Need",
    detail: "ส่งความต้องการอบรมใหม่ไปยัง HRD Center เพื่อเข้าสู่ขั้นตอนอนุมัติ",
    metric: "2 pending",
  },
  {
    key: "record",
    eyebrow: "Record",
    title: "Training Record",
    detail: "ตรวจสอบประวัติการอบรม ชั่วโมงสะสม และผลการผ่านหลักสูตร",
    metric: "9 hours",
  },
  {
    key: "report",
    eyebrow: "Report",
    title: "Training Report",
    detail: "ส่งข้อมูลและรับข้อมูลรายงานของพนักงาน",
    metric: "Ready",
  },
];

export const availableCourses = [
  {
    id: "PDPA-2026-07",
    title: "Data Privacy Awareness",
    category: "Compliance",
    round: "รุ่น 1 / 2026",
    trainingStatus: "ยังไม่อบรม",
    type: "Mandatory",
    budget: "฿48,500",
    trainer: "IT Governance",
    owner: "HRD Learning & Development",
    description: "อบรมความเข้าใจเรื่องข้อมูลส่วนบุคคลสำหรับพนักงานทุกคน",
    date: "15 Jul 2026",
    time: "09:30 - 11:30",
    place: "Online",
    seats: "12 seats",
    status: "รอ HRD อนุมัติ",
  },
  {
    id: "SAFE-2026-08",
    title: "Safety & Compliance Basics",
    category: "Safety",
    round: "รุ่น 2 / 2026",
    trainingStatus: "ลงทะเบียนแล้ว",
    type: "Compliance",
    budget: "฿52,000",
    trainer: "Safety Team",
    owner: "Safety & Compliance",
    description: "ทบทวนมาตรฐานความปลอดภัยและข้อกำหนดสำคัญในพื้นที่ปฏิบัติงาน",
    date: "21 Aug 2026",
    time: "10:00 - 12:00",
    place: "Auditorium",
    seats: "8 seats",
    status: "ลงทะเบียนแล้ว",
  },
  {
    id: "SERV-2026-09",
    title: "Service Mind for Frontline",
    category: "Soft Skill",
    round: "รุ่น 1 / 2026",
    trainingStatus: "ยังไม่อบรม",
    type: "Core",
    budget: "฿62,000",
    trainer: "Maliwan P.",
    owner: "Corporate Training",
    description: "พัฒนาทักษะการให้บริการ การสื่อสาร และการประสานงานกับทีม",
    date: "8 Sep 2026",
    time: "09:00 - 16:00",
    place: "Training Room B",
    seats: "20 seats",
    status: "เปิดลงทะเบียน",
  },
] as const;

export const employeeCalendarTrainings = [
  {
    date: "2026-07-05",
    title: "5S Refresher",
    shortName: "5S",
    time: "09:00 - 10:30",
    place: "Training Room A",
    status: "Completed",
  },
  {
    date: "2026-07-15",
    title: "Data Privacy Awareness",
    shortName: "PDPA",
    time: "09:30 - 11:30",
    place: "Online",
    status: "รออนุมัติ",
  },
  {
    date: "2026-07-24",
    title: "Quality Control Basics",
    shortName: "QC",
    time: "13:00 - 16:00",
    place: "Training Room B",
    status: "ตามแผน",
  },
  {
    date: "2026-08-21",
    title: "Safety & Compliance Basics",
    shortName: "Safety",
    time: "10:00 - 12:00",
    place: "Auditorium",
    status: "ลงทะเบียนแล้ว",
  },
  {
    date: "2026-09-08",
    title: "Service Mind for Frontline",
    shortName: "Service",
    time: "09:00 - 16:00",
    place: "Training Room B",
    status: "เปิดลงทะเบียน",
  },
  {
    date: "2027-01-14",
    title: "Annual Compliance Refresh",
    shortName: "Annual",
    time: "09:00 - 12:00",
    place: "Online",
    status: "ตามแผน",
  },
] as const;

export const roadmapItems = [
  {
    code: "PDPA-2026",
    title: "Data Privacy Awareness",
    category: "Mandatory",
    detail: "หลักสูตรบังคับสำหรับพนักงานทุกคน เพื่อเข้าใจการดูแลข้อมูลส่วนบุคคล",
    round: "รุ่น 1 / 2026",
    trainingStatus: "ยังไม่อบรม",
    type: "Mandatory",
    budget: "฿48,500",
    trainer: "IT Governance",
    owner: "HRD Learning & Development",
    due: "15 Jul 2026",
    status: "ควรลงทะเบียน",
    action: "ลงทะเบียน",
    priority: "High",
  },
  {
    code: "SAFE-2026",
    title: "Safety & Compliance Basics",
    category: "Safety",
    detail: "แนะนำให้ทบทวนข้อกำหนดด้านความปลอดภัยสำหรับพื้นที่ปฏิบัติงาน",
    round: "รุ่น 2 / 2026",
    trainingStatus: "ลงทะเบียนแล้ว",
    type: "Compliance",
    budget: "฿52,000",
    trainer: "Safety Team",
    owner: "Safety & Compliance",
    due: "21 Aug 2026",
    status: "ลงทะเบียนแล้ว",
    action: "ดูรายละเอียด",
    priority: "Medium",
  },
  {
    code: "QC-2026",
    title: "Quality Control Basics",
    category: "Role Skill",
    detail: "หลักสูตรแนะนำสำหรับพนักงาน Production เพื่อเพิ่มทักษะการตรวจสอบคุณภาพ",
    round: "รุ่น 1 / 2026",
    trainingStatus: "ยังไม่อบรม",
    type: "Role Skill",
    budget: "฿44,500",
    trainer: "QA Department",
    owner: "HRD Learning & Development",
    due: "24 Sep 2026",
    status: "พร้อมลงทะเบียน",
    action: "ลงทะเบียน",
    priority: "Recommend",
  },
] as const;

export const requestStatuses = [
  { title: "ส่ง training need ไป HRD Center", owner: "Employee", status: "Done" },
  { title: "รอ HRD Center อนุมัติ", owner: "HRD", status: "In review" },
  { title: "แสดงผลอนุมัติการอบรม", owner: "System", status: "Pending" },
] as const;

export const history = [
  { course: "Orientation Program", date: "12 May 2026", hours: "6", result: "Completed" },
  { course: "5S Awareness", date: "22 Jun 2026", hours: "3", result: "Completed" },
  { course: "Data Privacy Awareness", date: "15 Jul 2026", hours: "2", result: "Pending approval" },
] as const;

export const recordCourses = [
  {
    course: "Orientation Program",
    date: "12 May 2026",
    year: "2026",
    month: "05",
    result: "ผ่าน",
    assessment: "ไม่ต้องทำแบบประเมิน",
    action: "แสดงว่าสำเร็จ",
  },
  {
    course: "5S Awareness",
    date: "22 Jun 2026",
    year: "2026",
    month: "06",
    result: "ไม่ผ่าน",
    assessment: "ต้องทำ pre/post test",
    action: "ทำแบบทดสอบซ้ำ",
  },
  {
    course: "Data Privacy Awareness",
    date: "15 Jul 2026",
    year: "2026",
    month: "07",
    result: "รอตรวจ",
    assessment: "รอ HRD อนุมัติ",
    action: "ติดตามผล",
  },
] as const;

export const externalRecordRequests = [
  {
    course: "Forklift Safety Training",
    source: "อบรมนอกบริษัท",
    status: "ส่งให้ HRD ตรวจสอบ",
  },
  {
    course: "Basic Welding Skill",
    source: "ประวัติจากที่ทำงานเดิม",
    status: "รอรับรองผล",
  },
] as const;
