"use client";

import { useMemo, useState } from "react";
import styles from "./TrainingAcceptSurvey.module.css";

export const trainingAcceptSurveyModule = {
  title: "Training Accept Survey",
  subtitle: "แบบสำรวจตอบรับอบรม",
  description: "จัดการแบบสำรวจการตอบรับ ตรวจสอบผู้เข้าร่วม และสรุปผลตอบรับก่อนอบรม",
} as const;

const initialRows = [["SUR-001","Leadership Essentials","24 invited","22 accepted","Open"],["SUR-002","Safety Basics","42 invited","39 accepted","Closed"],["SUR-003","Service Mind","18 invited","14 accepted","Open"]] as const;
const formFields = ["Survey no.","Course","Target group","Due date"] as const;

export default function TrainingAcceptSurvey() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [draftRows, setDraftRows] = useState<string[][]>([]);
  const [formValues, setFormValues] = useState(() => formFields.map(() => ""));

  const rows = useMemo(() => [...draftRows, ...initialRows.map((row) => [...row])], [draftRows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row[4]))), [rows]);
  const visibleRows = rows.filter((row) => {
    const matchesSearch = row.join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "all" || row[4] === status;
    return matchesSearch && matchesStatus;
  });

  const handleFormChange = (index: number, value: string) => {
    setFormValues((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const handleAddRecord = () => {
    const nextRow = [
      formValues[0]?.trim() || `TRA-NEW`,
      formValues[1]?.trim() || "New record",
      formValues[2]?.trim() || "Pending detail",
      formValues[3]?.trim() || "HRD Center",
      "Draft",
    ];
    setDraftRows((current) => [nextRow, ...current]);
    setFormValues(formFields.map(() => ""));
  };

  return (
    <section className={styles.moduleWorkspace} aria-label={`Training Accept Survey module`}>
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{trainingAcceptSurveyModule.subtitle}</p>
          <h2>{trainingAcceptSurveyModule.title}</h2>
          <p>{trainingAcceptSurveyModule.description}</p>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.statCard}>
            <span>Total</span>
            <strong>{rows.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Visible</span>
            <strong>{visibleRows.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Draft</span>
            <strong>{draftRows.length}</strong>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search records"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
          />
          <select aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All status</option>
            {statuses.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button className={styles.secondaryButton} type="button" onClick={() => { setSearch(""); setStatus("all"); }}>
            Clear
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <h3>Records</h3>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Detail</th>
                <th>Owner / Scope</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.join("-")}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                  <td><span className={styles.statusPill}>{row[4]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.formPanel}>
        <h3>Add module record</h3>
        <p>This form lives in the {trainingAcceptSurveyModule.title} module file, so page-specific logic can be edited here.</p>
        <div className={styles.formGrid}>
          {formFields.map((field, index) => (
            <label key={field}>
              {field}
              <input
                value={formValues[index]}
                onChange={(event) => handleFormChange(index, event.target.value)}
                placeholder={field}
              />
            </label>
          ))}
          <div className={styles.fullWidth}>
            <button className={styles.actionButton} type="button" onClick={handleAddRecord}>
              Add record
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
