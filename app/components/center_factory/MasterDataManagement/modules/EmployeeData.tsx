"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { listCompanies } from "../../../../lib/companies/client";
import type { CompanyRecord } from "../../../../lib/companies/types";
import {
  createEmployee,
  deleteEmployee,
  EmployeeClientError,
  listEmployees,
  revealEmployeeNationalId,
  updateEmployee,
} from "../../../../lib/employees/client";
import type {
  EmployeeInput,
  EmployeeRecord,
} from "../../../../lib/employees/types";
import { isValidThaiNationalId } from "../../../../lib/employees/nationalIdValidation";
import { listFunctions } from "../../../../lib/functions/client";
import type { OrganizationFunctionRecord as FunctionRecord } from "../../../../lib/functions/types";
import { listDivisions } from "../../../../lib/divisions/client";
import type { DivisionRecord } from "../../../../lib/divisions/types";
import { listDepartments } from "../../../../lib/departments/client";
import type { DepartmentRecord } from "../../../../lib/departments/types";
import { listSections } from "../../../../lib/sections/client";
import type { SectionRecord } from "../../../../lib/sections/types";
import { listLevels } from "../../../../lib/levels/client";
import type { LevelRecord } from "../../../../lib/levels/types";
import { listPositions } from "../../../../lib/positions/client";
import type { PositionRecord } from "../../../../lib/positions/types";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./EmployeeData.module.css";

export const employeeDataModule = {
  title: "Employee Data",
  subtitle: "Employee master",
  description:
    "Maintain company-scoped employee profiles with protected Thai National IDs.",
} as const;

const blank = (companyId = ""): EmployeeInput => ({
  companyId,
  employeeCode: "",
  functionId: null,
  divisionId: null,
  departmentId: null,
  sectionId: null,
  positionId: null,
  levelId: null,
  nationalId: "",
  titleTh: "นาย",
  titleEn: null,
  firstNameTh: "",
  lastNameTh: "",
  firstNameEn: null,
  lastNameEn: null,
  birthDate: null,
  hireDate: null,
  telephone: null,
  email: null,
  employmentStatus: "ACTIVE",
});

const display = (value: string | null) => value || "-";
const EMPLOYEE_PAGE_SIZE = 25;
const PAGE_WINDOW_SIZE = 5;

const pageWindow = (current: number, totalPages: number) => {
  if (totalPages <= PAGE_WINDOW_SIZE) return { start: 1, end: totalPages };
  let start = Math.max(1, current - Math.floor(PAGE_WINDOW_SIZE / 2));
  let end = start + PAGE_WINDOW_SIZE - 1;
  if (end > totalPages) {
    end = totalPages;
    start = end - PAGE_WINDOW_SIZE + 1;
  }
  return { start, end };
};

const EMPLOYEE_COLUMNS = [
  { key: "no", label: "No.", defaultWidth: 56 },
  { key: "company", label: "Company", defaultWidth: 90 },
  { key: "empCode", label: "Emp Code", defaultWidth: 110 },
  { key: "idCard", label: "ID Card", defaultWidth: 130 },
  { key: "titleTh", label: "Title(TH)", defaultWidth: 70 },
  { key: "nameTh", label: "Name(TH)", defaultWidth: 120 },
  { key: "surnameTh", label: "Surname(TH)", defaultWidth: 120 },
  { key: "titleEn", label: "Title(EN)", defaultWidth: 70 },
  { key: "nameEn", label: "Name(EN)", defaultWidth: 120 },
  { key: "surnameEn", label: "Surname(EN)", defaultWidth: 120 },
  { key: "birthday", label: "Birthday", defaultWidth: 100 },
  { key: "workday", label: "Workday", defaultWidth: 100 },
  { key: "functionCode", label: "Function Code", defaultWidth: 110 },
  { key: "functionName", label: "Function Name", defaultWidth: 150 },
  { key: "division", label: "Division", defaultWidth: 120 },
  { key: "department", label: "Department", defaultWidth: 120 },
  { key: "section", label: "Section", defaultWidth: 120 },
  { key: "positionName", label: "Position Name", defaultWidth: 150 },
  { key: "levelKey", label: "Level Key", defaultWidth: 90 },
] as const;
const MIN_COLUMN_WIDTH = 48;
const MIN_ROW_HEIGHT = 28;

