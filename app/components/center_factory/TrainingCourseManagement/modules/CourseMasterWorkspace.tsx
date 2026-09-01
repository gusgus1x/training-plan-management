
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
import {
  collectTransitivePrerequisites,
  courseIdsThatWouldCycle,
  type PrerequisiteGraph,
} from "../../../../lib/courses/prerequisiteGraph";
import { listOapPlans } from "../../../../lib/trainingOap/client";
import type { OapPlanRecord } from "../../../../lib/trainingOap/types";
import { loadWorkflowRollingPlans, type RollingPlan } from "../../TrainingPlanManagement/modules/TrainingRolling";
import { getLevelRank, normalizeEmployeeLevel } from "../../../../lib/employeeMasterData";
import { listAssessments } from "../../../../lib/assessments/client";
import { listEvaluations } from "../../../../lib/evaluations/client";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
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
import { UNDER_DEVELOPMENT } from "../../../../lib/underDevelopment";
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

const RequiredIndicator = ({ isFilled }: { isFilled: boolean }) => (
  <span
    className={isFilled ? styles.indicatorDone : styles.indicatorPending}
    title={isFilled ? "กรอกข้อมูลเรียบร้อยแล้ว / Completed" : "จำเป็นต้องกรอก / Required field"}
  >
    <span className={styles.indicatorDot} />
  </span>
);

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

interface PrerequisiteCourseSelectProps {
  selectedIds: string[];
  options: Array<{ id: string; code: string; name: string }>;
  disabled?: boolean;
  placeholder: string;
  /** Courses that cannot be picked because they already sit downstream of this one. */
  blockedIds: Set<string>;
  blockedReason: (code: string) => string;
  onToggle: (id: string) => void;
}

