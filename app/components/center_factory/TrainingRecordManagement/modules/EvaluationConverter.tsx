"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  analyseSheet,
  COLUMN_ROLES,
  convertSheet,
  QUESTION_ROLES,
  type ColumnRole,
  type SheetAnalysis,
} from "../../../../lib/externalEvaluation/convert";
import {
  buildSectionReport,
  type ReportSection,
  type SectionAssignment,
} from "../../../../lib/externalEvaluation/sections";
import type { EvaluationCourseHeader } from "../../../../lib/trainingForms/types";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import SearchableSelect from "../../../SearchableSelect";
import { Clock, FileSpreadsheet, Lock, Upload, Users } from "../../../icons/LucideIcons";
import { loadWorkflowRollingPlans, type RollingPlan } from "../../TrainingPlanManagement/modules/TrainingRolling";
import { ChoiceChart, formatAnswerTime, RatingChart, TextAnswers } from "./EvaluationResultsPage";
import results from "./EvaluationResultsPage.module.css";
import styles from "./EvaluationConverter.module.css";

const ROLE_LABELS: Record<ColumnRole, { th: string; en: string }> = {
  SKIP: { th: "ไม่ใช้คอลัมน์นี้", en: "Skip" },
  STARTED_AT: { th: "เวลาเริ่มตอบ", en: "Start time" },
  SUBMITTED_AT: { th: "เวลาส่ง", en: "Submit time" },
  FULL_NAME: { th: "ชื่อ-นามสกุล", en: "Full name" },
  FIRST_NAME: { th: "ชื่อ", en: "First name" },
  LAST_NAME: { th: "นามสกุล", en: "Last name" },
  EMPLOYEE_CODE: { th: "รหัสพนักงาน", en: "Employee code" },
  COMPANY: { th: "บริษัท", en: "Company" },
  RATING: { th: "คำถาม: คะแนน 1-5", en: "Question: rating 1-5" },
  CHOICE: { th: "คำถาม: ตัวเลือก (ตอบได้ 1 ข้อ)", en: "Question: single choice" },
  MULTI_CHOICE: { th: "คำถาม: ตัวเลือก (ตอบได้หลายข้อ)", en: "Question: multiple choice" },
  TEXT: { th: "คำถาม: ข้อความ", en: "Question: written answer" },
};

const SOURCE_LABELS = { MICROSOFT: "Microsoft Forms", GOOGLE: "Google Forms", UNKNOWN: "" } as const;

/** A plan date ("2026-09-01" or a full ISO) as the midnight it means in Thailand. */
const toIso = (value: string) => (value ? (value.length === 10 ? `${value}T00:00:00+07:00` : value) : "");

type HeaderDraft = { courseName: string; startDate: string; endDate: string; venue: string; instructor: string };
const EMPTY_HEADER: HeaderDraft = { courseName: "", startDate: "", endDate: "", venue: "", instructor: "" };

/**
 * Upload a Google Forms / Microsoft Forms response file, see it charted, download the same Excel
 * dashboard the in-system evaluation exports. Nothing is saved anywhere.
 */
