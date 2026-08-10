"use client";

import { useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
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
  Pick<CompanyRecord, "compNameTh" | "compNameEn" | "remark">
> = {
  ATA: {
    compNameTh: "บริษัท ไอชิน ทากาโอกะ เอเชีย จำกัด",
    compNameEn: "Aisin Takaoka Asia Co., Ltd.",
    remark: "700/89 หมู่ 1 ต.บ้านเก่า อ. พานทอง จ. ชลบุรี 20160",
  },
  TEP: {
    compNameTh: "บริษัท ผลิตภัณฑ์วิศวไทย จำกัด",
    compNameEn: "Thai Engineering Products Co., Ltd.",
    remark: "101/90 ถ. พหลโยธิน หมู่ 20 ต. คลองหนึ่ง อ. คลองหลวง จ. ปทุมธานี 12120",
  },
  ATFB: {
    compNameTh: "บริษัท ไอซิน ทาคาโอก้า ฟาวน์ดริ บางปะกง จำกัด",
    compNameEn: "Aisin Takaoka Foundry Bangpakong Co., Ltd.",
    remark: "700/89 หมู่ 1 ต.บ้านเก่า อ.พานทอง จ.ชลบุรี 20160",
  },
  NIC: {
    compNameTh: "บริษัท นวโลหะอุตสาหกรรม จำกัด",
    compNameEn: "The Nawaloha Industry Co., Ltd.",
    remark: "19 หมู่ 3 ถ.สุวรรณศร ต. บัวลอย อ. หนองแค จ. สระบุรี 18230",
  },
  SATI: {
    compNameTh: "บริษัท สยามเอทีอุตสาหกรรม จำกัด",
    compNameEn: "Siam AT Industry Co., Ltd.",
    remark: "700/463 หมู่ 7 ต.ดอนหัวฬ่อ อ.เมือง จ.ชลบุรี 20000",
  },
  SNF: {
    compNameTh: "บริษัท นวโลหะไทย จำกัด",
    compNameEn: "The Siam Nawaloha Foundry Co., Ltd.",
    remark: "เลขที่ 1 หมู่ 9 ต.บ้านครัว อ.บ้านหมอ จ. สระบุรี 18270",
  },
};

const defaultRows: CompanyRecord[] = companyCodes.map((compCode) => ({
  id: compCode,
  compCode,
  ...companyNameByCode[compCode],
}));

const createBlankRecord = (companyCode: CompanyCode = "ATA"): CompanyRecord => ({
  id: `company-${Date.now()}`,
  compCode: companyCode,
  ...companyNameByCode[companyCode],
});

export default function CompanyData() {
  const user = useAuthenticatedUser();
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const factoryCompanyCode = companyCodes.find(
    (companyCode) => companyCode === user?.companyCode,
  );
  const availableCompanyCodes: CompanyCode[] =
    isFactoryUser && factoryCompanyCode ? [factoryCompanyCode] : companyCodes;
  const [rows, setRows] = useState<CompanyRecord[]>(defaultRows);
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState<CompanyCode | "all">(
    isFactoryUser && factoryCompanyCode ? factoryCompanyCode : "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    factoryCompanyCode ?? defaultRows[0]?.id ?? null,
  );
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formValues, setFormValues] = useState<CompanyRecord>(() =>
    createBlankRecord(factoryCompanyCode),
  );

  const selectedRecord =
    rows.find(
      (row) =>
        row.id === selectedId &&
        (!isFactoryUser || row.compCode === factoryCompanyCode),
    ) ?? null;
  const visibleRows = rows.filter((row) => {
    const matchesFactoryScope =
      !isFactoryUser || row.compCode === factoryCompanyCode;
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

    return matchesFactoryScope && matchesSearch && matchesCode;
  });

  const handleCodeChange = (compCode: CompanyCode) => {
    if (isFactoryUser && compCode !== factoryCompanyCode) {
      return;
    }

    setFormValues((current) => ({
      ...current,
      compCode,
      ...companyNameByCode[compCode],
    }));
  };

  const handleNew = () => {
    setFormValues(createBlankRecord(factoryCompanyCode));
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
    setSelectedCode(isFactoryUser && factoryCompanyCode ? factoryCompanyCode : "all");
    setSelectedId(factoryCompanyCode ?? defaultRows[0]?.id ?? null);
    setFormMode(null);
  };

  const handleSave = () => {
    const nextRecord: CompanyRecord = {
      ...formValues,
      compCode: factoryCompanyCode ?? formValues.compCode,
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
              disabled={isFactoryUser}
              onChange={(event) => setSelectedCode(event.target.value as CompanyCode | "all")}
            >
              {!isFactoryUser ? <option value="all">All comp code</option> : null}
              {availableCompanyCodes.map((compCode) => (
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
                disabled={isFactoryUser}
                onChange={(event) => handleCodeChange(event.target.value as CompanyCode)}
              >
                {availableCompanyCodes.map((compCode) => (
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
