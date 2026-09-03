"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import {
  InstructorClientError,
  createInstructor,
  deleteInstructor,
  listInstructors,
  updateInstructor,
} from "../../../../lib/instructors/client";
import type {
  InstructorRecord,
  InstructorStatus,
} from "../../../../lib/instructors/types";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./InstructorData.module.css";

export const instructorDataModule = {
  title: "Instructor Data",
  subtitle: "Instructor master",
  description:
    "Maintain the shared instructor catalog used by every company.",
} as const;

type InstructorForm = {
  instructorCode: string;
  firstName: string;
  lastName: string;
  telephone: string;
  email: string;
  education: string;
  university: string;
  organizationName: string;
  status: InstructorStatus;
};

const blankForm = (): InstructorForm => ({
  instructorCode: "",
  firstName: "",
  lastName: "",
  telephone: "",
  email: "",
  education: "",
  university: "",
  organizationName: "",
  status: "ACTIVE",
});

const toForm = (record: InstructorRecord): InstructorForm => ({
  instructorCode: record.instructorCode,
  firstName: record.firstName,
  lastName: record.lastName,
  telephone: record.telephone ?? "",
  email: record.email ?? "",
  education: record.education ?? "",
  university: record.university ?? "",
  organizationName: record.organizationName ?? "",
  status: record.status,
});

const errorText = (error: unknown) =>
  error instanceof InstructorClientError
    ? error.message
    : "Unable to load instructor data. Please try again.";

const CODE_PATTERN = /^([A-Za-z]+)(\d+)$/;
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

