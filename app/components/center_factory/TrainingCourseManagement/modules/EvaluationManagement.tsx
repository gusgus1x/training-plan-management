"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { listCompanies } from "../../../../lib/companies/client";
import type { CompanyRecord } from "../../../../lib/companies/types";
import {
  deleteEvaluation,
  listEvaluations,
  setEvaluationStatus,
  updateEvaluation,
} from "../../../../lib/evaluations/client";
import type {
  EvaluationQuestionType,
  EvaluationRecord,
  EvaluationRowType,
  EvaluationStatus,
  EvaluationTiming,
  EvaluationWriteInput,
} from "../../../../lib/evaluations/types";
import { legacySectionBreakPoints, legacySectionTitleAt } from "../../../../lib/evaluations/legacySections";
import { isFormBlockType, type FormBlockType } from "../../../../lib/formBlocks";
import FormPreviewRunner, { type PreviewItem, type PreviewKind } from "./FormPreviewRunner";
import SearchableSelect from "../../../SearchableSelect";
import TypewriterLoader from "../../../TypewriterLoader";
import styles from "./EvaluationManagement.module.css";
import { Building2, Eye, Star } from "../../../icons/LucideIcons";

export const evaluationManagementModule = {
  title: "Evaluation Management",
  subtitle: "Evaluation form",
  description: "Build post-training and follow-up evaluation forms for employees and managers.",
} as const;

type TimingLabel = "After Training" | "30-Day Follow-up";
type StatusLabel = "Draft" | "Published" | "Inactive";
/** The question type is stored as the API value, not a display label. The old label vocabulary had
 *  only three entries and mapped both ways, so MULTIPLE_CHOICE and LONG_TEXT were rewritten as
 *  SINGLE_CHOICE/SHORT_TEXT the moment a stored question was opened here and saved again. */
const QUESTION_TYPE_LABELS: Record<EvaluationQuestionType, string> = {
  RATING: "Rating (1-5)",
  SINGLE_CHOICE: "Single Choice (ตอบได้ 1 ข้อ)",
  MULTIPLE_CHOICE: "Multiple Choice (ตอบได้หลายข้อ)",
  SHORT_TEXT: "Short Text (ข้อความสั้น)",
  LONG_TEXT: "Long Text (ข้อความยาว)",
  MULTIPLE_CHOICE_GRID: "Multiple Choice Grid (ตารางกริดหลายตัวเลือก)",
  CHECKBOX_GRID: "Checkbox Grid (ตารางกริดทำเครื่องหมาย)",
};
const isChoiceType = (value: EvaluationRowType) => value === "SINGLE_CHOICE" || value === "MULTIPLE_CHOICE";
type Feedback = { tone: "success" | "error" | "info"; message: string };
type DraftQuestion = {
  id: string;
  prompt: string;
  type: EvaluationRowType;
  required: boolean;
  options: string[];
  /** Body of a TEXT_BLOCK, sub-caption of a SECTION_BREAK. */
  description: string;
  /** SECTION_BREAK only: the default "after this section" target, or null to fall through. */
  nextSection: number | null;
  /** Per-option branch targets, parallel to `options`. SINGLE_CHOICE only. */
  optionTargets: (number | null)[];
  /** Grid questions only. Rows and columns are kept apart here and merged into one axis-tagged
   *  option list at save time, which is how the database stores them. */
  gridRows: string[];
  gridColumns: string[];
};

const key = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Choice questions accept any option count from two upwards (see handleAddQuestion's check and
 *  app/lib/evaluations validation); four is only the count a brand-new question starts with. */
const MIN_OPTIONS = 2;
const DEFAULT_OPTION_COUNT = 4;
const blankOptions = (count = DEFAULT_OPTION_COUNT) => Array.from({ length: count }, () => "");

const blankQuestion = (): DraftQuestion => ({
  id: key(),
  prompt: "",
  type: "RATING",
  required: true,
  options: blankOptions(),
  description: "",
  nextSection: null,
  optionTargets: blankOptions().map(() => null),
  gridRows: ["", ""],
  gridColumns: ["", ""],
});

/** A section break or a text block: a title, an optional body, and never an answer. */
const blankBlock = (type: FormBlockType): DraftQuestion => ({
  ...blankQuestion(),
  type,
  prompt: type === "SECTION_BREAK" ? "Untitled section" : "Untitled text",
  required: false,
  options: [],
  optionTargets: [],
});

