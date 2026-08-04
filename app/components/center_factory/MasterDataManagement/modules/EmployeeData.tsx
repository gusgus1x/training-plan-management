"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
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
import { listLevels } from "../../../../lib/levels/client";
import type { LevelRecord } from "../../../../lib/levels/types";
import { listPositions } from "../../../../lib/positions/client";
import type { PositionRecord } from "../../../../lib/positions/types";
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

export default function EmployeeData() {
  const user = useAuthenticatedUser();
  const center = user?.roleCode === "HRD_CENTER";
  const [rows, setRows] = useState<EmployeeRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [functions, setFunctions] = useState<FunctionRecord[]>([]);
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [levels, setLevels] = useState<LevelRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openCompanies, setOpenCompanies] = useState<string[]>([]);
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
  const selected =
    rows.find((employee) => employee.employeeId === selectedId) ?? null;

  const load = async () => {
    setError(null);
    setRevealedNationalIds({});
    try {
      const [employeeResult, companyResult, functionResult, positionResult, levelResult] =
        await Promise.all([
          listEmployees(),
          listCompanies(),
          listFunctions(),
          listPositions(),
          listLevels(),
        ]);
      setRows(employeeResult.items);
      setCompanies(companyResult.items);
      setFunctions(functionResult.items);
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
      setMessage(`${result.employee.employeeCode} saved`);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save Employee",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving || !selected || !confirm(`Delete ${selected.employeeCode}?`))
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
                        <table className={styles.employeeTable}>
                          <thead>
                            <tr>
                              <th>No.</th>
                              <th>Company</th>
                              <th>Emp Code</th>
                              <th>ID Card</th>
                              <th>Title(TH)</th>
                              <th>Name(TH)</th>
                              <th>Surname(TH)</th>
                              <th>Title(EN)</th>
                              <th>Name(EN)</th>
                              <th>Surname(EN)</th>
                              <th>Birthday</th>
                              <th>Workday</th>
                              <th>Function Code</th>
                              <th>Function Name</th>
                              <th>Position Name</th>
                              <th>Level Key</th>
                            </tr>
                          </thead>
                          <tbody>
                            {companyGroup.rows.map((employee, index) => (
                              <tr
                                key={employee.employeeId}
                                className={
                                  employee.employeeId === selectedId
                                    ? styles.selectedRow
                                    : undefined
                                }
                                onClick={() => {
                                  setSelectedId(employee.employeeId);
                                }}
                              >
                                <td>{index + 1}</td>
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
