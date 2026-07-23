"use client";

import { useMemo, useState } from "react";
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

const defaultRows: EmployeeRecord[] = [
  {
    id: "emp-ata-001",
    company: "ATA",
    empCode: "ATA-1001",
    idCard: "1101400023412",
    nameTh: "อนันต์",
    surnameTh: "ศรีสุข",
    titleEn: "Mr.",
    nameEn: "Anan",
    surnameEn: "Srisuk",
    birthday: "1991-04-12",
    workday: "2018-06-01",
    functionCode: "FNC0010",
    functionName: "Production",
    positionName: "Operator",
    levelKey: "ป3",
  },
  {
    id: "emp-ata-002",
    company: "ATA",
    empCode: "ATA-1002",
    idCard: "1101400025798",
    nameTh: "มาลี",
    surnameTh: "เกษมสุข",
    titleEn: "Ms.",
    nameEn: "Mali",
    surnameEn: "Kasemsuk",
    birthday: "1989-09-18",
    workday: "2016-03-14",
    functionCode: "FNC0013",
    functionName: "Quality",
    positionName: "Engineer",
    levelKey: "บ2",
  },
  {
    id: "emp-tep-001",
    company: "TEP",
    empCode: "TEP-2101",
    idCard: "3100200045611",
    nameTh: "ธนกร",
    surnameTh: "บุญมี",
    titleEn: "Mr.",
    nameEn: "Thanakorn",
    surnameEn: "Boonmee",
    birthday: "1993-02-07",
    workday: "2019-11-20",
    functionCode: "FNC0012",
    functionName: "Engineering and Maintenance",
    positionName: "Foreman",
    levelKey: "บ3",
  },
  {
    id: "emp-tep-002",
    company: "TEP",
    empCode: "TEP-2102",
    idCard: "3100200047983",
    nameTh: "เบญจมาศ",
    surnameTh: "ยิ่งเจริญ",
    titleEn: "Ms.",
    nameEn: "Benjamas",
    surnameEn: "Yingcharoen",
    birthday: "1995-12-22",
    workday: "2021-01-08",
    functionCode: "FNC0011",
    functionName: "Production Planing",
    positionName: "Staff",
    levelKey: "ป2",
  },
  {
    id: "emp-atfb-001",
    company: "ATFB",
    empCode: "ATFB-3201",
    idCard: "2100300064410",
    nameTh: "สมชาย",
    surnameTh: "พร้อมใจ",
    titleEn: "Mr.",
    nameEn: "Somchai",
    surnameEn: "Promjai",
    birthday: "1987-07-03",
    workday: "2013-05-16",
    functionCode: "FNC0010",
    functionName: "Production",
    positionName: "Section Head",
    levelKey: "บ4",
  },
  {
    id: "emp-atfb-002",
    company: "ATFB",
    empCode: "ATFB-3202",
    idCard: "2100300067154",
    nameTh: "อรสา",
    surnameTh: "จันทร์ดี",
    titleEn: "Ms.",
    nameEn: "Orasa",
    surnameEn: "Jandee",
    birthday: "1990-10-27",
    workday: "2017-08-21",
    functionCode: "FNC0014",
    functionName: "Safety and Environment",
    positionName: "Supervisor",
    levelKey: "บ2",
  },
  {
    id: "emp-nic-001",
    company: "NIC",
    empCode: "NIC-4301",
    idCard: "4100500075561",
    nameTh: "กานดา",
    surnameTh: "รุ่งเรือง",
    titleEn: "Ms.",
    nameEn: "Kanda",
    surnameEn: "Rungrueang",
    birthday: "1992-05-30",
    workday: "2020-04-01",
    functionCode: "FNC0007",
    functionName: "Purchase",
    positionName: "Staff",
    levelKey: "ป3",
  },
  {
    id: "emp-nic-002",
    company: "NIC",
    empCode: "NIC-4302",
    idCard: "4100500078827",
    nameTh: "ปรีชา",
    surnameTh: "วงศ์สว่าง",
    titleEn: "Mr.",
    nameEn: "Preecha",
    surnameEn: "Wongsawang",
    birthday: "1988-01-14",
    workday: "2015-09-07",
    functionCode: "FNC0009",
    functionName: "Warehouse",
    positionName: "Leader",
    levelKey: "ป4",
  },
  {
    id: "emp-sati-001",
    company: "SATI",
    empCode: "SATI-5401",
    idCard: "5100600082149",
    nameTh: "วิภาดา",
    surnameTh: "ชัยพร",
    titleEn: "Ms.",
    nameEn: "Wipada",
    surnameEn: "Chaiporn",
    birthday: "1994-08-11",
    workday: "2022-02-15",
    functionCode: "FNC0008",
    functionName: "IT Promotion",
    positionName: "Engineer",
    levelKey: "บ1",
  },
  {
    id: "emp-sati-002",
    company: "SATI",
    empCode: "SATI-5402",
    idCard: "5100600084472",
    nameTh: "ชัยวัฒน์",
    surnameTh: "นิลประภา",
    titleEn: "Mr.",
    nameEn: "Chaiwat",
    surnameEn: "Nilprapa",
    birthday: "1986-11-04",
    workday: "2014-12-01",
    functionCode: "FNC0015",
    functionName: "Project Engineering",
    positionName: "Manager++",
    levelKey: "จ2",
  },
  {
    id: "emp-snf-001",
    company: "SNF",
    empCode: "SNF-6501",
    idCard: "6100700090186",
    nameTh: "สุดา",
    surnameTh: "มั่นคง",
    titleEn: "Ms.",
    nameEn: "Suda",
    surnameEn: "Mankong",
    birthday: "1996-03-19",
    workday: "2023-06-05",
    functionCode: "FNC0004",
    functionName: "Human Resource",
    positionName: "Staff",
    levelKey: "ป1",
  },
  {
    id: "emp-snf-002",
    company: "SNF",
    empCode: "SNF-6502",
    idCard: "6100700093517",
    nameTh: "กฤต",
    surnameTh: "อรุณรุ่ง",
    titleEn: "Mr.",
    nameEn: "Krit",
    surnameEn: "Aroonrung",
    birthday: "1991-06-25",
    workday: "2018-10-10",
    functionCode: "FNC0010",
    functionName: "Production",
    positionName: "Operator",
    levelKey: "ป2",
  },
];

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
  positionName: "",
  levelKey: "",
});

