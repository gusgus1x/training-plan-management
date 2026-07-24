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
  preTest: string;
  postTest: string;
  evaluation: string;
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
  preTest: "",
  postTest: "",
  evaluation: "",
  evaluationAfter30Day: "",
  lifeCycleMonth: "12",
  remark: "",
  status: "Draft",
  courseType: defaultCourseTypes[0]?.name ?? "",
  courseGroup: defaultCourseGroups[0]?.name ?? "",
};

const statuses: CourseStatus[] = ["Active", "Draft", "Inactive"];

export default function CourseMaster() {
  const user = useAuthenticatedUser();
  const [courseTypes] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.courseTypes, defaultCourseTypes).map(
      (type) => type.name,
    ),
  );
  const [courseGroups] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.courseGroups, defaultCourseGroups).map(
      (group) => group.name,
    ),
  );
  const [courses, setCourses] = useState<CourseRecord[]>(() =>
    readWorkflowCollection<CourseRecord>(TRAINING_WORKFLOW_KEYS.courses),
  );
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [form, setForm] = useState<CourseForm>(emptyCourseForm);
  const [isEditing, setIsEditing] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [openDetailCourseId, setOpenDetailCourseId] = useState("");
  const [search, setSearch] = useState("");

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
          course.status,
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

  const updateForm = (field: keyof CourseForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleNew = () => {
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

    setForm(selectedCourse);
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
    setForm(course);
  };

  const handleClosePanel = () => {
    setSelectedCourseId("");
    setOpenDetailCourseId("");
    setIsNewOpen(false);
    setIsEditing(false);
    setForm(emptyCourseForm);
  };

  const handleSave = () => {
    const nextCourse: CourseRecord = {
      ...form,
      id: selectedCourseId || `course-${Date.now()}`,
      courseCode: form.courseCode.trim() || `CRS-${String(courses.length + 1).padStart(3, "0")}`,
      courseNameTh: form.courseNameTh.trim() || "New Course TH",
      courseNameEn: form.courseNameEn.trim() || "New Course",
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

  const renderCoursePanel = (title: string, stateLabel: string) => (
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
          Course Code
          <input value={form.courseCode} disabled={!isEditing} onChange={(event) => updateForm("courseCode", event.target.value)} />
        </label>
        <label>
          Course Name (TH)
          <input value={form.courseNameTh} disabled={!isEditing} onChange={(event) => updateForm("courseNameTh", event.target.value)} />
        </label>
        <label>
          Course Name (EN)
          <input value={form.courseNameEn} disabled={!isEditing} onChange={(event) => updateForm("courseNameEn", event.target.value)} />
        </label>
        <label>
          Status
          <select value={form.status} disabled={!isEditing} onChange={(event) => updateForm("status", event.target.value)}>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Course Type
          <select value={form.courseType} disabled={!isEditing} onChange={(event) => updateForm("courseType", event.target.value)}>
            {courseTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Course Group
          <select value={form.courseGroup} disabled={!isEditing} onChange={(event) => updateForm("courseGroup", event.target.value)}>
            {courseGroups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </label>
        <label>
          Life Cycle (Month)
          <input value={form.lifeCycleMonth} disabled={!isEditing} inputMode="numeric" onChange={(event) => updateForm("lifeCycleMonth", event.target.value)} />
        </label>
        <label className={styles.fullWidth}>
          Objective
          <textarea value={form.objective} disabled={!isEditing} onChange={(event) => updateForm("objective", event.target.value)} />
        </label>
        <label className={styles.fullWidth}>
          Learning Content
          <textarea value={form.learningContent} disabled={!isEditing} onChange={(event) => updateForm("learningContent", event.target.value)} />
        </label>
        <label>
          Target Group
          <textarea value={form.targetGroup} disabled={!isEditing} onChange={(event) => updateForm("targetGroup", event.target.value)} />
        </label>
        <label>
          Methodology
          <textarea value={form.methodology} disabled={!isEditing} onChange={(event) => updateForm("methodology", event.target.value)} />
        </label>
        <label>
          Pre test
          <input value={form.preTest} disabled={!isEditing} onChange={(event) => updateForm("preTest", event.target.value)} />
        </label>
        <label>
          Post test
          <input value={form.postTest} disabled={!isEditing} onChange={(event) => updateForm("postTest", event.target.value)} />
        </label>
        <label>
          Evaluation
          <input value={form.evaluation} disabled={!isEditing} onChange={(event) => updateForm("evaluation", event.target.value)} />
        </label>
        <label>
          Evaluation After 30 Day
          <input value={form.evaluationAfter30Day} disabled={!isEditing} onChange={(event) => updateForm("evaluationAfter30Day", event.target.value)} />
        </label>
        <label className={styles.fullWidth}>
          Remark
          <textarea value={form.remark} disabled={!isEditing} onChange={(event) => updateForm("remark", event.target.value)} />
        </label>
      </div>

      {isEditing ? (
        <div className={styles.formActions}>
          <button className={styles.primaryButton} type="button" onClick={handleSave}>
            Save course
          </button>
          <button className={styles.secondaryButton} type="button" onClick={handleClosePanel}>
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  );

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
                <th>Status</th>
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
                      <td>
                        <span className={styles.statusPill}>{course.status}</span>
                      </td>
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
                        <td colSpan={6}>
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