// Same search+dropdown interaction as SearchableSelect above, but multi-select: clicking an item
// toggles it in/out of `selectedIds` instead of closing the menu, and the chosen courses render as
// removable chips under the trigger.
const PrerequisiteCourseSelect = ({
  selectedIds,
  options,
  disabled = false,
  placeholder,
  blockedIds,
  blockedReason,
  onToggle,
}: PrerequisiteCourseSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOptions = options.filter((opt) => selectedIds.includes(opt.id));

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
    return options.filter((opt) => {
      const code = opt.code.toLowerCase();
      const name = opt.name.toLowerCase();
      return (
        code.includes(q) || name.includes(q) ||
        (translatedQ !== q && (code.includes(translatedQ) || name.includes(translatedQ)))
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
            placeholder={placeholder}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.searchableSelectValue} translate="no">
            {selectedOptions.length > 0
              ? `${selectedOptions.length} หลักสูตร (${selectedOptions.map((o) => o.code).join(", ")})`
              : placeholder}
          </span>
        )}
        <span className={styles.searchableSelectArrow}>▼</span>
      </div>

      {isOpen && !disabled && (
        <ul className={styles.searchableSelectMenu}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isBlocked = blockedIds.has(opt.id);
              return (
                <li
                  key={opt.id}
                  className={`${styles.searchableSelectItem} ${selectedIds.includes(opt.id) ? styles.selected : ""}`}
                  title={isBlocked ? blockedReason(opt.code) : undefined}
                  style={isBlocked ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                  onClick={() => !isBlocked && onToggle(opt.id)}
                >
                  <div className={styles.itemMain} translate="no">
                    {selectedIds.includes(opt.id) ? "✓ " : ""}
                    {opt.code} — {opt.name}
                  </div>
                  {isBlocked ? (
                    <div className={styles.itemSub}>{blockedReason(opt.code)}</div>
                  ) : null}
                </li>
              );
            })
          ) : (
            <li className={styles.searchableSelectEmpty}>ไม่พบหลักสูตร / No matches found</li>
          )}
        </ul>
      )}

      {selectedOptions.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
          {selectedOptions.map((opt) => (
            <span
              key={opt.id}
              translate="no"
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "4px 10px", borderRadius: "999px",
                background: "var(--ui-30-primary-soft, rgba(0,122,61,0.12))",
                color: "var(--ui-30-primary, #007a3d)",
                fontSize: "0.78rem", fontWeight: 600,
              }}
            >
              {opt.code} — {opt.name}
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => onToggle(opt.id)}
                  aria-label={`Remove ${opt.code}`}
                  style={{ border: 0, background: "transparent", cursor: "pointer", color: "inherit", fontWeight: 900, padding: 0, lineHeight: 1 }}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

function CourseMaster() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();
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
  /**
   * A master list that failed to load renders exactly like one that is legitimately empty. On most
   * of these pickers that is merely confusing; on target companies it is dangerous. Saving a course
   * standard with an empty target list writes zero rows, and computeTargetMatch in the enrollment
   * repository reads "no target companies" as matching every employee in the group — so a failed
   * request silently widens a course's audience to the whole company group.
   *
   * Record which lists failed so the save can refuse rather than guess.
   */
  const [failedMasterLists, setFailedMasterLists] = useState<string[]>([]);
  const noteMasterListFailed = (label: string, clear: () => void) => {
    clear();
    setFailedMasterLists((current) =>
      current.includes(label) ? current : [...current, label],
    );
  };
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedTemplateCourseId, setSelectedTemplateCourseId] = useState("");
  const [form, setForm] = useState<CourseForm>(emptyCourseForm);

  const centerCoursesForTemplate = useMemo(
    () =>
      courses.filter(
        (course) =>
          course.owner === "CENTER" ||
          course.ownerCompany === "CENTER" ||
          course.ownerCompany === "HRD Center" ||
          !course.ownerCompany,
      ),
    [courses],
  );

  const centerCourseTemplateOptions = useMemo(
    () => [
      { code: "", name: language === "th" ? "-- ไม่ใช้เทมเพลต (สร้างใหม่จากหน้าว่าง) --" : "-- None (Start from scratch) --" },
      ...centerCoursesForTemplate.map((c) => ({
        code: c.id,
        name: `[${c.courseCode}] ${getCourseDisplayName(c)}`,
        nameTh: c.courseNameTh,
        nameEn: c.courseNameEn || c.courseNameTh,
      })),
    ],
    [centerCoursesForTemplate, language],
  );

  const handleApplyCenterTemplate = (courseId: string) => {
    setSelectedTemplateCourseId(courseId);

    if (!courseId) {
      setForm(emptyCourseForm);
      setLinkModeFields(new Set());
      resetStandardForm();
      return;
    }

    const templateCourse = centerCoursesForTemplate.find((c) => c.id === courseId);
    if (!templateCourse) return;

    const courseGroup = templateCourse.courseGroup;
    let nextCode = "";
    const matchedGroup = courseGroupOptions.find((g) => g.name === courseGroup);
    if (matchedGroup && matchedGroup.code) {
      if (isFactoryUser) {
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

    let resolvedCourseType = templateCourse.courseType;
    if (isFactoryUser && !factoryCourseTypeAllowlist.includes(resolvedCourseType)) {
      resolvedCourseType = courseTypes[0] || "IN-HOUSE";
    }

    setForm({
      ...emptyCourseForm,
      courseCode: nextCode,
      courseGroup: templateCourse.courseGroup,
      courseType: resolvedCourseType,
      courseNameTh: templateCourse.courseNameTh,
      courseNameEn: templateCourse.courseNameEn || templateCourse.courseNameTh,
      objective: templateCourse.objective || "",
      learningContent: templateCourse.learningContent || "",
      targetGroup: templateCourse.targetGroup || "",
      methodology: templateCourse.methodology || "",
      lifeCycleMonth: templateCourse.lifeCycleMonth || "0",
      remark: templateCourse.remark || "",
      status: "Active",

      // Reset tests & evaluations per requirement
      preTestId: "",
      preTest: "",
      preTestLink: "",
      postTestId: "",
      postTest: "",
      postTestLink: "",
      evaluationId: "",
      evaluation: "",
      evaluationLink: "",
      evaluationAfter30DayId: "",
      evaluationAfter30Day: "",
      evaluationAfter30DayLink: "",
    });

    setLinkModeFields(new Set());
    resetStandardForm();

    toast.success(
      language === "th"
        ? `คัดลอกรายละเอียดจากหลักสูตรส่วนกลาง "${templateCourse.courseCode}" แล้ว (สามารถแก้ไขรายละเอียดเพิ่มเติมได้ก่อนบันทึก)`
        : `Copied details from Center course template "${templateCourse.courseCode}". You can edit details before saving.`,
    );
  };
  const [linkModeFields, setLinkModeFields] = useState<Set<LinkModeField>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [openDetailCourseId, setOpenDetailCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [listCompanyFilter, setListCompanyFilter] = useState("");
  const [listCourseGroupFilter, setListCourseGroupFilter] = useState("");
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
    const link = document.createElement("a");
    link.href = "/api/course-master/download-template";
    link.setAttribute("download", "Course_Master_Template.xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportNotice(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/course-master/parse-template", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.rows)) {
          setImportRows(data.rows);
          return;
        }
      }

      // Fallback to client-side CSV parser
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = String(evt.target?.result || "");
          const mapped = parseCsvText(text);
          setImportRows(mapped);
        } catch (err) {
          console.error("CSV fallback parse error:", err);
          setImportNotice("❌ ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์ CSV / Excel");
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error("Excel/CSV parse error:", err);
      setImportNotice("❌ ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์ CSV / Excel");
    }
  };

  // NOT REAL. This only pushes rows into React state and then toasts that the import succeeded, so
  const [isImporting, setIsImporting] = useState(false);

  const handleCommitExcelImport = async () => {
    if (importRows.length === 0 || isImporting) return;
    setIsImporting(true);

    let importedCount = 0;
    let failedCount = 0;
    const standardYear = new Date().getFullYear();

    const isFactory = user?.roleCode === "HRD_FACTORY";
    const defaultTypeName = isFactory ? "IN-HOUSE" : "ATA-TC";
    const defaultType =
      courseTypeOptions.find(
        (t) =>
          t.name.toUpperCase().includes(defaultTypeName) ||
          t.typeId.toUpperCase().includes(defaultTypeName),
      ) ||
      (isFactory
        ? courseTypeOptions.find((t) => !t.name.includes("ATA-TC"))
        : courseTypeOptions.find((t) => t.name.includes("ATA-TC"))) ||
      courseTypeOptions[0];
    const defaultCourseTypeId = defaultType?.typeId || "";

    for (const item of importRows) {
      const rawName = (item.courseNameTh || "").trim();
      if (!rawName || rawName === "-" || rawName === "(Auto)" || rawName.toLowerCase().includes("course name")) continue;

      const courseNameTh = rawName;
      const courseNameEn = (item.courseNameEn && item.courseNameEn !== "-" ? item.courseNameEn : courseNameTh).trim();

      const matchedGroup =
        courseGroupOptions.find(
          (g) =>
            g.name.toLowerCase() === (item.courseGroup || "").toLowerCase() ||
            g.code.toLowerCase() === (item.courseGroup || "").toLowerCase(),
        ) || courseGroupOptions[0];
      const courseGroupId = matchedGroup?.groupId || "";

      const resolvedCourseTypeName = item.courseType
        ? item.courseType
        : isFactory
          ? "IN-HOUSE"
          : "ATA-TC";

      const matchedType =
        courseTypeOptions.find(
          (t) =>
            t.name.toLowerCase() === resolvedCourseTypeName.toLowerCase() ||
            t.typeId.toLowerCase() === resolvedCourseTypeName.toLowerCase(),
        ) || defaultType;
      const courseTypeId = matchedType?.typeId || defaultCourseTypeId;

      const targetLevels = item.levels
        ? item.levels
            .split(",")
            .map((l: string) => normalizeEmployeeLevel(l.trim()))
            .filter(Boolean)
        : [];

      const resolvedCompanies =
        selectedCompanies.length > 0
          ? selectedCompanies
          : companyRows.length > 0
            ? companyRows.map((c) => c.code)
            : ["ATA", "TEP", "ATFB", "NIC", "SATI", "SNF"];

      const input = {
        courseNameTh,
        courseNameEn,
        remark: null,
        objective: item.objective || "-",
        learningContent: item.learningContent || "-",
        targetGroup: item.targetGroup || "-",
        methodology: item.methodology || "Lecture / Workshop",
        durationHours: 1,
        validityMonths: item.lifeCycleMonth && Number(item.lifeCycleMonth) > 0 ? Number(item.lifeCycleMonth) : null,
        preAssessmentId: null,
        postAssessmentId: null,
        evaluationFormId: null,
        evaluationFormAfter30DayId: null,
        preTestLink: null,
        postTestLink: null,
        evaluationLink: null,
        evaluationAfter30DayLink: null,
        status: "Active" as const,
        courseTypeId,
        courseGroupId,
        standardCode: `STD-${standardYear}-G${courseGroupId}`,
        standardName: courseNameTh,
        functionId: null,
        divisionId: null,
        departmentId: null,
        sectionId: null,
        targetOrgScopes: [],
        targetCompanies: resolvedCompanies,
        targetPositions: [],
        targetLevels,
        standardYear,
        prerequisiteCourseIds: [],
      };

      try {
        await createCourse(input);
        importedCount += 1;
      } catch (err) {
        console.error(`Failed to import course: ${courseNameTh}`, err);
        failedCount += 1;
      }
    }

    await handleRefresh();
    setIsImporting(false);
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName("");

    if (importedCount > 0) {
      toast.success(
        `นำเข้าและบันทึกข้อมูล Course Master สำเร็จ ${importedCount} รายการ / Imported ${importedCount} course(s)` +
          (failedCount > 0 ? ` (ข้าม ${failedCount} รายการที่ซ้ำหรือไม่ถูกต้อง)` : ""),
      );
    } else if (failedCount > 0) {
      toast.error(
        `ไม่สามารถนำเข้าข้อมูลได้ กรุณาตรวจสอบชื่อหลักสูตรซ้ำหรือข้อมูลในไฟล์ / Failed to import courses`,
      );
    }
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
  const [targetOrgScopes, setTargetOrgScopes] = useState<
    Array<{ id: string; functionCode: string; divisionCode: string; departmentCode: string; sectionCode: string }>
  >([{ id: "1", functionCode: "", divisionCode: "", departmentCode: "", sectionCode: "" }]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  // Courses this one requires completed first (continuation courses). Not stored on CourseForm:
  // an empty list simply means no condition, the same as it means for
  // selectedCompanies/Positions/Levels.
  const [selectedPrerequisiteCourseIds, setSelectedPrerequisiteCourseIds] = useState<string[]>([]);
  // Courses the screen added on the editor's behalf, and which pick triggered each one. The gate
  // only checks a course's own direct list, so picking B without A leaves a hole; filling it
  // silently would be worse than the hole, hence keeping the reason to show alongside.
  const [autoAddedPrerequisites, setAutoAddedPrerequisites] = useState<
    Array<{ id: string; because: string }>
  >([]);
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

  const userCompanyCode = profileValue(user?.companyCode);

  const activeCompanyCodes = useMemo(() => {
    if (isFactoryUser && userCompanyCode) {
      return [userCompanyCode];
    }
    return selectedCompanies;
  }, [isFactoryUser, userCompanyCode, selectedCompanies]);

  const activeCompanyIds = useMemo(
    () => companyRows.filter((row) => activeCompanyCodes.includes(row.code)).map((row) => row.id),
    [companyRows, activeCompanyCodes],
  );

  const usageInActiveCompanies = (usage: OrgHierarchyUsageRow) =>
    activeCompanyCodes.length === 0 ||
    (usage.companyId !== null && activeCompanyIds.includes(usage.companyId));

  const functionOptions = useMemo(() => {
    let filtered = functionRows;

    if (activeCompanyCodes.length > 0) {
      const allowedFunctionIds = new Set(
        orgUsage
          .filter((usage) => usageInActiveCompanies(usage))
          .map((u) => u.functionId)
          .filter(Boolean),
      );
      filtered = filtered.filter(
        (row) => allowedFunctionIds.has(row.id) || row.code === standardFunctionCode,
      );
    }

    return [
      { id: "", code: "", name: "Select Function Name" },
      { id: "ALL", code: allFunctionCode, name: "All Function" },
      ...filtered,
    ];
  }, [functionRows, orgUsage, activeCompanyCodes, activeCompanyIds, standardFunctionCode]);

  const divisionOptions = useMemo(() => {
    let filtered = divisionRows;

    if (activeCompanyCodes.length > 0) {
      const allowedDivisionIds = new Set(
        orgUsage
          .filter((usage) => usageInActiveCompanies(usage))
          .map((u) => u.divisionId)
          .filter(Boolean),
      );
      filtered = filtered.filter(
        (row) => allowedDivisionIds.has(row.id) || row.code === standardDivisionCode,
      );
    }

    return [
      { id: "", code: "", name: "Select Division" },
      { id: "ALL", code: allFunctionCode, name: "All Division" },
      ...filtered,
    ];
  }, [divisionRows, orgUsage, activeCompanyCodes, activeCompanyIds, standardDivisionCode]);

  const departmentOptions = useMemo(() => {
    let filtered = departmentRows;

    if (activeCompanyCodes.length > 0) {
      const allowedDepartmentIds = new Set(
        orgUsage
          .filter((usage) => usageInActiveCompanies(usage))
          .map((u) => u.departmentId)
          .filter(Boolean),
      );
      filtered = filtered.filter(
        (row) => allowedDepartmentIds.has(row.id) || row.code === standardDepartmentCode,
      );
    }

    return [
      { id: "", code: "", name: "Select Department" },
      { id: "ALL", code: allFunctionCode, name: "All Department" },
      ...filtered,
    ];
  }, [departmentRows, orgUsage, activeCompanyCodes, activeCompanyIds, standardDepartmentCode]);

  const sectionOptions = useMemo(() => {
    let filtered = sectionRows;

    if (activeCompanyCodes.length > 0) {
      const allowedSectionIds = new Set(
        orgUsage
          .filter((usage) => usageInActiveCompanies(usage))
          .map((u) => u.sectionId)
          .filter(Boolean),
      );
      filtered = filtered.filter(
        (row) => allowedSectionIds.has(row.id) || row.code === standardSectionCode,
      );
    }

    return [
      { id: "", code: "", name: "Select Section" },
      { id: "ALL", code: allFunctionCode, name: "All Section" },
      ...filtered,
    ];
  }, [sectionRows, orgUsage, activeCompanyCodes, activeCompanyIds, standardSectionCode]);
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
          const isCenter =
            course.owner === "CENTER" ||
            course.ownerCompany === "CENTER" ||
            course.ownerCompany === "HRD Center" ||
            !course.ownerCompany;
          return course.ownerCompany === userCompanyCode || isCenter;
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
          if (companyCode !== listCompanyFilter) return false;
        }
        // Course Group filter
        if (listCourseGroupFilter) {
          if (course.courseGroup !== listCourseGroupFilter) return false;
        }
        return true;
      });
  }, [scopedCourses, search, listCompanyFilter, listCourseGroupFilter, isFactoryUser]);


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
    setTargetOrgScopes([{ id: "1", functionCode: "", divisionCode: "", departmentCode: "", sectionCode: "" }]);
    setSelectedCompanies(isFactoryUser && userCompanyCode ? [userCompanyCode] : []);
    setSelectedPositions([]);
    setSelectedLevels([]);
    setSelectedPrerequisiteCourseIds([]);
    setAutoAddedPrerequisites([]);
  };

  const loadStandardForm = (course: CourseRecord) => {
    const standard = standards.find(
      (item) => item.courseId === course.id || item.courseCode === course.courseCode,
    );

    if (!standard) {
      resetStandardForm();
      return;
    }

    const rawScopes = (standard.targetOrgScopes && standard.targetOrgScopes.length > 0)
      ? standard.targetOrgScopes
      : [{
          functionId: standard.functionId,
          divisionId: standard.divisionId,
          departmentId: standard.departmentId,
          sectionId: standard.sectionId,
          functionCode: standard.functionCode,
          functionName: standard.functionName,
          divisionCode: standard.divisionCode,
          division: standard.division,
          departmentCode: standard.departmentCode,
          department: standard.department,
          sectionCode: standard.sectionCode,
          section: standard.section,
        }];

    const loadedScopes = rawScopes.map((scope, index) => {
      const isAllFunction = !scope.functionId && (!scope.functionCode || scope.functionCode === allFunctionCode || scope.functionName === "All Function" || scope.functionName === allFunctionOption);
      const matchingFunctionOption = isAllFunction
        ? { code: allFunctionCode, name: "All Function" }
        : functionRows.find(
            (row) =>
              (scope.functionId && row.id === scope.functionId) ||
              row.code === scope.functionCode ||
              row.name === scope.functionName ||
              row.nameTh === scope.functionName ||
              row.nameEn === scope.functionName,
          );

      const isAllDivision = !scope.divisionId && (!scope.divisionCode || scope.divisionCode === allFunctionCode || !scope.division || scope.division === "All Division");
      const matchingDivisionRow = isAllDivision
        ? { code: allFunctionCode, name: "All Division" }
        : divisionRows.find(
            (row) =>
              (scope.divisionId && row.id === scope.divisionId) ||
              (scope.divisionCode && row.code === scope.divisionCode) ||
              row.code === scope.division ||
              row.name === scope.division ||
              row.nameTh === scope.division ||
              row.nameEn === scope.division,
          );

      const isAllDepartment = !scope.departmentId && (!scope.departmentCode || scope.departmentCode === allFunctionCode || !scope.department || scope.department === "All Department");
      const matchingDepartmentRow = isAllDepartment
        ? { code: allFunctionCode, name: "All Department" }
        : departmentRows.find(
            (row) =>
              (scope.departmentId && row.id === scope.departmentId) ||
              (scope.departmentCode && row.code === scope.departmentCode) ||
              row.code === scope.department ||
              row.name === scope.department ||
              row.nameTh === scope.department ||
              row.nameEn === scope.department,
          );

      const isAllSection = !scope.sectionId && (!scope.sectionCode || scope.sectionCode === allFunctionCode || !scope.section || scope.section === "All Section");
      const matchingSectionRow = isAllSection
        ? { code: allFunctionCode, name: "All Section" }
        : sectionRows.find(
            (row) =>
              (scope.sectionId && row.id === scope.sectionId) ||
              (scope.sectionCode && row.code === scope.sectionCode) ||
              row.code === scope.section ||
              row.name === scope.section ||
              row.nameTh === scope.section ||
              row.nameEn === scope.section,
          );

      return {
        id: String(index + 1),
        functionCode: matchingFunctionOption?.code ?? (isAllFunction ? allFunctionCode : ""),
        divisionCode: matchingDivisionRow?.code ?? (isAllDivision ? allFunctionCode : ""),
        departmentCode: matchingDepartmentRow?.code ?? (isAllDepartment ? allFunctionCode : ""),
        sectionCode: matchingSectionRow?.code ?? (isAllSection ? allFunctionCode : ""),
      };
    });

    setTargetOrgScopes(loadedScopes.length > 0 ? loadedScopes : [{ id: "1", functionCode: "", divisionCode: "", departmentCode: "", sectionCode: "" }]);
    setStandardFunctionCode(loadedScopes[0]?.functionCode ?? "");
    setStandardDivisionCode(loadedScopes[0]?.divisionCode ?? "");
    setStandardDepartmentCode(loadedScopes[0]?.departmentCode ?? "");
    setStandardSectionCode(loadedScopes[0]?.sectionCode ?? "");

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

    setSelectedPrerequisiteCourseIds((course.prerequisites ?? []).map((p) => p.id));
    // What was saved is what the editor chose; nothing on screen was filled in for them yet.
    setAutoAddedPrerequisites([]);
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

  /**
   * The whole prerequisite graph as the screen currently understands it: every course's saved
   * edges, with the course being edited overridden by what is on screen right now.
   */
  const prerequisiteGraph = useMemo(() => {
    const graph: PrerequisiteGraph = new Map(
      courses.map((course) => [course.id, (course.prerequisites ?? []).map((p) => p.id)]),
    );
    if (selectedCourseId) graph.set(selectedCourseId, selectedPrerequisiteCourseIds);
    return graph;
  }, [courses, selectedCourseId, selectedPrerequisiteCourseIds]);

  const prerequisiteCandidates = useMemo(
    () => courses.filter((course) => course.id !== selectedCourseId),
    [courses, selectedCourseId],
  );

  // Picking one of these back would close the loop; the save would be rejected anyway, so say so
  // in the menu rather than after the whole form has been filled in.
  const blockedPrerequisiteIds = useMemo(
    () =>
      selectedCourseId
        ? courseIdsThatWouldCycle(
            prerequisiteGraph,
            selectedCourseId,
            prerequisiteCandidates.map((course) => course.id),
          )
        : new Set<string>(),
    [prerequisiteGraph, prerequisiteCandidates, selectedCourseId],
  );

  const courseLabelById = (id: string) => {
    const course = courses.find((item) => item.id === id);
    return course ? `${course.courseCode} ${getCourseDisplayName(course)}`.trim() : id;
  };

  // The course being edited, named the way the editor sees it. A brand new course has no code
  // until the group is picked, so fall back to whatever identifies it so far.
  const thisCourseLabel =
    `${form.courseCode} ${form.courseNameTh || form.courseNameEn}`.trim() ||
    (language === "th" ? "หลักสูตรนี้" : "this course");

  // Stop explaining an auto-added course once the editor has taken it back out.
  const visibleAutoAddedPrerequisites = autoAddedPrerequisites.filter((item) =>
    selectedPrerequisiteCourseIds.includes(item.id),
  );

  const handleTogglePrerequisite = (id: string) => {
    if (selectedPrerequisiteCourseIds.includes(id)) {
      setSelectedPrerequisiteCourseIds(selectedPrerequisiteCourseIds.filter((item) => item !== id));
      setAutoAddedPrerequisites((prev) => prev.filter((item) => item.id !== id));
      return;
    }

    const next = [...selectedPrerequisiteCourseIds, id];
    const filledIn = collectTransitivePrerequisites(prerequisiteGraph, [id]).filter(
      (item) => !next.includes(item),
    );
    setSelectedPrerequisiteCourseIds([...next, ...filledIn]);
    if (filledIn.length > 0) {
      setAutoAddedPrerequisites((prev) => [
        ...prev.filter((item) => !filledIn.includes(item.id)),
        ...filledIn.map((addedId) => ({ id: addedId, because: id })),
      ]);
    }
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
      toast.error("สร้าง QR code ไม่สำเร็จ / Failed to generate QR code");
    }
  };

  const handleNew = () => {
    void loadPublishedForms();
    setSelectedCourseId("");
    setSelectedTemplateCourseId("");
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
        message: { th: `ยืนยันที่จะลบหลักสูตร "${course.courseCode} - ${courseName}" หรือไม่?`, en: `Confirm deleting course "${course.courseCode} - ${courseName}"?` },
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
      toast.success(`ลบหลักสูตร ${course.courseCode} แล้ว / Course deleted`);
    } catch (error) {
      console.error("Failed to delete course", error);
      toast.error("ลบหลักสูตรไม่สำเร็จ / Failed to delete course");
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
    setFailedMasterLists([]);
    listCourseTypes({ status: "ACTIVE" })
      .then((types) =>
        setCourseTypeOptions(
          types.items.map((item: any) => ({ name: item.name, typeId: item.courseTypeId || item.code })),
        ),
      )
      .catch(() => noteMasterListFailed("Course types", () => setCourseTypeOptions([])));
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
      .catch(() => noteMasterListFailed("Course groups", () => setCourseGroupOptions([])));
    void listOapPlans({ search: null, status: null }).then((result) => setOapPlans(result.oapPlans || []));
    void loadWorkflowRollingPlans().then(setRollingPlans);
    listPositions()
      .then((result) => setPositionRows(result.items.filter((item) => item.status === "ACTIVE")))
      .catch(() => noteMasterListFailed("Positions", () => setPositionRows([])));
    listLevels()
      .then((result) => setLevelRows(result.items.filter((item) => item.status === "ACTIVE")))
      .catch(() => noteMasterListFailed("Levels", () => setLevelRows([])));
    void loadPublishedForms();
    listFunctions()
      .then((functions) =>
        setFunctionRows(
          functions.items
            .filter((item) => item.status === "ACTIVE")
            .map((item) => ({ id: item.functionId, code: item.functionCode, name: item.functionNameEn || item.functionNameTh })),
        ),
      )
      .catch(() => noteMasterListFailed("Functions", () => setFunctionRows([])));
    listCompanies()
      .then((companies) =>
        setCompanyRows(
          companies.items
            .filter((item) => item.status === "ACTIVE")
            .map((item) => ({ id: item.companyId, code: item.companyCode, name: item.companyNameEn || item.companyNameTh })),
        ),
      )
      .catch(() => noteMasterListFailed("Companies", () => setCompanyRows([])));
    listDivisions()
      .then((divisions) =>
        setDivisionRows(
          divisions.items
            .filter((item) => item.status === "ACTIVE")
            .map((item) => ({ id: item.divisionId, code: item.divisionCode, name: item.divisionNameEn || item.divisionNameTh })),
        ),
      )
      .catch(() => noteMasterListFailed("Divisions", () => setDivisionRows([])));
    listDepartments()
      .then((departments) =>
        setDepartmentRows(
          departments.items
            .filter((item) => item.status === "ACTIVE")
            .map((item) => ({ id: item.departmentId, code: item.departmentCode, name: item.departmentNameEn || item.departmentNameTh })),
        ),
      )
      .catch(() => noteMasterListFailed("Departments", () => setDepartmentRows([])));
    listSections()
      .then((sections) =>
        setSectionRows(
          sections.items
            .filter((item) => item.status === "ACTIVE")
            .map((item) => ({ id: item.sectionId, code: item.sectionCode, name: item.sectionNameEn || item.sectionNameTh })),
        ),
      )
      .catch(() => noteMasterListFailed("Sections", () => setSectionRows([])));
    listOrgHierarchyUsage()
      .then((result) => setOrgUsage(result.items))
      .catch(() => noteMasterListFailed("Org hierarchy usage", () => setOrgUsage([])));

    try {
      const courseData = await listCourses({ search: "", status: null });
      setCourses(courseData.courses || []);
      setStandards(courseData.standards || []);
    } catch (e) {
      console.error(e);
    }

    setSelectedCourseId("");
    setSelectedTemplateCourseId("");
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
    setSelectedTemplateCourseId("");
    setOpenDetailCourseId(isSameOpen ? "" : course.id);
    setIsNewOpen(false);
    setIsEditing(false);
    setForm(buildCourseForm(course));
    setLinkModeFields(deriveLinkModeFields(course));
    loadStandardForm(course);
  };

  const handleClosePanel = () => {
    setSelectedCourseId("");
    setSelectedTemplateCourseId("");
    setOpenDetailCourseId("");
    setIsNewOpen(false);
    setIsEditing(false);
    setForm(emptyCourseForm);
    setLinkModeFields(new Set());
    resetStandardForm();
  };

  const handleSave = async () => {
    // Refuse rather than let an empty picker be read as a deliberate choice — see failedMasterLists.
    if (failedMasterLists.length > 0) {
      const failed = failedMasterLists.join(", ");
      toast.error(
        language === "th"
          ? `โหลดข้อมูลหลักไม่สำเร็จ (${failed}) กรุณากดรีเฟรชแล้วลองใหม่ ยังบันทึกไม่ได้เพราะกลุ่มเป้าหมายอาจว่างโดยไม่ได้ตั้งใจ`
          : `Could not load master data (${failed}). Refresh and try again — saving now could store an empty target audience by accident.`,
      );
      return;
    }

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
      targetOrgScopes: targetOrgScopes.map((scope) => ({
        functionId:
          !scope.functionCode || scope.functionCode === allFunctionCode
            ? null
            : functionRows.find((row) => row.code === scope.functionCode)?.id || null,
        divisionId:
          !scope.divisionCode || scope.divisionCode === allFunctionCode
            ? null
            : divisionRows.find((row) => row.code === scope.divisionCode)?.id || null,
        departmentId:
          !scope.departmentCode || scope.departmentCode === allFunctionCode
            ? null
            : departmentRows.find((row) => row.code === scope.departmentCode)?.id || null,
        sectionId:
          !scope.sectionCode || scope.sectionCode === allFunctionCode
            ? null
            : sectionRows.find((row) => row.code === scope.sectionCode)?.id || null,
      })),
      targetCompanies: selectedCompanies,
      targetPositions: selectedPositions,
      targetLevels: selectedLevels,
      standardYear,
      prerequisiteCourseIds: selectedPrerequisiteCourseIds,
    };

    const wasEditing = Boolean(selectedCourseId);

    try {
      if (selectedCourseId) {
        await updateCourse(selectedCourseId, input);
      } else {
        await createCourse(input);
      }

      await handleRefresh();
      toast.success(
        wasEditing
          ? "บันทึกการแก้ไขหลักสูตรแล้ว / Course updated"
          : "บันทึกหลักสูตรใหม่แล้ว / Course created",
      );
    } catch (error) {
      console.error("Failed to save course", error);
      const msg = error instanceof Error ? error.message : "";
      // 409 duplicate name — the DB unique index is on the normalised Thai name
      if (
        msg.toLowerCase().includes("unique") ||
        msg.toLowerCase().includes("conflict") ||
        msg.toLowerCase().includes("already exists")
      ) {
        toast.error(
          "ไม่สามารถบันทึกได้ ชื่อหลักสูตรนี้มีอยู่ในระบบแล้ว กรุณาแก้ชื่อหลักสูตร (ภาษาไทย) ให้ไม่ซ้ำกัน / Course name already exists",
        );
      } else {
        toast.error(msg || "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง / Failed to save course");
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

      {isNewOpen ? (
        <div style={{
          marginBottom: "16px",
          padding: "16px",
          borderRadius: "10px",
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(59, 130, 246, 0.02))",
          border: "1px solid rgba(59, 130, 246, 0.3)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
            <span className={styles.fieldLabel} style={{ color: "#2563eb", fontWeight: 800, fontSize: "0.92rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
              <span>📋</span>
              <span>
                {language === "th"
                  ? "ดึงข้อมูลจากหลักสูตรส่วนกลาง (Copy details from Center Course template)"
                  : "Copy details from Center Course template"}
              </span>
            </span>
            <SearchableSelect
              value={selectedTemplateCourseId}
              options={centerCourseTemplateOptions}
              placeholder={language === "th" ? "🔍 เลือกหลักสูตรส่วนกลางเพื่อดึงรายละเอียด..." : "🔍 Select Center course template..."}
              onChange={(code) => handleApplyCenterTemplate(code)}
            />
            <small className={styles.fieldHint} style={{ color: "#64748b", marginTop: "4px" }}>
              {language === "th"
                ? "* ระบบจะดึงเฉพาะข้อมูลรายละเอียดหลักสูตร (กลุ่มหลักสูตร, ประเภทหลักสูตร, ชื่อหลักสูตร, วัตถุประสงค์, เนื้อหา, ที่มา) โดยจะเว้นแบบทดสอบ แบบประเมิน และเกณฑ์มาตรฐานให้คุณระบุเอง"
                : "* Copies course details (Group, Type, Name, Objective, Content, Reason). Tests, Evaluations, and Target Standards are left blank for you to define."}
            </small>
          </div>
        </div>
      ) : null}

      <div className={styles.formGrid}>
        <label>
          <span className={styles.fieldLabel}>Course Group <RequiredIndicator isFilled={Boolean(form.courseGroup)} /></span>
          <select value={form.courseGroup} disabled={!isEditing} onChange={(event) => handleCourseGroupChange(event.target.value)}>
            <option value="">Select Course Group</option>
            {courseGroups.map((group) => (
              <option key={group} value={group} translate="no">{group}</option>

            ))}
          </select>
          <small className={styles.fieldHint}>Controls course classification and the generated course code.</small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Course Code <RequiredIndicator isFilled={Boolean(form.courseCode)} /></span>
          <input
            value={form.courseCode}
            readOnly
            placeholder="Select Course Group to generate code"
            title="Auto-generated from the selected Course Group"
          />
          <small className={styles.fieldHint}>Auto-generated based on selected Course Group.</small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Course Type <RequiredIndicator isFilled={Boolean(form.courseType)} /></span>
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
          <span className={styles.fieldLabel}>Course Name (TH) <RequiredIndicator isFilled={Boolean(form.courseNameTh.trim())} /></span>
          <input
            value={form.courseNameTh}
            disabled={!isEditing}
            placeholder="ตัวอย่าง: การอบรมความปลอดภัยพื้นฐาน"
            onChange={(event) => updateForm("courseNameTh", event.target.value)}
          />
        </label>
        <label>
          <span className={styles.fieldLabel}>Course Name (EN) <RequiredIndicator isFilled={Boolean(form.courseNameEn.trim())} /></span>
          <input
            value={form.courseNameEn}
            disabled={!isEditing}
            placeholder="Example: Basic Safety Course"
            onChange={(event) => updateForm("courseNameEn", event.target.value)}
          />
        </label>
        <label className={styles.fullWidth}>
          <span className={styles.fieldLabel}>ที่มา (Background) <RequiredIndicator isFilled={Boolean(form.remark.trim())} /></span>
          <textarea
            value={form.remark}
            disabled={!isEditing}
            placeholder="อธิบายที่มา หรือเหตุผลว่าทำไมถึงจัดหลักสูตรอบรมนี้ (Background / Reason for training)"
            onChange={(event) => updateForm("remark", event.target.value)}
          />
          <small className={styles.fieldHint}>อธิบายที่มา ความจำเป็น หรือเหตุผลในการจัดทำหลักสูตรการอบรมนี้</small>
        </label>
        <label className={styles.fullWidth}>
          <span className={styles.fieldLabel}>Objective <RequiredIndicator isFilled={Boolean(form.objective.trim())} /></span>
          <textarea
            value={form.objective}
            disabled={!isEditing}
            placeholder="Describe what learners should achieve after completing the course."
            onChange={(event) => updateForm("objective", event.target.value)}
          />
          <small className={styles.fieldHint}>Use a measurable outcome, for example “Explain and apply the five safety rules.”</small>
        </label>
        <label className={styles.fullWidth}>
          <span className={styles.fieldLabel}>Learning Content <RequiredIndicator isFilled={Boolean(form.learningContent.trim())} /></span>
          <textarea
            value={form.learningContent}
            disabled={!isEditing}
            placeholder="List the main topics, activities, or skills covered by the course."
            onChange={(event) => updateForm("learningContent", event.target.value)}
          />
        </label>
        <label>
          <span className={styles.fieldLabel}>Target Group <RequiredIndicator isFilled={Boolean(form.targetGroup.trim())} /></span>
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
              <span className={styles.fieldLabel} style={{ width: "100%", margin: "4px 0 2px" }}>Pre Test Link <RequiredIndicator isFilled={Boolean(form.preTestLink.trim())} /></span>
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
          <span className={styles.fieldLabel}>Post Test {linkModeFields.has("postTest") ? <RequiredIndicator isFilled={Boolean(form.postTestLink.trim())} /> : <em>Optional</em>}</span>
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
              <span className={styles.fieldLabel} style={{ width: "100%", margin: "4px 0 2px" }}>Post Test Link <RequiredIndicator isFilled={Boolean(form.postTestLink.trim())} /></span>
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
          <span className={styles.fieldLabel}>Evaluation After Training {linkModeFields.has("evaluation") ? <RequiredIndicator isFilled={Boolean(form.evaluationLink.trim())} /> : <em>Optional</em>}</span>
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
              <span className={styles.fieldLabel} style={{ width: "100%", margin: "4px 0 2px" }}>Evaluation Link <RequiredIndicator isFilled={Boolean(form.evaluationLink.trim())} /></span>
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
          <span className={styles.fieldLabel}>Evaluation After 30 Days {linkModeFields.has("evaluationAfter30Day") ? <RequiredIndicator isFilled={Boolean(form.evaluationAfter30DayLink.trim())} /> : <em>Optional</em>}</span>
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
              <span className={styles.fieldLabel} style={{ width: "100%", margin: "4px 0 2px" }}>30-Day Evaluation Link <RequiredIndicator isFilled={Boolean(form.evaluationAfter30DayLink.trim())} /></span>
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
              <h4>Check List Company <RequiredIndicator isFilled={selectedCompanies.length > 0} /></h4>
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

        <div style={{ marginTop: "16px", marginBottom: "16px" }}>
          <span style={{ display: "block", fontSize: "1.05rem", fontWeight: 700, color: "var(--ui-30-ink)" }}>
            เลือกคอร์สต่อเนื่อง(ถ้ามี)
          </span>
          {/* "ต่อเนื่อง" alone does not say which course comes first, and getting that backwards
              locks employees out of the earlier course instead of the later one. Naming this course
              inside the sentence settles the direction without anyone having to interpret. */}
          <small className={styles.fieldHint} style={{ display: "block", marginBottom: "8px" }}>
            {language === "th"
              ? `พนักงานต้องผ่านหลักสูตรที่เลือกด้านล่างนี้ก่อน จึงจะสมัคร «${thisCourseLabel}» ได้`
              : `Employees must complete the courses selected below before they can register for «${thisCourseLabel}»`}
          </small>
          <PrerequisiteCourseSelect
            selectedIds={selectedPrerequisiteCourseIds}
            options={prerequisiteCandidates.map((c) => ({
              id: c.id,
              code: c.courseCode,
              name: c.courseNameTh || c.courseNameEn,
            }))}
            disabled={!isEditing}
            placeholder="ค้นหาหลักสูตรที่ต้องผ่านมาก่อน... / Search prerequisite courses..."
            blockedIds={blockedPrerequisiteIds}
            blockedReason={(code) =>
              language === "th"
                ? `เลือกไม่ได้: «${code}» ต้องผ่านหลักสูตรนี้อยู่แล้ว การเลือกกลับจะทำให้วนเป็นวงกลม`
                : `Unavailable: «${code}» already requires this course, so this would form a loop`
            }
            onToggle={handleTogglePrerequisite}
          />

          {visibleAutoAddedPrerequisites.length > 0 ? (
            <p
              style={{
                margin: "8px 0 0", padding: "8px 10px", borderRadius: "8px",
                background: "rgba(234, 179, 8, 0.10)", border: "1px solid rgba(234, 179, 8, 0.35)",
                color: "#854d0e", fontSize: "0.78rem", lineHeight: 1.5,
              }}
            >
              {visibleAutoAddedPrerequisites.map((item) => (
                <span key={item.id} style={{ display: "block" }}>
                  {language === "th"
                    ? `เพิ่ม «${courseLabelById(item.id)}» ให้อัตโนมัติ เพราะ «${courseLabelById(item.because)}» กำหนดให้ต้องผ่านก่อน`
                    : `Added «${courseLabelById(item.id)}» automatically because «${courseLabelById(item.because)}» requires it first`}
                </span>
              ))}
              <span style={{ display: "block", marginTop: "4px", opacity: 0.85 }}>
                {language === "th"
                  ? "หากไม่ต้องการบังคับ กดกากบาทบนชิปเพื่อเอาออกได้"
                  : "Remove any of them with the × on its chip if you do not want it enforced."}
              </span>
            </p>
          ) : null}

          {/* Reads the saved shape back as a sentence so the direction can be checked at a glance. */}
          {selectedPrerequisiteCourseIds.length > 0 ? (
            <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--ui-30-text)" }}>
              <strong>{language === "th" ? "ต้องผ่าน" : "Must complete"}</strong>{" "}
              <span translate="no">
                {selectedPrerequisiteCourseIds
                  .map((id) => courses.find((c) => c.id === id)?.courseCode ?? id)
                  .join(" · ")}
              </span>
              {"  →  "}
              <strong>{language === "th" ? "จึงจะสมัคร" : "before registering for"}</strong>{" "}
              <span translate="no">{form.courseCode || thisCourseLabel}</span>{" "}
              {language === "th" ? "ได้" : ""}
            </p>
          ) : null}
        </div>

        <div style={{ marginTop: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--ui-30-ink)" }}>กลุ่มเป้าหมาย (Function, Division, Department, Section)</h4>
            {isEditing ? (
              <button
                className={styles.primaryButton}
                style={{ minHeight: "32px", padding: "4px 14px", fontSize: "0.82rem" }}
                type="button"
                onClick={() =>
                  setTargetOrgScopes((prev) => [
                    ...prev,
                    { id: Date.now().toString(), functionCode: "", divisionCode: "", departmentCode: "", sectionCode: "" },
                  ])
                }
              >
                + เพิ่มกลุ่มเป้าหมาย (+ Add Target Scope)
              </button>
            ) : null}
          </div>

          {targetOrgScopes.map((scopeRow, index) => (
            <div
              key={scopeRow.id}
              style={{
                marginBottom: "12px",
                padding: "14px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.02)",
              }}
            >
              {targetOrgScopes.length > 1 ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, opacity: 0.85 }}>
                    กลุ่มเป้าหมายที่ {index + 1}
                  </span>
                  {isEditing ? (
                    <button
                      className={styles.dangerButton}
                      style={{ padding: "2px 8px", fontSize: "12px" }}
                      type="button"
                      onClick={() =>
                        setTargetOrgScopes((prev) =>
                          prev.length > 1 ? prev.filter((r) => r.id !== scopeRow.id) : prev,
                        )
                      }
                    >
                      🗑️ ลบ (Delete)
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.standard_formGrid}>
                <div style={{ display: "grid", gap: "6px" }}>
                  <span className={styles.fieldLabel} translate="no">Function Name</span>
                  <SearchableSelect
                    value={scopeRow.functionCode}
                    disabled={!isEditing}
                    options={functionOptions}
                    placeholder="Search or select Function"
                    onChange={(nextCode) => {
                      setTargetOrgScopes((prev) =>
                        prev.map((r) => (r.id === scopeRow.id ? { ...r, functionCode: nextCode } : r)),
                      );
                      if (index === 0) {
                        setStandardFunctionCode(nextCode);
                        setStandardFunctionName(
                          functionOptions.find((option) => option.code === nextCode)?.name ?? "",
                        );
                      }
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <span className={styles.fieldLabel} translate="no">Division</span>
                  <SearchableSelect
                    value={scopeRow.divisionCode}
                    disabled={!isEditing}
                    options={divisionOptions}
                    placeholder="Search or select Division"
                    onChange={(nextCode) => {
                      setTargetOrgScopes((prev) =>
                        prev.map((r) => (r.id === scopeRow.id ? { ...r, divisionCode: nextCode } : r)),
                      );
                      if (index === 0) setStandardDivisionCode(nextCode);
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <span className={styles.fieldLabel} translate="no">Department</span>
                  <SearchableSelect
                    value={scopeRow.departmentCode}
                    disabled={!isEditing}
                    options={departmentOptions}
                    placeholder="Search or select Department"
                    onChange={(nextCode) => {
                      setTargetOrgScopes((prev) =>
                        prev.map((r) => (r.id === scopeRow.id ? { ...r, departmentCode: nextCode } : r)),
                      );
                      if (index === 0) setStandardDepartmentCode(nextCode);
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <span className={styles.fieldLabel} translate="no">Section</span>
                  <SearchableSelect
                    value={scopeRow.sectionCode}
                    disabled={!isEditing}
                    options={sectionOptions}
                    placeholder="Search or select Section"
                    onChange={(nextCode) => {
                      setTargetOrgScopes((prev) =>
                        prev.map((r) => (r.id === scopeRow.id ? { ...r, sectionCode: nextCode } : r)),
                      );
                      if (index === 0) setStandardSectionCode(nextCode);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
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

        {/* Filter bar for Company and Course Group */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Company selector – only for Center users */}
          {!isFactoryUser && (
            <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
              <SearchableSelect
                value={listCompanyFilter}
                options={[
                  { code: '', name: language === 'th' ? 'ทุกบริษัท (All Companies)' : 'All Companies' },
                  ...companyRows.map((row) => ({ code: row.code, name: language === 'th' ? row.nameTh || row.name : row.nameEn || row.name })),
                ]}
                placeholder={language === 'th' ? 'เลือกบริษัท' : 'Select Company'}
                onChange={(code) => {
                  setListCompanyFilter(code);
                }}
              />
            </div>
          )}

          {/* Course Group selector */}
          <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
            <SearchableSelect
              value={listCourseGroupFilter}
              options={[
                { code: '', name: language === 'th' ? 'ทุกกลุ่มหลักสูตร (All Course Groups)' : 'All Course Groups' },
                ...courseGroupOptions.map((g) => ({ code: g.name, name: g.name })),
              ]}
              placeholder={language === 'th' ? 'เลือกกลุ่มหลักสูตร (Course Group)' : 'Select Course Group'}
              onChange={(groupName) => {
                setListCourseGroupFilter(groupName);
              }}
            />
          </div>
        </div>

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
                        <th style={{ width: "50px", textAlign: "center" }}>#</th>
                        <th>{language === 'th' ? 'รหัสหลักสูตร' : 'Course Code'}</th>
                        <th>{language === 'th' ? 'ชื่อหลักสูตร' : 'Course Name'}</th>
                        <th>{language === 'th' ? 'บริษัท' : 'Company'}</th>
                        <th>{language === 'th' ? 'Classification' : 'Classification'}</th>
                        <th>{language === 'th' ? 'Course Standard' : 'Course Standard'}</th>
                        <th>{language === 'th' ? 'คอร์สต่อเนื่อง' : 'Prerequisites'}</th>
                        <th>{language === 'th' ? 'Actions' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.courses.map((course, cIdx) => {
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
                              <td style={{ textAlign: "center", fontWeight: 700 }}>{cIdx + 1}</td>
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
                              <td translate="no">
                                {course.prerequisites && course.prerequisites.length > 0
                                  ? course.prerequisites.map((p) => p.courseCode).join(" · ")
                                  : "—"}
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
                                <td colSpan={8}>
                                  <div className={styles.inlinePanel}>
                                    {renderCoursePanel(
                                      `${course.courseCode} — ${getCourseDisplayName(course)}`,
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
              width: "min(1240px, 96vw)",
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
                  <div
                    className="importPreviewTable"
                    style={{
                      overflowX: "auto",
                      overflowY: "auto",
                      border: "1px solid #94a3b8",
                      borderRadius: "8px",
                      maxHeight: "420px",
                      background: "#ffffff",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  >
                    <table className="importPreviewTable" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                      <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                        <tr style={{ background: "#0f172a", color: "#ffffff", textAlign: "left" }}>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700 }}>#</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700 }}>Course Code</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700, minWidth: "220px" }}>Course Name (TH)</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700, minWidth: "220px" }}>Course Name (EN)</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700 }}>Course Group</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700 }}>Course Type</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700 }}>Target Levels (N-Y)</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700 }}>Target Group</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700, minWidth: "250px" }}>Learning Content</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700, minWidth: "250px" }}>Objective</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", borderRight: "1px solid #334155", color: "#ffffff", fontWeight: 700 }}>Methodology</th>
                          <th style={{ padding: "12px 14px", borderBottom: "2px solid #000000", color: "#ffffff", fontWeight: 700 }}>Life Cycle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((row, i) => (
                          <tr
                            key={i}
                            style={{
                              background: i % 2 === 0 ? "#ffffff" : "#f8fafc",
                              borderBottom: "1px solid #cbd5e1",
                            }}
                          >
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0", color: "#000000", fontWeight: 700 }}>{row.rowNum}</td>
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0", fontWeight: 800, color: "#000000" }}>{row.courseCode || "(Auto)"}</td>
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0", color: "#000000", fontWeight: 700 }}>{row.courseNameTh}</td>
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0", color: "#000000", fontWeight: 600 }}>{row.courseNameEn || "-"}</td>
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0" }}>
                              <span style={{ background: "#dbeafe", color: "#000000", border: "1px solid #93c5fd", padding: "4px 9px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 700 }}>
                                {row.courseGroup || "General"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0" }}>
                              <span style={{ background: "#fef3c7", color: "#000000", border: "1px solid #fde68a", padding: "4px 9px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 700 }}>
                                {row.courseType || (isFactoryUser ? "IN-HOUSE" : "ATA-TC")}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0" }}>
                              {row.levels ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                  {row.levels.split(",").map((lvl, lIdx) => (
                                    <span
                                      key={lIdx}
                                      style={{
                                        background: "#dcfce7",
                                        color: "#000000",
                                        fontWeight: 800,
                                        fontSize: "0.78rem",
                                        padding: "3px 7px",
                                        borderRadius: "5px",
                                        border: "1px solid #86efac",
                                      }}
                                    >
                                      {lvl.trim()}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: "#000000", fontWeight: 600 }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0", color: "#000000", fontWeight: 600 }}>{row.targetGroup || "-"}</td>
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0", color: "#000000", fontWeight: 500, minWidth: "260px", maxWidth: "360px", whiteSpace: "pre-line", wordBreak: "break-word", lineHeight: 1.5 }}>{row.learningContent || "-"}</td>
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0", color: "#000000", fontWeight: 500, minWidth: "260px", maxWidth: "360px", whiteSpace: "pre-line", wordBreak: "break-word", lineHeight: 1.5 }}>{row.objective || "-"}</td>
                            <td style={{ padding: "10px 14px", borderRight: "1px solid #e2e8f0", color: "#000000", fontWeight: 600 }}>{row.methodology || "Lecture / Workshop"}</td>
                            <td style={{ padding: "10px 14px", color: "#000000", fontWeight: 600 }}>{row.lifeCycleMonth || "0"}</td>
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
                disabled={importRows.length === 0 || isImporting}
                style={{
                  background: importRows.length === 0 || isImporting ? "#94a3b8" : "var(--ui-30-primary, #007a3d)",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 22px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  cursor: importRows.length === 0 || isImporting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onClick={() => void handleCommitExcelImport()}
              >
                {isImporting
                  ? "กำลังนำเข้าข้อมูล... (Importing...)"
                  : `ยืนยันการนำเข้าข้อมูล (${importRows.length} รายการ)`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}
