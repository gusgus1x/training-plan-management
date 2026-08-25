"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CompanyClientError,
  createCompany,
  deleteCompany,
  listCompanies,
  updateCompany,
} from "../../../../lib/companies/client";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import type {
  CompanyRecord,
  CompanyStatus,
  CreateCompanyInput,
} from "../../../../lib/companies/types";
import styles from "./CompanyData.module.css";

type FormMode = "new" | "edit" | null;

type CompanyForm = {
  companyCode: string;
  companyNameTh: string;
  companyNameEn: string;
  remark: string;
  status: CompanyStatus;
};

export const companyDataModule = {
  title: "Company Data",
  subtitle: "Company master",
  description: "Store and maintain company master data.",
} as const;

const createBlankForm = (): CompanyForm => ({
  companyCode: "",
  companyNameTh: "",
  companyNameEn: "",
  remark: "",
  status: "ACTIVE",
});

const toCompanyForm = (company: CompanyRecord): CompanyForm => ({
  companyCode: company.companyCode,
  companyNameTh: company.companyNameTh,
  companyNameEn: company.companyNameEn ?? "",
  remark: company.remark ?? "",
  status: company.status,
});

const toCreateInput = (form: CompanyForm): CreateCompanyInput => ({
  companyCode: form.companyCode.trim().toUpperCase(),
  companyNameTh: form.companyNameTh.trim(),
  companyNameEn: form.companyNameEn.trim() || null,
  remark: form.remark.trim() || null,
  status: form.status,
});

const readableError = (error: unknown) =>
  error instanceof CompanyClientError
    ? error.message
    : "Unable to load company data. Please try again.";

