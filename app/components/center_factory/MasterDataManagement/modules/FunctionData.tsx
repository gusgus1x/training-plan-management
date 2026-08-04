"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import {
  FunctionClientError,
  createFunction,
  deleteFunction,
  listFunctions,
  updateFunction,
} from "../../../../lib/functions/client";
import type {
  MasterStatus,
  OrganizationFunctionRecord,
} from "../../../../lib/functions/types";
import styles from "./FunctionData.module.css";

export type FunctionRecord = {
  id: string;
  functionCode: string;
  functionNameTh: string;
  functionNameEn: string;
};

export const functionDataModule = {
  title: "Function Data",
  subtitle: "Function master",
  description:
    "Maintain the shared function catalog used by every company.",
} as const;

const mockFunctions = [
  ["FNC0001", "การขาย", ""],
  ["FNC0002", "วางแผนการขาย", "Sale Planing"],
  ["FNC0003", "บัญชีและการเงิน", "Account and Financial"],
  ["FNC0004", "ทรัพยากรมนุษย์", "Human Resource"],
  ["FNC0005", "ธุรการ", ""],
  ["FNC0006", "ล่ามและเลขานุการ", ""],
  ["FNC0007", "จัดซื้อ", "Purchase"],
  ["FNC0008", "เทคโนโลยีสารสนเทศ", "IT Promotion"],
  ["FNC0009", "คลังสินค้า", ""],
  ["FNC0010", "ผลิต", "Production"],
  ["FNC0011", "วางแผนการผลิต", "Production Planing"],
  ["FNC0012", "วิศวกรรมและซ่อมบำรุง", "Engineering and Maintenance"],
  ["FNC0013", "คุณภาพ", "Quality"],
  ["FNC0014", "ความปลอดภัยและสิ่งแวดล้อม", "Safety and Environment"],
  ["FNC0015", "วิศวกรรมโครงการ", "Project Engineering"],
  ["FNC0016", "สำนักงานกรรมการผู้จัดการ", "President Office"],
  ["FNC0017", "อื่นๆ", "Other"],
] as const;

// Temporary compatibility export for mock consumers awaiting API migration.
export const defaultFunctionRows: FunctionRecord[] = mockFunctions.map(
  ([functionCode, functionNameTh, functionNameEn], index) => ({
    id: `function-${String(index + 1).padStart(4, "0")}`,
    functionCode,
    functionNameTh,
    functionNameEn,
  }),
);

type FunctionForm = {
  functionCode: string;
  functionNameTh: string;
  functionNameEn: string;
  status: MasterStatus;
};

const blankForm = (): FunctionForm => ({
  functionCode: "",
  functionNameTh: "",
  functionNameEn: "",
  status: "ACTIVE",
});

const toForm = (record: OrganizationFunctionRecord): FunctionForm => ({
  functionCode: record.functionCode,
  functionNameTh: record.functionNameTh,
  functionNameEn: record.functionNameEn ?? "",
  status: record.status,
});

const errorText = (error: unknown) =>
  error instanceof FunctionClientError
    ? error.message
    : "Unable to load function data. Please try again.";

export default function FunctionData() {
  const user = useAuthenticatedUser();
  const isCenter = user?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<OrganizationFunctionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<FunctionForm>(blankForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = rows.find((row) => row.functionId === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.functionCode, row.functionNameTh, row.functionNameEn, row.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  const applyRows = (items: OrganizationFunctionRecord[]) => {
    setRows(items);
    setSelectedId((current) =>
      current && items.some((item) => item.functionId === current)
        ? current
        : items[0]?.functionId ?? null,
    );
  };

  const loadRows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      applyRows((await listFunctions()).items);
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    listFunctions()
      .then((result) => {
        if (!current) return;
        setRows(result.items);
        setSelectedId(result.items[0]?.functionId ?? null);
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
    setMessage(null);
  };

  const startEdit = () => {
    if (!isCenter || !selected) return;
    setForm(toForm(selected));
    setFormMode("edit");
    setError(null);
    setMessage(null);
  };

  const save = async () => {
    if (!isCenter || isSaving || !formMode) return;
    const savingMode = formMode;
    const editingFunctionId = selected?.functionId ?? null;
    if (savingMode === "edit" && !editingFunctionId) {
      setError("Select a Function before saving changes.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const input = {
        functionCode: form.functionCode.trim().toUpperCase(),
        functionNameTh: form.functionNameTh.trim(),
        functionNameEn: form.functionNameEn.trim() || null,
        status: form.status,
      };
      const result =
        savingMode === "edit" && editingFunctionId
          ? await updateFunction(editingFunctionId, input)
          : await createFunction(input);
      setRows((current) =>
        savingMode === "edit"
          ? current.map((item) =>
              item.functionId === result.function.functionId
                ? result.function
                : item,
            )
          : [...current, result.function],
      );
      void listFunctions()
        .then((refreshed) => applyRows(refreshed.items))
        .catch(() => undefined);
      setSelectedId(result.function.functionId);
      setFormMode(null);
      setForm(blankForm());
      setMessage(`${result.function.functionCode} was saved.`);
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
      !window.confirm(`Delete ${selected.functionCode}?`)
    ) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await deleteFunction(selected.functionId);
      const nextRows = rows.filter(
        (item) => item.functionId !== result.function.functionId,
      );
      setRows(nextRows);
      setSelectedId(nextRows[0]?.functionId ?? null);
      setFormMode(null);
      setMessage(`${result.function.functionCode} was deleted.`);
      void listFunctions()
        .then((refreshed) => applyRows(refreshed.items))
        .catch(() => undefined);
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const refresh = () => {
    setFormMode(null);
    setForm(blankForm());
    setMessage(null);
    void loadRows();
  };

  return (
    <section className={styles.page} aria-label="Function Data module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{functionDataModule.subtitle}</p>
          <h2>{functionDataModule.title}</h2>
          <p>{functionDataModule.description}</p>
        </div>
        <div className={styles.heroMetric}>
          <strong>{rows.length}</strong>
          <span>Functions</span>
        </div>
      </section>

      <section className={styles.workspace} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search function data"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search function code or name"
          />
          {isCenter ? (
            <>
              <button
                className={styles.newButton}
                type="button"
                onClick={startNew}
                disabled={isSaving}
              >
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
            onClick={refresh}
            disabled={isLoading || isSaving}
          >
            Refresh
          </button>
        </div>

        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}

        {formMode ? (
          <section className={styles.editorPanel}>
            <h3>{formMode === "new" ? "Create Function" : "Edit Function"}</h3>
            <div className={styles.formGrid}>
              <label>
                Function Code
                <input
                  value={form.functionCode}
                  maxLength={30}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      functionCode: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Function Name(TH)
                <input
                  value={form.functionNameTh}
                  maxLength={255}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      functionNameTh: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Function Name(EN)
                <input
                  value={form.functionNameEn}
                  maxLength={255}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      functionNameEn: event.target.value,
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
                      status: event.target.value as MasterStatus,
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
              <h3>Function Records</h3>
            </div>
            <p>{visibleRows.length} records</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.functionTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Function Code</th>
                  <th>Function Name(TH)</th>
                  <th>Function Name(EN)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr
                    key={row.functionId}
                    className={
                      row.functionId === selectedId
                        ? styles.selectedRow
                        : undefined
                    }
                    onClick={() => setSelectedId(row.functionId)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <span className={styles.codePill}>
                        {row.functionCode}
                      </span>
                    </td>
                    <td>{row.functionNameTh}</td>
                    <td>{row.functionNameEn ?? "-"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {!isLoading && visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No function data found.</td>
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
