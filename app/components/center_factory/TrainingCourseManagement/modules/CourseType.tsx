"use client";

import { useMemo, useState } from "react";
import {
  TRAINING_MASTER_KEYS,
  readMasterCollection,
  writeMasterCollection,
} from "../../../../lib/trainingWorkflow";
import styles from "./CourseType.module.css";

export const courseTypeModule = {
  title: "Course Type",
  subtitle: "Course category",
  description: "Maintain course type master data for Course Master and training planning.",
} as const;

export type CourseTypeRecord = {
  id: string;
  name: string;
};

export const defaultCourseTypes: CourseTypeRecord[] = [
  { id: "type-001", name: "ATA-TC" },
  { id: "type-002", name: "IN-HOUSE" },
  { id: "type-003", name: "PUBLIC" },
  { id: "type-004", name: "OJT" },
];

export default function CourseType() {
  const [courseTypes, setCourseTypes] = useState<CourseTypeRecord[]>(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.courseTypes, defaultCourseTypes),
  );
  const [selectedId, setSelectedId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "new" | "edit">("idle");
  const [exportMessage, setExportMessage] = useState("");

  const selectedCourseType = useMemo(
    () => courseTypes.find((courseType) => courseType.id === selectedId) ?? null,
    [courseTypes, selectedId],
  );

  const filteredCourseTypes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return courseTypes;
    }

    return courseTypes.filter((courseType) => courseType.name.toLowerCase().includes(normalizedQuery));
  }, [courseTypes, query]);

  const handleNew = () => {
    setSelectedId("");
    setDraftName("");
    setMode("new");
    setExportMessage("");
  };

  const handleEdit = () => {
    if (!selectedCourseType) {
      return;
    }

    setDraftName(selectedCourseType.name);
    setMode("edit");
    setExportMessage("");
  };

  const handleDelete = () => {
    if (!selectedId) {
      return;
    }

    const nextCourseTypes = courseTypes.filter(
      (courseType) => courseType.id !== selectedId,
    );
    setCourseTypes(nextCourseTypes);
    writeMasterCollection(TRAINING_MASTER_KEYS.courseTypes, nextCourseTypes);
    setSelectedId("");
    setDraftName("");
    setMode("idle");
    setExportMessage("");
  };

  const handleRefresh = () => {
    setCourseTypes(
      readMasterCollection(TRAINING_MASTER_KEYS.courseTypes, defaultCourseTypes),
    );
    setSelectedId("");
    setDraftName("");
    setQuery("");
    setMode("idle");
    setExportMessage("");
  };

  const handleExport = () => {
    setExportMessage(`Export ready: ${courseTypes.length} course types`);
  };

  const handleSave = () => {
    const nextName = draftName.trim().toUpperCase();
    if (!nextName) {
      return;
    }

    if (mode === "edit" && selectedId) {
      const nextCourseTypes = courseTypes.map((courseType) =>
        courseType.id === selectedId ? { ...courseType, name: nextName } : courseType,
      );
      setCourseTypes(nextCourseTypes);
      writeMasterCollection(TRAINING_MASTER_KEYS.courseTypes, nextCourseTypes);
      setMode("idle");
      setDraftName("");
      return;
    }

    const nextRecord: CourseTypeRecord = {
      id: `type-${Date.now()}`,
      name: nextName,
    };
    const nextCourseTypes = [...courseTypes, nextRecord];
    setCourseTypes(nextCourseTypes);
    writeMasterCollection(TRAINING_MASTER_KEYS.courseTypes, nextCourseTypes);
    setSelectedId(nextRecord.id);
    setMode("idle");
    setDraftName("");
  };

  return (
    <section className={styles.page} aria-label="Course Type management">
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>{courseTypeModule.subtitle}</p>
          <h2>{courseTypeModule.title}</h2>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.workspaceHeader}>
          <div>
            <span>Master List</span>
            <h3>Course type library</h3>
          </div>
          <span className={styles.listMeta}>{filteredCourseTypes.length} / {courseTypes.length} types</span>
        </div>

        <div className={styles.toolbar} aria-label="Course type actions">
          <label className={styles.searchBox}>
            <span>Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search course type"
              type="search"
            />
          </label>
          <div className={styles.actionGroup}>
            <button className={styles.primaryButton} type="button" onClick={handleNew}>
              New
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleEdit} disabled={!selectedCourseType}>
              Edit
            </button>
            <button className={styles.dangerButton} type="button" onClick={handleDelete} disabled={!selectedCourseType}>
              Delete
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
              Refresh
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleExport}>
              Export
            </button>
          </div>
        </div>

        {mode !== "idle" ? (
          <div className={styles.editor}>
            <div className={styles.editorHeader}>
              <span>{mode === "edit" ? "Edit record" : "New record"}</span>
              <strong>{mode === "edit" ? selectedCourseType?.name : "Course Type"}</strong>
            </div>
            <label>
              Course Type
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Enter course type"
              />
            </label>
            <div className={styles.formActions}>
              <button className={styles.saveButton} type="button" onClick={handleSave}>
                Save
              </button>
              <button className={styles.cancelButton} type="button" onClick={() => setMode("idle")}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {exportMessage ? <p className={styles.exportMessage}>{exportMessage}</p> : null}

        <div className={styles.contentGrid}>
          <div className={styles.tableWrap}>
            <table className={styles.courseTypeTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Course Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourseTypes.map((courseType, index) => (
                  <tr
                    className={courseType.id === selectedId ? styles.selectedRow : undefined}
                    key={courseType.id}
                    onClick={() => {
                      setSelectedId(courseType.id);
                      setExportMessage("");
                    }}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <strong>{courseType.name}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCourseTypes.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>No course type found</strong>
                <span>Try a different keyword or add a new course type.</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </section>
  );
}
