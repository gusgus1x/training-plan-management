"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import {
  LevelClientError,
  createLevel,
  deleteLevel,
  listLevels,
  updateLevel,
} from "../../../../lib/levels/client";
import type {
  CreateLevelInput,
  LevelRecord as ApiLevelRecord,
  LevelStatus,
} from "../../../../lib/levels/types";
import styles from "./LevelData.module.css";

export type LevelRecord = {
  id: string;
  levelCodeTh: string;
  levelCodeEn: string;
  levelNameTh: string;
  levelNameEn: string;
  pl: string;
  levelKey: string;
  remark: string;
};

export const levelDataModule = {
  title: "Level Data",
  subtitle: "Level master",
  description:
    "Maintain the shared employee level catalog used by every company.",
} as const;

const mockLevels = [
  ["m4", "จ", "M", "จัดการ4", "Management4", "4", "จ4"],
  ["m3", "จ", "M", "จัดการ3", "Management3", "3", "จ3"],
  ["m2", "จ", "M", "จัดการ2", "Management2", "2", "จ2"],
  ["m1", "จ", "M", "จัดการ1", "Management1", "1", "จ1"],
  ["s4", "บ", "S", "บังคับบัญชา4", "Supervisor4", "4", "บ4"],
  ["s3", "บ", "S", "บังคับบัญชา3", "Supervisor3", "3", "บ3"],
  ["s2", "บ", "S", "บังคับบัญชา2", "Supervisor2", "2", "บ2"],
  ["s1", "บ", "S", "บังคับบัญชา1", "Supervisor1", "1", "บ1"],
  ["o5", "ป", "O", "ปฏิบัติการ5", "Operator5", "5", "ป5"],
  ["o4", "ป", "O", "ปฏิบัติการ4", "Operator4", "4", "ป4"],
  ["o3", "ป", "O", "ปฏิบัติการ3", "Operator3", "3", "ป3"],
  ["o2", "ป", "O", "ปฏิบัติการ2", "Operator2", "2", "ป2"],
  ["o1", "ป", "O", "ปฏิบัติการ1", "Operator1", "1", "ป1"],
] as const;

// Temporary compatibility export for Employee and Course Standard mock consumers.
export const defaultLevelRows: LevelRecord[] = mockLevels.map(
  ([
    id,
    levelCodeTh,
    levelCodeEn,
    levelNameTh,
    levelNameEn,
    pl,
    levelKey,
  ]) => ({
    id: `level-${id}`,
    levelCodeTh,
    levelCodeEn,
    levelNameTh,
    levelNameEn,
    pl,
    levelKey,
    remark: "",
  }),
);

type LevelForm = CreateLevelInput;
const blankForm = (): LevelForm => ({
  levelCodeTh: "",
  levelCodeEn: "",
  levelNameTh: "",
  levelNameEn: "",
  pl: "",
  levelKey: "",
  remark: "",
  status: "ACTIVE",
});
const toForm = (record: ApiLevelRecord): LevelForm => ({
  levelCodeTh: record.levelCodeTh,
  levelCodeEn: record.levelCodeEn,
  levelNameTh: record.levelNameTh,
  levelNameEn: record.levelNameEn ?? "",
  pl: record.pl ?? "",
  levelKey: record.levelKey,
  remark: record.remark ?? "",
  status: record.status,
});
const errorText = (error: unknown) =>
  error instanceof LevelClientError
    ? error.message
    : "Unable to load level data. Please try again.";

