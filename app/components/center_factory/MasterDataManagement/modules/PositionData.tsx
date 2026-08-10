"use client";

import { useMemo, useState } from "react";
import {
  TRAINING_MASTER_KEYS,
  readMasterCollection,
  writeMasterCollection,
} from "../../../../lib/trainingWorkflow";
import styles from "./PositionData.module.css";

export type PositionRecord = {
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

export const defaultPositionRows: PositionRecord[] = [
  {
    id: "position-op",
    positionCode: "op",
    positionNameTh: "พนักงานปฏิบัติการ",
    positionNameEn: "Operator",
    remark: "Operator / พนักงานปฏิบัติการ",
  },
  {
    id: "position-staff",
    positionCode: "staff",
    positionNameTh: "พนักงาน",
    positionNameEn: "Staff",
    remark: "Staff / พนักงาน",
  },
  {
    id: "position-ld",
    positionCode: "ld",
    positionNameTh: "ลีดเดอร์",
    positionNameEn: "Leader",
    remark: "Leader / ลีดเดอร์",
  },
  {
    id: "position-fm",
    positionCode: "fm",
    positionNameTh: "โฟร์แมน",
    positionNameEn: "Foreman",
    remark: "Foreman / โฟร์แมน",
  },
  {
    id: "position-sfm",
    positionCode: "sfm",
    positionNameTh: "ซีเนียร์โฟร์แมน",
    positionNameEn: "Senior Foreman",
    remark: "Senior Foreman / ซีเนียร์โฟร์แมน",
  },
  {
    id: "position-off",
    positionCode: "off",
    positionNameTh: "เจ้าหน้าที่",
    positionNameEn: "Officer",
    remark: "Officer / เจ้าหน้าที่",
  },
  {
    id: "position-eng",
    positionCode: "eng",
    positionNameTh: "วิศวกร",
    positionNameEn: "Engineer",
    remark: "Engineer / วิศวกร",
  },
  {
    id: "position-sh",
    positionCode: "sh",
    positionNameTh: "ผู้จัดการแผนก",
    positionNameEn: "Section Head",
    remark: "Section Head / ผู้จัดการแผนก",
  },
  {
    id: "position-mgr",
    positionCode: "mgr",
    positionNameTh: "ผู้จัดการ",
    positionNameEn: "Manager",
    remark: "Manager / ผู้จัดการ",
  },
  {
    id: "position-gm",
    positionCode: "gm",
    positionNameTh: "ผู้จัดการทั่วไป",
    positionNameEn: "General Manager",
    remark: "General Manager / ผู้จัดการทั่วไป",
  },
  {
    id: "position-sgm",
    positionCode: "sgm",
    positionNameTh: "ผู้จัดการทั่วไปอาวุโส",
    positionNameEn: "Senior General Manager",
    remark: "Senior General Manager / ผู้จัดการทั่วไปอาวุโส",
  },
  {
    id: "position-egm",
    positionCode: "egm",
    positionNameTh: "ผู้จัดการทั่วไปฝ่ายบริหาร",
    positionNameEn: "Executive General Manager",
    remark: "Executive General Manager / ผู้จัดการทั่วไปฝ่ายบริหาร",
  },
  {
    id: "position-pm",
    positionCode: "pm",
    positionNameTh: "ผู้จัดการโรงงาน",
    positionNameEn: "Plant Manager",
    remark: "Plant Manager / ผู้จัดการโรงงาน",
  },
  {
    id: "position-vp",
    positionCode: "vp",
    positionNameTh: "รองประธาน",
    positionNameEn: "Vice President",
    remark: "Vice President / รองประธาน",
  },
  {
    id: "position-evp",
    positionCode: "evp",
    positionNameTh: "รองประธานบริหาร",
    positionNameEn: "Executive Vice President",
    remark: "Executive Vice President / รองประธานบริหาร",
  },
];

const mergeDefaultPositions = (storedRows: PositionRecord[]): PositionRecord[] => {
  const existingCodes = new Set(
    storedRows.map((r) => r.positionCode.trim().toLowerCase()),
  );
  const missingDefaults = defaultPositionRows.filter(
    (defaultRow) => !existingCodes.has(defaultRow.positionCode.toLowerCase()),
  );
  return [...storedRows, ...missingDefaults];
};

const emptyRecord = (): PositionRecord => ({
  id: `position-${Date.now()}`,
  positionCode: "",
  positionNameTh: "",
  positionNameEn: "",
  remark: "",
});

export default function PositionData() {
  const [rows, setRows] = useState<PositionRecord[]>(() => {
    const loaded = readMasterCollection(
      TRAINING_MASTER_KEYS.positions,
      defaultPositionRows,
    );
    const merged = mergeDefaultPositions(loaded);
    writeMasterCollection(TRAINING_MASTER_KEYS.positions, merged);
    return merged;
  });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(defaultPositionRows[0]?.id ?? "");
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

  const saveRows = (nextRows: PositionRecord[]) => {
    setRows(nextRows);
    writeMasterCollection(TRAINING_MASTER_KEYS.positions, nextRows);
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

    saveRows(rows.filter((row) => row.id !== selectedRecord.id));
    setSelectedId("");
    setFormMode(null);
  };

  const handleRefresh = () => {
    const loaded = readMasterCollection(
      TRAINING_MASTER_KEYS.positions,
      defaultPositionRows,
    );
    const merged = mergeDefaultPositions(loaded);
    saveRows(merged);
    setSearch("");
    setSelectedId(merged[0]?.id ?? "");
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
      saveRows(
        rows.map((row) => (row.id === nextRecord.id ? nextRecord : row)),
      );
    } else {
      saveRows([nextRecord, ...rows]);
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
                  placeholder="Thai position name"
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
