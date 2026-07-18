"use client";

import { useMemo, useState } from "react";
import styles from "./CourseType.module.css";

export const courseTypeModule = {
  title: "Course Type",
  subtitle: "Course category",
  description: "Maintain course type master data for Course Master and training planning.",
} as const;

type CourseTypeRecord = {
  id: string;
  name: string;
};

const initialCourseTypes: CourseTypeRecord[] = [
  { id: "type-001", name: "ATA-TC" },
  { id: "type-002", name: "IN-HOUSE" },
  { id: "type-003", name: "PUBLIC" },
  { id: "type-004", name: "OJT" },
];

export default function CourseType() {
  const [courseTypes, setCourseTypes] = useState<CourseTypeRecord[]>(initialCourseTypes);
  const [selectedId, setSelectedId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [mode, setMode] = useState<"idle" | "new" | "edit">("idle");
  const [exportMessage, setExportMessage] = useState("");

  const selectedCourseType = useMemo(
    () => courseTypes.find((courseType) => courseType.id === selectedId) ?? null,
    [courseTypes, selectedId],
  );

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

    setCourseTypes((current) => current.filter((courseType) => courseType.id !== selectedId));
    setSelectedId("");
    setDraftName("");
    setMode("idle");
    setExportMessage("");
  };

  const handleRefresh = () => {
    setCourseTypes(initialCourseTypes);
    setSelectedId("");
    setDraftName("");
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
      setCourseTypes((current) =>
        current.map((courseType) =>
          courseType.id === selectedId ? { ...courseType, name: nextName } : courseType,
        ),
      );
      setMode("idle");
      setDraftName("");
      return;
    }

    const nextRecord: CourseTypeRecord = {
      id: `type-${Date.now()}`,
      name: nextName,
    };
    setCourseTypes((current) => [...current, nextRecord]);
    setSelectedId(nextRecord.id);
    setMode("idle");
    setDraftName("");
  };

  return (
    <section className={styles.page} aria-label="Course Type management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{courseTypeModule.subtitle}</p>
          <h2>{courseTypeModule.title}</h2>
          <p>{courseTypeModule.description}</p>
        </div>
        <div className={styles.summaryCard}>
          <span>Total</span>
          <strong>{courseTypes.length}</strong>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar} aria-label="Course type actions">
          <button className={styles.newButton} type="button" onClick={handleNew}>
            New
          </button>
          <button className={styles.editButton} type="button" onClick={handleEdit} disabled={!selectedCourseType}>
            Edit
          </button>
          <button className={styles.deleteButton} type="button" onClick={handleDelete} disabled={!selectedCourseType}>
            Delete
          </button>
          <button className={styles.refreshButton} type="button" onClick={handleRefresh}>
            Refresh
          </button>
          <button className={styles.exportButton} type="button" onClick={handleExport}>
            Export
          </button>
        </div>

        {mode !== "idle" ? (
          <div className={styles.editor}>
            <label>
              Course Type
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Enter course type"
              />
            </label>
            <button className={styles.saveButton} type="button" onClick={handleSave}>
              Save
            </button>
            <button className={styles.cancelButton} type="button" onClick={() => setMode("idle")}>
              Cancel
            </button>
          </div>
        ) : null}

        {exportMessage ? <p className={styles.exportMessage}>{exportMessage}</p> : null}

        <div className={styles.tableWrap}>
          <table className={styles.courseTypeTable}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Course Type</th>
              </tr>
            </thead>
            <tbody>
              {courseTypes.map((courseType, index) => (
                <tr
                  className={courseType.id === selectedId ? styles.selectedRow : undefined}
                  key={courseType.id}
                  onClick={() => {
                    setSelectedId(courseType.id);
                    setExportMessage("");
                  }}
                >
                  <td>{index + 1}</td>
                  <td>{courseType.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
