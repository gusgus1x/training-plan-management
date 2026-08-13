"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import {
  TRAINING_MASTER_EVENT,
  TRAINING_MASTER_KEYS,
  readMasterCollection,
  writeMasterCollection,
} from "../../../../lib/trainingWorkflow";
import { defaultCompanyRows, type CompanyCode, type CompanyRecord } from "./CompanyData";
import { defaultFunctionRows } from "./defaultFunctionRows.data";
import styles from "./FunctionData.module.css";

export type FunctionRecord = {
  id: string;
  functionCode: string;
  compCode: string;
  compId: string;
  compNameTh: string;
  functionNameTh: string;
  functionNameEn: string;
  sectionTh: string;
  sectionEn: string;
  departmentTh: string;
  departmentEn: string;
  divisionTh: string;
  divisionEn: string;
};

export { defaultFunctionRows };

type FormMode = "new" | "edit" | null;

export const functionDataModule = {
  title: "Function Data",
  subtitle: "Organizational master",
  description: "Maintain Function, Section (แผนก), Department (ส่วน), and Division (ฝ่าย) structures linked across companies.",
} as const;

const emptyRecord = (comp?: CompanyRecord): FunctionRecord => ({
  id: `func-${Date.now()}`,
  functionCode: "",
  compCode: comp?.compCode ?? "ATA",
  compId: comp?.compId ?? "1290",
  compNameTh: comp?.compNameTh ?? "บริษัท ไอชิน ทากาโอกะ เอเชีย จำกัด",
  functionNameTh: "",
  functionNameEn: "",
  sectionTh: "",
  sectionEn: "",
  departmentTh: "",
  departmentEn: "",
  divisionTh: "",
  divisionEn: "",
});

