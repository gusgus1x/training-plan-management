export type UserModule = "register" | "roadmap" | "request" | "record" | "calendar" | "activities";

export type ModuleCard = {
  key: UserModule;
  eyebrow: string;
  eyebrowTh?: string;
  title: string;
  titleTh?: string;
  detail: string;
  detailTh?: string;
  locked?: boolean;
};

export const moduleCards: ModuleCard[] = [
  {
    key: "register",
    eyebrow: "Register",
    eyebrowTh: "ลงทะเบียน",
    title: "Register Train",
    titleTh: "ลงทะเบียนอบรม (Register Train)",
    detail: "Select available courses, submit registration, and let HRD review the request.",
    detailTh: "เลือกหลักสูตรที่เปิดรับ ส่งคำขอลงทะเบียน และรอ HRD ตรวจสอบและอนุมัติ",
  },
  {
    key: "roadmap",
    eyebrow: "Roadmap",
    eyebrowTh: "แผนพัฒนา",
    title: "Training Roadmap",
    titleTh: "แผนผังการฝึกอบรม (Training Roadmap)",
    detail: "Review the personal development plan and required courses by timeline.",
    detailTh: "ตรวจสอบแผนการพัฒนาตนเองและหลักสูตรเป้าหมายตามสายงานและระดับงาน",
  },
  {
    key: "request",
    eyebrow: "Need",
    eyebrowTh: "ความต้องการ",
    title: "Request Training Need",
    titleTh: "ขอความประสงค์ฝึกอบรม (Request Training Need)",
    detail: "Submit a new training need to HRD Center for review and approval.",
    detailTh: "ส่งคำขอหลักสูตรที่ต้องการฝึกอบรมเพิ่มเติมให้ HRD Center พิจารณาและอนุมัติ",
  },
  {
    key: "record",
    eyebrow: "Record",
    eyebrowTh: "ประวัติ",
    title: "My Record",
    titleTh: "ประวัติการฝึกอบรม (My Record)",
    detail: "Check training history, accumulated hours, course results, and evidence status.",
    detailTh: "ตรวจสอบประวัติการอบรมรายบุคคล ชั่วโมงเรียนรู้สะสม ผลการเรียน และขอเอกสารรับรอง",
  },
  {
    key: "calendar",
    eyebrow: "Calendar",
    eyebrowTh: "ตารางการอบรม",
    title: "Calendar Training",
    titleTh: "ปฏิทินการฝึกอบรม (Calendar Training)",
    detail: "Monthly and annual training schedule calendar for employee operations.",
    detailTh: "ปฏิทินตารางการฝึกอบรมรายเดือนและรายปีสำหรับการปฏิบัติงานของพนักงาน",
  },
  {
    key: "activities",
    eyebrow: "Activities",
    eyebrowTh: "ข่าวสาร & ภาพกิจกรรม",
    title: "New Activities",
    titleTh: "ข่าวสารและภาพกิจกรรม (New Activities)",
    detail: "Browse company training news, event photos, and announcements across all companies.",
    detailTh: "ติดตามข่าวสารการฝึกอบรม ภาพกิจกรรม และประกาศสำคัญของทุกบริษัทในเครือ",
  },
];
