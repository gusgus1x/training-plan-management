"use client";

import { useMemo, useState } from "react";
import {
  TRAINING_WORKFLOW_KEYS,
  isWorkflowOwner,
  readWorkflowCollection,
  writeWorkflowCollection,
  type WorkflowCourse,
  type WorkflowStandard,
} from "../../../../lib/trainingWorkflow";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { defaultFunctionRows } from "../../MasterDataManagement/modules/FunctionData";
import styles from "./CourseStandard.module.css";

export const courseStandardModule = {
  title: "Course Standard",
  subtitle: "Course standard matrix",
  description: "Define required training by course, function, position, and employee level.",
} as const;

type CourseMasterOption = {
  id: string;
  code: string;
  name: string;
};

type CourseStandardRecord = WorkflowStandard;

const allFunctionOption = "All Function";
const functionOptions = [
  allFunctionOption,
  ...defaultFunctionRows.map((row) => row.functionNameEn || row.functionNameTh),
];

const positionColumns = ["Manager", "SH", "Engineer", "Office", "Staff", "Foreman", "Leader", "Operator"] as const;
const positionChecklist = ["Manager Up", "SH", "Engineer", "Office", "Staff", "Force man", "Leader", "Operator"] as const;
const levelColumns = ["M3", "M2", "M1", "S4", "S3", "S2", "S1", "O5", "O4", "O3", "O2", "O1"] as const;

const normalizePosition = (position: string) => {
  if (position === "Manager Up") {
    return "Manager";
  }

  if (position === "Force man") {
    return "Foreman";
  }

  return position;
};

