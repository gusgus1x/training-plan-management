
"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toDataURL as generateQrCodeDataUrl } from "qrcode";
import { downloadCsvTemplate, parseCsvText, type CourseMasterImportRow } from "../../../../lib/excelHelper";
import {
  getCourseDisplayName,
  getCourseSecondaryName,
  isWorkflowOwner,
  type WorkflowCourse,
  type WorkflowOwner,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { listCourses, createCourse, updateCourse, deleteCourse } from "../../../../lib/courses/client";
import { listOapPlans } from "../../../../lib/trainingOap/client";
import type { OapPlanRecord } from "../../../../lib/trainingOap/types";
import { loadWorkflowRollingPlans, type RollingPlan } from "../../TrainingPlanManagement/modules/TrainingRolling";
import { getLevelRank, normalizeEmployeeLevel } from "../../../../lib/employeeMasterData";
import { listAssessments } from "../../../../lib/assessments/client";
import { listEvaluations } from "../../../../lib/evaluations/client";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { listCourseGroups } from "../../../../lib/courseGroups/client";
import { listCourseTypes } from "../../../../lib/courseTypes/client";
import { listFunctions } from "../../../../lib/functions/client";
import { listCompanies } from "../../../../lib/companies/client";
import { listDivisions } from "../../../../lib/divisions/client";
import { listDepartments } from "../../../../lib/departments/client";
import { listSections } from "../../../../lib/sections/client";
import { listOrgHierarchyUsage } from "../../../../lib/orgHierarchy/client";
import type { OrgHierarchyUsageRow } from "../../../../lib/orgHierarchy/types";
import { listPositions } from "../../../../lib/positions/client";
import type { PositionRecord } from "../../../../lib/positions/types";
import { listLevels } from "../../../../lib/levels/client";
import type { LevelRecord } from "../../../../lib/levels/types";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./CourseMasterWorkspace.module.css";

export const courseMasterWorkspaceModule = {
  title: "Course Master & Standard",
  subtitle: "Course database and standards",
  description: "Create the course and define its training standard in one form.",
} as const;

export default function CourseMasterWorkspace() {
  return <CourseMaster />;
}

export const courseMasterModule = {
  title: "Course Master & Standard",
  subtitle: "Course database and standards",
  description: "Create the course and define its training standard in one form.",
} as const;

type CourseStatus = "Active" | "Draft" | "Inactive";

type CourseForm = {
  courseCode: string;
  courseNameTh: string;
  courseNameEn: string;
  objective: string;
  learningContent: string;
  targetGroup: string;
  methodology: string;
  preTestId: string;
  preTest: string;
  postTestId: string;
  postTest: string;
  evaluationId: string;
  evaluation: string;
  evaluationAfter30DayId: string;
  evaluationAfter30Day: string;
  preTestLink: string;
  postTestLink: string;
  evaluationLink: string;
  evaluationAfter30DayLink: string;
  lifeCycleMonth: string;
  remark: string;
  status: CourseStatus;
  courseType: string;
  courseGroup: string;
};

type CourseRecord = WorkflowCourse;
type CourseStandardRecord = WorkflowStandard;

type LinkModeField = "preTest" | "postTest" | "evaluation" | "evaluationAfter30Day";
const LINK_MODE_VALUE = "__link__";
const deriveLinkModeFields = (course: CourseRecord): Set<LinkModeField> => {
  const fields: LinkModeField[] = [];
  if (course.preTestLink?.trim()) fields.push("preTest");
  if (course.postTestLink?.trim()) fields.push("postTest");
  if (course.evaluationLink?.trim()) fields.push("evaluation");
  if (course.evaluationAfter30DayLink?.trim()) fields.push("evaluationAfter30Day");
  return new Set(fields);
};

type TrainingAssessmentOption = {
  id: string;
  code: string;
  name: string;
  assessmentType: "Pre Test" | "Post Test";
  courseName: string;
  questionCount: number;
};

type TrainingEvaluationOption = {
  id: string;
  code: string;
  name: string;
  timing: "After Training" | "30-Day Follow-up";
  respondent: "Employee" | "Manager";
  scope: "Central" | "Company";
  company: string;
  questionCount: number;
};

const allFunctionOption = "All Function";
const allFunctionThaiDisplayName = "ทุกหน่วยงาน";
const allFunctionCode = "__ALL__";

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

const emptyCourseForm: CourseForm = {
  courseCode: "",
  courseNameTh: "",
  courseNameEn: "",
  objective: "",
  learningContent: "",
  targetGroup: "",
  methodology: "",
  preTestId: "",
  preTest: "",
  postTestId: "",
  postTest: "",
  evaluationId: "",
  evaluation: "",
  evaluationAfter30DayId: "",
  evaluationAfter30Day: "",
  preTestLink: "",
  postTestLink: "",
  evaluationLink: "",
  evaluationAfter30DayLink: "",
  lifeCycleMonth: "",
  remark: "",
  status: "Active",
  courseType: "",
  courseGroup: "",
};

const EN_KEYS = " `1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./~!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:\"ZXCVBNM<>?";
const TH_KEYS = " -ภถุึคตจขชๆไำพะัีรนยบลฃฟหกดเ้่าสวงผปแอิืทมใฝ_๑๒๓๔ู฿๕๖๗๘๙ํ๊๋็ัีรนยิ์ืฺํ๊๋็ัีรนยบลฅฟหกดเ้่าสวงผปแอิืทมใฝ";

function translateKeyboard(input: string): string {
  let result = "";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const enIdx = EN_KEYS.indexOf(char);
    if (enIdx !== -1 && enIdx < TH_KEYS.length) {
      result += TH_KEYS[enIdx];
      continue;
    }
    const thIdx = TH_KEYS.indexOf(char);
    if (thIdx !== -1 && thIdx < EN_KEYS.length) {
      result += EN_KEYS[thIdx];
      continue;
    }
    result += char;
  }
  return result;
}

interface SearchableSelectOption {
  id?: string;
  code: string;
  name: string;
  nameTh?: string;
  nameEn?: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (valueCode: string) => void;
}

const SearchableSelect = ({
  value,
  options,
  disabled = false,
  placeholder = "Select or search...",
  onChange,
}: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.code === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.trim().toLowerCase();
    const translatedQ = translateKeyboard(q).toLowerCase();

    return options.filter((option) => {
      const code = (option.code || "").toLowerCase();
      const name = (option.name || "").toLowerCase();
      const nameTh = (option.nameTh || "").toLowerCase();
      const nameEn = (option.nameEn || "").toLowerCase();

      return (
        code.includes(q) ||
        name.includes(q) ||
        nameTh.includes(q) ||
        nameEn.includes(q) ||
        (translatedQ !== q &&
          (code.includes(translatedQ) ||
            name.includes(translatedQ) ||
            nameTh.includes(translatedQ) ||
            nameEn.includes(translatedQ)))
      );
    });
  }, [options, searchQuery]);

  return (
    <div className={styles.searchableSelectContainer} ref={containerRef}>
      <div
        className={`${styles.searchableSelectTrigger} ${disabled ? styles.disabled : ""} ${
          isOpen ? styles.open : ""
        }`}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            setSearchQuery("");
          }
        }}
      >
        {isOpen ? (
          <input
            type="text"
            className={styles.searchableSelectInput}
            value={searchQuery}
            autoFocus
            disabled={disabled}
            placeholder={`Search ${selectedOption?.name || placeholder}...`}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.searchableSelectValue} translate="no">
            {selectedOption ? selectedOption.name : placeholder}
          </span>
        )}
        <span className={styles.searchableSelectArrow}>▼</span>
      </div>

      {isOpen && !disabled && (
        <ul className={styles.searchableSelectMenu}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <li
                key={opt.code + (opt.id || "")}
                className={`${styles.searchableSelectItem} ${
                  opt.code === value ? styles.selected : ""
                }`}
                onClick={() => {
                  onChange(opt.code);
                  setIsOpen(false);
                  setSearchQuery("");
                }}
              >
                <div className={styles.itemMain} translate="no">{opt.name}</div>
                {opt.nameTh && opt.nameEn && opt.nameTh !== opt.nameEn ? (
                  <div className={styles.itemSub} translate="no">
                    {opt.nameTh} · {opt.nameEn}
                  </div>
                ) : null}
              </li>
            ))
          ) : (
            <li className={styles.searchableSelectEmpty}>No matches found</li>
          )}
        </ul>
      )}
    </div>
  );
};

