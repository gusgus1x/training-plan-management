"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import {
  InstructorClientError,
  createInstructor,
  deleteInstructor,
  listInstructors,
  updateInstructor,
} from "../../../../lib/instructors/client";
import type {
  InstructorRecord,
  InstructorStatus,
} from "../../../../lib/instructors/types";
import styles from "./InstructorData.module.css";

export const instructorDataModule = {
  title: "Instructor Data",
  subtitle: "Instructor master",
  description:
    "Maintain the shared instructor catalog used by every company.",
} as const;

type InstructorForm = {
  instructorCode: string;
  firstName: string;
  lastName: string;
  telephone: string;
  email: string;
  education: string;
  organizationName: string;
  status: InstructorStatus;
};

const blankForm = (): InstructorForm => ({
  instructorCode: "",
  firstName: "",
  lastName: "",
  telephone: "",
  email: "",
  education: "",
  organizationName: "",
  status: "ACTIVE",
});

const toForm = (record: InstructorRecord): InstructorForm => ({
  instructorCode: record.instructorCode,
  firstName: record.firstName,
  lastName: record.lastName,
  telephone: record.telephone ?? "",
  email: record.email ?? "",
  education: record.education ?? "",
  organizationName: record.organizationName ?? "",
  status: record.status,
});

const errorText = (error: unknown) =>
  error instanceof InstructorClientError
    ? error.message
    : "Unable to load instructor data. Please try again.";

