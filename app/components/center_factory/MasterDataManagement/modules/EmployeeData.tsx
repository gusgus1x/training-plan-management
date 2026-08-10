"use client";

import { useEffect, useMemo, useState } from "react";
import {
  defaultEmployeeRows,
  readEmployeeMasterData,
  writeEmployeeMasterData,
} from "../../../../lib/employeeMasterData";
import {
  TRAINING_MASTER_EVENT,
  TRAINING_MASTER_KEYS,
  readMasterCollection,
} from "../../../../lib/trainingWorkflow";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { defaultFunctionRows } from "./FunctionData";
import { defaultLevelRows } from "./LevelData";
import { defaultPositionRows } from "./PositionData";
import styles from "./EmployeeData.module.css";

type CompanyCode = "ATA" | "TEP" | "ATFB" | "NIC" | "SATI" | "SNF";

type EmployeeRecord = {
  id: string;
  company: CompanyCode;
  empCode: string;
  idCard: string;
  nameTh: string;
  surnameTh: string;
  titleEn: string;
  nameEn: string;
  surnameEn: string;
  birthday: string;
  workday: string;
  functionCode: string;
  functionName: string;
  department?: string;
  positionName: string;
  levelKey: string;
};

export const employeeDataModule = {
  title: "Employee Data",
  subtitle: "Employee master",
  description:
    "Maintain employee profile data by company, function, position, and level without PL values.",
} as const;

const companies: CompanyCode[] = ["SATI", "ATFB", "TEP", "ATA", "NIC", "SNF"];

const defaultRows: EmployeeRecord[] = defaultEmployeeRows;

const emptyRecord = (): EmployeeRecord => ({
  id: `employee-${Date.now()}`,
  company: "ATA",
  empCode: "",
  idCard: "",
  nameTh: "",
  surnameTh: "",
  titleEn: "Mr.",
  nameEn: "",
  surnameEn: "",
  birthday: "",
  workday: "",
  functionCode: "",
  functionName: "",
  department: "",
  positionName: "",
  levelKey: "",
});

