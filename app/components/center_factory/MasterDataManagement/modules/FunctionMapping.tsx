"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { listCompanies } from "../../../../lib/companies/client";
import type { CompanyRecord } from "../../../../lib/companies/types";
import {
  createFunctionMapping,
  deleteFunctionMapping,
  listFunctionMappings,
  listFunctions,
  updateFunctionMapping,
} from "../../../../lib/functions/client";
import type {
  FunctionMappingRecord,
  MasterStatus,
  OrganizationFunctionRecord,
} from "../../../../lib/functions/types";
import { MASTER_STATUSES } from "../../../../lib/functions/types";
import {
  createDivisionMapping,
  deleteDivisionMapping,
  listDivisionMappings,
  listDivisions,
  updateDivisionMapping,
} from "../../../../lib/divisions/client";
import type {
  DivisionMappingRecord,
  DivisionRecord,
} from "../../../../lib/divisions/types";
import {
  createDepartmentMapping,
  deleteDepartmentMapping,
  listDepartmentMappings,
  listDepartments,
  updateDepartmentMapping,
} from "../../../../lib/departments/client";
import type {
  DepartmentMappingRecord,
  DepartmentRecord,
} from "../../../../lib/departments/types";
import {
  createSectionMapping,
  deleteSectionMapping,
  listSectionMappings,
  listSections,
  updateSectionMapping,
} from "../../../../lib/sections/client";
import type {
  SectionMappingRecord,
  SectionRecord,
} from "../../../../lib/sections/types";
import styles from "./FunctionMapping.module.css";

export const functionMappingModule = {
  title: "Function Mapping",
  subtitle: "Company org-unit mapping",
  description:
    "Map each company's own Function, Division, Department, and Section naming to the shared master catalog.",
} as const;

type Level = "function" | "division" | "department" | "section";

const LEVELS: Level[] = ["function", "division", "department", "section"];

const levelLabel: Record<Level, string> = {
  function: "Function",
  division: "Division",
  department: "Department",
  section: "Section",
};

type MappingRow = {
  key: string;
  level: Level;
  mappingId: string;
  companyId: string;
  companyCode: string;
  plantCode: string;
  plantName: string;
  canonicalId: string;
  canonicalCode: string;
  canonicalName: string;
  status: MasterStatus;
};

type FormState = {
  level: Level;
  companyId: string;
  plantCode: string;
  plantName: string;
  canonicalId: string;
  status: MasterStatus;
};

const blankForm = (level: Level, companyId: string): FormState => ({
  level,
  companyId,
  plantCode: "",
  plantName: "",
  canonicalId: "",
  status: "ACTIVE",
});

const display = (value: string | null) => value || "-";

