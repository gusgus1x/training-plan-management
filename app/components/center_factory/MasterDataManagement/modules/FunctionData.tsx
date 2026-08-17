"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
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

export default function FunctionData() {
  const user = useAuthenticatedUser();
  const isCenter = user?.roleCode === "HRD_CENTER";

  // --- 1. Function State ---
  const [rows, setRows] = useState<OrganizationFunctionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
  const [message, setMessage] = useState<string | null>(null);

  // --- 2. Division State ---
  const [divisionRows, setDivisionRows] = useState<DivisionRecord[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [divisionSearch, setDivisionSearch] = useState("");
  const [divisionFormMode, setDivisionFormMode] = useState<"new" | "edit" | null>(null);
  const [divisionForm, setDivisionForm] = useState<GenericForm>(blankForm);
  const [isLoadingDivision, setIsLoadingDivision] = useState(true);
  const [isSavingDivision, setIsSavingDivision] = useState(false);
  const [divisionError, setDivisionError] = useState<string | null>(null);
  const [divisionMessage, setDivisionMessage] = useState<string | null>(null);

  // --- 3. Department State ---
  const [departmentRows, setDepartmentRows] = useState<DepartmentRecord[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [departmentFormMode, setDepartmentFormMode] = useState<"new" | "edit" | null>(null);
  const [departmentForm, setDepartmentForm] = useState<GenericForm>(blankForm);
  const [isLoadingDepartment, setIsLoadingDepartment] = useState(true);
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [departmentMessage, setDepartmentMessage] = useState<string | null>(null);

  // --- 4. Section State ---
  const [sectionRows, setSectionRows] = useState<SectionRecord[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sectionSearch, setSectionSearch] = useState("");
  const [sectionFormMode, setSectionFormMode] = useState<"new" | "edit" | null>(null);
  const [sectionForm, setSectionForm] = useState<GenericForm>(blankForm);
  const [isLoadingSection, setIsLoadingSection] = useState(true);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [sectionMessage, setSectionMessage] = useState<string | null>(null);

  // --- Filtered Rows ---
  const selected = rows.find((row) => row.functionId === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.functionCode, row.functionNameTh, row.functionNameEn, row.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  const selectedDivision = divisionRows.find((row) => row.divisionId === selectedDivisionId) ?? null;
  const visibleDivisionRows = useMemo(() => {
    const query = divisionSearch.trim().toLowerCase();
    if (!query) return divisionRows;
    return divisionRows.filter((row) =>
      [row.divisionCode, row.divisionNameTh, row.divisionNameEn, row.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [divisionRows, divisionSearch]);

  const selectedDepartment = departmentRows.find((row) => row.departmentId === selectedDepartmentId) ?? null;
  const visibleDepartmentRows = useMemo(() => {
    const query = departmentSearch.trim().toLowerCase();
    if (!query) return departmentRows;
    return departmentRows.filter((row) =>
      [row.departmentCode, row.departmentNameTh, row.departmentNameEn, row.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [departmentRows, departmentSearch]);

  const selectedSection = sectionRows.find((row) => row.sectionId === selectedSectionId) ?? null;
  const visibleSectionRows = useMemo(() => {
    const query = sectionSearch.trim().toLowerCase();
    if (!query) return sectionRows;
    return sectionRows.filter((row) =>
      [row.sectionCode, row.sectionNameTh, row.sectionNameEn, row.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [sectionRows, sectionSearch]);

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
    setForm({ functionCode: "", functionNameTh: "", functionNameEn: "", status: "ACTIVE" });
    setFormMode("new");
    setError(null);
    setMessage(null);
  };

  const startEdit = () => {
    if (!isCenter || !selected) return;
    setForm({
      functionCode: selected.functionCode,
      functionNameTh: selected.functionNameTh,
      functionNameEn: selected.functionNameEn ?? "",
      status: selected.status,
    });
    setFormMode("edit");
    setError(null);
    setMessage(null);
  };

  const save = async () => {
    if (!isCenter || isSaving || !formMode) return;
    const savingMode = formMode;
    const editingFunctionId = selected?.functionId ?? null;
    if (savingMode === "edit" && !editingFunctionId) {
      setError("Select a Function before saving changes.");
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
      setFormMode(null);
      setForm({ functionCode: "", functionNameTh: "", functionNameEn: "", status: "ACTIVE" });
      setMessage(`${result.function.functionCode} was saved.`);
    } catch (caught: unknown) {
      setError(functionErrorText(caught));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (
      !isCenter ||
      !selected ||
      isSaving ||
      !window.confirm(`Delete ${selected.functionCode}?`)
    ) {
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
      setMessage(`${result.function.functionCode} was deleted.`);
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
    setForm({ functionCode: "", functionNameTh: "", functionNameEn: "", status: "ACTIVE" });
    setMessage(null);
    void loadRows();
    void loadDivisionRows();
    void loadDepartmentRows();
    void loadSectionRows();
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
    setDivisionForm(blankForm());
    setDivisionFormMode("new");
    setDivisionError(null);
    setDivisionMessage(null);
  };

  const startEditDivision = () => {
    if (!isCenter || !selectedDivision) return;
    setDivisionForm({
      code: selectedDivision.divisionCode,
      nameTh: selectedDivision.divisionNameTh,
      nameEn: selectedDivision.divisionNameEn ?? "",
      status: selectedDivision.status,
    });
    setDivisionFormMode("edit");
    setDivisionError(null);
    setDivisionMessage(null);
  };

  const saveDivision = async () => {
    if (!isCenter || isSavingDivision || !divisionFormMode) return;
    const savingMode = divisionFormMode;
    const editingId = selectedDivision?.divisionId ?? null;
    if (savingMode === "edit" && !editingId) {
      setDivisionError("Select a Division before saving changes.");
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
      setDivisionFormMode(null);
      setDivisionForm(blankForm());
      setDivisionMessage(`${result.division.divisionCode} was saved.`);
    } catch (caught: unknown) {
      setDivisionError(divisionErrorText(caught));
    } finally {
      setIsSavingDivision(false);
    }
  };

  const removeDivision = async () => {
    if (
      !isCenter ||
      !selectedDivision ||
      isSavingDivision ||
      !window.confirm(`Delete Division ${selectedDivision.divisionCode}?`)
    ) {
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
      setDivisionMessage(`${result.division.divisionCode} was deleted.`);
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
    setDepartmentForm(blankForm());
    setDepartmentFormMode("new");
    setDepartmentError(null);
    setDepartmentMessage(null);
  };

  const startEditDepartment = () => {
    if (!isCenter || !selectedDepartment) return;
    setDepartmentForm({
      code: selectedDepartment.departmentCode,
      nameTh: selectedDepartment.departmentNameTh,
      nameEn: selectedDepartment.departmentNameEn ?? "",
      status: selectedDepartment.status,
    });
    setDepartmentFormMode("edit");
    setDepartmentError(null);
    setDepartmentMessage(null);
  };

  const saveDepartment = async () => {
    if (!isCenter || isSavingDepartment || !departmentFormMode) return;
    const savingMode = departmentFormMode;
    const editingId = selectedDepartment?.departmentId ?? null;
    if (savingMode === "edit" && !editingId) {
      setDepartmentError("Select a Department before saving changes.");
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
      setDepartmentFormMode(null);
      setDepartmentForm(blankForm());
      setDepartmentMessage(`${result.department.departmentCode} was saved.`);
    } catch (caught: unknown) {
      setDepartmentError(departmentErrorText(caught));
    } finally {
      setIsSavingDepartment(false);
    }
  };

  const removeDepartment = async () => {
    if (
      !isCenter ||
      !selectedDepartment ||
      isSavingDepartment ||
      !window.confirm(`Delete Department ${selectedDepartment.departmentCode}?`)
    ) {
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
      setDepartmentMessage(`${result.department.departmentCode} was deleted.`);
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
    setSectionForm(blankForm());
    setSectionFormMode("new");
    setSectionError(null);
    setSectionMessage(null);
  };

  const startEditSection = () => {
    if (!isCenter || !selectedSection) return;
    setSectionForm({
      code: selectedSection.sectionCode,
      nameTh: selectedSection.sectionNameTh,
      nameEn: selectedSection.sectionNameEn ?? "",
      status: selectedSection.status,
    });
    setSectionFormMode("edit");
    setSectionError(null);
    setSectionMessage(null);
  };

  const saveSection = async () => {
    if (!isCenter || isSavingSection || !sectionFormMode) return;
    const savingMode = sectionFormMode;
    const editingId = selectedSection?.sectionId ?? null;
    if (savingMode === "edit" && !editingId) {
      setSectionError("Select a Section before saving changes.");
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
      setSectionFormMode(null);
      setSectionForm(blankForm());
      setSectionMessage(`${result.section.sectionCode} was saved.`);
    } catch (caught: unknown) {
      setSectionError(sectionErrorText(caught));
    } finally {
      setIsSavingSection(false);
    }
  };

  const removeSection = async () => {
    if (
      !isCenter ||
      !selectedSection ||
      isSavingSection ||
      !window.confirm(`Delete Section ${selectedSection.sectionCode}?`)
    ) {
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
      setSectionMessage(`${result.section.sectionCode} was deleted.`);
      void listSections()
        .then((refreshed) => applySectionRows(refreshed.items))
        .catch(() => undefined);
    } catch (caught: unknown) {
      setSectionError(sectionErrorText(caught));
    } finally {
      setIsSavingSection(false);
    }
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

      {/* ==================================================================== */}
      {/* 1. FUNCTION RECORDS WORKSPACE */}
      {/* ==================================================================== */}
      <section className={styles.workspace} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search function data"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search function code or name"
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

        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}

        {formMode ? (
          <section className={styles.editorPanel}>
            <h3>{formMode === "new" ? "Create Function" : "Edit Function"}</h3>
            <div className={styles.formGrid}>
              <label>
                Function Code
                <input
                  value={form.functionCode}
                  maxLength={30}
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

        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Shared Master</span>
              <h3>Function Records</h3>
            </div>
            <p>{visibleRows.length} records</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.functionTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Function Code</th>
                  <th>Function Name(TH)</th>
                  <th>Function Name(EN)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody translate="no">
                {visibleRows.map((row, index) => (
                  <tr
                    key={row.functionId}
                    className={
                      row.functionId === selectedId
                        ? styles.selectedRow
                        : undefined
                    }
                    onClick={() => setSelectedId(row.functionId)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <span className={styles.codePill}>
                        {row.functionCode}
                      </span>
                    </td>
                    <td>{row.functionNameTh}</td>
                    <td>{row.functionNameEn ?? "-"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {!isLoading && visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No function data found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {/* ==================================================================== */}
      {/* 2. DIVISION RECORDS WORKSPACE */}
      {/* ==================================================================== */}
      <section className={styles.workspace} aria-busy={isLoadingDivision}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search division data"
            value={divisionSearch}
            onChange={(event) => setDivisionSearch(event.target.value)}
            placeholder="Search division code or name"
          />
          {isCenter ? (
            <>
              <button
                className={styles.newButton}
                type="button"
                onClick={startNewDivision}
                disabled={isSavingDivision}
              >
                New
              </button>
              <button
                className={styles.editButton}
                type="button"
                onClick={startEditDivision}
                disabled={!selectedDivision || isSavingDivision}
              >
                Edit
              </button>
              <button
                className={styles.deleteButton}
                type="button"
                onClick={() => void removeDivision()}
                disabled={!selectedDivision || isSavingDivision}
              >
                Delete
              </button>
            </>
          ) : null}
          <button
            className={styles.refreshButton}
            type="button"
            onClick={loadDivisionRows}
            disabled={isLoadingDivision || isSavingDivision}
          >
            Refresh
          </button>
        </div>

        {divisionError ? <p role="alert">{divisionError}</p> : null}
        {divisionMessage ? <p role="status">{divisionMessage}</p> : null}

        {divisionFormMode ? (
          <section className={styles.editorPanel}>
            <h3>{divisionFormMode === "new" ? "Create Division" : "Edit Division"}</h3>
            <div className={styles.formGrid}>
              <label>
                Division Code
                <input
                  value={divisionForm.code}
                  maxLength={30}
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

        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Division Master</span>
              <h3>Division Records</h3>
            </div>
            <p>{visibleDivisionRows.length} records</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.functionTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Division Code</th>
                  <th>Division Name(TH)</th>
                  <th>Division Name(EN)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody translate="no">
                {visibleDivisionRows.map((row, index) => (
                  <tr
                    key={row.divisionId}
                    className={
                      row.divisionId === selectedDivisionId
                        ? styles.selectedRow
                        : undefined
                    }
                    onClick={() => setSelectedDivisionId(row.divisionId)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <span className={styles.codePill}>
                        {row.divisionCode}
                      </span>
                    </td>
                    <td>{row.divisionNameTh}</td>
                    <td>{row.divisionNameEn ?? "-"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {!isLoadingDivision && visibleDivisionRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No division data found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {/* ==================================================================== */}
      {/* 3. DEPARTMENT RECORDS WORKSPACE */}
      {/* ==================================================================== */}
      <section className={styles.workspace} aria-busy={isLoadingDepartment}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search department data"
            value={departmentSearch}
            onChange={(event) => setDepartmentSearch(event.target.value)}
            placeholder="Search department code or name"
          />
          {isCenter ? (
            <>
              <button
                className={styles.newButton}
                type="button"
                onClick={startNewDepartment}
                disabled={isSavingDepartment}
              >
                New
              </button>
              <button
                className={styles.editButton}
                type="button"
                onClick={startEditDepartment}
                disabled={!selectedDepartment || isSavingDepartment}
              >
                Edit
              </button>
              <button
                className={styles.deleteButton}
                type="button"
                onClick={() => void removeDepartment()}
                disabled={!selectedDepartment || isSavingDepartment}
              >
                Delete
              </button>
            </>
          ) : null}
          <button
            className={styles.refreshButton}
            type="button"
            onClick={loadDepartmentRows}
            disabled={isLoadingDepartment || isSavingDepartment}
          >
            Refresh
          </button>
        </div>

        {departmentError ? <p role="alert">{departmentError}</p> : null}
        {departmentMessage ? <p role="status">{departmentMessage}</p> : null}

        {departmentFormMode ? (
          <section className={styles.editorPanel}>
            <h3>{departmentFormMode === "new" ? "Create Department" : "Edit Department"}</h3>
            <div className={styles.formGrid}>
              <label>
                Department Code
                <input
                  value={departmentForm.code}
                  maxLength={30}
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

        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Department Master</span>
              <h3>Department Records</h3>
            </div>
            <p>{visibleDepartmentRows.length} records</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.functionTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Department Code</th>
                  <th>Department Name(TH)</th>
                  <th>Department Name(EN)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody translate="no">
                {visibleDepartmentRows.map((row, index) => (
                  <tr
                    key={row.departmentId}
                    className={
                      row.departmentId === selectedDepartmentId
                        ? styles.selectedRow
                        : undefined
                    }
                    onClick={() => setSelectedDepartmentId(row.departmentId)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <span className={styles.codePill}>
                        {row.departmentCode}
                      </span>
                    </td>
                    <td>{row.departmentNameTh}</td>
                    <td>{row.departmentNameEn ?? "-"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {!isLoadingDepartment && visibleDepartmentRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No department data found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {/* ==================================================================== */}
      {/* 4. SECTION RECORDS WORKSPACE */}
      {/* ==================================================================== */}
      <section className={styles.workspace} aria-busy={isLoadingSection}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search section data"
            value={sectionSearch}
            onChange={(event) => setSectionSearch(event.target.value)}
            placeholder="Search section code or name"
          />
          {isCenter ? (
            <>
              <button
                className={styles.newButton}
                type="button"
                onClick={startNewSection}
                disabled={isSavingSection}
              >
                New
              </button>
              <button
                className={styles.editButton}
                type="button"
                onClick={startEditSection}
                disabled={!selectedSection || isSavingSection}
              >
                Edit
              </button>
              <button
                className={styles.deleteButton}
                type="button"
                onClick={() => void removeSection()}
                disabled={!selectedSection || isSavingSection}
              >
                Delete
              </button>
            </>
          ) : null}
          <button
            className={styles.refreshButton}
            type="button"
            onClick={loadSectionRows}
            disabled={isLoadingSection || isSavingSection}
          >
            Refresh
          </button>
        </div>

        {sectionError ? <p role="alert">{sectionError}</p> : null}
        {sectionMessage ? <p role="status">{sectionMessage}</p> : null}

        {sectionFormMode ? (
          <section className={styles.editorPanel}>
            <h3>{sectionFormMode === "new" ? "Create Section" : "Edit Section"}</h3>
            <div className={styles.formGrid}>
              <label>
                Section Code
                <input
                  value={sectionForm.code}
                  maxLength={30}
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
              <span>Section Master</span>
              <h3>Section Records</h3>
            </div>
            <p>{visibleSectionRows.length} records</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.functionTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Section Code</th>
                  <th>Section Name(TH)</th>
                  <th>Section Name(EN)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody translate="no">
                {visibleSectionRows.map((row, index) => (
                  <tr
                    key={row.sectionId}
                    className={
                      row.sectionId === selectedSectionId
                        ? styles.selectedRow
                        : undefined
                    }
                    onClick={() => setSelectedSectionId(row.sectionId)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <span className={styles.codePill}>
                        {row.sectionCode}
                      </span>
                    </td>
                    <td>{row.sectionNameTh}</td>
                    <td>{row.sectionNameEn ?? "-"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {!isLoadingSection && visibleSectionRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No section data found.</td>
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
