"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import {
  PositionClientError,
  createPosition,
  deletePosition,
  listPositions,
  updatePosition,
} from "../../../../lib/positions/client";
import type {
  PositionRecord as ApiPositionRecord,
  PositionStatus,
} from "../../../../lib/positions/types";
import styles from "./PositionData.module.css";

export type PositionRecord = {
  id: string;
  positionCode: string;
  positionNameTh: string;
  positionNameEn: string;
  remark: string;
};

export const positionDataModule = {
  title: "Position Data",
  subtitle: "Position master",
  description:
    "Maintain the shared position catalog used by every company.",
} as const;

const mockPositions = [
  ["mgr", "ผู้จัดการ++", "Manager++"],
  ["sh", "ผู้จัดการแผนก", "Section Head"],
  ["eng", "วิศวกร", "Engineer"],
  ["fm", "โฟร์แมน", "Foreman"],
  ["ld", "ลีดเดอร์", "Leader"],
  ["op", "พนักงานปฏิบัติการ", "Operator"],
  ["office", "เจ้าหน้าที่", "Supervisor"],
  ["staff", "พนักงานปฏิบัติการ", "Staff"],
] as const;

// Temporary compatibility export for mock consumers awaiting API migration.
export const defaultPositionRows: PositionRecord[] = mockPositions.map(
  ([positionCode, positionNameTh, positionNameEn]) => ({
    id: `position-${positionCode}`,
    positionCode,
    positionNameTh,
    positionNameEn,
    remark: "",
  }),
);

type PositionForm = {
  positionCode: string;
  positionNameTh: string;
  positionNameEn: string;
  status: PositionStatus;
};

const blankForm = (): PositionForm => ({
  positionCode: "",
  positionNameTh: "",
  positionNameEn: "",
  status: "ACTIVE",
});

const toForm = (record: ApiPositionRecord): PositionForm => ({
  positionCode: record.positionCode,
  positionNameTh: record.positionNameTh,
  positionNameEn: record.positionNameEn ?? "",
  status: record.status,
});

const errorText = (error: unknown) =>
  error instanceof PositionClientError
    ? error.message
    : "Unable to load position data. Please try again.";

export default function PositionData() {
  const user = useAuthenticatedUser();
  const isCenter = user?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<ApiPositionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<PositionForm>(blankForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = rows.find((row) => row.positionId === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.positionCode, row.positionNameTh, row.positionNameEn, row.status]
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
      const items = (await listPositions()).items;
      setRows(items);
      setSelectedId((current) =>
        current && items.some((item) => item.positionId === current)
          ? current
          : items[0]?.positionId ?? null,
      );
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    listPositions()
      .then((result) => {
        if (!current) return;
        setRows(result.items);
        setSelectedId(result.items[0]?.positionId ?? null);
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
    setForm(blankForm());
    setFormMode("new");
    setError(null);
  };

  const startEdit = () => {
    if (!isCenter || !selected) return;
    setForm(toForm(selected));
    setFormMode("edit");
    setError(null);
  };

  const save = async () => {
    if (!isCenter || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const input = {
        positionCode: form.positionCode.trim().toUpperCase(),
        positionNameTh: form.positionNameTh.trim(),
        positionNameEn: form.positionNameEn.trim() || null,
        status: form.status,
      };
      const result =
        formMode === "edit" && selected
          ? await updatePosition(selected.positionId, input)
          : await createPosition(input);
      setRows((current) =>
        formMode === "edit"
          ? current.map((item) =>
              item.positionId === result.position.positionId
                ? result.position
                : item,
            )
          : [...current, result.position],
      );
      setSelectedId(result.position.positionId);
      setFormMode(null);
      setMessage(`${result.position.positionCode} was saved.`);
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
      !window.confirm(`Delete ${selected.positionCode}?`)
    ) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await deletePosition(selected.positionId);
      const nextRows = rows.filter(
        (item) => item.positionId !== result.position.positionId,
      );
      setRows(nextRows);
      setSelectedId(nextRows[0]?.positionId ?? null);
      setFormMode(null);
      setMessage(`${result.position.positionCode} was deleted.`);
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={styles.page} aria-label="Position Data module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{positionDataModule.subtitle}</p>
          <h2>{positionDataModule.title}</h2>
          <p>{positionDataModule.description}</p>
        </div>
        <div className={styles.heroMetric}>
          <strong>{rows.length}</strong>
          <span>Positions</span>
        </div>
      </section>

      <section className={styles.workspace} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search position data"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search position code or name"
          />
          {isCenter ? (
            <>
              <button className={styles.newButton} type="button" onClick={startNew}>
                New
              </button>
              <button
                className={styles.editButton}
                type="button"
                onClick={startEdit}
                disabled={!selected || isSaving}
              >
                Edit
              </button>
              <button
                className={styles.deleteButton}
                type="button"
                onClick={() => void remove()}
                disabled={!selected || isSaving}
              >
                Delete
              </button>
            </>
          ) : null}
          <button
            className={styles.refreshButton}
            type="button"
            onClick={() => void loadRows()}
            disabled={isLoading || isSaving}
          >
            Refresh
          </button>
        </div>

        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}

        {formMode ? (
          <section className={styles.editorPanel}>
            <h3>{formMode === "new" ? "Create Position" : "Edit Position"}</h3>
            <div className={styles.formGrid}>
              <label>
                Position Code
                <input
                  value={form.positionCode}
                  maxLength={30}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      positionCode: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Position Name(TH)
                <input
                  value={form.positionNameTh}
                  maxLength={255}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      positionNameTh: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Position Name(EN)
                <input
                  value={form.positionNameEn}
                  maxLength={255}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      positionNameEn: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as PositionStatus,
                    }))
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
            </div>
            <div className={styles.formActions}>
              <button
                className={styles.saveButton}
                type="button"
                onClick={() => void save()}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={() => setFormMode(null)}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Shared Master</span>
              <h3>Position Records</h3>
            </div>
            <p>{visibleRows.length} records</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.positionTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Position Code</th>
                  <th>Position Name(TH)</th>
                  <th>Position Name(EN)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr
                    key={row.positionId}
                    className={
                      row.positionId === selectedId
                        ? styles.selectedRow
                        : undefined
                    }
                    onClick={() => setSelectedId(row.positionId)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <span className={styles.codePill}>{row.positionCode}</span>
                    </td>
                    <td>{row.positionNameTh}</td>
                    <td>{row.positionNameEn ?? "-"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {!isLoading && visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No position data found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </section>
  );
}
