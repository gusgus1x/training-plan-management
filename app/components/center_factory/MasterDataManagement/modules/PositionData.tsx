"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import {
  PositionClientError,
  createPosition,
  deletePosition,
  listPositions,
  updatePosition,
} from "../../../../lib/positions/client";
import type {
  PositionRecord as ApiPositionRecord,
  PositionStatus,
} from "../../../../lib/positions/types";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./PositionData.module.css";

export type PositionRecord = {
  id: string;
  positionCode: string;
  positionNameTh: string;
  positionNameEn: string;
  remark: string;
};

export const positionDataModule = {
  title: "Position Data",
  subtitle: "Position master",
  description:
    "Maintain the shared position catalog used by every company.",
} as const;

// Temporary compatibility export for mock consumers awaiting API migration.
export const defaultPositionRows: PositionRecord[] = [
  {
    id: "position-pres",
    positionCode: "pres",
    positionNameTh: "ประธานบริษัท",
    positionNameEn: "President",
    remark: "ประธานบริษัท / President",
  },
  {
    id: "position-evp",
    positionCode: "evp",
    positionNameTh: "รองประธานบริหาร",
    positionNameEn: "Executive Vice President",
    remark: "รองประธานบริหาร / Executive Vice President",
  },
  {
    id: "position-vp",
    positionCode: "vp",
    positionNameTh: "รองประธาน",
    positionNameEn: "Vice President",
    remark: "รองประธาน / Vice President",
  },
  {
    id: "position-sadv",
    positionCode: "sadv",
    positionNameTh: "ที่ปรึกษาอาวุโส",
    positionNameEn: "Senior Advisor",
    remark: "ที่ปรึกษาอาวุโส / Senior Advisor",
  },
  {
    id: "position-adv",
    positionCode: "adv",
    positionNameTh: "ที่ปรึกษา",
    positionNameEn: "Advisor",
    remark: "ที่ปรึกษา / Advisor",
  },
  {
    id: "position-sec",
    positionCode: "sec",
    positionNameTh: "ผู้ประสานงานบริหารอาวุโส",
    positionNameEn: "Senior Executive Coordinator",
    remark: "ผู้ประสานงานบริหารอาวุโส / Senior Executive Coordinator",
  },
  {
    id: "position-pm",
    positionCode: "pm",
    positionNameTh: "ผู้จัดการโรงงาน",
    positionNameEn: "Plant Manager",
    remark: "ผู้จัดการโรงงาน / Plant Manager",
  },
  {
    id: "position-egm",
    positionCode: "egm",
    positionNameTh: "ผู้จัดการทั่วไปฝ่ายบริหาร",
    positionNameEn: "Executive General Manager",
    remark: "ผู้จัดการทั่วไปฝ่ายบริหาร / Executive General Manager",
  },
  {
    id: "position-sgm",
    positionCode: "sgm",
    positionNameTh: "ผู้จัดการทั่วไปอาวุโส",
    positionNameEn: "Senior General Manager",
    remark: "ผู้จัดการทั่วไปอาวุโส / Senior General Manager",
  },
  {
    id: "position-gm",
    positionCode: "gm",
    positionNameTh: "ผู้จัดการทั่วไป",
    positionNameEn: "General Manager",
    remark: "ผู้จัดการทั่วไป / General Manager",
  },
  {
    id: "position-mgr",
    positionCode: "mgr",
    positionNameTh: "ผู้จัดการ",
    positionNameEn: "Manager",
    remark: "Manager / ผู้จัดการ",
  },
  {
    id: "position-sh",
    positionCode: "sh",
    positionNameTh: "ผู้จัดการแผนก",
    positionNameEn: "Section Head",
    remark: "Section Head / ผู้จัดการแผนก",
  },
  {
    id: "position-eng",
    positionCode: "eng",
    positionNameTh: "วิศวกร",
    positionNameEn: "Engineer",
    remark: "Engineer / วิศวกร",
  },
  {
    id: "position-off",
    positionCode: "off",
    positionNameTh: "เจ้าหน้าที่",
    positionNameEn: "Officer",
    remark: "Officer / เจ้าหน้าที่",
  },
  {
    id: "position-sfm",
    positionCode: "sfm",
    positionNameTh: "ซีเนียร์โฟร์แมน",
    positionNameEn: "Senior Foreman",
    remark: "Senior Foreman / ซีเนียร์โฟร์แมน",
  },
  {
    id: "position-fm",
    positionCode: "fm",
    positionNameTh: "โฟร์แมน",
    positionNameEn: "Foreman",
    remark: "Foreman / โฟร์แมน",
  },
  {
    id: "position-ld",
    positionCode: "ld",
    positionNameTh: "ลีดเดอร์",
    positionNameEn: "Leader",
    remark: "Leader / ลีดเดอร์",
  },
  {
    id: "position-staff",
    positionCode: "staff",
    positionNameTh: "พนักงาน",
    positionNameEn: "Staff",
    remark: "Staff / พนักงาน",
  },
  {
    id: "position-op",
    positionCode: "op",
    positionNameTh: "พนักงานปฏิบัติการ",
    positionNameEn: "Operator",
    remark: "Operator / พนักงานปฏิบัติการ",
  },
];

