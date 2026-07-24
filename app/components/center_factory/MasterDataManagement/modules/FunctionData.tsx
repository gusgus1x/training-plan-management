"use client";

import { useMemo, useState } from "react";
import styles from "./FunctionData.module.css";

export type FunctionRecord = {
  id: string;
  functionCode: string;
  functionNameTh: string;
  functionNameEn: string;
};

type FormMode = "new" | "edit" | null;

export const functionDataModule = {
  title: "Function Data",
  subtitle: "Function master",
  description: "Maintain function codes and bilingual function names for training workflows.",
} as const;

export const defaultFunctionRows: FunctionRecord[] = [
  {
    id: "function-0001",
    functionCode: "FNC0001",
    functionNameTh: "การขาย",
    functionNameEn: "",
  },
  {
    id: "function-0002",
    functionCode: "FNC0002",
    functionNameTh: "วางแผนการขาย",
    functionNameEn: "Sale Planing",
  },
  {
    id: "function-0003",
    functionCode: "FNC0003",
    functionNameTh: "บัญชีและการเงิน",
    functionNameEn: "Account and Financial",
  },
  {
    id: "function-0004",
    functionCode: "FNC0004",
    functionNameTh: "ทรัพยากรมนุษย์",
    functionNameEn: "Human Resource",
  },
  {
    id: "function-0005",
    functionCode: "FNC0005",
    functionNameTh: "ธุรการ",
    functionNameEn: "",
  },
  {
    id: "function-0006",
    functionCode: "FNC0006",
    functionNameTh: "ล่ามและเลขานุการ",
    functionNameEn: "",
  },
  {
    id: "function-0007",
    functionCode: "FNC0007",
    functionNameTh: "จัดซื้อ",
    functionNameEn: "Purchase",
  },
  {
    id: "function-0008",
    functionCode: "FNC0008",
    functionNameTh: "เทคโนโลยีสารสนเทศ",
    functionNameEn: "IT Promotion",
  },
  {
    id: "function-0009",
    functionCode: "FNC0009",
    functionNameTh: "คลังสินค้า",
    functionNameEn: "",
  },
  {
    id: "function-0010",
    functionCode: "FNC0010",
    functionNameTh: "ผลิต",
    functionNameEn: "Production",
  },
  {
    id: "function-0011",
    functionCode: "FNC0011",
    functionNameTh: "วางแผนการผลิต",
    functionNameEn: "Production Planing",
  },
  {
    id: "function-0012",
    functionCode: "FNC0012",
    functionNameTh: "วิศวกรรมและซ่อมบำรุง",
    functionNameEn: "Engineering and Maintenance",
  },
  {
    id: "function-0013",
    functionCode: "FNC0013",
    functionNameTh: "คุณภาพ",
    functionNameEn: "Quality",
  },
  {
    id: "function-0014",
    functionCode: "FNC0014",
    functionNameTh: "ความปลอดภัยและสิ่งแวดล้อม",
    functionNameEn: "Safety and Environment",
  },
  {
    id: "function-0015",
    functionCode: "FNC0015",
    functionNameTh: "วิศวกรรมโครงการ",
    functionNameEn: "Project Engineering",
  },
  {
    id: "function-0016",
    functionCode: "FNC0016",
    functionNameTh: "สำนักงานกรรมการผู้จัดการ",
    functionNameEn: "President Office",
  },
  {
    id: "function-0017",
    functionCode: "FNC0017",
    functionNameTh: "อื่นๆ",
    functionNameEn: "Other",
  },
];

const emptyRecord = (): FunctionRecord => ({
  id: `function-${Date.now()}`,
  functionCode: "",
  functionNameTh: "",
  functionNameEn: "",
});

export default function FunctionData() {
  const [rows, setRows] = useState<FunctionRecord[]>(defaultFunctionRows);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(defaultFunctionRows[0]?.id ?? "");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formValues, setFormValues] = useState<FunctionRecord>(emptyRecord);

  const selectedRecord = rows.find((row) => row.id === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      [row.functionCode, row.functionNameTh, row.functionNameEn]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  const updateForm = (field: keyof FunctionRecord, value: string) => {
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
    setRows(defaultFunctionRows);
    setSearch("");
    setSelectedId(defaultFunctionRows[0]?.id ?? "");
    setFormMode(null);
  };

  const handleSave = () => {
    const nextRecord: FunctionRecord = {
      ...formValues,
      functionCode: formValues.functionCode.trim().toUpperCase(),
      functionNameTh: formValues.functionNameTh.trim(),
      functionNameEn: formValues.functionNameEn.trim(),
    };

    if (!nextRecord.functionCode || !nextRecord.functionNameTh) {
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

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search function data"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search function code or name"
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
                <h3>{formMode === "new" ? "Create Function" : formValues.functionCode}</h3>
              </div>
            </div>

            <div className={styles.formGrid}>
              <label>
                Function Code
                <input
                  value={formValues.functionCode}
                  onChange={(event) => updateForm("functionCode", event.target.value)}
                  placeholder="FNC0001"
                />
              </label>
              <label>
                Function Name(TH)
                <input
                  value={formValues.functionNameTh}
                  onChange={(event) => updateForm("functionNameTh", event.target.value)}
                  placeholder="ชื่อหน่วยงานภาษาไทย"
                />
              </label>
              <label>
                Function Name(EN)
                <input
                  value={formValues.functionNameEn}
                  onChange={(event) => updateForm("functionNameEn", event.target.value)}
                  placeholder="Function name in English"
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
                      <span className={styles.codePill}>{row.functionCode}</span>
                    </td>
                    <td>{row.functionNameTh}</td>
                    <td>{row.functionNameEn || "-"}</td>
                  </tr>
                ))}
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No function data found.</td>
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
