"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useNotice } from "../../../NoticeDialog";
import { useToast } from "../../../ToastHost";
import {
  FunctionClientError,
  createFunction,
  deleteFunction,
  listFunctions,
  updateFunction,
} from "../../../../lib/functions/client";
import type {
  MasterStatus,
  OrganizationFunctionRecord,
} from "../../../../lib/functions/types";
import {
  DivisionClientError,
  createDivision,
  deleteDivision,
  listDivisions,
  updateDivision,
} from "../../../../lib/divisions/client";
import type {
  DivisionRecord,
  DivisionStatus,
} from "../../../../lib/divisions/types";
import {
  DepartmentClientError,
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
} from "../../../../lib/departments/client";
import type {
  DepartmentRecord,
  DepartmentStatus,
} from "../../../../lib/departments/types";
import {
  SectionClientError,
  createSection,
  deleteSection,
  listSections,
  updateSection,
} from "../../../../lib/sections/client";
import type {
  SectionRecord,
  SectionStatus,
} from "../../../../lib/sections/types";
import { listOrgHierarchyUsage } from "../../../../lib/orgHierarchy/client";
import type { OrgHierarchyUsageRow } from "../../../../lib/orgHierarchy/types";
import styles from "./FunctionData.module.css";

export type FunctionRecord = {
  id: string;
  functionCode: string;
  functionNameTh: string;
  functionNameEn: string;
};

export const functionDataModule = {
  title: "Function & Organization Data",
  subtitle: "Organization structure master",
  description:
    "Maintain the shared function catalog, divisions, departments, and sections used across companies.",
} as const;

const mockFunctions = [
  ["FNC0001", "การขาย", ""],
  ["FNC0002", "วางแผนการขาย", "Sale Planing"],
  ["FNC0003", "บัญชีและการเงิน", "Account and Financial"],
  ["FNC0004", "ทรัพยากรมนุษย์", "Human Resource"],
  ["FNC0005", "ธุรการ", ""],
  ["FNC0006", "ล่ามและเลขานุการ", ""],
  ["FNC0007", "จัดซื้อ", "Purchase"],
  ["FNC0008", "เทคโนโลยีสารสนเทศ", "IT Promotion"],
  ["FNC0009", "คลังสินค้า", ""],
  ["FNC0010", "ผลิต", "Production"],
  ["FNC0011", "วางแผนการผลิต", "Production Planing"],
  ["FNC0012", "วิศวกรรมและซ่อมบำรุง", "Engineering and Maintenance"],
  ["FNC0013", "คุณภาพ", "Quality"],
  ["FNC0014", "ความปลอดภัยและสิ่งแวดล้อม", "Safety and Environment"],
  ["FNC0015", "วิศวกรรมโครงการ", "Project Engineering"],
  ["FNC0016", "สำนักงานกรรมการผู้จัดการ", "President Office"],
  ["FNC0017", "อื่นๆ", "Other"],
] as const;

// Temporary compatibility export for mock consumers awaiting API migration.
export const defaultFunctionRows: FunctionRecord[] = mockFunctions.map(
  ([functionCode, functionNameTh, functionNameEn], index) => ({
    id: `function-${String(index + 1).padStart(4, "0")}`,
    functionCode,
    functionNameTh,
    functionNameEn,
  }),
);

type GenericForm = {
  code: string;
  nameTh: string;
  nameEn: string;
  status: MasterStatus;
};

const blankForm = (): GenericForm => ({
  code: "",
  nameTh: "",
  nameEn: "",
  status: "ACTIVE",
});

// Auto-numbering for new records: continues the most common "<letters><digits>" pattern already
// in use (so it follows whatever prefix convention real data already established, e.g. "PLT0001"),
// falling back to fallbackPrefix + "0001" when there's no existing data to follow yet.
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

const functionErrorText = (error: unknown) =>
  error instanceof FunctionClientError
    ? error.message
    : "Unable to process function data. Please try again.";

const divisionErrorText = (error: unknown) =>
  error instanceof DivisionClientError
    ? error.message
    : "Unable to process division data. Please try again.";

const departmentErrorText = (error: unknown) =>
  error instanceof DepartmentClientError
    ? error.message
    : "Unable to process department data. Please try again.";

const sectionErrorText = (error: unknown) =>
  error instanceof SectionClientError
    ? error.message
    : "Unable to process section data. Please try again.";

type SelectedLevel = "function" | "division" | "department" | "section";

const NO_DIVISION_KEY = "__NO_DIVISION__";
const NO_DEPARTMENT_KEY = "__NO_DEPARTMENT__";

type CombinationRow = {
  key: string;
  functionRecord: OrganizationFunctionRecord;
  divisionRecord: DivisionRecord | null;
  departmentRecord: DepartmentRecord | null;
  sectionRecord: SectionRecord | null;
};

const textMatches = (query: string, ...values: Array<string | null | undefined>) =>
  values.some((value) => value && value.toLowerCase().includes(query));

const displayName = (nameTh: string, nameEn: string | null) => nameEn?.trim() || nameTh;

const Cell = ({
  code,
  label,
  selected,
  onSelect,
}: {
  code?: string;
  label: string;
  selected: boolean;
  onSelect?: () => void;
}) =>
  onSelect ? (
    <button
      type="button"
      className={styles.treeLabel}
      data-selected={selected ? "true" : undefined}
      onClick={onSelect}
    >
      {code ? (
        <span className={styles.codePill} translate="no">
          {code}
        </span>
      ) : null}
      <span translate="no">{label}</span>
    </button>
  ) : (
    <span className={styles.treePlaceholderLabel}>{label}</span>
  );

