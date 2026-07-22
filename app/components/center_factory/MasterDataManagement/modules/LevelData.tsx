"use client";

import { useMemo, useState } from "react";
import styles from "./LevelData.module.css";

type LevelRecord = {
  id: string;
  levelCodeTh: string;
  levelCodeEn: string;
  levelNameTh: string;
  levelNameEn: string;
  pl: string;
  levelKey: string;
  remark: string;
};

type FormMode = "new" | "edit" | null;

export const levelDataModule = {
  title: "Level Data",
  subtitle: "Level master",
  description: "Maintain employee level codes, PL values, and level keys for training standards.",
} as const;

const defaultRows: LevelRecord[] = [
  {
    id: "level-m4",
    levelCodeTh: "จ",
    levelCodeEn: "M",
    levelNameTh: "จัดการ4",
    levelNameEn: "Management4",
    pl: "4",
    levelKey: "จ4",
    remark: "",
  },
  {
    id: "level-m3",
    levelCodeTh: "จ",
    levelCodeEn: "M",
    levelNameTh: "จัดการ3",
    levelNameEn: "Management3",
    pl: "3",
    levelKey: "จ3",
    remark: "",
  },
  {
    id: "level-m2",
    levelCodeTh: "จ",
    levelCodeEn: "M",
    levelNameTh: "จัดการ2",
    levelNameEn: "Management2",
    pl: "2",
    levelKey: "จ2",
    remark: "",
  },
  {
    id: "level-m1",
    levelCodeTh: "จ",
    levelCodeEn: "M",
    levelNameTh: "จัดการ1",
    levelNameEn: "Management1",
    pl: "1",
    levelKey: "จ1",
    remark: "",
  },
  {
    id: "level-s4",
    levelCodeTh: "บ",
    levelCodeEn: "S",
    levelNameTh: "บังคับบัญชา4",
    levelNameEn: "Supervisor4",
    pl: "4",
    levelKey: "บ4",
    remark: "",
  },
  {
    id: "level-s3",
    levelCodeTh: "บ",
    levelCodeEn: "S",
    levelNameTh: "บังคับบัญชา3",
    levelNameEn: "Supervisor3",
    pl: "3",
    levelKey: "บ3",
    remark: "",
  },
  {
    id: "level-s2",
    levelCodeTh: "บ",
    levelCodeEn: "S",
    levelNameTh: "บังคับบัญชา2",
    levelNameEn: "Supervisor2",
    pl: "2",
    levelKey: "บ2",
    remark: "",
  },
  {
    id: "level-s1",
    levelCodeTh: "บ",
    levelCodeEn: "S",
    levelNameTh: "บังคับบัญชา1",
    levelNameEn: "Supervisor1",
    pl: "1",
    levelKey: "บ1",
    remark: "",
  },
  {
    id: "level-o5",
    levelCodeTh: "ป",
    levelCodeEn: "O",
    levelNameTh: "ปฏิบัติการ5",
    levelNameEn: "Operator5",
    pl: "5",
    levelKey: "ป5",
    remark: "",
  },
  {
    id: "level-o4",
    levelCodeTh: "ป",
    levelCodeEn: "O",
    levelNameTh: "ปฏิบัติการ4",
    levelNameEn: "Operator4",
    pl: "4",
    levelKey: "ป4",
    remark: "",
  },
  {
    id: "level-o3",
    levelCodeTh: "ป",
    levelCodeEn: "O",
    levelNameTh: "ปฏิบัติการ3",
    levelNameEn: "Operator3",
    pl: "3",
    levelKey: "ป3",
    remark: "",
  },
  {
    id: "level-o2",
    levelCodeTh: "ป",
    levelCodeEn: "O",
    levelNameTh: "ปฏิบัติการ2",
    levelNameEn: "Operator2",
    pl: "2",
    levelKey: "ป2",
    remark: "",
  },
  {
    id: "level-o1",
    levelCodeTh: "ป",
    levelCodeEn: "O",
    levelNameTh: "ปฏิบัติการ1",
    levelNameEn: "Operator1",
    pl: "1",
    levelKey: "ป1",
    remark: "",
  },
];

const emptyRecord = (): LevelRecord => ({
  id: `level-${Date.now()}`,
  levelCodeTh: "",
  levelCodeEn: "",
  levelNameTh: "",
  levelNameEn: "",
  pl: "",
  levelKey: "",
  remark: "",
});

