"use client";

import { useState } from "react";
import {
  TRAINING_MASTER_KEYS,
  readMasterCollection,
  writeMasterCollection,
} from "../../../../lib/trainingWorkflow";
import styles from "./InstituteProviderData.module.css";

export const instituteProviderDataModule = {
  title: "Institute / Provider Data",
  subtitle: "Master Data Management",
  description:
    "จัดการข้อมูลสถาบันและผู้ให้บริการฝึกอบรม (Institute / Provider) สำหรับหลักสูตรภายนอกและภายใน",
};

export type InstituteProviderRecord = {
  id: string;
  code: string;
  name: string;
  remark: string;
  logDate: string;
};

export const defaultInstituteProviderRows: InstituteProviderRecord[] = [
  {
    id: "provider-001",
    code: "ATA",
    name: "ATA",
    remark: "-",
    logDate: "2026-08-01",
  },
  {
    id: "provider-002",
    code: "TGI",
    name: "Thai-German Institute",
    remark: "-",
    logDate: "2026-08-01",
  },
];

const emptyForm = {
  code: "",
  name: "",
  remark: "",
};

export default function InstituteProviderData() {
  const [rows, setRows] = useState<InstituteProviderRecord[]>(() =>
    readMasterCollection(
      TRAINING_MASTER_KEYS.instituteProviders,
      defaultInstituteProviderRows,
    ),
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(defaultInstituteProviderRows[0]?.id ?? "");
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [formValues, setFormValues] = useState(emptyForm);

  const selectedRecord = rows.find((row) => row.id === selectedId) ?? null;
  const visibleRows = rows.filter((row) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      [row.code, row.name, row.remark, row.logDate]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  });

  const handleFormChange = (field: keyof typeof emptyForm, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const handleAddRecord = () => {
    const nextRow: InstituteProviderRecord = {
      id:
        formMode === "edit" && selectedRecord
          ? selectedRecord.id
          : `provider-${Date.now()}`,
      code: formValues.code.trim() || `PRV-${Date.now().toString().slice(-4)}`,
      name: formValues.name.trim() || "New Provider",
      remark: formValues.remark.trim() || "-",
      logDate:
        formMode === "edit" && selectedRecord
          ? selectedRecord.logDate
          : new Date().toISOString().slice(0, 10),
    };

    const nextRows =
      formMode === "edit"
        ? rows.map((row) => (row.id === nextRow.id ? nextRow : row))
        : [nextRow, ...rows];
    setRows(nextRows);
    writeMasterCollection(TRAINING_MASTER_KEYS.instituteProviders, nextRows);
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
      code: selectedRecord.code,
      name: selectedRecord.name,
      remark: selectedRecord.remark,
    });
    setFormMode("edit");
  };

  const handleDelete = () => {
    if (!selectedRecord) {
      return;
    }

    const nextRows = rows.filter((row) => row.id !== selectedRecord.id);
    setRows(nextRows);
    writeMasterCollection(TRAINING_MASTER_KEYS.instituteProviders, nextRows);
    setSelectedId(nextRows[0]?.id ?? "");
    setFormMode(null);
  };

  const handleRefresh = () => {
    const nextRows = readMasterCollection(
      TRAINING_MASTER_KEYS.instituteProviders,
      defaultInstituteProviderRows,
    );
    setRows(nextRows);
    setSearch("");
    setSelectedId(nextRows[0]?.id ?? "");
    setFormMode(null);
    setFormValues(emptyForm);
  };

  return (
    <section
      className={styles.moduleWorkspace}
      aria-label="Institute / Provider Data module"
    >
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{instituteProviderDataModule.subtitle}</p>
          <h2>{instituteProviderDataModule.title}</h2>
          <p>{instituteProviderDataModule.description}</p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search institute / provider records"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code, name, remark, log date..."
          />
          <button className={styles.newButton} type="button" onClick={handleNew}>
            New
          </button>
          <button
            className={styles.editButton}
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
          <button
            className={styles.refreshButton}
            type="button"
            onClick={handleRefresh}
          >
            Refresh
          </button>
        </div>
      </section>

      {formMode ? (
        <section className={styles.formPanel}>
          <h3>
            {formMode === "new"
              ? "Add Institute / Provider"
              : "Edit Institute / Provider"}
          </h3>
          <p>
            {formMode === "new"
              ? "Log Date is recorded automatically when a new record is added."
              : "Log Date is kept from the selected record."}
          </p>
          <div className={styles.formGrid}>
            <label>
              Code
              <input
                value={formValues.code}
                onChange={(event) => handleFormChange("code", event.target.value)}
                placeholder="e.g. ATA, TGI"
              />
            </label>
            <label>
              Name
              <input
                value={formValues.name}
                onChange={(event) => handleFormChange("name", event.target.value)}
                placeholder="e.g. ATA, Thai-German Institute"
              />
            </label>
            <label>
              Remark
              <input
                value={formValues.remark}
                onChange={(event) =>
                  handleFormChange("remark", event.target.value)
                }
                placeholder="Additional notes"
              />
            </label>
            <div className={styles.fullWidth}>
              <button
                className={styles.saveButton}
                type="button"
                onClick={handleAddRecord}
              >
                {formMode === "new" ? "Add Provider" : "Save Changes"}
              </button>
              <button
                className={styles.cancelButton}
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
        <div className={styles.panelHeader}>
          <h3>Institute / Provider Records</h3>
          <span className={styles.itemCount}>{visibleRows.length} records</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Code</th>
                <th>Name</th>
                <th>Remark</th>
                <th>Log Date</th>
              </tr>
            </thead>
            <tbody translate="no">
              {visibleRows.map((row, index) => (
                <tr
                  className={row.id === selectedId ? styles.selectedRow : undefined}
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                >
                  <td>{index + 1}</td>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.remark}</td>
                  <td>{row.logDate}</td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>
                    No institute / provider data found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
