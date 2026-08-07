
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  TRAINING_MASTER_KEYS,
  TRAINING_WORKFLOW_KEYS,
  getCourseDisplayName,
  getCourseSecondaryName,
  isWorkflowOwner,
  readMasterCollection,
  readWorkflowCollection,
  type WorkflowCourse,
  type WorkflowOapPlan,
  type WorkflowOwner,
  type WorkflowRollingPlan,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { listCourses, createCourse, updateCourse, deleteCourse } from "../../../../lib/courses/client";
import { normalizeEmployeeLevel } from "../../../../lib/employeeMasterData";
import { listAssessments } from "../../../../lib/assessments/client";
import { listEvaluations } from "../../../../lib/evaluations/client";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { listCourseGroups } from "../../../../lib/courseGroups/client";
import { listCourseTypes } from "../../../../lib/courseTypes/client";
import { listFunctions } from "../../../../lib/functions/client";
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
  lifeCycleMonth: string;
  remark: string;
  status: CourseStatus;
  courseType: string;
  courseGroup: string;
};

type CourseRecord = WorkflowCourse;
type CourseStandardRecord = WorkflowStandard;

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
  lifeCycleMonth: "12",
  remark: "",
  status: "Active",
  courseType: "",
  courseGroup: "",
};

function CourseMaster() {
  const user = useAuthenticatedUser();
  const [courseTypeOptions, setCourseTypeOptions] = useState<Array<{ name: string; typeId: string }>>([]);
  const courseTypes = courseTypeOptions.map((type) => type.name);
  const [courseGroupOptions, setCourseGroupOptions] = useState<Array<{ name: string; groupId: string }>>([]);
  const courseGroups = courseGroupOptions.map((group) => group.name);
  const [assessmentOptions, setAssessmentOptions] = useState<TrainingAssessmentOption[]>([]);
  const [evaluationOptions, setEvaluationOptions] = useState<TrainingEvaluationOption[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [form, setForm] = useState<CourseForm>(emptyCourseForm);
  const [isEditing, setIsEditing] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [openDetailCourseId, setOpenDetailCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [standards, setStandards] = useState<CourseStandardRecord[]>([]);
  const [oapPlans, setOapPlans] = useState(() =>
    readWorkflowCollection<WorkflowOapPlan>(TRAINING_WORKFLOW_KEYS.oapPlans),
  );
  const [rollingPlans, setRollingPlans] = useState(() =>
    readWorkflowCollection<WorkflowRollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans),
  );
  const [standardFunctionCode, setStandardFunctionCode] = useState(allFunctionCode);
  const [standardFunctionName, setStandardFunctionName] = useState(allFunctionOption);

  useEffect(() => {
    let active = true;
    void Promise.all([
      listCourseTypes({ status: "ACTIVE" }),
      listCourseGroups({ status: "ACTIVE" }),
      listCourses({ search: "", status: null }),
      listFunctions(),
    ]).then(([types, groups, courseData, functions]) => {
      if (!active) return;
      setCourseTypeOptions(types.items.map((item: any) => ({ name: item.name, typeId: item.courseTypeId || item.code })));
      setCourseGroupOptions(groups.items.map((item: any) => ({ name: item.name, groupId: item.courseGroupId || item.code })));
      setCourses(courseData.courses || []);
      setStandards(courseData.standards || []);
      setFunctionRows(
        functions.items
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({ id: item.functionId, code: item.functionCode, name: item.functionNameEn || item.functionNameTh })),
      );
    }).catch(() => {
      if (!active) return;
      setCourseTypeOptions([]);
      setCourseGroupOptions([]);
      setFunctionRows([]);
    });
    void loadPublishedForms();
    return () => { active = false; };
  }, []);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [functionRows, setFunctionRows] = useState<
    Array<{ id: string; code: string; name: string }>
  >([]);
  const [positionRows, setPositionRows] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.positions, defaultPositionRows),
  );
  const [levelRows, setLevelRows] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.levels, defaultLevelRows),
  );
  const functionOptions = [
    { id: "", code: allFunctionCode, name: allFunctionOption },
    ...functionRows,
  ];
  const positionChecklist = positionRows
    .map((row) => row.positionNameEn.trim())
    .filter(Boolean);
  const levelChecklist = levelRows
    .map((row) => normalizeEmployeeLevel(row.levelKey))
    .filter(Boolean);

  const requiredCourseValues = [
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

  const userCompanyCode = profileValue(user?.companyCode);
  const owner: WorkflowOwner = user?.roleCode === "HRD_CENTER" ? "CENTER" : "FACTORY";
  const ownerCompany = owner === "CENTER" ? "HRD Center" : userCompanyCode;
  const scopedCourses = useMemo(
    () =>
      courses.filter((course) =>
        isWorkflowOwner(course.owner, course.ownerCompany, user?.roleCode, userCompanyCode),
      ),
    [courses, user?.roleCode, userCompanyCode],
  );
  const selectedCourse = scopedCourses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedStandard =
    standards.find(
      (standard) =>
        standard.courseId === selectedCourse?.id ||
        standard.courseCode === selectedCourse?.courseCode,
    ) ?? null;
  const usedCourseIds = useMemo(
    () =>
      new Set([
        ...oapPlans.map((plan) => plan.course.id),
        ...rollingPlans.map((plan) => plan.course.id),
      ]),
    [oapPlans, rollingPlans],
  );
  const isSelectedCourseLocked = selectedCourse ? usedCourseIds.has(selectedCourse.id) : false;
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

  const resetStandardForm = () => {
    setStandardFunctionCode(allFunctionCode);
    setStandardFunctionName(allFunctionOption);
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

    const matchingFunction = functionOptions.find(
      (option) =>
        option.code === standard.functionCode ||
        option.name === standard.functionName,
    );
    setStandardFunctionCode(matchingFunction?.code ?? allFunctionCode);
    setStandardFunctionName(standard.functionName || allFunctionOption);
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

  // course_code is system-generated server-side from course_group_code + an
  // atomically incremented per-group running number (Data Dictionary V6.2).
  // The browser never computes it — it only shows the value the server returns.
  const handleCourseGroupChange = (courseGroup: string) => {
    setForm((current) => ({
      ...current,
      courseGroup,
      courseCode: "",
    }));
  };

  const handleNew = () => {
    void loadPublishedForms();
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setForm(emptyCourseForm);
    resetStandardForm();
    setIsEditing(true);
    setIsNewOpen(true);
  };

  const openCourseEditor = (course: CourseRecord) => {
    void loadPublishedForms();
    setSelectedCourseId(course.id);
    setForm(buildCourseForm(course));
    loadStandardForm(course);
    setIsEditing(true);
    setIsNewOpen(false);
    setOpenDetailCourseId(course.id);
  };

  const handleEdit = () => {
    if (!selectedCourse || isSelectedCourseLocked) return;

    openCourseEditor(selectedCourse);
  };

  const handleDelete = async () => {
    if (!selectedCourse || isSelectedCourseLocked) return;

    try {
      await deleteCourse(selectedCourse.id);
      await handleRefresh();
    } catch (error) {
      console.error("Failed to delete course", error);
      alert("Failed to delete course");
    }
  };

  const handleRefresh = async () => {
    setOapPlans(readWorkflowCollection<WorkflowOapPlan>(TRAINING_WORKFLOW_KEYS.oapPlans));
    setRollingPlans(readWorkflowCollection<WorkflowRollingPlan>(TRAINING_WORKFLOW_KEYS.rollingPlans));
    setPositionRows(readMasterCollection(TRAINING_MASTER_KEYS.positions, defaultPositionRows));
    setLevelRows(readMasterCollection(TRAINING_MASTER_KEYS.levels, defaultLevelRows));
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

  const handleSave = async () => {
    if (!isCourseFormReady || !standardFunctionName.trim()) return;

    const courseTypeId = courseTypeOptions.find(t => t.name === form.courseType)?.typeId || "";
    const courseGroupId = courseGroupOptions.find(g => g.name === form.courseGroup)?.groupId || "";
    const standardYear = new Date().getFullYear();

    const input = {
      courseNameTh: form.courseNameTh.trim(),
      courseNameEn: form.courseNameEn.trim(),
      objective: form.objective,
      learningContent: form.learningContent,
      targetGroup: form.targetGroup,
      methodology: form.methodology,
      durationHours: 1, // UI does not capture duration; default 1 to satisfy DB CHECK (duration_hours > 0)
      validityMonths: form.lifeCycleMonth ? Number(form.lifeCycleMonth) : null,
      preAssessmentId: form.preTestId || null,
      postAssessmentId: form.postTestId || null,
      evaluationFormId: form.evaluationId || null,
      evaluationFormAfter30DayId: form.evaluationAfter30DayId || null,
      status: "Active" as const,
      courseTypeId,
      courseGroupId,

      // course_standard.standard_code has no documented format (Data Dictionary V6.2:
      // required + unique, no generation rule) — this is only used the first time a
      // standard is created for a given year; later courses in the same year reuse it.
      standardCode: `STD-${standardYear}-G${courseGroupId}`,
      standardName: getCourseDisplayName({ courseNameTh: form.courseNameTh.trim(), courseNameEn: form.courseNameEn.trim() }),
      functionId:
        standardFunctionCode === allFunctionCode
          ? null
          : functionOptions.find((option) => option.code === standardFunctionCode)?.id || null,
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
      alert("Failed to save course");
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
            placeholder="Generated by the server when saved"
            title="Assigned automatically by the server on save, from the selected Course Group's code"
          />
          <small className={styles.fieldHint}>Assigned by the server on save; not editable.</small>
        </label>
        <label>
          <span className={styles.fieldLabel}>Course Name (TH) <b>*</b></span>
          <input
            value={form.courseNameTh}
            disabled={!isEditing}
            placeholder="Example: หลักสูตรความปลอดภัยพื้นฐาน"
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
        <label>
          <span className={styles.fieldLabel}>Course Type <b>*</b></span>
          <select
            value={form.courseType}
            disabled={!isEditing}
            onChange={(event) => updateForm("courseType", event.target.value)}
          >
            <option value="">Select Course Type</option>
            {courseTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={styles.fieldLabel}>Life Cycle (Month)</span>
          <input
            value={form.lifeCycleMonth}
            disabled={!isEditing}
            inputMode="numeric"
            min="1"
            placeholder="Example: 12"
            type="number"
            onChange={(event) => updateForm("lifeCycleMonth", event.target.value)}
          />
          <small className={styles.fieldHint}>Number of months before the course should be reviewed.</small>
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
                [{assessment.code}] {assessment.name} ({assessment.assessmentType})
              </option>
            ))}
          </select>
          <small className={styles.catalogHint}>
            {selectedPreTest
              ? `${selectedPreTest.questionCount} questions`
              : `${publishedPreTests.length} published assessment option${publishedPreTests.length === 1 ? "" : "s"}`}
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
                [{assessment.code}] {assessment.name} ({assessment.assessmentType})
              </option>
            ))}
          </select>
          <small className={styles.catalogHint}>
            {selectedPostTest
              ? `${selectedPostTest.questionCount} questions`
              : `${publishedPostTests.length} published assessment option${publishedPostTests.length === 1 ? "" : "s"}`}
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
          <small className={styles.catalogHint}>
            {selectedEvaluation
              ? `${selectedEvaluation.questionCount} questions · ${selectedEvaluation.respondent} · ${selectedEvaluation.scope}`
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
          <small className={styles.catalogHint}>
            {selectedFollowUpEvaluation
              ? `${selectedFollowUpEvaluation.questionCount} questions · ${selectedFollowUpEvaluation.respondent} · ${selectedFollowUpEvaluation.scope}`
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
            <h3>Function, Position and Level</h3>
            <p>Define the training target before saving the course.</p>
          </div>
        </div>

        <div className={styles.standard_formGrid}>
          <label>
            Function Name
            <select
              value={standardFunctionCode}
              disabled={!isEditing}
              onChange={(event) => {
                const nextCode = event.target.value;
                setStandardFunctionCode(nextCode);
                setStandardFunctionName(
                  functionOptions.find((option) => option.code === nextCode)
                    ?.name ?? allFunctionOption,
                );
              }}
            >
              {functionOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
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

  return (
    <section className={styles.page} aria-label="Course Master management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{courseMasterModule.subtitle}</p>
          <h2>{courseMasterModule.title}</h2>
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
        <button className={styles.secondaryButton} type="button" onClick={handleEdit} disabled={!selectedCourse || isSelectedCourseLocked}>
          Edit
        </button>
        <button className={styles.dangerButton} type="button" onClick={handleDelete} disabled={!selectedCourse || isSelectedCourseLocked}>
          Delete
        </button>
        <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
          Refresh
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
                        <strong>{course.courseType}</strong>
                        <span>{course.courseGroup}</span>
                      </td>
                      <td>
                        <strong>{courseStandard?.functionName ?? "Not set"}</strong>
                        <span>
                          {courseStandard
                            ? `${courseStandard.positions.length} positions · ${courseStandard.levels.length} levels`
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
                          disabled={usedCourseIds.has(course.id)}
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

    </section>
  );
}
