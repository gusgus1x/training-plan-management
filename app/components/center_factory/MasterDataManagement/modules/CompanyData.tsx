"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import {
  TRAINING_MASTER_EVENT,
  TRAINING_MASTER_KEYS,
  readMasterCollection,
  writeMasterCollection,
} from "../../../../lib/trainingWorkflow";
import styles from "./CompanyData.module.css";

export type CompanyCode = "ATA" | "TEP" | "ATFB" | "NIC" | "SATI" | "SNF";

export type CompanyRecord = {
  id: string;
  compId: string;
  compCode: CompanyCode;
  compNameTh: string;
  compNameEn: string;
  remark: string;
};

type FormMode = "new" | "edit" | null;

export const companyDataModule = {
  title: "Company Data",
  subtitle: "Company master",
  description: "Store and maintain company master data with Comp ID, company code, names, and address details.",
} as const;

export const companyCodes: CompanyCode[] = ["ATA", "TEP", "ATFB", "NIC", "SATI", "SNF"];

export const companyNameByCode: Record<
  CompanyCode,
  Pick<CompanyRecord, "compId" | "compNameTh" | "compNameEn" | "remark">
> = {
  ATA: {
    compId: "1290",
    compNameTh: "บริษัท ไอชิน ทากาโอกะ เอเชีย จำกัด",
    compNameEn: "Aisin Takaoka Asia Co., Ltd.",
    remark: "700/89 หมู่ 1 ต.บ้านเก่า อ. พานทอง จ. ชลบุรี 20160",
  },
  TEP: {
    compId: "0450",
    compNameTh: "บริษัท ผลิตภัณฑ์วิศวไทย จำกัด",
    compNameEn: "Thai Engineering Products Co., Ltd.",
    remark: "101/90 ถ. พหลโยธิน หมู่ 20 ต. คลองหนึ่ง อ. คลองหลวง จ. ปทุมธานี 12120",
  },
  ATFB: {
    compId: "1510",
    compNameTh: "บริษัท ไอซิน ทาคาโอก้า ฟาวน์ดริ บางปะกง จำกัด",
    compNameEn: "Aisin Takaoka Foundry Bangpakong Co., Ltd.",
    remark: "700/89 หมู่ 1 ต.บ้านเก่า อ.พานทอง จ.ชลบุรี 20160",
  },
  NIC: {
    compId: "0420",
    compNameTh: "บริษัท นวโลหะอุตสาหกรรม จำกัด",
    compNameEn: "The Nawaloha Industry Co., Ltd.",
    remark: "19 หมู่ 3 ถ.สุวรรณศร ต. บัวลอย อ. หนองแค จ. สระบุรี 18230",
  },
  SATI: {
    compId: "1120",
    compNameTh: "บริษัท สยามเอทีอุตสาหกรรม จำกัด",
    compNameEn: "Siam AT Industry Co., Ltd.",
    remark: "700/463 หมู่ 7 ต.ดอนหัวฬ่อ อ.เมือง จ.ชลบุรี 20000",
  },
  SNF: {
    compId: "0430",
    compNameTh: "บริษัท นวโลหะไทย จำกัด",
    compNameEn: "The Siam Nawaloha Foundry Co., Ltd.",
    remark: "เลขที่ 1 หมู่ 9 ต.บ้านครัว อ.บ้านหมอ จ. สระบุรี 18270",
  },
};

export const defaultCompanyRows: CompanyRecord[] = companyCodes.map((compCode) => ({
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

  const [rows, setRows] = useState<CompanyRecord[]>(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.companies, defaultCompanyRows),
  );
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState<CompanyCode | "all">(
    isFactoryUser && factoryCompanyCode ? factoryCompanyCode : "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    factoryCompanyCode ?? defaultCompanyRows[0]?.id ?? null,
  );
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formValues, setFormValues] = useState<CompanyRecord>(() =>
    createBlankRecord(factoryCompanyCode),
  );

  useEffect(() => {
    const handleMasterChange = () => {
      setRows(readMasterCollection(TRAINING_MASTER_KEYS.companies, defaultCompanyRows));
    };

    window.addEventListener(TRAINING_MASTER_EVENT, handleMasterChange);
    return () => window.removeEventListener(TRAINING_MASTER_EVENT, handleMasterChange);
  }, []);

  const saveCompanies = (nextRows: CompanyRecord[]) => {
    setRows(nextRows);
    writeMasterCollection(TRAINING_MASTER_KEYS.companies, nextRows);
  };

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
      row.compId,
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

    const nextRows = rows.filter((row) => row.id !== selectedRecord.id);
    saveCompanies(nextRows);
    setSelectedId(null);
    setFormMode(null);
  };

  const handleRefresh = () => {
    saveCompanies(defaultCompanyRows);
    setSearch("");
    setSelectedCode(isFactoryUser && factoryCompanyCode ? factoryCompanyCode : "all");
    setSelectedId(factoryCompanyCode ?? defaultCompanyRows[0]?.id ?? null);
    setFormMode(null);
  };

  const handleSave = () => {
    const nextRecord: CompanyRecord = {
      ...formValues,
      compId: formValues.compId.trim(),
      compCode: factoryCompanyCode ?? formValues.compCode,
      compNameTh:
        formValues.compNameTh.trim() || companyNameByCode[formValues.compCode].compNameTh,
      compNameEn:
        formValues.compNameEn.trim() || companyNameByCode[formValues.compCode].compNameEn,
      remark: formValues.remark.trim(),
    };

    let nextRows: CompanyRecord[];
    if (formMode === "edit") {
      nextRows = rows.map((row) => (row.id === nextRecord.id ? nextRecord : row));
    } else {
      nextRows = [nextRecord, ...rows];
    }

    saveCompanies(nextRows);
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
            Companies
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
              placeholder="Search by company code, ID, or name"
            />
            <select
              aria-label="Filter company code"
              value={selectedCode}
              disabled={isFactoryUser}
              onChange={(event) => setSelectedCode(event.target.value as CompanyCode | "all")}
            >
              {!isFactoryUser ? <option value="all">All companies</option> : null}
              {availableCompanyCodes.map((compCode) => (
                <option key={compCode} value={compCode}>
                  {compCode} ({companyNameByCode[compCode]?.compId})
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
            <h3>Company Master Table (ตารางข้อมูลบริษัท)</h3>
            <p>{visibleRows.length} companies from Master Data</p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Comp ID</th>
                <th>Comp Code</th>
                <th>Comp Name (TH)</th>
                <th>Comp Name (EN)</th>
                <th>Remark / Address</th>
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
                    <span className={styles.codePill}>{row.compId || "-"}</span>
                  </td>
                  <td>
                    <strong>{row.compCode}</strong>
                  </td>
                  <td>{row.compNameTh}</td>
                  <td>{row.compNameEn}</td>
                  <td>{row.remark || "-"}</td>
                </tr>
              ))}
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>No company data found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {formMode ? (
        <section className={styles.formPanel}>
          <h3>{formMode === "new" ? "New Company" : `Edit Company (${formValues.compCode})`}</h3>
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
              Comp ID
              <input
                value={formValues.compId}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    compId: event.target.value,
                  }))
                }
                placeholder="e.g. 1290, 0450, 1510"
              />
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
              Remark / Address
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
