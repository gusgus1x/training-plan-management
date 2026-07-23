"use client";

import { useState, type CSSProperties } from "react";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import styles from "./TrainingRecord.module.css";

export const trainingRecordModule = {
  title: "Training Record",
  subtitle: "Completed Course Records",
  description:
    "Review completed courses, actual attendees, cost, pre/post test results, evaluation progress, and downloadable training evidence.",
} as const;

type CompletedCourse = {
  id: string;
  source: "SYSTEM" | "UPLOAD";
  code: string;
  title: string;
  date: string;
  company: string;
  owner: "CENTER" | "FACTORY";
  room: string;
  instructor: string;
  actualAttendees: number;
  registeredAttendees: number;
  actualCost: {
    accommodation: number;
    foodBeverage: number;
    instructor: number;
    material: number;
    seminarRoom: number;
    traveling: number;
  };
  prePostPassPercent: number;
  postTestPassPercent: number;
  preTestPassPercent: number;
  evaluationCompleted: number;
  evaluationTotal: number;
  averageScore: number;
  attendees: Array<{
    company: string;
    id: string;
    name: string;
    employeeCode: string;
    department: string;
    prePost: "Passed" | "Failed";
    evaluation: "Done" | "Pending";
  }>;
};

type CourseOwner = CompletedCourse["owner"];
type CourseOwnerFilter = CourseOwner | "";

type ImportedCourseDraft = Omit<CompletedCourse, "id">;

type UploadedTrainingRecord = {
  id: string;
  no: string;
  year: string;
  month: string;
  company: string;
  recordNo: string;
  empCode: string;
  idCard: string;
  titleTh: string;
  nameTh: string;
  surnameTh: string;
  courseCode: string;
  courseName: string;
  groupNo: string;
  instructor: string;
  institute: string;
  trainingPlace: string;
  trainingHour: string;
  startDate: string;
  endDate: string;
  expensePerPerson: string;
  functionTh: string;
  functionEn: string;
  logDate: string;
};

const initialCompletedCourses: CompletedCourse[] = [
  {
    id: "course-001",
    source: "SYSTEM",
    code: "SAFE-2026-08",
    title: "Safety & Compliance Basics",
    date: "21 Aug 2026",
    company: "SNF",
    owner: "FACTORY",
    room: "Auditorium",
    instructor: "Safety Team",
    actualAttendees: 39,
    registeredAttendees: 42,
    actualCost: {
      accommodation: 0,
      foodBeverage: 4200,
      instructor: 12000,
      material: 2400,
      seminarRoom: 3500,
      traveling: 1800,
    },
    prePostPassPercent: 87,
    postTestPassPercent: 87,
    preTestPassPercent: 42,
    evaluationCompleted: 35,
    evaluationTotal: 39,
    averageScore: 91,
    attendees: [
      { id: "a1", company: "SNF", name: "Narin Chaiya", employeeCode: "HRD-001", department: "Production", prePost: "Passed", evaluation: "Done" },
      { id: "a2", company: "SNF", name: "Maliwan S.", employeeCode: "HRD-014", department: "Quality", prePost: "Passed", evaluation: "Done" },
      { id: "a3", company: "SNF", name: "Kittipong R.", employeeCode: "SNF-5621", department: "Maintenance", prePost: "Failed", evaluation: "Pending" },
    ],
  },
  {
    id: "course-002",
    source: "SYSTEM",
    code: "PDPA-2026-07",
    title: "Data Privacy Awareness",
    date: "15 Jul 2026",
    company: "All Companies",
    owner: "CENTER",
    room: "Online",
    instructor: "IT Governance",
    actualAttendees: 58,
    registeredAttendees: 60,
    actualCost: {
      accommodation: 0,
      foodBeverage: 0,
      instructor: 8500,
      material: 1200,
      seminarRoom: 0,
      traveling: 0,
    },
    prePostPassPercent: 94,
    postTestPassPercent: 94,
    preTestPassPercent: 48,
    evaluationCompleted: 54,
    evaluationTotal: 58,
    averageScore: 96,
    attendees: [
      { id: "b1", company: "ATA", name: "Suda K.", employeeCode: "HRD-003", department: "Human Resources", prePost: "Passed", evaluation: "Done" },
      { id: "b2", company: "SNF", name: "Anucha P.", employeeCode: "HRD-019", department: "IT", prePost: "Passed", evaluation: "Done" },
      { id: "b3", company: "ATFB", name: "Pimchanok T.", employeeCode: "HRD-028", department: "Sales", prePost: "Passed", evaluation: "Pending" },
    ],
  },
  {
    id: "course-003",
    source: "SYSTEM",
    code: "SERV-2026-09",
    title: "Service Mind for Frontline",
    date: "8 Sep 2026",
    company: "ATFB",
    owner: "FACTORY",
    room: "Training Room B",
    instructor: "Maliwan P.",
    actualAttendees: 24,
    registeredAttendees: 26,
    actualCost: {
      accommodation: 3800,
      foodBeverage: 6400,
      instructor: 15000,
      material: 3100,
      seminarRoom: 5000,
      traveling: 2500,
    },
    prePostPassPercent: 79,
    postTestPassPercent: 79,
    preTestPassPercent: 36,
    evaluationCompleted: 18,
    evaluationTotal: 24,
    averageScore: 88,
    attendees: [
      { id: "c1", company: "ATFB", name: "Thanawat M.", employeeCode: "HRD-033", department: "Customer Service", prePost: "Passed", evaluation: "Done" },
      { id: "c2", company: "ATFB", name: "Pimchanok T.", employeeCode: "HRD-028", department: "Sales", prePost: "Passed", evaluation: "Done" },
      { id: "c3", company: "NIC", name: "Chaiwat N.", employeeCode: "HRD-041", department: "Frontline", prePost: "Failed", evaluation: "Pending" },
    ],
  },
];