export default function FunctionData() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const notice = useNotice();
  const toast = useToast();
  const isCenter = user?.roleCode === "HRD_CENTER";

  // --- 1. Function State ---
  const [rows, setRows] = useState<OrganizationFunctionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<{
    functionCode: string;
    functionNameTh: string;
    functionNameEn: string;
    status: MasterStatus;
  }>({
    functionCode: "",
    functionNameTh: "",
    functionNameEn: "",
    status: "ACTIVE",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- 2. Division State ---
  const [divisionRows, setDivisionRows] = useState<DivisionRecord[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [divisionFormMode, setDivisionFormMode] = useState<"new" | "edit" | null>(null);
  const [divisionForm, setDivisionForm] = useState<GenericForm>(blankForm);
  const [isLoadingDivision, setIsLoadingDivision] = useState(true);
  const [isSavingDivision, setIsSavingDivision] = useState(false);
  const [divisionError, setDivisionError] = useState<string | null>(null);

  // --- 3. Department State ---
  const [departmentRows, setDepartmentRows] = useState<DepartmentRecord[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [departmentFormMode, setDepartmentFormMode] = useState<"new" | "edit" | null>(null);
  const [departmentForm, setDepartmentForm] = useState<GenericForm>(blankForm);
  const [isLoadingDepartment, setIsLoadingDepartment] = useState(true);
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);

  // --- 4. Section State ---
  const [sectionRows, setSectionRows] = useState<SectionRecord[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sectionFormMode, setSectionFormMode] = useState<"new" | "edit" | null>(null);
  const [sectionForm, setSectionForm] = useState<GenericForm>(blankForm);
  const [isLoadingSection, setIsLoadingSection] = useState(true);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // --- 5. Combined relationship-tree state ---
  const [orgHierarchyUsage, setOrgHierarchyUsage] = useState<OrgHierarchyUsageRow[]>([]);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [treeQuery, setTreeQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<SelectedLevel | null>(null);

  const selected = rows.find((row) => row.functionId === selectedId) ?? null;
  const selectedDivision =
    divisionRows.find((row) => row.divisionId === selectedDivisionId) ?? null;
  const selectedDepartment =
    departmentRows.find((row) => row.departmentId === selectedDepartmentId) ?? null;
  const selectedSection =
    sectionRows.find((row) => row.sectionId === selectedSectionId) ?? null;

  const isBusy = isSaving || isSavingDivision || isSavingDepartment || isSavingSection;
  const isBusyLoading =
    isLoading || isLoadingDivision || isLoadingDepartment || isLoadingSection || isLoadingUsage;

  const selectedLabel = useMemo(() => {
    if (selectedLevel === "function" && selected) return `Function · ${selected.functionCode}`;
    if (selectedLevel === "division" && selectedDivision)
      return `Division · ${selectedDivision.divisionCode}`;
    if (selectedLevel === "department" && selectedDepartment)
      return `Department · ${selectedDepartment.departmentCode}`;
    if (selectedLevel === "section" && selectedSection)
      return `Section · ${selectedSection.sectionCode}`;
    return "No record selected";
  }, [selectedLevel, selected, selectedDivision, selectedDepartment, selectedSection]);

  // --- Real-data relationship table: one row per real Function+Division+Department+Section
  // combination found in ACTIVE employee data. Deduped across companies (company isn't a column
  // here), and across the "no employees at all" case each Function still gets a placeholder-only
  // row so it stays visible/editable even with zero linked employees.
  const combinationRows: CombinationRow[] = useMemo(() => {
    const divisionById = new Map(divisionRows.map((row) => [row.divisionId, row]));
    const departmentById = new Map(departmentRows.map((row) => [row.departmentId, row]));
    const sectionById = new Map(sectionRows.map((row) => [row.sectionId, row]));
    const functionById = new Map(rows.map((row) => [row.functionId, row]));

    const seen = new Map<string, CombinationRow>();
    const functionsWithUsage = new Set<string>();

    for (const usage of orgHierarchyUsage) {
      if (!usage.functionId) continue;
      const functionRecord = functionById.get(usage.functionId);
      if (!functionRecord) continue;
      functionsWithUsage.add(usage.functionId);
      const divKey = usage.divisionId ?? NO_DIVISION_KEY;
      const deptKey = usage.departmentId ?? NO_DEPARTMENT_KEY;
      const sectionKey = usage.sectionId ?? "";
      const key = `${usage.functionId}:${divKey}:${deptKey}:${sectionKey}`;
      if (seen.has(key)) continue;
      seen.set(key, {
        key,
        functionRecord,
        divisionRecord: usage.divisionId ? divisionById.get(usage.divisionId) ?? null : null,
        departmentRecord: usage.departmentId ? departmentById.get(usage.departmentId) ?? null : null,
        sectionRecord: usage.sectionId ? sectionById.get(usage.sectionId) ?? null : null,
      });
    }

    for (const functionRecord of rows) {
      if (!functionsWithUsage.has(functionRecord.functionId)) {
        const key = `${functionRecord.functionId}:${NO_DIVISION_KEY}:${NO_DEPARTMENT_KEY}:`;
        seen.set(key, {
          key,
          functionRecord,
          divisionRecord: null,
          departmentRecord: null,
          sectionRecord: null,
        });
      }
    }

    return Array.from(seen.values()).sort((a, b) => {
      const byFunction = a.functionRecord.functionCode.localeCompare(b.functionRecord.functionCode);
      if (byFunction !== 0) return byFunction;
      const byDivision = (a.divisionRecord?.divisionCode ?? "").localeCompare(
        b.divisionRecord?.divisionCode ?? "",
      );
      if (byDivision !== 0) return byDivision;
      const byDepartment = (a.departmentRecord?.departmentCode ?? "").localeCompare(
        b.departmentRecord?.departmentCode ?? "",
      );
      if (byDepartment !== 0) return byDepartment;
      return (a.sectionRecord?.sectionCode ?? "").localeCompare(b.sectionRecord?.sectionCode ?? "");
    });
  }, [rows, divisionRows, departmentRows, sectionRows, orgHierarchyUsage]);

  const searchQuery = treeQuery.trim().toLowerCase();

  const visibleCombinationRows = useMemo(() => {
    if (!searchQuery) return combinationRows;
    return combinationRows.filter((row) =>
      textMatches(
        searchQuery,
        row.functionRecord.functionCode,
        row.functionRecord.functionNameTh,
        row.functionRecord.functionNameEn,
        row.divisionRecord?.divisionCode,
        row.divisionRecord?.divisionNameTh,
        row.divisionRecord?.divisionNameEn,
        row.departmentRecord?.departmentCode,
        row.departmentRecord?.departmentNameTh,
        row.departmentRecord?.departmentNameEn,
        row.sectionRecord?.sectionCode,
        row.sectionRecord?.sectionNameTh,
        row.sectionRecord?.sectionNameEn,
      ),
    );
  }, [combinationRows, searchQuery]);

  // --- Records not referenced by any active employee (still reachable for edit/delete) ---
  const usedDivisionIds = useMemo(
    () => new Set(orgHierarchyUsage.map((row) => row.divisionId).filter((id): id is string => Boolean(id))),
    [orgHierarchyUsage],
  );
  const usedDepartmentIds = useMemo(
    () => new Set(orgHierarchyUsage.map((row) => row.departmentId).filter((id): id is string => Boolean(id))),
    [orgHierarchyUsage],
  );
  const usedSectionIds = useMemo(
    () => new Set(orgHierarchyUsage.map((row) => row.sectionId).filter((id): id is string => Boolean(id))),
    [orgHierarchyUsage],
  );
  const orphanDivisions = useMemo(
    () => divisionRows.filter((row) => !usedDivisionIds.has(row.divisionId)),
    [divisionRows, usedDivisionIds],
  );
  const orphanDepartments = useMemo(
    () => departmentRows.filter((row) => !usedDepartmentIds.has(row.departmentId)),
    [departmentRows, usedDepartmentIds],
  );
  const orphanSections = useMemo(
    () => sectionRows.filter((row) => !usedSectionIds.has(row.sectionId)),
    [sectionRows, usedSectionIds],
  );

  // Each of these opens the edit form directly from the clicked record (not from selection
  // state), so a single click always edits exactly the record you clicked — never a stale or
  // previously-selected one.
  const editFunctionRecord = (record: OrganizationFunctionRecord) => {
    if (!isCenter) return;
    setFormMode(null);
    setDivisionFormMode(null);
    setDepartmentFormMode(null);
    setSectionFormMode(null);
    setSelectedLevel("function");
    setSelectedId(record.functionId);
    setForm({
      functionCode: record.functionCode,
      functionNameTh: record.functionNameTh,
      functionNameEn: record.functionNameEn ?? "",
      status: record.status,
    });
    setFormMode("edit");
    setError(null);
  };

  const editDivisionRecord = (record: DivisionRecord) => {
    if (!isCenter) return;
    setFormMode(null);
    setDivisionFormMode(null);
    setDepartmentFormMode(null);
    setSectionFormMode(null);
    setSelectedLevel("division");
    setSelectedDivisionId(record.divisionId);
    setDivisionForm({
      code: record.divisionCode,
      nameTh: record.divisionNameTh,
      nameEn: record.divisionNameEn ?? "",
      status: record.status,
    });
    setDivisionFormMode("edit");
    setDivisionError(null);
  };

  const editDepartmentRecord = (record: DepartmentRecord) => {
    if (!isCenter) return;
    setFormMode(null);
    setDivisionFormMode(null);
    setDepartmentFormMode(null);
    setSectionFormMode(null);
    setSelectedLevel("department");
    setSelectedDepartmentId(record.departmentId);
    setDepartmentForm({
      code: record.departmentCode,
      nameTh: record.departmentNameTh,
      nameEn: record.departmentNameEn ?? "",
      status: record.status,
    });
    setDepartmentFormMode("edit");
    setDepartmentError(null);
  };

  const editSectionRecord = (record: SectionRecord) => {
    if (!isCenter) return;
    setFormMode(null);
    setDivisionFormMode(null);
    setDepartmentFormMode(null);
    setSectionFormMode(null);
    setSelectedLevel("section");
    setSelectedSectionId(record.sectionId);
    setSectionForm({
      code: record.sectionCode,
      nameTh: record.sectionNameTh,
      nameEn: record.sectionNameEn ?? "",
      status: record.status,
    });
    setSectionFormMode("edit");
    setSectionError(null);
  };

  const loadOrgHierarchyUsage = async () => {
    setIsLoadingUsage(true);
    try {
      const result = await listOrgHierarchyUsage();
      setOrgHierarchyUsage(result.items);
    } catch {
      setOrgHierarchyUsage([]);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  // --- Functions CRUD Handlers ---
  const applyRows = (items: OrganizationFunctionRecord[]) => {
    setRows(items);
    setSelectedId((current) =>
      current && items.some((item) => item.functionId === current)
        ? current
        : items[0]?.functionId ?? null,
    );
  };

  const loadRows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      applyRows((await listFunctions()).items);
    } catch (caught: unknown) {
      setError(functionErrorText(caught));
    } finally {
      setIsLoading(false);
    }
  };

  const startNew = () => {
    if (!isCenter) return;
    setForm({
      functionCode: nextAutoCode(rows.map((row) => row.functionCode), "FNC"),
      functionNameTh: "",
      functionNameEn: "",
      status: "ACTIVE",
    });
    setFormMode("new");
    setError(null);
  };

  const save = async () => {
    if (!isCenter || isSaving || !formMode) return;
    const savingMode = formMode;
    const editingFunctionId = selected?.functionId ?? null;
    if (savingMode === "edit" && !editingFunctionId) {
      setError("Select a Function before saving changes.");
      return;
    }
    const missingFields: string[] = [];
    if (!form.functionCode.trim()) missingFields.push("รหัสหน่วยงาน (Function Code)");
    if (!form.functionNameTh.trim()) missingFields.push("ชื่อหน่วยงาน ภาษาไทย (Function Name TH)");
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const input = {
        functionCode: form.functionCode.trim().toUpperCase(),
        functionNameTh: form.functionNameTh.trim(),
        functionNameEn: form.functionNameEn.trim() || null,
        status: form.status,
      };
      const result =
        savingMode === "edit" && editingFunctionId
          ? await updateFunction(editingFunctionId, input)
          : await createFunction(input);
      setRows((current) =>
        savingMode === "edit"
          ? current.map((item) =>
              item.functionId === result.function.functionId
                ? result.function
                : item,
            )
          : [...current, result.function],
      );
      void listFunctions()
        .then((refreshed) => applyRows(refreshed.items))
        .catch(() => undefined);
      setSelectedId(result.function.functionId);
      setSelectedLevel("function");
      setFormMode(null);
      setForm({ functionCode: "", functionNameTh: "", functionNameEn: "", status: "ACTIVE" });
      toast.success(`บันทึกหน่วยงาน ${result.function.functionCode} แล้ว / Function saved`);
    } catch (caught: unknown) {
      setError(functionErrorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!isCenter || !selected || isSaving) {
      return;
    }
    if (!(await confirm({ message: { th: `ยืนยันที่จะลบหน่วยงาน ${selected.functionCode} หรือไม่?`, en: `Confirm deleting function ${selected.functionCode}?` }, danger: true }))) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await deleteFunction(selected.functionId);
      const nextRows = rows.filter(
        (item) => item.functionId !== result.function.functionId,
      );
      setRows(nextRows);
      setSelectedId(nextRows[0]?.functionId ?? null);
      setFormMode(null);
      toast.success(`ลบหน่วยงาน ${result.function.functionCode} แล้ว / Function deleted`);
      void listFunctions()
        .then((refreshed) => applyRows(refreshed.items))
        .catch(() => undefined);
    } catch (caught: unknown) {
      setError(functionErrorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const refresh = () => {
    setFormMode(null);
    setDivisionFormMode(null);
    setDepartmentFormMode(null);
    setSectionFormMode(null);
    setForm({ functionCode: "", functionNameTh: "", functionNameEn: "", status: "ACTIVE" });
    void loadRows();
    void loadDivisionRows();
    void loadDepartmentRows();
    void loadSectionRows();
    void loadOrgHierarchyUsage();
  };

  // --- Division CRUD Handlers ---
  const applyDivisionRows = (items: DivisionRecord[]) => {
    setDivisionRows(items);
    setSelectedDivisionId((current) =>
      current && items.some((item) => item.divisionId === current)
        ? current
        : items[0]?.divisionId ?? null,
    );
  };

  const loadDivisionRows = async () => {
    setIsLoadingDivision(true);
    setDivisionError(null);
    try {
      applyDivisionRows((await listDivisions()).items);
    } catch (caught: unknown) {
      setDivisionError(divisionErrorText(caught));
    } finally {
      setIsLoadingDivision(false);
    }
  };

  const startNewDivision = () => {
    if (!isCenter) return;
    setDivisionForm({
      ...blankForm(),
      code: nextAutoCode(divisionRows.map((row) => row.divisionCode), "DIV"),
    });
    setDivisionFormMode("new");
    setDivisionError(null);
  };

  const saveDivision = async () => {
    if (!isCenter || isSavingDivision || !divisionFormMode) return;
    const savingMode = divisionFormMode;
    const editingId = selectedDivision?.divisionId ?? null;
    if (savingMode === "edit" && !editingId) {
      setDivisionError("Select a Division before saving changes.");
      return;
    }
    const missingFields: string[] = [];
    if (!divisionForm.code.trim()) missingFields.push("รหัสฝ่าย (Division Code)");
    if (!divisionForm.nameTh.trim()) missingFields.push("ชื่อฝ่าย ภาษาไทย (Division Name TH)");
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    setIsSavingDivision(true);
    setDivisionError(null);
    try {
      const input = {
        divisionCode: divisionForm.code.trim().toUpperCase(),
        divisionNameTh: divisionForm.nameTh.trim(),
        divisionNameEn: divisionForm.nameEn.trim() || null,
        status: divisionForm.status as DivisionStatus,
      };
      const result =
        savingMode === "edit" && editingId
          ? await updateDivision(editingId, input)
          : await createDivision(input);
      setDivisionRows((current) =>
        savingMode === "edit"
          ? current.map((item) =>
              item.divisionId === result.division.divisionId
                ? result.division
                : item,
            )
          : [...current, result.division],
      );
      void listDivisions()
        .then((refreshed) => applyDivisionRows(refreshed.items))
        .catch(() => undefined);
      setSelectedDivisionId(result.division.divisionId);
      setSelectedLevel("division");
      setDivisionFormMode(null);
      setDivisionForm(blankForm());
      toast.success(`บันทึกฝ่าย ${result.division.divisionCode} แล้ว / Division saved`);
    } catch (caught: unknown) {
      setDivisionError(divisionErrorText(caught));
    } finally {
      setIsSavingDivision(false);
    }
  };

  const removeDivision = async () => {
    if (!isCenter || !selectedDivision || isSavingDivision) {
      return;
    }
    if (!(await confirm({ message: { th: `ยืนยันที่จะลบฝ่าย ${selectedDivision.divisionCode} หรือไม่?`, en: `Confirm deleting division ${selectedDivision.divisionCode}?` }, danger: true }))) {
      return;
    }
    setIsSavingDivision(true);
    setDivisionError(null);
    try {
      const result = await deleteDivision(selectedDivision.divisionId);
      const nextRows = divisionRows.filter(
        (item) => item.divisionId !== result.division.divisionId,
      );
      setDivisionRows(nextRows);
      setSelectedDivisionId(nextRows[0]?.divisionId ?? null);
      setDivisionFormMode(null);
      toast.success(`ลบฝ่าย ${result.division.divisionCode} แล้ว / Division deleted`);
      void listDivisions()
        .then((refreshed) => applyDivisionRows(refreshed.items))
        .catch(() => undefined);
    } catch (caught: unknown) {
      setDivisionError(divisionErrorText(caught));
    } finally {
      setIsSavingDivision(false);
    }
  };

  // --- Department CRUD Handlers ---
  const applyDepartmentRows = (items: DepartmentRecord[]) => {
    setDepartmentRows(items);
    setSelectedDepartmentId((current) =>
      current && items.some((item) => item.departmentId === current)
        ? current
        : items[0]?.departmentId ?? null,
    );
  };

  const loadDepartmentRows = async () => {
    setIsLoadingDepartment(true);
    setDepartmentError(null);
    try {
      applyDepartmentRows((await listDepartments()).items);
    } catch (caught: unknown) {
      setDepartmentError(departmentErrorText(caught));
    } finally {
      setIsLoadingDepartment(false);
    }
  };

  const startNewDepartment = () => {
    if (!isCenter) return;
    setDepartmentForm({
      ...blankForm(),
      code: nextAutoCode(departmentRows.map((row) => row.departmentCode), "DEPT"),
    });
    setDepartmentFormMode("new");
    setDepartmentError(null);
  };

  const saveDepartment = async () => {
    if (!isCenter || isSavingDepartment || !departmentFormMode) return;
    const savingMode = departmentFormMode;
    const editingId = selectedDepartment?.departmentId ?? null;
    if (savingMode === "edit" && !editingId) {
      setDepartmentError("Select a Department before saving changes.");
      return;
    }
    const missingFields: string[] = [];
    if (!departmentForm.code.trim()) missingFields.push("รหัสแผนก (Department Code)");
    if (!departmentForm.nameTh.trim()) missingFields.push("ชื่อแผนก ภาษาไทย (Department Name TH)");
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    setIsSavingDepartment(true);
    setDepartmentError(null);
    try {
      const input = {
        departmentCode: departmentForm.code.trim().toUpperCase(),
        departmentNameTh: departmentForm.nameTh.trim(),
        departmentNameEn: departmentForm.nameEn.trim() || null,
        status: departmentForm.status as DepartmentStatus,
      };
      const result =
        savingMode === "edit" && editingId
          ? await updateDepartment(editingId, input)
          : await createDepartment(input);
      setDepartmentRows((current) =>
        savingMode === "edit"
          ? current.map((item) =>
              item.departmentId === result.department.departmentId
                ? result.department
                : item,
            )
          : [...current, result.department],
      );
      void listDepartments()
        .then((refreshed) => applyDepartmentRows(refreshed.items))
        .catch(() => undefined);
      setSelectedDepartmentId(result.department.departmentId);
      setSelectedLevel("department");
      setDepartmentFormMode(null);
      setDepartmentForm(blankForm());
      toast.success(`บันทึกแผนก ${result.department.departmentCode} แล้ว / Department saved`);
    } catch (caught: unknown) {
      setDepartmentError(departmentErrorText(caught));
    } finally {
      setIsSavingDepartment(false);
    }
  };

  const removeDepartment = async () => {
    if (!isCenter || !selectedDepartment || isSavingDepartment) {
      return;
    }
    if (!(await confirm({ message: { th: `ยืนยันที่จะลบแผนก ${selectedDepartment.departmentCode} หรือไม่?`, en: `Confirm deleting department ${selectedDepartment.departmentCode}?` }, danger: true }))) {
      return;
    }
    setIsSavingDepartment(true);
    setDepartmentError(null);
    try {
      const result = await deleteDepartment(selectedDepartment.departmentId);
      const nextRows = departmentRows.filter(
        (item) => item.departmentId !== result.department.departmentId,
      );
      setDepartmentRows(nextRows);
      setSelectedDepartmentId(nextRows[0]?.departmentId ?? null);
      setDepartmentFormMode(null);
      toast.success(`ลบแผนก ${result.department.departmentCode} แล้ว / Department deleted`);
      void listDepartments()
        .then((refreshed) => applyDepartmentRows(refreshed.items))
        .catch(() => undefined);
    } catch (caught: unknown) {
      setDepartmentError(departmentErrorText(caught));
    } finally {
      setIsSavingDepartment(false);
    }
  };

  // --- Section CRUD Handlers ---
  const applySectionRows = (items: SectionRecord[]) => {
    setSectionRows(items);
    setSelectedSectionId((current) =>
      current && items.some((item) => item.sectionId === current)
        ? current
        : items[0]?.sectionId ?? null,
    );
  };

  const loadSectionRows = async () => {
    setIsLoadingSection(true);
    setSectionError(null);
    try {
      applySectionRows((await listSections()).items);
    } catch (caught: unknown) {
      setSectionError(sectionErrorText(caught));
    } finally {
      setIsLoadingSection(false);
    }
  };

  const startNewSection = () => {
    if (!isCenter) return;
    setSectionForm({
      ...blankForm(),
      code: nextAutoCode(sectionRows.map((row) => row.sectionCode), "SEC"),
    });
    setSectionFormMode("new");
    setSectionError(null);
  };

  const saveSection = async () => {
    if (!isCenter || isSavingSection || !sectionFormMode) return;
    const savingMode = sectionFormMode;
    const editingId = selectedSection?.sectionId ?? null;
    if (savingMode === "edit" && !editingId) {
      setSectionError("Select a Section before saving changes.");
      return;
    }
    const missingFields: string[] = [];
    if (!sectionForm.code.trim()) missingFields.push("รหัสส่วนงาน (Section Code)");
    if (!sectionForm.nameTh.trim()) missingFields.push("ชื่อส่วนงาน ภาษาไทย (Section Name TH)");
    if (missingFields.length > 0) {
      await notice({ missingFields });
      return;
    }
    setIsSavingSection(true);
    setSectionError(null);
    try {
      const input = {
        sectionCode: sectionForm.code.trim().toUpperCase(),
        sectionNameTh: sectionForm.nameTh.trim(),
        sectionNameEn: sectionForm.nameEn.trim() || null,
        status: sectionForm.status as SectionStatus,
      };
      const result =
        savingMode === "edit" && editingId
          ? await updateSection(editingId, input)
          : await createSection(input);
      setSectionRows((current) =>
        savingMode === "edit"
          ? current.map((item) =>
              item.sectionId === result.section.sectionId
                ? result.section
                : item,
            )
          : [...current, result.section],
      );
      void listSections()
        .then((refreshed) => applySectionRows(refreshed.items))
        .catch(() => undefined);
      setSelectedSectionId(result.section.sectionId);
      setSelectedLevel("section");
      setSectionFormMode(null);
      setSectionForm(blankForm());
      toast.success(`บันทึกส่วนงาน ${result.section.sectionCode} แล้ว / Section saved`);
    } catch (caught: unknown) {
      setSectionError(sectionErrorText(caught));
    } finally {
      setIsSavingSection(false);
    }
  };

  const removeSection = async () => {
    if (!isCenter || !selectedSection || isSavingSection) {
      return;
    }
    if (!(await confirm({ message: { th: `ยืนยันที่จะลบส่วนงาน ${selectedSection.sectionCode} หรือไม่?`, en: `Confirm deleting section ${selectedSection.sectionCode}?` }, danger: true }))) {
      return;
    }
    setIsSavingSection(true);
    setSectionError(null);
    try {
      const result = await deleteSection(selectedSection.sectionId);
      const nextRows = sectionRows.filter(
        (item) => item.sectionId !== result.section.sectionId,
      );
      setSectionRows(nextRows);
      setSelectedSectionId(nextRows[0]?.sectionId ?? null);
      setSectionFormMode(null);
      toast.success(`ลบส่วนงาน ${result.section.sectionCode} แล้ว / Section deleted`);
      void listSections()
        .then((refreshed) => applySectionRows(refreshed.items))
        .catch(() => undefined);
    } catch (caught: unknown) {
      setSectionError(sectionErrorText(caught));
    } finally {
      setIsSavingSection(false);
    }
  };

  // --- Shared toolbar dispatch (New/Delete act on whichever level is selected; Edit happens
  // directly from a table cell click instead, via editFunctionRecord/editDivisionRecord/etc.) ---
  const startNewAtLevel = (level: SelectedLevel) => {
    setFormMode(null);
    setDivisionFormMode(null);
    setDepartmentFormMode(null);
    setSectionFormMode(null);
    if (level === "function") startNew();
    else if (level === "division") startNewDivision();
    else if (level === "department") startNewDepartment();
    else startNewSection();
  };

  const deleteSelected = () => {
    if (selectedLevel === "function") void remove();
    else if (selectedLevel === "division") void removeDivision();
    else if (selectedLevel === "department") void removeDepartment();
    else if (selectedLevel === "section") void removeSection();
  };

  // --- Initial Load ---
  useEffect(() => {
    let current = true;
    listFunctions()
      .then((result) => {
        if (!current) return;
        setRows(result.items);
        setSelectedId(result.items[0]?.functionId ?? null);
      })
      .catch((caught: unknown) => {
        if (current) setError(functionErrorText(caught));
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });

    listDivisions()
      .then((result) => {
        if (!current) return;
        setDivisionRows(result.items);
        setSelectedDivisionId(result.items[0]?.divisionId ?? null);
      })
      .catch((caught: unknown) => {
        if (current) setDivisionError(divisionErrorText(caught));
      })
      .finally(() => {
        if (current) setIsLoadingDivision(false);
      });

    listDepartments()
      .then((result) => {
        if (!current) return;
        setDepartmentRows(result.items);
        setSelectedDepartmentId(result.items[0]?.departmentId ?? null);
      })
      .catch((caught: unknown) => {
        if (current) setDepartmentError(departmentErrorText(caught));
      })
      .finally(() => {
        if (current) setIsLoadingDepartment(false);
      });

    listSections()
      .then((result) => {
        if (!current) return;
        setSectionRows(result.items);
        setSelectedSectionId(result.items[0]?.sectionId ?? null);
      })
      .catch((caught: unknown) => {
        if (current) setSectionError(sectionErrorText(caught));
      })
      .finally(() => {
        if (current) setIsLoadingSection(false);
      });

    listOrgHierarchyUsage()
      .then((result) => {
        if (current) setOrgHierarchyUsage(result.items);
      })
      .catch(() => {
        if (current) setOrgHierarchyUsage([]);
      })
      .finally(() => {
        if (current) setIsLoadingUsage(false);
      });

    return () => {
      current = false;
    };
  }, []);

  return (
    <section className={styles.page} aria-label="Function and Organization Data module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{functionDataModule.subtitle}</p>
          <h2>{functionDataModule.title}</h2>
          <p>{functionDataModule.description}</p>
        </div>
        <div className={styles.heroMetrics}>
          <div className={styles.heroMetric}>
            <strong>{rows.length}</strong>
            <span>Functions</span>
          </div>
          <div className={styles.heroMetric}>
            <strong>{divisionRows.length}</strong>
            <span>Divisions</span>
          </div>
          <div className={styles.heroMetric}>
            <strong>{departmentRows.length}</strong>
            <span>Departments</span>
          </div>
          <div className={styles.heroMetric}>
            <strong>{sectionRows.length}</strong>
            <span>Sections</span>
          </div>
        </div>
      </section>

      <section className={styles.workspace} aria-busy={isBusyLoading}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search function, division, department, or section"
            value={treeQuery}
            onChange={(event) => setTreeQuery(event.target.value)}
            placeholder="Search Function, Division, Department, or Section"
          />
          {isCenter ? (
            <div className={styles.newGroup}>
              <button
                type="button"
                className={styles.newButton}
                onClick={() => startNewAtLevel("function")}
                disabled={isBusy}
              >
                + Function
              </button>
              <button
                type="button"
                className={styles.newButton}
                onClick={() => startNewAtLevel("division")}
                disabled={isBusy}
              >
                + Division
              </button>
              <button
                type="button"
                className={styles.newButton}
                onClick={() => startNewAtLevel("department")}
                disabled={isBusy}
              >
                + Department
              </button>
              <button
                type="button"
                className={styles.newButton}
                onClick={() => startNewAtLevel("section")}
                disabled={isBusy}
              >
                + Section
              </button>
            </div>
          ) : null}
          <span className={styles.selectedLabel}>{selectedLabel}</span>
          {isCenter ? (
            <button
              type="button"
              className={styles.deleteButton}
              onClick={deleteSelected}
              disabled={!selectedLevel || isBusy}
            >
              Delete
            </button>
          ) : null}
          <button
            type="button"
            className={styles.refreshButton}
            onClick={refresh}
            disabled={isBusyLoading || isBusy}
          >
            Refresh
          </button>
        </div>

        <p className={styles.treeEmptyHint}>
          Click any Function, Division, Department, or Section code below to edit it.
        </p>

        {error ? <p role="alert">{error}</p> : null}
        {divisionError ? <p role="alert">{divisionError}</p> : null}
        {departmentError ? <p role="alert">{departmentError}</p> : null}
        {sectionError ? <p role="alert">{sectionError}</p> : null}

        {formMode ? (
          <section className={styles.editorPanel}>
            <h3>{formMode === "new" ? "Create Function" : "Edit Function"}</h3>
            <div className={styles.formGrid}>
              <label>
                Function Code{formMode === "new" ? " (auto)" : ""}
                <input
                  value={form.functionCode}
                  maxLength={30}
                  readOnly={formMode === "new"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      functionCode: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Function Name(TH)
                <input
                  value={form.functionNameTh}
                  maxLength={255}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      functionNameTh: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Function Name(EN)
                <input
                  value={form.functionNameEn}
                  maxLength={255}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      functionNameEn: event.target.value,
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
                      status: event.target.value as MasterStatus,
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

        {divisionFormMode ? (
          <section className={styles.editorPanel}>
            <h3>{divisionFormMode === "new" ? "Create Division" : "Edit Division"}</h3>
            <div className={styles.formGrid}>
              <label>
                Division Code{divisionFormMode === "new" ? " (auto)" : ""}
                <input
                  value={divisionForm.code}
                  maxLength={30}
                  readOnly={divisionFormMode === "new"}
                  onChange={(event) =>
                    setDivisionForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Division Name(TH)
                <input
                  value={divisionForm.nameTh}
                  maxLength={255}
                  onChange={(event) =>
                    setDivisionForm((current) => ({
                      ...current,
                      nameTh: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Division Name(EN)
                <input
                  value={divisionForm.nameEn}
                  maxLength={255}
                  onChange={(event) =>
                    setDivisionForm((current) => ({
                      ...current,
                      nameEn: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={divisionForm.status}
                  onChange={(event) =>
                    setDivisionForm((current) => ({
                      ...current,
                      status: event.target.value as MasterStatus,
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
                onClick={() => void saveDivision()}
                disabled={isSavingDivision}
              >
                {isSavingDivision ? "Saving..." : "Save"}
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={() => setDivisionFormMode(null)}
                disabled={isSavingDivision}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        {departmentFormMode ? (
          <section className={styles.editorPanel}>
            <h3>{departmentFormMode === "new" ? "Create Department" : "Edit Department"}</h3>
            <div className={styles.formGrid}>
              <label>
                Department Code{departmentFormMode === "new" ? " (auto)" : ""}
                <input
                  value={departmentForm.code}
                  maxLength={30}
                  readOnly={departmentFormMode === "new"}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Department Name(TH)
                <input
                  value={departmentForm.nameTh}
                  maxLength={255}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({
                      ...current,
                      nameTh: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Department Name(EN)
                <input
                  value={departmentForm.nameEn}
                  maxLength={255}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({
                      ...current,
                      nameEn: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={departmentForm.status}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({
                      ...current,
                      status: event.target.value as MasterStatus,
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
                onClick={() => void saveDepartment()}
                disabled={isSavingDepartment}
              >
                {isSavingDepartment ? "Saving..." : "Save"}
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={() => setDepartmentFormMode(null)}
                disabled={isSavingDepartment}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        {sectionFormMode ? (
          <section className={styles.editorPanel}>
            <h3>{sectionFormMode === "new" ? "Create Section" : "Edit Section"}</h3>
            <div className={styles.formGrid}>
              <label>
                Section Code{sectionFormMode === "new" ? " (auto)" : ""}
                <input
                  value={sectionForm.code}
                  maxLength={30}
                  readOnly={sectionFormMode === "new"}
                  onChange={(event) =>
                    setSectionForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Section Name(TH)
                <input
                  value={sectionForm.nameTh}
                  maxLength={255}
                  onChange={(event) =>
                    setSectionForm((current) => ({
                      ...current,
                      nameTh: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Section Name(EN)
                <input
                  value={sectionForm.nameEn}
                  maxLength={255}
                  onChange={(event) =>
                    setSectionForm((current) => ({
                      ...current,
                      nameEn: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={sectionForm.status}
                  onChange={(event) =>
                    setSectionForm((current) => ({
                      ...current,
                      status: event.target.value as MasterStatus,
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
                onClick={() => void saveSection()}
                disabled={isSavingSection}
              >
                {isSavingSection ? "Saving..." : "Save"}
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={() => setSectionFormMode(null)}
                disabled={isSavingSection}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Organization Structure</span>
              <h3>Function, Division, Department & Section</h3>
            </div>
            <p>
              {visibleCombinationRows.length} row
              {visibleCombinationRows.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.functionTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Function</th>
                  <th>Division</th>
                  <th>Department</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody translate="no">
                {visibleCombinationRows.map((row, index) => (
                  <tr key={row.key}>
                    <td>{index + 1}</td>
                    <td>
                      <Cell
                        code={row.functionRecord.functionCode}
                        label={displayName(
                          row.functionRecord.functionNameTh,
                          row.functionRecord.functionNameEn,
                        )}
                        selected={
                          selectedLevel === "function" &&
                          selectedId === row.functionRecord.functionId
                        }
                        onSelect={() => editFunctionRecord(row.functionRecord)}
                      />
                    </td>
                    <td>
                      <Cell
                        code={row.divisionRecord?.divisionCode}
                        label={
                          row.divisionRecord
                            ? displayName(row.divisionRecord.divisionNameTh, row.divisionRecord.divisionNameEn)
                            : "(No Division)"
                        }
                        selected={
                          selectedLevel === "division" &&
                          selectedDivisionId === row.divisionRecord?.divisionId
                        }
                        onSelect={
                          row.divisionRecord
                            ? () => editDivisionRecord(row.divisionRecord!)
                            : undefined
                        }
                      />
                    </td>
                    <td>
                      <Cell
                        code={row.departmentRecord?.departmentCode}
                        label={
                          row.departmentRecord
                            ? displayName(
                                row.departmentRecord.departmentNameTh,
                                row.departmentRecord.departmentNameEn,
                              )
                            : "(No Department)"
                        }
                        selected={
                          selectedLevel === "department" &&
                          selectedDepartmentId === row.departmentRecord?.departmentId
                        }
                        onSelect={
                          row.departmentRecord
                            ? () => editDepartmentRecord(row.departmentRecord!)
                            : undefined
                        }
                      />
                    </td>
                    <td>
                      <Cell
                        code={row.sectionRecord?.sectionCode}
                        label={
                          row.sectionRecord
                            ? displayName(row.sectionRecord.sectionNameTh, row.sectionRecord.sectionNameEn)
                            : "(No Section)"
                        }
                        selected={
                          selectedLevel === "section" &&
                          selectedSectionId === row.sectionRecord?.sectionId
                        }
                        onSelect={
                          row.sectionRecord
                            ? () => editSectionRecord(row.sectionRecord!)
                            : undefined
                        }
                      />
                    </td>
                  </tr>
                ))}
                {!isBusyLoading && visibleCombinationRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No matching records.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <details className={styles.orphanPanel}>
            <summary>
              Unlinked records ({orphanDivisions.length + orphanDepartments.length + orphanSections.length})
            </summary>
            <div className={styles.orphanGrid}>
              <div>
                <h4>Divisions</h4>
                {orphanDivisions.length === 0 ? (
                  <p className={styles.treeEmptyHint}>None</p>
                ) : (
                  <ul className={styles.orphanList}>
                    {orphanDivisions.map((row) => (
                      <li key={row.divisionId}>
                        <button
                          type="button"
                          className={styles.treeLabel}
                          onClick={() => editDivisionRecord(row)}
                        >
                          <span className={styles.codePill} translate="no">
                            {row.divisionCode}
                          </span>
                          <span translate="no">{displayName(row.divisionNameTh, row.divisionNameEn)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4>Departments</h4>
                {orphanDepartments.length === 0 ? (
                  <p className={styles.treeEmptyHint}>None</p>
                ) : (
                  <ul className={styles.orphanList}>
                    {orphanDepartments.map((row) => (
                      <li key={row.departmentId}>
                        <button
                          type="button"
                          className={styles.treeLabel}
                          onClick={() => editDepartmentRecord(row)}
                        >
                          <span className={styles.codePill} translate="no">
                            {row.departmentCode}
                          </span>
                          <span translate="no">
                            {displayName(row.departmentNameTh, row.departmentNameEn)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4>Sections</h4>
                {orphanSections.length === 0 ? (
                  <p className={styles.treeEmptyHint}>None</p>
                ) : (
                  <ul className={styles.orphanList}>
                    {orphanSections.map((row) => (
                      <li key={row.sectionId}>
                        <button
                          type="button"
                          className={styles.treeLabel}
                          onClick={() => editSectionRecord(row)}
                        >
                          <span className={styles.codePill} translate="no">
                            {row.sectionCode}
                          </span>
                          <span translate="no">{displayName(row.sectionNameTh, row.sectionNameEn)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        </section>
      </section>
    </section>
  );
}