/** Draft rows to the shape the live preview runner takes. RATING has no stored options in the
 *  draft - the five-point scale is synthesised at save time - so it is rendered as a rating. */
const toPreviewItems = (rows: DraftQuestion[]): PreviewItem[] => rows.map((row) => {
  const kind: PreviewKind =
    row.type === "SECTION_BREAK" ? "section"
      : row.type === "TEXT_BLOCK" ? "note"
        : row.type === "RATING" ? "rating"
          : row.type === "MULTIPLE_CHOICE_GRID" ? "grid"
            : row.type === "CHECKBOX_GRID" ? "gridMulti"
              : row.type === "MULTIPLE_CHOICE" ? "multiple"
                : row.type === "SINGLE_CHOICE" ? "single"
                  : "text";
  if (kind === "grid" || kind === "gridMulti") {
    return {
      id: row.id,
      kind,
      text: row.prompt,
      description: null,
      isRequired: row.required,
      nextSection: null,
      options: [
        ...row.gridRows.filter((label) => label.trim()).map((label, index) => ({
          id: `${row.id}-r${index}`, text: label, nextSection: null, axis: "ROW" as const,
        })),
        ...row.gridColumns.filter((label) => label.trim()).map((label, index) => ({
          id: `${row.id}-c${index}`, text: label, nextSection: null, axis: "COLUMN" as const,
        })),
      ],
    };
  }
  return {
    id: row.id,
    kind,
    text: row.prompt,
    description: row.description || null,
    isRequired: row.required,
    nextSection: row.nextSection,
    options: kind === "single" || kind === "multiple"
      ? row.options
          .map((option, index) => ({ option, target: row.optionTargets[index] ?? null }))
          .filter(({ option }) => option.trim())
          .map(({ option, target }, index) => ({
            id: `${row.id}-${index}`,
            text: option,
            nextSection: kind === "single" ? target : null,
          }))
      : [],
  };
});

// The *Label types are what the form shows; the Evaluation* types are what the API stores. These
// pairs are the only place the two vocabularies meet, so each side is typed for the direction it
// actually carries.
const timingFromApi = (value: EvaluationTiming): TimingLabel => value === "AFTER_TRAINING" ? "After Training" : "30-Day Follow-up";
const statusFromApi = (value: EvaluationStatus): StatusLabel => value === "DRAFT" ? "Draft" : value === "PUBLISHED" ? "Published" : "Inactive";

const toDraftQuestions = (record: EvaluationRecord): DraftQuestion[] => {
  const rows: DraftQuestion[] = record.questions.map((question) => ({
    id: question.evaluationQuestionId,
    prompt: question.questionText,
    type: question.questionType,
    required: question.isRequired,
    description: question.questionDescription ?? "",
    nextSection: question.nextSection,
    // Not truncated to 4 any more: a question stored with more options used to lose the extras as
    // soon as it was opened here, and saving wrote the shortened list back.
    options: isChoiceType(question.questionType)
      ? (() => {
          const stored = question.options.map((option) => option.optionText);
          return stored.length >= MIN_OPTIONS ? stored : [...stored, ...blankOptions()].slice(0, MIN_OPTIONS);
        })()
      : blankOptions(),
    optionTargets: isChoiceType(question.questionType)
      ? question.options.map((option) => option.nextSection)
      : [],
    // Stored as one axis-tagged list; split back into the two the editor works with.
    gridRows: question.options.filter((option) => option.axis === "ROW").map((option) => option.optionText),
    gridColumns: question.options.filter((option) => option.axis === "COLUMN").map((option) => option.optionText),
  }));

  // Old forms grouped questions with a section_name label instead of real breaks. Convert on open
  // so the grouping survives the next save, which deletes and recreates every row.
  const hasRealSections = rows.some((row) => row.type === "SECTION_BREAK");
  if (hasRealSections) return rows;
  const points = legacySectionBreakPoints(record.questions);
  if (!points.length) return rows;

  const converted: DraftQuestion[] = [];
  rows.forEach((row, index) => {
    if (points.includes(index)) {
      converted.push({ ...blankBlock("SECTION_BREAK"), prompt: legacySectionTitleAt(record.questions, index) });
    }
    converted.push(row);
  });
  return converted;
};

