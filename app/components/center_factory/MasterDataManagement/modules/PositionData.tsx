"use client";

import { useMemo, useState } from "react";
import styles from "./PositionData.module.css";

type PositionRecord = {
  id: string;
  positionCode: string;
  positionNameTh: string;
  positionNameEn: string;
  remark: string;
};

type FormMode = "new" | "edit" | null;

export const positionDataModule = {
  title: "Position Data",
  subtitle: "Position master",
  description: "Maintain position codes and bilingual position names for training standards.",
} as const;

const defaultRows: PositionRecord[] = [
  {
    id: "position-mgr",
    positionCode: "mgr",
    positionNameTh: "ผู้จัดการ++",
    positionNameEn: "Manager++",
    remark: "",
  },
  {
    id: "position-sh",
    positionCode: "sh",
    positionNameTh: "ผู้จัดการแผนก",
    positionNameEn: "Section Head",
    remark: "",
  },
  {
    id: "position-eng",
    positionCode: "eng",
    positionNameTh: "วิศวกร",
    positionNameEn: "Engineer",
    remark: "",
  },
  {
    id: "position-fm",
    positionCode: "fm",
    positionNameTh: "โฟร์แมน",
    positionNameEn: "Foreman",
    remark: "",
  },
  {
    id: "position-ld",
    positionCode: "ld",
    positionNameTh: "ลีดเดอร์",
    positionNameEn: "Leader",
    remark: "",
  },
  {
    id: "position-op",
    positionCode: "op",
    positionNameTh: "พนักงานปฏิบัติการ",
    positionNameEn: "Operator",
    remark: "",
  },
  {
    id: "position-office",
    positionCode: "office",
    positionNameTh: "เจ้าหน้าที่",
    positionNameEn: "Supervisor",
    remark: "",
  },
  {
    id: "position-staff",
    positionCode: "staff",
    positionNameTh: "พนักงานปฏิบัติการ",
    positionNameEn: "Staff",
    remark: "",
  },
];

const emptyRecord = (): PositionRecord => ({
  id: `position-${Date.now()}`,
  positionCode: "",
  positionNameTh: "",
  positionNameEn: "",
  remark: "",
});

export default function PositionData() {
  const [rows, setRows] = useState<PositionRecord[]>(defaultRows);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(defaultRows[0]?.id ?? "");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formValues, setFormValues] = useState<PositionRecord>(emptyRecord);

  const selectedRecord = rows.find((row) => row.id === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      [
        row.positionCode,
        row.positionNameTh,
        row.positionNameEn,
        row.remark,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  const updateForm = (field: keyof PositionRecord, value: string) => {
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
    const nextRecord: PositionRecord = {
      ...formValues,
      positionCode: formValues.positionCode.trim().toLowerCase(),
      positionNameTh: formValues.positionNameTh.trim(),
      positionNameEn: formValues.positionNameEn.trim(),
      remark: formValues.remark.trim(),
    };

    if (
      !nextRecord.positionCode ||
      !nextRecord.positionNameTh ||
      !nextRecord.positionNameEn
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

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search position data"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search position code or name"
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
                <h3>{formMode === "new" ? "Create Position" : formValues.positionCode}</h3>
              </div>
            </div>

            <div className={styles.formGrid}>
              <label>
                Position Code
                <input
                  value={formValues.positionCode}
                  onChange={(event) => updateForm("positionCode", event.target.value)}
                  placeholder="mgr"
                />
              </label>
              <label>
                Position Name(TH)
                <input
                  value={formValues.positionNameTh}
                  onChange={(event) => updateForm("positionNameTh", event.target.value)}
                  placeholder="ชื่อตำแหน่งภาษาไทย"
                />
              </label>
              <label>
                Position Name(EN)
                <input
                  value={formValues.positionNameEn}
                  onChange={(event) => updateForm("positionNameEn", event.target.value)}
                  placeholder="Position name in English"
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
                    <td>
                      <span className={styles.codePill}>{row.positionCode}</span>
                    </td>
                    <td>{row.positionNameTh}</td>
                    <td>{row.positionNameEn}</td>
                    <td>{row.remark || "-"}</td>
                  </tr>
                ))}
                {visibleRows.length === 0 ? (
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
