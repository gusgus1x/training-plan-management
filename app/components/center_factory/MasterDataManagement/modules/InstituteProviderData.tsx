"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
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
  status: InstituteProviderStatus;
};

const blankForm = (): InstituteProviderForm => ({
  instituteProviderCode: "",
  instituteProviderName: "",
  status: "ACTIVE",
});

const toForm = (record: ApiInstituteProviderRecord): InstituteProviderForm => ({
  instituteProviderCode: record.instituteProviderCode,
  instituteProviderName: record.instituteProviderName,
  status: record.status,
});

const errorText = (error: unknown) =>
  error instanceof InstituteProviderClientError
    ? error.message
    : "Unable to load institute/provider data. Please try again.";

export default function InstituteProviderData() {
  const user = useAuthenticatedUser();
  const isCenter = user?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<ApiInstituteProviderRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<InstituteProviderForm>(blankForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected =
    rows.find((row) => row.instituteProviderId === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.instituteProviderCode, row.instituteProviderName, row.status]
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
    setForm(blankForm());
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
      setError("Select an Institute/Provider before saving changes.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const input = {
        instituteProviderCode: form.instituteProviderCode.trim().toUpperCase(),
        instituteProviderName: form.instituteProviderName.trim(),
        status: form.status,
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
      setMessage(`${result.instituteProvider.instituteProviderCode} was saved.`);
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (
      !isCenter ||
      !selected ||
      isSaving ||
      !window.confirm(`Delete ${selected.instituteProviderCode}?`)
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
        setMessage(
          `${result.instituteProvider.instituteProviderCode} is still used by Training OAP, so it was deactivated instead of deleted.`,
        );
      } else {
        const nextRows = rows.filter(
          (item) => item.instituteProviderId !== result.instituteProvider.instituteProviderId,
        );
        setRows(nextRows);
        setSelectedId(nextRows[0]?.instituteProviderId ?? null);
        setMessage(`${result.instituteProvider.instituteProviderCode} was deleted.`);
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
    setMessage(null);
    setSearch("");
    void loadRows();
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
            placeholder="Search code, name, status..."
          />
          {isCenter ? (
            <>
              <button
                className={styles.newButton}
                type="button"
                onClick={startNew}
                disabled={isSaving}
              >
                New
              </button>
              <button
                className={styles.editButton}
                type="button"
                onClick={startEdit}
                disabled={!selected || isSaving}
              >
                Edit
              </button>
              <button
                className={styles.deleteButton}
                type="button"
                onClick={() => void remove()}
                disabled={!selected || isSaving}
              >
                Delete
              </button>
            </>
          ) : null}
          <button
            className={styles.refreshButton}
            type="button"
            onClick={refresh}
            disabled={isLoading || isSaving}
          >
            Refresh
          </button>
        </div>
      </section>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      {formMode ? (
        <section className={styles.formPanel}>
          <h3>
            {formMode === "new" ? "Add Institute / Provider" : "Edit Institute / Provider"}
          </h3>
          <div className={styles.formGrid}>
            <label>
              Code
              <input
                value={form.instituteProviderCode}
                maxLength={30}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instituteProviderCode: event.target.value,
                  }))
                }
                placeholder="e.g. ATA, TGI"
              />
            </label>
            <label>
              Name
              <input
                value={form.instituteProviderName}
                maxLength={255}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instituteProviderName: event.target.value,
                  }))
                }
                placeholder="e.g. ATA, Thai-German Institute"
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as InstituteProviderStatus,
                  }))
                }
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
            <div className={styles.fullWidth}>
              <button
                className={styles.saveButton}
                type="button"
                onClick={() => void save()}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : formMode === "new" ? "Add Provider" : "Save Changes"}
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
                <th>Status</th>
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
                  <td>{index + 1}</td>
                  <td>{row.instituteProviderCode}</td>
                  <td>{row.instituteProviderName}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
              {!isLoading && visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.emptyState}>
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