/** Turned off at the user's request, matching Assessment. Flip to true to bring the button back. */
const SHOW_CSV_EXPORT = false;

const csvCell = (value: string | number | boolean) => `"${String(value).replaceAll('"', '""')}"`;
const createEvaluationCsv = (items: EvaluationRecord[]) => [
  ["Code", "Evaluation Name", "Timing", "Scope", "Company", "Anonymous", "Questions", "Required Questions", "Status", "Updated At"],
  ...items.map((item) => [
    item.formCode,
    item.formName,
    timingFromApi(item.timing),
    item.scope === "CENTRAL" ? "Central" : "Company",
    item.companyCode ?? "-",
    item.isAnonymous,
    item.questions.length,
    item.questions.filter((question) => question.isRequired).length,
    statusFromApi(item.status),
    item.updatedAt ?? item.createdAt,
  ]),
].map((row) => row.map(csvCell).join(",")).join("\r\n");

export default function EvaluationManagement() {
  const user = useAuthenticatedUser();
  const router = useRouter();
  const confirm = useConfirm();
  const isFactory = user?.roleCode === "HRD_FACTORY";
  const [items, setItems] = useState<EvaluationRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [openDetailId, setOpenDetailId] = useState("");
  const [detailAsLearner, setDetailAsLearner] = useState(false);
  const [search, setSearch] = useState("");
  /** Company code, or "CENTRAL". Center users only - a Factory list is already narrowed server-side. */
  const [companyFilter, setCompanyFilter] = useState("");
  /** Tracks the CLOSED groups: a block that has just appeared should be open, which an "open list"
   *  would get backwards. */
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const toggleGroup = (code: string) =>
    setClosedGroups((current) => current.includes(code) ? current.filter((entry) => entry !== code) : [...current, code]);
  const toast = useToast();
  const setFeedback = useCallback(
    (next: Feedback | null) => {
      if (next) toast[next.tone](next.message);
    },
    [toast],
  );
  const [busy, setBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const bySearch = query ? items.filter((item) => [item.formCode, item.formName, item.companyCode, timingFromApi(item.timing), statusFromApi(item.status)].filter(Boolean).join(" ").toLowerCase().includes(query)) : items;
    // "CENTRAL" is its own bucket rather than a company - a central form has no companyCode.
    return companyFilter
      ? bySearch.filter((item) => companyFilter === "CENTRAL" ? item.companyCode === null : item.companyCode === companyFilter)
      : bySearch;
  }, [items, search, companyFilter]);

  /** Central first, then one block per company - the same grouping Course Master uses. */
  const groupedVisible = useMemo(() => {
    const groups = new Map<string, EvaluationRecord[]>();
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
          ? "แบบประเมินส่วนกลาง (HRD Center)"
          : `แบบประเมินบริษัท [${code}] ${(companies.find((company) => company.companyCode === code)?.companyNameTh ?? "").replace(/^บริษัท\s*/, "")}`.trim(),
        isOwn: code === "CENTRAL" ? !isFactory : code === user?.companyCode,
        rows,
      }));
  }, [visible, companies, isFactory, user?.companyCode]);

  const load = useCallback(async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const [evaluationResult, companyResult] = await Promise.all([
        listEvaluations(),
        isFactory ? Promise.resolve({ items: [] as CompanyRecord[] }) : listCompanies(),
      ]);
      setItems(evaluationResult.items);
      setCompanies(companyResult.items);
      setSelectedId((current) => evaluationResult.items.some((item) => item.evaluationFormId === current) ? current : "");
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to load evaluations" });
    } finally {
      setBusy(false);
      setIsLoading(false);
    }
  }, [isFactory, setFeedback]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const removeTargetItem = async (item: EvaluationRecord) => {
    if (!item.canModify) return;
    if (
      !(await confirm({
        message: {
          th: `ยืนยันที่จะลบแบบประเมิน "${item.formName}" หรือไม่?`,
          en: `Confirm deleting evaluation "${item.formName}"?`,
        },
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setFeedback(null);
    try {
      await deleteEvaluation(item.evaluationFormId);
      setItems((current) => current.filter((i) => i.evaluationFormId !== item.evaluationFormId));
      if (selectedId === item.evaluationFormId) setSelectedId("");
      setFeedback({ tone: "success", message: "Evaluation deleted." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to delete evaluation" });
    } finally {
      setBusy(false);
    }
  };

  const handlePublishItem = async (item: EvaluationRecord) => {
    if (!item.canModify) return;
    const draftQs = toDraftQuestions(item);
    if (!draftQs.length) {
      setFeedback({ tone: "error", message: "Add at least one question before publishing." });
      return;
    }
    if (!draftQs.some((q) => q.required)) {
      setFeedback({ tone: "error", message: "Published evaluations need at least one required question." });
      return;
    }
    if (
      !(await confirm({
        message: {
          th: `ยืนยันที่จะเผยแพร่แบบประเมิน "${item.formName}" หรือไม่? เมื่อเผยแพร่แล้วจะถูกเลือกใช้ในหลักสูตรได้ทันที`,
          en: `Confirm publishing evaluation "${item.formName}"? It becomes selectable on courses immediately.`,
        },
      }))
    )
      return;
    setBusy(true);
    setFeedback(null);
    try {
      const publishInput: EvaluationWriteInput = {
        scope: item.scope,
        companyId: item.companyId,
        formCode: item.formCode,
        formName: item.formName,
        description: item.description,
        timing: item.timing,
        respondentType: item.respondentType,
        isAnonymous: item.isAnonymous,
        status: "PUBLISHED",
        // Status-only publish: every question is echoed back exactly as stored, blocks and branch
        // targets included, so nothing is rewritten on the way through.
        questions: item.questions.map((question) => ({
          questionText: question.questionText,
          questionType: question.questionType,
          sectionName: question.sectionName,
          questionDescription: question.questionDescription,
          nextSection: question.nextSection,
          isRequired: question.isRequired,
          options: question.options.map((option) => ({
            optionText: option.optionText,
            optionValue: option.optionValue,
            nextSection: option.nextSection,
            axis: option.axis,
          })),
        })),
      };
      const updated = (await updateEvaluation(item.evaluationFormId, publishInput)).evaluation;
      setItems((current) => current.map((i) => (i.evaluationFormId === updated.evaluationFormId ? updated : i)));
      setFeedback({ tone: "success", message: `Published evaluation "${item.formName}".` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to publish evaluation" });
    } finally {
      setBusy(false);
    }
  };

  /** Whether this user owns the form, independent of whether it is in use. canModify folds the two
   *  together, but retiring a form is allowed on one already in use. */
  const canOwn = (item: EvaluationRecord) =>
    !isFactory || (item.companyId !== null && item.companyId === (user?.companyId ?? null));

  /** Retiring or re-publishing. Allowed on a form already in use - it changes no content, and a
   *  form published by mistake must not be permanent. */
  const changeStatus = async (item: EvaluationRecord, status: EvaluationStatus) => {
    const retiring = status === "INACTIVE";
    if (!(await confirm({
      message: {
        th: retiring
          ? `ยืนยันที่จะปิดใช้งานแบบประเมิน "${item.formName}" หรือไม่? หลักสูตรจะเลือกใช้ชุดนี้ใหม่ไม่ได้ คำตอบที่มีอยู่ยังอยู่ครบ`
          : `ยืนยันที่จะเปิดใช้งานแบบประเมิน "${item.formName}" อีกครั้งหรือไม่?`,
        en: retiring ? `Retire evaluation "${item.formName}"?` : `Re-publish evaluation "${item.formName}"?`,
      },
      danger: retiring,
    }))) return;
    setBusy(true);
    try {
      const saved = (await setEvaluationStatus(item.evaluationFormId, status)).evaluation;
      setItems((current) => current.map((row) => row.evaluationFormId === saved.evaluationFormId ? saved : row));
      setFeedback({ tone: "success", message: retiring ? "ปิดใช้งานแบบประเมินแล้ว" : "เปิดใช้งานแบบประเมินแล้ว" });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "เปลี่ยนสถานะไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    if (!visible.length) return setFeedback({ tone: "error", message: "There are no evaluations to export." });
    const url = URL.createObjectURL(new Blob(["\uFEFF", createEvaluationCsv(visible)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `evaluation-export-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px", padding: "40px" }}>
        <TypewriterLoader label="กำลังโหลดข้อมูลแบบประเมิน (Evaluation)..." />
      </div>
    );
  }

  return (
    <section className={styles.page} aria-label="Evaluation Management">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{evaluationManagementModule.subtitle}</p>
          <h2>{evaluationManagementModule.title}</h2>
          <p>{evaluationManagementModule.description}</p>
        </div>
      </section>
      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <span className={styles.listMeta}>
            {visible.length} / {items.length} แบบประเมิน
          </span>
          <input
            aria-label="Search evaluation"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหารหัส, ชื่อแบบประเมิน, ช่วงเวลา, ผู้ตอบ, ขอบเขต, สถานะ..."
          />
          {!isFactory ? (
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
          <button
            className={styles.primaryButton}
            type="button"
            disabled={busy}
            onClick={() => router.push("/forms/evaluation")}
          >
            + เพิ่มแบบประเมิน
          </button>
          <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void load()}>
            รีเฟรช
          </button>
          {SHOW_CSV_EXPORT ? (
            <button className={styles.secondaryButton} type="button" onClick={handleExport}>
              ส่งออก CSV
            </button>
          ) : null}
        </div>
        {!visible.length ? (
          <div className={styles.emptyState}>
            {busy ? "Loading evaluations..." : "No evaluations yet. Select New to create the first form."}
          </div>
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
          <table className={styles.evaluationTable}>
            <thead>
              <tr>
                <th>รหัสแบบประเมิน</th>
                <th>ชื่อแบบประเมิน</th>
                <th>ช่วงเวลา</th>
                <th>ขอบเขต</th>
                <th>จำนวนคำถาม</th>
                <th>สถานะ</th>
                <th style={{ textAlign: "right" }}>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
                  {group.rows.map((item) => {
                const isSelected = item.evaluationFormId === selectedId;
                const isOpen = item.evaluationFormId === openDetailId;
                const draftQuestions = toDraftQuestions(item);
                const status = statusFromApi(item.status);
                const statusClass =
                  status === "Published"
                    ? styles.statusPublished
                    : status === "Draft"
                      ? styles.statusDraft
                      : styles.statusInactive;
                return (
                  <Fragment key={item.evaluationFormId}>
                    <tr
                      aria-selected={isSelected}
                      tabIndex={0}
                      className={`${styles.selectableRow} ${isSelected ? styles.selectedRow : ""}`}
                      onClick={() => {
                        setSelectedId(isSelected ? "" : item.evaluationFormId);
                        setOpenDetailId("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(isSelected ? "" : item.evaluationFormId);
                          setOpenDetailId("");
                        }
                      }}
                    >
                      <td>{item.formCode}</td>
                      <td>{item.formName}</td>
                      <td>{timingFromApi(item.timing)}</td>
                      <td>{item.scope === "CENTRAL" ? "Central" : `Company · ${item.companyCode}`}</td>
                      <td>{item.questions.length}</td>
                      {/* The pill IS the switch - see Assessment. A DRAFT keeps the plain badge. */}
                      <td onClick={(event) => event.stopPropagation()}>
                        {item.status !== "DRAFT" && canOwn(item) ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.status === "PUBLISHED"}
                            aria-label={item.status === "PUBLISHED" ? "ปิดใช้งานแบบประเมินนี้" : "เปิดใช้งานแบบประเมินนี้"}
                            title={item.status === "PUBLISHED" ? "กดเพื่อปิดใช้งาน" : "กดเพื่อเปิดใช้งาน"}
                            className={`${styles.statusPill} ${statusClass} ${styles.statusToggle}`}
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation();
                              void changeStatus(item, item.status === "PUBLISHED" ? "INACTIVE" : "PUBLISHED");
                            }}
                          >
                            <span className={styles.statusToggleKnob} aria-hidden="true" />
                            <span>{status}</span>
                          </button>
                        ) : (
                          <span className={`${styles.statusPill} ${statusClass}`}>{status}</span>
                        )}
                      </td>
                      <td className={styles.actionCell} onClick={(event) => event.stopPropagation()}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                          <button
                            className={styles.detailButton}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(item.evaluationFormId);
                              setOpenDetailId(isOpen ? "" : item.evaluationFormId);
                              setDetailAsLearner(false);
                            }}
                          >
                            {isOpen ? "Hide" : "Preview"}
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
                            title={item.canModify ? "" : item.isUsed ? "ถูกใช้งานแล้ว แก้ไขไม่ได้ — ปิดใช้งานหรือใช้เป็นแม่แบบแทน" : "แบบประเมินของส่วนกลาง ดูได้อย่างเดียว"}
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/forms/evaluation/${item.evaluationFormId}`);
                            }}
                          >
                            แก้ไข
                          </button>
                          <button
                            className={styles.dangerButton}
                            type="button"
                            style={{ whiteSpace: "nowrap", padding: "3px 8px", fontSize: "0.74rem" }}
                            disabled={busy || !item.canModify}
                            title={item.canModify ? "" : item.isUsed ? "ถูกผูกกับหลักสูตร/แผนอบรม หรือมีพนักงานตอบไปแล้ว ลบไม่ได้" : "แบบประเมินของส่วนกลาง ดูได้อย่างเดียว"}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(item.evaluationFormId);
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
                        <td colSpan={8}>
                          <div className={styles.detailPanel}>
                            <div className={styles.panelHeader}>
                              <div>
                                <p className={styles.kicker}>{detailAsLearner ? "Try it as a learner" : "Evaluation preview"}</p>
                                <h3>{item.formName}</h3>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <button
                                  type="button"
                                  className={styles.secondaryButton}
                                  aria-label={detailAsLearner ? "กลับไปมุมมองผู้จัดทำ" : "ทดลองตอบแบบผู้เรียน"}
                                  title={detailAsLearner ? "กลับไปมุมมองผู้จัดทำ" : "ทดลองตอบแบบผู้เรียน"}
                                  onClick={() => setDetailAsLearner((current) => !current)}
                                >
                                  <Eye size={16} />
                                </button>
                                <button className={styles.closeButton} type="button" onClick={() => setOpenDetailId("")}>
                                  Close
                                </button>
                              </div>
                            </div>
                            <div className={styles.detailMeta}>
                              <article>
                                <span>Timing</span>
                                <strong>{timingFromApi(item.timing)}</strong>
                              </article>
                              <article>
                                <span>Scope</span>
                                <strong>{item.companyCode ?? "All companies"}</strong>
                              </article>
                              <article>
                                <span>Response identity</span>
                                <strong>{item.isAnonymous ? "Anonymous" : "Identified"}</strong>
                              </article>
                            </div>
                            {detailAsLearner ? (
                              <FormPreviewRunner
                                title={item.formName}
                                instructions={item.description}
                                meta={timingFromApi(item.timing)}
                                items={toPreviewItems(draftQuestions)}
                                emptyLabel="ยังไม่มีคำถามให้ทดลองตอบ"
                              />
                            ) : draftQuestions.length ? (
                              <div className={styles.questionList}>
                                {draftQuestions.map((detail, index) => (
                                  <article key={detail.id} data-block={isFormBlockType(detail.type) ? detail.type : undefined}>
                                    <strong>
                                      {/* Blocks are not questions, so they take no number - otherwise
                                          a form with two sections reads as having two extra items. */}
                                      {isFormBlockType(detail.type)
                                        ? detail.prompt
                                        : `${draftQuestions.slice(0, index + 1).filter((row) => !isFormBlockType(row.type)).length}. ${detail.prompt}`}
                                    </strong>
                                    <span>
                                      {isFormBlockType(detail.type)
                                        ? (detail.type === "SECTION_BREAK" ? "Section" : "Text")
                                        : QUESTION_TYPE_LABELS[detail.type as EvaluationQuestionType]}
                                    </span>
                                    {isFormBlockType(detail.type) && detail.description.trim()
                                      ? <p className={styles.blockBodyStatic}>{detail.description}</p>
                                      : null}
                                    {isChoiceType(detail.type)
                                      ? detail.options.filter(Boolean).map((option, optionIndex) => (
                                          <p key={`${detail.id}-${optionIndex}`}>
                                            {String.fromCharCode(65 + optionIndex)}. {option}
                                          </p>
                                        ))
                                      : null}
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <div className={styles.emptyState}>No questions yet.</div>
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
    </section>
  );
}
