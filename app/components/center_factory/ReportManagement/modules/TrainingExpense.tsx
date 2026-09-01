"use client";

import { useMemo, useState } from "react";
import { useNotice } from "../../../NoticeDialog";
import styles from "./TrainingExpense.module.css";

export const trainingExpenseModule = {
  title: "Training Expense",
  subtitle: "Training expense summary",
  description: "Training expense summary by course, company, and date range",
} as const;

// No seeded rows. This screen has no backend yet, and courses with budgets and approval states
// attached read as real spending to anyone who opens it.
const formFields = ["Course code","Expense type","Amount","Cost center"] as const;

const fieldLabels = [
  "รหัสหลักสูตร (Course code)",
  "ประเภทค่าใช้จ่าย (Expense type)",
  "จำนวนเงิน (Amount)",
  "ศูนย์ต้นทุน (Cost center)",
] as const;

export default function TrainingExpense() {
  const notice = useNotice();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [draftRows, setDraftRows] = useState<string[][]>([]);
  const [formValues, setFormValues] = useState(() => formFields.map(() => ""));

  const rows = useMemo(() => draftRows.map((row) => [...row]), [draftRows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row[4]))), [rows]);
  const visibleRows = rows.filter((row) => {
    const matchesSearch = row.join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "all" || row[4] === status;
    return matchesSearch && matchesStatus;
  });

  const handleFormChange = (index: number, value: string) => {
    setFormValues((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const handleAddRecord = async () => {
    const values = formFields.map((_, index) => formValues[index]?.trim() ?? "");
    const missingFields = fieldLabels.filter((_, index) => !values[index]);

    if (missingFields.length > 0) {
      await notice({ missingFields: [...missingFields] });
      return;
    }

    setDraftRows((current) => [[...values, "Draft"], ...current]);
    setFormValues(formFields.map(() => ""));
  };

  return (
    <section className={styles.moduleWorkspace} aria-label={`Training Expense module`}>
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{trainingExpenseModule.subtitle}</p>
          <h2>{trainingExpenseModule.title}</h2>
          <p>{trainingExpenseModule.description}</p>
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
        <p>This form lives in the {trainingExpenseModule.title} module file, so page-specific logic can be edited here.</p>
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
            <button className={styles.actionButton} type="button" onClick={() => void handleAddRecord()}>
              Add record
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
