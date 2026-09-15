"use client";

import { useMemo, useState } from "react";
import { useNotice } from "../../../NoticeDialog";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import styles from "./TrainingResultReport.module.css";

export const trainingResultReportModule = {
  title: "Keep Pre/Post Test and Evaluation",
  titleTh: "ผลการทดสอบและประเมินผล (Keep Pre/Post Test & Evaluation)",
  subtitle: "Test and evaluation results",
  subtitleTh: "รายงานผลการทดสอบและประเมินผล",
  description: "Test and evaluation results by course, company, and date range",
  descriptionTh: "รายงานผลการทดสอบ Pre/Post และการประเมินผลตามหลักสูตร บริษัท และช่วงเวลา",
} as const;

export const resultReportTitle = trainingResultReportModule.title;

// No seeded rows. This screen has no backend yet, and invented pre/post scores are exactly the
// kind of figure someone would quote in a meeting without checking where it came from.
const formFields = ["Course code","Period","Company","Export format"] as const;

const fieldLabels = [
  { th: "รหัสหลักสูตร", en: "Course code" },
  { th: "ช่วงเวลา", en: "Period" },
  { th: "บริษัท", en: "Company" },
  { th: "รูปแบบไฟล์ส่งออก", en: "Export format" },
] as const;

export default function TrainingResultReport() {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
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
    const missing: string[] = [];
    fieldLabels.forEach((label, idx) => {
      if (!values[idx]) {
        missing.push(isThai ? label.th : label.en);
      }
    });

    if (missing.length > 0) {
      await notice({ missingFields: missing });
      return;
    }

    setDraftRows((current) => [[...values, "Draft"], ...current]);
    setFormValues(formFields.map(() => ""));
  };

  return (
    <section className={styles.moduleWorkspace} aria-label={`Keep Pre/Post Test and Evaluation module`}>
      <section className={styles.moduleHero}>
        <div>
          <p className={styles.panelKicker}>{isThai ? trainingResultReportModule.subtitleTh : trainingResultReportModule.subtitle}</p>
          <h2>{isThai ? trainingResultReportModule.titleTh : trainingResultReportModule.title}</h2>
          <p>{isThai ? trainingResultReportModule.descriptionTh : trainingResultReportModule.description}</p>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            aria-label={t("ค้นหารายการ", "Search records")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("ค้นหา", "Search")}
          />
          <select aria-label={t("กรองสถานะ", "Filter status")} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">{t("ทุกสถานะ", "All status")}</option>
            {statuses.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button className={styles.secondaryButton} type="button" onClick={() => { setSearch(""); setStatus("all"); }}>
            {t("ล้าง", "Clear")}
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <h3>{t("รายการข้อมูล", "Records")}</h3>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>{t("รหัส", "Code")}</th>
                <th>{t("ชื่อ", "Name")}</th>
                <th>{t("รายละเอียด", "Detail")}</th>
                <th>{t("ผู้รับผิดชอบ / ขอบเขต", "Owner / Scope")}</th>
                <th>{t("สถานะ", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--ui-30-muted)" }}>
                    {t("ไม่พบข้อมูลรายงาน", "No report records found")}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.join("-")}>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                    <td>{row[3]}</td>
                    <td><span className={styles.statusPill}>{row[4]}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.formPanel}>
        <h3>{t("เพิ่มรายการโมดูล", "Add module record")}</h3>
        <p>{t(`แบบฟอร์มนี้ทำงานในโมดูล ${isThai ? trainingResultReportModule.titleTh : trainingResultReportModule.title}`, `This form lives in the ${trainingResultReportModule.title} module file, so page-specific logic can be edited here.`)}</p>
        <div className={styles.formGrid}>
          {fieldLabels.map((field, index) => (
            <label key={field.en}>
              {isThai ? field.th : field.en}
              <input
                value={formValues[index]}
                onChange={(event) => handleFormChange(index, event.target.value)}
                placeholder={isThai ? field.th : field.en}
              />
            </label>
          ))}
          <div className={styles.fullWidth}>
            <button className={styles.actionButton} type="button" onClick={() => void handleAddRecord()}>
              {t("เพิ่มรายการ", "Add record")}
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
