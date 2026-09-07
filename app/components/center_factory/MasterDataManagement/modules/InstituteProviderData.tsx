"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import {
  InstituteProviderClientError,
  createInstituteProvider,
  deleteInstituteProvider,
  listInstituteProviders,
  updateInstituteProvider,
} from "../../../../lib/instituteProviders/client";
import type {
  InstituteProviderRecord as ApiInstituteProviderRecord,
  InstituteProviderStatus,
} from "../../../../lib/instituteProviders/types";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./InstituteProviderData.module.css";

export const instituteProviderDataModule = {
  title: "Institute / Provider Data",
  subtitle: "Master Data Management",
  description:
    "จัดการข้อมูลสถาบันและผู้ให้บริการฝึกอบรม (Institute / Provider) สำหรับหลักสูตรภายนอกและภายใน",
};

type InstituteProviderForm = {
  instituteProviderCode: string;
  instituteProviderName: string;
};

const blankForm = (): InstituteProviderForm => ({
  instituteProviderCode: "",
  instituteProviderName: "",
});

const toForm = (record: ApiInstituteProviderRecord): InstituteProviderForm => ({
  instituteProviderCode: record.instituteProviderCode,
  instituteProviderName: record.instituteProviderName,
});

const CODE_PATTERN = /^([A-Za-z_-]+?)(\d+)$/;
const nextAutoCode = (existingCodes: string[], fallbackPrefix: string) => {
  const prefixCounts = new Map<string, number>();
  for (const code of existingCodes) {
    const match = code.trim().match(CODE_PATTERN);
    if (match) prefixCounts.set(match[1], (prefixCounts.get(match[1]) ?? 0) + 1);
  }
  let activePrefix = fallbackPrefix;
  let topCount = 0;
  for (const [prefix, count] of prefixCounts) {
    if (count > topCount) {
      topCount = count;
      activePrefix = prefix;
    }
  }
  let maxNumber = 0;
  let width = 4;
  for (const code of existingCodes) {
    const match = code.trim().match(CODE_PATTERN);
    if (!match || match[1] !== activePrefix) continue;
    const value = parseInt(match[2], 10);
    if (value > maxNumber) {
      maxNumber = value;
      width = match[2].length;
    }
  }
  return `${activePrefix}${String(maxNumber + 1).padStart(width, "0")}`;
};

const errorText = (error: unknown) =>
  error instanceof InstituteProviderClientError
    ? error.message
    : "Unable to load institute/provider data. Please try again.";