export default function LevelData() {
  const [rows, setRows] = useState<LevelRecord[]>(defaultRows);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(defaultRows[0]?.id ?? "");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formValues, setFormValues] = useState<LevelRecord>(emptyRecord);

  const selectedRecord = rows.find((row) => row.id === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.levelCodeTh,
        row.levelCodeEn,
        row.levelNameTh,
        row.levelNameEn,
        row.pl,
        row.levelKey,
        row.remark,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  const updateForm = (field: keyof LevelRecord, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const handleNew = () => {
    setFormValues(emptyRecord());
    setFormMode("new");
  };

  const handleEdit = () => {
    if (!selectedRecord) {
      return;
    }

    setFormValues(selectedRecord);
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
    setRows(defaultRows);
    setSearch("");
    setSelectedId(defaultRows[0]?.id ?? "");
    setFormMode(null);
  };

  const handleSave = () => {
    const nextRecord: LevelRecord = {
      ...formValues,
      levelCodeTh: formValues.levelCodeTh.trim(),
      levelCodeEn: formValues.levelCodeEn.trim().toUpperCase(),
      levelNameTh: formValues.levelNameTh.trim(),
      levelNameEn: formValues.levelNameEn.trim(),
      pl: formValues.pl.trim(),
      levelKey: formValues.levelKey.trim(),
      remark: formValues.remark.trim(),
    };

    if (
      !nextRecord.levelCodeTh ||
      !nextRecord.levelCodeEn ||
      !nextRecord.levelNameTh ||
      !nextRecord.levelNameEn ||
      !nextRecord.pl ||
      !nextRecord.levelKey
    ) {
      return;
    }

    if (formMode === "edit") {
      setRows((current) =>
        current.map((row) => (row.id === nextRecord.id ? nextRecord : row)),
      );
    } else {
      setRows((current) => [nextRecord, ...current]);
    }

    setSelectedId(nextRecord.id);
    setFormMode(null);
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
          <article>
            <strong>M</strong>
            <span>Management</span>
          </article>
          <article>
            <strong>S</strong>
            <span>Supervisor</span>
          </article>
          <article>
            <strong>O</strong>
            <span>Operator</span>
          </article>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search level data"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search level code, name, PL, or key"
          />
          <button className={styles.newButton} type="button" onClick={handleNew}>
            New
          </button>
          <button
            className={styles.editButton}
            type="button"
            onClick={handleEdit}
            disabled={!selectedRecord}
          >
            Edit
          </button>
          <button
            className={styles.deleteButton}
            type="button"
            onClick={handleDelete}
            disabled={!selectedRecord}
          >
            Delete
          </button>
          <button className={styles.refreshButton} type="button" onClick={handleRefresh}>
            Refresh
          </button>
        </div>

        {formMode ? (
          <section className={styles.editorPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span>{formMode === "new" ? "New record" : "Edit record"}</span>
                <h3>{formMode === "new" ? "Create Level" : formValues.levelKey}</h3>
              </div>
            </div>

            <div className={styles.formGrid}>
              <label>
                Level Code(TH)
                <input
                  value={formValues.levelCodeTh}
                  onChange={(event) => updateForm("levelCodeTh", event.target.value)}
                  placeholder="จ"
                />
              </label>
              <label>
                Level Code(EN)
                <input
                  value={formValues.levelCodeEn}
                  onChange={(event) => updateForm("levelCodeEn", event.target.value)}
                  placeholder="M"
                />
              </label>
              <label>
                Level Name(TH)
                <input
                  value={formValues.levelNameTh}
                  onChange={(event) => updateForm("levelNameTh", event.target.value)}
                  placeholder="จัดการ4"
                />
              </label>
              <label>
                Level Name(EN)
                <input
                  value={formValues.levelNameEn}
                  onChange={(event) => updateForm("levelNameEn", event.target.value)}
                  placeholder="Management4"
                />
              </label>
              <label>
                PL
                <input
                  value={formValues.pl}
                  onChange={(event) => updateForm("pl", event.target.value)}
                  placeholder="4"
                />
              </label>
              <label>
                Level Key
                <input
                  value={formValues.levelKey}
                  onChange={(event) => updateForm("levelKey", event.target.value)}
                  placeholder="จ4"
                />
              </label>
              <label className={styles.fullWidth}>
                Remark.
                <textarea
                  value={formValues.remark}
                  onChange={(event) => updateForm("remark", event.target.value)}
                  placeholder="Remark"
                />
              </label>
            </div>

            <div className={styles.formActions}>
              <button className={styles.saveButton} type="button" onClick={handleSave}>
                Save
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={() => setFormMode(null)}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Master List</span>
              <h3>Level Records</h3>
            </div>
            <p>{visibleRows.length} records</p>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.levelTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Level Code(TH)</th>
                  <th>Level Code(EN)</th>
                  <th>Level Name(TH)</th>
                  <th>Level Name(EN)</th>
                  <th>PL</th>
                  <th>Level Key</th>
                  <th>Remark.</th>
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
                    <td>{row.levelCodeTh}</td>
                    <td>
                      <span className={styles.codePill}>{row.levelCodeEn}</span>
                    </td>
                    <td>{row.levelNameTh}</td>
                    <td>{row.levelNameEn}</td>
                    <td>{row.pl}</td>
                    <td>
                      <span className={styles.keyPill}>{row.levelKey}</span>
                    </td>
                    <td>{row.remark || "-"}</td>
                  </tr>
                ))}
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No level data found.</td>
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