export default function InstructorData() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const isCenter = user?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<InstructorRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingInstructorId, setEditingInstructorId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<InstructorForm>(blankForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected =
    rows.find((row) => row.instructorId === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.instructorCode,
        row.firstName,
        row.lastName,
        row.telephone,
        row.email,
        row.education,
        row.university,
        row.organizationName,
        row.status,
      ]
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
      const items = (await listInstructors()).items;
      setRows(items);
      setSelectedId((current) =>
        current && items.some((item) => item.instructorId === current)
          ? current
          : items[0]?.instructorId ?? null,
      );
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    listInstructors()
      .then((result) => {
        if (!current) return;
        setRows(result.items);
        setSelectedId(result.items[0]?.instructorId ?? null);
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
    setEditingInstructorId(null);
    setForm({
      ...blankForm(),
      instructorCode: nextAutoCode(
        rows.map((item) => item.instructorCode),
        "INS",
      ),
    });
    setFormMode("new");
    setError(null);
  };

  const startEdit = () => {
    const instructor = selected;
    if (!isCenter || !instructor) return;
    setEditingInstructorId(instructor.instructorId);
    setForm(toForm(instructor));
    setFormMode("edit");
    setError(null);
  };

  const save = async () => {
    if (!isCenter || isSaving || !formMode) return;
    const savingMode = formMode;
    const targetInstructorId =
      savingMode === "edit" ? editingInstructorId : null;

    if (savingMode === "edit" && !targetInstructorId) {
      setError("Select an Instructor before saving changes.");
      return;
    }
    const missingFields: string[] = [];
    if (!form.instructorCode.trim()) missingFields.push("รหัสวิทยากร (Instructor Code)");
    if (!form.firstName.trim()) missingFields.push("ชื่อวิทยากร (First Name)");
    if (!form.lastName.trim()) missingFields.push("นามสกุลวิทยากร (Last Name)");
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    const normalizedCode = form.instructorCode.trim().toUpperCase();
    if (
      savingMode === "new" &&
      rows.some(
        (item) => item.instructorCode.toUpperCase() === normalizedCode,
      )
    ) {
      setError(
        "Instructor code already exists. This form is in New mode; select the existing row and press Edit.",
      );
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const input = {
        instructorCode: normalizedCode,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        telephone: form.telephone.trim() || null,
        email: form.email.trim() || null,
        education: form.education.trim() || null,
        university: form.university.trim() || null,
        organizationName: form.organizationName.trim() || null,
        status: form.status,
      };
      const result =
        savingMode === "edit" && targetInstructorId
          ? await updateInstructor(targetInstructorId, input)
          : await createInstructor(input);

      setRows((current) =>
        savingMode === "edit"
          ? current.map((item) =>
              item.instructorId === result.instructor.instructorId
                ? result.instructor
                : item,
            )
          : [...current, result.instructor],
      );

      void listInstructors()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
      setSelectedId(result.instructor.instructorId);
      setEditingInstructorId(null);
      setFormMode(null);
      setForm(blankForm());
      toast.success(
        `บันทึก ${result.instructor.instructorCode} - ${result.instructor.firstName} ${result.instructor.lastName} แล้ว / Saved`,
      );
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
    if (!(await confirm({ message: { th: `ยืนยันที่จะลบวิทยากร ${selected.instructorCode} หรือไม่?`, en: `Confirm deleting instructor ${selected.instructorCode}?` }, danger: true }))) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await deleteInstructor(selected.instructorId);
      if (result.outcome === "DEACTIVATED") {
        setRows((current) =>
          current.map((item) =>
            item.instructorId === result.instructor.instructorId
              ? result.instructor
              : item,
          ),
        );
        toast.warning(
          `${result.instructor.instructorCode} ยังถูกใช้งานอยู่ จึงเปลี่ยนเป็นสถานะ INACTIVE แทนการลบ / Still in use, changed to INACTIVE`,
        );
      } else {
        const nextRows = rows.filter(
          (item) => item.instructorId !== result.instructor.instructorId,
        );
        setRows(nextRows);
        setSelectedId(nextRows[0]?.instructorId ?? null);
        toast.success(`ลบ ${result.instructor.instructorCode} แล้ว / Deleted`);
      }
      setEditingInstructorId(null);
      setFormMode(null);
      void listInstructors()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const refresh = () => {
    setEditingInstructorId(null);
    setFormMode(null);
    setForm(blankForm());
    void loadRows();
  };

  const change = <Key extends keyof InstructorForm>(
    field: Key,
    value: InstructorForm[Key],
  ) => setForm((current) => ({ ...current, [field]: value }));

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px", padding: "40px" }}>
        <TypewriterLoader label="กำลังโหลดข้อมูลวิทยากร (Instructor Master)..." />
      </div>
    );
  }

  return (
    <section
      className={styles.moduleWorkspace}
      aria-label="Instructor Data module"
    >
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{instructorDataModule.subtitle}</p>
          <h2>{instructorDataModule.title}</h2>
          <p>{instructorDataModule.description}</p>
        </div>
      </section>

      <section className={styles.panel} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search instructor records"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาด้วย รหัส, ชื่อ, นามสกุล, เบอร์โทร, มหาวิทยาลัย, สังกัด..."
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
                disabled={!selected || isSaving}
                type="button"
                onClick={startEdit}
              >
                {isThai ? "แก้ไข" : "Edit"}
              </button>
              <button
                className={styles.deleteButton}
                disabled={!selected || isSaving}
                type="button"
                onClick={() => void remove()}
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
        {error ? <p role="alert">{error}</p> : null}
      </section>

      {formMode ? (
        <section className={styles.formPanel}>
          <h3>
            {formMode === "new"
              ? "เพิ่มข้อมูลวิทยากร (Add Instructor)"
              : `แก้ไขข้อมูลวิทยากร (Edit Instructor) - ${form.instructorCode}`}
          </h3>
          <div className={styles.formGrid}>
            <label>
              รหัสวิทยากร (Instructor Code)
              <input
                value={form.instructorCode}
                maxLength={30}
                placeholder="เช่น INS0001 (สร้างให้อัตโนมัติ)"
                onChange={(event) =>
                  change("instructorCode", event.target.value)
                }
              />
            </label>
            <label>
              ชื่อ (First Name)
              <input
                value={form.firstName}
                maxLength={150}
                placeholder="เช่น สมชาย"
                onChange={(event) => change("firstName", event.target.value)}
              />
            </label>
            <label>
              นามสกุล (Last Name)
              <input
                value={form.lastName}
                maxLength={150}
                placeholder="เช่น ใจดี"
                onChange={(event) => change("lastName", event.target.value)}
              />
            </label>
            <label>
              เบอร์โทรศัพท์ (Telephone)
              <input
                value={form.telephone}
                maxLength={30}
                placeholder="เช่น 081-234-5678"
                onChange={(event) => change("telephone", event.target.value)}
              />
            </label>
            <label>
              อีเมล (Email)
              <input
                type="email"
                value={form.email}
                maxLength={255}
                placeholder="เช่น somchai@example.com"
                onChange={(event) => change("email", event.target.value)}
              />
            </label>
            <label>
              ระดับการศึกษา / วุฒิ (Education)
              <input
                value={form.education}
                maxLength={500}
                placeholder="เช่น ปริญญาโท วิศวกรรมศาสตร์"
                onChange={(event) => change("education", event.target.value)}
              />
            </label>
            <label>
              มหาวิทยาลัย (University)
              <input
                value={form.university}
                maxLength={255}
                placeholder="เช่น จุฬาลงกรณ์มหาวิทยาลัย"
                onChange={(event) => change("university", event.target.value)}
              />
            </label>
            <label>
              หน่วยงาน / สังกัด (Organization)
              <input
                value={form.organizationName}
                maxLength={255}
                placeholder="เช่น บริษัท เอบีซี จำกัด หรือ คณะวิศวกรรมศาสตร์"
                onChange={(event) =>
                  change("organizationName", event.target.value)
                }
              />
            </label>
            {/* สถานะเอาออกตามคำขอ: บันทึกค่าเริ่มต้น ACTIVE ใน background โดยไม่ต้องแสดงในฟอร์ม */}
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
                    ? (isThai ? "เพิ่มวิทยากร" : "Add Instructor")
                    : (isThai ? "บันทึกการเปลี่ยนแปลง" : "Save Changes")}
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={() => {
                  setEditingInstructorId(null);
                  setFormMode(null);
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
          <h3>รายชื่อวิทยากร (Instructor Records)</h3>
          <span className={styles.itemCount}>{visibleRows.length} รายการ</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th className={styles.colIndex}>ลำดับ</th>
                <th className={styles.colCode}>รหัสวิทยากร</th>
                <th className={styles.colName}>ชื่อ - นามสกุล</th>
                <th className={styles.colPhone}>เบอร์โทรศัพท์</th>
                <th className={styles.colEmail}>อีเมล</th>
                <th className={styles.colEdu}>วุฒิการศึกษา</th>
                <th className={styles.colUni}>มหาวิทยาลัย</th>
                <th className={styles.colOrg}>หน่วยงาน / สังกัด</th>
              </tr>
            </thead>
            <tbody translate="no">
              {visibleRows.map((row, index) => (
                <tr
                  className={
                    row.instructorId === selectedId
                      ? styles.selectedRow
                      : undefined
                  }
                  key={row.instructorId}
                  onClick={() => setSelectedId(row.instructorId)}
                  onDoubleClick={() => {
                    if (isCenter) startEdit();
                  }}
                  title={isCenter ? "คลิกเลือก หรือดับเบิลคลิกเพื่อแก้ไข" : undefined}
                >
                  <td className={styles.colIndex}>{index + 1}</td>
                  <td className={styles.colCode}>
                    <span className={styles.codeBadge}>{row.instructorCode}</span>
                  </td>
                  <td className={styles.colName}>
                    <strong>{row.firstName} {row.lastName}</strong>
                  </td>
                  <td className={styles.colPhone}>{row.telephone || "-"}</td>
                  <td className={styles.colEmail}>{row.email || "-"}</td>
                  <td className={styles.colEdu}>{row.education || "-"}</td>
                  <td className={styles.colUni}>{row.university || "-"}</td>
                  <td className={styles.colOrg}>{row.organizationName || "-"}</td>
                </tr>
              ))}
              {!isLoading && visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "var(--ui-30-muted)" }}>
                    ไม่พบข้อมูลวิทยากร (No instructor data found.)
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
