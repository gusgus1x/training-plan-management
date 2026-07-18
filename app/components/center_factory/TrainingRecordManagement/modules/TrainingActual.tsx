"use client";

import { useMemo, useState } from "react";
import styles from "./TrainingActual.module.css";

export const trainingActualModule = {
  title: "Training Actual",
  subtitle: "บันทึกอบรมจริง",
  description: "บันทึกหลักสูตรที่จัดอบรมจริง ชั่วโมงอบรม ผู้เข้าอบรม และสถานะการจบหลักสูตร",
} as const;

const initialRows = [["ACT-001","Leadership Essentials","15 Jul 2026","24 users","Completed"],["ACT-002","Safety Basics","08 Jul 2026","41 users","Completed"],["ACT-003","Service Mind","18 Jul 2026","16 users","Pending close"]] as const;
const formFields = ["Actual no.","Course","Training date","Actual attendees"] as const;

export default function TrainingActual() {
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
    <section className={styles.moduleWorkspace} aria-label={`Training Actual module`}>
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{trainingActualModule.subtitle}</p>
          <h2>{trainingActualModule.title}</h2>
          <p>{trainingActualModule.description}</p>
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
        <p>This form lives in the {trainingActualModule.title} module file, so page-specific logic can be edited here.</p>
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
