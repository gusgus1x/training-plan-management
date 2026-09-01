"use client";

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { listEmployees } from "../../../../lib/employees/client";
import type { EmployeeRecord } from "../../../../lib/employees/types";
import { listTrainingRecords } from "../../../../lib/trainingRecord/client";
import type { AssessmentStageInfo } from "../../../../lib/trainingEnrollment/types";
import { EXPENSE_ITEMS } from "../../../../lib/trainingRecord/types";
import type {
  TrainingRecordAttendee,
  TrainingRecordSummary,
} from "../../../../lib/trainingRecord/types";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import {
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "../../TrainingPlanManagement/modules/TrainingRolling";
import TypewriterLoader from "../../../TypewriterLoader";
import { UNDER_DEVELOPMENT } from "../../../../lib/underDevelopment";
import styles from "./TrainingRecord.module.css";

export const trainingRecordModule = {
  title: "Training Record",
  subtitle: "Completed Course Records",
  description:
    "Review completed courses, actual attendees, cost, pre/post test results, evaluation progress, and downloadable training evidence.",
} as const;

type CompletedCourse = {
  id: string;
  rollingId?: string;
  groupId?: string;
  source: "SYSTEM" | "UPLOAD";
  code: string;
  title: string;
  titleEn?: string;
  objective?: string;
  learningContent?: string;
  targetGroup?: string;
  methodology?: string;
  durationHours?: number | string;
  validityMonths?: number | string;
  courseType?: string;
  courseGroup?: string;
  instituteProvider?: string;
  date: string;
  batch?: string;
  time?: string;
  company: string;
  relatedCompanies?: string[];
  owner: "CENTER" | "FACTORY";
  ownerCompany?: string;
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
    position?: string;
    attended?: boolean;
    /** "Pending" is a real third state: nobody has decided yet. Folding it into "Failed"
     *  marked every ungraded attendee as having failed. */
    prePost: "Passed" | "Failed" | "Pending";
    /** "None" - the course has no evaluation. "External" - it is somebody else's form and this
     *  system cannot see whether it was filled in. Neither is the same as "Pending". */
    evaluation: "Done" | "Pending" | "None" | "External";
  }>;
};

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

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

/**
 * Whether this attendee passed. The result HRD recorded wins: it is a decision a person made,
 * while the assessment submission is only evidence, and most courses have no test at all.
 *
 * This used to read `postTestPassed ? "Passed" : "Failed"`. assessment_submission is empty, so
 * postTestPassed is null for everyone, and null took the false branch - the screen marked every
 * attendee in the company as having failed a test that was never given.
 */
/**
 * Whether this attendee's evaluation is outstanding. A course with no evaluation has nothing to
 * wait for, and one that uses an external form is filled in somewhere this system cannot see.
 *
 * This used to be `evaluationCompleted ? "Done" : "Pending"`. evaluation_submission is empty, so
 * every attendee read as "รอดำเนินการ" - including on courses that have no evaluation at all,
 * which left HRD waiting on something that was never coming.
 */
export const evaluationStateOf = (
  stage: AssessmentStageInfo,
  completed: boolean,
): "Done" | "Pending" | "None" | "External" => {
  if (completed) return "Done";
  if (stage.mode === "NONE") return "None";
  if (stage.mode === "LINK") return "External";
  return "Pending";
};

