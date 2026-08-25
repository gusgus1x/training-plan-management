"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
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
import { listOrgHierarchyUsage } from "../../../../lib/orgHierarchy/client";
import type { OrgHierarchyUsageRow } from "../../../../lib/orgHierarchy/types";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./FunctionMapping.module.css";

export const functionMappingModule = {
  title: "Function & Organization Mapping",
  subtitle: "Company Org-Unit Mapping Matrix",
  description:
    "View and manage complete organizational mapping linking Company, Function, Division, Department, and Section master data.",
} as const;

type Level = "function" | "division" | "department" | "section";

const LEVELS: Level[] = ["function", "division", "department", "section"];

const levelLabel: Record<Level, string> = {
  function: "Function",
  division: "Division",
  department: "Department",
  section: "Section",
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

const display = (value: string | null | undefined) => value || "-";

type HierarchyRow = {
  key: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  
  functionId: string | null;
  functionCode: string;
  functionName: string;
  plantFunctionCode?: string;

  divisionId: string | null;
  divisionCode: string;
  divisionName: string;
  plantDivisionCode?: string;

  departmentId: string | null;
  departmentCode: string;
  departmentName: string;
  plantDepartmentCode?: string;

  sectionId: string | null;
  sectionCode: string;
  sectionName: string;
  plantSectionCode?: string;

  status: MasterStatus;
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

export default function FunctionMapping() {
  const user = useAuthenticatedUser();
  const confirm = useConfirm();
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
  const [orgUsage, setOrgUsage] = useState<OrgHierarchyUsageRow[]>([]);

  const [search, setSearch] = useState("");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("ALL");
  const [viewTab, setViewTab] = useState<"hierarchy" | "mappings">("hierarchy");
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
        orgUsageResult,
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
        listOrgHierarchyUsage(),
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
      setOrgUsage(orgUsageResult.items);
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
  }, []);

  // Compute unified hierarchy rows linking Company -> Function -> Division -> Department -> Section
  const hierarchyRows: HierarchyRow[] = useMemo(() => {
    const companyMap = new Map(companies.map((c) => [c.companyId, c]));
    const functionMap = new Map(functions.map((f) => [f.functionId, f]));
    const divisionMap = new Map(divisions.map((d) => [d.divisionId, d]));
    const departmentMap = new Map(departments.map((d) => [d.departmentId, d]));
    const sectionMap = new Map(sections.map((s) => [s.sectionId, s]));

    // Maps (companyId + canonicalId) -> plantCode
    const fnMapByComp = new Map(functionMappings.map((m) => [`${m.companyId}:${m.functionId}`, m.plantFunctionCode]));
    const divMapByComp = new Map(divisionMappings.map((m) => [`${m.companyId}:${m.divisionId}`, m.plantDivisionCode]));
    const depMapByComp = new Map(departmentMappings.map((m) => [`${m.companyId}:${m.departmentId}`, m.plantDepartmentCode]));
    const secMapByComp = new Map(sectionMappings.map((m) => [`${m.companyId}:${m.sectionId}`, m.plantSectionCode]));

    return orgUsage.map((usage, idx): HierarchyRow => {
      const comp = usage.companyId ? companyMap.get(usage.companyId) : undefined;
      const fn = usage.functionId ? functionMap.get(usage.functionId) : undefined;
      const div = usage.divisionId ? divisionMap.get(usage.divisionId) : undefined;
      const dep = usage.departmentId ? departmentMap.get(usage.departmentId) : undefined;
      const sec = usage.sectionId ? sectionMap.get(usage.sectionId) : undefined;

      const compId = usage.companyId || "";
      const plantFn = usage.functionId ? fnMapByComp.get(`${compId}:${usage.functionId}`) : undefined;
      const plantDiv = usage.divisionId ? divMapByComp.get(`${compId}:${usage.divisionId}`) : undefined;
      const plantDep = usage.departmentId ? depMapByComp.get(`${compId}:${usage.departmentId}`) : undefined;
      const plantSec = usage.sectionId ? secMapByComp.get(`${compId}:${usage.sectionId}`) : undefined;

      return {
        key: `h-${idx}-${compId}-${usage.functionId}-${usage.divisionId}-${usage.departmentId}-${usage.sectionId}`,
        companyId: compId,
        companyCode: comp?.companyCode || "GENERAL",
        companyName: comp?.companyNameTh || comp?.companyNameEn || "General / Central",

        functionId: usage.functionId,
        functionCode: fn?.functionCode || "",
        functionName: fn?.functionNameTh || fn?.functionNameEn || "",
        plantFunctionCode: plantFn,

        divisionId: usage.divisionId,
        divisionCode: div?.divisionCode || "",
        divisionName: div?.divisionNameTh || div?.divisionNameEn || "",
        plantDivisionCode: plantDiv,

        departmentId: usage.departmentId,
        departmentCode: dep?.departmentCode || "",
        departmentName: dep?.departmentNameTh || dep?.departmentNameEn || "",
        plantDepartmentCode: plantDep,

        sectionId: usage.sectionId,
        sectionCode: sec?.sectionCode || "",
        sectionName: sec?.sectionNameTh || sec?.sectionNameEn || "",
        plantSectionCode: plantSec,

        status: "ACTIVE",
      };
    });
  }, [companies, functions, divisions, departments, sections, functionMappings, divisionMappings, departmentMappings, sectionMappings, orgUsage]);

  const filteredHierarchyRows = useMemo(() => {
    let rows = hierarchyRows;
    if (selectedCompanyFilter !== "ALL") {
      rows = rows.filter((r) => r.companyCode === selectedCompanyFilter || r.companyId === selectedCompanyFilter);
    }
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) =>
      [
        r.companyCode,
        r.companyName,
        r.functionCode,
        r.functionName,
        r.plantFunctionCode,
        r.divisionCode,
        r.divisionName,
        r.plantDivisionCode,
        r.departmentCode,
        r.departmentName,
        r.plantDepartmentCode,
        r.sectionCode,
        r.sectionName,
        r.plantSectionCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [hierarchyRows, selectedCompanyFilter, search]);

  const hierarchyCompanyGroups = useMemo(() => {
    const companyOrder = new Map(
      companies.map((company, index) => [company.companyId, index]),
    );
    const grouped = new Map<
      string,
      { companyId: string; companyCode: string; companyName: string; rows: HierarchyRow[] }
    >();

    for (const row of filteredHierarchyRows) {
      const compKey = row.companyId || row.companyCode;
      const group = grouped.get(compKey);
      if (group) {
        group.rows.push(row);
      } else {
        grouped.set(compKey, {
          companyId: row.companyId,
          companyCode: row.companyCode,
          companyName: row.companyName,
          rows: [row],
        });
      }
    }

    return [...grouped.values()].sort(
      (left, right) =>
        (companyOrder.get(left.companyId) ?? Number.MAX_SAFE_INTEGER) -
          (companyOrder.get(right.companyId) ?? Number.MAX_SAFE_INTEGER) ||
        left.companyCode.localeCompare(right.companyCode),
    );
  }, [companies, filteredHierarchyRows]);

  const plantMappingRows: MappingRow[] = useMemo(
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

  const filteredPlantMappingRows = useMemo(() => {
    let rows = plantMappingRows;
    if (selectedCompanyFilter !== "ALL") {
      rows = rows.filter((r) => r.companyCode === selectedCompanyFilter || r.companyId === selectedCompanyFilter);
    }
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
  }, [plantMappingRows, selectedCompanyFilter, search]);

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
      setMessage("Mapping saved successfully.");
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
    if (isSaving) return;
    if (!(await confirm({ message: `Delete mapping ${row.plantCode}?`, confirmLabel: "Delete", danger: true }))) return;
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

  if (isLoading) {
    return (
      <section className={styles.moduleWorkspace} aria-label="Function Mapping module">
        <section className={styles.moduleHero}>
          <div>
            <p className={styles.panelKicker}>{functionMappingModule.subtitle}</p>
            <h2>{functionMappingModule.title}</h2>
            <p>{functionMappingModule.description}</p>
          </div>
        </section>
        <TypewriterLoader label="กำลังโหลดข้อมูลการเชื่อมโยงโครงสร้างองค์กร..." />
      </section>
    );
  }

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
            placeholder="Search Company, Function, Division, Department, Section..."
          />
          <select
            value={selectedCompanyFilter}
            onChange={(e) => setSelectedCompanyFilter(e.target.value)}
            aria-label="Filter by Company"
          >
            <option value="ALL">🏢 All Companies</option>
            {companies.map((c) => (
              <option key={c.companyId} value={c.companyCode}>
                {c.companyCode} — {c.companyNameTh || c.companyNameEn}
              </option>
            ))}
          </select>
          <div className={styles.viewToggleGroup}>
            <button
              type="button"
              className={viewTab === "hierarchy" ? styles.primaryButton : styles.secondaryButton}
              onClick={() => setViewTab("hierarchy")}
            >
              📊 Hierarchy Mapping Matrix
            </button>
            <button
              type="button"
              className={viewTab === "mappings" ? styles.primaryButton : styles.secondaryButton}
              onClick={() => setViewTab("mappings")}
            >
              ⚙️ Plant Code Mappings ({plantMappingRows.length})
            </button>
          </div>
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

      {error ? <p role="alert" style={{ color: "#d71920", fontWeight: 700 }}>{error}</p> : null}
      {message ? <p role="status" style={{ color: "#10b981", fontWeight: 700 }}>{message}</p> : null}

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

      {viewTab === "hierarchy" ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Company Organization Matrix</span>
              <h3>Function & Organization Mapping View</h3>
            </div>
            <p>{filteredHierarchyRows.length} mapped combinations in {hierarchyCompanyGroups.length} companies</p>
          </div>
          {hierarchyCompanyGroups.length > 0 ? (
            <div className={styles.companyDirectory}>
              {hierarchyCompanyGroups.map((companyGroup) => (
                <section
                  className={styles.companyGroup}
                  key={companyGroup.companyCode}
                  style={{ marginBottom: "16px" }}
                >
                  <div className={styles.companyHeader} style={{ cursor: "default", gridTemplateColumns: "1fr auto" }}>
                    <span>
                      🏢 Company: <strong style={{ fontSize: "1rem" }}>{companyGroup.companyCode}</strong> — {companyGroup.companyName}
                    </span>
                    <b>({companyGroup.rows.length} records)</b>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.mappingTable}>
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Function</th>
                          <th>Division</th>
                          <th>Department</th>
                          <th>Section</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companyGroup.rows.map((row, idx) => (
                          <tr key={row.key}>
                            <td>{idx + 1}</td>
                            <td translate="no">
                              {row.functionCode ? (
                                <>
                                  <div><strong>{row.functionCode}</strong> — {row.functionName}</div>
                                  {row.plantFunctionCode ? (
                                    <small style={{ color: "#10b981", fontWeight: 700 }}>Plant Code: {row.plantFunctionCode}</small>
                                  ) : null}
                                </>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>-</span>
                              )}
                            </td>
                            <td translate="no">
                              {row.divisionCode ? (
                                <>
                                  <div><strong>{row.divisionCode}</strong> — {row.divisionName}</div>
                                  {row.plantDivisionCode ? (
                                    <small style={{ color: "#10b981", fontWeight: 700 }}>Plant Code: {row.plantDivisionCode}</small>
                                  ) : null}
                                </>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>-</span>
                              )}
                            </td>
                            <td translate="no">
                              {row.departmentCode ? (
                                <>
                                  <div><strong>{row.departmentCode}</strong> — {row.departmentName}</div>
                                  {row.plantDepartmentCode ? (
                                    <small style={{ color: "#10b981", fontWeight: 700 }}>Plant Code: {row.plantDepartmentCode}</small>
                                  ) : null}
                                </>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>-</span>
                              )}
                            </td>
                            <td translate="no">
                              {row.sectionCode ? (
                                <>
                                  <div><strong>{row.sectionCode}</strong> — {row.sectionName}</div>
                                  {row.plantSectionCode ? (
                                    <small style={{ color: "#10b981", fontWeight: 700 }}>Plant Code: {row.plantSectionCode}</small>
                                  ) : null}
                                </>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>-</span>
                              )}
                            </td>
                            <td>
                              <span className={styles.statusPill}>{row.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p style={{ padding: "20px", color: "#64748b", textAlign: "center" }}>
              {isLoading ? "Loading mapping matrix..." : "No mapped organization data found matching your filter."}
            </p>
          )}
        </section>
      ) : (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Scoped Master</span>
              <h3>Plant Code Mapping Records</h3>
            </div>
            <p>{filteredPlantMappingRows.length} records</p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.mappingTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Company</th>
                  <th>Level</th>
                  <th>Plant Code</th>
                  <th>Plant Name</th>
                  <th>Maps to Master</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlantMappingRows.length > 0 ? (
                  filteredPlantMappingRows.map((row, index) => (
                    <tr key={row.key}>
                      <td>{index + 1}</td>
                      <td translate="no"><strong>{row.companyCode}</strong></td>
                      <td>
                        <span className={styles.statusPill}>
                          {levelLabel[row.level]}
                        </span>
                      </td>
                      <td translate="no">{row.plantCode}</td>
                      <td translate="no">{display(row.plantName)}</td>
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                      {isLoading ? "Loading mapping data..." : "No plant code mapping data found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