export default function EmployeeData() {
  const user = useAuthenticatedUser();
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const factoryCompanyCode = companies.find(
    (company) => company === user?.companyCode,
  );
  const availableCompanies = useMemo<CompanyCode[]>(
    () =>
      isFactoryUser && factoryCompanyCode ? [factoryCompanyCode] : companies,
    [factoryCompanyCode, isFactoryUser],
  );
  const [rows, setRows] = useState<EmployeeRecord[]>(() => readEmployeeMasterData());
  const [companyFilter, setCompanyFilter] = useState<CompanyCode | "all">(
    isFactoryUser && factoryCompanyCode ? factoryCompanyCode : "all",
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(
    () =>
      readEmployeeMasterData().find(
        (row) => !isFactoryUser || row.company === factoryCompanyCode,
      )?.id ?? "",
  );
  const [openCompanies, setOpenCompanies] = useState<CompanyCode[]>([]);
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [formValues, setFormValues] = useState<EmployeeRecord>(emptyRecord);
  const [functionRows, setFunctionRows] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.functions, defaultFunctionRows),
  );
  const [positionRows, setPositionRows] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.positions, defaultPositionRows),
  );
  const [levelRows, setLevelRows] = useState(() =>
    readMasterCollection(TRAINING_MASTER_KEYS.levels, defaultLevelRows),
  );

  useEffect(() => {
    const syncReferenceMasters = () => {
      setFunctionRows(
        readMasterCollection(TRAINING_MASTER_KEYS.functions, defaultFunctionRows),
      );
      setPositionRows(
        readMasterCollection(TRAINING_MASTER_KEYS.positions, defaultPositionRows),
      );
      setLevelRows(
        readMasterCollection(TRAINING_MASTER_KEYS.levels, defaultLevelRows),
      );
    };

    window.addEventListener(TRAINING_MASTER_EVENT, syncReferenceMasters);
    return () =>
      window.removeEventListener(TRAINING_MASTER_EVENT, syncReferenceMasters);
  }, []);

  const selectedRecord =
    rows.find(
      (row) =>
        row.id === selectedId &&
        (!isFactoryUser || row.company === factoryCompanyCode),
    ) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesFactoryScope =
        !isFactoryUser || row.company === factoryCompanyCode;
      const matchesCompany = companyFilter === "all" || row.company === companyFilter;
      const matchesSearch =
        !query ||
        [
          row.company,
          row.empCode,
          row.idCard,
          row.nameTh,
          row.surnameTh,
          row.nameEn,
          row.surnameEn,
          row.functionCode,
          row.functionName,
          row.department,
          row.positionName,
          row.levelKey,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesFactoryScope && matchesCompany && matchesSearch;
    });
  }, [companyFilter, factoryCompanyCode, isFactoryUser, rows, search]);

  const visibleCompanyGroups = useMemo(
    () =>
      availableCompanies
        .filter((company) => companyFilter === "all" || company === companyFilter)
        .map((company) => ({
          code: company,
          rows: visibleRows.filter((row) => row.company === company),
          totalRecords: rows.filter((row) => row.company === company).length,
        })),
    [availableCompanies, companyFilter, rows, visibleRows],
  );

  const updateForm = (field: keyof EmployeeRecord, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const updateFunction = (functionCode: string) => {
    const selectedFunction = functionRows.find(
      (row) => row.functionCode === functionCode,
    );
    setFormValues((current) => ({
      ...current,
      functionCode,
      functionName:
        selectedFunction?.functionNameEn ||
        selectedFunction?.functionNameTh ||
        "",
    }));
  };

  const saveRows = (nextRows: EmployeeRecord[]) => {
    setRows(nextRows);
    writeEmployeeMasterData(nextRows);
  };

  const toggleCompany = (company: CompanyCode) => {
    setOpenCompanies((current) =>
      current.includes(company)
        ? current.filter((openCompany) => openCompany !== company)
        : [...current, company],
    );
  };

  const handleNew = () => {
    const nextRecord = emptyRecord();
    const targetCompany = factoryCompanyCode ?? nextRecord.company;
    setFormValues({ ...nextRecord, company: targetCompany });
    setOpenCompanies((current) =>
      current.includes(targetCompany) ? current : [targetCompany, ...current],
    );
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

    saveRows(rows.filter((row) => row.id !== selectedRecord.id));
    setSelectedId("");
    setFormMode(null);
  };

  const handleRefresh = () => {
    const nextRows = readEmployeeMasterData();
    setRows(nextRows);
    setCompanyFilter(isFactoryUser && factoryCompanyCode ? factoryCompanyCode : "all");
    setSearch("");
    setSelectedId(
      nextRows.find(
        (row) => !isFactoryUser || row.company === factoryCompanyCode,
      )?.id ?? "",
    );
    setOpenCompanies([]);
    setFormMode(null);
  };

  const handleSave = () => {
    const nextRecord: EmployeeRecord = {
      ...formValues,
      company: factoryCompanyCode ?? formValues.company,
      empCode: formValues.empCode.trim().toUpperCase(),
      idCard: formValues.idCard.trim(),
      nameTh: formValues.nameTh.trim(),
      surnameTh: formValues.surnameTh.trim(),
      titleEn: formValues.titleEn.trim(),
      nameEn: formValues.nameEn.trim(),
      surnameEn: formValues.surnameEn.trim(),
      functionCode: formValues.functionCode.trim().toUpperCase(),
      functionName: formValues.functionName.trim(),
      department: formValues.department?.trim() || "",
      positionName: formValues.positionName.trim(),
      levelKey: formValues.levelKey.trim(),
    };

    if (
      !nextRecord.empCode ||
      !nextRecord.nameTh ||
      !nextRecord.nameEn ||
      !nextRecord.functionCode ||
      !nextRecord.positionName ||
      !nextRecord.levelKey
    ) {
      return;
    }

    if (formMode === "edit") {
      saveRows(
        rows.map((row) => (row.id === nextRecord.id ? nextRecord : row)),
      );
    } else {
      saveRows([nextRecord, ...rows]);
    }

    setSelectedId(nextRecord.id);
    setCompanyFilter(nextRecord.company);
    setOpenCompanies((current) =>
      current.includes(nextRecord.company) ? current : [nextRecord.company, ...current],
    );
    setFormMode(null);
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
            placeholder="Search employee code, name, function, position"
          />
          <select
            aria-label="Filter employee company"
            value={companyFilter}
            disabled={isFactoryUser}
            onChange={(event) => setCompanyFilter(event.target.value as CompanyCode | "all")}
          >
            {!isFactoryUser ? <option value="all">All Companies</option> : null}
            {availableCompanies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
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

        {formMode ? (
          <section className={styles.editorPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span>{formMode === "new" ? "New record" : "Edit record"}</span>
                <h3>{formMode === "new" ? "Create Employee" : formValues.empCode}</h3>
              </div>
            </div>

            <div className={styles.formGrid}>
              <label>
                Company
                <select
                  value={formValues.company}
                  disabled={isFactoryUser}
                  onChange={(event) => updateForm("company", event.target.value)}
                >
                  {availableCompanies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Emp Code
                <input
                  value={formValues.empCode}
                  onChange={(event) => updateForm("empCode", event.target.value)}
                />
              </label>
              <label>
                ID Card
                <input
                  value={formValues.idCard}
                  onChange={(event) => updateForm("idCard", event.target.value)}
                />
              </label>
              <label>
                Name(TH)
                <input
                  value={formValues.nameTh}
                  onChange={(event) => updateForm("nameTh", event.target.value)}
                />
              </label>
              <label>
                Surname(TH)
                <input
                  value={formValues.surnameTh}
                  onChange={(event) => updateForm("surnameTh", event.target.value)}
                />
              </label>
              <label>
                Title(EN)
                <select
                  value={formValues.titleEn}
                  onChange={(event) => updateForm("titleEn", event.target.value)}
                >
                  <option>Mr.</option>
                  <option>Ms.</option>
                  <option>Mrs.</option>
                </select>
              </label>
              <label>
                Name(EN)
                <input
                  value={formValues.nameEn}
                  onChange={(event) => updateForm("nameEn", event.target.value)}
                />
              </label>
              <label>
                Surname(EN)
                <input
                  value={formValues.surnameEn}
                  onChange={(event) => updateForm("surnameEn", event.target.value)}
                />
              </label>
              <label>
                Birthday
                <input
                  type="date"
                  value={formValues.birthday}
                  onChange={(event) => updateForm("birthday", event.target.value)}
                />
              </label>
              <label>
                Workday
                <input
                  type="date"
                  value={formValues.workday}
                  onChange={(event) => updateForm("workday", event.target.value)}
                />
              </label>
              <label>
                Function Code
                <select
                  value={formValues.functionCode}
                  onChange={(event) => updateFunction(event.target.value)}
                >
                  <option value="">Select function</option>
                  {functionRows.map((row) => (
                    <option key={row.id} value={row.functionCode}>
                      {row.functionCode} — {row.functionNameEn || row.functionNameTh}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Function Name
                <input
                  disabled
                  value={formValues.functionName}
                />
              </label>
              <label>
                Department
                <input
                  value={formValues.department || ""}
                  placeholder="e.g. Assembly, QC, Maintenance"
                  onChange={(event) => updateForm("department", event.target.value)}
                />
              </label>
              <label>
                Position Name
                <select
                  value={formValues.positionName}
                  onChange={(event) => updateForm("positionName", event.target.value)}
                >
                  <option value="">Select position</option>
                  {positionRows.map((row) => (
                    <option key={row.id} value={row.positionNameEn}>
                      {row.positionNameEn} / {row.positionNameTh}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Level Key
                <select
                  value={formValues.levelKey}
                  onChange={(event) => updateForm("levelKey", event.target.value)}
                >
                  <option value="">Select level</option>
                  {levelRows.map((row) => (
                    <option key={row.id} value={row.levelKey}>
                      {row.levelKey} — {row.levelNameEn}
                    </option>
                  ))}
                </select>
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
              <h3>Employee Records</h3>
            </div>
            <p>{visibleRows.length} records</p>
          </div>

          <div className={styles.companyDirectory}>
            {visibleCompanyGroups.map((companyGroup) => {
              const isOpen = openCompanies.includes(companyGroup.code);

              return (
                <section
                  className={`${styles.companyGroup} ${isOpen ? styles.openGroup : ""}`}
                  key={companyGroup.code}
                >
                  <button
                    className={styles.companyHeader}
                    type="button"
                    onClick={() => toggleCompany(companyGroup.code)}
                  >
                    <span className={styles.chevron} aria-hidden="true" />
                    <span>
                      Company: <strong>{companyGroup.code}</strong>
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
                            <th>Name(TH)</th>
                            <th>Surname(TH)</th>
                            <th>Title(EN)</th>
                            <th>Name(EN)</th>
                            <th>Surname(EN)</th>
                            <th>Birthday</th>
                            <th>Workday</th>
                            <th>Function Code</th>
                            <th>Function Name</th>
                            <th>Department</th>
                            <th>Position Name</th>
                            <th>Level Key</th>
                          </tr>
                        </thead>
                        <tbody>
                          {companyGroup.rows.map((row, index) => (
                            <tr
                              className={row.id === selectedId ? styles.selectedRow : undefined}
                              key={row.id}
                              onClick={() => setSelectedId(row.id)}
                            >
                              <td>{index + 1}</td>
                              <td>
                                <span className={styles.companyPill}>{row.company}</span>
                              </td>
                              <td>{row.empCode}</td>
                              <td>{row.idCard}</td>
                              <td>{row.nameTh}</td>
                              <td>{row.surnameTh}</td>
                              <td>{row.titleEn}</td>
                              <td>{row.nameEn}</td>
                              <td>{row.surnameEn}</td>
                              <td>{row.birthday}</td>
                              <td>{row.workday}</td>
                              <td>{row.functionCode}</td>
                              <td>{row.functionName}</td>
                              <td>{row.department || "-"}</td>
                              <td>{row.positionName}</td>
                              <td>
                                <span className={styles.levelPill}>{row.levelKey}</span>
                              </td>
                            </tr>
                          ))}
                          {companyGroup.rows.length === 0 ? (
                            <tr>
                              <td colSpan={16}>No employee data found for this company.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </section>
      </section>
    </section>
  );
}