export default function EmployeeData() {
  const [rows, setRows] = useState<EmployeeRecord[]>(defaultRows);
  const [companyFilter, setCompanyFilter] = useState<CompanyCode | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(defaultRows[0]?.id ?? "");
  const [openCompanies, setOpenCompanies] = useState<CompanyCode[]>(["SATI"]);
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [formValues, setFormValues] = useState<EmployeeRecord>(emptyRecord);

  const selectedRecord = rows.find((row) => row.id === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
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
          row.positionName,
          row.levelKey,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesCompany && matchesSearch;
    });
  }, [rows, companyFilter, search]);

  const visibleCompanyGroups = useMemo(
    () =>
      companies
        .filter((company) => companyFilter === "all" || company === companyFilter)
        .map((company) => ({
          code: company,
          rows: visibleRows.filter((row) => row.company === company),
          totalRecords: rows.filter((row) => row.company === company).length,
        })),
    [companyFilter, rows, visibleRows],
  );

  const updateForm = (field: keyof EmployeeRecord, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const toggleCompany = (company: CompanyCode) => {
    setOpenCompanies((current) =>
      current.includes(company)
        ? current.filter((openCompany) => openCompany !== company)
        : [...current, company],
    );
  };

  const handleNew = () => {
    setFormValues(emptyRecord());
    setOpenCompanies((current) => (current.includes("ATA") ? current : ["ATA", ...current]));
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

    setRows((current) => current.filter((row) => row.id !== selectedRecord.id));
    setSelectedId("");
    setFormMode(null);
  };

  const handleRefresh = () => {
    setRows(defaultRows);
    setCompanyFilter("all");
    setSearch("");
    setSelectedId(defaultRows[0]?.id ?? "");
    setOpenCompanies(["SATI"]);
    setFormMode(null);
  };

  const handleSave = () => {
    const nextRecord: EmployeeRecord = {
      ...formValues,
      empCode: formValues.empCode.trim().toUpperCase(),
      idCard: formValues.idCard.trim(),
      nameTh: formValues.nameTh.trim(),
      surnameTh: formValues.surnameTh.trim(),
      titleEn: formValues.titleEn.trim(),
      nameEn: formValues.nameEn.trim(),
      surnameEn: formValues.surnameEn.trim(),
      functionCode: formValues.functionCode.trim().toUpperCase(),
      functionName: formValues.functionName.trim(),
      positionName: formValues.positionName.trim(),
      levelKey: formValues.levelKey.trim(),
    };

    if (!nextRecord.empCode || !nextRecord.nameTh || !nextRecord.nameEn) {
      return;
    }

    if (formMode === "edit") {
      setRows((current) =>
        current.map((row) => (row.id === nextRecord.id ? nextRecord : row)),
      );
    } else {
      setRows((current) => [nextRecord, ...current]);
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
            onChange={(event) => setCompanyFilter(event.target.value as CompanyCode | "all")}
          >
            <option value="all">All Companies</option>
            {companies.map((company) => (
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
                  onChange={(event) => updateForm("company", event.target.value)}
                >
                  {companies.map((company) => (
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
                <input
                  value={formValues.functionCode}
                  onChange={(event) => updateForm("functionCode", event.target.value)}
                />
              </label>
              <label>
                Function Name
                <input
                  value={formValues.functionName}
                  onChange={(event) => updateForm("functionName", event.target.value)}
                />
              </label>
              <label>
                Position Name
                <input
                  value={formValues.positionName}
                  onChange={(event) => updateForm("positionName", event.target.value)}
                />
              </label>
              <label>
                Level Key
                <input
                  value={formValues.levelKey}
                  onChange={(event) => updateForm("levelKey", event.target.value)}
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
                              <td>{row.positionName}</td>
                              <td>
                                <span className={styles.levelPill}>{row.levelKey}</span>
                              </td>
                            </tr>
                          ))}
                          {companyGroup.rows.length === 0 ? (
                            <tr>
                              <td colSpan={15}>No employee data found for this company.</td>
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
