"use client";

import { useMemo, useState } from "react";
import styles from "./CompanyData.module.css";

type CompanyCode = "ATA" | "TEP" | "ATFB" | "NIC" | "SATI" | "SNF";

type CompanyRecord = {
  id: string;
  compCode: CompanyCode;
  compNameTh: string;
  compNameEn: string;
  remark: string;
};

type FormMode = "new" | "edit" | null;

export const companyDataModule = {
  title: "Company Data",
  subtitle: "Company master",
  description: "Store and maintain company master data.",
} as const;

const companyCodes: CompanyCode[] = ["ATA", "TEP", "ATFB", "NIC", "SATI", "SNF"];

const companyNameByCode: Record<
  CompanyCode,
  Pick<CompanyRecord, "compNameTh" | "compNameEn">
> = {
  ATA: {
    compNameTh: "บริษัท ไอซิน ทาคาโอกะ เอเชีย จำกัด",
    compNameEn: "Aisin Takaoka Asia Co., Ltd.",
  },
  TEP: {
    compNameTh: "บริษัท ไทย เอ็นจิเนียริ่ง โปรดักส์ จำกัด",
    compNameEn: "Thai Engineering Products Co., Ltd.",
  },
  ATFB: {
    compNameTh: "บริษัท ไอซิน ทาคาโอกะ ฟาวน์ดรี บางปะกง จำกัด",
    compNameEn: "Aisin Takaoka Foundry Bangpakong Co., Ltd.",
  },
  NIC: {
    compNameTh: "บริษัท เดอะ นวโลหะ อินดัสทรี จำกัด",
    compNameEn: "The Nawaloha Industry Co., Ltd.",
  },
  SATI: {
    compNameTh: "บริษัท สยาม เอที อินดัสทรี จำกัด",
    compNameEn: "Siam AT Industry Co., Ltd.",
  },
  SNF: {
    compNameTh: "บริษัท เดอะ สยาม นวโลหะ ฟาวน์ดรี จำกัด",
    compNameEn: "The Siam Nawaloha Foundry Co., Ltd.",
  },
};

const defaultRows: CompanyRecord[] = companyCodes.map((compCode) => ({
  id: compCode,
  compCode,
  ...companyNameByCode[compCode],
  remark: "",
}));

const createBlankRecord = (): CompanyRecord => ({
  id: `company-${Date.now()}`,
  compCode: "ATA",
  ...companyNameByCode.ATA,
  remark: "",
});

export default function CompanyData() {
  const [rows, setRows] = useState<CompanyRecord[]>(defaultRows);
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState<CompanyCode | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(defaultRows[0]?.id ?? null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formValues, setFormValues] = useState<CompanyRecord>(createBlankRecord);

  const selectedRecord = rows.find((row) => row.id === selectedId) ?? null;
  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        const searchableText = [
          row.compCode,
          row.compNameTh,
          row.compNameEn,
          row.remark,
        ]
          .join(" ")
          .toLowerCase();
        const matchesSearch = searchableText.includes(search.toLowerCase());
        const matchesCode = selectedCode === "all" || row.compCode === selectedCode;

        return matchesSearch && matchesCode;
      }),
    [rows, search, selectedCode],
  );

  const handleCodeChange = (compCode: CompanyCode) => {
    setFormValues((current) => ({
      ...current,
      compCode,
      ...companyNameByCode[compCode],
    }));
  };

  const handleNew = () => {
    setFormValues(createBlankRecord());
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
    setSelectedId(null);
    setFormMode(null);
  };

  const handleRefresh = () => {
    setRows(defaultRows);
    setSearch("");
    setSelectedCode("all");
    setSelectedId(defaultRows[0]?.id ?? null);
    setFormMode(null);
  };

  const handleSave = () => {
    const nextRecord: CompanyRecord = {
      ...formValues,
      compNameTh:
        formValues.compNameTh.trim() || companyNameByCode[formValues.compCode].compNameTh,
      compNameEn:
        formValues.compNameEn.trim() || companyNameByCode[formValues.compCode].compNameEn,
      remark: formValues.remark.trim(),
    };

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
    <section className={styles.moduleWorkspace} aria-label="Company Data module">
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{companyDataModule.subtitle}</p>
          <h2>{companyDataModule.title}</h2>
          <p>{companyDataModule.description}</p>
        </div>
        <div className={styles.heroStats} aria-label="Company data summary">
          <span>
            <strong>{rows.length}</strong>
            Records
          </span>
          <span>
            <strong>{selectedCode === "all" ? "ALL" : selectedCode}</strong>
            Filter
          </span>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            <input
              aria-label="Search company records"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company data"
            />
            <select
              aria-label="Filter company code"
              value={selectedCode}
              onChange={(event) => setSelectedCode(event.target.value as CompanyCode | "all")}
            >
              <option value="all">All comp code</option>
              {companyCodes.map((compCode) => (
                <option key={compCode} value={compCode}>
                  {compCode}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.actionGroup}>
            <button className={styles.actionButton} type="button" onClick={handleNew}>
              New
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleEdit}
              disabled={!selectedRecord}
            >
              Edit
            </button>
            <button
              className={styles.dangerButton}
              type="button"
              onClick={handleDelete}
              disabled={!selectedRecord}
            >
              Delete
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleRefresh}>
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Company Records</h3>
            <p>{visibleRows.length} records</p>
          </div>
          <span className={styles.selectedHint}>
            {selectedRecord ? `Selected: ${selectedRecord.compCode}` : "Select a row"}
          </span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Comp Code</th>
                <th>Comp Name (TH)</th>
                <th>Comp Name (EN)</th>
                <th>Remark</th>
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
                    <span className={styles.codePill}>{row.compCode}</span>
                  </td>
                  <td>{row.compNameTh}</td>
                  <td>{row.compNameEn}</td>
                  <td>{row.remark || "-"}</td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>No company data found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {formMode ? (
        <section className={styles.formPanel}>
          <h3>{formMode === "new" ? "New Company" : "Edit Company"}</h3>
          <div className={styles.formGrid}>
            <label>
              Comp Code
              <select
                value={formValues.compCode}
                onChange={(event) => handleCodeChange(event.target.value as CompanyCode)}
              >
                {companyCodes.map((compCode) => (
                  <option key={compCode} value={compCode}>
                    {compCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Comp Name (TH)
              <input
                value={formValues.compNameTh}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    compNameTh: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Comp Name (EN)
              <input
                value={formValues.compNameEn}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    compNameEn: event.target.value,
                  }))
                }
              />
            </label>
            <label className={styles.fullWidth}>
              Remark
              <textarea
                value={formValues.remark}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    remark: event.target.value,
                  }))
                }
              />
            </label>
            <div className={styles.formActions}>
              <button className={styles.actionButton} type="button" onClick={handleSave}>
                Save
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setFormMode(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
