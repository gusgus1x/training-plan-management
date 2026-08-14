"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { downloadCsvTemplate, parseCsvText } from "../../../../lib/excelHelper";
import {
  TRAINING_MASTER_KEYS,
  TRAINING_WORKFLOW_EVENT,
  TRAINING_WORKFLOW_KEYS,
  getCourseDisplayName,
  getCourseSecondaryName,
  isWorkflowOwner,
  readMasterCollection,
  readWorkflowCollection,
  writeWorkflowCollection,
  type WorkflowCourse,
  type WorkflowOwner,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { normalizeEmployeeLevel } from "../../../../lib/employeeMasterData";
import {
  readPublishedAssessmentOptions,
  readPublishedEvaluationOptions,
  type TrainingAssessmentOption,
  type TrainingEvaluationOption,
} from "../../../../lib/trainingFormCatalog";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import { companyCodes, type CompanyCode } from "../../MasterDataManagement/modules/CompanyData";
import { defaultCourseGroups } from "../../MasterDataManagement/modules/CourseGroup";
import { defaultCourseTypes } from "../../MasterDataManagement/modules/CourseType";
import { defaultFunctionRows } from "../../MasterDataManagement/modules/FunctionData";
import { defaultLevelRows } from "../../MasterDataManagement/modules/LevelData";
import { defaultPositionRows } from "../../MasterDataManagement/modules/PositionData";
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

type SearchableSelectOption = {
  value: string;
  label: string;
  subLabel?: string;
};

function SearchableSelect({
  label,
  value,
  placeholder,
  options,
  disabled,
  onChange,
  allOptionLabel = "All",
}: {
  label: string;
  value: string;
  placeholder?: string;
  options: SearchableSelectOption[];
  disabled?: boolean;
  onChange: (val: string, option?: SearchableSelectOption) => void;
  allOptionLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue =
    value === "all" || value === "__ALL__"
      ? allOptionLabel
      : selectedOption?.label || value || allOptionLabel;

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        opt.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div className={styles.searchableSelectContainer} ref={containerRef}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.searchableInputWrap}>
        <input
          className={styles.searchableInput}
          type="text"
          disabled={disabled}
          placeholder={placeholder || `พิมพ์เพื่อค้นหา ${label}...`}
          value={isOpen ? query : displayValue}
          onFocus={() => {
            if (!disabled) {
              setQuery("");
              setIsOpen(true);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filteredOptions.length > 0) {
              e.preventDefault();
              const first = filteredOptions[0];
              onChange(first.value, first);
              setIsOpen(false);
              setQuery("");
            } else if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
        />
        {value && value !== "all" && value !== "__ALL__" && !disabled ? (
          <button
            type="button"
            className={styles.clearSelectBtn}
            onClick={(e) => {
              e.stopPropagation();
              const defaultVal = options[0]?.value === "__ALL__" ? "__ALL__" : "all";
              onChange(defaultVal, options[0]);
              setQuery("");
              setIsOpen(false);
            }}
            title="ล้างตัวเลือก / Reset"
          >
            ✕
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className={styles.toggleDropdownBtn}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              if (!isOpen) setQuery("");
            }
          }}
        >
          <span className={styles.arrowIcon}>{isOpen ? "▲" : "▼"}</span>
        </button>
      </div>

      {isOpen && !disabled ? (
        <ul className={styles.dropdownMenu} role="listbox">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li
                  key={opt.value}
                  className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemSelected : ""}`}
                  onClick={() => {
                    onChange(opt.value, opt);
                    setIsOpen(false);
                    setQuery("");
                  }}
                >
                  <div className={styles.itemContent}>
                    <strong>{opt.label}</strong>
                    {opt.subLabel && opt.subLabel !== opt.label ? (
                      <span>{opt.subLabel}</span>
                    ) : null}
                  </div>
                  {isSelected ? <span className={styles.itemCheck}>✓</span> : null}
                </li>
              );
            })
          ) : (
            <li className={styles.noResultsItem}>
              ไม่พบข้อมูลที่ตรงกับ "{query}"
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

function CourseMaster() {
  const user = useAuthenticatedUser();
  const { language } = useUiLanguage();
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const factoryCourseTypeAllowlist = ["IN-HOUSE", "PUBLIC", "OJT"];
  const [courseTypes] = useState(() => {
    const allTypes = readMasterCollection(TRAINING_MASTER_KEYS.courseTypes, defaultCourseTypes).map(
      (type) => type.name,
    );
    return isFactoryUser
      ? allTypes.filter((name) => factoryCourseTypeAllowlist.includes(name))
      : allTypes;
  });
  const [courseGroupOptions] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.courseGroups, defaultCourseGroups),
  );
  const courseGroups = courseGroupOptions.map((group) => group.name);
  const [assessmentOptions, setAssessmentOptions] = useState<
    TrainingAssessmentOption[]
  >(readPublishedAssessmentOptions);
  const [evaluationOptions, setEvaluationOptions] = useState<
    TrainingEvaluationOption[]
  >(readPublishedEvaluationOptions);
  const [courses, setCourses] = useState<CourseRecord[]>(() =>
    readWorkflowCollection<CourseRecord>(TRAINING_WORKFLOW_KEYS.courses),
  );
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [form, setForm] = useState<CourseForm>(emptyCourseForm);
  const [isEditing, setIsEditing] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [openDetailCourseId, setOpenDetailCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [standards, setStandards] = useState<CourseStandardRecord[]>(() =>
    readWorkflowCollection<CourseStandardRecord>(TRAINING_WORKFLOW_KEYS.standards),
  );

  useEffect(() => {
    const syncWorkflowData = () => {
      setCourses(readWorkflowCollection<CourseRecord>(TRAINING_WORKFLOW_KEYS.courses));
      setStandards(readWorkflowCollection<CourseStandardRecord>(TRAINING_WORKFLOW_KEYS.standards));
    };

    window.addEventListener(TRAINING_WORKFLOW_EVENT, syncWorkflowData);
    return () => window.removeEventListener(TRAINING_WORKFLOW_EVENT, syncWorkflowData);
  }, []);
  const [standardCompanies, setStandardCompanies] = useState<string[]>(() => [...companyCodes]);
  const [standardFunctionCode, setStandardFunctionCode] = useState(allFunctionCode);
  const [standardFunctionName, setStandardFunctionName] = useState(allFunctionOption);
  const [standardSection, setStandardSection] = useState("all");
  const [standardDepartment, setStandardDepartment] = useState("all");
  const [standardDivision, setStandardDivision] = useState("all");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [functionRows, setFunctionRows] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.functions, defaultFunctionRows),
  );
  const [positionRows, setPositionRows] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.positions, defaultPositionRows),
  );
  const [levelRows, setLevelRows] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.levels, defaultLevelRows),
  );

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
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
        buildCourseCode(resolvedGroup, "", "");

      if (user?.roleCode === "HRD_CENTER") {
        const factoryPrefixes = ["ATA-", "TEP-", "ATFB-", "NIC-", "SATI-", "SNF-"];
        if (factoryPrefixes.some((p) => resolvedCode.toUpperCase().startsWith(p))) {
          return;
        }
      }

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
        preTest: item.preTest?.toLowerCase() === "yes" ? "Pre Test" : "-",
        postTest: item.postTest?.toLowerCase() === "yes" ? "Post Test" : "-",
        evaluation: "After Training Evaluation",
        evaluationAfter30Day: "30-Day Evaluation",
        lifeCycleMonth: item.lifeCycleMonth || "12",
        status: "Active",
        remark: "",
        updatedAt: new Date().toISOString().slice(0, 10),
        owner: user?.roleCode === "HRD_CENTER" ? "CENTER" : "FACTORY",
        ownerCompany: user?.roleCode === "HRD_CENTER" ? "HRD Center" : (userCompanyCode || "Factory"),
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

    saveCourses(newCourses);
    saveStandards(newStandards);
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName("");
    alert(`🎉 นำเข้าข้อมูล Course Master สำเร็จจำนวน ${importedCount} รายการ!`);
  };
  const allFunctionDisplayName =
    language === "th" ? allFunctionThaiDisplayName : allFunctionOption;
  const getLocalizedFunctionName = (row: (typeof functionRows)[number]) =>
    language === "th"
      ? row.functionNameTh || row.functionNameEn
      : row.functionNameEn || row.functionNameTh;

  const isAllCompaniesSelected = standardCompanies.length === companyCodes.length;

  const toggleStandardCompany = (comp: string) => {
    setStandardCompanies((current) => {
      if (current.includes(comp)) {
        return current.filter((c) => c !== comp);
      }
      return [...current, comp];
    });
    setStandardFunctionCode(allFunctionCode);
    setStandardFunctionName(allFunctionDisplayName);
    setStandardSection("all");
    setStandardDepartment("all");
    setStandardDivision("all");
  };

  const toggleAllStandardCompanies = () => {
    setStandardCompanies((current) =>
      current.length === companyCodes.length ? [] : [...companyCodes],
    );
    setStandardFunctionCode(allFunctionCode);
    setStandardFunctionName(allFunctionDisplayName);
    setStandardSection("all");
    setStandardDepartment("all");
    setStandardDivision("all");
  };

  const companyFilteredRows = useMemo(() => {
    if (standardCompanies.length === 0) {
      return [];
    }
    if (standardCompanies.length === companyCodes.length) {
      return functionRows;
    }
    return functionRows.filter((r) => standardCompanies.includes(r.compCode));
  }, [functionRows, standardCompanies]);

  const distinctFunctions = useMemo(() => {
    const map = new Map<
      string,
      { code: string; nameTh: string; nameEn: string; displayName: string }
    >();
    companyFilteredRows.forEach((r) => {
      const code = r.functionCode || "";
      const nameTh = r.functionNameTh || "";
      const nameEn = r.functionNameEn || "";
      const displayName = language === "th" ? nameTh || nameEn : nameEn || nameTh;
      if (displayName && !map.has(displayName)) {
        map.set(displayName, { code, nameTh, nameEn, displayName });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "th"),
    );
  }, [companyFilteredRows, language]);

  const functionOptions = useMemo(
    () => [
      { code: allFunctionCode, name: allFunctionDisplayName },
      ...distinctFunctions.map((f) => ({
        code: f.code,
        name: f.displayName,
      })),
    ],
    [allFunctionDisplayName, distinctFunctions],
  );

  const matchingFunctionRows = useMemo(() => {
    if (standardFunctionCode === allFunctionCode) {
      return companyFilteredRows;
    }
    return companyFilteredRows.filter(
      (r) =>
        r.functionCode === standardFunctionCode ||
        r.functionNameTh === standardFunctionName ||
        r.functionNameEn === standardFunctionName ||
        (language === "th"
          ? r.functionNameTh || r.functionNameEn
          : r.functionNameEn || r.functionNameTh) === standardFunctionName,
    );
  }, [companyFilteredRows, standardFunctionCode, standardFunctionName, language]);

  const availableStandardSections = useMemo(() => {
    const set = new Set<string>();
    matchingFunctionRows.forEach((r) => {
      const val = r.sectionTh || r.sectionEn;
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [matchingFunctionRows]);

  const availableStandardDepartments = useMemo(() => {
    const set = new Set<string>();
    matchingFunctionRows.forEach((r) => {
      const val = r.departmentTh || r.departmentEn;
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [matchingFunctionRows]);

  const availableStandardDivisions = useMemo(() => {
    const set = new Set<string>();
    matchingFunctionRows.forEach((r) => {
      const val = r.divisionTh || r.divisionEn;
      if (val) set.add(val);
    });
    return Array.from(set).sort();
  }, [matchingFunctionRows]);

  const functionSelectOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: allFunctionCode, label: allFunctionDisplayName },
      ...distinctFunctions.map((f) => ({
        value: f.code,
        label: f.displayName,
        subLabel: f.code && f.code !== f.displayName ? f.code : undefined,
      })),
    ],
    [allFunctionDisplayName, distinctFunctions],
  );

  const sectionSelectOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: "all", label: "All Sections" },
      ...availableStandardSections.map((sec) => ({
        value: sec,
        label: sec,
      })),
    ],
    [availableStandardSections],
  );

  const departmentSelectOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: "all", label: "All Departments" },
      ...availableStandardDepartments.map((dept) => ({
        value: dept,
        label: dept,
      })),
    ],
    [availableStandardDepartments],
  );

  const divisionSelectOptions: SearchableSelectOption[] = useMemo(
    () => [
      { value: "all", label: "All Divisions" },
      ...availableStandardDivisions.map((div) => ({
        value: div,
        label: div,
      })),
    ],
    [availableStandardDivisions],
  );

  const getFunctionDisplayName = (functionCode?: string, functionName = "") => {
    if (functionCode === allFunctionCode || functionName === allFunctionOption) {
      return allFunctionDisplayName;
    }

    if (!functionCode && !functionName) {
      return "";
    }

    const matchingFunction = functionRows.find(
      (row) =>
        row.functionCode === functionCode ||
        row.functionNameTh === functionName ||
        row.functionNameEn === functionName,
    );

    return matchingFunction ? getLocalizedFunctionName(matchingFunction) : functionName;
  };
  const positionChecklist = positionRows
    .map((row) => row.positionNameEn.trim())
    .filter(Boolean);
  const levelChecklist = levelRows
    .map((row) => normalizeEmployeeLevel(row.levelKey))
    .filter(Boolean);

  const requiredCourseValues = [
    form.courseCode,
    form.courseNameTh,
    form.courseNameEn,
    form.courseGroup,
    form.courseType,
    form.objective,
    form.learningContent,
    form.targetGroup,
  ];
  const completedRequiredFields = requiredCourseValues.filter(
    (value) => value.trim().length > 0,
  ).length;
  const requiredFieldCount = requiredCourseValues.length;
  const isCourseFormReady =
    completedRequiredFields === requiredFieldCount;

  const publishedPreTests = useMemo(
    () =>
      assessmentOptions.filter(
        (assessment) => assessment.assessmentType === "Pre Test",
      ),
    [assessmentOptions],
  );
  const publishedPostTests = useMemo(
    () =>
      assessmentOptions.filter(
        (assessment) => assessment.assessmentType === "Post Test",
      ),
    [assessmentOptions],
  );
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

  const userCompanyCode = profileValue(user?.companyCode);
  const owner: WorkflowOwner = user?.roleCode === "HRD_CENTER" ? "CENTER" : "FACTORY";
  const ownerCompany = owner === "CENTER" ? "HRD Center" : userCompanyCode;
  const scopedCourses = useMemo(
    () =>
      courses.filter((course) => {
        if (user?.roleCode === "HRD_FACTORY") {
          return course.ownerCompany === userCompanyCode;
        }
        return (
          course.owner === "CENTER" ||
          course.ownerCompany === "HRD Center" ||
          course.ownerCompany === "All Companies" ||
          !course.ownerCompany
        );
      }),
    [courses, user?.roleCode, userCompanyCode],
  );
  const selectedCourse = scopedCourses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedStandard =
    standards.find(
      (standard) =>
        standard.courseId === selectedCourse?.id ||
        standard.courseCode === selectedCourse?.courseCode,
    ) ?? null;
  const filteredCourses = useMemo(
    () =>
      scopedCourses.filter((course) =>
        [
          course.courseCode,
          course.courseNameTh,
          course.courseNameEn,
          course.courseType,
          course.courseGroup,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [scopedCourses, search],
  );
  const saveCourses = (nextCourses: CourseRecord[]) => {
    setCourses(nextCourses);
    writeWorkflowCollection(TRAINING_WORKFLOW_KEYS.courses, nextCourses);
  };

  const saveStandards = (nextStandards: CourseStandardRecord[]) => {
    setStandards(nextStandards);
    writeWorkflowCollection(TRAINING_WORKFLOW_KEYS.standards, nextStandards);
  };

  const resetStandardForm = () => {
    setStandardCompanies([...companyCodes]);
    setStandardFunctionCode(allFunctionCode);
    setStandardFunctionName(allFunctionDisplayName);
    setStandardSection("all");
    setStandardDepartment("all");
    setStandardDivision("all");
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

    setStandardCompanies(
      !standard.companies || standard.companies.length === 0 || standard.companies.length === companyCodes.length
        ? [...companyCodes]
        : standard.companies,
    );
    const matchingFunctionOption = functionOptions.find(
      (option) =>
        option.code === standard.functionCode ||
        option.name === standard.functionName,
    );
    const matchingFunctionRow = functionRows.find(
      (row) =>
        row.functionCode === standard.functionCode ||
        row.functionNameTh === standard.functionName ||
        row.functionNameEn === standard.functionName,
    );
    setStandardFunctionCode(
      matchingFunctionOption?.code ??
        matchingFunctionRow?.functionCode ??
        allFunctionCode,
    );
    setStandardFunctionName(
      getFunctionDisplayName(standard.functionCode, standard.functionName) ||
        allFunctionDisplayName,
    );
    setStandardSection(standard.section || "all");
    setStandardDepartment(standard.department || "all");
    setStandardDivision(standard.division || "all");
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

  const buildCourseCode = (
    courseGroup: string,
    currentCode = "",
    excludedCourseId = "",
  ) => {
    if (!courseGroup) {
      return "";
    }

    const groupId =
      courseGroupOptions.find((group) => group.name === courseGroup)?.groupId ||
      "CRS";
    const prefix = isFactoryUser && userCompanyCode ? `${userCompanyCode}-${groupId}` : groupId;
    const currentSequence = currentCode.match(/(\d+)$/)?.[1];
    const preferredCode = currentSequence
      ? `${prefix}-${currentSequence.padStart(3, "0")}`
      : "";
    const codeExists = (courseCode: string) =>
      courses.some(
        (course) =>
          course.id !== excludedCourseId &&
          course.courseCode.toUpperCase() === courseCode.toUpperCase(),
      );

    if (preferredCode && !codeExists(preferredCode)) {
      return preferredCode;
    }

    const highestSequence = courses.reduce((highest, course) => {
      if (course.id === excludedCourseId) {
        return highest;
      }

      const match = course.courseCode.match(
        new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`, "i"),
      );
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);

    return `${prefix}-${String(highestSequence + 1).padStart(3, "0")}`;
  };

  const handleCourseGroupChange = (courseGroup: string) => {
    setForm((current) => ({
      ...current,
      courseGroup,
      courseCode: buildCourseCode(
        courseGroup,
        current.courseCode,
        selectedCourseId,
      ),
    }));
  };

  const handleNew = () => {
    setAssessmentOptions(readPublishedAssessmentOptions());
    setEvaluationOptions(readPublishedEvaluationOptions());
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setForm(emptyCourseForm);
    resetStandardForm();
    setIsEditing(true);
    setIsNewOpen(true);
  };

  const openCourseEditor = (course: CourseRecord) => {
    setAssessmentOptions(readPublishedAssessmentOptions());
    setEvaluationOptions(readPublishedEvaluationOptions());
    setSelectedCourseId(course.id);
    setForm(buildCourseForm(course));
    loadStandardForm(course);
    setIsEditing(true);
    setIsNewOpen(false);
    setOpenDetailCourseId(course.id);
  };

  const handleEdit = () => {
    if (!selectedCourse) return;

    openCourseEditor(selectedCourse);
  };

  const handleDelete = () => {
    if (!selectedCourse) return;

    saveCourses(courses.filter((course) => course.id !== selectedCourse.id));
    saveStandards(
      standards.filter(
        (standard) =>
          standard.courseId !== selectedCourse.id &&
          standard.courseCode !== selectedCourse.courseCode,
      ),
    );
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setIsEditing(false);
    setIsNewOpen(false);
    setForm(emptyCourseForm);
    resetStandardForm();
  };

  const handleRefresh = () => {
    setCourses(readWorkflowCollection<CourseRecord>(TRAINING_WORKFLOW_KEYS.courses));
    setStandards(readWorkflowCollection<CourseStandardRecord>(TRAINING_WORKFLOW_KEYS.standards));
    setFunctionRows(readMasterCollection(TRAINING_MASTER_KEYS.functions, defaultFunctionRows));
    setPositionRows(readMasterCollection(TRAINING_MASTER_KEYS.positions, defaultPositionRows));
    setLevelRows(readMasterCollection(TRAINING_MASTER_KEYS.levels, defaultLevelRows));
    setAssessmentOptions(readPublishedAssessmentOptions());
    setEvaluationOptions(readPublishedEvaluationOptions());
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setSearch("");
    setIsEditing(false);
    setIsNewOpen(false);
    setForm(emptyCourseForm);
    resetStandardForm();
  };

  const handleShowDetails = (course: CourseRecord) => {
    const isSameOpen = openDetailCourseId === course.id && !isEditing;
    setSelectedCourseId(isSameOpen ? "" : course.id);
    setOpenDetailCourseId(isSameOpen ? "" : course.id);
    setIsNewOpen(false);
    setIsEditing(false);
    setForm(buildCourseForm(course));
    loadStandardForm(course);
  };

  const handleClosePanel = () => {
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setIsNewOpen(false);
    setIsEditing(false);
    setForm(emptyCourseForm);
    resetStandardForm();
  };

  const handleSave = () => {
    if (!isCourseFormReady || !standardFunctionName.trim()) return;

    const resolvedCourseCode =
      form.courseCode.trim() ||
      buildCourseCode(form.courseGroup, "", selectedCourseId);

    if (!isFactoryUser) {
      const factoryPrefixes = ["ATA-", "TEP-", "ATFB-", "NIC-", "SATI-", "SNF-"];
      const upperCode = resolvedCourseCode.toUpperCase();
      if (factoryPrefixes.some((p) => upperCode.startsWith(p))) {
        alert("Center สามารถสร้าง Course ได้เฉพาะ Code ของ Center เท่านั้น (ห้ามใช้รหัสประจำโรงงาน เช่น ATA-, TEP-...)");
        return;
      }
    }
    const nextCourse: CourseRecord = {
      ...form,
      id: selectedCourseId || `course-${resolvedCourseCode.toLowerCase()}`,
      courseCode: resolvedCourseCode,
      courseNameTh: form.courseNameTh.trim(),
      courseNameEn: form.courseNameEn.trim(),
      lifeCycleMonth: form.lifeCycleMonth.trim() || "0",
      status: "Active",
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: selectedCourse?.owner ?? owner,
      ownerCompany: selectedCourse?.ownerCompany ?? ownerCompany,
      createdBy:
        selectedCourse?.createdBy ??
        profileValue(user?.displayName ?? user?.username),
    };
    const nextCourses = selectedCourseId
      ? courses.map((course) => course.id === selectedCourseId ? nextCourse : course)
      : [nextCourse, ...courses];

    const resolvedStandardFunctionName =
      standardFunctionCode === allFunctionCode
        ? allFunctionOption
        : functionOptions.find((option) => option.code === standardFunctionCode)
            ?.name ?? standardFunctionName.trim();

    const nextStandard: CourseStandardRecord = {
      id:
        selectedStandard?.id ||
        `standard-${nextCourse.id}-${standardFunctionCode.toLowerCase()}`,
      courseId: nextCourse.id,
      courseCode: nextCourse.courseCode,
      courseName: getCourseDisplayName(nextCourse),
      companies:
        standardCompanies.length === 0 || standardCompanies.length === companyCodes.length
          ? []
          : standardCompanies,
      functionCode: standardFunctionCode === allFunctionCode ? "" : standardFunctionCode,
      functionName: resolvedStandardFunctionName,
      section: standardSection === "all" ? "" : standardSection,
      department: standardDepartment === "all" ? "" : standardDepartment,
      division: standardDivision === "all" ? "" : standardDivision,
      positions: selectedPositions,
      levels: selectedLevels,
      owner: nextCourse.owner,
      ownerCompany: nextCourse.ownerCompany ?? "HRD Center",
    };
    const nextStandards = [
      nextStandard,
      ...standards.filter(
        (standard) =>
          standard.id !== nextStandard.id &&
          standard.courseId !== nextCourse.id &&
          standard.courseCode !== nextCourse.courseCode,
      ),
    ];

    saveCourses(nextCourses);
    saveStandards(nextStandards);
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setForm(emptyCourseForm);
    resetStandardForm();
    setIsEditing(false);
    setIsNewOpen(false);
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

      {isEditing ? (
        <aside className={styles.formGuide} aria-label="Course setup guideline">
          <div className={styles.guideHeader}>
            <div>
              <strong>Course setup guideline</strong>
              <p>Complete the required fields from top to bottom before linking tests and evaluations.</p>
            </div>
            <span>
              {completedRequiredFields} / {requiredFieldCount} required fields
            </span>
          </div>
          <div
            className={styles.guideProgress}
            aria-label="Required field completion"
            aria-valuemax={requiredFieldCount}
            aria-valuemin={0}
            aria-valuenow={completedRequiredFields}
            role="progressbar"
          >
            <span
              style={{
                width: `${(completedRequiredFields / requiredFieldCount) * 100}%`,
              }}
            />
          </div>
          <ol className={styles.guideSteps}>
            <li><b>1</b><span>Select the course group to generate the course code.</span></li>
            <li><b>2</b><span>Enter bilingual names and describe the learning outcome.</span></li>
            <li><b>3</b><span>Link published tests and evaluations when available.</span></li>
          </ol>
          <small><b>*</b> Required field</small>
        </aside>
      ) : null}

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
            placeholder="Generated after selecting a course group"
            title="Generated automatically from the selected Course Group ID"
          />
          <small className={styles.fieldHint}>Generated automatically from the selected course group.</small>
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
            placeholder="Example: Basic Safety Course"
            onChange={(event) => updateForm("courseNameTh", event.target.value)}

          />
        </label>
        <label>
          <span className={styles.fieldLabel}>Course Name (EN) <b>*</b></span>
          <input
            value={form.courseNameEn}
            disabled={!isEditing}
            placeholder="Example: Safety Basics"
            onChange={(event) => updateForm("courseNameEn", event.target.value)}
          />
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
          <span className={styles.fieldLabel}>Pre Test <em>Optional</em></span>
          <select
            value={form.preTestId}
            disabled={!isEditing}
            onChange={(event) =>
              handleAssessmentSelection(
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
                [{assessment.code}] {assessment.name}
              </option>
            ))}
          </select>
          <input
            value={form.preTestLink}
            disabled={!isEditing}
            placeholder="Paste pre-test form link"
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
          <small className={styles.catalogHint}>
            {selectedPreTest
              ? `${selectedPreTest.questionCount} questions · Linked course: ${selectedPreTest.courseName}`
              : form.preTestLink
                ? "Manual form link will be used."
                : `${publishedPreTests.length} published Pre Test option${publishedPreTests.length === 1 ? "" : "s"}`}
          </small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Post Test <em>Optional</em></span>
          <select
            value={form.postTestId}
            disabled={!isEditing}
            onChange={(event) =>
              handleAssessmentSelection(
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
                [{assessment.code}] {assessment.name}
              </option>
            ))}
          </select>
          <input
            value={form.postTestLink}
            disabled={!isEditing}
            placeholder="Paste post-test form link"
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
          <small className={styles.catalogHint}>
            {selectedPostTest
              ? `${selectedPostTest.questionCount} questions · Linked course: ${selectedPostTest.courseName}`
              : form.postTestLink
                ? "Manual form link will be used."
                : `${publishedPostTests.length} published Post Test option${publishedPostTests.length === 1 ? "" : "s"}`}
          </small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Evaluation After Training <em>Optional</em></span>
          <select
            value={form.evaluationId}
            disabled={!isEditing}
            onChange={(event) =>
              handleEvaluationSelection(
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
          </select>
          <input
            value={form.evaluationLink}
            disabled={!isEditing}
            placeholder="Paste evaluation form link"
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
          <small className={styles.catalogHint}>
            {selectedEvaluation
              ? `${selectedEvaluation.questionCount} questions · ${selectedEvaluation.respondent} · ${selectedEvaluation.scope}`
              : form.evaluationLink
                ? "Manual form link will be used."
                : `${publishedCourseEvaluations.length} published After Training option${publishedCourseEvaluations.length === 1 ? "" : "s"}`}
          </small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Evaluation After 30 Days <em>Optional</em></span>
          <select
            value={form.evaluationAfter30DayId}
            disabled={!isEditing}

            onChange={(event) =>
              handleEvaluationSelection(
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
          </select>
          <input
            value={form.evaluationAfter30DayLink}
            disabled={!isEditing}
            placeholder="Paste 30-day evaluation form link"
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
          <small className={styles.catalogHint}>
            {selectedFollowUpEvaluation
              ? `${selectedFollowUpEvaluation.questionCount} questions · ${selectedFollowUpEvaluation.respondent} · ${selectedFollowUpEvaluation.scope}`
              : form.evaluationAfter30DayLink
                ? "Manual form link will be used."
                : `${publishedFollowUpEvaluations.length} published 30-Day Follow-up option${publishedFollowUpEvaluations.length === 1 ? "" : "s"}`}
          </small>
        </label>
        <label className={styles.fullWidth}>
          <span className={styles.fieldLabel}>Remark <em>Optional</em></span>
          <textarea
            value={form.remark}
            disabled={!isEditing}
            placeholder="Add supporting notes or special conditions."
            onChange={(event) => updateForm("remark", event.target.value)}
          />
        </label>


      </div>

      <section className={styles.standard_formPanel} aria-label="Course Standard setup">
        <div className={styles.standard_panelHeader}>
          <div>
            <p className={styles.standard_kicker}>Course Standard</p>
            <h3>Company, Function, Position and Level</h3>
            <p>Define the training target before saving the course.</p>
          </div>
        </div>

        <div className={styles.standard_companySection}>
          <div className={styles.companyHeaderRow}>
            <span className={styles.fieldLabel}>Target Company</span>
            <span className={styles.companySummaryBadge}>
              {standardCompanies.length === 0
                ? "Please select at least 1 company"
                : isAllCompaniesSelected
                  ? `All Companies (${companyCodes.length} companies - ${distinctFunctions.length} functions)`
                  : `Selected ${standardCompanies.length} of ${companyCodes.length} companies (${distinctFunctions.length} functions)`}
            </span>
          </div>
          <div className={styles.standard_companyCheckGrid}>
            <label
              className={`${styles.standard_checkItem} ${
                isAllCompaniesSelected ? styles.standard_checkItemSelected : ""
              }`}
            >
              <input
                className={styles.standard_nativeCheckbox}
                checked={isAllCompaniesSelected}
                disabled={!isEditing}
                type="checkbox"
                onChange={toggleAllStandardCompanies}
              />
              <span className={styles.standard_checkMark} aria-hidden="true">
                {isAllCompaniesSelected ? "✓" : ""}
              </span>
              <span>All Companies</span>
            </label>
            {companyCodes.map((comp) => {
              const isChecked = standardCompanies.includes(comp);
              return (
                <label
                  key={comp}
                  className={`${styles.standard_checkItem} ${
                    isChecked ? styles.standard_checkItemSelected : ""
                  }`}
                >
                  <input
                    className={styles.standard_nativeCheckbox}
                    checked={isChecked}
                    disabled={!isEditing}
                    type="checkbox"
                    onChange={() => toggleStandardCompany(comp)}
                  />
                  <span className={styles.standard_checkMark} aria-hidden="true">
                    {isChecked ? "✓" : ""}
                  </span>
                  <span>{comp}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className={styles.standard_formGrid}>
          <SearchableSelect
            label="Function Name"
            placeholder="Type to search function e.g. PM, Production..."
            value={standardFunctionCode}
            disabled={!isEditing}
            options={functionSelectOptions}
            allOptionLabel={allFunctionDisplayName}
            onChange={(nextCode) => {
              setStandardFunctionCode(nextCode);
              const matched = distinctFunctions.find((f) => f.code === nextCode);
              const nextName =
                nextCode === allFunctionCode
                  ? allFunctionOption
                  : matched?.displayName ?? allFunctionOption;
              setStandardFunctionName(nextName);
              // Reset sub-levels to all when switching function
              setStandardSection("all");
              setStandardDepartment("all");
              setStandardDivision("all");
            }}
          />

          <SearchableSelect
            label="Section"
            placeholder="Type to search section e.g. Maintenance, Accounting, Assembly..."
            value={standardSection}
            disabled={!isEditing}
            options={sectionSelectOptions}
            allOptionLabel="All Sections"
            onChange={(nextSec) => setStandardSection(nextSec)}
          />

          <SearchableSelect
            label="Department"
            placeholder="Type to search department e.g. Quality, Procurement..."
            value={standardDepartment}
            disabled={!isEditing}
            options={departmentSelectOptions}
            allOptionLabel="All Departments"
            onChange={(nextDept) => setStandardDepartment(nextDept)}
          />

          <SearchableSelect
            label="Division"
            placeholder="Type to search division e.g. Executive, Production..."
            value={standardDivision}
            disabled={!isEditing}
            options={divisionSelectOptions}
            allOptionLabel="All Divisions"
            onChange={(nextDiv) => setStandardDivision(nextDiv)}
          />
        </div>

        <div className={styles.standard_checkSection}>
          <div>
            <h4>Check List Position</h4>
            <div className={styles.standard_checkGrid}>
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
                  <span>{position}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4>Check List Level</h4>
            <div className={styles.standard_levelGrid}>
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
                  <span>{level}</span>
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
            disabled={!isCourseFormReady}
            type="button"
            onClick={handleSave}
          >
            Save Course & Standard
          </button>
          <button className={styles.secondaryButton} type="button" onClick={handleClosePanel}>
            Cancel
          </button>
        </div>
      ) : null}
      </section>
    );
  };

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
          New
        </button>
        <button className={styles.secondaryButton} type="button" onClick={handleEdit} disabled={!selectedCourse}>
          Edit
        </button>
        <button className={styles.dangerButton} type="button" onClick={handleDelete} disabled={!selectedCourse}>
          Delete
        </button>
        <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
          Refresh
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => setIsImportModalOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          📥 Import Excel
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={handleDownloadExcelTemplate}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          📄 Download Template
        </button>
      </section>

      {isNewOpen ? (
        <div className={styles.topDropPanel}>
          {renderCoursePanel("New course", "New")}
        </div>
      ) : null}

      <section className={styles.listPanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Course list</p>
            <h3>Course Master Records</h3>
          </div>
          <span>{filteredCourses.length} records</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.courseTable}>
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Classification</th>
                <th>Course Standard</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((course) => {
                const isOpen = openDetailCourseId === course.id && !isNewOpen;
                const courseStandard = standards.find(
                  (standard) =>
                    standard.courseId === course.id ||
                    standard.courseCode === course.courseCode,
                );
                return (
                  <Fragment key={course.id}>
                    <tr className={course.id === selectedCourseId ? styles.selectedRow : undefined}>
                      <td>{course.courseCode}</td>
                      <td>
                        <strong>{getCourseDisplayName(course)}</strong>
                        {getCourseSecondaryName(course) ? (
                          <span>{getCourseSecondaryName(course)}</span>
                        ) : null}
                      </td>
                      <td>
                        <strong translate="no">{course.courseType}</strong>
                        <span className={styles.classificationWrap}>
                          {course.courseGroup}
                          {course.ownerCompany ? (
                            <span
                              className={`${styles.ownerBadge} ${
                                course.owner === "CENTER" || course.ownerCompany === "HRD Center"
                                  ? styles.centerOwnerBadge
                                  : styles.factoryOwnerBadge
                              }`}
                            >
                              {course.ownerCompany === "HRD Center" ? "🏢 Center" : `🏭 ${course.ownerCompany}`}
                            </span>
                          ) : null}
                        </span>
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
                            ? [
                                courseStandard.companies?.length &&
                                courseStandard.companies.length < companyCodes.length
                                  ? `Company: ${courseStandard.companies.join(", ")}`
                                  : "",
                                courseStandard.section && courseStandard.section !== "all"
                                  ? `Section: ${courseStandard.section}`
                                  : "",
                                courseStandard.department && courseStandard.department !== "all"
                                  ? `Department: ${courseStandard.department}`
                                  : "",
                                courseStandard.division && courseStandard.division !== "all"
                                  ? `Division: ${courseStandard.division}`
                                  : "",
                                `${courseStandard.positions.length} positions · ${courseStandard.levels.length} levels`,
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : "No standard"}
                        </span>
                      </td>
                      <td className={styles.actionCell}>
                        <button
                          className={styles.detailButton}
                          type="button"
                          onClick={() => handleShowDetails(course)}
                        >
                          {isOpen && !isEditing ? "Hide" : "Details"}
                        </button>
                        <button
                          className={styles.detailButton}
                          type="button"
                          onClick={() => openCourseEditor(course)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detailRow}>
                        <td colSpan={5}>
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
      </section>

      {isImportModalOpen ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              width: "100%",
              maxWidth: "900px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a", fontWeight: 800 }}>
                  📥 Import Course Master via Excel (.xlsx / .csv)
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
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