const initialUploadedTrainingRecords: UploadedTrainingRecord[] = [
  {
    id: "uploaded-snf-safe-001",
    no: "1",
    year: "2026",
    month: "08",
    company: "SNF",
    recordNo: "REC-SNF-2026-001",
    empCode: "SNF-5401",
    idCard: "1101700000001",
    titleTh: "นาย",
    nameTh: "นรินทร์",
    surnameTh: "ไชยา",
    courseCode: "SAFE-2026-08",
    courseName: "Safety & Compliance Basics",
    groupNo: "1",
    instructor: "Safety Team",
    institute: "ATTG Safety Academy",
    trainingPlace: "Auditorium",
    trainingHour: "3",
    startDate: "21 Aug 2026",
    endDate: "21 Aug 2026",
    expensePerPerson: "612",
    functionTh: "ฝ่ายผลิต",
    functionEn: "Production",
    logDate: "22 Aug 2026",
  },
  {
    id: "uploaded-snf-safe-002",
    no: "2",
    year: "2026",
    month: "08",
    company: "SNF",
    recordNo: "REC-SNF-2026-002",
    empCode: "SNF-5520",
    idCard: "1101700000002",
    titleTh: "นางสาว",
    nameTh: "มะลิวัลย์",
    surnameTh: "สุขใจ",
    courseCode: "SAFE-2026-08",
    courseName: "Safety & Compliance Basics",
    groupNo: "1",
    instructor: "Safety Team",
    institute: "ATTG Safety Academy",
    trainingPlace: "Auditorium",
    trainingHour: "3",
    startDate: "21 Aug 2026",
    endDate: "21 Aug 2026",
    expensePerPerson: "612",
    functionTh: "ฝ่ายคุณภาพ",
    functionEn: "Quality",
    logDate: "22 Aug 2026",
  },
  {
    id: "uploaded-snf-safe-003",
    no: "3",
    year: "2026",
    month: "08",
    company: "SNF",
    recordNo: "REC-SNF-2026-003",
    empCode: "SNF-5621",
    idCard: "1101700000003",
    titleTh: "นาย",
    nameTh: "กิตติพงษ์",
    surnameTh: "รุ่งเรือง",
    courseCode: "SAFE-2026-08",
    courseName: "Safety & Compliance Basics",
    groupNo: "1",
    instructor: "Safety Team",
    institute: "ATTG Safety Academy",
    trainingPlace: "Auditorium",
    trainingHour: "3",
    startDate: "21 Aug 2026",
    endDate: "21 Aug 2026",
    expensePerPerson: "612",
    functionTh: "ซ่อมบำรุง",
    functionEn: "Maintenance",
    logDate: "22 Aug 2026",
  },
  {
    id: "uploaded-center-pdpa-001",
    no: "4",
    year: "2026",
    month: "07",
    company: "All Companies",
    recordNo: "REC-HRD-2026-015",
    empCode: "ATFB-2204",
    idCard: "1101700000015",
    titleTh: "นางสาว",
    nameTh: "พิมพ์ชนก",
    surnameTh: "ตั้งใจ",
    courseCode: "PDPA-2026-07",
    courseName: "Data Privacy Awareness",
    groupNo: "2",
    instructor: "IT Governance",
    institute: "HRD Center",
    trainingPlace: "Online",
    trainingHour: "2",
    startDate: "15 Jul 2026",
    endDate: "15 Jul 2026",
    expensePerPerson: "167",
    functionTh: "ฝ่ายขาย",
    functionEn: "Sales",
    logDate: "16 Jul 2026",
  },
  {
    id: "uploaded-atfb-serv-001",
    no: "5",
    year: "2026",
    month: "09",
    company: "ATFB",
    recordNo: "REC-ATFB-2026-041",
    empCode: "ATFB-1107",
    idCard: "1101700000041",
    titleTh: "นาย",
    nameTh: "ธนวัฒน์",
    surnameTh: "มั่นคง",
    courseCode: "SERV-2026-09",
    courseName: "Service Mind for Frontline",
    groupNo: "1",
    instructor: "Maliwan P.",
    institute: "Corporate Training",
    trainingPlace: "Training Room B",
    trainingHour: "6",
    startDate: "8 Sep 2026",
    endDate: "8 Sep 2026",
    expensePerPerson: "1492",
    functionTh: "บริการลูกค้า",
    functionEn: "Customer Service",
    logDate: "9 Sep 2026",
  },
];

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const getCellValue = (row: Record<string, string>, headers: string[]) => {
  const normalizedHeaders = headers.map(normalizeHeader);
  const key = Object.keys(row).find((candidate) =>
    normalizedHeaders.includes(normalizeHeader(candidate)),
  );

  return key ? row[key]?.trim() ?? "" : "";
};