export default function EvaluationConverter() {
  const router = useRouter();
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);

  const [plans, setPlans] = useState<RollingPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [header, setHeader] = useState<HeaderDraft>(EMPTY_HEADER);
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<SheetAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Simple: one chart per question. Advanced: HRD's own sections, in the company workbook. */
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [assignment, setAssignment] = useState<SectionAssignment>({});

  const addSection = () => setSections((current) => [...current, { id: `s-${Date.now()}`, name: "" }]);
  const renameSection = (id: string, name: string) =>
    setSections((current) => current.map((section) => (section.id === id ? { ...section, name } : section)));
  const removeSection = (id: string) => {
    setSections((current) => current.filter((section) => section.id !== id));
    setAssignment((current) => Object.fromEntries(Object.entries(current).filter(([, sectionId]) => sectionId !== id)));
  };
  const assign = (columnIndex: number, sectionId: string) =>
    setAssignment((current) => {
      const next = { ...current };
      if (sectionId) next[columnIndex] = sectionId;
      else delete next[columnIndex];
      return next;
    });

  useEffect(() => {
    void loadWorkflowRollingPlans().then(setPlans);
  }, []);

  const chosenPlan = plans.find((plan) => plan.rollingId === planId) ?? null;

  const chooseCourse = (id: string) => {
    setPlanId(id);
    const plan = plans.find((item) => item.rollingId === id);
    setHeader(
      plan
        ? {
            courseName: plan.course.name,
            startDate: plan.trainingDate.slice(0, 10),
            endDate: (plan.endDate || plan.trainingDate).slice(0, 10),
            venue: plan.location,
            instructor: plan.trainer,
          }
        : EMPTY_HEADER,
    );
  };

  const course = useMemo((): EvaluationCourseHeader => ({
    planCode: chosenPlan?.rollingId ?? "",
    courseName: header.courseName.trim(),
    batchName: chosenPlan?.batch || null,
    startAt: toIso(header.startDate),
    endAt: toIso(header.endDate || header.startDate),
    venue: header.venue.trim() || null,
    instructor: header.instructor.trim() || null,
    organiser: chosenPlan?.owner === "FACTORY" ? "FACTORY" : "CENTER",
  }), [header, chosenPlan]);
  const formName = fileName.replace(/\.(xlsx|csv)$/i, "");

  // Recomputed on every column-type change; a few hundred rows is nothing to redo.
  const converted = useMemo(
    () => (analysis ? convertSheet(analysis, course, formName) : null),
    [analysis, formName, course],
  );
  const questionCount = analysis?.columns.filter((column) => QUESTION_ROLES.includes(column.role)).length ?? 0;
  const sectionReport = useMemo(
    () => (analysis && mode === "advanced" ? buildSectionReport(analysis, sections, assignment, course) : null),
    [analysis, mode, sections, assignment, course],
  );
  const unassigned = analysis
    ? analysis.columns.filter((column) => QUESTION_ROLES.includes(column.role) && !sections.some((section) => section.id === assignment[column.index])).length
    : 0;
  const canDownload = mode === "advanced" ? Boolean(sectionReport?.sections.length) : Boolean(converted && questionCount > 0);

  const upload = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/training-plan/evaluation-converter/read", {
        method: "POST",
        body,
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t("อ่านไฟล์ไม่สำเร็จ", "Could not read the file"));
      setFileName(result.fileName);
      setAnalysis(analyseSheet(result.rows));
      // Every course has its own form, so the grouping always starts empty and is HRD's to make.
      setSections([{ id: `s-${Date.now()}`, name: "" }]);
      setAssignment({});
    } catch (cause) {
      setAnalysis(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const setRole = (index: number, role: ColumnRole) =>
    setAnalysis((current) =>
      current && {
        ...current,
        columns: current.columns.map((column) => (column.index === index ? { ...column, role } : column)),
      },
    );

  const download = async () => {
    if (!canDownload) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/training-plan/evaluation-converter/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "advanced" ? { mode, report: sectionReport } : converted),
        credentials: "include",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? t("สร้างไฟล์ไม่สำเร็จ", "Could not build the file"));
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `Evaluation ${course.courseName || formName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (window.opener) window.close();
    else router.push("/training-record/training-record");
  };

  const summary = converted?.summary ?? null;

  return (
    <main className={results.page}>
      <div className={results.topBar}>
        <button type="button" className={results.backButton} onClick={goBack}>
          ← {t("ย้อนกลับ", "Back")}
        </button>
      </div>

      <div className={results.layout}>
        <section className={`${results.main} ${styles.scrollMain}`}>
          <header className={results.header}>
            <div>
              <p className={results.kicker}>Evaluation converter</p>
              <h1>{t("แปลงผลแบบประเมินเป็นกราฟ", "Turn evaluation results into charts")}</h1>
              <p className={results.formName}>
                {t(
                  "นำไฟล์ Excel จาก Google Form หรือ Microsoft Form มาสร้างเป็นไฟล์ Excel แบบกราฟให้อัตโนมัติ ระบบไม่บันทึกไฟล์หรือข้อมูลใด ๆ",
                  "Upload an Excel file from Google Forms or Microsoft Forms and get a chart workbook back. Nothing is saved.",
                )}
              </p>
            </div>
            {summary?.isAnonymous ? (
              <span className={results.anonymousTag}>
                <Lock size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                {t("ไม่ระบุตัวตน", "Anonymous")}
              </span>
            ) : null}
          </header>

          <div className={styles.modeSwitch} role="radiogroup" aria-label={t("โหมด", "Mode")}>
            <button type="button" role="radio" aria-checked={mode === "simple"} onClick={() => setMode("simple")}>
              <strong>{t("โหมดธรรมดา", "Simple")}</strong>
              <span>{t("กราฟข้อละ 1 กราฟ แสดงสัดส่วนคำตอบ", "One chart per question, answer split")}</span>
            </button>
            <button type="button" role="radio" aria-checked={mode === "advanced"} onClick={() => setMode("advanced")}>
              <strong>{t("โหมด Advanced", "Advanced")}</strong>
              <span>{t("กำหนด Section เอง · กราฟค่าเฉลี่ยตาม Section แบบฟอร์มบริษัท", "Your own sections · average per section, company layout")}</span>
            </button>
          </div>

          {mode === "advanced" ? (
            <details className={styles.guide} open>
              <summary>{t("วิธีใช้โหมด Advanced และข้อจำกัด", "How Advanced mode works, and its limits")}</summary>
              <p className={styles.guideHeading}>{t("ขั้นตอน", "Steps")}</p>
              <ul className={styles.guideSteps}>
                <li>{t("อัปโหลดไฟล์คำตอบ .xlsx หรือ .csv ที่ export จาก Microsoft Forms หรือ Google Forms", "Upload the .xlsx or .csv response export from Microsoft Forms or Google Forms.")}</li>
                <li>{t("ตรวจช่อง \"ใช้เป็น\" ของทุกคอลัมน์ ระบบเดาให้แล้ว แต่ควรเช็กว่าคอลัมน์ชื่อ นามสกุล รหัสพนักงาน บริษัท และคำถามคะแนน 1-5 ถูกต้อง", "Check \"Use as\" for every column. It is guessed, but confirm name, surname, employee code, company and the 1-5 rating questions.")}</li>
                <li>{t("ในข้อ 3 สร้าง Section และตั้งชื่อ เช่น \"Part 2 : ความพึงพอใจต่อวิทยากร\" ชื่อนี้จะเป็นหัวกราฟในไฟล์ Excel", "In step 3, add and name sections, e.g. \"Part 2 : Instructor\". The name becomes the chart title in Excel.")}</li>
                <li>{t("กลับไปที่ตารางข้อ 2 แล้วเลือก Section ให้คำถามทีละข้อ ระบบไม่จัดให้อัตโนมัติ เพราะแต่ละคอร์สใช้แบบฟอร์มต่างกัน", "Back in the step 2 table, pick a section for each question. Nothing is grouped for you, because every course uses a different form.")}</li>
                <li>{t("ดูตัวอย่างในข้อ 4 กรอกหัวรายงานด้านขวา แล้วกดดาวน์โหลด", "Check the preview in step 4, fill in the report header on the right, then download.")}</li>
              </ul>
              <p className={styles.guideHeading}>{t("ข้อจำกัดที่ควรรู้", "Limits to know")}</p>
              <ul className={styles.guideLimits}>
                <li>{t("คำถามที่ไม่ได้เลือก Section จะไม่อยู่ในไฟล์ Excel เลย", "A question with no section is left out of the workbook entirely.")}</li>
                <li>{t("จำนวน Section และจำนวนคำถามไม่จำกัด กราฟจะสูงตามจำนวนข้อ และขึ้นหน้าใหม่เองเมื่อหน้าเต็ม", "No limit on sections or questions: a chart grows with its question count and moves to a new page when the page is full.")}</li>
                <li>{t("คำถามประเภทคะแนน: 1 Section ได้ 1 กราฟ แต่ละแท่งคือค่าเฉลี่ยของคำถาม 1 ข้อ (เต็ม 5) คำตอบที่ไม่ใช่ตัวเลขไม่นับในค่าเฉลี่ย", "Rating questions: one chart per section, one bar per question showing its average (out of 5). Non-numeric answers are not averaged.")}</li>
                <li>{t("คำถามประเภทข้อความ: หน้ารายงานแสดงข้อละ 5 คำตอบแรก ตัดที่ 90 ตัวอักษร ส่วนคำตอบทั้งหมดอยู่ในชีต 02-Comment", "Written questions: the report page shows the first 5 answers per question, cut at 90 characters. Every answer is on the 02-Comment sheet.")}</li>
                <li>{t("คำถามแบบตัวเลือก: ไม่มีกราฟในโหมดนี้ คำตอบอยู่แค่ในชีต 01-Database ถ้าต้องการกราฟสัดส่วนคำตอบ ให้ใช้โหมดธรรมดา", "Choice questions: no chart in this mode, answers only on 01-Database. Use Simple mode for an answer-split chart.")}</li>
                <li>{t("Section ที่มีแต่คำถามข้อความจะไม่มีกราฟ มีแค่ส่วนความคิดเห็น", "A section with only written questions gets no chart, only the comments block.")}</li>
                <li>{t("ลำดับกราฟเป็นไปตามลำดับ Section ในข้อ 3 และลำดับคำถามใน Section เป็นไปตามลำดับคอลัมน์ในไฟล์", "Charts follow the section order in step 3; questions inside a section follow the file's column order.")}</li>
                <li>{t("กราฟวงกลมนับตามคอลัมน์บริษัท", "The company doughnut counts the company column.")}</li>
                <li>{t("ระบบไม่ได้บันทึกข้อมูลใดๆลงฐานข้อมูล", "Nothing is saved to the database.")}</li>
              </ul>
            </details>
          ) : null}

          <div className={styles.step}>
            <h2>1. {t("ไฟล์คำตอบ", "Response file")}</h2>
            <label className={styles.dropZone} data-busy={busy || undefined}>
              <Upload size={22} />
              <span>
                {fileName
                  ? t(`ไฟล์: ${fileName} · กดเพื่อเปลี่ยนไฟล์`, `File: ${fileName} · click to change`)
                  : t("กดเพื่อเลือกไฟล์ .xlsx หรือ .csv", "Click to choose an .xlsx or .csv file")}
              </span>
              <input
                type="file"
                accept=".xlsx,.csv"
                disabled={busy}
                onChange={(event) => {
                  void upload(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            {analysis ? (
              <p className={results.note}>
                {SOURCE_LABELS[analysis.source]
                  ? t(`ตรวจพบไฟล์จาก ${SOURCE_LABELS[analysis.source]} · `, `Detected ${SOURCE_LABELS[analysis.source]} · `)
                  : ""}
                {t(
                  `${analysis.rows.length} คำตอบ · ${questionCount} คำถาม`,
                  `${analysis.rows.length} responses · ${questionCount} questions`,
                )}
              </p>
            ) : null}
          </div>

          {analysis ? (
            <div className={styles.step}>
              <h2>2. {t("ตรวจสอบคอลัมน์", "Check the columns")}</h2>
              <p className={results.note}>
                {t(
                  "ระบบเดาประเภทของแต่ละคอลัมน์ให้แล้ว ถ้าไม่ถูกต้องเลือกใหม่ได้ กราฟด้านล่างจะเปลี่ยนตามทันที",
                  "Each column's type has been guessed. Change any that are wrong; the charts below follow.",
                )}
              </p>
              <div className={styles.columnTableWrap}>
                <table className={styles.columnTable}>
                  <thead>
                    <tr>
                      <th>{t("หัวคอลัมน์ในไฟล์", "Column in the file")}</th>
                      <th>{t("ใช้เป็น", "Use as")}</th>
                      {mode === "advanced" ? <th>Section</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.columns.map((column) => (
                      <tr key={column.index} data-question={QUESTION_ROLES.includes(column.role) || undefined}>
                        <td>{column.header}</td>
                        <td>
                          <select value={column.role} onChange={(event) => setRole(column.index, event.target.value as ColumnRole)}>
                            {COLUMN_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {t(ROLE_LABELS[role].th, ROLE_LABELS[role].en)}
                              </option>
                            ))}
                          </select>
                        </td>
                        {mode === "advanced" ? (
                          <td>
                            {QUESTION_ROLES.includes(column.role) ? (
                              <select
                                value={sections.some((section) => section.id === assignment[column.index]) ? assignment[column.index] : ""}
                                data-missing={!sections.some((section) => section.id === assignment[column.index]) || undefined}
                                onChange={(event) => assign(column.index, event.target.value)}
                              >
                                <option value="">{t("-- ยังไม่จัด --", "-- Not assigned --")}</option>
                                {sections.map((section, index) => (
                                  <option key={section.id} value={section.id}>
                                    {section.name.trim() || t(`Section ${index + 1} (ยังไม่ตั้งชื่อ)`, `Section ${index + 1} (unnamed)`)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className={styles.muted}>-</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {analysis && mode === "advanced" ? (
            <div className={styles.step}>
              <h2>3. {t("กำหนด Section", "Sections")}</h2>
              <p className={results.note}>
                {t(
                  "ตั้งชื่อ Section (เช่น Part 2 : ความพึงพอใจ) แล้วเลือก Section ให้แต่ละคำถามในตารางด้านบน ชื่อ Section จะเป็นหัวกราฟ คำถามคะแนนเป็นแท่งค่าเฉลี่ย คำถามข้อความไปอยู่ในส่วนความคิดเห็น",
                  "Name each section (e.g. Part 2 : Satisfaction), then pick a section for every question above. The name titles the chart; ratings become average bars, written answers go to comments.",
                )}
              </p>
              <div className={styles.sectionList}>
                {sections.map((section, index) => {
                  const count = Object.values(assignment).filter((id) => id === section.id).length;
                  return (
                    <div key={section.id} className={styles.sectionRow}>
                      <span className={styles.sectionNumber}>{index + 1}</span>
                      <input
                        value={section.name}
                        placeholder={t("ชื่อ Section", "Section name")}
                        onChange={(event) => renameSection(section.id, event.target.value)}
                      />
                      <span className={styles.muted}>{t(`${count} ข้อ`, `${count} questions`)}</span>
                      <button type="button" className={styles.linkButton} onClick={() => removeSection(section.id)}>
                        {t("ลบ", "Remove")}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className={styles.sectionActions}>
                <button type="button" className={styles.linkButton} onClick={addSection}>
                  + {t("เพิ่ม Section", "Add section")}
                </button>
              </div>
              {unassigned > 0 ? (
                <p className={styles.warning} role="status">
                  {t(
                    `ยังมี ${unassigned} คำถามที่ไม่ได้จัดเข้า Section และจะไม่อยู่ในรายงาน`,
                    `${unassigned} question(s) have no section and will be left out of the report`,
                  )}
                </p>
              ) : null}
           </div>
          ) : null}

          {sectionReport ? (
            <div className={styles.step}>
              <h2>4. {t("ตัวอย่างผลลัพธ์", "Preview")}</h2>
              <div className={results.tiles}>
                <article className={results.tile}>
                  <div>
                    <span>{t("การตอบกลับ", "Responses")}</span>
                    <strong>{sectionReport.respondents.length}</strong>
                  </div>
                  <Users size={26} className={results.tileIcon} />
                </article>
                <article className={results.tile}>
                  <div>
                    <span>{t("บริษัทที่ตอบ", "Companies")}</span>
                    <strong>{sectionReport.companies.length}</strong>
                  </div>
                  <FileSpreadsheet size={26} className={results.tileIcon} />
                </article>
              </div>
              {sectionReport.sections.length === 0 ? (
                <p className={results.note}>{t("ยังไม่มีคำถามที่ถูกจัดเข้า Section", "No question is in a section yet")}</p>
              ) : (
                <div className={styles.questionStack}>
                  {sectionReport.sections.map((section, sectionIndex) => {
                    const ratings = section.questions.filter((question) => question.kind === "RATING");
                    const texts = section.questions.filter((question) => question.kind === "TEXT");
                    return (
                      <article key={sectionIndex} className={results.questionCard}>
                        <div className={results.questionHead}>
                          <strong className={styles.sectionTitle}>{section.name}</strong>
                        </div>
                        {ratings.length ? (
                          <div className={styles.averageBars}>
                            {ratings.map((question, index) => (
                              <div key={index} className={styles.averageRow}>
                                <span className={styles.averageLabel}>{question.header}</span>
                                <span className={styles.averageTrack}>
                                  <span
                                    className={styles.averageFill}
                                    style={{ width: `${((question.average ?? 0) / 5) * 100}%`, background: `var(--chart-${(index % 6) + 1})` }}
                                  />
                                </span>
                                <strong>{question.average?.toFixed(2) ?? "-"}</strong>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {texts.map((question, index) => {
                          const written = question.answers.filter((answer): answer is string => typeof answer === "string");
                          return (
                            <div key={index} className={styles.commentBlock}>
                              <p className={styles.commentQuestion}>
                                {question.header} <span className={styles.muted}>· {t(`${written.length} คำตอบ`, `${written.length} answers`)}</span>
                              </p>
                              {written.slice(0, 3).map((answer, answerIndex) => (
                                <p key={answerIndex} className={styles.commentAnswer}>&ldquo;{answer}&rdquo;</p>
                              ))}
                            </div>
                          );
                        })}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {summary && mode === "simple" ? (
            <div className={styles.step}>
              <h2>3. {t("ตัวอย่างผลลัพธ์", "Preview")}</h2>
              <div className={results.tiles}>
                <article className={results.tile}>
                  <div>
                    <span>{t("การตอบกลับ", "Responses")}</span>
                    <strong>{summary.submittedCount}</strong>
                  </div>
                  <Users size={26} className={results.tileIcon} />
                </article>
                <article className={results.tile}>
                  <div>
                    <span>{t("เวลาเฉลี่ยในการตอบ", "Average time to answer")}</span>
                    <strong>{formatAnswerTime(summary.averageAnswerSeconds, t)}</strong>
                  </div>
                  <Clock size={26} className={results.tileIcon} />
                </article>
                <article className={results.tile}>
                  <div>
                    <span>{t("บริษัทที่ตอบ", "Companies")}</span>
                    <strong>{summary.respondentsByCompany.length}</strong>
                  </div>
                  <FileSpreadsheet size={26} className={results.tileIcon} />
                </article>
              </div>

              {questionCount === 0 ? (
                <p className={results.note}>{t("ยังไม่มีคอลัมน์ที่เป็นคำถาม", "No column is set as a question yet")}</p>
              ) : (
                <div className={styles.questionStack}>
                  {summary.questions.map((question) => (
                    <article key={question.questionId} className={results.questionCard}>
                      <div className={results.questionHead}>
                        <strong>
                          {question.questionOrder}. {question.questionText}
                        </strong>
                      </div>
                      <p className={results.answeredBy}>{t(`ตอบ ${question.answeredBy} คน`, `${question.answeredBy} answered`)}</p>
                      {question.questionType === "RATING" ? <RatingChart question={question} isThai={language === "th"} /> : null}
                      {question.options.length > 0 ? <ChoiceChart question={question} /> : null}
                      <TextAnswers question={question} onOpen={() => undefined} isThai={language === "th"} />
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>

        <aside className={results.insights}>
          <h2>{t("หัวรายงานและดาวน์โหลด", "Report header and download")}</h2>

          <div className={results.insightBlock}>
            <p className={results.insightLabel}>{t("เชื่อมกับคอร์ส (ไม่บังคับ)", "Link to a course (optional)")}</p>
            <SearchableSelect
              value={planId}
              onChange={chooseCourse}
              placeholder={t("ค้นหาคอร์ส...", "Search courses...")}
              options={[
                { value: "", label: t("-- ไม่เชื่อมกับคอร์ส --", "-- Not linked --") },
                ...plans.map((plan) => ({
                  value: plan.rollingId,
                  label: `[${plan.course.code}] ${plan.course.name}`,
                  secondaryLabel: `${plan.trainingDate.slice(0, 10)}${plan.batch ? ` · ${t("รุ่น", "Batch")} ${plan.batch}` : ""}`,
                })),
              ]}
            />
          </div>

          <div className={`${results.insightBlock} ${styles.headerFields}`}>
            <p className={results.insightLabel}>{t("ข้อมูลหัวรายงาน", "Report header")}</p>
            <label>
              <span>{t("ชื่อคอร์ส", "Course name")}</span>
              <input value={header.courseName} onChange={(event) => setHeader({ ...header, courseName: event.target.value })} />
            </label>
            <div className={styles.dateRow}>
              <label>
                <span>{t("วันที่เริ่ม", "Start")}</span>
                <input type="date" value={header.startDate} onChange={(event) => setHeader({ ...header, startDate: event.target.value })} />
              </label>
              <label>
                <span>{t("วันที่สิ้นสุด", "End")}</span>
                <input type="date" value={header.endDate} onChange={(event) => setHeader({ ...header, endDate: event.target.value })} />
              </label>
            </div>
            <label>
              <span>{t("สถานที่", "Venue")}</span>
              <input value={header.venue} onChange={(event) => setHeader({ ...header, venue: event.target.value })} />
            </label>
            <label>
              <span>{t("วิทยากร", "Instructor")}</span>
              <input value={header.instructor} onChange={(event) => setHeader({ ...header, instructor: event.target.value })} />
            </label>
          </div>

          <div className={results.insightBlock}>
            <button
              type="button"
              className={results.insightAction}
              disabled={!canDownload || busy}
              onClick={() => void download()}
            >
              <FileSpreadsheet size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {mode === "advanced"
                ? t("ดาวน์โหลด Excel แบบฟอร์มบริษัท", "Download company-layout workbook")
                : t("ดาวน์โหลด Excel แบบกราฟ", "Download chart workbook")}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
