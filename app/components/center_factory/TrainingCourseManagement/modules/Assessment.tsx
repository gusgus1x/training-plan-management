"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import {
  createAssessmentVersion,
  deleteAssessment,
  listAssessments,
  setAssessmentStatus,
  updateAssessment,
} from "../../../../lib/assessments/client";
import type {
  AssessmentChoiceInput,
  AssessmentQuestionInput,
  AssessmentRecord,
  AssessmentStatus,
  AssessmentWriteInput,
} from "../../../../lib/assessments/types";
import { listCompanies } from "../../../../lib/companies/client";
import type { CompanyRecord } from "../../../../lib/companies/types";
import { isFormBlockType } from "../../../../lib/formBlocks";
import { isGridType, parseCorrectColumns } from "../../../../lib/formGrids";
import FormPreviewRunner, { type PreviewItem, type PreviewKind } from "./FormPreviewRunner";
import SearchableSelect from "../../../SearchableSelect";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./Assessment.module.css";
import { Building2, Check, Eye, Star } from "../../../icons/LucideIcons";

export const assessmentModule = {
  title: "Assessment",
  subtitle: "Pre / Post Test",
  description: "Manage versioned assessment series and question banks stored in SQL Server.",
} as const;

type Feedback = { tone: "success" | "error" | "info"; message: string };
type DraftChoice = AssessmentChoiceInput & { id: string };
/**
 * The stored value itself, not a UI-only label. The editor used to carry "Choice" | "Text" and map
 * both ways, which quietly rewrote every MULTIPLE_CHOICE and TRUE_FALSE question as SINGLE_CHOICE
 * (and dropped all but the first correct answer) the moment somebody edited and saved it. The DB
 * has always allowed all four - CK_RC2_assessment_question_question_type_enum - so the draft now
 * holds exactly what will be written back.
 */
type AssessmentQuestionType = AssessmentQuestionInput["questionType"];

/**
 * Author-facing summary of a grid: rows down, columns across, a tick on each correct cell and the
 * row's points on the right.
 *
 * Listing a grid's choices flat (A. B. C. ...) the way an ordinary question's are runs the rows and
 * the columns together into one alphabetised list, which says nothing about which column is correct
 * for which row - the only thing the author actually needs to check.
 */