export default function FunctionMapping() {
  const user = useAuthenticatedUser();
  const isCenter = user?.roleCode === "HRD_CENTER";

  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [functions, setFunctions] = useState<OrganizationFunctionRecord[]>([]);
  const [divisions, setDivisions] = useState<DivisionRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [functionMappings, setFunctionMappings] = useState<FunctionMappingRecord[]>([]);
  const [divisionMappings, setDivisionMappings] = useState<DivisionMappingRecord[]>([]);
  const [departmentMappings, setDepartmentMappings] = useState<DepartmentMappingRecord[]>([]);
  const [sectionMappings, setSectionMappings] = useState<SectionMappingRecord[]>([]);

  const [openCompanies, setOpenCompanies] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"new" | "edit" | null>(null);
  const [editingRow, setEditingRow] = useState<MappingRow | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    blankForm("function", user?.companyId ?? ""),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        companyResult,
        functionResult,
        divisionResult,
        departmentResult,
        sectionResult,
        functionMappingResult,
        divisionMappingResult,
        departmentMappingResult,
        sectionMappingResult,
      ] = await Promise.all([
        listCompanies(),
        listFunctions(),
        listDivisions(),
        listDepartments(),
        listSections(),
        listFunctionMappings(),
        listDivisionMappings(),
        listDepartmentMappings(),
        listSectionMappings(),
      ]);
      setCompanies(companyResult.items);
      setFunctions(functionResult.items);
      setDivisions(divisionResult.items);
      setDepartments(departmentResult.items);
      setSections(sectionResult.items);
      setFunctionMappings(functionMappingResult.items);
      setDivisionMappings(divisionMappingResult.items);
      setDepartmentMappings(departmentMappingResult.items);
      setSectionMappings(sectionMappingResult.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load Function Mapping data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: MappingRow[] = useMemo(
    () => [
      ...functionMappings.map((mapping): MappingRow => ({
        key: `function:${mapping.functionMappingId}`,
        level: "function",
        mappingId: mapping.functionMappingId,
        companyId: mapping.companyId,
        companyCode: mapping.companyCode,
        plantCode: mapping.plantFunctionCode,
        plantName: mapping.plantFunctionName,
        canonicalId: mapping.functionId,
        canonicalCode: mapping.functionCode,
        canonicalName: mapping.functionNameTh,
        status: mapping.status,
      })),
      ...divisionMappings.map((mapping): MappingRow => ({
        key: `division:${mapping.divisionMappingId}`,
        level: "division",
        mappingId: mapping.divisionMappingId,
        companyId: mapping.companyId,
        companyCode: mapping.companyCode,
        plantCode: mapping.plantDivisionCode,
        plantName: mapping.plantDivisionName,
        canonicalId: mapping.divisionId,
        canonicalCode: mapping.divisionCode,
        canonicalName: mapping.divisionNameTh,
        status: mapping.status,
      })),
      ...departmentMappings.map((mapping): MappingRow => ({
        key: `department:${mapping.departmentMappingId}`,
        level: "department",
        mappingId: mapping.departmentMappingId,
        companyId: mapping.companyId,
        companyCode: mapping.companyCode,
        plantCode: mapping.plantDepartmentCode,
        plantName: mapping.plantDepartmentName,
        canonicalId: mapping.departmentId,
        canonicalCode: mapping.departmentCode,
        canonicalName: mapping.departmentNameTh,
        status: mapping.status,
      })),
      ...sectionMappings.map((mapping): MappingRow => ({
        key: `section:${mapping.sectionMappingId}`,
        level: "section",
        mappingId: mapping.sectionMappingId,
        companyId: mapping.companyId,
        companyCode: mapping.companyCode,
        plantCode: mapping.plantSectionCode,
        plantName: mapping.plantSectionName,
        canonicalId: mapping.sectionId,
        canonicalCode: mapping.sectionCode,
        canonicalName: mapping.sectionNameTh,
        status: mapping.status,
      })),
    ],
    [functionMappings, divisionMappings, departmentMappings, sectionMappings],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.companyCode,
        levelLabel[row.level],
        row.plantCode,
        row.plantName,
        row.canonicalCode,
        row.canonicalName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  const visibleCompanyGroups = useMemo(() => {
    const companyOrder = new Map(
      companies.map((company, index) => [company.companyId, index]),
    );
    const grouped = new Map<
      string,
      { companyId: string; companyCode: string; rows: MappingRow[] }
    >();
    for (const row of visible) {
      const group = grouped.get(row.companyId);
      if (group) group.rows.push(row);
      else grouped.set(row.companyId, { companyId: row.companyId, companyCode: row.companyCode, rows: [row] });
    }
    return [...grouped.values()]
      .map((group) => ({
        ...group,
        totalRecords: rows.filter((row) => row.companyId === group.companyId).length,
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
        ? current.filter((id) => id !== companyId)
        : [...current, companyId],
    );
  };

  const canonicalOptions = useMemo(() => {
    switch (form.level) {
      case "function":
        return functions.map((row) => ({
          id: row.functionId,
          code: row.functionCode,
          name: row.functionNameEn || row.functionNameTh,
        }));
      case "division":
        return divisions.map((row) => ({
          id: row.divisionId,
          code: row.divisionCode,
          name: row.divisionNameEn || row.divisionNameTh,
        }));
      case "department":
        return departments.map((row) => ({
          id: row.departmentId,
          code: row.departmentCode,
          name: row.departmentNameEn || row.departmentNameTh,
        }));
      case "section":
        return sections.map((row) => ({
          id: row.sectionId,
          code: row.sectionCode,
          name: row.sectionNameEn || row.sectionNameTh,
        }));
    }
  }, [form.level, functions, divisions, departments, sections]);

  const startNew = (level: Level) => {
    setForm(blankForm(level, isCenter ? "" : user?.companyId ?? ""));
    setEditingRow(null);
    setMode("new");
    setError(null);
    setMessage(null);
  };

  const startEdit = (row: MappingRow) => {
    setForm({
      level: row.level,
      companyId: row.companyId,
      plantCode: row.plantCode,
      plantName: row.plantName,
      canonicalId: row.canonicalId,
      status: row.status,
    });
    setEditingRow(row);
    setMode("edit");
    setError(null);
    setMessage(null);
  };

  const change = <Key extends keyof FormState>(key: Key, value: FormState[Key]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (isSaving || !mode) return;
    if (isCenter && !form.companyId) {
      setError("Select a Company.");
      return;
    }
    if (!form.canonicalId) {
      setError(`Select the ${levelLabel[form.level]} this maps to.`);
      return;
    }
    if (!form.plantCode.trim() || !form.plantName.trim()) {
      setError("Plant code and plant name are required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const companyId = isCenter ? form.companyId : null;
      if (form.level === "function") {
        const input = {
          plantFunctionCode: form.plantCode.trim().toUpperCase(),
          plantFunctionName: form.plantName.trim(),
          functionId: form.canonicalId,
          status: form.status,
        };
        if (mode === "new") {
          await createFunctionMapping({ ...input, companyId });
        } else if (editingRow) {
          await updateFunctionMapping(editingRow.mappingId, input);
        }
      } else if (form.level === "division") {
        const input = {
          plantDivisionCode: form.plantCode.trim().toUpperCase(),
          plantDivisionName: form.plantName.trim(),
          divisionId: form.canonicalId,
          status: form.status,
        };
        if (mode === "new") {
          await createDivisionMapping({ ...input, companyId });
        } else if (editingRow) {
          await updateDivisionMapping(editingRow.mappingId, input);
        }
      } else if (form.level === "department") {
        const input = {
          plantDepartmentCode: form.plantCode.trim().toUpperCase(),
          plantDepartmentName: form.plantName.trim(),
          departmentId: form.canonicalId,
          status: form.status,
        };
        if (mode === "new") {
          await createDepartmentMapping({ ...input, companyId });
        } else if (editingRow) {
          await updateDepartmentMapping(editingRow.mappingId, input);
        }
      } else {
        const input = {
          plantSectionCode: form.plantCode.trim().toUpperCase(),
          plantSectionName: form.plantName.trim(),
          sectionId: form.canonicalId,
          status: form.status,
        };
        if (mode === "new") {
          await createSectionMapping({ ...input, companyId });
        } else if (editingRow) {
          await updateSectionMapping(editingRow.mappingId, input);
        }
      }
      setMode(null);
      setEditingRow(null);
      setMessage("Mapping saved.");
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save mapping",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (row: MappingRow) => {
    if (isSaving || !window.confirm(`Delete mapping ${row.plantCode}?`)) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (row.level === "function") await deleteFunctionMapping(row.mappingId);
      else if (row.level === "division") await deleteDivisionMapping(row.mappingId);
      else if (row.level === "department") await deleteDepartmentMapping(row.mappingId);
      else await deleteSectionMapping(row.mappingId);
      if (editingRow?.key === row.key) {
        setMode(null);
        setEditingRow(null);
      }
      setMessage("Mapping deleted.");
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete mapping",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={styles.moduleWorkspace} aria-label="Function Mapping module">
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{functionMappingModule.subtitle}</p>
          <h2>{functionMappingModule.title}</h2>
          <p>{functionMappingModule.description}</p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search mappings"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search company, level, plant code, or master name"
          />
          <div className={styles.newGroup}>
            {LEVELS.map((level) => (
              <button
                key={level}
                className={styles.secondaryButton}
                type="button"
                onClick={() => startNew(level)}
                disabled={isSaving}
              >
                + {levelLabel[level]}
              </button>
            ))}
          </div>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void load()}
            disabled={isLoading || isSaving}
          >
            Refresh
          </button>
        </div>
      </section>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      {mode ? (
        <section className={styles.formPanel}>
          <h3>
            {mode === "new" ? "Create" : "Edit"} {levelLabel[form.level]} Mapping
          </h3>
          <div className={styles.formGrid}>
            <label>
              Level
              <select
                value={form.level}
                disabled={mode === "edit"}
                onChange={(event) =>
                  setForm(blankForm(event.target.value as Level, form.companyId))
                }
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {levelLabel[level]}
                  </option>
                ))}
              </select>
            </label>
            {isCenter ? (
              <label>
                Company
                <select
                  value={form.companyId}
                  onChange={(event) => change("companyId", event.target.value)}
                >
                  <option value="">Select a company</option>
                  {companies.map((company) => (
                    <option key={company.companyId} value={company.companyId}>
                      {company.companyCode}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Plant {levelLabel[form.level]} Code
              <input
                value={form.plantCode}
                maxLength={50}
                onChange={(event) => change("plantCode", event.target.value)}
              />
            </label>
            <label>
              Plant {levelLabel[form.level]} Name
              <input
                value={form.plantName}
                maxLength={255}
                onChange={(event) => change("plantName", event.target.value)}
              />
            </label>
            <label>
              Maps to {levelLabel[form.level]}
              <select
                value={form.canonicalId}
                onChange={(event) => change("canonicalId", event.target.value)}
              >
                <option value="">Select {levelLabel[form.level]}</option>
                {canonicalOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code} — {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  change("status", event.target.value as MasterStatus)
                }
              >
                {MASTER_STATUSES.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <button
                className={styles.actionButton}
                type="button"
                onClick={() => void save()}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => {
                  setMode(null);
                  setEditingRow(null);
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
          <div>
            <span>Scoped Master</span>
            <h3>Mapping Records</h3>
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
                      <table className={styles.mappingTable}>
                        <thead>
                          <tr>
                            <th>No.</th>
                            <th>Level</th>
                            <th>Plant Code</th>
                            <th>Plant Name</th>
                            <th>Maps to</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {companyGroup.rows.map((row, index) => (
                            <tr key={row.key}>
                              <td>{index + 1}</td>
                              <td>
                                <span className={styles.statusPill}>
                                  {levelLabel[row.level]}
                                </span>
                              </td>
                              <td translate="no">{row.plantCode}</td>
                              <td>{display(row.plantName)}</td>
                              <td translate="no">
                                {row.canonicalCode} — {row.canonicalName}
                              </td>
                              <td>{row.status}</td>
                              <td>
                                <div className={styles.rowActions}>
                                  <button
                                    className={styles.secondaryButton}
                                    type="button"
                                    onClick={() => startEdit(row)}
                                    disabled={isSaving}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className={styles.secondaryButton}
                                    type="button"
                                    onClick={() => void remove(row)}
                                    disabled={isSaving}
                                  >
                                    Delete
                                  </button>
                                </div>
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
          <p>{isLoading ? "Loading..." : "No mapping data found."}</p>
        )}
      </section>
    </section>
  );
}