type ResizeDrag =
  | { axis: "column"; key: string; startPointer: number; startSize: number }
  | { axis: "row"; key: string; startPointer: number; startSize: number };

export default function EmployeeData() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
  const toast = useToast();
  const center = user?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<EmployeeRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [functions, setFunctions] = useState<FunctionRecord[]>([]);
  const [divisions, setDivisions] = useState<DivisionRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [levels, setLevels] = useState<LevelRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openCompanies, setOpenCompanies] = useState<string[]>([]);
  const [companyPage, setCompanyPage] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [mode, setMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<EmployeeInput>(blank());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revealedNationalIds, setRevealedNationalIds] = useState<
    Record<string, string>
  >({});
  const [revealingNationalIds, setRevealingNationalIds] = useState(false);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const resizeDrag = useRef<ResizeDrag | null>(null);
  const selected =
    rows.find((employee) => employee.employeeId === selectedId) ?? null;

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = resizeDrag.current;
      if (!drag) return;
      if (drag.axis === "column") {
        const next = Math.max(
          MIN_COLUMN_WIDTH,
          drag.startSize + (event.clientX - drag.startPointer),
        );
        setColumnWidths((current) => ({ ...current, [drag.key]: next }));
      } else {
        const next = Math.max(
          MIN_ROW_HEIGHT,
          drag.startSize + (event.clientY - drag.startPointer),
        );
        setRowHeights((current) => ({ ...current, [drag.key]: next }));
      }
    };
    const onPointerUp = () => {
      resizeDrag.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const startColumnResize =
    (key: string, defaultWidth: number) =>
    (event: React.PointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      resizeDrag.current = {
        axis: "column",
        key,
        startPointer: event.clientX,
        startSize: columnWidths[key] ?? defaultWidth,
      };
    };

  const startRowResize =
    (employeeId: string) => (event: React.PointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const row = event.currentTarget.closest("tr");
      resizeDrag.current = {
        axis: "row",
        key: employeeId,
        startPointer: event.clientY,
        startSize:
          rowHeights[employeeId] ?? row?.getBoundingClientRect().height ?? 42,
      };
    };

  const tableWidth = useMemo(
    () =>
      EMPLOYEE_COLUMNS.reduce(
        (total, column) => total + (columnWidths[column.key] ?? column.defaultWidth),
        0,
      ),
    [columnWidths],
  );

  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setError(null);
    setRevealedNationalIds({});
    setIsLoading(true);
    try {
      const [
        employeeResult,
        companyResult,
        functionResult,
        divisionResult,
        departmentResult,
        sectionResult,
        positionResult,
        levelResult,
      ] = await Promise.all([
        listEmployees(),
        listCompanies(),
        listFunctions(),
        listDivisions(),
        listDepartments(),
        listSections(),
        listPositions(),
        listLevels(),
      ]);
      setRows(employeeResult.items);
      setCompanies(companyResult.items);
      setFunctions(functionResult.items);
      setDivisions(divisionResult.items);
      setDepartments(departmentResult.items);
      setSections(sectionResult.items);
      setPositions(positionResult.items);
      setLevels(levelResult.items);
      setSelectedId((current) =>
        current &&
        employeeResult.items.some((employee) => employee.employeeId === current)
          ? current
          : (employeeResult.items[0]?.employeeId ?? null),
      );
      setOpenCompanies((current) => {
        const companyIds = new Set(
          employeeResult.items.map((employee) => employee.companyId),
        );
        const retained = current.filter((companyId) => companyIds.has(companyId));
        return retained;
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load Employee Data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((employee) => {
      const matchesCompany =
        companyFilter === "all" || employee.companyId === companyFilter;
      const matchesSearch =
        !query ||
        [
          employee.companyCode,
          employee.employeeCode,
          employee.nationalIdMasked,
          employee.titleTh,
          employee.titleEn,
          employee.firstNameTh,
          employee.lastNameTh,
          employee.firstNameEn,
          employee.lastNameEn,
          employee.birthDate,
          employee.hireDate,
          employee.telephone,
          employee.email,
          employee.functionCode,
          employee.functionName,
          employee.divisionCode,
          employee.divisionName,
          employee.departmentCode,
          employee.departmentName,
          employee.sectionCode,
          employee.sectionName,
          employee.positionCode,
          employee.positionName,
          employee.levelCode,
          employee.levelKey,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesCompany && matchesSearch;
    });
  }, [rows, search, companyFilter]);

  const visibleCompanyGroups = useMemo(() => {
    const companyOrder = new Map(
      companies.map((company, index) => [company.companyId, index]),
    );
    const grouped = new Map<
      string,
      { companyId: string; companyCode: string; rows: EmployeeRecord[] }
    >();

    for (const employee of visible) {
      const group = grouped.get(employee.companyId);
      if (group) {
        group.rows.push(employee);
      } else {
        grouped.set(employee.companyId, {
          companyId: employee.companyId,
          companyCode: employee.companyCode,
          rows: [employee],
        });
      }
    }

    return [...grouped.values()]
      .map((group) => ({
        ...group,
        totalRecords: rows.filter(
          (employee) => employee.companyId === group.companyId,
        ).length,
      }))
      .sort(
        (left, right) =>
          (companyOrder.get(left.companyId) ?? Number.MAX_SAFE_INTEGER) -
            (companyOrder.get(right.companyId) ?? Number.MAX_SAFE_INTEGER) ||
          left.companyCode.localeCompare(right.companyCode),
      );
  }, [companies, rows, visible]);

  const toggleCompany = (companyId: string) => {
    setOpenCompanies((current) =>
      current.includes(companyId)
        ? current.filter((openCompanyId) => openCompanyId !== companyId)
        : [...current, companyId],
    );
  };

  const change = <Key extends keyof EmployeeInput>(
    key: Key,
    value: EmployeeInput[Key],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const edit = async () => {
    const employee = selected;
    if (!employee || saving || loadingEditor) return;

    setLoadingEditor(true);
    setError(null);
    setMessage(null);
    const openEditor = (nationalId: string) => {
      setRevealedNationalIds({});
      setForm({
        companyId: employee.companyId,
        employeeCode: employee.employeeCode,
        functionId: employee.functionId,
        divisionId: employee.divisionId,
        departmentId: employee.departmentId,
        sectionId: employee.sectionId,
        positionId: employee.positionId,
        levelId: employee.levelId,
        nationalId,
        titleTh: employee.titleTh,
        titleEn: employee.titleEn,
        firstNameTh: employee.firstNameTh,
        lastNameTh: employee.lastNameTh,
        firstNameEn: employee.firstNameEn,
        lastNameEn: employee.lastNameEn,
        birthDate: employee.birthDate,
        hireDate: employee.hireDate,
        telephone: employee.telephone,
        email: employee.email,
        employmentStatus: employee.employmentStatus,
      });
      setSelectedId(employee.employeeId);
      setMode("edit");
    };
    if (employee.nationalIdMasked === "*************") {
      openEditor("");
      setMessage(
        "This employee has no protected National ID yet. Enter a valid 13-digit National ID before saving.",
      );
      setLoadingEditor(false);
      return;
    }
    try {
      const { nationalId } = await revealEmployeeNationalId(
        employee.employeeId,
      );
      openEditor(nationalId);
    } catch (editError) {
      if (
        editError instanceof EmployeeClientError &&
        editError.code === "NATIONAL_ID_UNAVAILABLE"
      ) {
        openEditor("");
        setMessage(
          "This employee has no protected National ID yet. Enter a valid 13-digit National ID before saving.",
        );
      } else {
        setError(
          editError instanceof Error
            ? editError.message
            : "Unable to load National ID for editing",
        );
      }
    } finally {
      setLoadingEditor(false);
    }
  };

  const save = async () => {
    if (saving || !mode) return;
    const savingMode = mode;
    const editingEmployeeId = selected?.employeeId ?? null;
    if (savingMode === "edit" && !editingEmployeeId) {
      setError("Select an Employee before saving changes.");
      return;
    }
    const nationalId = form.nationalId.trim();
    const requiresNationalId =
      savingMode === "new" || selected?.nationalIdMasked === "*************";
    if (!nationalId && requiresNationalId) {
      setError("National ID is required and must contain exactly 13 digits.");
      return;
    }
    if (nationalId && !isValidThaiNationalId(nationalId)) {
      setError("National ID must contain exactly 13 digits.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = { ...form, nationalId };
      const { nationalId: submittedNationalId, ...withoutNationalId } = payload;
      const result =
        savingMode === "edit" && editingEmployeeId
          ? await updateEmployee(
              editingEmployeeId,
              submittedNationalId ? payload : withoutNationalId,
            )
          : await createEmployee(payload);
      setRows((current) =>
        savingMode === "edit"
          ? current.map((employee) =>
              employee.employeeId === result.employee.employeeId
                ? result.employee
                : employee,
            )
          : [...current, result.employee],
      );
      void listEmployees()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
      setSelectedId(result.employee.employeeId);
      setOpenCompanies((current) =>
        current.includes(result.employee.companyId)
          ? current
          : [...current, result.employee.companyId],
      );
      setMode(null);
      setForm(blank(center ? result.employee.companyId : user?.companyId ?? ""));
      toast.success(`บันทึกพนักงาน ${result.employee.employeeCode} แล้ว / Employee saved`);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save Employee",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving || !selected) return;
    if (!(await confirm({ message: `Delete ${selected.employeeCode}?`, confirmLabel: "Delete", danger: true })))
      return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteEmployee(selected.employeeId);
      setRows((current) =>
        current.filter(
          (employee) => employee.employeeId !== selected.employeeId,
        ),
      );
      setSelectedId(null);
      setRevealedNationalIds({});
      setMode(null);
      void listEmployees()
        .then((refreshed) => setRows(refreshed.items))
        .catch(() => undefined);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete Employee",
      );
    } finally {
      setSaving(false);
    }
  };

  const refresh = () => {
    setMode(null);
    setForm(blank(center ? (companies[0]?.companyId ?? "") : (user?.companyId ?? "")));
    setMessage(null);
    void load();
  };

  const revealAll = async () => {
    if (Object.keys(revealedNationalIds).length > 0) {
      setRevealedNationalIds({});
      return;
    }
    if (rows.length === 0) return;
    setError(null);
    setRevealingNationalIds(true);
    try {
      const revealed = await Promise.all(
        rows.map(async (employee) => {
          const result = await revealEmployeeNationalId(employee.employeeId);
          return [employee.employeeId, result.nationalId] as const;
        }),
      );
      setRevealedNationalIds(Object.fromEntries(revealed));
    } catch (revealError) {
      setError(
        revealError instanceof Error ? revealError.message : "Access denied",
      );
    } finally {
      setRevealingNationalIds(false);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.page} aria-label="Employee Data module">
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>{employeeDataModule.subtitle}</p>
            <h2 translate="no">{employeeDataModule.title}</h2>
            <p>{employeeDataModule.description}</p>
          </div>
        </section>
        <TypewriterLoader label="กำลังโหลดข้อมูลพนักงาน..." />
      </section>
    );
  }

  return (
    <section className={styles.page} aria-label="Employee Data module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{employeeDataModule.subtitle}</p>
          <h2>{employeeDataModule.title}</h2>
          <p>{employeeDataModule.description}</p>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search employee data"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employee"
          />
          <select
            aria-label="Filter employee company"
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
          >
            <option value="all">All Companies</option>
            {companies.map((company) => (
              <option key={company.companyId} value={company.companyId}>
                {company.companyCode}
              </option>
            ))}
          </select>
          <button
            className={styles.newButton}
            type="button"
            disabled={saving || loadingEditor}
            onClick={() => {
              setForm(
                blank(center ? (companies[0]?.companyId ?? "") : (user?.companyId ?? "")),
              );
              setMode("new");
            }}
          >
            New
          </button>
          <button
            className={styles.editButton}
            type="button"
            disabled={!selected || saving || loadingEditor}
            onClick={() => void edit()}
          >
            {loadingEditor ? "Loading..." : "Edit"}
          </button>
          <button
            className={styles.deleteButton}
            type="button"
            disabled={!selected || saving || loadingEditor}
            onClick={() => void remove()}
          >
            Delete
          </button>
          <button
            className={styles.refreshButton}
            type="button"
            disabled={saving || loadingEditor}
            onClick={refresh}
          >
            Refresh
          </button>
          <button
            className={styles.refreshButton}
            type="button"
            disabled={
              rows.length === 0 ||
              revealingNationalIds ||
              saving ||
              loadingEditor
            }
            onClick={() => void revealAll()}
          >
            {revealingNationalIds
              ? "Revealing..."
              : Object.keys(revealedNationalIds).length > 0
                ? "Hide All IDs"
                : "Reveal All IDs"}
          </button>
        </div>

        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
        {mode ? (
          <section className={styles.editorPanel}>
            <div className={styles.formGrid}>
              <label>
                Company
                <select
                  disabled={!center}
                  value={form.companyId}
                  onChange={(event) => change("companyId", event.target.value)}
                >
                  {companies.map((company) => (
                    <option key={company.companyId} value={company.companyId}>
                      {company.companyCode}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Employee Code
                <input
                  value={form.employeeCode}
                  onChange={(event) => change("employeeCode", event.target.value)}
                />
              </label>
              <label>
                National ID (13 digits)
                <input
                  inputMode="numeric"
                  maxLength={13}
                  value={form.nationalId}
                  autoComplete="off"
                  onChange={(event) =>
                    change("nationalId", event.target.value.replace(/\D/g, ""))
                  }
                  aria-invalid={
                    Boolean(form.nationalId) &&
                    !isValidThaiNationalId(form.nationalId)
                  }
                />
                <small>
                  Must contain exactly 13 digits.
                </small>
              </label>
              <label>
                Title TH
                <select
                  value={form.titleTh ?? "นาย"}
                  onChange={(event) => change("titleTh", event.target.value)}
                >
                  <option value="นาย">นาย</option>
                  <option value="นาง">นาง</option>
                  <option value="นางสาว">นางสาว</option>
                </select>
              </label>
              <label>
                First Name TH
                <input
                  value={form.firstNameTh}
                  onChange={(event) => change("firstNameTh", event.target.value)}
                />
              </label>
              <label>
                Last Name TH
                <input
                  value={form.lastNameTh}
                  onChange={(event) => change("lastNameTh", event.target.value)}
                />
              </label>
              <label>
                Title EN
                <input
                  value={form.titleEn ?? ""}
                  onChange={(event) => change("titleEn", event.target.value || null)}
                />
              </label>
              <label>
                First Name EN
                <input
                  value={form.firstNameEn ?? ""}
                  onChange={(event) => change("firstNameEn", event.target.value || null)}
                />
              </label>
              <label>
                Last Name EN
                <input
                  value={form.lastNameEn ?? ""}
                  onChange={(event) => change("lastNameEn", event.target.value || null)}
                />
              </label>
              <label>
                Birth Date
                <input
                  type="date"
                  value={form.birthDate ?? ""}
                  onChange={(event) => change("birthDate", event.target.value || null)}
                />
              </label>
              <label>
                Hire Date
                <input
                  type="date"
                  value={form.hireDate ?? ""}
                  onChange={(event) => change("hireDate", event.target.value || null)}
                />
              </label>
              <label>
                Function
                <select
                  value={form.functionId ?? ""}
                  onChange={(event) => change("functionId", event.target.value || null)}
                >
                  <option value="">-</option>
                  {functions.map((item) => (
                    <option key={item.functionId} value={item.functionId}>
                      {item.functionCode} — {item.functionNameEn || item.functionNameTh}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Division
                <select
                  value={form.divisionId ?? ""}
                  onChange={(event) => change("divisionId", event.target.value || null)}
                >
                  <option value="">-</option>
                  {divisions.map((item) => (
                    <option key={item.divisionId} value={item.divisionId}>
                      {item.divisionCode} — {item.divisionNameEn || item.divisionNameTh}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Department
                <select
                  value={form.departmentId ?? ""}
                  onChange={(event) => change("departmentId", event.target.value || null)}
                >
                  <option value="">-</option>
                  {departments.map((item) => (
                    <option key={item.departmentId} value={item.departmentId}>
                      {item.departmentCode} — {item.departmentNameEn || item.departmentNameTh}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <select
                  value={form.sectionId ?? ""}
                  onChange={(event) => change("sectionId", event.target.value || null)}
                >
                  <option value="">-</option>
                  {sections.map((item) => (
                    <option key={item.sectionId} value={item.sectionId}>
                      {item.sectionCode} — {item.sectionNameEn || item.sectionNameTh}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Position
                <select
                  value={form.positionId ?? ""}
                  onChange={(event) => change("positionId", event.target.value || null)}
                >
                  <option value="">-</option>
                  {positions.map((item) => (
                    <option key={item.positionId} value={item.positionId}>
                      {item.positionCode} — {item.positionNameEn || item.positionNameTh}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Level
                <select
                  value={form.levelId ?? ""}
                  onChange={(event) => change("levelId", event.target.value || null)}
                >
                  <option value="">-</option>
                  {levels.map((item) => (
                    <option key={item.levelId} value={item.levelId}>
                      {item.levelKey} — {item.levelNameEn || item.levelNameTh}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.employmentStatus}
                  onChange={(event) =>
                    change(
                      "employmentStatus",
                      event.target.value as EmployeeInput["employmentStatus"],
                    )
                  }
                >
                  <option>ACTIVE</option>
                  <option>INACTIVE</option>
                </select>
              </label>
            </div>
            {error ? <p role="alert">{error}</p> : null}
            <div className={styles.formActions}>
              <button
                className={styles.saveButton}
                type="button"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                disabled={saving}
                onClick={() => setMode(null)}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Scoped Master</span>
              <h3>Employee Records</h3>
            </div>
            <p>{visible.length} records</p>
          </div>
          {visibleCompanyGroups.length > 0 ? (
            <div className={styles.companyDirectory}>
              {visibleCompanyGroups.map((companyGroup) => {
                const isOpen = openCompanies.includes(companyGroup.companyId);
                const totalPages = Math.max(
                  1,
                  Math.ceil(companyGroup.rows.length / EMPLOYEE_PAGE_SIZE),
                );
                const page = Math.min(
                  companyPage[companyGroup.companyId] ?? 1,
                  totalPages,
                );
                const pageRows = companyGroup.rows.slice(
                  (page - 1) * EMPLOYEE_PAGE_SIZE,
                  page * EMPLOYEE_PAGE_SIZE,
                );
                const { start: windowStart, end: windowEnd } = pageWindow(
                  page,
                  totalPages,
                );
                const goToPage = (pageNumber: number) =>
                  setCompanyPage((current) => ({
                    ...current,
                    [companyGroup.companyId]: pageNumber,
                  }));
                return (
                  <section
                    className={`${styles.companyGroup} ${isOpen ? styles.openGroup : ""}`}
                    key={companyGroup.companyId}
                  >
                    <button
                      className={styles.companyHeader}
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleCompany(companyGroup.companyId)}
                    >
                      <span className={styles.chevron} aria-hidden="true" />
                      <span>
                        Company: <strong>{companyGroup.companyCode}</strong>
                      </span>
                      <b>({companyGroup.totalRecords})</b>
                      <small>{companyGroup.rows.length} records in view</small>
                    </button>

                    {isOpen ? (
                      <div className={styles.tableWrap}>
                        <div className={styles.tableScroll}>
                          <table
                            className={styles.employeeTable}
                            style={{ width: tableWidth }}
                          >
                          <colgroup>
                            {EMPLOYEE_COLUMNS.map((column) => (
                              <col
                                key={column.key}
                                style={{
                                  width: columnWidths[column.key] ?? column.defaultWidth,
                                }}
                              />
                            ))}
                          </colgroup>
                          <thead>
                            <tr>
                              {EMPLOYEE_COLUMNS.map((column) => (
                                <th key={column.key}>
                                  {column.label}
                                  <span
                                    className={styles.columnResizeHandle}
                                    onPointerDown={startColumnResize(
                                      column.key,
                                      column.defaultWidth,
                                    )}
                                  />
                                </th>
                              ))}
                            </tr>
                          </thead>  
                          <tbody translate="no">
                            {pageRows.map((employee, index) => (
                              <tr
                                key={employee.employeeId}
                                className={
                                  employee.employeeId === selectedId
                                    ? styles.selectedRow
                                    : undefined
                                }
                                style={{ height: rowHeights[employee.employeeId] }}
                                onClick={() => {
                                  setSelectedId(employee.employeeId);
                                }}
                              >
                                <td>
                                  {(page - 1) * EMPLOYEE_PAGE_SIZE + index + 1}
                                  <span
                                    className={styles.rowResizeHandle}
                                    onPointerDown={startRowResize(employee.employeeId)}
                                  />
                                </td>
                                <td>
                                  <span className={styles.companyPill}>
                                    {employee.companyCode}
                                  </span>
                                </td>
                                <td>{employee.employeeCode}</td>
                                <td>
                                  {revealedNationalIds[employee.employeeId] ??
                                    employee.nationalIdMasked}
                                </td>
                                <td>{display(employee.titleTh)}</td>
                                <td>{employee.firstNameTh}</td>
                                <td>{employee.lastNameTh}</td>
                                <td>{display(employee.titleEn)}</td>
                                <td>{display(employee.firstNameEn)}</td>
                                <td>{display(employee.lastNameEn)}</td>
                                <td>{display(employee.birthDate)}</td>
                                <td>{display(employee.hireDate)}</td>
                                <td>{display(employee.functionCode)}</td>
                                <td>{display(employee.functionName)}</td>
                                <td>{display(employee.divisionName)}</td>
                                <td>{display(employee.departmentName)}</td>
                                <td>{display(employee.sectionName)}</td>
                                <td>{display(employee.positionName)}</td>
                                <td>
                                  <span className={styles.levelPill}>
                                    {display(employee.levelKey)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                        {totalPages > 1 ? (
                          <div className={styles.pagination}>
                            {windowStart > 1 ? (
                              <>
                                <button
                                  type="button"
                                  className={styles.paginationButton}
                                  aria-label="First page"
                                  onClick={() => goToPage(1)}
                                >
                                  «
                                </button>
                                <button
                                  type="button"
                                  className={styles.paginationButton}
                                  aria-label="Previous page"
                                  onClick={() => goToPage(page - 1)}
                                >
                                  ‹
                                </button>
                              </>
                            ) : null}
                            {Array.from(
                              { length: windowEnd - windowStart + 1 },
                              (_, i) => windowStart + i,
                            ).map((pageNumber) => (
                              <button
                                key={pageNumber}
                                type="button"
                                className={
                                  pageNumber === page
                                    ? styles.paginationButtonActive
                                    : styles.paginationButton
                                }
                                onClick={() => goToPage(pageNumber)}
                              >
                                {pageNumber}
                              </button>
                            ))}
                            {windowEnd < totalPages ? (
                              <>
                                <button
                                  type="button"
                                  className={styles.paginationButton}
                                  aria-label="Next page"
                                  onClick={() => goToPage(page + 1)}
                                >
                                  ›
                                </button>
                                <button
                                  type="button"
                                  className={styles.paginationButton}
                                  aria-label="Last page"
                                  onClick={() => goToPage(totalPages)}
                                >
                                  »
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : (
            <p>No employee data found.</p>
          )}
        </section>
      </section>
    </section>
  );
}