type PositionForm = {
  positionCode: string;
  positionNameTh: string;
  positionNameEn: string;
  status: PositionStatus;
};

const blankForm = (): PositionForm => ({
  positionCode: "",
  positionNameTh: "",
  positionNameEn: "",
  status: "ACTIVE",
});

const toForm = (record: ApiPositionRecord): PositionForm => ({
  positionCode: record.positionCode,
  positionNameTh: record.positionNameTh,
  positionNameEn: record.positionNameEn ?? "",
  status: record.status,
});

const errorText = (error: unknown) =>
  error instanceof PositionClientError
    ? error.message
    : "Unable to load position data. Please try again.";

export default function PositionData() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();
  const isCenter = user?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<ApiPositionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<PositionForm>(blankForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = rows.find((row) => row.positionId === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.positionCode, row.positionNameTh, row.positionNameEn, row.status]
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
      const items = (await listPositions()).items;
      setRows(items);
      setSelectedId((current) =>
        current && items.some((item) => item.positionId === current)
          ? current
          : items[0]?.positionId ?? null,
      );
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    listPositions()
      .then((result) => {
        if (!current) return;
        setRows(result.items);
        setSelectedId(result.items[0]?.positionId ?? null);
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
    const editingPositionId = selected?.positionId ?? null;
    if (savingMode === "edit" && !editingPositionId) {
      setError("Select a Position before saving changes.");
      return;
    }
    const missingFields: string[] = [];
    if (!form.positionCode.trim()) missingFields.push("รหัสตำแหน่ง (Position Code)");
    if (!form.positionNameTh.trim()) missingFields.push("ชื่อตำแหน่ง ภาษาไทย (Position Name TH)");
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const input = {
        positionCode: form.positionCode.trim().toUpperCase(),
        positionNameTh: form.positionNameTh.trim(),
        positionNameEn: form.positionNameEn.trim() || null,
        status: form.status,
      };
      const result =
        savingMode === "edit" && editingPositionId
          ? await updatePosition(editingPositionId, input)
          : await createPosition(input);
      setRows((current) =>
        savingMode === "edit"
          ? current.map((item) =>
              item.positionId === result.position.positionId
                ? result.position
                : item,
            )
          : [...current, result.position],
      );
      void listPositions()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
      setSelectedId(result.position.positionId);
      setFormMode(null);
      setForm(blankForm());
      toast.success(`บันทึก ${result.position.positionCode} แล้ว / Saved`);
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
    if (!(await confirm({ message: `Delete ${selected.positionCode}?`, confirmLabel: "Delete", danger: true }))) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await deletePosition(selected.positionId);
      const nextRows = rows.filter(
        (item) => item.positionId !== result.position.positionId,
      );
      setRows(nextRows);
      setSelectedId(nextRows[0]?.positionId ?? null);
      setFormMode(null);
      toast.success(`ลบ ${result.position.positionCode} แล้ว / Deleted`);
      void listPositions()
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
    void loadRows();
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px", padding: "40px" }}>
        <TypewriterLoader label="กำลังโหลดข้อมูลตำแหน่งงาน (Position Master)..." />
      </div>
    );
  }

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

      <section className={styles.workspace} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search position data"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search position code or name"
          />
          {isCenter ? (
            <>
              <button className={styles.newButton} type="button" onClick={startNew} disabled={isSaving}>
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

        {error ? <p role="alert">{error}</p> : null}

        {formMode ? (
          <section className={styles.editorPanel}>
            <h3>{formMode === "new" ? "Create Position" : "Edit Position"}</h3>
            <div className={styles.formGrid}>
              <label>
                Position Code
                <input
                  value={form.positionCode}
                  maxLength={30}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      positionCode: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Position Name(TH)
                <input
                  value={form.positionNameTh}
                  maxLength={255}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      positionNameTh: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Position Name(EN)
                <input
                  value={form.positionNameEn}
                  maxLength={255}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      positionNameEn: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as PositionStatus,
                    }))
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </label>
            </div>
            <div className={styles.formActions}>
              <button
                className={styles.saveButton}
                type="button"
                onClick={() => void save()}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={() => setFormMode(null)}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Shared Master</span>
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
                  <th>Status</th>
                </tr>
              </thead>
              <tbody translate="no">
                {visibleRows.map((row, index) => (
                  <tr
                    key={row.positionId}
                    className={
                      row.positionId === selectedId
                        ? styles.selectedRow
                        : undefined
                    }
                    onClick={() => setSelectedId(row.positionId)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <span className={styles.codePill}>{row.positionCode}</span>
                    </td>
                    <td>{row.positionNameTh}</td>
                    <td>{row.positionNameEn ?? "-"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {!isLoading && visibleRows.length === 0 ? (
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
