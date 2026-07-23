"use client";

import { useState } from "react";
import styles from "./InstructorData.module.css";

export const instructorDataModule = {
  title: "Instructor Data",
  subtitle: "Instructor master",
  description: "Maintain instructor contact and education records for training courses.",
} as const;

type InstructorRecord = {
  id: string;
  firstName: string;
  lastName: string;
  telephone: string;
  education: string;
  logDate: string;
};

const initialRows: InstructorRecord[] = [
  {
    id: "instructor-001",
    firstName: "Somchai",
    lastName: "Prasert",
    telephone: "081-234-5678",
    education: "M.B.A. Human Resource Management",
    logDate: "2026-07-01",
  },
  {
    id: "instructor-002",
    firstName: "Naree",
    lastName: "Suwan",
    telephone: "089-455-1200",
    education: "B.Sc. Occupational Health and Safety",
    logDate: "2026-07-08",
  },
  {
    id: "instructor-003",
    firstName: "Kittipong",
    lastName: "Maneerat",
    telephone: "086-220-4577",
    education: "M.Eng. Industrial Engineering",
    logDate: "2026-07-12",
  },
];

const emptyForm = {
  firstName: "",
  lastName: "",
  telephone: "",
  education: "",
};

export default function InstructorData() {
  const [rows, setRows] = useState<InstructorRecord[]>(initialRows);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialRows[0]?.id ?? "");
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [formValues, setFormValues] = useState(emptyForm);

  const selectedRecord = rows.find((row) => row.id === selectedId) ?? null;
  const visibleRows = rows.filter((row) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      [row.firstName, row.lastName, row.telephone, row.education, row.logDate]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  });

  const handleFormChange = (field: keyof typeof emptyForm, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const handleAddRecord = () => {
    const nextRow: InstructorRecord = {
      id: formMode === "edit" && selectedRecord ? selectedRecord.id : `instructor-${Date.now()}`,
      firstName: formValues.firstName.trim() || "New",
      lastName: formValues.lastName.trim() || "Instructor",
      telephone: formValues.telephone.trim() || "-",
      education: formValues.education.trim() || "-",
      logDate:
        formMode === "edit" && selectedRecord
          ? selectedRecord.logDate
          : new Date().toISOString().slice(0, 10),
    };

    setRows((current) =>
      formMode === "edit"
        ? current.map((row) => (row.id === nextRow.id ? nextRow : row))
        : [nextRow, ...current],
    );
    setSelectedId(nextRow.id);
    setFormValues(emptyForm);
    setFormMode(null);
  };

  const handleNew = () => {
    setFormValues(emptyForm);
    setFormMode("new");
  };

  const handleEdit = () => {
    if (!selectedRecord) {
      return;
    }

    setFormValues({
      firstName: selectedRecord.firstName,
      lastName: selectedRecord.lastName,
      telephone: selectedRecord.telephone,
      education: selectedRecord.education,
    });
    setFormMode("edit");
  };

  const handleDelete = () => {
    if (!selectedRecord) {
      return;
    }

    setRows((current) => current.filter((row) => row.id !== selectedRecord.id));
    setSelectedId("");
    setFormMode(null);
  };

  const handleRefresh = () => {
    setRows(initialRows);
    setSearch("");
    setSelectedId(initialRows[0]?.id ?? "");
    setFormMode(null);
    setFormValues(emptyForm);
  };

  return (
    <section className={styles.moduleWorkspace} aria-label="Instructor Data module">
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{instructorDataModule.subtitle}</p>
          <h2>{instructorDataModule.title}</h2>
          <p>{instructorDataModule.description}</p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search instructor records"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search first name, last name, telephone, education"
          />
          <button className={styles.actionButton} type="button" onClick={handleNew}>
            New
          </button>
          <button
            className={styles.secondaryButton}
            disabled={!selectedRecord}
            type="button"
            onClick={handleEdit}
          >
            Edit
          </button>
          <button
            className={styles.deleteButton}
            disabled={!selectedRecord}
            type="button"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
            Refresh
          </button>
        </div>
      </section>

      {formMode ? (
      <section className={styles.formPanel}>
        <h3>{formMode === "new" ? "Add instructor" : "Edit instructor"}</h3>
        <p>
          {formMode === "new"
            ? "Log Date is recorded automatically when a new instructor is added."
            : "Log Date is kept from the selected instructor record."}
        </p>
        <div className={styles.formGrid}>
          <label>
            First Name
            <input
              value={formValues.firstName}
              onChange={(event) => handleFormChange("firstName", event.target.value)}
              placeholder="First name"
            />
          </label>
          <label>
            Last Name
            <input
              value={formValues.lastName}
              onChange={(event) => handleFormChange("lastName", event.target.value)}
              placeholder="Last name"
            />
          </label>
          <label>
            Telephone
            <input
              value={formValues.telephone}
              onChange={(event) => handleFormChange("telephone", event.target.value)}
              placeholder="Telephone"
            />
          </label>
          <label>
            Education
            <input
              value={formValues.education}
              onChange={(event) => handleFormChange("education", event.target.value)}
              placeholder="Education"
            />
          </label>
          <div className={styles.fullWidth}>
            <button className={styles.actionButton} type="button" onClick={handleAddRecord}>
              {formMode === "new" ? "Add instructor" : "Save changes"}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                setFormMode(null);
                setFormValues(emptyForm);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
      ) : null}

      <section className={styles.panel}>
        <h3>Instructor Records</h3>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>No.</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Telephone</th>
                <th>Education</th>
                <th>Log Date</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr
                  className={row.id === selectedId ? styles.selectedRow : undefined}
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                >
                  <td>{index + 1}</td>
                  <td>{row.firstName}</td>
                  <td>{row.lastName}</td>
                  <td>{row.telephone}</td>
                  <td>{row.education}</td>
                  <td>{row.logDate}</td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>No instructor data found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
