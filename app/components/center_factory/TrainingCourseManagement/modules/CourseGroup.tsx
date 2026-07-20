"use client";

import { useMemo, useState } from "react";
import styles from "./CourseGroup.module.css";

export const courseGroupModule = {
  title: "Course Group",
  subtitle: "Course group",
  description: "Maintain course group master data for course classification and reporting.",
} as const;

type CourseGroupRecord = {
  id: string;
  name: string;
  groupId: string;
};

const initialCourseGroups: CourseGroupRecord[] = [
  { id: "group-001", name: "Quality", groupId: "QT" },
  { id: "group-002", name: "Safety", groupId: "ST" },
  { id: "group-003", name: "Casting", groupId: "CT" },
  { id: "group-004", name: "Management", groupId: "MG" },
  { id: "group-005", name: "Die Quenching", groupId: "DQ" },
  { id: "group-006", name: "Promotion", groupId: "PT" },
  { id: "group-007", name: "Maintenance", groupId: "MT" },
  { id: "group-008", name: "Production", groupId: "PD" },
  { id: "group-009", name: "AL Prod.", groupId: "AL" },
  { id: "group-010", name: "System", groupId: "SY" },
  { id: "group-011", name: "Machining", groupId: "MC" },
  { id: "group-012", name: "Special", groupId: "SP" },
  { id: "group-013", name: "Cost", groupId: "CO" },
  { id: "group-014", name: "Moral", groupId: "MR" },
  { id: "group-015", name: "Other", groupId: "OT" },
];

export default function CourseGroup() {
  const [courseGroups, setCourseGroups] = useState<CourseGroupRecord[]>(initialCourseGroups);
  const [selectedId, setSelectedId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftGroupId, setDraftGroupId] = useState("");
  const [mode, setMode] = useState<"idle" | "new" | "edit">("idle");
  const [exportMessage, setExportMessage] = useState("");

  const selectedCourseGroup = useMemo(
    () => courseGroups.find((courseGroup) => courseGroup.id === selectedId) ?? null,
    [courseGroups, selectedId],
  );

  const handleNew = () => {
    setSelectedId("");
    setDraftName("");
    setDraftGroupId("");
    setMode("new");
    setExportMessage("");
  };

  const handleEdit = () => {
    if (!selectedCourseGroup) {
      return;
    }

    setDraftName(selectedCourseGroup.name);
    setDraftGroupId(selectedCourseGroup.groupId);
    setMode("edit");
    setExportMessage("");
  };

  const handleDelete = () => {
    if (!selectedId) {
      return;
    }

    setCourseGroups((current) => current.filter((courseGroup) => courseGroup.id !== selectedId));
    setSelectedId("");
    setDraftName("");
    setDraftGroupId("");
    setMode("idle");
    setExportMessage("");
  };

  const handleRefresh = () => {
    setCourseGroups(initialCourseGroups);
    setSelectedId("");
    setDraftName("");
    setDraftGroupId("");
    setMode("idle");
    setExportMessage("");
  };

  const handleExport = () => {
    setExportMessage(`Export ready: ${courseGroups.length} course groups`);
  };

  const handleSave = () => {
    const nextName = draftName.trim();
    const nextGroupId = draftGroupId.trim().toUpperCase();
    if (!nextName) {
      return;
    }

    if (mode === "edit" && selectedId) {
      setCourseGroups((current) =>
        current.map((courseGroup) =>
          courseGroup.id === selectedId ? { ...courseGroup, name: nextName, groupId: nextGroupId } : courseGroup,
        ),
      );
      setMode("idle");
      setDraftName("");
      setDraftGroupId("");
      return;
    }

    const nextRecord: CourseGroupRecord = {
      id: `group-${Date.now()}`,
      name: nextName,
      groupId: nextGroupId,
    };
    setCourseGroups((current) => [...current, nextRecord]);
    setSelectedId(nextRecord.id);
    setMode("idle");
    setDraftName("");
    setDraftGroupId("");
  };

  return (
    <section className={styles.page} aria-label="Course Group management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{courseGroupModule.subtitle}</p>
          <h2>{courseGroupModule.title}</h2>
          <p>{courseGroupModule.description}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar} aria-label="Course group actions">
          <span className={styles.listMeta}>{courseGroups.length} groups</span>
          <button className={styles.newButton} type="button" onClick={handleNew}>
            New
          </button>
          <button className={styles.editButton} type="button" onClick={handleEdit} disabled={!selectedCourseGroup}>
            Edit
          </button>
          <button className={styles.deleteButton} type="button" onClick={handleDelete} disabled={!selectedCourseGroup}>
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
              Course Group
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Enter course group"
              />
            </label>
            <label>
              Group ID
              <input
                maxLength={4}
                value={draftGroupId}
                onChange={(event) => setDraftGroupId(event.target.value.toUpperCase())}
                placeholder="QT"
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
          <table className={styles.courseGroupTable}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Course Group</th>
                <th>Group ID</th>
              </tr>
            </thead>
            <tbody>
              {courseGroups.map((courseGroup, index) => (
                <tr
                  className={courseGroup.id === selectedId ? styles.selectedRow : undefined}
                  key={courseGroup.id}
                  onClick={() => {
                    setSelectedId(courseGroup.id);
                    setExportMessage("");
                  }}
                >
                  <td>{index + 1}</td>
                  <td>{courseGroup.name}</td>
                  <td>{courseGroup.groupId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