export default function CompanyData() {
  const authenticatedUser = useAuthenticatedUser();
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();
  const canCreateCompany = authenticatedUser?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<CompanyRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formValues, setFormValues] = useState<CompanyForm>(createBlankForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRecord =
    rows.find((row) => row.companyId === selectedId) ?? null;
  const canModifySelected = authenticatedUser?.roleCode === "HRD_CENTER";
  const companyCodes = useMemo(
    () => [...new Set(rows.map((row) => row.companyCode))].sort(),
    [rows],
  );
  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        const searchableText = [
          row.companyCode,
          row.companyNameTh,
          row.companyNameEn,
          row.remark,
          row.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesSearch = searchableText.includes(
          search.trim().toLowerCase(),
        );
        const matchesCode =
          selectedCode === "all" || row.companyCode === selectedCode;

        return matchesSearch && matchesCode;
      }),
    [rows, search, selectedCode],
  );

  const loadRows = async (preferredCompanyId?: string | null) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await listCompanies();
      const nextRows = result.items;
      const nextSelectedId =
        preferredCompanyId &&
        nextRows.some((row) => row.companyId === preferredCompanyId)
          ? preferredCompanyId
          : nextRows[0]?.companyId ?? null;

      setRows(nextRows);
      setSelectedId(nextSelectedId);
    } catch (error: unknown) {
      setRows([]);
      setSelectedId(null);
      setErrorMessage(readableError(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;

    listCompanies()
      .then((result) => {
        if (!isCurrent) {
          return;
        }

        setRows(result.items);
        setSelectedId(result.items[0]?.companyId ?? null);
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return;
        }

        setRows([]);
        setSelectedId(null);
        setErrorMessage(readableError(error));
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleNew = () => {
    setFormValues(createBlankForm());
    setErrorMessage(null);
    setFormMode("new");
  };

  const handleEdit = () => {
    if (!selectedRecord || !canModifySelected) {
      return;
    }

    setFormValues(toCompanyForm(selectedRecord));
    setErrorMessage(null);
    setFormMode("edit");
  };

  const handleDelete = async () => {
    if (!selectedRecord || !canModifySelected || isSaving) {
      return;
    }

    if (
      !(await confirm({
        message: `Delete company ${selectedRecord.companyCode}? This action cannot be undone.`,
        confirmLabel: "Delete",
        danger: true,
      }))
    ) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result = await deleteCompany(selectedRecord.companyId);
      const nextRows = rows.filter(
        (row) => row.companyId !== result.company.companyId,
      );

      setRows(nextRows);
      setSelectedId(nextRows[0]?.companyId ?? null);
      setFormMode(null);
      toast.success(`ลบบริษัท ${result.company.companyCode} แล้ว / Company deleted`);
      void listCompanies()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
    } catch (error: unknown) {
      setErrorMessage(readableError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = () => {
    setSearch("");
    setSelectedCode("all");
    setFormMode(null);
    setFormValues(createBlankForm());
    void loadRows(selectedId);
  };

  const handleSave = async () => {
    if (isSaving || !formMode) {
      return;
    }
    const savingMode = formMode;
    const editingCompanyId = selectedRecord?.companyId ?? null;

    if (savingMode === "edit" && !editingCompanyId) {
      setErrorMessage("Select a company before saving changes.");
      return;
    }

    const input = toCreateInput(formValues);

    const missingFields: string[] = [];
    if (!input.companyCode) missingFields.push("รหัสบริษัท (Company Code)");
    if (!input.companyNameTh) missingFields.push("ชื่อบริษัท ภาษาไทย (Company Name TH)");
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result =
        savingMode === "edit" && editingCompanyId
          ? await updateCompany(editingCompanyId, input)
          : await createCompany(input);

      setRows((current) =>
        savingMode === "edit"
          ? current.map((row) =>
              row.companyId === result.company.companyId
                ? result.company
                : row,
            )
          : [result.company, ...current],
      );
      void listCompanies()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
      setSelectedId(result.company.companyId);
      setFormMode(null);
      setFormValues(createBlankForm());
      toast.success(`บันทึกบริษัท ${result.company.companyCode} แล้ว / Company saved`);
    } catch (error: unknown) {
      setErrorMessage(readableError(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      className={styles.moduleWorkspace}
      aria-label="Company Data module"
    >
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
              onChange={(event) => setSelectedCode(event.target.value)}
            >
              <option value="all">All comp code</option>
              {companyCodes.map((companyCode) => (
                <option key={companyCode} value={companyCode}>
                  {companyCode}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.actionGroup}>
            {canCreateCompany ? (
              <button
                className={styles.actionButton}
                type="button"
                onClick={handleNew}
                disabled={isSaving}
              >
                New
              </button>
            ) : null}
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleEdit}
              disabled={!canModifySelected || isSaving}
            >
              Edit
            </button>
            <button
              className={styles.dangerButton}
              type="button"
              onClick={() => void handleDelete()}
              disabled={!canModifySelected || isSaving}
            >
              Delete
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleRefresh}
              disabled={isLoading || isSaving}
            >
              Refresh
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className={styles.errorMessage} role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className={styles.panel} aria-busy={isLoading}>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Company Records</h3>
            <p>{isLoading ? "Loading company data..." : `${visibleRows.length} records`}</p>
          </div>
          <span className={styles.selectedHint}>
            {selectedRecord
              ? `Selected: ${selectedRecord.companyCode}`
              : "Select a row"}
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody translate="no">
              {!isLoading
                ? visibleRows.map((row, index) => (
                    <tr
                      className={
                        row.companyId === selectedId
                          ? styles.selectedRow
                          : undefined
                      }
                      key={row.companyId}
                      onClick={() => setSelectedId(row.companyId)}
                    >
                      <td>{index + 1}</td>
                      <td>
                        <span className={styles.codePill}>
                          {row.companyCode}
                        </span>
                      </td>
                      <td>{row.companyNameTh}</td>
                      <td>{row.companyNameEn ?? "-"}</td>
                      <td>{row.remark ?? "-"}</td>
                      <td>
                        <span
                          className={`${styles.statusPill} ${
                            row.status === "INACTIVE"
                              ? styles.inactiveStatus
                              : ""
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                : null}
              {!isLoading && visibleRows.length === 0 ? (
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
          <h3>{formMode === "new" ? "New Company" : "Edit Company"}</h3>
          <div className={styles.formGrid}>
            <label>
              Comp Code
              <input
                value={formValues.companyCode}
                maxLength={30}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    companyCode: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>
            <label>
              Comp Name (TH)
              <input
                value={formValues.companyNameTh}
                maxLength={255}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    companyNameTh: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Comp Name (EN)
              <input
                value={formValues.companyNameEn}
                maxLength={255}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    companyNameEn: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Status
              <select
                value={formValues.status}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    status: event.target.value as CompanyStatus,
                  }))
                }
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
            <label className={styles.fullWidth}>
              Remark
              <textarea
                value={formValues.remark}
                maxLength={500}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    remark: event.target.value,
                  }))
                }
              />
            </label>
            <div className={styles.formActions}>
              <button
                className={styles.actionButton}
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => setFormMode(null)}
                disabled={isSaving}
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
