"use client";

import { Fragment, useMemo, useState } from "react";
import {
  TRAINING_WORKFLOW_KEYS,
  TRAINING_MASTER_KEYS,
  isWorkflowOwner,
  readMasterCollection,
  readWorkflowCollection,
  writeWorkflowCollection,
  type WorkflowCourse,
  type WorkflowOwner,
} from "../../../../lib/trainingWorkflow";
import {
  readPublishedAssessmentOptions,
  readPublishedEvaluationOptions,
  type TrainingAssessmentOption,
  type TrainingEvaluationOption,
} from "../../../../lib/trainingFormCatalog";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { defaultCourseGroups } from "./CourseGroup";
import { defaultCourseTypes } from "./CourseType";
import styles from "./CourseMaster.module.css";

export const courseMasterModule = {
  title: "Course Master",
  subtitle: "Course database",
  description: "Create and maintain course master data for training plans, records, and reports.",
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

export default function CourseMaster() {
  const user = useAuthenticatedUser();
  const [courseTypes] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.courseTypes, defaultCourseTypes).map(
      (type) => type.name,
    ),
  );
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
      courses.filter((course) =>
        isWorkflowOwner(course.owner, course.ownerCompany, user?.roleCode, userCompanyCode),
      ),
    [courses, user?.roleCode, userCompanyCode],
  );
  const selectedCourse = scopedCourses.find((course) => course.id === selectedCourseId) ?? null;
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
    const currentSequence = currentCode.match(/(\d+)$/)?.[1];
    const preferredCode = currentSequence
      ? `${groupId}-${currentSequence.padStart(3, "0")}`
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
        new RegExp(`^${groupId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`, "i"),
      );
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);

    return `${groupId}-${String(highestSequence + 1).padStart(3, "0")}`;
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
    setIsEditing(true);
    setIsNewOpen(true);
  };

  const handleEdit = () => {
    if (!selectedCourse) {
      return;
    }

    setAssessmentOptions(readPublishedAssessmentOptions());
    setEvaluationOptions(readPublishedEvaluationOptions());
    setForm(buildCourseForm(selectedCourse));
    setIsEditing(true);
    setIsNewOpen(false);
    setOpenDetailCourseId(selectedCourse.id);
  };

  const handleDelete = () => {
    if (!selectedCourseId) {
      return;
    }

    saveCourses(courses.filter((course) => course.id !== selectedCourseId));
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setIsEditing(false);
    setIsNewOpen(false);
    setForm(emptyCourseForm);
  };

  const handleRefresh = () => {
    setCourses(readWorkflowCollection<CourseRecord>(TRAINING_WORKFLOW_KEYS.courses));
    setAssessmentOptions(readPublishedAssessmentOptions());
    setEvaluationOptions(readPublishedEvaluationOptions());
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setSearch("");
    setIsEditing(false);
    setIsNewOpen(false);
    setForm(emptyCourseForm);
  };

  const handleShowDetails = (course: CourseRecord) => {
    const isSameOpen = openDetailCourseId === course.id && !isEditing;
    setSelectedCourseId(isSameOpen ? "" : course.id);
    setOpenDetailCourseId(isSameOpen ? "" : course.id);
    setIsNewOpen(false);
    setIsEditing(false);
    setForm(buildCourseForm(course));
  };

  const handleClosePanel = () => {
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setIsNewOpen(false);
    setIsEditing(false);
    setForm(emptyCourseForm);
  };

  const handleSave = () => {
    if (!isCourseFormReady) {
      return;
    }

    const nextCourse: CourseRecord = {
      ...form,
      id: selectedCourseId || `course-${Date.now()}`,
      courseCode:
        form.courseCode.trim() ||
        buildCourseCode(form.courseGroup, "", selectedCourseId),
      courseNameTh: form.courseNameTh.trim(),
      courseNameEn: form.courseNameEn.trim(),
      status: "Active",
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: selectedCourse?.owner ?? owner,
      ownerCompany: selectedCourse?.ownerCompany ?? ownerCompany,
      createdBy:
        selectedCourse?.createdBy ??
        profileValue(user?.displayName ?? user?.username),
    };

    const nextCourses =
      selectedCourseId
        ? courses.map((course) => (course.id === selectedCourseId ? nextCourse : course))
        : [nextCourse, ...courses];
    saveCourses(nextCourses);
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setForm(emptyCourseForm);
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
          <span className={styles.fieldLabel}>Course Group <b>*</b></span>
          <select value={form.courseGroup} disabled={!isEditing} onChange={(event) => handleCourseGroupChange(event.target.value)}>
            <option value="">Select Course Group</option>
            {courseGroups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
          <small className={styles.fieldHint}>Controls course classification and the generated course code.</small>
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
                [{assessment.code}] {assessment.name}
              </option>
            ))}
          </select>
          <small className={styles.catalogHint}>
            {selectedPreTest
              ? `${selectedPreTest.questionCount} questions · Linked course: ${selectedPreTest.courseName}`
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
          <small className={styles.catalogHint}>
            {selectedPostTest
              ? `${selectedPostTest.questionCount} questions · Linked course: ${selectedPostTest.courseName}`
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

      {isEditing ? (
        <div className={styles.formActions}>
          <button
            className={styles.primaryButton}
            disabled={!isCourseFormReady}
            type="button"
            onClick={handleSave}
          >
            Save course
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
        <button className={styles.secondaryButton} type="button" onClick={handleEdit} disabled={!selectedCourse}>
          Edit
        </button>
        <button className={styles.dangerButton} type="button" onClick={handleDelete} disabled={!selectedCourse}>
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
                <th>Type</th>
                <th>Group</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((course) => {
                const isOpen = openDetailCourseId === course.id && !isNewOpen;

                return (
                  <Fragment key={course.id}>
                    <tr className={course.id === selectedCourseId ? styles.selectedRow : undefined}>
                      <td>{course.courseCode}</td>
                      <td>
                        <strong>{course.courseNameEn}</strong>
                        <span>{course.courseNameTh}</span>
                      </td>
                      <td>{course.courseType}</td>
                      <td>{course.courseGroup}</td>
                      <td className={styles.actionCell}>
                        <button
                          className={styles.detailButton}
                          type="button"
                          onClick={() => handleShowDetails(course)}
                        >
                          {isOpen && !isEditing ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className={styles.detailRow}>
                        <td colSpan={5}>
                          <div className={styles.inlinePanel}>
                            {renderCoursePanel(
                              isEditing ? "Edit course" : course.courseNameEn,
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