export default function InstituteProviderData() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const isCenter = user?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<ApiInstituteProviderRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<InstituteProviderForm>(blankForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected =
    rows.find((row) => row.instituteProviderId === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.instituteProviderCode, row.instituteProviderName]
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
      const items = (await listInstituteProviders()).items;
      setRows(items);
      setSelectedId((current) =>
        current && items.some((item) => item.instituteProviderId === current)
          ? current
          : items[0]?.instituteProviderId ?? null,
      );
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    listInstituteProviders()
      .then((result) => {
        if (!current) return;
        setRows(result.items);
        setSelectedId(result.items[0]?.instituteProviderId ?? null);
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

  const startNew = () => {
    if (!isCenter) return;
    setForm({
      instituteProviderCode: nextAutoCode(
        rows.map((item) => item.instituteProviderCode),
        "IP",
      ),
      instituteProviderName: "",
    });
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
    const editingId = selected?.instituteProviderId ?? null;
    if (savingMode === "edit" && !editingId) {
      setError(isThai ? "กรุณาเลือกสถาบัน/ผู้ให้บริการก่อนบันทึก" : "Select an Institute/Provider before saving changes.");
      return;
    }
    const missingFields: string[] = [];
    if (!form.instituteProviderCode.trim()) missingFields.push(isThai ? "รหัสสถาบัน / ผู้ให้บริการ (Institute / Provider Code)" : "Institute / Provider Code");
    if (!form.instituteProviderName.trim()) missingFields.push(isThai ? "ชื่อสถาบัน / ผู้ให้บริการ (Institute / Provider Name)" : "Institute / Provider Name");
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const input = {
        instituteProviderCode: form.instituteProviderCode.trim().toUpperCase(),
        instituteProviderName: form.instituteProviderName.trim(),
        status: "ACTIVE" as const,
      };
      const result =
        savingMode === "edit" && editingId
          ? await updateInstituteProvider(editingId, input)
          : await createInstituteProvider(input);
      setRows((current) =>
        savingMode === "edit"
          ? current.map((item) =>
              item.instituteProviderId === result.instituteProvider.instituteProviderId
                ? result.instituteProvider
                : item,
            )
          : [...current, result.instituteProvider],
      );
      void listInstituteProviders()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
      setSelectedId(result.instituteProvider.instituteProviderId);
      setFormMode(null);
      setForm(blankForm());
      toast.success(isThai ? `บันทึก ${result.instituteProvider.instituteProviderCode} แล้ว` : `Saved ${result.instituteProvider.instituteProviderCode}`);
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!isCenter || !selected || isSaving) {
      return;
    }
    if (
      !(await confirm({
        message: {
          th: `ยืนยันที่จะลบสถาบัน / ผู้ให้บริการ ${selected.instituteProviderCode} หรือไม่?`,
          en: `Confirm deleting ${selected.instituteProviderCode}?`,
        },
        danger: true,
      }))
    ) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await deleteInstituteProvider(selected.instituteProviderId);
      if (result.outcome === "DEACTIVATED") {
        setRows((current) =>
          current.map((item) =>
            item.instituteProviderId === result.instituteProvider.instituteProviderId
              ? result.instituteProvider
              : item,
          ),
        );
        toast.warning(
          isThai
            ? `${result.instituteProvider.instituteProviderCode} ยังถูกใช้งานในระบบ Training OAP จึงไม่สามารถลบออกจากระบบได้`
            : `${result.instituteProvider.instituteProviderCode} is still in use in Training OAP and cannot be deleted`,
        );
      } else {
        const nextRows = rows.filter(
          (item) => item.instituteProviderId !== result.instituteProvider.instituteProviderId,
        );
        setRows(nextRows);
        setSelectedId(nextRows[0]?.instituteProviderId ?? null);
        toast.success(isThai ? `ลบ ${result.instituteProvider.instituteProviderCode} แล้ว` : `Deleted ${result.instituteProvider.instituteProviderCode}`);
      }
      setFormMode(null);
      void listInstituteProviders()
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
    setSearch("");
    void loadRows();
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px", padding: "40px" }}>
        <TypewriterLoader label="กำลังโหลดข้อมูลสถาบัน/ผู้จัดอบรม (Institute / Provider)..." />
      </div>
    );
  }

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
            placeholder={isThai ? "ค้นหารหัส, ชื่อสถาบัน/ผู้ให้บริการ..." : "Search code, name..."}
          />
          {isCenter ? (
            <>
              <button
                className={styles.newButton}
                type="button"
                onClick={startNew}
                disabled={isSaving}
              >
                {isThai ? "เพิ่ม" : "Add"}
              </button>
              <button
                className={styles.editButton}
                type="button"
                onClick={startEdit}
                disabled={!selected || isSaving}
              >
                {isThai ? "แก้ไข" : "Edit"}
              </button>
              <button
                className={styles.deleteButton}
                type="button"
                onClick={() => void remove()}
                disabled={!selected || isSaving}
              >
                {isThai ? "ลบ" : "Delete"}
              </button>
            </>
          ) : null}
          <button
            className={styles.refreshButton}
            type="button"
            onClick={refresh}
            disabled={isLoading || isSaving}
          >
            {isThai ? "รีเฟรช" : "Refresh"}
          </button>
        </div>
      </section>

      {error ? <p role="alert">{error}</p> : null}

      {formMode ? (
        <section className={styles.formPanel}>
          <h3>
            {formMode === "new"
              ? (isThai ? "เพิ่มสถาบัน / ผู้ให้บริการ (Add Institute / Provider)" : "Add Institute / Provider")
              : (isThai ? `แก้ไขสถาบัน / ผู้ให้บริการ (Edit Institute / Provider) - ${form.instituteProviderCode}` : `Edit Institute / Provider - ${form.instituteProviderCode}`)}
          </h3>
          <div className={styles.formGrid}>
            <label>
              {isThai ? "รหัสสถาบัน / ผู้ให้บริการ (Code)" : "Institute / Provider Code"}{" "}
              {formMode === "new" ? (
                <span style={{ fontSize: "0.75rem", color: "var(--ui-30-primary)", fontWeight: 700 }}>
                  {isThai ? "(สร้างอัตโนมัติ)" : "(Auto)"}
                </span>
              ) : null}
              <input
                value={form.instituteProviderCode}
                maxLength={30}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instituteProviderCode: event.target.value,
                  }))
                }
                placeholder={isThai ? "เช่น IP0001 (สร้างให้อัตโนมัติ)" : "e.g. IP0001 (auto generated)"}
              />
            </label>
            <label>
              {isThai ? "ชื่อสถาบัน / ผู้ให้บริการ (Name)" : "Institute / Provider Name"}
              <input
                value={form.instituteProviderName}
                maxLength={255}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instituteProviderName: event.target.value,
                  }))
                }
                placeholder={isThai ? "เช่น สถาบันยานยนต์, Thai-German Institute" : "e.g. Thai-German Institute, ATA"}
              />
            </label>
            <div className={styles.fullWidth}>
              <button
                className={styles.saveButton}
                type="button"
                onClick={() => void save()}
                disabled={isSaving}
              >
                {isSaving
                  ? (isThai ? "กำลังบันทึก..." : "Saving...")
                  : formMode === "new"
                    ? (isThai ? "เพิ่มผู้ให้บริการ" : "Add Provider")
                    : (isThai ? "บันทึกการเปลี่ยนแปลง" : "Save Changes")}
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={() => {
                  setFormMode(null);
                  setForm(blankForm());
                }}
                disabled={isSaving}
              >
                {isThai ? "ยกเลิก" : "Cancel"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3>{isThai ? "รายการสถาบัน / ผู้ให้บริการ" : "Institute / Provider Records"}</h3>
          <span className={styles.itemCount}>
            {visibleRows.length} {isThai ? "รายการ" : "records"}
          </span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th style={{ width: "80px", textAlign: "center" }}>{isThai ? "ลำดับ" : "No."}</th>
                <th style={{ width: "180px" }}>{isThai ? "รหัส (Code)" : "Code"}</th>
                <th>{isThai ? "ชื่อสถาบัน / ผู้ให้บริการ (Name)" : "Name"}</th>
              </tr>
            </thead>
            <tbody translate="no">
              {visibleRows.map((row, index) => (
                <tr
                  className={
                    row.instituteProviderId === selectedId ? styles.selectedRow : undefined
                  }
                  key={row.instituteProviderId}
                  onClick={() => setSelectedId(row.instituteProviderId)}
                >
                  <td style={{ textAlign: "center" }}>{index + 1}</td>
                  <td>
                    <span className={styles.codeBadge}>{row.instituteProviderCode}</span>
                  </td>
                  <td>{row.instituteProviderName}</td>
                </tr>
              ))}
              {!isLoading && visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.emptyState}>
                    {isThai ? "ไม่พบข้อมูลสถาบัน / ผู้ให้บริการ" : "No institute / provider data found."}
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