function CourseMaster() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const notice = useNotice();
  const { language } = useUiLanguage();
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const factoryCourseTypeAllowlist = ["IN-HOUSE", "PUBLIC", "OJT"];
  const [courseTypeOptions, setCourseTypeOptions] = useState<Array<{ name: string; typeId: string }>>([]);
  const courseTypes = isFactoryUser
    ? courseTypeOptions.map((type) => type.name).filter((name) => factoryCourseTypeAllowlist.includes(name))
    : courseTypeOptions.map((type) => type.name);
  const [courseGroupOptions, setCourseGroupOptions] = useState<
    Array<{ name: string; groupId: string; code: string; lastCourseNumber: number }>
  >([]);
  const courseGroups = courseGroupOptions.map((group) => group.name);
  const [assessmentOptions, setAssessmentOptions] = useState<TrainingAssessmentOption[]>([]);
  const [evaluationOptions, setEvaluationOptions] = useState<TrainingEvaluationOption[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [form, setForm] = useState<CourseForm>(emptyCourseForm);
  const [linkModeFields, setLinkModeFields] = useState<Set<LinkModeField>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [openDetailCourseId, setOpenDetailCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [listCompanyFilter, setListCompanyFilter] = useState("");
  const [standards, setStandards] = useState<CourseStandardRecord[]>([]);
  const [oapPlans, setOapPlans] = useState<OapPlanRecord[]>([]);
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [standardFunctionCode, setStandardFunctionCode] = useState("");
  const [standardFunctionName, setStandardFunctionName] = useState("");
  const [standardDivisionCode, setStandardDivisionCode] = useState("");
  const [standardDepartmentCode, setStandardDepartmentCode] = useState("");
  const [standardSectionCode, setStandardSectionCode] = useState("");

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<CourseMasterImportRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadExcelTemplate = () => {
    downloadCsvTemplate();
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = String(evt.target?.result || "");
        const mapped = parseCsvText(text);
        setImportRows(mapped);
        setImportNotice(null);
      } catch (err) {
        console.error("Excel/CSV parse error:", err);
        setImportNotice("❌ ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์ CSV / Excel");
      }
    };
    reader.readAsText(file);
  };

  const handleCommitExcelImport = () => {
    if (importRows.length === 0) return;

    let importedCount = 0;
    const newCourses: CourseRecord[] = [...courses];
    const newStandards: CourseStandardRecord[] = [...standards];

    importRows.forEach((item) => {
      if (!item.courseNameTh) return;

      const resolvedGroup = item.courseGroup || "General";
      const resolvedCode =
        item.courseCode ||
        `CRS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const courseId = `course-${resolvedCode.toLowerCase()}-${Math.random().toString(36).substring(2, 9)}`;

      const courseRec: CourseRecord = {
        id: courseId,
        courseCode: resolvedCode,
        courseNameTh: item.courseNameTh,
        courseNameEn: item.courseNameEn || item.courseNameTh,
        courseGroup: resolvedGroup,
        courseType: item.courseType || "IN-HOUSE",
        objective: item.objective || "-",
        learningContent: item.learningContent || "-",
        targetGroup: item.targetGroup || "-",
        methodology: item.methodology || "Lecture / Workshop",
        preTestId: "",
        preTest: item.preTest?.toLowerCase() === "yes" ? "Pre Test" : "-",
        postTestId: "",
        postTest: item.postTest?.toLowerCase() === "yes" ? "Post Test" : "-",
        evaluationId: "",
        evaluation: "After Training Evaluation",
        evaluationAfter30DayId: "",
        evaluationAfter30Day: "30-Day Evaluation",
        lifeCycleMonth: item.lifeCycleMonth !== undefined && item.lifeCycleMonth !== null && item.lifeCycleMonth !== "" ? item.lifeCycleMonth : "0",
        status: "Active",
        remark: "",
        updatedAt: new Date().toISOString().slice(0, 10),
        owner: user?.roleCode === "HRD_CENTER" ? "CENTER" : "FACTORY",
        ownerCompany: user?.roleCode === "HRD_CENTER" ? "HRD Center" : (profileValue(user?.companyCode) || "Factory"),
        createdBy: profileValue(user?.displayName ?? user?.username),
      };

      const posArray = item.positions
        ? item.positions.split(",").map((p: string) => p.trim()).filter(Boolean)
        : [];
      const lvlArray = item.levels
        ? item.levels.split(",").map((l: string) => normalizeEmployeeLevel(l.trim())).filter(Boolean)
        : [];

      const standardRec: CourseStandardRecord = {
        id: `standard-${courseId}`,
        courseId: courseId,
        courseCode: resolvedCode,
        courseName: getCourseDisplayName(courseRec),
        companies: [],
        functionCode: item.functionCode || "",
        functionName: item.functionName || allFunctionOption,
        section: "",
        department: "",
        division: "",
        positions: posArray,
        levels: lvlArray,
        owner: courseRec.owner,
        ownerCompany: courseRec.ownerCompany || "HRD Center",
      };

      newCourses.unshift(courseRec);
      newStandards.unshift(standardRec);
      importedCount += 1;
    });

    setCourses(newCourses);
    setStandards(newStandards);
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName("");
    alert(`🎉 นำเข้าข้อมูล Course Master สำเร็จจำนวน ${importedCount} รายการ!`);
  };

  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoadingData(true);
    void Promise.all([
      listCourseTypes({ status: "ACTIVE" }),
      listCourseGroups({ status: "ACTIVE" }),
      listCourses({ search: "", status: null }),
      listFunctions(),
      listCompanies(),
      listDivisions(),
      listDepartments(),
      listSections(),
      listOrgHierarchyUsage(),
      listPositions(),
      listLevels(),
    ]).then(([types, groups, courseData, functions, companies, divisions, departments, sections, orgHierarchyUsage, positions, levels]) => {
      if (!active) return;
      setCourseTypeOptions(types.items.map((item: any) => ({ name: item.name, typeId: item.courseTypeId || item.code })));
      setCourseGroupOptions(
        groups.items.map((item: any) => ({
          name: item.name,
          groupId: item.courseGroupId || item.code,
          code: item.code || "",
          lastCourseNumber: item.lastCourseNumber ?? 0,
        })),
      );
      setCourses(courseData.courses || []);
      setStandards(courseData.standards || []);
      setFunctionRows(
        functions.items
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({ id: item.functionId, code: item.functionCode, name: item.functionNameEn || item.functionNameTh, nameTh: item.functionNameTh, nameEn: item.functionNameEn || undefined })),
      );
      setCompanyRows(
        companies.items
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({ id: item.companyId, code: item.companyCode, name: item.companyNameEn || item.companyNameTh, nameTh: item.companyNameTh, nameEn: item.companyNameEn || undefined })),
      );
      setDivisionRows(
        divisions.items
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({ id: item.divisionId, code: item.divisionCode, name: item.divisionNameEn || item.divisionNameTh, nameTh: item.divisionNameTh, nameEn: item.divisionNameEn || undefined })),
      );
      setDepartmentRows(
        departments.items
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({ id: item.departmentId, code: item.departmentCode, name: item.departmentNameEn || item.departmentNameTh, nameTh: item.departmentNameTh, nameEn: item.departmentNameEn || undefined })),
      );
      setSectionRows(
        sections.items
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({ id: item.sectionId, code: item.sectionCode, name: item.sectionNameEn || item.sectionNameTh, nameTh: item.sectionNameTh, nameEn: item.sectionNameEn || undefined })),
      );
      setOrgUsage(orgHierarchyUsage.items);
      setPositionRows(positions.items.filter((item) => item.status === "ACTIVE"));
      setLevelRows(levels.items.filter((item) => item.status === "ACTIVE"));
    }).catch(() => {
      if (!active) return;
      setCourseTypeOptions([]);
      setCourseGroupOptions([]);
      setFunctionRows([]);
      setCompanyRows([]);
      setDivisionRows([]);
      setDepartmentRows([]);
      setSectionRows([]);
      setOrgUsage([]);
      setPositionRows([]);
      setLevelRows([]);
    }).finally(() => {
      if (active) {
        setIsLoadingData(false);
      }
    });
    void loadPublishedForms();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void listOapPlans({ search: null, status: null }).then((result) => setOapPlans(result.oapPlans || []));
    void loadWorkflowRollingPlans().then(setRollingPlans);
  }, []);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companyRows, setCompanyRows] = useState<
    Array<{ id: string; code: string; name: string; nameTh?: string; nameEn?: string }>
  >([]);
  const [functionRows, setFunctionRows] = useState<
    Array<{ id: string; code: string; name: string; nameTh?: string; nameEn?: string }>
  >([]);
  const [divisionRows, setDivisionRows] = useState<
    Array<{ id: string; code: string; name: string; nameTh?: string; nameEn?: string }>
  >([]);
  const [departmentRows, setDepartmentRows] = useState<
    Array<{ id: string; code: string; name: string; nameTh?: string; nameEn?: string }>
  >([]);
  const [sectionRows, setSectionRows] = useState<
    Array<{ id: string; code: string; name: string; nameTh?: string; nameEn?: string }>
  >([]);
  const [orgUsage, setOrgUsage] = useState<OrgHierarchyUsageRow[]>([]);
  const [positionRows, setPositionRows] = useState<PositionRecord[]>([]);
  const [levelRows, setLevelRows] = useState<LevelRecord[]>([]);
  const selectedFunctionId = functionRows.find((row) => row.code === standardFunctionCode)?.id;
  const selectedDivisionId = divisionRows.find((row) => row.code === standardDivisionCode)?.id;
  const selectedDepartmentId = departmentRows.find((row) => row.code === standardDepartmentCode)?.id;
  const selectedSectionId = sectionRows.find((row) => row.code === standardSectionCode)?.id;

  const selectedCompanyIds = useMemo(
    () => companyRows.filter((row) => selectedCompanies.includes(row.code)).map((row) => row.id),
    [companyRows, selectedCompanies],
  );
  const usageInSelectedCompanies = (usage: OrgHierarchyUsageRow) =>
    selectedCompanies.length === 0 ||
    (usage.companyId !== null && selectedCompanyIds.includes(usage.companyId));

  const functionOptions = useMemo(() => {
    let filtered = functionRows;

    if (selectedCompanies.length > 0) {
      const allowedFunctionIds = new Set(
        orgUsage
          .filter((usage) => usageInSelectedCompanies(usage))
          .map((u) => u.functionId)
          .filter(Boolean),
      );
      filtered = filtered.filter(
        (row) => allowedFunctionIds.has(row.id) || row.code === standardFunctionCode,
      );
    }

    const hasOrgConstraint =
      (standardDivisionCode && standardDivisionCode !== allFunctionCode) ||
      (standardDepartmentCode && standardDepartmentCode !== allFunctionCode) ||
      (standardSectionCode && standardSectionCode !== allFunctionCode);

    if (hasOrgConstraint) {
      const linkedIds = new Set(
        orgUsage
          .filter((usage) => {
            if (!usageInSelectedCompanies(usage)) return false;
            if (standardDivisionCode && standardDivisionCode !== allFunctionCode && selectedDivisionId && usage.divisionId !== selectedDivisionId) return false;
            if (standardDepartmentCode && standardDepartmentCode !== allFunctionCode && selectedDepartmentId && usage.departmentId !== selectedDepartmentId) return false;
            if (standardSectionCode && standardSectionCode !== allFunctionCode && selectedSectionId && usage.sectionId !== selectedSectionId) return false;
            return true;
          })
          .map((u) => u.functionId)
          .filter(Boolean),
      );
      filtered = filtered.filter((row) => linkedIds.has(row.id) || row.code === standardFunctionCode);
    }

    return [
      { id: "", code: "", name: "Select Function Name" },
      { id: "ALL", code: allFunctionCode, name: "All Function" },
      ...filtered,
    ];
  }, [functionRows, orgUsage, selectedCompanies, selectedCompanyIds, standardFunctionCode, standardDivisionCode, standardDepartmentCode, standardSectionCode, selectedDivisionId, selectedDepartmentId, selectedSectionId]);

  const divisionOptions = useMemo(() => {
    let filtered = divisionRows;

    if (selectedCompanies.length > 0) {
      const allowedDivisionIds = new Set(
        orgUsage
          .filter((usage) => usageInSelectedCompanies(usage))
          .map((u) => u.divisionId)
          .filter(Boolean),
      );
      filtered = filtered.filter(
        (row) => allowedDivisionIds.has(row.id) || row.code === standardDivisionCode,
      );
    }

    const hasOrgConstraint =
      (standardFunctionCode && standardFunctionCode !== allFunctionCode) ||
      (standardDepartmentCode && standardDepartmentCode !== allFunctionCode) ||
      (standardSectionCode && standardSectionCode !== allFunctionCode);

    if (hasOrgConstraint) {
      const linkedIds = new Set(
        orgUsage
          .filter((usage) => {
            if (!usageInSelectedCompanies(usage)) return false;
            if (standardFunctionCode && standardFunctionCode !== allFunctionCode && selectedFunctionId && usage.functionId !== selectedFunctionId) return false;
            if (standardDepartmentCode && standardDepartmentCode !== allFunctionCode && selectedDepartmentId && usage.departmentId !== selectedDepartmentId) return false;
            if (standardSectionCode && standardSectionCode !== allFunctionCode && selectedSectionId && usage.sectionId !== selectedSectionId) return false;
            return true;
          })
          .map((u) => u.divisionId)
          .filter(Boolean),
      );
      filtered = filtered.filter((row) => linkedIds.has(row.id) || row.code === standardDivisionCode);
    }

    return [
      { id: "", code: "", name: "Select Division" },
      { id: "ALL", code: allFunctionCode, name: "All Division" },
      ...filtered,
    ];
  }, [divisionRows, orgUsage, selectedCompanies, selectedCompanyIds, standardFunctionCode, standardDivisionCode, standardDepartmentCode, standardSectionCode, selectedFunctionId, selectedDepartmentId, selectedSectionId]);

  const departmentOptions = useMemo(() => {
    let filtered = departmentRows;

    if (selectedCompanies.length > 0) {
      const allowedDepartmentIds = new Set(
        orgUsage
          .filter((usage) => usageInSelectedCompanies(usage))
          .map((u) => u.departmentId)
          .filter(Boolean),
      );
      filtered = filtered.filter(
        (row) => allowedDepartmentIds.has(row.id) || row.code === standardDepartmentCode,
      );
    }

    const hasOrgConstraint =
      (standardFunctionCode && standardFunctionCode !== allFunctionCode) ||
      (standardDivisionCode && standardDivisionCode !== allFunctionCode) ||
      (standardSectionCode && standardSectionCode !== allFunctionCode);

    if (hasOrgConstraint) {
      const linkedIds = new Set(
        orgUsage
          .filter((usage) => {
            if (!usageInSelectedCompanies(usage)) return false;
            if (standardFunctionCode && standardFunctionCode !== allFunctionCode && selectedFunctionId && usage.functionId !== selectedFunctionId) return false;
            if (standardDivisionCode && standardDivisionCode !== allFunctionCode && selectedDivisionId && usage.divisionId !== selectedDivisionId) return false;
            if (standardSectionCode && standardSectionCode !== allFunctionCode && selectedSectionId && usage.sectionId !== selectedSectionId) return false;
            return true;
          })
          .map((u) => u.departmentId)
          .filter(Boolean),
      );
      filtered = filtered.filter((row) => linkedIds.has(row.id) || row.code === standardDepartmentCode);
    }

    return [
      { id: "", code: "", name: "Select Department" },
      { id: "ALL", code: allFunctionCode, name: "All Department" },
      ...filtered,
    ];
  }, [departmentRows, orgUsage, selectedCompanies, selectedCompanyIds, standardFunctionCode, standardDivisionCode, standardDepartmentCode, standardSectionCode, selectedFunctionId, selectedDivisionId, selectedSectionId]);

  const sectionOptions = useMemo(() => {
    let filtered = sectionRows;

    if (selectedCompanies.length > 0) {
      const allowedSectionIds = new Set(
        orgUsage
          .filter((usage) => usageInSelectedCompanies(usage))
          .map((u) => u.sectionId)
          .filter(Boolean),
      );
      filtered = filtered.filter(
        (row) => allowedSectionIds.has(row.id) || row.code === standardSectionCode,
      );
    }

    const hasOrgConstraint =
      (standardFunctionCode && standardFunctionCode !== allFunctionCode) ||
      (standardDivisionCode && standardDivisionCode !== allFunctionCode) ||
      (standardDepartmentCode && standardDepartmentCode !== allFunctionCode);

    if (hasOrgConstraint) {
      const linkedIds = new Set(
        orgUsage
          .filter((usage) => {
            if (!usageInSelectedCompanies(usage)) return false;
            if (standardFunctionCode && standardFunctionCode !== allFunctionCode && selectedFunctionId && usage.functionId !== selectedFunctionId) return false;
            if (standardDivisionCode && standardDivisionCode !== allFunctionCode && selectedDivisionId && usage.divisionId !== selectedDivisionId) return false;
            if (standardDepartmentCode && standardDepartmentCode !== allFunctionCode && selectedDepartmentId && usage.departmentId !== selectedDepartmentId) return false;
            return true;
          })
          .map((u) => u.sectionId)
          .filter(Boolean),
      );
      filtered = filtered.filter((row) => linkedIds.has(row.id) || row.code === standardSectionCode);
    }

    return [
      { id: "", code: "", name: "Select Section" },
      { id: "ALL", code: allFunctionCode, name: "All Section" },
      ...filtered,
    ];
  }, [sectionRows, orgUsage, selectedCompanies, selectedCompanyIds, standardFunctionCode, standardDivisionCode, standardDepartmentCode, selectedFunctionId, selectedDivisionId, selectedDepartmentId]);
  const getFunctionDisplayName = (functionCode?: string, functionName = "") => {
    if (functionCode === allFunctionCode || functionName === allFunctionOption) {
      return "All Function";
    }

    if (!functionCode && !functionName) {
      return "";
    }

    const matchingFunction = functionRows.find(
      (row) => row.code === functionCode || row.name === functionName,
    );

    return matchingFunction ? matchingFunction.name : functionName;
  };
  const userCompanyCode = profileValue(user?.companyCode);
  const owner: WorkflowOwner = user?.roleCode === "HRD_CENTER" ? "CENTER" : "FACTORY";
  const ownerCompany = owner === "CENTER" ? "HRD Center" : userCompanyCode;

  const companyChecklist = useMemo(() => {
    if (isFactoryUser && userCompanyCode) {
      return [userCompanyCode];
    }
    return companyRows.map((row) => row.code).filter(Boolean);
  }, [isFactoryUser, userCompanyCode, companyRows]);
  const positionChecklist = positionRows
    .map((row) => (row.positionNameEn ?? "").trim())
    .filter(Boolean);
  const levelChecklist = useMemo(() => {
    const unique = Array.from(
      new Set(levelRows.map((row) => normalizeEmployeeLevel(row.levelKey)).filter(Boolean)),
    );
    return unique.sort((a, b) => getLevelRank(b) - getLevelRank(a));
  }, [levelRows]);

  const hasPreTest = !linkModeFields.has("preTest") || Boolean(form.preTestLink.trim());
  const hasPostTest = !linkModeFields.has("postTest") || Boolean(form.postTestLink.trim());
  const hasEvaluation = !linkModeFields.has("evaluation") || Boolean(form.evaluationLink.trim());
  const hasEvaluation30Day = !linkModeFields.has("evaluationAfter30Day") || Boolean(form.evaluationAfter30DayLink.trim());

  const requiredCourseValues = [
    form.courseGroup,
    form.courseType,
    form.courseNameTh,
    form.courseNameEn,
    form.remark,
    form.objective,
    form.learningContent,
    form.targetGroup,
    hasPreTest ? "OK" : "",
    hasPostTest ? "OK" : "",
    hasEvaluation ? "OK" : "",
    hasEvaluation30Day ? "OK" : "",
  ];
  const completedRequiredFields = requiredCourseValues.filter(
    (value) => value.trim().length > 0,
  ).length;
  const requiredFieldCount = requiredCourseValues.length;
  const isCourseFormReady =
    completedRequiredFields === requiredFieldCount && selectedCompanies.length > 0;

  // Any ACTIVE assessment can fill either Pre or Post Test — assessmentType is shown as a hint
  // on each option, not enforced as a hard filter, so the same published assessment can be
  // reused across both slots.
  const publishedPreTests = assessmentOptions;
  const publishedPostTests = assessmentOptions;
  // Evaluation After Training and After 30 Days must stay separate forms (design decision,
  // confirmed by the frontend designer) — filtered strictly by timing, unlike assessments above.
  const publishedCourseEvaluations = useMemo(
    () =>
      evaluationOptions.filter(
        (evaluation) => evaluation.timing === "After Training",
      ),
    [evaluationOptions],
  );
  const publishedFollowUpEvaluations = useMemo(
    () =>
      evaluationOptions.filter(
        (evaluation) => evaluation.timing === "30-Day Follow-up",
      ),
    [evaluationOptions],
  );

  const scopedCourses = useMemo(
    () =>
      courses.filter((course) => {
        if (isFactoryUser) {
          return course.ownerCompany === userCompanyCode;
        }
        return isWorkflowOwner(course.owner, course.ownerCompany, user?.roleCode, userCompanyCode);
      }),
    [courses, isFactoryUser, userCompanyCode, user?.roleCode],
  );
  const selectedCourse = scopedCourses.find((course) => course.id === selectedCourseId) ?? null;
  const isSelectedCourseCenter = selectedCourse
    ? (selectedCourse.owner === "CENTER" || selectedCourse.ownerCompany === "CENTER" || selectedCourse.ownerCompany === "HRD Center" || !selectedCourse.ownerCompany)
    : false;
  const isSelectedCourseReadOnlyForFactory = isFactoryUser && isSelectedCourseCenter;
  const selectedStandard =
    standards.find(
      (standard) =>
        standard.courseId === selectedCourse?.id ||
        standard.courseCode === selectedCourse?.courseCode,
    ) ?? null;
  const usedCourseCodes = useMemo(
    () =>
      new Set([
        ...oapPlans.map((plan) => plan.course.courseCode),
        ...rollingPlans.map((plan) => plan.course.code),
      ]),
    [oapPlans, rollingPlans],
  );
  const isSelectedCourseLocked = selectedCourse ? usedCourseCodes.has(selectedCourse.courseCode) : false;
  const filteredCourses = useMemo(() => {
    return scopedCourses
      .filter((course) => {
        // Search term filter
        const matchesSearch = [
          course.courseCode,
          course.courseNameTh,
          course.courseNameEn,
          course.courseType,
          course.courseGroup,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase());
        if (!matchesSearch) return false;
        // Company filter for Center users (HRD_CENTER) — use dedicated listCompanyFilter state
        if (!isFactoryUser && listCompanyFilter) {
          const companyCode = course.ownerCompany || '';
          return companyCode === listCompanyFilter;
        }
        return true;
      });
  }, [scopedCourses, search, listCompanyFilter, isFactoryUser]);


  const companySections = useMemo(() => {
    const groupsMap = new Map<string, WorkflowCourse[]>();

    filteredCourses.forEach((course) => {
      const compKey =
        course.owner === "CENTER" ||
        course.ownerCompany === "CENTER" ||
        course.ownerCompany === "HRD Center" ||
        !course.ownerCompany
          ? "HRD Center"
          : course.ownerCompany;
      groupsMap.set(compKey, [...(groupsMap.get(compKey) ?? []), course]);
    });

    const userCompLabel = userCompanyCode && userCompanyCode !== "CENTER" ? userCompanyCode : "";

    const entries = [...groupsMap.entries()].map(([companyName, courseList]) => ({
      companyName,
      courses: courseList,
      isUserCompany: userCompLabel ? companyName === userCompLabel : companyName === "HRD Center",
    }));

    return entries.sort((a, b) => {
      if (a.isUserCompany && !b.isUserCompany) return -1;
      if (!a.isUserCompany && b.isUserCompany) return 1;

      if (a.companyName === "HRD Center") return -1;
      if (b.companyName === "HRD Center") return 1;

      return a.companyName.localeCompare(b.companyName);
    });
  }, [filteredCourses, userCompanyCode]);

  const resetStandardForm = () => {
    setStandardFunctionCode("");
    setStandardFunctionName("");
    setStandardDivisionCode("");
    setStandardDepartmentCode("");
    setStandardSectionCode("");
    setSelectedCompanies(isFactoryUser && userCompanyCode ? [userCompanyCode] : []);
    setSelectedPositions([]);
    setSelectedLevels([]);
  };

  const loadStandardForm = (course: CourseRecord) => {
    const standard = standards.find(
      (item) => item.courseId === course.id || item.courseCode === course.courseCode,
    );

    if (!standard) {
      resetStandardForm();
      return;
    }

    const isAllFunction = !standard.functionId && (!standard.functionCode || standard.functionCode === allFunctionCode || standard.functionName === "All Function" || standard.functionName === allFunctionOption);
    const matchingFunctionOption = isAllFunction
      ? { code: allFunctionCode, name: "All Function" }
      : functionRows.find(
          (row) =>
            (standard.functionId && row.id === standard.functionId) ||
            row.code === standard.functionCode ||
            row.name === standard.functionName ||
            row.nameTh === standard.functionName ||
            row.nameEn === standard.functionName,
        );
    setStandardFunctionCode(matchingFunctionOption?.code ?? (isAllFunction ? allFunctionCode : ""));
    setStandardFunctionName(
      isAllFunction
        ? "All Function"
        : getFunctionDisplayName(standard.functionCode, standard.functionName) || "",
    );

    const isAllDivision = !standard.divisionId && (!standard.divisionCode || standard.divisionCode === allFunctionCode || !standard.division || standard.division === "All Division");
    const matchingDivisionRow = isAllDivision
      ? { code: allFunctionCode, name: "All Division" }
      : divisionRows.find(
          (row) =>
            (standard.divisionId && row.id === standard.divisionId) ||
            (standard.divisionCode && row.code === standard.divisionCode) ||
            row.code === standard.division ||
            row.name === standard.division ||
            row.nameTh === standard.division ||
            row.nameEn === standard.division,
        );
    setStandardDivisionCode(matchingDivisionRow?.code ?? (isAllDivision ? allFunctionCode : ""));

    const isAllDepartment = !standard.departmentId && (!standard.departmentCode || standard.departmentCode === allFunctionCode || !standard.department || standard.department === "All Department");
    const matchingDepartmentRow = isAllDepartment
      ? { code: allFunctionCode, name: "All Department" }
      : departmentRows.find(
          (row) =>
            (standard.departmentId && row.id === standard.departmentId) ||
            (standard.departmentCode && row.code === standard.departmentCode) ||
            row.code === standard.department ||
            row.name === standard.department ||
            row.nameTh === standard.department ||
            row.nameEn === standard.department,
        );
    setStandardDepartmentCode(matchingDepartmentRow?.code ?? (isAllDepartment ? allFunctionCode : ""));

    const isAllSection = !standard.sectionId && (!standard.sectionCode || standard.sectionCode === allFunctionCode || !standard.section || standard.section === "All Section");
    const matchingSectionRow = isAllSection
      ? { code: allFunctionCode, name: "All Section" }
      : sectionRows.find(
          (row) =>
            (standard.sectionId && row.id === standard.sectionId) ||
            (standard.sectionCode && row.code === standard.sectionCode) ||
            row.code === standard.section ||
            row.name === standard.section ||
            row.nameTh === standard.section ||
            row.nameEn === standard.section,
        );
    setStandardSectionCode(matchingSectionRow?.code ?? (isAllSection ? allFunctionCode : ""));

    if (isFactoryUser && userCompanyCode) {
      setSelectedCompanies([userCompanyCode]);
    } else {
      setSelectedCompanies(
        standard.companies && standard.companies.length > 0
          ? standard.companies
          : companyChecklist.filter((code) => standard.companies?.includes(code)),
      );
    }
    setSelectedPositions(
      positionChecklist.filter((position) =>
        standard.positions.some(
          (savedPosition) =>
            normalizeTargetPosition(savedPosition) === normalizeTargetPosition(position),
        ),
      ),
    );
    setSelectedLevels(
      levelChecklist.filter((level) =>
        standard.levels.some(
          (savedLevel) =>
            normalizeEmployeeLevel(savedLevel) === normalizeEmployeeLevel(level),
        ),
      ),
    );
  };

  useEffect(() => {
    if (selectedCourse && (isEditing || openDetailCourseId)) {
      loadStandardForm(selectedCourse);
    }
  }, [selectedCourseId, standards, functionRows, divisionRows, departmentRows, sectionRows]);

  const toggleStandardItem = (
    value: string,
    selectedValues: string[],
    setSelectedValues: (next: string[]) => void,
  ) => {
    setSelectedValues(
      selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value],
    );
  };

  const resolveAssessmentId = (
    storedId: string | undefined,
    storedName: string,
    options: TrainingAssessmentOption[],
  ) =>
    options.find((option) => option.id === storedId)?.id ??
    options.find((option) => option.name === storedName)?.id ??
    "";

  const resolveEvaluationId = (
    storedId: string | undefined,
    storedName: string,
    options: TrainingEvaluationOption[],
  ) =>
    options.find((option) => option.id === storedId)?.id ??
    options.find((option) => option.name === storedName)?.id ??
    "";

  const buildCourseForm = (course: CourseRecord): CourseForm => ({
    ...course,
    preTestId: resolveAssessmentId(
      course.preTestId,
      course.preTest,
      publishedPreTests,
    ),
    postTestId: resolveAssessmentId(
      course.postTestId,
      course.postTest,
      publishedPostTests,
    ),
    evaluationId: resolveEvaluationId(
      course.evaluationId,
      course.evaluation,
      publishedCourseEvaluations,
    ),
    evaluationAfter30DayId: resolveEvaluationId(
      course.evaluationAfter30DayId,
      course.evaluationAfter30Day,
      publishedFollowUpEvaluations,
    ),
    preTestLink: course.preTestLink ?? "",
    postTestLink: course.postTestLink ?? "",
    evaluationLink: course.evaluationLink ?? "",
    evaluationAfter30DayLink: course.evaluationAfter30DayLink ?? "",
  });

  const updateForm = (field: keyof CourseForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAssessmentSelection = (
    idField: "preTestId" | "postTestId",
    nameField: "preTest" | "postTest",
    assessmentId: string,
    options: TrainingAssessmentOption[],
  ) => {
    const assessment = options.find((option) => option.id === assessmentId);
    setForm((current) => ({
      ...current,
      [idField]: assessment?.id ?? "",
      [nameField]: assessment?.name ?? "",
      [`${nameField}Link`]: "",
    }));
    setLinkModeFields((current) => {
      const next = new Set(current);
      next.delete(nameField);
      return next;
    });
  };

  const handleEvaluationSelection = (
    idField: "evaluationId" | "evaluationAfter30DayId",
    nameField: "evaluation" | "evaluationAfter30Day",
    evaluationId: string,
    options: TrainingEvaluationOption[],
  ) => {
    const evaluation = options.find((option) => option.id === evaluationId);
    setForm((current) => ({
      ...current,
      [idField]: evaluation?.id ?? "",
      [nameField]: evaluation?.name ?? "",
      [`${nameField}Link`]: "",
    }));
    setLinkModeFields((current) => {
      const next = new Set(current);
      next.delete(nameField);
      return next;
    });
  };

  const handleSelectLinkMode = (
    field: LinkModeField,
    idField: "preTestId" | "postTestId" | "evaluationId" | "evaluationAfter30DayId",
    nameField: "preTest" | "postTest" | "evaluation" | "evaluationAfter30Day",
  ) => {
    setForm((current) => ({
      ...current,
      [idField]: "",
      [nameField]: "",
    }));
    setLinkModeFields((current) => new Set(current).add(field));
  };

  const handleFormLinkChange = (
    linkField:
      | "preTestLink"
      | "postTestLink"
      | "evaluationLink"
      | "evaluationAfter30DayLink",
    idField: "preTestId" | "postTestId" | "evaluationId" | "evaluationAfter30DayId",
    nameField: "preTest" | "postTest" | "evaluation" | "evaluationAfter30Day",
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [linkField]: value,
      ...(value.trim()
        ? {
            [idField]: "",
            [nameField]: "",
          }
        : {}),
    }));
  };

  const loadPublishedForms = async () => {
    try {
      const [assessments, evaluations] = await Promise.all([
        listAssessments({ search: null, status: "ACTIVE", purpose: null }),
        listEvaluations({ search: null, status: "PUBLISHED", timing: null, respondentType: null }),
      ]);
      setAssessmentOptions(
        assessments.items
          .filter((assessment) => assessment.purpose === "PRE_TEST" || assessment.purpose === "POST_TEST")
          .map((assessment) => ({
            id: assessment.assessmentId,
            code: assessment.seriesCode,
            name: assessment.seriesName,
            assessmentType: assessment.purpose === "PRE_TEST" ? "Pre Test" : "Post Test",
            courseName: "-",
            questionCount: assessment.questions.length,
          })),
      );
      setEvaluationOptions(
        evaluations.items.map((evaluation) => ({
          id: evaluation.evaluationFormId,
          code: evaluation.formCode,
          name: evaluation.formName,
          timing: evaluation.timing === "AFTER_TRAINING" ? "After Training" : "30-Day Follow-up",
          respondent: evaluation.respondentType === "EMPLOYEE" ? "Employee" : "Manager",
          scope: evaluation.scope === "CENTRAL" ? "Central" : "Company",
          company: evaluation.companyName || "-",
          questionCount: evaluation.questions.length,
        })),
      );
    } catch (error) {
      console.error("Failed to load published forms", error);
      setAssessmentOptions([]);
      setEvaluationOptions([]);
    }
  };

  const handleCourseGroupChange = (courseGroup: string) => {
    const matchedGroup = courseGroupOptions.find((g) => g.name === courseGroup);
    let nextCode = "";
    if (matchedGroup && matchedGroup.code) {
      if (selectedCourse && selectedCourse.courseGroup === courseGroup && selectedCourse.courseCode) {
        nextCode = selectedCourse.courseCode;
      } else if (isFactoryUser) {
        // Preview only — mirrors the per-company numbering the server assigns in
        // app/lib/courses/repository.ts's generateCourseCode. Each company has its
        // own code space ("<company>-<group>-<seq>"), independent from the center
        // and every other company.
        const companyGroupCourses = courses.filter(
          (c) => c.courseGroup === courseGroup && c.ownerCompany === userCompanyCode,
        );
        let maxSeq = 0;
        for (const c of companyGroupCourses) {
          const parts = (c.courseCode || "").split("-");
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
        nextCode = `${userCompanyCode}-${matchedGroup.code.trim()}-${String(maxSeq + 1).padStart(6, "0")}`;
      } else {
        const groupCourses = courses.filter((c) => c.courseGroup === courseGroup);
        let maxSeq = 0;
        for (const c of groupCourses) {
          const parts = (c.courseCode || "").split("-");
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
        const nextNum = groupCourses.length === 0 ? 1 : Math.max(maxSeq + 1, (matchedGroup.lastCourseNumber ?? 0) + 1);
        nextCode = `${matchedGroup.code.trim()}-${String(nextNum).padStart(6, "0")}`;
      }
    }
    setForm((current) => ({
      ...current,
      courseGroup,
      courseCode: nextCode,
    }));
  };

  const handleDownloadQrCode = async (link: string, filenamePart: string) => {
    const trimmedLink = link.trim();
    if (!trimmedLink) return;
    try {
      const dataUrl = await generateQrCodeDataUrl(trimmedLink, { width: 480, margin: 2 });
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `${form.courseCode || "course"}-${filenamePart}-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      console.error("Failed to generate QR code", error);
      alert("Failed to generate QR code");
    }
  };

  const handleNew = () => {
    void loadPublishedForms();
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setForm(emptyCourseForm);
    setLinkModeFields(new Set());
    resetStandardForm();
    setIsEditing(true);
    setIsNewOpen(true);
  };

  const openCourseEditor = (course: CourseRecord) => {
    void loadPublishedForms();
    setSelectedCourseId(course.id);
    setForm(buildCourseForm(course));
    setLinkModeFields(deriveLinkModeFields(course));
    loadStandardForm(course);
    setIsEditing(true);
    setIsNewOpen(false);
    setOpenDetailCourseId(course.id);
  };

  const handleDeleteCourse = async (course: CourseRecord) => {
    const courseName = getCourseDisplayName(course);
    if (
      !(await confirm({
        message: `Are you sure you want to delete course "${course.courseCode} - ${courseName}"?`,
        confirmLabel: "Delete",
        danger: true,
      }))
    ) {
      return;
    }

    try {
      await deleteCourse(course.id);
      if (selectedCourseId === course.id) {
        setSelectedCourseId("");
      }
      if (openDetailCourseId === course.id) {
        setOpenDetailCourseId("");
      }
      await handleRefresh();
    } catch (error) {
      console.error("Failed to delete course", error);
      alert("Failed to delete course");
    }
  };

  const handleEdit = () => {
    if (!selectedCourse) return;
    openCourseEditor(selectedCourse);
  };

  const handleDelete = async () => {
    if (!selectedCourse) return;
    await handleDeleteCourse(selectedCourse);
  };

  const handleRefresh = async () => {
    listCourseTypes({ status: "ACTIVE" })
      .then((types) =>
        setCourseTypeOptions(
          types.items.map((item: any) => ({ name: item.name, typeId: item.courseTypeId || item.code })),
        ),
      )
      .catch(() => setCourseTypeOptions([]));
    listCourseGroups({ status: "ACTIVE" })
      .then((groups) =>
        setCourseGroupOptions(
          groups.items.map((item: any) => ({
            name: item.name,
            groupId: item.courseGroupId || item.code,
            code: item.code || "",
            lastCourseNumber: item.lastCourseNumber ?? 0,
          })),
        ),
      )
      .catch(() => setCourseGroupOptions([]));
    void listOapPlans({ search: null, status: null }).then((result) => setOapPlans(result.oapPlans || []));
    void loadWorkflowRollingPlans().then(setRollingPlans);
    listPositions()
      .then((result) => setPositionRows(result.items.filter((item) => item.status === "ACTIVE")))
      .catch(() => setPositionRows([]));
    listLevels()
      .then((result) => setLevelRows(result.items.filter((item) => item.status === "ACTIVE")))
      .catch(() => setLevelRows([]));
    void loadPublishedForms();
    listFunctions()
      .then((functions) =>
        setFunctionRows(
          functions.items
            .filter((item) => item.status === "ACTIVE")
            .map((item) => ({ id: item.functionId, code: item.functionCode, name: item.functionNameEn || item.functionNameTh })),
        ),
      )
      .catch(() => setFunctionRows([]));
    listCompanies()
      .then((companies) =>
        setCompanyRows(
          companies.items
            .filter((item) => item.status === "ACTIVE")
            .map((item) => ({ id: item.companyId, code: item.companyCode, name: item.companyNameEn || item.companyNameTh })),
        ),
      )
      .catch(() => setCompanyRows([]));
    listDivisions()
      .then((divisions) =>
        setDivisionRows(
          divisions.items
            .filter((item) => item.status === "ACTIVE")
            .map((item) => ({ id: item.divisionId, code: item.divisionCode, name: item.divisionNameEn || item.divisionNameTh })),
        ),
      )
      .catch(() => setDivisionRows([]));
    listDepartments()
      .then((departments) =>
        setDepartmentRows(
          departments.items
            .filter((item) => item.status === "ACTIVE")
            .map((item) => ({ id: item.departmentId, code: item.departmentCode, name: item.departmentNameEn || item.departmentNameTh })),
        ),
      )
      .catch(() => setDepartmentRows([]));
    listSections()
      .then((sections) =>
        setSectionRows(
          sections.items
            .filter((item) => item.status === "ACTIVE")
            .map((item) => ({ id: item.sectionId, code: item.sectionCode, name: item.sectionNameEn || item.sectionNameTh })),
        ),
      )
      .catch(() => setSectionRows([]));
    listOrgHierarchyUsage()
      .then((result) => setOrgUsage(result.items))
      .catch(() => setOrgUsage([]));

    try {
      const courseData = await listCourses({ search: "", status: null });
      setCourses(courseData.courses || []);
      setStandards(courseData.standards || []);
    } catch (e) {
      console.error(e);
    }

    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setSearch("");
    setIsEditing(false);
    setIsNewOpen(false);
    setForm(emptyCourseForm);
    setLinkModeFields(new Set());
    resetStandardForm();
  };

  const handleShowDetails = (course: CourseRecord) => {
    const isSameOpen = openDetailCourseId === course.id && !isEditing;
    setSelectedCourseId(isSameOpen ? "" : course.id);
    setOpenDetailCourseId(isSameOpen ? "" : course.id);
    setIsNewOpen(false);
    setIsEditing(false);
    setForm(buildCourseForm(course));
    setLinkModeFields(deriveLinkModeFields(course));
    loadStandardForm(course);
  };

  const handleClosePanel = () => {
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setIsNewOpen(false);
    setIsEditing(false);
    setForm(emptyCourseForm);
    setLinkModeFields(new Set());
    resetStandardForm();
  };

  const handleSave = async () => {
    const missingFields: string[] = [];

    if (!form.courseGroup.trim()) {
      missingFields.push("กลุ่มหลักสูตร (Course Group)");
    }
    if (!form.courseType.trim()) {
      missingFields.push("ประเภทหลักสูตร (Course Type)");
    }
    if (!form.courseNameTh.trim()) {
      missingFields.push("ชื่อหลักสูตร ภาษาไทย (Course Name TH)");
    }
    if (!form.courseNameEn.trim()) {
      missingFields.push("ชื่อหลักสูตร ภาษาอังกฤษ (Course Name EN)");
    }
    if (!form.remark.trim()) {
      missingFields.push("ที่มา / เหตุผลในการจัดทำหลักสูตร (Background)");
    }
    if (!form.objective.trim()) {
      missingFields.push("วัตถุประสงค์หลักสูตร (Objective)");
    }
    if (!form.learningContent.trim()) {
      missingFields.push("เนื้อหาการเรียนรู้ (Learning Content)");
    }
    if (!form.targetGroup.trim()) {
      missingFields.push("กลุ่มเป้าหมายผู้เรียน (Target Group)");
    }
    if (linkModeFields.has("preTest") && !form.preTestLink.trim()) {
      missingFields.push("ลิงก์แบบทดสอบก่อนการอบรม (Pre Test Link - กรุณาวาง URL ลิงก์)");
    }
    if (linkModeFields.has("postTest") && !form.postTestLink.trim()) {
      missingFields.push("ลิงก์แบบทดสอบหลังการอบรม (Post Test Link - กรุณาวาง URL ลิงก์)");
    }
    if (linkModeFields.has("evaluation") && !form.evaluationLink.trim()) {
      missingFields.push("ลิงก์แบบประเมินผลหลังการอบรม (Evaluation Link - กรุณาวาง URL ลิงก์)");
    }
    if (linkModeFields.has("evaluationAfter30Day") && !form.evaluationAfter30DayLink.trim()) {
      missingFields.push("ลิงก์แบบประเมินติดตามผล 30 วัน (30-Day Follow-up Evaluation Link - กรุณาวาง URL ลิงก์)");
    }
    if (selectedCompanies.length === 0) {
      missingFields.push("บริษัทกลุ่มเป้าหมาย (Check List Company อย่างน้อย 1 บริษัท)");
    }

    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }

    const courseTypeId = courseTypeOptions.find(t => t.name === form.courseType)?.typeId || "";
    const courseGroupId = courseGroupOptions.find(g => g.name === form.courseGroup)?.groupId || "";
    const standardYear = new Date().getFullYear();

    const input = {
      courseNameTh: form.courseNameTh.trim(),
      courseNameEn: form.courseNameEn.trim(),
      remark: form.remark.trim() || null,
      objective: form.objective,
      learningContent: form.learningContent,
      targetGroup: form.targetGroup,
      methodology: form.methodology,
      durationHours: 1, // UI does not capture duration; default 1 to satisfy DB CHECK (duration_hours > 0)
      validityMonths:
        form.lifeCycleMonth && Number(form.lifeCycleMonth) > 0
          ? Number(form.lifeCycleMonth)
          : null,
      preAssessmentId: form.preTestId || null,
      postAssessmentId: form.postTestId || null,
      evaluationFormId: form.evaluationId || null,
      evaluationFormAfter30DayId: form.evaluationAfter30DayId || null,
      preTestLink: form.preTestLink.trim() || null,
      postTestLink: form.postTestLink.trim() || null,
      evaluationLink: form.evaluationLink.trim() || null,
      evaluationAfter30DayLink: form.evaluationAfter30DayLink.trim() || null,
      status: "Active" as const,
      courseTypeId,
      courseGroupId,

      // course_standard.standard_code has no documented format (Data Dictionary V6.2:
      // required + unique, no generation rule) — this is only used the first time a
      // standard is created for a given year; later courses in the same year reuse it.
      standardCode: `STD-${standardYear}-G${courseGroupId}`,
      standardName: form.courseNameTh.trim() || form.courseNameEn.trim(),
      functionId:
        !standardFunctionCode || standardFunctionCode === allFunctionCode
          ? null
          : functionRows.find((row) => row.code === standardFunctionCode)?.id || null,
      divisionId:
        !standardDivisionCode || standardDivisionCode === allFunctionCode
          ? null
          : divisionRows.find((row) => row.code === standardDivisionCode)?.id || null,
      departmentId:
        !standardDepartmentCode || standardDepartmentCode === allFunctionCode
          ? null
          : departmentRows.find((row) => row.code === standardDepartmentCode)?.id || null,
      sectionId:
        !standardSectionCode || standardSectionCode === allFunctionCode
          ? null
          : sectionRows.find((row) => row.code === standardSectionCode)?.id || null,
      targetCompanies: selectedCompanies,
      targetPositions: selectedPositions,
      targetLevels: selectedLevels,
      standardYear,
    };

    try {
      if (selectedCourseId) {
        await updateCourse(selectedCourseId, input);
      } else {
        await createCourse(input);
      }

      await handleRefresh();
    } catch (error) {
      console.error("Failed to save course", error);
      const msg = error instanceof Error ? error.message : "";
      // 409 duplicate name — the DB unique index is on the normalised Thai name
      if (
        msg.toLowerCase().includes("unique") ||
        msg.toLowerCase().includes("conflict") ||
        msg.toLowerCase().includes("already exists")
      ) {
        alert("ไม่สามารถบันทึกได้\nชื่อหลักสูตรนี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบชื่อหลักสูตร (ภาษาไทย) และแก้ไขให้ไม่ซ้ำกัน");
      } else {
        alert(msg || "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
    }
  };

  const renderCoursePanel = (title: string, stateLabel: string) => {
    const selectedPreTest = publishedPreTests.find(
      (assessment) => assessment.id === form.preTestId,
    );
    const selectedPostTest = publishedPostTests.find(
      (assessment) => assessment.id === form.postTestId,
    );
    const selectedEvaluation = publishedCourseEvaluations.find(
      (evaluation) => evaluation.id === form.evaluationId,
    );
    const selectedFollowUpEvaluation = publishedFollowUpEvaluations.find(
      (evaluation) => evaluation.id === form.evaluationAfter30DayId,
    );

    return (
      <section className={styles.formPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>{isEditing ? "Input form" : "Preview"}</p>
          <h3>{title}</h3>
        </div>
        <div className={styles.panelActions}>
          <span>{stateLabel}</span>
          <button className={styles.closeButton} type="button" onClick={handleClosePanel}>
            Close
          </button>
        </div>

      </div>



      <div className={styles.formGrid}>
        <label>
          <span className={styles.fieldLabel}>Course Group <b>*</b></span>
          <select value={form.courseGroup} disabled={!isEditing} onChange={(event) => handleCourseGroupChange(event.target.value)}>
            <option value="">Select Course Group</option>
            {courseGroups.map((group) => (
              <option key={group} value={group} translate="no">{group}</option>

            ))}
          </select>
          <small className={styles.fieldHint}>Controls course classification and the generated course code.</small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Course Code <b>*</b></span>
          <input
            value={form.courseCode}
            readOnly
            placeholder="Select Course Group to generate code"
            title="Auto-generated from the selected Course Group"
          />
          <small className={styles.fieldHint}>Auto-generated based on selected Course Group.</small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Course Type <b>*</b></span>
          <select
            value={form.courseType}
            disabled={!isEditing}
            onChange={(event) => updateForm("courseType", event.target.value)}
          >
            <option value="">Select Course Type</option>
            {courseTypes.map((type) => (
              <option key={type} value={type} translate="no">{type}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={styles.fieldLabel}>Life Cycle (Month)</span>
          <input
            value={form.lifeCycleMonth}
            disabled={!isEditing}
            inputMode="numeric"
            min="0"
            placeholder="Enter 0 for no course expiration"
            type="number"
            onChange={(event) => updateForm("lifeCycleMonth", event.target.value)}
          />
        </label>
        <label>
          <span className={styles.fieldLabel}>Course Name (TH) <b>*</b></span>
          <input
            value={form.courseNameTh}
            disabled={!isEditing}
            placeholder="ตัวอย่าง: การอบรมความปลอดภัยพื้นฐาน"
            onChange={(event) => updateForm("courseNameTh", event.target.value)}
          />
        </label>
        <label>
          <span className={styles.fieldLabel}>Course Name (EN) <b>*</b></span>
          <input
            value={form.courseNameEn}
            disabled={!isEditing}
            placeholder="Example: Basic Safety Course"
            onChange={(event) => updateForm("courseNameEn", event.target.value)}
          />
        </label>
        <label className={styles.fullWidth}>
          <span className={styles.fieldLabel}>ที่มา (Background) <b>*</b></span>
          <textarea
            value={form.remark}
            disabled={!isEditing}
            placeholder="อธิบายที่มา หรือเหตุผลว่าทำไมถึงจัดหลักสูตรอบรมนี้ (Background / Reason for training)"
            onChange={(event) => updateForm("remark", event.target.value)}
          />
          <small className={styles.fieldHint}>อธิบายที่มา ความจำเป็น หรือเหตุผลในการจัดทำหลักสูตรการอบรมนี้</small>
        </label>
        <label className={styles.fullWidth}>
          <span className={styles.fieldLabel}>Objective <b>*</b></span>
          <textarea
            value={form.objective}
            disabled={!isEditing}
            placeholder="Describe what learners should achieve after completing the course."
            onChange={(event) => updateForm("objective", event.target.value)}
          />
          <small className={styles.fieldHint}>Use a measurable outcome, for example “Explain and apply the five safety rules.”</small>
        </label>
        <label className={styles.fullWidth}>
          <span className={styles.fieldLabel}>Learning Content <b>*</b></span>
          <textarea
            value={form.learningContent}
            disabled={!isEditing}
            placeholder="List the main topics, activities, or skills covered by the course."
            onChange={(event) => updateForm("learningContent", event.target.value)}
          />
        </label>
        <label>
          <span className={styles.fieldLabel}>Target Group <b>*</b></span>
          <textarea
            value={form.targetGroup}
            disabled={!isEditing}
            placeholder="Example: Production employees, supervisors, and new hires"
            onChange={(event) => updateForm("targetGroup", event.target.value)}
          />
        </label>
        <label>
          <span className={styles.fieldLabel}>Methodology</span>
          <textarea
            value={form.methodology}
            disabled={!isEditing}
            placeholder="Example: Lecture, workshop, demonstration, and practice"
            onChange={(event) => updateForm("methodology", event.target.value)}
          />
        </label>
        <div className={styles.linkedFormsHeader}>
          <div>
            <span>Published forms</span>
            <strong>Pre / Post Test and Evaluation</strong>
          </div>
          <p>
            Options are loaded from Assessment and Evaluation Management.
          </p>
        </div>
        <label>
          <span className={styles.fieldLabel}>Pre Test {linkModeFields.has("preTest") ? <b>*</b> : <em>Optional</em>}</span>
          <select
            value={linkModeFields.has("preTest") ? LINK_MODE_VALUE : form.preTestId}
            disabled={!isEditing}
            onChange={(event) =>
              event.target.value === LINK_MODE_VALUE
                ? handleSelectLinkMode("preTest", "preTestId", "preTest")
                : handleAssessmentSelection(
                    "preTestId",
                    "preTest",
                    event.target.value,
                    publishedPreTests,
                  )
            }
          >
            <option value="">
              {form.preTest && !selectedPreTest
                ? `${form.preTest} (Unavailable)`
                : "No Pre Test"}
            </option>
            {publishedPreTests.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                [{assessment.code}] {assessment.name} ({assessment.assessmentType})
              </option>
            ))}
            <option value={LINK_MODE_VALUE}>Use Link</option>
          </select>
          {linkModeFields.has("preTest") ? (
            <div className={styles.linkField}>
              <span className={styles.fieldLabel} style={{ width: "100%", margin: "4px 0 2px" }}>Pre Test Link <b>*</b></span>
              <input
                value={form.preTestLink}
                disabled={!isEditing}
                placeholder="Paste pre-test form link *"
                type="url"
                onChange={(event) =>
                  handleFormLinkChange(
                    "preTestLink",
                    "preTestId",
                    "preTest",
                    event.target.value,
                  )
                }
              />
              {selectedCourseId && form.preTestLink.trim() ? (
                <button
                  type="button"
                  className={styles.detailButton}
                  onClick={() => void handleDownloadQrCode(form.preTestLink, "pre-test")}
                >
                  Download QR
                </button>
              ) : null}
            </div>
          ) : null}
          <small className={styles.catalogHint}>
            {selectedPreTest
              ? `${selectedPreTest.questionCount} questions · Linked course: ${selectedPreTest.courseName}`
              : linkModeFields.has("preTest")
                ? "Manual form link will be used."
                : `${publishedPreTests.length} published Pre Test option${publishedPreTests.length === 1 ? "" : "s"}`}
          </small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Post Test {linkModeFields.has("postTest") ? <b>*</b> : <em>Optional</em>}</span>
          <select
            value={linkModeFields.has("postTest") ? LINK_MODE_VALUE : form.postTestId}
            disabled={!isEditing}
            onChange={(event) =>
              event.target.value === LINK_MODE_VALUE
                ? handleSelectLinkMode("postTest", "postTestId", "postTest")
                : handleAssessmentSelection(
                    "postTestId",
                    "postTest",
                    event.target.value,
                    publishedPostTests,
                  )
            }
          >
            <option value="">
              {form.postTest && !selectedPostTest
                ? `${form.postTest} (Unavailable)`
                : "No Post Test"}
            </option>
            {publishedPostTests.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                [{assessment.code}] {assessment.name} ({assessment.assessmentType})
              </option>
            ))}
            <option value={LINK_MODE_VALUE}>Use Link</option>
          </select>
          {linkModeFields.has("postTest") ? (
            <div className={styles.linkField}>
              <span className={styles.fieldLabel} style={{ width: "100%", margin: "4px 0 2px" }}>Post Test Link <b>*</b></span>
              <input
                value={form.postTestLink}
                disabled={!isEditing}
                placeholder="Paste post-test form link *"
                type="url"
                onChange={(event) =>
                  handleFormLinkChange(
                    "postTestLink",
                    "postTestId",
                    "postTest",
                    event.target.value,
                  )
                }
              />
              {selectedCourseId && form.postTestLink.trim() ? (
                <button
                  type="button"
                  className={styles.detailButton}
                  onClick={() => void handleDownloadQrCode(form.postTestLink, "post-test")}
                >
                  Download QR
                </button>
              ) : null}
            </div>
          ) : null}
          <small className={styles.catalogHint}>
            {selectedPostTest
              ? `${selectedPostTest.questionCount} questions · Linked course: ${selectedPostTest.courseName}`
              : linkModeFields.has("postTest")
                ? "Manual form link will be used."
                : `${publishedPostTests.length} published Post Test option${publishedPostTests.length === 1 ? "" : "s"}`}
          </small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Evaluation After Training {linkModeFields.has("evaluation") ? <b>*</b> : <em>Optional</em>}</span>
          <select
            value={linkModeFields.has("evaluation") ? LINK_MODE_VALUE : form.evaluationId}
            disabled={!isEditing}
            onChange={(event) =>
              event.target.value === LINK_MODE_VALUE
                ? handleSelectLinkMode("evaluation", "evaluationId", "evaluation")
                : handleEvaluationSelection(
                    "evaluationId",
                    "evaluation",
                    event.target.value,
                    publishedCourseEvaluations,
                  )
            }
          >
            <option value="">
              {form.evaluation && !selectedEvaluation
                ? `${form.evaluation} (Unavailable)`
                : "No Evaluation"}
            </option>
            {publishedCourseEvaluations.map((evaluation) => (
              <option key={evaluation.id} value={evaluation.id}>
                [{evaluation.code}] {evaluation.name}
              </option>
            ))}
            <option value={LINK_MODE_VALUE}>Use Link</option>
          </select>
          {linkModeFields.has("evaluation") ? (
            <div className={styles.linkField}>
              <span className={styles.fieldLabel} style={{ width: "100%", margin: "4px 0 2px" }}>Evaluation Link <b>*</b></span>
              <input
                value={form.evaluationLink}
                disabled={!isEditing}
                placeholder="Paste evaluation form link *"
                type="url"
                onChange={(event) =>
                  handleFormLinkChange(
                    "evaluationLink",
                    "evaluationId",
                    "evaluation",
                    event.target.value,
                  )
                }
              />
              {selectedCourseId && form.evaluationLink.trim() ? (
                <button
                  type="button"
                  className={styles.detailButton}
                  onClick={() => void handleDownloadQrCode(form.evaluationLink, "evaluation")}
                >
                  Download QR
                </button>
              ) : null}
            </div>
          ) : null}
          <small className={styles.catalogHint}>
            {selectedEvaluation
              ? `${selectedEvaluation.questionCount} questions · ${selectedEvaluation.respondent} · ${selectedEvaluation.scope}`
              : linkModeFields.has("evaluation")
                ? "Manual form link will be used."
                : `${publishedCourseEvaluations.length} published After Training option${publishedCourseEvaluations.length === 1 ? "" : "s"}`}
          </small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Evaluation After 30 Days {linkModeFields.has("evaluationAfter30Day") ? <b>*</b> : <em>Optional</em>}</span>
          <select
            value={linkModeFields.has("evaluationAfter30Day") ? LINK_MODE_VALUE : form.evaluationAfter30DayId}
            disabled={!isEditing}

            onChange={(event) =>
              event.target.value === LINK_MODE_VALUE
                ? handleSelectLinkMode("evaluationAfter30Day", "evaluationAfter30DayId", "evaluationAfter30Day")
                : handleEvaluationSelection(
                    "evaluationAfter30DayId",
                    "evaluationAfter30Day",
                    event.target.value,
                    publishedFollowUpEvaluations,
                  )
            }
          >
            <option value="">
              {form.evaluationAfter30Day && !selectedFollowUpEvaluation
                ? `${form.evaluationAfter30Day} (Unavailable)`
                : "No 30-Day Evaluation"}
            </option>
            {publishedFollowUpEvaluations.map((evaluation) => (
              <option key={evaluation.id} value={evaluation.id}>
                [{evaluation.code}] {evaluation.name}
              </option>
            ))}
            <option value={LINK_MODE_VALUE}>Use Link</option>
          </select>
          {linkModeFields.has("evaluationAfter30Day") ? (
            <div className={styles.linkField}>
              <span className={styles.fieldLabel} style={{ width: "100%", margin: "4px 0 2px" }}>30-Day Evaluation Link <b>*</b></span>
              <input
                value={form.evaluationAfter30DayLink}
                disabled={!isEditing}
                placeholder="Paste 30-day evaluation form link *"
                type="url"
                onChange={(event) =>
                  handleFormLinkChange(
                    "evaluationAfter30DayLink",
                    "evaluationAfter30DayId",
                    "evaluationAfter30Day",
                    event.target.value,
                  )
                }
              />
              {selectedCourseId && form.evaluationAfter30DayLink.trim() ? (
                <button
                  type="button"
                  className={styles.detailButton}
                  onClick={() =>
                    void handleDownloadQrCode(form.evaluationAfter30DayLink, "evaluation-30day")
                  }
                >
                  Download QR
                </button>
              ) : null}
            </div>
          ) : null}
          <small className={styles.catalogHint}>
            {selectedFollowUpEvaluation
              ? `${selectedFollowUpEvaluation.questionCount} questions · ${selectedFollowUpEvaluation.respondent} · ${selectedFollowUpEvaluation.scope}`
              : linkModeFields.has("evaluationAfter30Day")
                ? "Manual form link will be used."
                : `${publishedFollowUpEvaluations.length} published 30-Day Follow-up option${publishedFollowUpEvaluations.length === 1 ? "" : "s"}`}
          </small>
        </label>
      </div>

      <section className={styles.standard_formPanel} aria-label="Course Standard setup">
        <div className={styles.standard_panelHeader}>
          <div>
            <p className={styles.standard_kicker}>Course Standard</p>
            <h3>Function, Position and Level</h3>
            <p>Define the training target before saving the course.</p>
          </div>
        </div>

        <div className={styles.standard_checkSection}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <h4>Check List Company <span style={{ color: "#d71920" }}>*</span></h4>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={!isEditing || isFactoryUser || companyChecklist.length === 0}
                onClick={() =>
                  !isFactoryUser &&
                  setSelectedCompanies(
                    companyChecklist.every((code) => selectedCompanies.includes(code))
                      ? []
                      : companyChecklist,
                  )
                }
              >
                {companyChecklist.length > 0 &&
                companyChecklist.every((code) => selectedCompanies.includes(code))
                  ? "Uncheck All"
                  : "Check All"}
              </button>
            </div>
            <div className={styles.standard_checkGrid}>
              {companyChecklist.map((code) => (
                <label
                  className={`${styles.standard_checkItem} ${
                    selectedCompanies.includes(code)
                      ? styles.standard_checkItemSelected
                      : ""
                  }`}
                  key={code}
                >
                  <input
                    className={styles.standard_nativeCheckbox}
                    checked={selectedCompanies.includes(code)}
                    disabled={!isEditing || isFactoryUser}
                    type="checkbox"
                    onChange={() =>
                      !isFactoryUser && toggleStandardItem(code, selectedCompanies, setSelectedCompanies)
                    }
                  />
                  <span className={styles.standard_checkMark} aria-hidden="true">
                    {selectedCompanies.includes(code) ? "✓" : ""}
                  </span>
                  <span translate="no">{code}</span>
                </label>
              ))}
            </div>
            {isEditing && selectedCompanies.length === 0 ? (
              <p style={{ color: "#d71920", margin: "6px 0 0" }}>
                Select at least one company.
              </p>
            ) : null}
          </div>
        </div>

        <div className={styles.standard_formGrid}>
          <label>
            <span className={styles.fieldLabel} translate="no">Function Name</span>
            <SearchableSelect
              value={standardFunctionCode}
              disabled={!isEditing}
              options={functionOptions}
              placeholder="Search or select Function"
              onChange={(nextCode) => {
                setStandardFunctionCode(nextCode);
                setStandardFunctionName(
                  functionOptions.find((option) => option.code === nextCode)
                    ?.name ?? "",
                );
              }}
            />
          </label>

          <label>
            <span className={styles.fieldLabel} translate="no">Division</span>
            <SearchableSelect
              value={standardDivisionCode}
              disabled={!isEditing}
              options={divisionOptions}
              placeholder="Search or select Division"
              onChange={(nextCode) => setStandardDivisionCode(nextCode)}
            />
          </label>

          <label>
            <span className={styles.fieldLabel} translate="no">Department</span>
            <SearchableSelect
              value={standardDepartmentCode}
              disabled={!isEditing}
              options={departmentOptions}
              placeholder="Search or select Department"
              onChange={(nextCode) => setStandardDepartmentCode(nextCode)}
            />
          </label>

          <label>
            <span className={styles.fieldLabel} translate="no">Section</span>
            <SearchableSelect
              value={standardSectionCode}
              disabled={!isEditing}
              options={sectionOptions}
              placeholder="Search or select Section"
              onChange={(nextCode) => setStandardSectionCode(nextCode)}
            />
          </label>
        </div>

        <div className={styles.standard_checkSection}>
          <div>
            <h4>Check List Position</h4>
            <div className={styles.standard_checkGrid} translate="no">
              {positionChecklist.map((position) => (
                <label
                  className={`${styles.standard_checkItem} ${
                    selectedPositions.includes(position)
                      ? styles.standard_checkItemSelected
                      : ""
                  }`}
                  key={position}
                >
                  <input
                    className={styles.standard_nativeCheckbox}
                    checked={selectedPositions.includes(position)}
                    disabled={!isEditing}
                    type="checkbox"
                    onChange={() =>
                      toggleStandardItem(position, selectedPositions, setSelectedPositions)
                    }
                  />
                  <span className={styles.standard_checkMark} aria-hidden="true">
                    {selectedPositions.includes(position) ? "✓" : ""}
                  </span>
                  <span translate="no">{position}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4>Check List Level</h4>
            <div className={styles.standard_levelGrid} translate="no">
              {levelChecklist.map((level) => (
                <label
                  className={`${styles.standard_checkItem} ${
                    selectedLevels.includes(level)
                      ? styles.standard_checkItemSelected
                      : ""
                  }`}
                  key={level}
                >
                  <input
                    className={styles.standard_nativeCheckbox}
                    checked={selectedLevels.includes(level)}
                    disabled={!isEditing}
                    type="checkbox"
                    onChange={() =>
                      toggleStandardItem(level, selectedLevels, setSelectedLevels)
                    }
                  />
                  <span className={styles.standard_checkMark} aria-hidden="true">
                    {selectedLevels.includes(level) ? "✓" : ""}
                  </span>
                  <span translate="no">{level}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isEditing ? (
        <div className={styles.formActions}>
          <button
            className={styles.primaryButton}
            disabled={!isCourseFormReady || selectedCompanies.length === 0}
            type="button"
            onClick={handleSave}
          >
            บันทึกหลักสูตรและมาตรฐาน / Save Course & Standard
          </button>
          <button className={styles.secondaryButton} type="button" onClick={handleClosePanel}>
            Cancel
          </button>
        </div>
      ) : null}
      </section>
    );
  };

  if (isLoadingData) {
    return (
      <section className={styles.page} aria-label="Course Master management">
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{courseMasterModule.subtitle}</p>
            <h2 translate="no">{courseMasterModule.title}</h2>
            <p>{courseMasterModule.description}</p>
          </div>
        </section>
        <TypewriterLoader label="กำลังโหลดข้อมูลหลักสูตรและมาตรฐาน..." />
      </section>
    );
  }

  return (
    <section className={styles.page} aria-label="Course Master management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{courseMasterModule.subtitle}</p>
          <h2 translate="no">{courseMasterModule.title}</h2>
          <p>{courseMasterModule.description}</p>
        </div>
      </section>

      <section className={styles.toolbar} aria-label="Course actions">
        <input
          aria-label="Search course"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search course code, name, type, group"
        />
        <button className={styles.primaryButton} type="button" onClick={handleNew}>
          + New
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => !isSelectedCourseReadOnlyForFactory && handleEdit()}
          disabled={!selectedCourse || isSelectedCourseReadOnlyForFactory}
          title={isSelectedCourseReadOnlyForFactory ? "หลักสูตรของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้" : undefined}
        >
          Edit
        </button>
        <button
          className={styles.dangerButton}
          type="button"
          onClick={() => !isSelectedCourseReadOnlyForFactory && void handleDelete()}
          disabled={!selectedCourse || isSelectedCourseReadOnlyForFactory}
          title={isSelectedCourseReadOnlyForFactory ? "หลักสูตรของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : undefined}
        >
        Delete
        </button>
        <button className={styles.secondaryButton} type="button" onClick={() => setIsImportModalOpen(true)}>
          📥 Import Excel
        </button>
        <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
          Refresh
        </button>
      </section>

      <p className={styles.selectionHint} aria-live="polite">
        {selectedCourse
          ? `Selected: [${selectedCourse.courseCode}] ${getCourseDisplayName(selectedCourse)}`
          : "Click on any course row in the table below to select, edit, or delete."}
      </p>

      {isNewOpen ? (
        <div className={styles.topDropPanel}>
          {renderCoursePanel("New course", "New")}
        </div>
      ) : null}

      <section className={styles.listPanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>{language === 'th' ? 'รายการหลักสูตร' : 'Course list'}</p>
            <h3>{language === 'th' ? 'ข้อมูลหลักสูตร (Course Master)' : 'Course Master Records'}</h3>
          </div>
          <span>{filteredCourses.length} {language === 'th' ? 'รายการ' : 'records'}</span>
        </div>

        {/* Company selector – only for Center users */}
        {!isFactoryUser && (
          <div style={{ marginBottom: '12px' }}>
            <SearchableSelect
              value={listCompanyFilter}
              options={[
                { code: '', name: language === 'th' ? 'ทั้งหมด (All)' : 'All' },
                ...companyRows.map((row) => ({ code: row.code, name: language === 'th' ? row.nameTh || row.name : row.nameEn || row.name })),
              ]}
              placeholder={language === 'th' ? 'เลือกบริษัท' : 'Select Company'}
              onChange={(code) => {
                setListCompanyFilter(code);
              }}
            />
          </div>
        )}

        <div className={styles.companySectionsContainer}>
          {companySections.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
              {language === 'th' ? 'ไม่พบข้อมูลหลักสูตร' : 'No courses found'}
            </div>
          ) : (
            companySections.map((section) => (
              <div key={section.companyName} className={styles.companySectionBlock}>
                <div className={`${styles.companySectionHeader} ${section.isUserCompany ? styles.ownCompanySectionHeader : ""}`}>
                  <div className={styles.companySectionTitle}>
                    <span className={styles.companyIcon}>{section.companyName === "HRD Center" ? "🏢" : "🏬"}</span>
                    <h4>
                      {section.companyName === "HRD Center"
                        ? (language === 'th' ? "หลักสูตรส่วนกลาง (HRD Center)" : "HRD Center Courses")
                        : (language === 'th' ? `หลักสูตรบริษัท ${section.companyName}` : `Company ${section.companyName} Courses`)}
                    </h4>
                    {section.isUserCompany ? (
                      <span className={styles.ownCompanySectionTag}>
                        {language === 'th'
                          ? `⭐ บริษัทของฉัน (${userCompanyCode || "HRD Center"})`
                          : `⭐ My Company (${userCompanyCode || "HRD Center"})`}
                      </span>
                    ) : null}
                  </div>
                  <span className={styles.companyCountBadge}>
                    {section.courses.length} {language === 'th' ? 'หลักสูตร' : 'courses'}
                  </span>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.courseTable}>
                    <thead>
                      <tr>
                        <th>{language === 'th' ? 'รหัสหลักสูตร' : 'Course Code'}</th>
                        <th>{language === 'th' ? 'ชื่อหลักสูตร' : 'Course Name'}</th>
                        <th>{language === 'th' ? 'บริษัท' : 'Company'}</th>
                        <th>{language === 'th' ? 'Classification' : 'Classification'}</th>
                        <th>{language === 'th' ? 'Course Standard' : 'Course Standard'}</th>
                        <th>{language === 'th' ? 'Actions' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.courses.map((course) => {
                        const isOpen = openDetailCourseId === course.id && !isNewOpen;
                        const courseStandard = standards.find(
                          (standard) =>
                            standard.courseId === course.id ||
                            standard.courseCode === course.courseCode,
                        );
                        const isCenterCourse = course.owner === "CENTER" || course.ownerCompany === "CENTER" || course.ownerCompany === "HRD Center" || !course.ownerCompany;
                        const isRowReadOnlyForFactory = isFactoryUser && isCenterCourse;
                        return (
                          <Fragment key={course.id}>
                            <tr
                              className={course.id === selectedCourseId ? styles.selectedRow : undefined}
                              onClick={() => setSelectedCourseId(course.id === selectedCourseId ? "" : course.id)}
                              style={{ cursor: "pointer" }}
                            >
                              <td>{course.courseCode}</td>
                              <td>
                                <strong>{getCourseDisplayName(course)}</strong>
                                {getCourseSecondaryName(course) ? (
                                  <span>{getCourseSecondaryName(course)}</span>
                                ) : null}
                              </td>
                              <td>{course.ownerCompany || (language === 'th' ? 'ไม่ระบุ' : 'N/A')}</td>
                              <td>
                                <strong translate="no">{course.courseType}</strong>
                                <span>{course.courseGroup}</span>
                              </td>
                              <td>
                                <strong translate={courseStandard ? "no" : undefined}>
                                  {courseStandard
                                    ? getFunctionDisplayName(
                                        courseStandard.functionCode,
                                        courseStandard.functionName,
                                      )
                                    : "Not set"}
                                </strong>
                                <span>
                                  {courseStandard
                                    ? `${courseStandard.positions.length} positions · ${courseStandard.levels.length} levels`
                                    : "No standard"}
                                </span>
                              </td>
                              <td className={styles.actionCell} onClick={(e) => e.stopPropagation()}>
                                <button
                                  className={styles.detailButton}
                                  type="button"
                                  onClick={() => handleShowDetails(course)}
                                >
                                  {isOpen && !isEditing ? "Hide" : "Details"}
                                </button>
                                <button
                                  className={styles.secondaryButton}
                                  type="button"
                                  disabled={isRowReadOnlyForFactory}
                                  title={isRowReadOnlyForFactory ? "หลักสูตรของส่วนกลาง (HRD Center) โรงงานไม่สามารถแก้ไขได้" : undefined}
                                  onClick={() => !isRowReadOnlyForFactory && openCourseEditor(course)}
                                >
                                  Edit
                                </button>
                                <button
                                  className={styles.dangerButton}
                                  type="button"
                                  disabled={isRowReadOnlyForFactory}
                                  title={isRowReadOnlyForFactory ? "หลักสูตรของส่วนกลาง (HRD Center) โรงงานไม่สามารถลบได้" : undefined}
                                  onClick={() => !isRowReadOnlyForFactory && void handleDeleteCourse(course)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                            {isOpen ? (
                              <tr className={styles.detailRow}>
                                <td colSpan={6}>
                                  <div className={styles.inlinePanel}>
                                    {renderCoursePanel(
                                      isEditing ? "Edit course" : getCourseDisplayName(course),
                                      isEditing ? "Editing" : "Read only",
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {isImportModalOpen ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "min(860px, 95vw)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem", color: "#0f172a" }}>
                  📥 นำเข้าข้อมูลหลักสูตร (Import Course Master via Excel/CSV)
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
                  เลือกไฟล์ Excel เพื่อสร้างรายชื่อหลักสูตรและมาตรฐานกลุ่มเป้าหมายในระบบจำนวนมาก
                </p>
              </div>
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#64748b",
                }}
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportRows([]);
                  setImportFileName("");
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              <div
                style={{
                  border: "2px dashed #cbd5e1",
                  borderRadius: "12px",
                  padding: "24px",
                  textAlign: "center",
                  background: "#f8fafc",
                  marginBottom: "20px",
                }}
              >
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  style={{ display: "none" }}
                  onChange={handleExcelFileChange}
                />
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📊</div>
                <h4 style={{ margin: "0 0 6px", color: "#1e293b", fontSize: "1rem" }}>
                  {importFileName ? `ไฟล์ที่เลือก: ${importFileName}` : "ลากไฟล์มาวางที่นี่ หรือคลิกปุ่มเพื่อเลือกไฟล์ Excel"}
                </h4>
                <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "0.82rem" }}>
                  รองรับไฟล์รูปแบบ .xlsx, .xls และ .csv
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <button
                    type="button"
                    style={{
                      background: "#3b82f6",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 18px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    onClick={() => importFileInputRef.current?.click()}
                  >
                    📁 Select Excel File
                  </button>
                  <button
                    type="button"
                    style={{
                      background: "#f1f5f9",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      padding: "8px 18px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    onClick={handleDownloadExcelTemplate}
                  >
                    📄 Download Template
                  </button>
                </div>
              </div>

              {importNotice ? (
                <div style={{ color: "#ef4444", fontWeight: 700, marginBottom: "16px", fontSize: "0.88rem" }}>
                  {importNotice}
                </div>
              ) : null}

              {importRows.length > 0 ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <h4 style={{ margin: 0, color: "#0f172a" }}>
                      ตัวอย่างข้อมูลที่พบ ({importRows.length} รายการ):
                    </h4>
                  </div>
                  <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", maxHeight: "280px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                          <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Course Code</th>
                          <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Course Name (TH)</th>
                          <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Group</th>
                          <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Type</th>
                          <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Positions</th>
                          <th style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>Levels</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 12px" }}>{row.rowNum}</td>
                            <td style={{ padding: "8px 12px", fontWeight: 700, color: "#2563eb" }}>{row.courseCode || "(Auto)"}</td>
                            <td style={{ padding: "8px 12px" }}>{row.courseNameTh}</td>
                            <td style={{ padding: "8px 12px" }}>{row.courseGroup || "General"}</td>
                            <td style={{ padding: "8px 12px" }}>{row.courseType || "IN-HOUSE"}</td>
                            <td style={{ padding: "8px 12px" }}>{row.positions || "-"}</td>
                            <td style={{ padding: "8px 12px" }}>{row.levels || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportRows([]);
                  setImportFileName("");
                }}
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="button"
                disabled={importRows.length === 0}
                style={{
                  background: importRows.length === 0 ? "#94a3b8" : "#10b981",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 22px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  cursor: importRows.length === 0 ? "not-allowed" : "pointer",
                }}
                onClick={handleCommitExcelImport}
              >
                ยืนยันการนำเข้าข้อมูล ({importRows.length} รายการ)
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}