const parseNumber = (value: string, fallback = 0) => {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const escapeExcelCell = (value: string | number) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const buildTableRows = (rows: Array<Array<string | number>>) =>
  rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeExcelCell(cell)}</td>`).join("")}</tr>`)
    .join("");

const exportCourseSummaryExcel = (course: CompletedCourse, actualCostTotal: number) => {
  const summaryRows = [
    ["Course Code", course.code],
    ["Course Title", course.title],
    ["Source", course.source === "UPLOAD" ? "Upload" : "System"],
    ["Date", course.date],
    ["Company", course.company],
    ["Owner", course.owner],
    ["Room", course.room],
    ["Instructor", course.instructor],
    ["Actual / Registered", `${course.actualAttendees}/${course.registeredAttendees}`],
    ["Actual Cost", `THB ${formatNumber(actualCostTotal)}`],
    ["Pre Test Pass", `${course.preTestPassPercent}%`],
    ["Post Test Pass", `${course.postTestPassPercent}%`],
    ["Average Score", `${course.averageScore}%`],
    ["Evaluation", `${course.evaluationCompleted}/${course.evaluationTotal}`],
  ];
  const costRows = [
    ["Cost Item", "Amount"],
    ...expenseItems.map((item) => [
      item.label,
      `THB ${formatNumber(course.actualCost[item.key])}`,
    ]),
  ];
  const attendeeRows = [
    ["Company", "Employee Code", "Name", "Department", "Pre/Post", "Evaluation"],
    ...course.attendees.map((attendee) => [
      attendee.company,
      attendee.employeeCode,
      attendee.name,
      attendee.department,
      attendee.prePost,
      attendee.evaluation,
    ]),
  ];
  const workbook = `<!doctype html><html><head><meta charset="utf-8" /><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;margin-bottom:18px}td{border:1px solid #cbd5e1;padding:6px 8px;white-space:nowrap}tr:first-child td{background:#f1f5f9;font-weight:700}</style></head><body><table>${buildTableRows(summaryRows)}</table><table>${buildTableRows(costRows)}</table><table>${buildTableRows(attendeeRows)}</table></body></html>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${course.code}-course-record-summary.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const parseDelimitedRows = (text: string) => {
  const delimiter = text.includes("\t") ? "\t" : ",";
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .split(delimiter)
        .map((cell) => cell.trim().replace(/^"|"$/g, "").replace(/""/g, '"')),
    );
  const headers = rows[0] ?? [];

  return rows.slice(1).map((row) =>
    headers.reduce<Record<string, string>>((result, header, index) => {
      result[header] = row[index] ?? "";
      return result;
    }, {}),
  );
};

const parseHtmlTableRows = (text: string) => {
  const document = new DOMParser().parseFromString(text, "text/html");
  const tableRows = Array.from(document.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll("th,td")).map((cell) => cell.textContent?.trim() ?? ""),
  );
  const headers = tableRows[0] ?? [];

  return tableRows.slice(1).map((row) =>
    headers.reduce<Record<string, string>>((result, header, index) => {
      result[header] = row[index] ?? "";
      return result;
    }, {}),
  );
};

const mapImportRowToCourse = (
  row: Record<string, string>,
  index: number,
  fallbackOwner: "CENTER" | "FACTORY",
): ImportedCourseDraft | null => {
  const code = getCellValue(row, ["coursecode", "code"]);
  const title = getCellValue(row, ["coursetitle", "course", "title"]);
  const company = getCellValue(row, ["company", "companycode"]) || "All Companies";

  if (!code || !title) {
    return null;
  }

  const actualAttendees = parseNumber(getCellValue(row, ["actualattendees", "actual"]), 0);
  const registeredAttendees = parseNumber(
    getCellValue(row, ["registeredattendees", "registered"]),
    actualAttendees,
  );

  return {
    source: "UPLOAD",
    code,
    title,
    date: getCellValue(row, ["date", "completeddate", "trainingdate"]) || "Imported",
    company,
    owner:
      normalizeHeader(getCellValue(row, ["owner", "scope"])) === "factory"
        ? "FACTORY"
        : fallbackOwner,
    room: getCellValue(row, ["room", "location"]) || "-",
    instructor: getCellValue(row, ["instructor", "trainer"]) || "-",
    actualAttendees,
    registeredAttendees,
    actualCost: {
      accommodation: parseNumber(getCellValue(row, ["accommodation"])),
      foodBeverage: parseNumber(getCellValue(row, ["foodbeverage", "foodandbeverage"])),
      instructor: parseNumber(getCellValue(row, ["instructorcost"])),
      material: parseNumber(getCellValue(row, ["material"])),
      seminarRoom: parseNumber(getCellValue(row, ["seminarroom", "roomcost"])),
      traveling: parseNumber(getCellValue(row, ["traveling", "travel"])),
    },
    prePostPassPercent: parseNumber(getCellValue(row, ["prepostpasspercent"]), 0),
    postTestPassPercent: parseNumber(getCellValue(row, ["posttestpasspercent", "posttest"]), 0),
    preTestPassPercent: parseNumber(getCellValue(row, ["pretestpasspercent", "pretest"]), 0),
    evaluationCompleted: parseNumber(
      getCellValue(row, ["evaluationcompleted", "evaluationdone"]),
      0,
    ),
    evaluationTotal: parseNumber(getCellValue(row, ["evaluationtotal"]), actualAttendees),
    averageScore: parseNumber(getCellValue(row, ["averagescore", "score"]), 0),
    attendees: [
      {
        company,
        department: getCellValue(row, ["department", "function"]) || "-",
        employeeCode: getCellValue(row, ["employeecode"]) || `IMPORT-${index + 1}`,
        evaluation:
          normalizeHeader(getCellValue(row, ["evaluation"])) === "pending" ? "Pending" : "Done",
        id: `import-attendee-${Date.now()}-${index}`,
        name: getCellValue(row, ["employeename", "employee"]) || "Imported attendee",
        prePost: normalizeHeader(getCellValue(row, ["prepost"])) === "failed" ? "Failed" : "Passed",
      },
    ],
  };
};

const mapImportRowToUploadedRecord = (
  row: Record<string, string>,
  index: number,
): UploadedTrainingRecord | null => {
  const courseCode = getCellValue(row, ["coursecode"]);
  const courseName = getCellValue(row, ["coursename", "coursetitle", "course"]);
  const empCode = getCellValue(row, ["empcode", "employeecode"]);
  const company = getCellValue(row, ["company", "companycode"]);

  if (!courseCode && !courseName && !empCode) {
    return null;
  }

  return {
    id: `uploaded-record-${Date.now()}-${index}`,
    no: getCellValue(row, ["no", "no."]) || String(index + 1),
    year: getCellValue(row, ["year"]),
    month: getCellValue(row, ["month"]),
    company,
    recordNo: getCellValue(row, ["record", "recordno", "recordnumber"]),
    empCode,
    idCard: getCellValue(row, ["idcard", "id"]),
    titleTh: getCellValue(row, ["titleth", "title"]),
    nameTh: getCellValue(row, ["nameth", "name"]),
    surnameTh: getCellValue(row, ["surnameth", "surname", "lastname"]),
    courseCode,
    courseName,
    groupNo: getCellValue(row, ["groupno", "group"]),
    instructor: getCellValue(row, ["instructor"]),
    institute: getCellValue(row, ["institute"]),
    trainingPlace: getCellValue(row, ["trainingplace", "place", "location"]),
    trainingHour: getCellValue(row, ["traininghour", "hour", "hours"]),
    startDate: getCellValue(row, ["startdate"]),
    endDate: getCellValue(row, ["enddate"]),
    expensePerPerson: getCellValue(row, ["expenseperson", "expenseperperson"]),
    functionTh: getCellValue(row, ["functionth"]),
    functionEn: getCellValue(row, ["functionen"]),
    logDate: getCellValue(row, ["logdate"]),
  };
};

const expenseItems = [
  { key: "instructor", label: "Instructor" },
  { key: "traveling", label: "Traveling" },
  { key: "seminarRoom", label: "Seminar Room" },
  { key: "accommodation", label: "Accommodation" },
  { key: "material", label: "Material" },
  { key: "foodBeverage", label: "Food & Beverage" },
] as const;

export default function TrainingRecord() {
  const user = useAuthenticatedUser();
  const [courses, setCourses] = useState<CompletedCourse[]>(initialCompletedCourses);
  const [courseOwnerFilter, setCourseOwnerFilter] = useState<CourseOwnerFilter>("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [importedCourses, setImportedCourses] = useState<ImportedCourseDraft[]>([]);
  const [importedRecordRows, setImportedRecordRows] = useState<UploadedTrainingRecord[]>([]);
  const [savedRecordRows, setSavedRecordRows] = useState<UploadedTrainingRecord[]>(
    initialUploadedTrainingRecords,
  );
  const [importMessage, setImportMessage] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const userCompanyCode = profileValue(user?.companyCode);
  const importScopeLabel = isFactoryUser ? `${userCompanyCode} factory scope` : "Center scope";
  const importScopeNote = isFactoryUser
    ? `Factory import saves only completed courses for ${userCompanyCode}. Center records and other companies are ignored.`
    : "Center import can save completed courses for center and factory scopes.";
  const availableCourses = isFactoryUser
    ? courses.filter((course) => course.owner === "FACTORY" && course.company === userCompanyCode)
    : courses;
  const selectedCourseOwner: CourseOwnerFilter = isFactoryUser ? "FACTORY" : courseOwnerFilter;
  const ownerFilteredCourses = selectedCourseOwner
    ? availableCourses.filter((course) => course.owner === selectedCourseOwner)
    : [];
  const selectedCourse = ownerFilteredCourses.find((course) => course.id === selectedCourseId);

  if (availableCourses.length === 0) {
    return (
      <section className={styles.page} aria-label="Training Record module">
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{trainingRecordModule.subtitle}</p>
            <h2>{trainingRecordModule.title}</h2>
            <p>{trainingRecordModule.description}</p>
          </div>
          <div className={styles.heroMeta}>
            <span>0 completed courses</span>
            <span>{isFactoryUser ? "Factory permission" : "Center scope"}</span>
          </div>
        </section>

        <section className={styles.courseSelectPanel} aria-label="Completed course selector">
          <div>
            <p className={styles.kicker}>Course Owner</p>
            <h3>No completed course available</h3>
          </div>
          <p className={styles.emptyState}>
            {isFactoryUser
              ? `Factory permission can view only completed courses owned by ${userCompanyCode || "your company"}.`
              : "No completed courses are available yet. Import completed training records from Excel to save courses."}
          </p>
        </section>
      </section>
    );
  }
  const evaluationPercent = selectedCourse
    ? Math.round((selectedCourse.evaluationCompleted / selectedCourse.evaluationTotal) * 100)
    : 0;
  const selectedActualCost = selectedCourse
    ? expenseItems.reduce((total, item) => total + selectedCourse.actualCost[item.key], 0)
    : 0;
  const visibleCourseAttendees = selectedCourse
    ? selectedCourse.attendees.filter((attendee) => !isFactoryUser || attendee.company === userCompanyCode)
    : [];
  const attendeesByCompany = selectedCourse
    ? Object.entries(
        visibleCourseAttendees.reduce<Record<string, typeof visibleCourseAttendees>>((result, attendee) => {
          result[attendee.company] = [...(result[attendee.company] ?? []), attendee];
          return result;
        }, {}),
      )
    : [];
  const selectedUploadedRows = selectedCourse
    ? savedRecordRows.filter(
        (record) =>
          record.courseCode === selectedCourse.code &&
          (!isFactoryUser || record.company === userCompanyCode),
      )
    : [];

  const handleDownload = (label: string) => {
    if (!selectedCourse) {
      return;
    }

    setDownloadMessage(`${label} downloaded for ${selectedCourse.code}.`);
  };

  const handleExportCourseSummary = () => {
    if (!selectedCourse) {
      return;
    }

    exportCourseSummaryExcel(
      {
        ...selectedCourse,
        actualAttendees: visibleCourseAttendees.length,
        attendees: visibleCourseAttendees,
      },
      selectedActualCost,
    );
    setDownloadMessage(`Exported course record summary for ${selectedCourse.code}.`);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) {
      return;
    }

    setImportFileName(file.name);
    setImportMessage("");

    if (file.name.toLowerCase().endsWith(".xlsx")) {
      setImportedCourses([]);
      setImportedRecordRows([]);
      setImportMessage("Please export the Excel file as CSV, TSV, or HTML .xls before importing.");
      return;
    }

    const text = await file.text();
    const rawRows = /<table|<tr|<td|<th/i.test(text)
      ? parseHtmlTableRows(text)
      : parseDelimitedRows(text);
    const fallbackOwner = isFactoryUser ? "FACTORY" : "CENTER";
    const mappedCourses = rawRows
      .map((row, index) => mapImportRowToCourse(row, index, fallbackOwner))
      .filter((course): course is ImportedCourseDraft => Boolean(course))
      .map((course) => (isFactoryUser ? { ...course, owner: "FACTORY" as const } : course));
    const parsedCourses = mappedCourses.filter(
      (course) => !isFactoryUser || course.company === userCompanyCode,
    );
    const parsedRecordRows = rawRows
      .map((row, index) => mapImportRowToUploadedRecord(row, index))
      .filter((record): record is UploadedTrainingRecord => Boolean(record))
      .filter((record) => !isFactoryUser || record.company === userCompanyCode);
    const skippedRows = mappedCourses.length - parsedCourses.length;

    setImportedCourses(parsedCourses);
    setImportedRecordRows(parsedRecordRows);
    setImportMessage(
      parsedCourses.length > 0
        ? `Ready to save ${parsedCourses.length} imported courses and ${parsedRecordRows.length} record rows from ${file.name} in ${importScopeLabel}.${skippedRows > 0 ? ` Skipped ${skippedRows} rows outside this factory scope.` : ""}`
        : "No valid course rows found. Required columns: Course Code and Course Title.",
    );
  };

  const handleSaveImportedCourses = () => {
    if (importedCourses.length === 0) {
      setImportMessage("Import a valid Excel export before saving.");
      return;
    }

    const savedCourses = importedCourses.map((course, index) => ({
      ...course,
      id: `imported-course-${Date.now()}-${index}`,
    }));

    setCourses((current) => [...savedCourses, ...current]);
    setSelectedCourseId("");
    setSavedRecordRows((current) => [...importedRecordRows, ...current]);
    setImportedCourses([]);
    setImportedRecordRows([]);
    setImportMessage(
      `Saved ${savedCourses.length} imported courses and ${importedRecordRows.length} record rows from ${importFileName}.`,
    );
  };

  return (
    <section className={styles.page} aria-label="Training Record module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingRecordModule.subtitle}</p>
          <h2>{trainingRecordModule.title}</h2>
          <p>{trainingRecordModule.description}</p>
        </div>
        <div className={styles.heroMeta}>
          <span>{availableCourses.length} completed courses</span>
          <span>
            {selectedCourseOwner
              ? selectedCourseOwner === "CENTER"
                ? "Center owner"
                : "Factory owner"
              : "Select owner"}
          </span>
        </div>
      </section>

      <section className={styles.courseSelectPanel} aria-label="Completed course selector">
        <div>
          <p className={styles.kicker}>Course Owner</p>
          <h3>Select owner first</h3>
        </div>
        <div className={styles.courseSelectorControls}>
          <label>
            Course Owner
            <select
              disabled={isFactoryUser}
              value={selectedCourseOwner}
              onChange={(event) => {
                setCourseOwnerFilter(event.target.value as CourseOwnerFilter);
                setSelectedCourseId("");
                setDownloadMessage("");
              }}
            >
              <option value="">Select Course Owner</option>
              <option value="CENTER">Center</option>
              <option value="FACTORY">Factory</option>
            </select>
          </label>
          <label>
            Course
            <select
              disabled={!selectedCourseOwner}
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setDownloadMessage("");
              }}
            >
              <option value="">
                {!selectedCourseOwner
                  ? "Select course owner first"
                  : ownerFilteredCourses.length > 0
                    ? "Select completed course"
                    : `No ${selectedCourseOwner.toLowerCase()} course available`}
              </option>
              {ownerFilteredCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.source === "UPLOAD" ? "Upload" : "System"} / {course.code} / {course.title} / {course.company}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.importPanel} aria-label="Import completed courses from Excel">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Excel Import</p>
            <h3>Import completed training records</h3>
          </div>
          <span>{importScopeLabel}</span>
        </div>
        <p className={styles.importScopeNote}>{importScopeNote}</p>

        <div className={styles.importWorkspace}>
          <label className={styles.importDropBox}>
            <span>Excel export file</span>
            <strong>{importFileName || "Choose CSV / TSV / XLS file"}</strong>
            <small>
              Required columns: Course Code, Course Title. Optional: Date, Company, Room,
              Instructor, Actual Attendees, Registered Attendees, scores, and costs.
            </small>
            <input
              accept=".csv,.tsv,.xls,.xlsx"
              onChange={(event) => void handleImportFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>

          <div className={styles.importPreview}>
            <div>
              <span>Preview</span>
              <strong>{importedCourses.length} courses / {importedRecordRows.length} records</strong>
            </div>
            <button type="button" onClick={handleSaveImportedCourses}>
              Save Imported Courses
            </button>
          </div>
        </div>

        {importedCourses.length > 0 ? (
          <div className={styles.importCourseList}>
            {importedCourses.slice(0, 4).map((course) => (
              <article key={`${course.code}-${course.title}`}>
                <strong>{course.title}</strong>
                <span>{course.code} / {course.company} / {course.date}</span>
              </article>
            ))}
          </div>
        ) : null}

        {importMessage ? <p className={styles.downloadMessage}>{importMessage}</p> : null}
      </section>

      {selectedCourse ? (
      <section className={styles.completedRecordWorkspace}>
        <div className={styles.completedCourseDetail}>
          <section className={styles.completedCourseHero}>
            <div>
              <p className={styles.kicker}>Course Record</p>
              <h3>{selectedCourse.title}</h3>
              <span>
                {selectedCourse.code} / {selectedCourse.date} / {selectedCourse.room} / {selectedCourse.instructor}
              </span>
            </div>
            <b className={selectedCourse.source === "UPLOAD" ? styles.uploadSourceBadge : styles.systemSourceBadge}>
              {selectedCourse.source === "UPLOAD" ? "From Upload" : "From System"}
            </b>
            <button type="button" onClick={handleExportCourseSummary}>
              Export Excel
            </button>
          </section>

          <section className={styles.costBreakdownPanel} aria-label="Actual cost breakdown">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Actual Cost</p>
                <h3>Cost Breakdown</h3>
              </div>
              <span>THB {formatNumber(selectedActualCost)}</span>
            </div>

            <div className={styles.costBreakdownGrid}>
              {expenseItems.map((item) => (
                <article key={item.key}>
                  <span>{item.label}</span>
                  <strong>THB {formatNumber(selectedCourse.actualCost[item.key])}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.courseExcelRecordPanel} aria-label="Course uploaded record details">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Training Record Details</p>
                <h3>Employee records from {selectedCourse.source === "UPLOAD" ? "upload" : "system"}</h3>
              </div>
              <span>{selectedUploadedRows.length} rows</span>
            </div>

            {selectedUploadedRows.length > 0 ? (
              <div className={styles.courseExcelTableWrap}>
                <table className={styles.courseExcelTable}>
                  <thead>
                    <tr>
                      <th>Emp Code</th>
                      <th>ID Card</th>
                      <th>Title(TH)</th>
                      <th>Name(TH)</th>
                      <th>SurName(TH)</th>
                      <th>Course Code</th>
                      <th>Course Name</th>
                      <th>Group No.</th>
                      <th>Instructor</th>
                      <th>Institute</th>
                      <th>Training Place</th>
                      <th>Training Hour</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Expense/Person</th>
                      <th>Function(TH)</th>
                      <th>Function(EN)</th>
                      <th>Log Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUploadedRows.map((record) => (
                      <tr key={record.id}>
                        <td>{record.empCode || "-"}</td>
                        <td>{record.idCard || "-"}</td>
                        <td>{record.titleTh || "-"}</td>
                        <td>{record.nameTh || "-"}</td>
                        <td>{record.surnameTh || "-"}</td>
                        <td>{record.courseCode || "-"}</td>
                        <td>{record.courseName || "-"}</td>
                        <td>{record.groupNo || "-"}</td>
                        <td>{record.instructor || "-"}</td>
                        <td>{record.institute || "-"}</td>
                        <td>{record.trainingPlace || "-"}</td>
                        <td>{record.trainingHour || "-"}</td>
                        <td>{record.startDate || "-"}</td>
                        <td>{record.endDate || "-"}</td>
                        <td>{record.expensePerPerson || "-"}</td>
                        <td>{record.functionTh || "-"}</td>
                        <td>{record.functionEn || "-"}</td>
                        <td>{record.logDate || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.emptyState}>
                No uploaded Excel record rows are linked with this course yet.
              </p>
            )}
          </section>

          <section className={styles.recordChartGrid}>
            <article className={styles.chartPanel}>
              <div
                className={styles.donutChart}
                style={{ "--value": `${selectedCourse.preTestPassPercent}%` } as CSSProperties}
                aria-label={`Pre test pass rate ${selectedCourse.preTestPassPercent}%`}
              >
                <strong>{selectedCourse.preTestPassPercent}%</strong>
                <span>Pass</span>
              </div>
              <div>
                <p className={styles.kicker}>Pre Test</p>
                <h3>Before Training</h3>
                <span>Most attendees did not pass before training.</span>
              </div>
            </article>

            <article className={styles.chartPanel}>
              <div
                className={styles.donutChart}
                style={{ "--value": `${selectedCourse.postTestPassPercent}%` } as CSSProperties}
                aria-label={`Post test pass rate ${selectedCourse.postTestPassPercent}%`}
              >
                <strong>{selectedCourse.postTestPassPercent}%</strong>
                <span>Pass</span>
              </div>
              <div>
                <p className={styles.kicker}>Post Test</p>
                <h3>After Training</h3>
                <span>Pass rate after course completion.</span>
              </div>
            </article>

            <article className={styles.chartPanel}>
              <div
                className={styles.donutChart}
                style={{ "--value": `${evaluationPercent}%` } as CSSProperties}
                aria-label={`Evaluation completion ${evaluationPercent}%`}
              >
                <strong>{evaluationPercent}%</strong>
                <span>Done</span>
              </div>
              <div>
                <p className={styles.kicker}>Evaluation Form</p>
                <h3>{selectedCourse.evaluationCompleted}/{selectedCourse.evaluationTotal} completed</h3>
                <span>Download by person or export all evaluation forms.</span>
              </div>
            </article>
          </section>

          <section className={styles.evaluationDownloadPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Actual Attendees</p>
                <h3>Evaluation Download by Company / Person</h3>
              </div>
              <button type="button" onClick={() => handleDownload("All evaluation forms")}>
                Download All Forms
              </button>
            </div>

            <div className={styles.companyAccordionList} aria-label="Actual attendees by company">
              {attendeesByCompany.map(([company, attendees], index) => (
                <details className={styles.companyAccordion} key={company} open={index === 0}>
                  <summary>
                    <div>
                      <span>{company}</span>
                      <strong>{attendees.length} actual attendees</strong>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        handleDownload(`${company} evaluation forms`);
                      }}
                    >
                      Download Company Forms
                    </button>
                  </summary>

                  <div className={styles.companyAttendeeList}>
                    {attendees.map((attendee) => (
                      <article key={attendee.id}>
                        <div>
                          <strong>{attendee.name}</strong>
                          <span>{attendee.employeeCode} / {attendee.department}</span>
                        </div>
                        <span className={styles.statusPill}>{attendee.prePost}</span>
                        <span className={styles.statusPill}>{attendee.evaluation}</span>
                        <button
                          className={styles.detailButton}
                          type="button"
                          onClick={() => handleDownload(`${attendee.name} evaluation form`)}
                        >
                          Download Form
                        </button>
                      </article>
                    ))}
                  </div>
                </details>
              ))}
            </div>

            {downloadMessage ? <p className={styles.downloadMessage}>{downloadMessage}</p> : null}
          </section>
        </div>
      </section>
      ) : (
        <section className={styles.emptyState} aria-label="No selected course">
          Select a completed course first to view training record details.
        </section>
      )}
    </section>
  );
}