export default function InstructorData() {
  const user = useAuthenticatedUser();
  const isCenter = user?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<InstructorRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingInstructorId, setEditingInstructorId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<InstructorForm>(blankForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected =
    rows.find((row) => row.instructorId === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.instructorCode,
        row.firstName,
        row.lastName,
        row.telephone,
        row.email,
        row.education,
        row.organizationName,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  const loadRows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = (await listInstructors()).items;
      setRows(items);
      setSelectedId((current) =>
        current && items.some((item) => item.instructorId === current)
          ? current
          : items[0]?.instructorId ?? null,
      );
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    listInstructors()
      .then((result) => {
        if (!current) return;
        setRows(result.items);
        setSelectedId(result.items[0]?.instructorId ?? null);
      })
      .catch((caught: unknown) => {
        if (current) setError(errorText(caught));
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  const startNew = () => {
    if (!isCenter) return;
    setEditingInstructorId(null);
    setForm(blankForm());
    setFormMode("new");
    setError(null);
    setMessage(null);
  };

  const startEdit = () => {
    const instructor = selected;
    if (!isCenter || !instructor) return;
    setEditingInstructorId(instructor.instructorId);
    setForm(toForm(instructor));
    setFormMode("edit");
    setError(null);
    setMessage(null);
  };

  const save = async () => {
    if (!isCenter || isSaving || !formMode) return;
    const savingMode = formMode;
    const targetInstructorId =
      savingMode === "edit" ? editingInstructorId : null;

    if (savingMode === "edit" && !targetInstructorId) {
      setError("Select an Instructor before saving changes.");
      return;
    }
    const normalizedCode = form.instructorCode.trim().toUpperCase();
    if (
      savingMode === "new" &&
      rows.some(
        (item) => item.instructorCode.toUpperCase() === normalizedCode,
      )
    ) {
      setError(
        "Instructor code already exists. This form is in New mode; select the existing row and press Edit.",
      );
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const input = {
        instructorCode: normalizedCode,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        telephone: form.telephone.trim() || null,
        email: form.email.trim() || null,
        education: form.education.trim() || null,
        organizationName: form.organizationName.trim() || null,
        status: form.status,
      };
      const result =
        savingMode === "edit" && targetInstructorId
          ? await updateInstructor(targetInstructorId, input)
          : await createInstructor(input);

      setRows((current) =>
        savingMode === "edit"
          ? current.map((item) =>
              item.instructorId === result.instructor.instructorId
                ? result.instructor
                : item,
            )
          : [...current, result.instructor],
      );

      void listInstructors()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
      setSelectedId(result.instructor.instructorId);
      setEditingInstructorId(null);
      setFormMode(null);
      setForm(blankForm());
      setMessage(
        `${result.instructor.instructorCode} - ${result.instructor.firstName} ${result.instructor.lastName} was saved.`,
      );
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (
      !isCenter ||
      !selected ||
      isSaving ||
      !window.confirm(`Delete ${selected.instructorCode}?`)
    ) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await deleteInstructor(selected.instructorId);
      if (result.outcome === "DEACTIVATED") {
        setRows((current) =>
          current.map((item) =>
            item.instructorId === result.instructor.instructorId
              ? result.instructor
              : item,
          ),
        );
        setMessage(
          `${result.instructor.instructorCode} is in use and was changed to INACTIVE.`,
        );
      } else {
        const nextRows = rows.filter(
          (item) => item.instructorId !== result.instructor.instructorId,
        );
        setRows(nextRows);
        setSelectedId(nextRows[0]?.instructorId ?? null);
        setMessage(`${result.instructor.instructorCode} was deleted.`);
      }
      setEditingInstructorId(null);
      setFormMode(null);
      void listInstructors()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const refresh = () => {
    setEditingInstructorId(null);
    setFormMode(null);
    setForm(blankForm());
    setMessage(null);
    void loadRows();
  };

  const change = <Key extends keyof InstructorForm>(
    field: Key,
    value: InstructorForm[Key],
  ) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <section
      className={styles.moduleWorkspace}
      aria-label="Instructor Data module"
    >
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{instructorDataModule.subtitle}</p>
          <h2>{instructorDataModule.title}</h2>
          <p>{instructorDataModule.description}</p>
        </div>
      </section>

      <section className={styles.panel} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search instructor records"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code, name, contact, organization, or status"
          />
          {isCenter ? (
            <>
              <button
                className={
                  formMode === "new"
                    ? styles.actionButton
                    : styles.secondaryButton
                }
                type="button"
                onClick={startNew}
                disabled={isSaving}
              >
                New
              </button>
              <button
                className={
                  formMode === "edit"
                    ? styles.actionButton
                    : styles.secondaryButton
                }
                disabled={!selected || isSaving}
                type="button"
                onClick={startEdit}
              >
                Edit
              </button>
              <button
                className={styles.deleteButton}
                disabled={!selected || isSaving}
                type="button"
                onClick={() => void remove()}
              >
                Delete
              </button>
            </>
          ) : null}
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={refresh}
            disabled={isLoading || isSaving}
          >
            Refresh
          </button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
      </section>

      {formMode ? (
        <section className={styles.formPanel}>
          <h3>
            {formMode === "new"
              ? "Add Instructor - creates a new record"
              : `Edit Instructor - ${form.instructorCode}`}
          </h3>
          <div className={styles.formGrid}>
            <label>
              Instructor Code
              <input
                value={form.instructorCode}
                maxLength={30}
                onChange={(event) =>
                  change("instructorCode", event.target.value)
                }
              />
            </label>
            <label>
              First Name
              <input
                value={form.firstName}
                maxLength={150}
                onChange={(event) => change("firstName", event.target.value)}
              />
            </label>
            <label>
              Last Name
              <input
                value={form.lastName}
                maxLength={150}
                onChange={(event) => change("lastName", event.target.value)}
              />
            </label>
            <label>
              Telephone
              <input
                value={form.telephone}
                maxLength={30}
                onChange={(event) => change("telephone", event.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(event) => change("email", event.target.value)}
              />
            </label>
            <label>
              Organization
              <input
                value={form.organizationName}
                maxLength={255}
                onChange={(event) =>
                  change("organizationName", event.target.value)
                }
              />
            </label>
            <label>
              Education
              <input
                value={form.education}
                maxLength={500}
                onChange={(event) => change("education", event.target.value)}
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  change("status", event.target.value as InstructorStatus)
                }
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
            <div className={styles.fullWidth}>
              <button
                className={styles.actionButton}
                type="button"
                onClick={() => void save()}
                disabled={isSaving}
              >
                {isSaving
                  ? formMode === "new"
                    ? "Creating..."
                    : "Saving..."
                  : formMode === "new"
                    ? "Create"
                    : "Save Changes"}
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => {
                  setEditingInstructorId(null);
                  setFormMode(null);
                }}
                disabled={isSaving}
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
                <th>Code</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Telephone</th>
                <th>Email</th>
                <th>Education</th>
                <th>Organization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody translate="no">
              {visibleRows.map((row, index) => (
                <tr
                  className={
                    row.instructorId === selectedId
                      ? styles.selectedRow
                      : undefined
                  }
                  key={row.instructorId}
                  onClick={() => setSelectedId(row.instructorId)}
                >
                  <td>{index + 1}</td>
                  <td>{row.instructorCode}</td>
                  <td>{row.firstName}</td>
                  <td>{row.lastName}</td>
                  <td>{row.telephone ?? "-"}</td>
                  <td>{row.email ?? "-"}</td>
                  <td>{row.education ?? "-"}</td>
                  <td>{row.organizationName ?? "-"}</td>
                  <td>
                    <span className={styles.statusPill}>{row.status}</span>
                  </td>
                </tr>
              ))}
              {!isLoading && visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={9}>No instructor data found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