export default function CourseStandard() {
  const user = useAuthenticatedUser();
  const [courses, setCourses] = useState<WorkflowCourse[]>(() =>
    readWorkflowCollection<WorkflowCourse>(TRAINING_WORKFLOW_KEYS.courses),
  );
  const [standards, setStandards] = useState<CourseStandardRecord[]>(() =>
    readWorkflowCollection<CourseStandardRecord>(TRAINING_WORKFLOW_KEYS.standards),
  );
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [functionName, setFunctionName] = useState(allFunctionOption);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const userCompanyCode = profileValue(user?.companyCode);
  const scopedCourses = useMemo(
    () =>
      courses.filter(
        (course) =>
          isWorkflowOwner(course.owner, course.ownerCompany, user?.roleCode, userCompanyCode),
      ),
    [courses, user?.roleCode, userCompanyCode],
  );
  const courseMasterOptions: CourseMasterOption[] = useMemo(
    () =>
      scopedCourses.map((course) => ({
        id: course.id,
        code: course.courseCode,
        name: course.courseNameEn,
      })),
    [scopedCourses],
  );
  const scopedStandards = useMemo(
    () =>
      standards.filter((standard) =>
        isWorkflowOwner(standard.owner, standard.ownerCompany, user?.roleCode, userCompanyCode),
      ),
    [standards, user?.roleCode, userCompanyCode],
  );
  const selectedCourse =
    courseMasterOptions.find((course) => course.code === courseCode) ?? courseMasterOptions[0] ?? null;
  const selectedStandard = scopedStandards.find((standard) => standard.id === selectedId) ?? null;
  const visibleStandards = useMemo(
    () =>
      scopedStandards.filter((standard) =>
        [standard.courseCode, standard.courseName, standard.functionName]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [scopedStandards, search],
  );

  const saveStandards = (nextStandards: CourseStandardRecord[]) => {
    setStandards(nextStandards);
    writeWorkflowCollection(TRAINING_WORKFLOW_KEYS.standards, nextStandards);
  };

  const toggleItem = (value: string, selectedValues: string[], setSelectedValues: (next: string[]) => void) => {
    setSelectedValues(
      selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value],
    );
  };

  const handleNew = () => {
    setIsNewOpen(true);
    setEditingId("");
    setCourseCode(courseMasterOptions[0]?.code ?? "");
    setFunctionName(allFunctionOption);
    setSelectedPositions([]);
    setSelectedLevels([]);
  };

  const handleEdit = () => {
    if (!selectedStandard) {
      return;
    }

    setIsNewOpen(true);
    setEditingId(selectedStandard.id);
    setCourseCode(selectedStandard.courseCode);
    setFunctionName(selectedStandard.functionName);
    setSelectedPositions(selectedStandard.positions);
    setSelectedLevels(selectedStandard.levels);
  };

  const handleSave = () => {
    if (!selectedCourse || !functionName.trim()) {
      return;
    }

    const nextRecord: CourseStandardRecord = {
      id: editingId || `standard-${Date.now()}`,
      courseId: selectedCourse.id,
      courseCode: selectedCourse.code,
      courseName: selectedCourse.name,
      functionName: functionName.trim(),
      positions: selectedPositions.map(normalizePosition),
      levels: selectedLevels,
      owner: scopedCourses.find((course) => course.id === selectedCourse.id)?.owner ?? "FACTORY",
      ownerCompany:
        scopedCourses.find((course) => course.id === selectedCourse.id)?.ownerCompany ??
        userCompanyCode,
    };

    const nextStandards =
      editingId
        ? standards.map((standard) => (standard.id === editingId ? nextRecord : standard))
        : [nextRecord, ...standards];
    saveStandards(nextStandards);
    setSelectedId(nextRecord.id);
    setIsNewOpen(false);
    setEditingId("");
  };

  const handleDelete = () => {
    if (!selectedStandard) {
      return;
    }

    saveStandards(standards.filter((standard) => standard.id !== selectedStandard.id));
    setSelectedId("");
    if (editingId === selectedStandard.id) {
      setIsNewOpen(false);
      setEditingId("");
    }
  };

  const handleRefresh = () => {
    setCourses(readWorkflowCollection<WorkflowCourse>(TRAINING_WORKFLOW_KEYS.courses));
    setStandards(
      readWorkflowCollection<CourseStandardRecord>(TRAINING_WORKFLOW_KEYS.standards),
    );
    setSearch("");
    setIsNewOpen(false);
    setEditingId("");
    setSelectedId("");
  };

  return (
    <section className={styles.page} aria-label="Course Standard management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{courseStandardModule.subtitle}</p>
          <h2>{courseStandardModule.title}</h2>
          <p>{courseStandardModule.description}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <span className={styles.listMeta}>{visibleStandards.length} / {scopedStandards.length} standards</span>
          <input
            aria-label="Search course standard"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search course code, course name, function"
          />
          <button className={styles.primaryButton} disabled={courseMasterOptions.length === 0} type="button" onClick={handleNew}>
            New
          </button>
          <button
            className={styles.secondaryButton}
            disabled={!selectedStandard}
            type="button"
            onClick={handleEdit}
          >
            Edit
          </button>
          <button
            className={styles.dangerButton}
            disabled={!selectedStandard}
            type="button"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
            Refresh
          </button>
        </div>

        {isNewOpen ? (
          <section className={styles.formPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>{editingId ? "Edit standard" : "New standard"}</p>
                <h3>{editingId ? "Update course standard" : "Create course standard"}</h3>
              </div>
              <button
                className={styles.closeButton}
                type="button"
                onClick={() => {
                  setIsNewOpen(false);
                  setEditingId("");
                }}
              >
                Close
              </button>
            </div>

            <div className={styles.formGrid}>
              <label>
                Course Name
                <select value={courseCode} onChange={(event) => setCourseCode(event.target.value)}>
                  {courseMasterOptions.length === 0 ? (
                    <option value="">Create an active Course Master first</option>
                  ) : null}
                  {courseMasterOptions.map((course) => (
                    <option key={course.code} value={course.code}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Function Name
                <select
                  value={functionName}
                  onChange={(event) => setFunctionName(event.target.value)}
                >
                  {functionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.checkSection}>
              <div>
                <h4>Check List Position</h4>
                <div className={styles.checkGrid}>
                  {positionChecklist.map((position) => (
                    <label className={styles.checkItem} key={position}>
                      <input
                        checked={selectedPositions.includes(position)}
                        type="checkbox"
                        onChange={() => toggleItem(position, selectedPositions, setSelectedPositions)}
                      />
                      <span>{position}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4>Check List Level</h4>
                <div className={styles.levelGrid}>
                  {levelColumns.map((level) => (
                    <label className={styles.checkItem} key={level}>
                      <input
                        checked={selectedLevels.includes(level)}
                        type="checkbox"
                        onChange={() => toggleItem(level, selectedLevels, setSelectedLevels)}
                      />
                      <span>{level}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="button" onClick={handleSave}>
                {editingId ? "Save changes" : "Save standard"}
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => {
                  setIsNewOpen(false);
                  setEditingId("");
                }}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.standardTable}>
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Function Name</th>
                {positionColumns.map((position) => (
                  <th key={position}>{position}</th>
                ))}
                {levelColumns.map((level) => (
                  <th key={level}>{level}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStandards.map((standard) => (
                <tr
                  className={standard.id === selectedId ? styles.selectedRow : undefined}
                  key={standard.id}
                  onClick={() => setSelectedId(standard.id)}
                >
                  <td>{standard.courseCode}</td>
                  <td>{standard.courseName}</td>
                  <td>{standard.functionName}</td>
                  {positionColumns.map((position) => (
                    <td className={styles.centerCell} key={position}>
                      {standard.positions.includes(position) ? <span className={styles.checkMark}>Y</span> : ""}
                    </td>
                  ))}
                  {levelColumns.map((level) => (
                    <td className={styles.centerCell} key={level}>
                      {standard.levels.includes(level) ? <span className={styles.checkMark}>Y</span> : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
