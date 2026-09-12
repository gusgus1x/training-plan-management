"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  parseInstructorFile,
  commitInstructorImport,
  type ParseInstructorResult,
  type InstructorImportSummary,
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

  // ── Import Modal States ──
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importRows, setImportRows] = useState<ParseInstructorResult["rows"]>([]);
  const [importSummary, setImportSummary] = useState<InstructorImportSummary | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [importFilter, setImportFilter] = useState<"ALL" | "VALID" | "NEW" | "UPDATE" | "INVALID">("ALL");
  const [importSearch, setImportSearch] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDownloadTemplate = (format: "xlsx" | "csv" = "xlsx") => {
    const link = document.createElement("a");
    link.href = `/api/master-data/instructors/download-template${format === "csv" ? "?format=csv" : ""}`;
    link.setAttribute("download", `Instructor_Import_Template.${format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFile = async (file: File) => {
    try {
      setIsParsing(true);
      setImportFileName(file.name);
      const res = await parseInstructorFile(file);
      setImportRows(res.rows);
      setImportSummary(res.summary);
      if (res.rows.length === 0) {
        toast.warning(
          isThai
            ? "ไม่พบข้อมูลในไฟล์ หรือรูปแบบหัวตารางไม่ถูกต้อง"
            : "No rows found in file or invalid headers",
        );
      } else {
        toast.success(
          isThai
            ? `อ่านไฟล์สำเร็จ: ${res.rows.length} รายการ (พร้อมนำเข้า ${res.summary.valid} รายการ)`
            : `Parsed ${res.rows.length} rows (${res.summary.valid} valid)`,
        );
      }
    } catch (err) {
      console.error("Parse file error:", err);
      toast.error(
        isThai
          ? "ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์"
          : "Failed to parse file. Please check format.",
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleExecuteImport = async () => {
    const validRows = importRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.warning(
        isThai ? "ไม่มีข้อมูลที่ถูกต้องพร้อมนำเข้า" : "No valid rows to import",
      );
      return;
    }

    try {
      setIsImporting(true);
      const res = await commitInstructorImport(validRows, overwriteExisting);
      if (res.success) {
        toast.success(
          isThai
            ? `นำเข้าข้อมูลสำเร็จ: เพิ่มใหม่ ${res.createdCount} รายการ, อัปเดต ${res.updatedCount} รายการ`
            : `Import successful: ${res.createdCount} created, ${res.updatedCount} updated`,
        );
        setIsImportModalOpen(false);
        setImportRows([]);
        setImportSummary(null);
        setImportFileName("");
        await loadRows();
      } else {
        toast.error(
          isThai ? "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" : "Failed to import data",
        );
      }
    } catch (err) {
      console.error("Commit import error:", err);
      toast.error(
        isThai ? "เกิดข้อผิดพลาดในการนำเข้าข้อมูล" : "Error importing instructors",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const filteredImportRows = useMemo(() => {
    let result = importRows;
    if (importFilter === "VALID") {
      result = result.filter((r) => r.isValid);
    } else if (importFilter === "NEW") {
      result = result.filter((r) => r.dbStatus === "NEW");
    } else if (importFilter === "UPDATE") {
      result = result.filter((r) => r.dbStatus === "UPDATE");
    } else if (importFilter === "INVALID") {
      result = result.filter((r) => !r.isValid || r.dbStatus === "ERROR");
    }

    const q = importSearch.trim().toLowerCase();
    if (q) {
      result = result.filter((r) =>
        [
          r.instructorCode,
          r.firstName,
          r.lastName,
          r.telephone,
          r.email,
          r.education,
          r.university,
          r.organizationName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return result;
  }, [importRows, importFilter, importSearch]);

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
                className={styles.importButton}
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                disabled={isSaving}
                title={isThai ? "นำเข้าข้อมูลวิทยากรจากไฟล์ Excel/CSV" : "Import instructors from Excel/CSV"}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {isThai ? "นำเข้า (Import)" : "Import"}
              </button>
              <button
                className={styles.templateButton}
                type="button"
                onClick={() => handleDownloadTemplate("xlsx")}
                title={isThai ? "ดาวน์โหลดไฟล์เทมเพลต Excel สำหรับนำเข้าข้อมูล" : "Download Excel Template"}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {isThai ? "เทมเพลต (Template)" : "Template"}
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

      {/* ── Import Modal ── */}
      {isImportModalOpen && (
        <div
          className={styles.importModalOverlay}
          onClick={() => {
            if (!isImporting && !isParsing) setIsImportModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={isThai ? "นำเข้าข้อมูลวิทยากร" : "Import Instructors"}
        >
          <div
            className={styles.importModalCard}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={styles.importModalHeader}>
              <div>
                <h3 className={styles.importModalTitle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#0284c7" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  {isThai ? "นำเข้าข้อมูลวิทยากร (Import Instructor Data)" : "Import Instructor Master Data"}
                </h3>
                <p className={styles.importModalSubtitle}>
                  {isThai
                    ? "เลือกไฟล์ Excel (.xlsx) หรือ CSV เพื่อเพิ่มหรืออัปเดตข้อมูลวิทยากรจำนวนมากในระบบ"
                    : "Upload an Excel (.xlsx) or CSV file to batch create or update instructor records"}
                </p>
              </div>
              <button
                type="button"
                className={styles.importModalCloseBtn}
                onClick={() => {
                  if (!isImporting && !isParsing) setIsImportModalOpen(false);
                }}
                disabled={isImporting || isParsing}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className={styles.importModalBody}>
              {/* Dropzone */}
              <div
                className={`${styles.importDropzone} ${isDragOver ? styles.importDropzoneActive : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, .txt"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <div className={styles.importDropzoneIcon}>
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <h4 className={styles.importDropzoneTitle}>
                  {importFileName
                    ? `${isThai ? "ไฟล์ที่เลือก: " : "Selected File: "} ${importFileName}`
                    : (isThai ? "ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์" : "Drag and drop file here, or click to browse")}
                </h4>
                <p className={styles.importDropzoneDesc}>
                  {isThai
                    ? "รองรับไฟล์ .xlsx, .xls และ .csv (UTF-8)"
                    : "Supports .xlsx, .xls, and .csv (UTF-8)"}
                </p>

                <div className={styles.importTemplateActions} onClick={(e) => e.stopPropagation()}>
                  <span style={{ fontSize: "0.78rem", color: "var(--ui-30-muted)" }}>
                    {isThai ? "ยังไม่มีไฟล์แบบฟอร์ม?" : "Need a template?"}
                  </span>
                  <button
                    type="button"
                    className={styles.importTemplateLink}
                    onClick={() => handleDownloadTemplate("xlsx")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {isThai ? "ดาวน์โหลด Template (.xlsx)" : "Download Template (.xlsx)"}
                  </button>
                  <button
                    type="button"
                    className={styles.importTemplateLink}
                    onClick={() => handleDownloadTemplate("csv")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {isThai ? "ดาวน์โหลด Template (.csv)" : "Download Template (.csv)"}
                  </button>
                </div>
              </div>

              {/* Parsing Loader */}
              {isParsing && (
                <div style={{ padding: "20px", textAlign: "center" }}>
                  <TypewriterLoader label={isThai ? "กำลังอ่านและตรวจสอบข้อมูลในไฟล์..." : "Reading and validating file rows..."} />
                </div>
              )}

              {/* Summary Cards */}
              {importSummary && (
                <div className={styles.importSummaryGrid}>
                  <div className={styles.importSummaryCard}>
                    <span className={styles.importSummaryVal}>{importSummary.total}</span>
                    <span className={styles.importSummaryLabel}>{isThai ? "ทั้งหมด (Total Rows)" : "Total Rows"}</span>
                  </div>
                  <div className={styles.importSummaryCard} style={{ borderColor: "rgba(16, 185, 129, 0.4)" }}>
                    <span className={styles.importSummaryVal} style={{ color: "#059669" }}>{importSummary.valid}</span>
                    <span className={styles.importSummaryLabel}>{isThai ? "พร้อมนำเข้า (Valid)" : "Valid"}</span>
                  </div>
                  <div className={styles.importSummaryCard} style={{ borderColor: "rgba(16, 185, 129, 0.3)" }}>
                    <span className={styles.importSummaryVal} style={{ color: "#10b981" }}>{importSummary.newCount}</span>
                    <span className={styles.importSummaryLabel}>{isThai ? "ข้อมูลใหม่ (New)" : "New"}</span>
                  </div>
                  <div className={styles.importSummaryCard} style={{ borderColor: "rgba(59, 130, 246, 0.3)" }}>
                    <span className={styles.importSummaryVal} style={{ color: "#2563eb" }}>{importSummary.updateCount}</span>
                    <span className={styles.importSummaryLabel}>{isThai ? "อัปเดตเดิม (Update)" : "Update"}</span>
                  </div>
                  <div className={styles.importSummaryCard} style={{ borderColor: "rgba(239, 68, 68, 0.3)" }}>
                    <span className={styles.importSummaryVal} style={{ color: "#dc2626" }}>{importSummary.invalid}</span>
                    <span className={styles.importSummaryLabel}>{isThai ? "ข้อผิดพลาด (Errors)" : "Errors"}</span>
                  </div>
                </div>
              )}

              {/* Preview Table & Filter Toolbar */}
              {importRows.length > 0 && (
                <>
                  <div className={styles.importFilterBar}>
                    <div className={styles.importFilterTabs}>
                      <button
                        type="button"
                        className={`${styles.importFilterTab} ${importFilter === "ALL" ? styles.importFilterTabActive : ""}`}
                        onClick={() => setImportFilter("ALL")}
                      >
                        {isThai ? `ทั้งหมด (${importRows.length})` : `All (${importRows.length})`}
                      </button>
                      <button
                        type="button"
                        className={`${styles.importFilterTab} ${importFilter === "VALID" ? styles.importFilterTabActive : ""}`}
                        onClick={() => setImportFilter("VALID")}
                      >
                        {isThai ? `พร้อมนำเข้า (${importSummary?.valid ?? 0})` : `Valid (${importSummary?.valid ?? 0})`}
                      </button>
                      <button
                        type="button"
                        className={`${styles.importFilterTab} ${importFilter === "NEW" ? styles.importFilterTabActive : ""}`}
                        onClick={() => setImportFilter("NEW")}
                      >
                        {isThai ? `เพิ่มใหม่ (${importSummary?.newCount ?? 0})` : `New (${importSummary?.newCount ?? 0})`}
                      </button>
                      <button
                        type="button"
                        className={`${styles.importFilterTab} ${importFilter === "UPDATE" ? styles.importFilterTabActive : ""}`}
                        onClick={() => setImportFilter("UPDATE")}
                      >
                        {isThai ? `อัปเดต (${importSummary?.updateCount ?? 0})` : `Update (${importSummary?.updateCount ?? 0})`}
                      </button>
                      {importSummary && importSummary.invalid > 0 && (
                        <button
                          type="button"
                          className={`${styles.importFilterTab} ${importFilter === "INVALID" ? styles.importFilterTabActive : ""}`}
                          onClick={() => setImportFilter("INVALID")}
                        >
                          {isThai ? `ข้อผิดพลาด (${importSummary.invalid})` : `Errors (${importSummary.invalid})`}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      className={styles.importFilterSearch}
                      placeholder={isThai ? "ค้นหาในตัวอย่าง..." : "Filter preview..."}
                      value={importSearch}
                      onChange={(e) => setImportSearch(e.target.value)}
                    />
                  </div>

                  <div className={styles.importPreviewWrap}>
                    <table className={styles.importPreviewTable}>
                      <thead>
                        <tr>
                          <th>แถว</th>
                          <th>สถานะ</th>
                          <th>รหัสวิทยากร</th>
                          <th>ชื่อ - นามสกุล</th>
                          <th>เบอร์โทรศัพท์</th>
                          <th>อีเมล</th>
                          <th>วุฒิการศึกษา</th>
                          <th>มหาวิทยาลัย</th>
                          <th>หน่วยงาน / สังกัด</th>
                          <th>ผลการตรวจสอบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredImportRows.map((r, idx) => (
                          <tr
                            key={`${r.instructorCode}-${idx}`}
                            className={!r.isValid ? styles.importPreviewRowError : undefined}
                          >
                            <td style={{ textAlign: "center", color: "var(--ui-30-muted)" }}>{r.rowNum}</td>
                            <td>
                              {r.dbStatus === "NEW" && (
                                <span className={styles.importBadgeNew}>
                                  {isThai ? "เพิ่มใหม่" : "New"}
                                </span>
                              )}
                              {r.dbStatus === "UPDATE" && (
                                <span className={styles.importBadgeUpdate}>
                                  {isThai ? "อัปเดต" : "Update"}
                                </span>
                              )}
                              {r.dbStatus === "ERROR" && (
                                <span className={styles.importBadgeError}>
                                  {isThai ? "ไม่ถูกต้อง" : "Error"}
                                </span>
                              )}
                            </td>
                            <td>
                              <strong>{r.instructorCode || (isThai ? "(สร้างอัตโนมัติ)" : "(Auto)")}</strong>
                              {r.dbStatus === "NEW" && (
                                <span style={{ fontSize: "0.68rem", color: "#0284c7", display: "block", fontWeight: 600 }}>
                                  {isThai ? "รหัสอัตโนมัติ" : "Auto Code"}
                                </span>
                              )}
                            </td>
                            <td>
                              {r.firstName} {r.lastName}
                            </td>
                            <td>{r.telephone || "-"}</td>
                            <td>{r.email || "-"}</td>
                            <td>{r.education || "-"}</td>
                            <td>{r.university || "-"}</td>
                            <td>{r.organizationName || "-"}</td>
                            <td>
                              {r.errors.length > 0 ? (
                                <span style={{ color: "#dc2626", fontWeight: 600 }}>
                                  {r.errors.join(", ")}
                                </span>
                              ) : (
                                <span style={{ color: "#059669", fontWeight: 600 }}>
                                  ✓ {isThai ? "ข้อมูลถูกต้อง" : "Ready"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {filteredImportRows.length === 0 && (
                          <tr>
                            <td colSpan={10} style={{ textAlign: "center", padding: "20px", color: "var(--ui-30-muted)" }}>
                              {isThai ? "ไม่พบรายการตามเงื่อนไข" : "No items matching filter"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className={styles.importModalFooter}>
              <label className={styles.importOptionsWrap}>
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  disabled={isImporting || isParsing}
                  style={{ width: "17px", height: "17px", accentColor: "#0284c7" }}
                />
                <span>
                  {isThai
                    ? "อัปเดตข้อมูลเดิมหากพบรหัสวิทยากรที่มีอยู่แล้วในระบบ (Overwrite Existing Records)"
                    : "Overwrite existing records when matching Instructor Code is found"}
                </span>
              </label>

              <div className={styles.importActionBtns}>
                <button
                  type="button"
                  className={styles.importCancelBtn}
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportRows([]);
                    setImportSummary(null);
                    setImportFileName("");
                  }}
                  disabled={isImporting || isParsing}
                >
                  {isThai ? "ยกเลิก" : "Cancel"}
                </button>
                <button
                  type="button"
                  className={styles.importConfirmBtn}
                  onClick={handleExecuteImport}
                  disabled={
                    isImporting ||
                    isParsing ||
                    importRows.length === 0 ||
                    !importRows.some((r) => r.isValid)
                  }
                >
                  {isImporting ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                        <line x1="12" y1="2" x2="12" y2="6"/>
                        <line x1="12" y1="18" x2="12" y2="22"/>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                        <line x1="2" y1="12" x2="6" y2="12"/>
                        <line x1="18" y1="12" x2="22" y2="12"/>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                      </svg>
                      {isThai ? "กำลังนำเข้าข้อมูล..." : "Importing..."}
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isThai
                        ? `ยืนยันการนำเข้า (${importRows.filter((r) => r.isValid).length} รายการ)`
                        : `Confirm Import (${importRows.filter((r) => r.isValid).length} rows)`}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