export default function LevelData() {
  const user = useAuthenticatedUser();
  const isCenter = user?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<ApiLevelRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<LevelForm>(blankForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selected = rows.find((row) => row.levelId === selectedId) ?? null;

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.levelCode,
        row.levelCodeTh,
        row.levelCodeEn,
        row.levelNameTh,
        row.levelNameEn,
        row.pl,
        row.levelKey,
        row.remark,
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
      const items = (await listLevels()).items;
      setRows(items);
      setSelectedId((current) =>
        current && items.some((item) => item.levelId === current)
          ? current
          : items[0]?.levelId ?? null,
      );
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    listLevels()
      .then((result) => {
        if (!current) return;
        setRows(result.items);
        setSelectedId(result.items[0]?.levelId ?? null);
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

  const change = (field: keyof LevelForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
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
    if (!isCenter || isSaving || !formMode) return;
    const savingMode = formMode;
    const editingLevelId = selected?.levelId ?? null;
    if (savingMode === "edit" && !editingLevelId) {
      setError("Select a Level before saving changes.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const input: CreateLevelInput = {
        levelCodeTh: form.levelCodeTh.trim(),
        levelCodeEn: form.levelCodeEn.trim().toUpperCase(),
        levelNameTh: form.levelNameTh.trim(),
        levelNameEn: form.levelNameEn?.trim() || null,
        pl: form.pl.trim(),
        levelKey: form.levelKey.trim(),
        remark: form.remark?.trim() || null,
        status: form.status,
      };
      const result =
        savingMode === "edit" && editingLevelId
          ? await updateLevel(editingLevelId, input)
          : await createLevel(input);
      setRows((current) =>
        savingMode === "edit"
          ? current.map((item) =>
              item.levelId === result.level.levelId ? result.level : item,
            )
          : [...current, result.level],
      );
      void listLevels()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
      setSelectedId(result.level.levelId);
      setFormMode(null);
      setForm(blankForm());
      setMessage(`${result.level.levelCode} was saved.`);
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
      !window.confirm(`Delete ${selected.levelCode}?`)
    )
      return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await deleteLevel(selected.levelId);
      const nextRows = rows.filter(
        (item) => item.levelId !== result.level.levelId,
      );
      setRows(nextRows);
      setSelectedId(nextRows[0]?.levelId ?? null);
      setFormMode(null);
      setMessage(`${result.level.levelCode} was deleted.`);
      void listLevels()
        .then((refreshed) => setRows(refreshed.items))
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
    <section className={styles.page} aria-label="Level Data module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{levelDataModule.subtitle}</p>
          <h2>{levelDataModule.title}</h2>
          <p>{levelDataModule.description}</p>
        </div>
        <div className={styles.levelSummary}>
          <article><strong>M</strong><span>Management</span></article>
          <article><strong>S</strong><span>Supervisor</span></article>
          <article><strong>O</strong><span>Operator</span></article>
        </div>
      </section>

      <section className={styles.workspace} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search level data"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search level code, name, PL, or key"
          />
          {isCenter ? (
            <>
              <button className={styles.newButton} type="button" onClick={startNew} disabled={isSaving}>New</button>
              <button className={styles.editButton} type="button" onClick={startEdit} disabled={!selected || isSaving}>Edit</button>
              <button className={styles.deleteButton} type="button" onClick={() => void remove()} disabled={!selected || isSaving}>Delete</button>
            </>
          ) : null}
          <button className={styles.refreshButton} type="button" onClick={refresh} disabled={isLoading || isSaving}>Refresh</button>
        </div>

        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}

        {formMode ? (
          <section className={styles.editorPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span>{formMode === "new" ? "New record" : "Edit record"}</span>
                <h3>{formMode === "new" ? "Create Level" : selected?.levelCode}</h3>
              </div>
            </div>
            <div className={styles.formGrid}>
              <label>Level Code(TH)<input maxLength={30} value={form.levelCodeTh} onChange={(event) => change("levelCodeTh", event.target.value)} /></label>
              <label>Level Code(EN)<input maxLength={30} value={form.levelCodeEn} onChange={(event) => change("levelCodeEn", event.target.value)} /></label>
              <label>Level Name(TH)<input maxLength={255} value={form.levelNameTh} onChange={(event) => change("levelNameTh", event.target.value)} /></label>
              <label>Level Name(EN)<input maxLength={255} value={form.levelNameEn ?? ""} onChange={(event) => change("levelNameEn", event.target.value)} /></label>
              <label>PL<input maxLength={30} value={form.pl} onChange={(event) => change("pl", event.target.value)} /></label>
              <label>Level Key<input maxLength={30} value={form.levelKey} onChange={(event) => change("levelKey", event.target.value)} /></label>
              <label>Status<select value={form.status} onChange={(event) => change("status", event.target.value as LevelStatus)}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label>
              <label className={styles.fullWidth}>Remark.<textarea maxLength={500} value={form.remark ?? ""} onChange={(event) => change("remark", event.target.value)} /></label>
            </div>
            <div className={styles.formActions}>
              <button className={styles.saveButton} type="button" onClick={() => void save()} disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>
              <button className={styles.cancelButton} type="button" onClick={() => setFormMode(null)} disabled={isSaving}>Cancel</button>
            </div>
          </section>
        ) : null}

        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div><span>Shared Master</span><h3>Level Records</h3></div>
            <p>{visibleRows.length} records</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.levelTable}>
              <thead>
                <tr>
                  <th>No.</th><th>Level Code</th><th>Level Code(TH)</th>
                  <th>Level Code(EN)</th><th>Level Name(TH)</th>
                  <th>Level Name(EN)</th><th>PL</th><th>Level Key</th>
                  <th>Remark.</th><th>Status</th>
                </tr>
              </thead>
              <tbody translate="no">
                {visibleRows.map((row, index) => (
                  <tr
                    className={row.levelId === selectedId ? styles.selectedRow : undefined}
                    key={row.levelId}
                    onClick={() => setSelectedId(row.levelId)}
                  >
                    <td>{index + 1}</td>
                    <td><span className={styles.codePill}>{row.levelCode}</span></td>
                    <td>{row.levelCodeTh}</td><td>{row.levelCodeEn}</td>
                    <td>{row.levelNameTh}</td><td>{row.levelNameEn ?? "-"}</td>
                    <td>{row.pl ?? "-"}</td>
                    <td><span className={styles.keyPill}>{row.levelKey}</span></td>
                    <td>{row.remark ?? "-"}</td><td>{row.status}</td>
                  </tr>
                ))}
                {!isLoading && visibleRows.length === 0 ? (
                  <tr><td colSpan={10}>No level data found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </section>
  );
}