export default function FunctionData() {
  const user = useAuthenticatedUser();
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const factoryCompanyCode = user?.companyCode as CompanyCode | undefined;

  const [companyRows, setCompanyRows] = useState<CompanyRecord[]>(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.companies, defaultCompanyRows),
  );

  const [rows, setRows] = useState<FunctionRecord[]>(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.functions, defaultFunctionRows),
  );

  const [selectedCompany, setSelectedCompany] = useState<string>(
    isFactoryUser && factoryCompanyCode ? factoryCompanyCode : "all",
  );
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [formValues, setFormValues] = useState<FunctionRecord>(() => {
    const defaultComp = companyRows.find((c) => c.compCode === (factoryCompanyCode ?? "ATA")) ?? companyRows[0];
    return emptyRecord(defaultComp);
  });

  useEffect(() => {
    const handleMasterChange = () => {
      setCompanyRows(readMasterCollection(TRAINING_MASTER_KEYS.companies, defaultCompanyRows));
      setRows(readMasterCollection(TRAINING_MASTER_KEYS.functions, defaultFunctionRows));
    };

    window.addEventListener(TRAINING_MASTER_EVENT, handleMasterChange);
    return () => window.removeEventListener(TRAINING_MASTER_EVENT, handleMasterChange);
  }, []);

  const saveRows = (nextRows: FunctionRecord[]) => {
    setRows(nextRows);
    writeMasterCollection(TRAINING_MASTER_KEYS.functions, nextRows);
  };

  const selectedRecord = rows.find((row) => row.id === selectedId) ?? null;

  // Available options based on selected filters
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (selectedCompany === "all" || r.compCode === selectedCompany) {
        const val = r.sectionTh || r.sectionEn;
        if (val) set.add(val);
      }
    });
    return Array.from(set).sort();
  }, [rows, selectedCompany]);

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const matchComp = selectedCompany === "all" || r.compCode === selectedCompany;
      const matchSec = selectedSection === "all" || r.sectionTh === selectedSection || r.sectionEn === selectedSection;
      if (matchComp && matchSec) {
        const val = r.departmentTh || r.departmentEn;
        if (val) set.add(val);
      }
    });
    return Array.from(set).sort();
  }, [rows, selectedCompany, selectedSection]);

  const availableDivisions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const matchComp = selectedCompany === "all" || r.compCode === selectedCompany;
      const matchSec = selectedSection === "all" || r.sectionTh === selectedSection || r.sectionEn === selectedSection;
      const matchDept = selectedDepartment === "all" || r.departmentTh === selectedDepartment || r.departmentEn === selectedDepartment;
      if (matchComp && matchSec && matchDept) {
        const val = r.divisionTh || r.divisionEn;
        if (val) set.add(val);
      }
    });
    return Array.from(set).sort();
  }, [rows, selectedCompany, selectedSection, selectedDepartment]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      const matchFactory = !isFactoryUser || row.compCode === factoryCompanyCode;
      const matchCompany = selectedCompany === "all" || row.compCode === selectedCompany;
      const matchSection =
        selectedSection === "all" ||
        row.sectionTh === selectedSection ||
        row.sectionEn === selectedSection;
      const matchDepartment =
        selectedDepartment === "all" ||
        row.departmentTh === selectedDepartment ||
        row.departmentEn === selectedDepartment;
      const matchDivision =
        selectedDivision === "all" ||
        row.divisionTh === selectedDivision ||
        row.divisionEn === selectedDivision;

      if (!matchFactory || !matchCompany || !matchSection || !matchDepartment || !matchDivision) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        row.functionCode,
        row.compCode,
        row.compNameTh,
        row.functionNameTh,
        row.functionNameEn,
        row.sectionTh,
        row.sectionEn,
        row.departmentTh,
        row.departmentEn,
        row.divisionTh,
        row.divisionEn,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    // Reorder data: company -> function -> section (แผนก) -> department (ส่วน) -> division (ฝ่าย)
    return filtered.sort((a, b) => {
      const compA = a.compCode || "";
      const compB = b.compCode || "";
      if (compA !== compB) return compA.localeCompare(compB, "th");

      const funcA = a.functionNameTh || a.functionNameEn || "";
      const funcB = b.functionNameTh || b.functionNameEn || "";
      if (funcA !== funcB) return funcA.localeCompare(funcB, "th");

      const secA = a.sectionTh || a.sectionEn || "";
      const secB = b.sectionTh || b.sectionEn || "";
      if (secA !== secB) return secA.localeCompare(secB, "th");

      const deptA = a.departmentTh || a.departmentEn || "";
      const deptB = b.departmentTh || b.departmentEn || "";
      if (deptA !== deptB) return deptA.localeCompare(deptB, "th");

      const divA = a.divisionTh || a.divisionEn || "";
      const divB = b.divisionTh || b.divisionEn || "";
      return divA.localeCompare(divB, "th");
    });
  }, [
    rows,
    search,
    selectedCompany,
    selectedSection,
    selectedDepartment,
    selectedDivision,
    isFactoryUser,
    factoryCompanyCode,
  ]);

  const stats = useMemo(() => {
    const scopedRows = rows.filter((r) => !isFactoryUser || r.compCode === factoryCompanyCode);
    const funcSet = new Set<string>();
    const secSet = new Set<string>();
    const deptSet = new Set<string>();
    const divSet = new Set<string>();

    scopedRows.forEach((r) => {
      if (r.functionNameTh || r.functionNameEn) funcSet.add(r.functionNameTh || r.functionNameEn);
      if (r.sectionTh || r.sectionEn) secSet.add(r.sectionTh || r.sectionEn);
      if (r.departmentTh || r.departmentEn) deptSet.add(r.departmentTh || r.departmentEn);
      if (r.divisionTh || r.divisionEn) divSet.add(r.divisionTh || r.divisionEn);
    });

    return {
      total: scopedRows.length,
      functions: funcSet.size,
      sections: secSet.size,
      departments: deptSet.size,
      divisions: divSet.size,
    };
  }, [rows, isFactoryUser, factoryCompanyCode]);

  const updateForm = (field: keyof FunctionRecord, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const handleCompanySelect = (compCode: string) => {
    const comp = companyRows.find((c) => c.compCode === compCode);
    setFormValues((current) => ({
      ...current,
      compCode,
      compId: comp?.compId ?? current.compId,
      compNameTh: comp?.compNameTh ?? current.compNameTh,
    }));
  };

  const handleNew = () => {
    const initialComp =
      companyRows.find((c) => c.compCode === (factoryCompanyCode ?? (selectedCompany !== "all" ? selectedCompany : "ATA"))) ??
      companyRows[0];
    const generatedCode = `FNC${String(rows.length + 1).padStart(4, "0")}`;
    const newRecord = {
      ...emptyRecord(initialComp),
      functionCode: generatedCode,
    };
    setFormValues(newRecord);
    setFormMode("new");
  };

  const handleEdit = () => {
    if (!selectedRecord) {
      return;
    }

    setFormValues(selectedRecord);
    setFormMode("edit");
  };

  const handleDelete = () => {
    if (!selectedRecord) {
      return;
    }

    const nextRows = rows.filter((row) => row.id !== selectedRecord.id);
    saveRows(nextRows);
    setSelectedId("");
    setFormMode(null);
  };

  const handleRefresh = () => {
    saveRows(defaultFunctionRows);
    setSearch("");
    setSelectedCompany(isFactoryUser && factoryCompanyCode ? factoryCompanyCode : "all");
    setSelectedSection("all");
    setSelectedDepartment("all");
    setSelectedDivision("all");
    setSelectedId(defaultFunctionRows[0]?.id ?? "");
    setFormMode(null);
  };

  const handleSave = () => {
    const comp = companyRows.find((c) => c.compCode === formValues.compCode);
    const nextRecord: FunctionRecord = {
      ...formValues,
      functionCode: formValues.functionCode.trim().toUpperCase() || `FNC${String(rows.length + 1).padStart(4, "0")}`,
      compCode: formValues.compCode,
      compId: comp?.compId || formValues.compId || "",
      compNameTh: comp?.compNameTh || formValues.compNameTh || "",
      functionNameTh: formValues.functionNameTh.trim(),
      functionNameEn: formValues.functionNameEn.trim(),
      sectionTh: formValues.sectionTh.trim(),
      sectionEn: formValues.sectionEn.trim(),
      departmentTh: formValues.departmentTh.trim(),
      departmentEn: formValues.departmentEn.trim(),
      divisionTh: formValues.divisionTh.trim(),
      divisionEn: formValues.divisionEn.trim(),
    };

    if (!nextRecord.functionNameTh && !nextRecord.functionNameEn) {
      alert("Please provide at least a Function Name (TH or EN).");
      return;
    }

    let nextRows: FunctionRecord[];
    if (formMode === "edit") {
      nextRows = rows.map((row) => (row.id === nextRecord.id ? nextRecord : row));
    } else {
      nextRows = [nextRecord, ...rows];
    }

    saveRows(nextRows);
    setSelectedId(nextRecord.id);
    setFormMode(null);
  };

  return (
    <section className={styles.page} aria-label="Function Data module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{functionDataModule.subtitle}</p>
          <h2>{functionDataModule.title}</h2>
          <p>{functionDataModule.description}</p>
        </div>
        <div className={styles.heroStatsGrid}>
          <div className={styles.heroMetric}>
            <strong>{stats.total}</strong>
            <span>Total Units</span>
          </div>
          <div className={styles.heroMetric}>
            <strong>{stats.functions}</strong>
            <span>Functions</span>
          </div>
          <div className={styles.heroMetric}>
            <strong>{stats.sections}</strong>
            <span>Sections (แผนก)</span>
          </div>
          <div className={styles.heroMetric}>
            <strong>{stats.departments}</strong>
            <span>Departments (ส่วน)</span>
          </div>
          <div className={styles.heroMetric}>
            <strong>{stats.divisions}</strong>
            <span>Divisions (ฝ่าย)</span>
          </div>
        </div>
      </section>

      <section className={styles.workspace}>
        {/* Company Quick Tabs */}
        <div className={styles.companyTabsBar} role="tablist" aria-label="Company tables">
          {!isFactoryUser ? (
            <button
              className={`${styles.companyTab} ${selectedCompany === "all" ? styles.activeTab : ""}`}
              type="button"
              role="tab"
              aria-selected={selectedCompany === "all"}
              onClick={() => {
                setSelectedCompany("all");
                setSelectedSection("all");
                setSelectedDepartment("all");
                setSelectedDivision("all");
              }}
            >
              <strong>All Companies</strong>
              <span>({rows.length})</span>
            </button>
          ) : null}
          {companyRows.map((comp) => {
            const compCount = rows.filter((r) => r.compCode === comp.compCode || r.compId === comp.compId).length;
            const isSelected = selectedCompany === comp.compCode;
            if (isFactoryUser && comp.compCode !== factoryCompanyCode) return null;
            return (
              <button
                key={comp.compCode}
                className={`${styles.companyTab} ${isSelected ? styles.activeTab : ""}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setSelectedCompany(comp.compCode);
                  setSelectedSection("all");
                  setSelectedDepartment("all");
                  setSelectedDivision("all");
                }}
              >
                <strong>{comp.compCode}</strong>
                <span>({compCount})</span>
              </button>
            );
          })}
        </div>

        <div className={styles.filterToolbar}>
          <div className={styles.filterControls}>
            <input
              aria-label="Search function data"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company, function, section, department, or division"
            />
            <select
              aria-label="Filter company"
              value={selectedCompany}
              disabled={isFactoryUser}
              onChange={(event) => {
                setSelectedCompany(event.target.value);
                setSelectedSection("all");
                setSelectedDepartment("all");
                setSelectedDivision("all");
              }}
            >
              {!isFactoryUser ? <option value="all">All Companies</option> : null}
              {companyRows.map((comp) => (
                <option key={comp.compCode} value={comp.compCode}>
                  {comp.compCode} - {comp.compNameTh}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter section"
              value={selectedSection}
              onChange={(event) => {
                setSelectedSection(event.target.value);
                setSelectedDepartment("all");
                setSelectedDivision("all");
              }}
            >
              <option value="all">All Sections (แผนก)</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter department"
              value={selectedDepartment}
              onChange={(event) => {
                setSelectedDepartment(event.target.value);
                setSelectedDivision("all");
              }}
            >
              <option value="all">All Departments (ส่วน)</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter division"
              value={selectedDivision}
              onChange={(event) => setSelectedDivision(event.target.value)}
            >
              <option value="all">All Divisions (ฝ่าย)</option>
              {availableDivisions.map((div) => (
                <option key={div} value={div}>
                  {div}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.buttonActions}>
            <button className={styles.newButton} type="button" onClick={handleNew}>
              New
            </button>
            <button
              className={styles.editButton}
              type="button"
              onClick={handleEdit}
              disabled={!selectedRecord}
            >
              Edit
            </button>
            <button
              className={styles.deleteButton}
              type="button"
              onClick={handleDelete}
              disabled={!selectedRecord}
            >
              Delete
            </button>
            <button className={styles.refreshButton} type="button" onClick={handleRefresh}>
              Refresh
            </button>
          </div>
        </div>

        {formMode ? (
          <section className={styles.editorPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span>{formMode === "new" ? "New Record" : "Edit Record"}</span>
                <h3>
                  {formMode === "new"
                    ? "Create Organization Unit"
                    : `${formValues.functionCode || "Record"} - ${formValues.compCode}`}
                </h3>
              </div>
            </div>

            <div className={styles.formGrid}>
              <label>
                Company (บริษัท)
                <select
                  value={formValues.compCode}
                  disabled={isFactoryUser}
                  onChange={(event) => handleCompanySelect(event.target.value)}
                >
                  {companyRows.map((comp) => (
                    <option key={comp.compCode} value={comp.compCode}>
                      {comp.compCode} - {comp.compNameTh}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Function Code
                <input
                  value={formValues.functionCode}
                  onChange={(event) => updateForm("functionCode", event.target.value)}
                  placeholder="e.g. FNC0001"
                />
              </label>

              <label>
                Function Name (TH)
                <input
                  value={formValues.functionNameTh}
                  onChange={(event) => updateForm("functionNameTh", event.target.value)}
                  placeholder="ชื่อ Function (TH)"
                />
              </label>

              <label>
                Function Name (EN)
                <input
                  value={formValues.functionNameEn}
                  onChange={(event) => updateForm("functionNameEn", event.target.value)}
                  placeholder="Function Name (EN)"
                />
              </label>

              <label>
                Section (แผนก - TH)
                <input
                  value={formValues.sectionTh}
                  onChange={(event) => updateForm("sectionTh", event.target.value)}
                  placeholder="เช่น แผนกบัญชีและควบคุมต้นทุน"
                />
              </label>

              <label>
                Section (แผนก - EN)
                <input
                  value={formValues.sectionEn}
                  onChange={(event) => updateForm("sectionEn", event.target.value)}
                  placeholder="e.g. Accounting & Cost Control Section"
                />
              </label>

              <label>
                Department (ส่วน - TH)
                <input
                  value={formValues.departmentTh}
                  onChange={(event) => updateForm("departmentTh", event.target.value)}
                  placeholder="เช่น ส่วนบัญชีและจัดซื้อ"
                />
              </label>

              <label>
                Department (ส่วน - EN)
                <input
                  value={formValues.departmentEn}
                  onChange={(event) => updateForm("departmentEn", event.target.value)}
                  placeholder="e.g. Accounting & Purchasing Department"
                />
              </label>

              <label>
                Division (ฝ่าย - TH)
                <input
                  value={formValues.divisionTh}
                  onChange={(event) => updateForm("divisionTh", event.target.value)}
                  placeholder="เช่น ฝ่ายบริหาร, ฝ่ายผลิต"
                />
              </label>

              <label>
                Division (ฝ่าย - EN)
                <input
                  value={formValues.divisionEn}
                  onChange={(event) => updateForm("divisionEn", event.target.value)}
                  placeholder="e.g. Administration Division"
                />
              </label>
            </div>

            <div className={styles.formActions}>
              <button className={styles.saveButton} type="button" onClick={handleSave}>
                Save
              </button>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={() => setFormMode(null)}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Master List</span>
              <h3>Organizational Function Hierarchy</h3>
            </div>
            <div className={styles.tableHeaderMeta}>
              <p>{visibleRows.length} units displayed</p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.functionTable}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Company</th>
                  <th>Function (หน่วยงาน)</th>
                  <th>Section (แผนก)</th>
                  <th>Department (ส่วน)</th>
                  <th>Division (ฝ่าย)</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr
                    className={row.id === selectedId ? styles.selectedRow : undefined}
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <span className={styles.companyBadge} title={row.compNameTh || row.compCode}>
                        <strong>{row.compCode}</strong>
                      </span>
                    </td>
                    <td>
                      <div className={styles.bilingualCell}>
                        <strong>{row.functionNameTh || "-"}</strong>
                        {row.functionNameEn && row.functionNameEn !== row.functionNameTh ? (
                          <span>{row.functionNameEn}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className={styles.bilingualCell}>
                        <strong>{row.sectionTh || "-"}</strong>
                        {row.sectionEn && row.sectionEn !== row.sectionTh ? (
                          <span>{row.sectionEn}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className={styles.bilingualCell}>
                        <strong>{row.departmentTh || "-"}</strong>
                        {row.departmentEn && row.departmentEn !== row.departmentTh ? (
                          <span>{row.departmentEn}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className={styles.bilingualCell}>
                        <strong>{row.divisionTh || "-"}</strong>
                        {row.divisionEn && row.divisionEn !== row.divisionTh ? (
                          <span>{row.divisionEn}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.emptyCell}>
                      No organization unit data found matching the selected filters.
                    </td>
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