const renderGridSummary = (
  choices: ReadonlyArray<{ id?: string; choiceId?: string; choiceText: string; axis: string | null; correctColumns: string | null; optionScore: string | number }>,
  pointsLabel: string,
) => {
  const rows = choices.filter((choice) => choice.axis === "ROW");
  const columns = choices.filter((choice) => choice.axis === "COLUMN");
  const keyOf = (choice: { id?: string; choiceId?: string }) => choice.id ?? choice.choiceId ?? "";
  return (
    <div className={styles.gridPreviewScroll}>
      <table className={styles.gridPreviewTable}>
        <thead>
          <tr>
            <th />
            {columns.map((column) => <th key={keyOf(column)}>{column.choiceText}</th>)}
            <th>{pointsLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const correct = parseCorrectColumns(row.correctColumns);
            return (
              <tr key={keyOf(row)}>
                <th scope="row">{row.choiceText}</th>
                {columns.map((column, columnIndex) => (
                  <td key={keyOf(column)} data-correct={correct.includes(columnIndex + 1)}>
                    {correct.includes(columnIndex + 1) ? <Check size={14} style={{ display: "inline-block" }} /> : null}
                  </td>
                ))}
                <td>{Number(row.optionScore)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const CHOICE_TYPES: AssessmentQuestionType[] = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"];
const isChoiceType = (type: AssessmentQuestionType) => CHOICE_TYPES.includes(type);

type DraftQuestion = Omit<AssessmentQuestionInput, "choices" | "questionType"> & {
  id: string;
  questionType: AssessmentQuestionType;
  choices: DraftChoice[];
};

const key = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** The server (app/lib/assessments/validation.ts) accepts any choice count from two upwards, and
 *  the DB stores them as ordered rows with no cap - the old fixed four was a UI-only rule that
 *  forced a true/false question to carry two empty options. */
const MIN_CHOICES = 2;
const DEFAULT_CHOICE_COUNT = 4;

const blankChoice = (isCorrect = false): DraftChoice => ({
  id: key(),
  choiceText: "",
  isCorrect,
  optionScore: isCorrect ? "1" : "0",
  nextSection: null,
  axis: null,
  correctColumns: null,
});
const blankChoices = (count = DEFAULT_CHOICE_COUNT): DraftChoice[] =>
  Array.from({ length: count }, (_, index) => blankChoice(index === 0));

const toDraftQuestions = (record: AssessmentRecord): DraftQuestion[] =>
  record.questions.map((question) => {
    // The stored type is kept as-is. It used to be squashed into "Choice"/"Text" here and written
    // back as SINGLE_CHOICE/SHORT_ANSWER, so editing a MULTIPLE_CHOICE or TRUE_FALSE question
    // silently changed its type. Choices are no longer truncated to 4 either.
    const questionType = question.questionType;
    const storedChoices = question.choices.map((choice) => ({
      id: choice.choiceId,
      choiceText: choice.choiceText,
      // Every correct flag survives now. The old version kept only the first one, which quietly
      // destroyed the other correct answers of a MULTIPLE_CHOICE question.
      isCorrect: isChoiceType(questionType) && choice.isCorrect,
      optionScore: choice.optionScore,
      nextSection: choice.nextSection,
      axis: choice.axis,
      correctColumns: choice.correctColumns,
    }));
    const choices = isChoiceType(questionType)
      ? storedChoices.length >= MIN_CHOICES
        ? storedChoices
        : [...storedChoices, ...blankChoices()].slice(0, MIN_CHOICES)
      : [];
    // A single-answer question with nothing marked correct cannot be saved, so fall back to the
    // first option rather than handing the editor a state its own validation rejects.
    if (
      (questionType === "SINGLE_CHOICE" || questionType === "TRUE_FALSE") &&
      choices.length > 0 &&
      !choices.some((choice) => choice.isCorrect)
    ) {
      choices[0] = { ...choices[0], isCorrect: true };
    }
    return {
      id: question.questionId,
      questionText: question.questionText,
      questionType,
      questionScore: question.questionScore,
      questionDescription: question.questionDescription,
      nextSection: question.nextSection,
      isRequired: question.isRequired,
      choices,
    };
  });

/**
 * Draft rows to the shape the live preview runner takes.
 *
 * Note what is NOT carried across: isCorrect and optionScore. The learner never sees either, so a
 * preview that had access to them could drift into flattering the form. PreviewItem has nowhere to
 * put them, which makes that impossible rather than merely discouraged.
 */
const toPreviewItems = (rows: DraftQuestion[]): PreviewItem[] => rows.map((row) => {
  const kind: PreviewKind =
    row.questionType === "SECTION_BREAK" ? "section"
      : row.questionType === "TEXT_BLOCK" ? "note"
        : row.questionType === "MULTIPLE_CHOICE_GRID" ? "grid"
          : row.questionType === "CHECKBOX_GRID" ? "gridMulti"
            : row.questionType === "MULTIPLE_CHOICE" ? "multiple"
              : row.questionType === "SHORT_ANSWER" ? "text"
                : "single";
  return {
    id: row.id,
    kind,
    text: row.questionText || "(ยังไม่ได้ใส่คำถาม)",
    description: row.questionDescription || null,
    isRequired: row.isRequired,
    nextSection: row.nextSection,
    // A grid carries its rows and columns in the same choice list, tagged by axis.
    options: isGridType(row.questionType)
      ? row.choices.map((choice) => ({
          id: choice.id,
          text: choice.choiceText || "(ยังไม่ได้ใส่ข้อความ)",
          nextSection: null,
          axis: choice.axis,
        }))
      : isChoiceType(row.questionType)
        ? row.choices.map((choice) => ({
            id: choice.id,
            text: choice.choiceText || "(ยังไม่ได้ใส่ตัวเลือก)",
            nextSection: row.questionType === "SINGLE_CHOICE" ? choice.nextSection : null,
          }))
        : [],
  };
});

const displayQuestionType = (value: AssessmentRecord["questions"][number]["questionType"]) =>
  value === "SECTION_BREAK" ? "Section" : value === "TEXT_BLOCK" ? "Text block" : value === "SHORT_ANSWER" ? "Text" : "Choice";

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
/** Turned off at the user's request until the export is actually wanted. The builder below stays -
 *  flipping this back on is the whole change. */
const SHOW_CSV_EXPORT = false;

const createAssessmentCsv = (items: AssessmentRecord[]) => [
  ["Code", "Name", "Scope", "Company", "Purpose", "Version", "Pass Score", "Questions", "Status", "Updated At"],
  ...items.map((item) => [
    item.seriesCode,
    item.seriesName,
    item.scope,
    item.companyCode ?? "Central",
    item.purpose,
    item.versionNo,
    item.passingScorePercent,
    item.questions.length,
    item.status,
    item.updatedAt ?? item.createdAt,
  ]),
].map((row) => row.map(csvCell).join(",")).join("\r\n");

/** A stored assessment echoed back as write input - every question exactly as stored, blocks and
 *  branch targets included, so a status-only save or a new version rewrites nothing. */
const toWriteInput = (item: AssessmentRecord, status: AssessmentStatus, versionNote = item.versionNote): AssessmentWriteInput => ({
  scope: item.scope,
  companyId: item.companyId,
  seriesCode: item.seriesCode,
  seriesName: item.seriesName,
  purpose: item.purpose,
  versionNote,
  instructions: item.instructions,
  passingScorePercent: String(item.passingScorePercent),
  timeLimitMinutes: item.timeLimitMinutes,
  status,
  questions: item.questions.map((q) => ({
    questionText: q.questionText,
    questionType: q.questionType,
    questionScore: String(q.questionScore),
    questionDescription: q.questionDescription,
    nextSection: q.nextSection,
    isRequired: q.isRequired,
    choices: q.choices.map((c) => ({
      choiceText: c.choiceText,
      isCorrect: c.isCorrect,
      optionScore: String(c.optionScore),
      nextSection: c.nextSection,
      axis: c.axis,
      correctColumns: c.correctColumns,
    })),
  })),
});

export default function Assessment() {
  const user = useAuthenticatedUser();
  const router = useRouter();
  const confirm = useConfirm();
  const isCenter = user?.roleCode === "HRD_CENTER";
  const [items, setItems] = useState<AssessmentRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [detailAsLearner, setDetailAsLearner] = useState(false);

  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  // Escape hatch for the strings the DOM-walking dictionary cannot reach: those with
  // interpolated counts, and those that must differ per language rather than be translated.
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);
  // Same call shape as the old banner state, routed to the global toast instead.
  const setFeedback = useCallback(
    (next: Feedback | null) => {
      if (next) toast[next.tone](next.message);
    },
    [toast],
  );
  /** Company code, or "CENTRAL" for the central bucket. Center users only - a Factory user's list
   *  is already narrowed to their own company plus central by the server. */
  const [companyFilter, setCompanyFilter] = useState("");
  /** Tracks the CLOSED groups, not the open ones: a company block that has just appeared (a new
   *  assessment, a cleared filter) should be open, which an "open list" would get backwards. */
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const toggleGroup = (code: string) =>
    setClosedGroups((current) => current.includes(code) ? current.filter((entry) => entry !== code) : [...current, code]);

  const selected = useMemo(
    () => items.find((item) => item.assessmentId === selectedId) ?? null,
    [items, selectedId],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const bySearch = query
      ? items.filter((item) => [item.seriesCode, item.seriesName, item.companyCode, item.purpose, item.status]
        .filter(Boolean).join(" ").toLowerCase().includes(query))
      : items;
    // "CENTRAL" is its own bucket rather than a company: a central assessment has no companyCode,
    // and Center users need to be able to isolate exactly those.
    return companyFilter
      ? bySearch.filter((item) => companyFilter === "CENTRAL" ? item.companyCode === null : item.companyCode === companyFilter)
      : bySearch;
  }, [items, search, companyFilter]);

  /** The list is grouped the way Course Master groups courses: central first, then one block per
   *  company. Grouping here rather than in the table keeps the row loop a straight map. */
  const groupedVisible = useMemo(() => {
    const groups = new Map<string, AssessmentRecord[]>();
    for (const item of visible) {
      const key = item.companyCode ?? "CENTRAL";
      const bucket = groups.get(key);
      if (bucket) bucket.push(item); else groups.set(key, [item]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a === "CENTRAL" ? -1 : b === "CENTRAL" ? 1 : a.localeCompare(b))
      .map(([code, rows]) => ({
        code,
        label: code === "CENTRAL"
          ? "แบบทดสอบส่วนกลาง (HRD Center)"
          : `แบบทดสอบบริษัท [${code}] ${(companies.find((company) => company.companyCode === code)?.companyNameTh ?? "").replace(/^บริษัท\s*/, "")}`.trim(),
        isOwn: code === "CENTRAL" ? isCenter : code === user?.companyCode,
        rows,
      }));
  }, [visible, companies, isCenter, user?.companyCode]);

  const load = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const [assessmentResult, companyResult] = await Promise.all([
        listAssessments(),
        listCompanies(),
      ]);
      setItems(assessmentResult.items);
      setCompanies(companyResult.items);
      setSelectedId((current) => assessmentResult.items.some((item) => item.assessmentId === current) ? current : "");
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to load assessments" });
    } finally {
      setBusy(false);
      setIsLoading(false);
    }
  }, [setFeedback]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const removeTargetItem = async (targetItem: AssessmentRecord) => {
    if (!targetItem.canModify) return;
    if (!(await confirm({ message: { th: `ยืนยันที่จะลบแบบทดสอบ "${targetItem.seriesName}" หรือไม่?`, en: `Confirm deleting assessment "${targetItem.seriesName}"?` }, danger: true }))) return;
    setBusy(true);
    try {
      await deleteAssessment(targetItem.assessmentId);
      if (selectedId === targetItem.assessmentId) setSelectedId("");
      if (openDetailId === targetItem.assessmentId) setOpenDetailId("");
      await load();
      setFeedback({ tone: "success", message: "Assessment deleted." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete assessment" });
    } finally {
      setBusy(false);
    }
  };

  const handlePublishItem = async (item: AssessmentRecord) => {
    if (!item.canModify) return;
    if (!item.questions.length) {
      setFeedback({ tone: "error", message: "Add at least one question before publishing." });
      return;
    }
    if (
      !(await confirm({
        message: {
          th: `ยืนยันที่จะเผยแพร่แบบทดสอบ "${item.seriesName}" หรือไม่? เมื่อเผยแพร่แล้วจะถูกเลือกใช้เป็น Pre/Post Test ในหลักสูตรได้ทันที`,
          en: `Confirm publishing assessment "${item.seriesName}"? It becomes selectable on courses immediately.`,
        },
      }))
    )
      return;
    setBusy(true);
    setFeedback(null);
    try {
      const updated = (await updateAssessment(item.assessmentId, toWriteInput(item, "ACTIVE"))).assessment;
      setItems((current) => current.map((i) => (i.assessmentId === updated.assessmentId ? updated : i)));
      setFeedback({ tone: "success", message: `Published assessment "${item.seriesName}".` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to publish assessment" });
    } finally {
      setBusy(false);
    }
  };

  /** Copies the stored version into a new DRAFT, then carries on in the builder. */
  const startVersion = async () => {
    if (!selected?.canCreateVersion) return;
    if (!(await confirm({ message: {
      th: `ยืนยันที่จะสร้างเวอร์ชันใหม่ของแบบทดสอบ "${selected.seriesName}" หรือไม่?`,
      en: `Create a new version of assessment "${selected.seriesName}"?`,
    } }))) return;
    setBusy(true);
    try {
      const created = (await createAssessmentVersion(
        selected.assessmentId,
        toWriteInput(selected, "DRAFT", `New version from v${selected.versionNo}`),
      )).assessment;
      router.push(`/forms/assessment/${created.assessmentId}`);
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to create a new version" });
      setBusy(false);
    }
  };

  const remove = async () => {
    if (selected) await removeTargetItem(selected);
  };

  /** A greyed-out button with no explanation reads as a broken screen. These are the reasons the
   *  toolbar actually disables one. */
  const disabledReason = (action: "edit" | "version") => {
    if (!selected) return "เลือกแบบทดสอบจากตารางด้านล่างก่อน";
    if (action === "version") {
      if (selected.status === "DRAFT") return "แบบทดสอบยังเป็นฉบับร่าง แก้ไขฉบับนี้ได้เลย ไม่ต้องสร้างเวอร์ชันใหม่";
      return selected.canCreateVersion ? "" : "แบบทดสอบนี้อยู่นอกขอบเขตของคุณ";
    }
    if (selected.isUsed) return "แบบทดสอบนี้ถูกผูกกับหลักสูตร/แผนอบรม หรือมีพนักงานทำไปแล้ว แก้ไขและลบไม่ได้ — ปิดใช้งานได้ หรือสร้างเวอร์ชันใหม่";
    return selected.canModify ? "" : "แบบทดสอบนี้อยู่นอกขอบเขตของคุณ หรือไม่ใช่เวอร์ชันล่าสุด";
  };

  /** Retiring or re-activating. Allowed even on an assessment already in use - it changes no
   *  content, and a form published by mistake must not be permanent. */
  const changeStatus = async (item: AssessmentRecord, status: AssessmentStatus) => {
    const retiring = status === "INACTIVE";
    if (!(await confirm({
      message: {
        th: retiring
          ? `ยืนยันที่จะปิดใช้งานแบบทดสอบ "${item.seriesName}" หรือไม่? หลักสูตรจะเลือกใช้ชุดนี้ใหม่ไม่ได้ ผลที่พนักงานทำไปแล้วยังอยู่ครบ`
          : `ยืนยันที่จะเปิดใช้งานแบบทดสอบ "${item.seriesName}" อีกครั้งหรือไม่?`,
        en: retiring ? `Retire assessment "${item.seriesName}"?` : `Re-activate assessment "${item.seriesName}"?`,
      },
      danger: retiring,
    }))) return;
    setBusy(true);
    try {
      const saved = (await setAssessmentStatus(item.assessmentId, status)).assessment;
      setItems((current) => current.map((row) => row.assessmentId === saved.assessmentId ? saved : row));
      setFeedback({ tone: "success", message: retiring ? "ปิดใช้งานแบบทดสอบแล้ว" : "เปิดใช้งานแบบทดสอบแล้ว" });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (!visible.length) return setFeedback({ tone: "error", message: "There are no assessments to export." });
    const url = URL.createObjectURL(new Blob(["\uFEFF", createAssessmentCsv(visible)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `assessment-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px", padding: "40px" }}>
        <TypewriterLoader label="กำลังโหลดข้อมูลแบบทดสอบ (Assessment)..." />
      </div>
    );
  }

  return <section className={styles.page} aria-label="Assessment management">
    <section className={styles.hero}><div><p className={styles.kicker}>{assessmentModule.subtitle}</p><h2>{assessmentModule.title}</h2><p>{assessmentModule.description}</p></div></section>
    <section className={styles.workspace}>
      <div className={styles.toolbar}>
        <span className={styles.listMeta}>{visible.length} / {items.length} แบบทดสอบ</span>
        <input aria-label="Search assessment" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหารหัส, ชื่อแบบทดสอบ, บริษัท, วัตถุประสงค์, สถานะ..." />
        {isCenter ? (
          <div style={{ flex: "1 1 240px", minWidth: "220px" }}>
            <SearchableSelect
              value={companyFilter}
              onChange={setCompanyFilter}
              placeholder="เลือกบริษัท / Select company"
              options={[
                { value: "", label: "ทุกบริษัท (All companies)" },
                { value: "CENTRAL", label: "ส่วนกลาง (Central)" },
                ...companies.map((company) => ({
                  value: company.companyCode,
                  label: company.companyCode,
                  secondaryLabel: company.companyNameTh,
                })),
              ]}
            />
          </div>
        ) : null}
        {/* The gallery, not the panel below: making a form is its own screen now. */}
        <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => router.push("/forms/assessment")}>+ เพิ่มแบบทดสอบ</button>
        <button className={styles.secondaryButton} type="button" disabled={busy || !selected?.canModify} onClick={() => selected && router.push(`/forms/assessment/${selected.assessmentId}`)} title={disabledReason("edit")}>แก้ไข</button>
        <button className={styles.secondaryButton} type="button" disabled={busy || !selected?.canCreateVersion} onClick={() => void startVersion()} title={disabledReason("version")}>สร้างเวอร์ชันใหม่</button>
        <button className={styles.dangerButton} type="button" disabled={busy || !selected?.canModify} onClick={() => void remove()} title={disabledReason("edit")}>ลบ</button>
        <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void load()}>รีเฟรช</button>
        {SHOW_CSV_EXPORT ? <button className={styles.secondaryButton} type="button" onClick={exportCsv}>ส่งออก CSV</button> : null}
      </div>
      {!visible.length ? (
        <div className={styles.emptyState}>{busy ? "กำลังโหลดข้อมูลแบบทดสอบ..." : "ไม่พบรายการแบบทดสอบ"}</div>
      ) : null}
      <div className={styles.companyDirectory}>
        {groupedVisible.map((group) => {
          const groupOpen = !closedGroups.includes(group.code);
          const compKey = (group.code || "").toUpperCase();
          const compClass = styles[`companyGroup_${compKey}`] || "";
          return (
          <section className={`${styles.companyGroup} ${compClass} ${groupOpen ? styles.openGroup : ""}`} key={`group-${group.code}`}>
            <button
              className={styles.companyHeader}
              type="button"
              aria-expanded={groupOpen}
              onClick={() => toggleGroup(group.code)}
            >
              <span className={styles.chevron} aria-hidden="true" />
              <span aria-hidden="true">{group.code === "CENTRAL" ? <Building2 size={16} /> : <Building2 size={16} />}</span>
              <strong>{group.label}</strong>
              {group.isOwn ? <em className={styles.ownCompanyTag}><Star size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> ของฉัน</em> : <span />}
              <small>{group.rows.length} ชุด</small>
            </button>
            {groupOpen ? (
            <div className={styles.tableWrap}>
        <table className={styles.assessmentTable}>
          <thead>
            <tr>
              <th>รหัสแบบทดสอบ</th>
              <th>ชื่อแบบทดสอบ</th>
              <th>ขอบเขต</th>
              <th>วัตถุประสงค์</th>
              <th>เวอร์ชัน</th>
              <th>เกณฑ์ผ่าน</th>
              <th>จำนวนคำถาม</th>
              <th>สถานะ</th>
              <th style={{ textAlign: "right" }}>การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
                {group.rows.map((item) => {
              const isSelected = item.assessmentId === selectedId;
              const isOpen = item.assessmentId === openDetailId;
              const statusClass =
                item.status === "ACTIVE"
                  ? styles.statusPublished
                  : item.status === "DRAFT"
                    ? styles.statusDraft
                    : styles.statusInactive;
              return (
                <Fragment key={item.assessmentId}>
                  <tr
                    aria-selected={isSelected}
                    tabIndex={0}
                    className={`${styles.selectableRow} ${isSelected ? styles.selectedRow : ""}`}
                    onClick={() => {
                      setSelectedId(isSelected ? "" : item.assessmentId);
                      setOpenDetailId("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(isSelected ? "" : item.assessmentId);
                        setOpenDetailId("");
                      }
                    }}
                  >
                    <td>{item.seriesCode}</td>
                    <td>{item.seriesName}</td>
                    <td>{item.companyCode ?? "Central"}</td>
                    <td>{item.purpose}</td>
                    <td>v{item.versionNo}</td>
                    <td>{item.passingScorePercent}%</td>
                    <td>{item.questions.length}</td>
                    {/* The pill IS the switch: its status dot grows into the sliding knob, so the
                        row carries one status control instead of a badge next to a toggle. A DRAFT
                        keeps the plain badge - publishing it goes through the เผยแพร่ button. */}
                    <td onClick={(event) => event.stopPropagation()}>
                      {item.status !== "DRAFT" && item.canCreateVersion ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.status === "ACTIVE"}
                          aria-label={item.status === "ACTIVE" ? "ปิดใช้งานแบบทดสอบนี้" : "เปิดใช้งานแบบทดสอบนี้"}
                          title={item.status === "ACTIVE" ? "กดเพื่อปิดใช้งาน" : "กดเพื่อเปิดใช้งาน"}
                          className={`${styles.statusPill} ${statusClass} ${styles.statusToggle}`}
                          disabled={busy}
                          onClick={(event) => {
                            event.stopPropagation();
                            void changeStatus(item, item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
                          }}
                        >
                          <span className={styles.statusToggleKnob} aria-hidden="true" />
                          <span>{item.status}</span>
                        </button>
                      ) : (
                        <span className={`${styles.statusPill} ${statusClass}`}>{item.status}</span>
                      )}
                    </td>
                    <td className={styles.actionCell} onClick={(event) => event.stopPropagation()}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          className={styles.detailButton}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(item.assessmentId);
                            setOpenDetailId(isOpen ? "" : item.assessmentId);
                            setDetailAsLearner(false);
                          }}
                        >
                          {isOpen ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                        </button>
                        {item.status === "DRAFT" ? (
                          <button
                            className={styles.primaryButton}
                            type="button"
                            style={{ whiteSpace: "nowrap", padding: "3px 8px", fontSize: "0.74rem" }}
                            disabled={busy || !item.canModify}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handlePublishItem(item);
                            }}
                          >
                            เผยแพร่
                          </button>
                        ) : null}
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          style={{ whiteSpace: "nowrap", padding: "3px 8px", fontSize: "0.74rem" }}
                          disabled={busy || !item.canModify}
                          title={item.canModify ? "" : item.isUsed ? "ถูกใช้งานแล้ว แก้ไขไม่ได้ — ปิดใช้งานหรือสร้างเวอร์ชันใหม่แทน" : "แบบทดสอบของส่วนกลาง ดูได้อย่างเดียว"}
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/forms/assessment/${item.assessmentId}`);
                          }}
                        >
                          แก้ไข
                        </button>
                        <button
                          className={styles.dangerButton}
                          type="button"
                          style={{ whiteSpace: "nowrap", padding: "3px 8px", fontSize: "0.74rem" }}
                          disabled={busy || !item.canModify}
                          title={item.canModify ? "" : item.isUsed ? "ถูกผูกกับหลักสูตร/แผนอบรม หรือมีพนักงานทำไปแล้ว ลบไม่ได้" : "แบบทดสอบของส่วนกลาง ดูได้อย่างเดียว"}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(item.assessmentId);
                            void removeTargetItem(item);
                          }}
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className={styles.detailRow}>
                      <td colSpan={9}>
                        <div className={styles.detailPanel}>
                          <div className={styles.panelHeader}>
                            <div>
                              <p className={styles.kicker}>
                                {detailAsLearner ? "Try it as a learner" : `${item.scope} · ${item.purpose} · v${item.versionNo}`}
                              </p>
                              <h3>{item.seriesName}</h3>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {!detailAsLearner ? <span>{item.isUsed ? "Locked — already in use" : "Unused"}</span> : null}
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                aria-label={detailAsLearner ? "กลับไปมุมมองผู้จัดทำ" : "ทดลองตอบแบบผู้เรียน"}
                                title={detailAsLearner ? "กลับไปมุมมองผู้จัดทำ" : "ทดลองตอบแบบผู้เรียน"}
                                onClick={() => setDetailAsLearner((current) => !current)}
                              ><Eye size={16} /></button>
                            </div>
                          </div>
                          {/* Mirrors TrainingFormRunner: no correct-answer markers, no per-question score. */}
                          {detailAsLearner ? (
                            item.questions.length ? (
                              <FormPreviewRunner
                                title={item.seriesName}
                                instructions={item.instructions}
                                meta={[
                                  item.timeLimitMinutes ? `${item.timeLimitMinutes} นาที` : null,
                                  `เกณฑ์ผ่าน ${item.passingScorePercent || 0}%`,
                                ].filter(Boolean).join(" · ")}
                                items={toPreviewItems(toDraftQuestions(item))}
                              />
                            ) : (
                              <div className={styles.emptyState}>{t("ยังไม่มีคำถามให้แสดงตัวอย่าง", "No questions to preview yet")}</div>
                            )
                          ) : (
                            <>
                              <p>{item.instructions || "No instructions"}</p>
                              {item.questions.length ? (
                                <div className={styles.questionList}>
                                  {item.questions.map((detail, index) => {
                                    const isBlock = isFormBlockType(detail.questionType);
                                    return (
                                    <article key={detail.questionId} data-block={isBlock ? detail.questionType : undefined}>
                                      <strong>
                                        {/* Blocks are not questions: no number, and no "0 points",
                                            which is meaningless on a section heading. */}
                                        {isBlock
                                          ? detail.questionText
                                          : `${item.questions.slice(0, index + 1).filter((row) => !isFormBlockType(row.questionType)).length}. ${detail.questionText}`}
                                      </strong>
                                      <span>
                                        {isBlock
                                          ? displayQuestionType(detail.questionType)
                                          : `${displayQuestionType(detail.questionType)} · ${detail.questionScore} points`}
                                      </span>
                                      {isBlock && detail.questionDescription?.trim()
                                        ? <p className={styles.blockBodyStatic}>{detail.questionDescription}</p>
                                        : null}
                                      {isGridType(detail.questionType)
                                        ? renderGridSummary(detail.choices, t("คะแนน", "Points"))
                                        : null}
                                      {isGridType(detail.questionType) ? null : detail.choices.map((choice, choiceIndex) => (
                                        <p key={choice.choiceId}>
                                          {choice.isCorrect ? "[Correct] " : ""}
                                          {String.fromCharCode(65 + choiceIndex)}. {choice.choiceText}
                                        </p>
                                      ))}
                                    </article>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className={styles.emptyState}>This draft does not have questions yet.</div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
                })}
          </tbody>
        </table>
            </div>
            ) : null}
          </section>
          );
        })}
      </div>
    </section>
  </section>;
}