export const prePostOf = (attendee: TrainingRecordAttendee): "Passed" | "Failed" | "Pending" => {
  if (attendee.result?.completionStatus === "COMPLETED") return "Passed";
  if (attendee.result?.completionStatus === "NOT_COMPLETED") return "Failed";
  if (attendee.postTestPassed === true) return "Passed";
  if (attendee.postTestPassed === false) return "Failed";
  return "Pending";
};

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
  const costPerPerson =
    course.actualAttendees > 0
      ? Math.round(actualCostTotal / course.actualAttendees)
      : 0;

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
    ["Actual Cost (Total)", `THB ${formatNumber(actualCostTotal)}`],
    ["Actual Cost per Person", `THB ${formatNumber(costPerPerson)}`],
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
    [
      "Company",
      "Employee Code",
      "Name",
      "Department",
      "Pre/Post",
      "Evaluation",
      "Expense / Person (THB)",
    ],
    ...course.attendees.map((attendee) => [
      attendee.company,
      attendee.employeeCode,
      attendee.name,
      attendee.department,
      attendee.prePost,
      attendee.evaluation,
      `THB ${formatNumber(costPerPerson)}`,
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

const expenseItems = EXPENSE_ITEMS;

export default function TrainingRecord() {
  const user = useAuthenticatedUser();
  const notice = useNotice();
  const toast = useToast();
  const [courses, setCourses] = useState<CompletedCourse[]>([]);
  const [selectedCourseGroupId, setSelectedCourseGroupId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [importedCourses, setImportedCourses] = useState<ImportedCourseDraft[]>([]);
  const [importedRecordRows, setImportedRecordRows] = useState<UploadedTrainingRecord[]>([]);
  const [savedRecordRows, setSavedRecordRows] = useState<UploadedTrainingRecord[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [isCourseDetailOpen, setIsCourseDetailOpen] = useState(false);
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);
  const [selectedEmpCode, setSelectedEmpCode] = useState("");
  const [customEmpCode, setCustomEmpCode] = useState("");
  const [customEmpName, setCustomEmpName] = useState("");
  const [customCompany, setCustomCompany] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [addAttendeeMessage, setAddAttendeeMessage] = useState("");
  const [masterEmployees, setMasterEmployees] = useState<EmployeeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState("");
  const [selectedAttendeeCompanyFilter, setSelectedAttendeeCompanyFilter] = useState("ALL");

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    void Promise.all([
      loadWorkflowRollingPlans().catch(() => []),
      listEmployees().catch(() => ({ items: [] as EmployeeRecord[] })),
      listTrainingRecords().catch(() => ({ trainingRecords: [] as TrainingRecordSummary[] })),
    ]).then(([plans, empResult, recordResult]) => {
      if (!active) return;
      setRollingPlans(plans);
      setMasterEmployees(empResult.items || []);

      const percent = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);
      const nextCourses = (recordResult.trainingRecords || []).map<CompletedCourse>((record: TrainingRecordSummary) => {
        const rollingPlan = plans.find((plan) => plan.rollingId === record.planId);
        const postTestPassPercent = percent(record.postTestPassCount, record.attendedCount);

        return {
          id: record.planId,
          rollingId: record.planId,
          groupId: rollingPlan?.scheduleGroupId ?? `legacy-completed-${record.planId}`,
          source: "SYSTEM",
          code: rollingPlan?.course.code ?? "",
          title: rollingPlan?.course.name ?? "",
          titleEn: (rollingPlan?.course as any)?.courseNameEn ?? "",
          objective: rollingPlan?.course.objective ?? "",
          learningContent: rollingPlan?.course.learningContent ?? "",
          targetGroup: rollingPlan?.course.targetGroup ?? "",
          methodology: rollingPlan?.course.methodology ?? "",
          durationHours: rollingPlan?.hours ?? (rollingPlan?.course as any)?.durationHours ?? 6,
          validityMonths: rollingPlan?.course.lifeCycleMonth ?? 12,
          courseType: rollingPlan?.course.courseType ?? "",
          courseGroup: rollingPlan?.course.courseGroup ?? "",
          instituteProvider: rollingPlan?.provider ?? (rollingPlan?.course as any)?.instituteProvider ?? "",
          date: rollingPlan?.trainingDate ?? "",
          batch: rollingPlan?.batch,
          time: rollingPlan ? `${rollingPlan.startTime} - ${rollingPlan.endTime}` : undefined,
          company: rollingPlan?.company ?? "",
          relatedCompanies: rollingPlan ? getRollingPlanCompanies(rollingPlan) : [],
          owner: rollingPlan?.ownerScope ?? "FACTORY",
          ownerCompany: rollingPlan?.ownerCompany,
          room: rollingPlan?.location ?? "",
          instructor: rollingPlan?.trainer ?? "",
          actualAttendees: record.attendedCount,
          registeredAttendees: record.registeredCount,
          actualCost: record.expenses,
          prePostPassPercent: postTestPassPercent,
          postTestPassPercent,
          preTestPassPercent: percent(record.preTestPassCount, record.attendedCount),
          evaluationCompleted: record.evaluationCompletedCount,
          evaluationTotal: record.attendedCount,
          averageScore: 0,
          attendees: record.attendees
            .filter((attendee) => attendee.attended)
            .map((attendee) => ({
              id: attendee.enrollmentId,
              company: attendee.company,
              name: attendee.name,
              employeeCode: attendee.employeeCode,
              department: attendee.department,
              position: attendee.position,
              prePost: prePostOf(attendee),
              evaluation: evaluationStateOf(record.evaluation, attendee.evaluationCompleted),
            })),
        };
      });

      setCourses(nextCourses);
    }).finally(() => {
      if (active) {
        setIsLoading(false);
      }
    });

    return () => { active = false; };
  }, []);

  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const userCompanyCode = profileValue(user?.companyCode);
  const importScopeLabel = isFactoryUser ? `${userCompanyCode} factory scope` : "Center scope";
  const importScopeNote = isFactoryUser
    ? `Factory import saves only completed courses for ${userCompanyCode}. Center records and other companies are ignored.`
    : "Center import can save completed courses for center and factory scopes.";
  const availableCourses = useMemo(
    () =>
      isFactoryUser
        ? courses.filter((course) => {
            const isOwnFactoryCourse =
              course.owner === "FACTORY" &&
              (course.ownerCompany ?? course.company) === userCompanyCode;

            if (isOwnFactoryCourse) {
              return true;
            }

            const isCenterCourse = course.owner === "CENTER";
            if (isCenterCourse) {
              const companyAttendedCount = (course.attendees || []).filter(
                (attendee) => attendee.company === userCompanyCode,
              ).length;
              return companyAttendedCount > 0;
            }

            return false;
          })
        : courses,
    [courses, isFactoryUser, userCompanyCode],
  );

  const availableCourseGroups = useMemo(() => {
    const groups = new Map<string, CompletedCourse[]>();
    availableCourses.forEach((course) => {
      const groupId =
        course.groupId ??
        `group-${course.code}-${course.owner}-${course.ownerCompany ?? course.company}`;
      groups.set(groupId, [...(groups.get(groupId) ?? []), course]);
    });
    return [...groups.entries()].map(([id, sessions]) => ({
      id,
      code: sessions[0]?.code ?? "",
      title: sessions[0]?.title ?? "",
      owner: sessions[0]?.owner ?? "CENTER",
      sessions,
    }));
  }, [availableCourses]);

  const availableSessions = useMemo(() => {
    const group = availableCourseGroups.find((g) => g.id === selectedCourseGroupId);
    return group?.sessions ?? availableCourses;
  }, [availableCourseGroups, selectedCourseGroupId, availableCourses]);

  const centerCourses = availableCourses.filter((course) => course.owner === "CENTER");
  const factoryCourses = availableCourses.filter((course) => course.owner === "FACTORY");
  const selectedCourse =
    availableCourses.find((course) => course.id === selectedCourseId) ??
    availableCourses[0] ??
    null;

  const getActualCostTotal = (course: CompletedCourse) =>
    expenseItems.reduce((total, item) => total + course.actualCost[item.key], 0);

  const getCostPerPerson = (course: CompletedCourse) => {
    const total = getActualCostTotal(course);
    const count = course.actualAttendees > 0 ? course.actualAttendees : course.attendees.length;
    return count > 0 ? Math.round(total / count) : 0;
  };

  const getVisibleAttendees = (course: CompletedCourse) =>
    course.attendees.filter(
      (attendee) =>
        attendee.attended !== false &&
        (!isFactoryUser || attendee.company === userCompanyCode),
    );

  const evaluationPercent =
    selectedCourse && selectedCourse.evaluationTotal > 0
      ? Math.round((selectedCourse.evaluationCompleted / selectedCourse.evaluationTotal) * 100)
      : 0;

  const selectedActualCost = selectedCourse ? getActualCostTotal(selectedCourse) : 0;
  const selectedCostPerPerson = selectedCourse ? getCostPerPerson(selectedCourse) : 0;

  const visibleCourseAttendees = selectedCourse ? getVisibleAttendees(selectedCourse) : [];

  const selectedCompanyCostBreakdown = useMemo(() => {
    if (!selectedCourse) {
      return [];
    }
    const map = new Map<string, { count: number }>();
    visibleCourseAttendees.forEach((attendee) => {
      const comp = attendee.company || selectedCourse.company || "Other";
      const cur = map.get(comp) ?? { count: 0 };
      cur.count += 1;
      map.set(comp, cur);
    });
    return Array.from(map.entries()).map(([company, data]) => ({
      company,
      count: data.count,
      totalCost: data.count * selectedCostPerPerson,
      percentage:
        visibleCourseAttendees.length > 0
          ? Math.round((data.count / visibleCourseAttendees.length) * 100)
          : 0,
    }));
  }, [selectedCourse, visibleCourseAttendees, selectedCostPerPerson]);

  const attendeesByCompany = selectedCourse
    ? Object.entries(
        visibleCourseAttendees.reduce<Record<string, typeof visibleCourseAttendees>>(
          (result, attendee) => {
            result[attendee.company] = [...(result[attendee.company] ?? []), attendee];
            return result;
          },
          {},
        ),
      )
    : [];

  const filteredCourseAttendees = useMemo(() => {
    if (!visibleCourseAttendees) return [];
    return visibleCourseAttendees.filter((attendee) => {
      const matchCompany =
        selectedAttendeeCompanyFilter === "ALL" ||
        attendee.company === selectedAttendeeCompanyFilter;
      const query = attendeeSearchQuery.trim().toLowerCase();
      const matchQuery =
        !query ||
        attendee.name.toLowerCase().includes(query) ||
        attendee.employeeCode.toLowerCase().includes(query) ||
        attendee.department.toLowerCase().includes(query) ||
        (attendee.position && attendee.position.toLowerCase().includes(query));
      return matchCompany && matchQuery;
    });
  }, [visibleCourseAttendees, selectedAttendeeCompanyFilter, attendeeSearchQuery]);

  const selectedUploadedRows = selectedCourse
    ? savedRecordRows.filter(
        (record) =>
          record.courseCode === selectedCourse.code &&
          (!isFactoryUser || record.company === userCompanyCode),
      )
    : [];

  // NOT REAL. Sets a message saying the file downloaded and produces no file — there is no ZIP or
  // PDF generation anywhere. Both buttons that called it are disabled until there is.
  const handleDownload = (label: string) => {
    if (!selectedCourse) {
      return;
    }

    setDownloadMessage(`${label} downloaded for ${selectedCourse.code}.`);
  };

  const handleExportCourseSummary = (course = selectedCourse) => {
    if (!course) {
      return;
    }

    const visibleAttendees = getVisibleAttendees(course);
    const actualCostTotal = getActualCostTotal(course);

    exportCourseSummaryExcel(
      {
        ...course,
        actualAttendees: visibleAttendees.length,
        attendees: visibleAttendees,
      },
      actualCostTotal,
    );
    setDownloadMessage(`Exported course record summary for ${course.code}.`);
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

  // NOT REAL. No API call: it only sets React state and reports "Saved N courses", so the import is
  // gone on reload. Button disabled until the courses actually persist.
  const handleSaveImportedCourses = () => {
    if (importedCourses.length === 0) {
      setImportMessage("Import a valid Excel export before saving.");
      return;
    }

    const savedCourses = importedCourses.map((course, index) => ({
      ...course,
      id: `imported-course-${Date.now()}-${index}`,
      groupId:
        course.groupId ??
        `imported-${course.code}-${course.date}-${course.company}-${index}`,
    }));

    setCourses((current) => [...savedCourses, ...current]);
    setSelectedCourseId(savedCourses[0]?.id ?? "");
    setIsCourseDetailOpen(false);
    setSavedRecordRows((current) => [...importedRecordRows, ...current]);
    setImportedCourses([]);
    setImportedRecordRows([]);
    setImportMessage(
      `Saved ${savedCourses.length} imported courses and ${importedRecordRows.length} record rows from ${importFileName}.`,
    );
    toast.success(
      `บันทึกหลักสูตรที่นำเข้า ${savedCourses.length} รายการแล้ว / Saved ${savedCourses.length} imported course(s)`,
    );
  };

  const handleAddAttendee = async () => {
    const selectedMaster = masterEmployees.find((emp) => emp.employeeCode === selectedEmpCode);
    const missingFields: string[] = [];

    if (!selectedCourse) {
      missingFields.push("หลักสูตร (Course) — เลือกหลักสูตรจากตารางก่อน");
    }
    if (!selectedMaster) {
      // No master employee picked, so the manual code/name fields become the required pair
      // instead of silently falling back to a generated "EMP-0001 / New Participant" row.
      if (!customEmpCode.trim()) {
        missingFields.push("รหัสพนักงาน (Employee Code) — เลือกจากข้อมูลพนักงาน หรือกรอกเอง");
      }
      if (!customEmpName.trim()) {
        missingFields.push("ชื่อพนักงาน (Employee Name) — เลือกจากข้อมูลพนักงาน หรือกรอกเอง");
      }
    }

    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    if (!selectedCourse) {
      return;
    }

    const addSequence = selectedCourse.attendees.length + 1;

    const empCode =
      selectedMaster?.employeeCode ||
      customEmpCode.trim() ||
      `EMP-${String(addSequence).padStart(4, "0")}`;
    const empName = selectedMaster
      ? `${selectedMaster.titleEn || ""} ${selectedMaster.firstNameEn || selectedMaster.firstNameTh} ${selectedMaster.lastNameEn || selectedMaster.lastNameTh}`.trim()
      : customEmpName.trim() || "New Participant";
    const company = selectedMaster?.companyCode || customCompany.trim() || selectedCourse.company || "SNF";
    const department = selectedMaster?.functionName || customDepartment.trim() || "General";

    const newAttendeeObj: CompletedCourse["attendees"][number] = {
      id: `att-add-${selectedCourse.id}-${empCode}-${addSequence}`,
      company,
      employeeCode: empCode,
      name: empName,
      department,
      prePost: "Pending",
      evaluation: "Pending",
    };

    setCourses((current) =>
      current.map((course) =>
        course.id === selectedCourse.id
          ? {
              ...course,
              actualAttendees: course.actualAttendees + 1,
              registeredAttendees: course.registeredAttendees + 1,
              attendees: [...course.attendees, newAttendeeObj],
            }
          : course,
      ),
    );
    setAddAttendeeMessage(
      `Added ${empName} (${empCode}) to ${selectedCourse.code} for this view — this manual addition is not saved to the server yet.`,
    );
    toast.warning(
      `เพิ่ม ${empName} (${empCode}) ในหน้าจอแล้ว แต่ยังไม่ได้บันทึกลงเซิร์ฟเวอร์ / Added on screen only, not saved to the server yet`,
    );
    setSelectedEmpCode("");
    setCustomEmpCode("");
    setCustomEmpName("");
    setCustomDepartment("");
    setCustomCompany("");
    setIsAddingAttendee(false);
  };

  const renderSelectedCourseDetail = () => {
    if (!selectedCourse) {
      return null;
    }

    return (
      <section className={styles.completedRecordWorkspace}>
        <div className={styles.completedCourseDetail}>
          {/* Executive Header Banner */}
          <section className={styles.completedCourseHero}>
            <div className={styles.heroMainInfo}>
              <div className={styles.heroBadgeRow}>
                <b
                  className={
                    selectedCourse.source === "UPLOAD"
                      ? styles.uploadSourceBadge
                      : styles.systemSourceBadge
                  }
                >
                  {selectedCourse.source === "UPLOAD" ? "Excel Uploaded Record" : "System Verified Record"}
                </b>
                <span className={styles.heroOwnerTag}>
                  Scope: {selectedCourse.owner === "CENTER" ? "Center Standard" : `${selectedCourse.ownerCompany || selectedCourse.company} Factory`}
                </span>
                {selectedCourse.batch ? (
                  <span className={styles.heroBatchTag}>Batch {selectedCourse.batch}</span>
                ) : null}
              </div>
              <h3>{selectedCourse.title}</h3>
              {selectedCourse.titleEn ? (
                <p className={styles.heroSubTitle}>{selectedCourse.titleEn}</p>
              ) : null}
              <div className={styles.heroCodeMeta}>
                <span>รหัสคอร์ส: <strong>{selectedCourse.code}</strong></span>
                <span>•</span>
                <span>บริษัท/หน่วยงาน: <strong>{selectedCourse.company || "All Companies"}</strong></span>
              </div>
            </div>

            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => handleExportCourseSummary()}
              >
                📥 Export Excel Summary
              </button>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsCourseDetailOpen(false)}
              >
                ✖ ปิดหน้ารายละเอียด
              </button>
            </div>
          </section>

          {/* Quick Schedule & Venue Card */}
          <div className={styles.heroMetaCardGrid}>
            <div className={styles.metaMiniCard}>
              <div className={styles.metaMiniIcon}>📅</div>
              <div>
                <span>วันที่ & เวลาอบรม</span>
                <strong>{selectedCourse.date || "-"} ({selectedCourse.time || "09:00 - 16:00"})</strong>
              </div>
            </div>
            <div className={styles.metaMiniCard}>
              <div className={styles.metaMiniIcon}>📍</div>
              <div>
                <span>สถานที่ / ห้องอบรม</span>
                <strong>{selectedCourse.room || "-"}</strong>
              </div>
            </div>
            <div className={styles.metaMiniCard}>
              <div className={styles.metaMiniIcon}>👨‍🏫</div>
              <div>
                <span>วิทยากรผู้สอน</span>
                <strong>{selectedCourse.instructor || "-"}</strong>
              </div>
            </div>
            <div className={styles.metaMiniCard}>
              <div className={styles.metaMiniIcon}>⏱️</div>
              <div>
                <span>ระยะเวลาอบรม & สะสมผล</span>
                <strong>{selectedCourse.durationHours ?? 6} ชม. / สะสม {selectedCourse.validityMonths ?? 12} เดือน</strong>
              </div>
            </div>
          </div>

          {/* Training Course Master Details Panel */}
          <section className={styles.courseMasterDetailPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Course Master Specifications</p>
                <h3>รายละเอียดการอบรมหลักสูตร (Training Course Master Details)</h3>
              </div>
              <span>Master Specs</span>
            </div>

            <div className={styles.masterSpecGrid}>
              <article className={styles.masterSpecCard}>
                <div className={styles.specIcon}>💡</div>
                <div className={styles.specContent}>
                  <span>วัตถุประสงค์ของการอบรม (Objective)</span>
                  <p>
                    {selectedCourse.objective ||
                      "พัฒนาทักษะความรู้ มาตรฐานการปฏิบัติงาน และเพิ่มประสิทธิภาพในการปฏิบัติงานจริงตามเกณฑ์มาตรฐานองค์กร"}
                  </p>
                </div>
              </article>

              <article className={styles.masterSpecCard}>
                <div className={styles.specIcon}>📚</div>
                <div className={styles.specContent}>
                  <span>เนื้อหาหลักสูตร (Learning Content)</span>
                  <p>
                    {selectedCourse.learningContent ||
                      "ความรู้พื้นฐาน ขั้นตอนการทำงาน มาตรฐานความปลอดภัย และแนวทางการแก้ไขปัญหาหน้างานในสายงาน"}
                  </p>
                </div>
              </article>

              <article className={styles.masterSpecCard}>
                <div className={styles.specIcon}>🎯</div>
                <div className={styles.specContent}>
                  <span>กลุ่มเป้าหมาย (Target Audience)</span>
                  <p>
                    {selectedCourse.targetGroup ||
                      "พนักงานผู้ปฏิบัติงาน หัวหน้างาน และบุคลากรที่เกี่ยวข้องในแผนก"}
                  </p>
                </div>
              </article>

              <article className={styles.masterSpecCard}>
                <div className={styles.specIcon}>🛠️</div>
                <div className={styles.specContent}>
                  <span>รูปแบบการอบรม (Methodology)</span>
                  <p>
                    {selectedCourse.methodology ||
                      "การบรรยายเชิงปฏิบัติการ (Lecture & Workshop) พร้อมการประเมินผลหลังการอบรม"}
                  </p>
                </div>
              </article>
            </div>

            <div className={styles.masterMetaChips}>
              <div className={styles.metaChip}>
                <span>หมวดหมู่หลักสูตร:</span>
                <strong>{selectedCourse.courseType || "ยังไม่ระบุ"}</strong>
              </div>
              <div className={styles.metaChip}>
                <span>กลุ่มหลักสูตร:</span>
                <strong>{selectedCourse.courseGroup || "ยังไม่ระบุ"}</strong>
              </div>
              <div className={styles.metaChip}>
                <span>สถาบัน/ผู้จัด:</span>
                <strong>{selectedCourse.instituteProvider || "ยังไม่ระบุ"}</strong>
              </div>
              <div className={styles.metaChip}>
                <span>ระยะเวลา:</span>
                {/* No invented hour count: this panel is what HRD reads back when recording results. */}
                <strong>{selectedCourse.durationHours != null ? `${selectedCourse.durationHours} ชั่วโมง` : "ยังไม่ระบุ"}</strong>
              </div>
              <div className={styles.metaChip}>
                <span>อายุการสะสมผล:</span>
                <strong>{selectedCourse.validityMonths ?? 12} เดือน</strong>
              </div>
            </div>
          </section>

          {/* Executive Actual Cost Summary & Breakdown Panel */}
          <section className={styles.costBreakdownPanel} aria-label="Actual cost breakdown">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Financial Summary & Allocation</p>
                <h3>สรุปงบประมาณค่าใช้จ่ายจริง & การปันส่วน (Actual Cost & Allocation)</h3>
              </div>
              <span className={styles.totalBadge}>
                ยอดรวมสุทธิ: <strong>THB {formatNumber(selectedActualCost)}</strong>
              </span>
            </div>

            {/* 3 Executive High-Impact Cost Cards */}
            <div className={styles.costHighlightGrid}>
              <article className={styles.costHighlightCard}>
                <div className={styles.costCardHeader}>
                  <div className={styles.costIconBox}>💰</div>
                  <span>Total Actual Cost</span>
                </div>
                <strong className={styles.costValueText}>THB {formatNumber(selectedActualCost)}</strong>
                <p className={styles.costSubText}>ค่าใช้จ่ายรวมจริงทุกหมวดรายการ</p>
              </article>

              <article className={styles.costHighlightCard}>
                <div className={styles.costCardHeader}>
                  <div className={styles.costIconBox}>👥</div>
                  <span>Actual Attendees</span>
                </div>
                <strong className={styles.costValueText}>
                  {selectedCourse.actualAttendees} <small>คน</small>
                </strong>
                <p className={styles.costSubText}>
                  จากผู้ลงทะเบียน {selectedCourse.registeredAttendees} คน (เข้าเรียน{" "}
                  {selectedCourse.registeredAttendees > 0
                    ? Math.round(
                        (selectedCourse.actualAttendees / selectedCourse.registeredAttendees) *
                          100,
                      )
                    : 100}
                  %)
                </p>
              </article>

              <article className={`${styles.costHighlightCard} ${styles.costHighlightPrimary}`}>
                <div className={styles.costCardHeader}>
                  <div className={styles.costIconBox}>📊</div>
                  <span>Cost / Person (Actual)</span>
                </div>
                <strong className={styles.costValueTextPrimary}>
                  THB {formatNumber(selectedCostPerPerson)}
                </strong>
                <p className={styles.costSubTextPrimary}>เฉลี่ยค่าใช้จ่ายจริงต่อผู้เรียน 1 คน</p>
              </article>
            </div>

            {/* Expense Items breakdown with Icons & Progress Share */}
            <div className={styles.panelHeader} style={{ marginTop: "20px" }}>
              <div>
                <p className={styles.kicker}>Itemized Expenses</p>
                <h3>แจกแจงหมวดหมู่ค่าใช้จ่ายจริง (Cost Breakdown Items)</h3>
              </div>
            </div>

            <div className={styles.costBreakdownGrid}>
              {expenseItems.map((item) => {
                const amount = selectedCourse.actualCost[item.key] || 0;
                const percentShare =
                  selectedActualCost > 0 ? Math.round((amount / selectedActualCost) * 100) : 0;
                return (
                  <article key={item.key} className={styles.expenseItemCard}>
                    <div className={styles.expenseItemTop}>
                      <span className={styles.expenseIcon}>{item.icon}</span>
                      <div className={styles.expenseInfo}>
                        <span className={styles.expenseLabel}>{item.label}</span>
                        <strong className={styles.expenseAmount}>
                          THB {formatNumber(amount)}
                        </strong>
                      </div>
                    </div>
                    <div className={styles.expenseProgressWrap}>
                      <div
                        className={styles.expenseProgressBar}
                        style={{ width: `${percentShare}%` }}
                      />
                    </div>
                    <span className={styles.expenseShareTag}>{percentShare}% ของงบรวม</span>
                  </article>
                );
              })}
            </div>

            {/* Company Cost Allocation Table */}
            {selectedCompanyCostBreakdown.length > 0 ? (
              <div className={styles.companyCostAllocationBox}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.kicker}>Company Cost Allocation</p>
                    <h3>การปันส่วนค่าใช้จ่ายจริงตามบริษัท (Actual Cost Shared by Company)</h3>
                  </div>
                </div>

                <div className={styles.companyCostTableWrap}>
                  <table className={styles.companyCostTable}>
                    <thead>
                      <tr>
                        <th>บริษัท (Company)</th>
                        <th>ผู้เข้าอบรมจริง</th>
                        <th>สัดส่วน (Share %)</th>
                        <th>งบปันส่วนค่าใช้จ่ายจริง (Allocated Actual Cost)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCompanyCostBreakdown.map((item) => (
                        <tr key={item.company}>
                          <td>
                            <strong className={styles.companyBadgePill}>{item.company}</strong>
                          </td>
                          <td>
                            <strong>{item.count}</strong> คน
                          </td>
                          <td>
                            <div className={styles.sharePercentCell}>
                              <div className={styles.sharePercentBarWrap}>
                                <div
                                  className={styles.sharePercentBar}
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                              <span>{item.percentage}%</span>
                            </div>
                          </td>
                          <td>
                            <strong className={styles.allocatedCostText}>
                              THB {formatNumber(item.totalCost)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>

          <section
            className={styles.courseExcelRecordPanel}
            aria-label="Course uploaded record details"
          >
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Training Record Details</p>
                <h3>
                  Employee records from{" "}
                  {selectedCourse.source === "UPLOAD" ? "upload" : "system"}
                </h3>
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
                        <td>
                          <strong>
                            THB {record.expensePerPerson || formatNumber(selectedCostPerPerson)}
                          </strong>
                        </td>
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
                <h3>
                  {selectedCourse.evaluationCompleted}/{selectedCourse.evaluationTotal} completed
                </h3>
                <span>Download by person or export all evaluation forms.</span>
              </div>
            </article>
          </section>

          {!isFactoryUser || selectedCourse.owner !== "CENTER" ? (
            <section className={styles.addAttendeePanel} aria-label="Add attendee to recorded course">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.kicker}>Post-Record Registration</p>
                  <h3>Add Attendee</h3>
                </div>
                <button type="button" onClick={() => setIsAddingAttendee(!isAddingAttendee)}>
                  {isAddingAttendee ? "Cancel" : "+ Add Attendee"}
                </button>
              </div>

              {isAddingAttendee ? (
                <div className={styles.addAttendeeWorkspace}>
                  <div className={styles.addAttendeeControls}>
                    <label>
                      Select Employee from Master Data
                      <select
                        value={selectedEmpCode}
                        onChange={(event) => {
                          setSelectedEmpCode(event.target.value);
                          const master = masterEmployees.find(
                            (employee) => employee.employeeCode === event.target.value,
                          );

                          if (master) {
                            setCustomEmpCode(master.employeeCode ?? "");
                            setCustomEmpName(
                              `${master.titleEn || ""} ${
                                master.firstNameEn || master.firstNameTh
                              } ${master.lastNameEn || master.lastNameTh}`.trim(),
                            );
                            setCustomCompany(master.companyCode);
                            setCustomDepartment(master.functionName || "");
                          }
                        }}
                      >
                        <option value="">Select Employee (Optional)</option>
                        {masterEmployees.map((employee) => (
                          <option key={employee.employeeId} value={employee.employeeCode ?? ""}>
                            {employee.employeeCode} / {employee.firstNameEn || employee.firstNameTh}{" "}
                            {employee.lastNameEn || employee.lastNameTh} / {employee.companyCode} /{" "}
                            {employee.functionName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Employee Code
                      <input
                        value={customEmpCode}
                        onChange={(event) => setCustomEmpCode(event.target.value)}
                        placeholder="e.g. ATA-1001"
                      />
                    </label>

                    <label>
                      Full Name
                      <input
                        value={customEmpName}
                        onChange={(event) => setCustomEmpName(event.target.value)}
                        placeholder="e.g. Mr. Somchai Promjai"
                      />
                    </label>

                    <label>
                      Company
                      <input
                        value={customCompany}
                        onChange={(event) => setCustomCompany(event.target.value)}
                        placeholder="e.g. ATA / SNF"
                      />
                    </label>

                    <label>
                      Department / Function
                      <input
                        value={customDepartment}
                        onChange={(event) => setCustomDepartment(event.target.value)}
                        placeholder="e.g. Production"
                      />
                    </label>

                    <div className={styles.addAttendeeActions}>
                      <button type="button" onClick={() => void handleAddAttendee()}>
                        Save & Add Attendee
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {addAttendeeMessage ? (
                <p className={styles.downloadMessage}>{addAttendeeMessage}</p>
              ) : null}
            </section>
          ) : (
            <section className={styles.addAttendeePanel} style={{ opacity: 0.85, background: "rgba(241, 245, 249, 0.6)", border: "1px dashed #cbd5e1" }}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.kicker}>Center Training Record Scope</p>
                  <h3 style={{ color: "#475569" }}>🔒 หลักสูตรของส่วนกลาง (Center Training Record)</h3>
                </div>
                <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>
                  ไม่อนุญาตให้โรงงานเพิ่มผู้เข้าร่วมในหลักสูตรของ Center ย้อนหลัง / Only HRD Center can manage attendees for Center records
                </span>
              </div>
            </section>
          )}

          {/* Executive Actual Attendees Workspace */}
          <section className={styles.evaluationDownloadPanel} aria-label="Actual attendees list">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Confirmed Attendees Workspace</p>
                <h3>👥 รายชื่อผู้เข้าอบรมจริง & ผลการประเมิน (Confirmed Attendees & Evaluation)</h3>
              </div>
              <div className={styles.attendeeHeaderActions}>
                <span className={styles.attendeeCountChip}>
                  รวม {visibleCourseAttendees.length} คน ({attendeesByCompany.length} บริษัท)
                </span>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled
                  title={`${UNDER_DEVELOPMENT.th} / ${UNDER_DEVELOPMENT.en}`}
                >
                  📥 Download All Forms (ZIP)
                </button>
              </div>
            </div>

            {/* Filter Toolbar: Search & Company Filter Chips */}
            <div className={styles.attendeeFilterToolbar}>
              <div className={styles.companyFilterChips}>
                <button
                  type="button"
                  className={
                    selectedAttendeeCompanyFilter === "ALL"
                      ? styles.activeFilterChip
                      : styles.filterChip
                  }
                  onClick={() => setSelectedAttendeeCompanyFilter("ALL")}
                >
                  ทุกบริษัท ({visibleCourseAttendees.length})
                </button>
                {attendeesByCompany.map(([company, atts]) => (
                  <button
                    key={company}
                    type="button"
                    className={
                      selectedAttendeeCompanyFilter === company
                        ? styles.activeFilterChip
                        : styles.filterChip
                    }
                    onClick={() => setSelectedAttendeeCompanyFilter(company)}
                  >
                    {company} ({atts.length})
                  </button>
                ))}
              </div>

              <div className={styles.attendeeSearchBox}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, รหัสพนักงาน, แผนก..."
                  value={attendeeSearchQuery}
                  onChange={(e) => setAttendeeSearchQuery(e.target.value)}
                />
                {attendeeSearchQuery ? (
                  <button
                    type="button"
                    className={styles.clearSearchBtn}
                    onClick={() => setAttendeeSearchQuery("")}
                  >
                    ✖
                  </button>
                ) : null}
              </div>
            </div>

            {/* Modern Table for Filtered Attendees */}
            <div className={styles.attendeeTableCardWrap}>
              {filteredCourseAttendees.length > 0 ? (
                <table className={styles.attendeeEmployeeTable}>
                  <thead>
                    <tr>
                      <th>พนักงาน (Employee)</th>
                      <th>บริษัท & แผนก (Company / Dept)</th>
                      <th>ตำแหน่ง (Position)</th>
                      <th>ผล Pre / Post Test</th>
                      <th>สถานะแบบประเมิน</th>
                      <th>งบปันส่วนต่อคน</th>
                      <th>จัดการ / Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourseAttendees.map((attendee) => {
                      return (
                        <tr key={attendee.id}>
                          <td>
                            <div className={styles.attendeeUserCell}>
                              <div>
                                <strong className={styles.attendeeNameText}>{attendee.name}</strong>
                                <span className={styles.attendeeCodeTag}>{attendee.employeeCode}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className={styles.deptCell}>
                              <span className={styles.companyPillBadge}>{attendee.company}</span>
                              <span className={styles.attendeeDeptText}>{attendee.department}</span>
                            </div>
                          </td>
                          <td>
                            <span className={styles.positionText}>{attendee.position || "-"}</span>
                          </td>
                          <td>
                            <span
                              className={
                                attendee.prePost === "Passed"
                                  ? styles.passBadge
                                  : attendee.prePost === "Failed"
                                    ? styles.failBadge
                                    : styles.evalPendingBadge
                              }
                            >
                              {attendee.prePost === "Passed" ? (
                                <>
                                  <span className={styles.glowingDotGreen} /> ผ่าน
                                </>
                              ) : attendee.prePost === "Failed" ? (
                                <>
                                  <span className={styles.glowingDotRed} /> ไม่ผ่าน
                                </>
                              ) : (
                                <>
                                  <span className={styles.glowingDotAmber} /> ยังไม่ระบุ
                                </>
                              )}
                            </span>
                          </td>
                          <td>
                            <span
                              className={
                                attendee.evaluation === "Done"
                                  ? styles.evalDoneBadge
                                  : styles.evalPendingBadge
                              }
                            >
                              {attendee.evaluation === "Done" ? (
                                <>
                                  <span className={styles.glowingDotBlue} /> ทำแล้ว
                                </>
                              ) : attendee.evaluation === "None" ? (
                                <>
                                  <span className={styles.glowingDotGrey} /> ไม่มีแบบประเมิน
                                </>
                              ) : attendee.evaluation === "External" ? (
                                <>
                                  <span className={styles.glowingDotGrey} /> ทำผ่านลิงก์
                                </>
                              ) : (
                                <>
                                  <span className={styles.glowingDotAmber} /> รอดำเนินการ
                                </>
                              )}
                            </span>
                          </td>
                          <td>
                            <strong className={styles.attendeeCostBadge}>
                              THB {formatNumber(selectedCostPerPerson)}
                            </strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.individualDownloadBtn}
                              disabled
                              title={`${UNDER_DEVELOPMENT.th} / ${UNDER_DEVELOPMENT.en}`}
                            >
                              📄 Form PDF
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className={styles.emptyAttendeeState}>
                  <span>🔍 ไม่พบข้อมูลผู้เข้าอบรมตามเงื่อนไขค้นหา</span>
                </div>
              )}
            </div>

            {downloadMessage ? <p className={styles.downloadMessage}>{downloadMessage}</p> : null}
          </section>
        </div>
      </section>
    );
  };

  const renderRecordTable = (
    ownerType: "Center" | "Factory",
    records: CompletedCourse[],
    emptyMessage: string,
  ) => {
    const isCenter = ownerType === "Center";
    const displayTitle = isCenter
      ? "Center Training Records (ส่วนกลาง)"
      : isFactoryUser
        ? `${userCompanyCode} Factory Training Records (${userCompanyCode})`
        : "Factory Training Records (โรงงาน)";

    const totalCategoryCost = records.reduce(
      (total, course) => total + getActualCostTotal(course),
      0,
    );

    return (
      <section className={styles.recordOwnerPanel} aria-label={`${ownerType} training records`}>
        <div className={styles.recordOwnerHeader}>
          <div>
            <div className={styles.ownerTitleRow}>
              <span className={styles.ownerIconBadge}>{isCenter ? "🏢" : "🏭"}</span>
              <h3>{displayTitle}</h3>
            </div>
            <span className={styles.ownerSubCount}>{records.length} completed records</span>
          </div>
          <div className={styles.ownerTotalCostBadge}>
            <small>Total Spent</small>
            <strong>THB {formatNumber(totalCategoryCost)}</strong>
          </div>
        </div>

        <div className={styles.recordListTableWrap}>
          <table className={styles.recordListTable}>
            <thead>
              <tr>
                <th>Course</th>
                <th>Date / Batch</th>
                <th>Company / Scope</th>
                <th>Actual Attendees</th>
                <th>Actual Cost</th>
                <th>Evaluation</th>
                <th>Source</th>
                <th className={styles.actionHeader}>Action</th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? (
                records.map((course) => {
                  const actualCostTotal = getActualCostTotal(course);
                  const courseCostPerPerson = getCostPerPerson(course);
                  const evaluationRate =
                    course.evaluationTotal > 0
                      ? Math.round(
                          (course.evaluationCompleted / course.evaluationTotal) * 100,
                        )
                      : 0;

                  const isExpanded =
                    selectedCourse?.id === course.id && isCourseDetailOpen;

                  const ownerTag =
                    course.owner === "CENTER"
                      ? "HRD Center"
                      : `HRD ${course.ownerCompany || course.company}`;

                  return (
                    <Fragment key={course.id}>
                      <tr className={isExpanded ? styles.activeRecordRow : undefined}>
                        <td>
                          <div className={styles.courseTitleCell}>
                            <strong>{course.title}</strong>
                            <div className={styles.courseSubMeta}>
                              <span className={styles.codeBadge}>{course.code}</span>
                              <span className={styles.ownerPillTag}>{ownerTag}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{course.date}</strong>
                          <span className={styles.batchTimeText}>
                            Batch {course.batch ?? "-"} / {course.time ?? "-"}
                          </span>
                        </td>
                        <td>
                          <span className={styles.companyScopeText}>{course.company}</span>
                        </td>
                        <td>
                          <strong className={styles.attendeeRatioText}>
                            {course.actualAttendees} / {course.registeredAttendees}
                          </strong>
                          <span className={styles.ratioLabel}>attended</span>
                        </td>
                        <td>
                          <strong className={styles.costAmountText}>
                            THB {formatNumber(actualCostTotal)}
                          </strong>
                          <span className={styles.perPersonCostText}>
                            THB {formatNumber(courseCostPerPerson)} / person
                          </span>
                        </td>
                        <td>
                          <div className={styles.evaluationProgressCell}>
                            <span className={styles.evalCountText}>
                              {course.evaluationCompleted} / {course.evaluationTotal}
                            </span>
                            <span
                              className={`${styles.evalRateBadge} ${
                                evaluationRate === 100
                                  ? styles.evalComplete
                                  : styles.evalPending
                              }`}
                            >
                              {evaluationRate}% done
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={
                              course.source === "UPLOAD"
                                ? styles.uploadSourceBadge
                                : styles.systemSourceBadge
                            }
                          >
                            {course.source === "UPLOAD" ? "Upload" : "System"}
                          </span>
                        </td>
                        <td>
                          <div className={styles.recordTableActions}>
                            <button
                              className={isExpanded ? styles.activeActionButton : styles.actionButton}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedCourseId(course.id);
                                setIsCourseDetailOpen((current) =>
                                  selectedCourse?.id === course.id ? !current : true,
                                );
                                setDownloadMessage("");
                              }}
                            >
                              {isExpanded ? "Hide Details" : "Details"}
                            </button>
                            <button
                              className={styles.exportButton}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleExportCourseSummary(course);
                              }}
                            >
                              Export
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className={styles.inlineDetailRow}>
                          <td colSpan={8}>{renderSelectedCourseDetail()}</td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className={styles.emptyTableMessage}>
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const totalAllActualExpenses = availableCourses.reduce(
    (total, course) => total + getActualCostTotal(course),
    0,
  );

  if (isLoading) {
    return (
      <section className={styles.page} aria-label="Training Record module">
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{trainingRecordModule.subtitle}</p>
            <h2>{trainingRecordModule.title}</h2>
            <p>{trainingRecordModule.description}</p>
          </div>
        </section>
        <TypewriterLoader label="กำลังโหลดข้อมูลประวัติการอบรม..." />
      </section>
    );
  }

  return (
    <section className={styles.page} aria-label="Training Record module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingRecordModule.subtitle}</p>
          <h2>{trainingRecordModule.title}</h2>
          <p>{trainingRecordModule.description}</p>
        </div>
        <div className={styles.heroMeta}>
          <span className={styles.metaBadge}>{availableCourses.length} completed courses</span>
          <span className={styles.metaBadgeCenter}>{centerCourses.length} Center</span>
          <span className={styles.metaBadgeFactory}>{factoryCourses.length} Factory</span>
        </div>
      </section>

      {/* KPI Overview Summary Cards */}
      <section className={styles.recordOverviewGrid} aria-label="Training record KPI summary">
        <article className={styles.metricCard}>
          <span>Completed Courses</span>
          <strong>{availableCourses.length}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Center Records</span>
          <strong>{centerCourses.length}</strong>
        </article>
        <article className={styles.metricCard}>
          <span>Factory Records</span>
          <strong>{factoryCourses.length}</strong>
        </article>
        <article className={`${styles.metricCard} ${styles.metricCardPrimary}`}>
          <span>Total Actual Expenses</span>
          <strong>THB {formatNumber(totalAllActualExpenses)}</strong>
        </article>
      </section>

      {/* Primary Section: Completed Course Records by Owner */}
      <section className={styles.recordOwnerOverview} aria-label="Completed course records by owner">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Training Record Details</p>
            <h3>Completed records by owner</h3>
          </div>
          <span className={styles.scopeBadge}>
            {isFactoryUser ? `${userCompanyCode} Factory Scope` : "All Scopes (Center & Factory)"}
          </span>
        </div>

        <div className={styles.recordOwnerGrid}>
          {renderRecordTable(
            "Center",
            centerCourses,
            "No center completed records found.",
          )}
          {renderRecordTable(
            "Factory",
            factoryCourses,
            isFactoryUser
              ? `No completed records owned by ${userCompanyCode || "your company"} yet.`
              : "No factory completed records found.",
          )}
        </div>
      </section>

      {/* Excel Import Tools Panel */}
      <section className={styles.importPanel} aria-label="Import completed courses from Excel">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Excel Tools</p>
            <h3>Import completed training records</h3>
          </div>
          <span className={styles.importScopeBadge}>{importScopeLabel}</span>
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
            <button
              type="button"
              disabled
              title={`${UNDER_DEVELOPMENT.th} / ${UNDER_DEVELOPMENT.en}`}
            >
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
    </section>
  );
}
