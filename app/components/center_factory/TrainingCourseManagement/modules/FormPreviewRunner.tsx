"use client";

import { useMemo, useState } from "react";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import {
  resolveNextSection,
  splitSections,
  visitedItems,
  visitedPath,
  type FlowItem,
} from "../../../../lib/trainingForms/formFlow";
import styles from "./FormPreviewRunner.module.css";

/**
 * A live, answerable rehearsal of the form, for the person building it.
 *
 * It deliberately mirrors app/components/employee/TrainingFormRunner.tsx: same page-per-section
 * split, same branching, same required marks, same progress line. The flow arithmetic is literally
 * the same module (lib/trainingForms/formFlow), so a preview that walks a branch one way and a real
 * attempt that walks it another cannot happen.
 *
 * What it must never show is anything the learner would not see - no correct answers, no per-item
 * scores. That is enforced by the shape of PreviewItem rather than by remembering: correctness
 * simply has nowhere to live in it.
 *
 * Nothing here is submitted or stored. Answers are component state and vanish when it unmounts.
 */

export type PreviewKind = "single" | "multiple" | "text" | "rating" | "section" | "note" | "grid" | "gridMulti";

export type PreviewOption = {
  id: string;
  text: string;
  /** ROW / COLUMN on a grid question. */
  axis?: "ROW" | "COLUMN" | null;
  /** 1-based section to jump to when picked. Navigation only. */
  nextSection: number | null;
};

export type PreviewItem = {
  id: string;
  kind: PreviewKind;
  text: string;
  /** Body of a note, sub-caption of a section heading. */
  description: string | null;
  isRequired: boolean;
  /** Section breaks only: the default "after this section" target. */
  nextSection: number | null;
  options: PreviewOption[];
};

type FormPreviewRunnerProps = {
  title: string;
  instructions?: string | null;
  /** Small grey line under the title - time limit, pass mark, respondent type, whatever fits. */
  meta?: string | null;
  items: PreviewItem[];
  emptyLabel?: string;
};

type Answer = { choiceIds: string[]; text: string; rating: number | null; grid: Record<string, string[]> };
const emptyAnswer: Answer = { choiceIds: [], text: "", rating: null, grid: {} };

const isBlock = (kind: PreviewKind) => kind === "section" || kind === "note";
const isGrid = (kind: PreviewKind) => kind === "grid" || kind === "gridMulti";
const rowsOf = (item: PreviewItem) => item.options.filter((o) => o.axis === "ROW");
const colsOf = (item: PreviewItem) => item.options.filter((o) => o.axis === "COLUMN");

const isAnswered = (item: PreviewItem, answer: Answer | undefined) => {
  if (isBlock(item.kind) || !answer) return false;
  // Mirrors the real runner: a grid counts as answered only once every row has something.
  if (isGrid(item.kind)) return rowsOf(item).every((row) => (answer.grid[row.id] ?? []).length > 0);
  if (item.kind === "single" || item.kind === "multiple") return answer.choiceIds.length > 0;
  if (item.kind === "rating") return answer.rating !== null;
  return answer.text.trim().length > 0;
};

/** PreviewKind back to the raw question_type the flow helpers key on. */
const toFlowItems = (items: readonly PreviewItem[]): FlowItem[] =>
  items.map((item) => ({
    questionId: item.id,
    type: item.kind === "section" ? "SECTION_BREAK" : item.kind === "note" ? "TEXT_BLOCK" : item.kind,
    isRequired: item.isRequired,
    nextSection: item.nextSection,
    options: item.options.map((option) => ({ id: option.id, nextSection: option.nextSection })),
  }));

export default function FormPreviewRunner({
  title,
  instructions,
  meta,
  items,
  emptyLabel,
}: FormPreviewRunnerProps) {
  // Explicit t() rather than the DOM-walking dictionary: this component renders sentences with
  // interpolated counts, which the dictionary can only match as whole fixed strings.
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [requestedSection, setRequestedSection] = useState(1);
  const [finished, setFinished] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const selected = useMemo(
    () => Object.fromEntries(Object.entries(answers).map(([id, answer]) => [id, answer.choiceIds])),
    [answers],
  );
  const sections = useMemo(() => splitSections(toFlowItems(items)), [items]);
  const path = useMemo(() => visitedPath(sections, selected), [sections, selected]);

  // Derived, not synced in an effect: re-answering a branching question can drop the page the
  // author is standing on out of the path, and there must never be a render showing it.
  const sectionIndex = path.includes(requestedSection) ? requestedSection : path[path.length - 1] ?? 1;

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const pick = (ids: readonly string[]) =>
    ids.map((id) => byId.get(id)).filter((item): item is PreviewItem => Boolean(item));

  const current = pick((sections.find((section) => section.index === sectionIndex)?.items ?? []).map((i) => i.questionId));
  const walked = pick(visitedItems(sections, selected).map((i) => i.questionId));

  /** Numbering skips blocks, so a section heading does not consume a question number. */
  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    let next = 1;
    for (const item of items) if (!isBlock(item.kind)) map.set(item.id, next++);
    return map;
  }, [items]);

  const answeredCount = walked.filter((item) => isAnswered(item, answers[item.id])).length;
  const missingOnPage = current.filter((item) => item.isRequired && !isAnswered(item, answers[item.id]));
  const isLastSection = resolveNextSection(sections, sectionIndex, selected) === null;
  const positionInPath = path.indexOf(sectionIndex);

  const setAnswer = (id: string, patch: Partial<Answer>) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyAnswer), ...patch } }));

  const toggleChoice = (item: PreviewItem, optionId: string) =>
    setAnswers((prev) => {
      const answer = prev[item.id] ?? emptyAnswer;
      if (item.kind === "single") return { ...prev, [item.id]: { ...answer, choiceIds: [optionId] } };
      const already = answer.choiceIds.includes(optionId);
      return {
        ...prev,
        [item.id]: {
          ...answer,
          choiceIds: already ? answer.choiceIds.filter((id) => id !== optionId) : [...answer.choiceIds, optionId],
        },
      };
    });

  const toggleGridCell = (item: PreviewItem, rowId: string, columnId: string) =>
    setAnswers((prev) => {
      const answer = prev[item.id] ?? emptyAnswer;
      const picked = answer.grid[rowId] ?? [];
      const next = item.kind === "grid"
        ? [columnId]
        : picked.includes(columnId) ? picked.filter((id) => id !== columnId) : [...picked, columnId];
      return { ...prev, [item.id]: { ...answer, grid: { ...answer.grid, [rowId]: next } } };
    });

  const restart = () => {
    setAnswers({});
    setRequestedSection(1);
    setFinished(false);
    setShowMissing(false);
  };

  const advance = () => {
    // Gated by THIS page only, exactly as the real runner gates its Next button.
    if (missingOnPage.length > 0) {
      setShowMissing(true);
      return;
    }
    setShowMissing(false);
    if (isLastSection) {
      setFinished(true);
      return;
    }
    const next = resolveNextSection(sections, sectionIndex, selected);
    if (next !== null) setRequestedSection(next);
  };

  if (!items.length) {
    return (
      <div className={styles.empty}>
        {emptyLabel ?? t("ยังไม่มีคำถามให้ทดลองตอบ", "No questions to try yet")}
      </div>
    );
  }

  if (finished) {
    const answerable = walked.length;
    return (
      <div className={styles.frame}>
        <div className={styles.done}>
          <strong>{t("จบแบบฟอร์มแล้ว", "Form complete")}</strong>
          <p>
            {t(
              `ตอบไป ${answeredCount} จาก ${answerable} ข้อ · เดินผ่าน ${path.length} จาก ${sections.length} ส่วน`,
              `${answeredCount} of ${answerable} answered · walked ${path.length} of ${sections.length} sections`,
            )}
          </p>
          <p className={styles.note}>
            {t(
              "นี่เป็นการทดลองตอบเท่านั้น ไม่มีการบันทึกคำตอบและไม่มีการคิดคะแนน",
              "This is a practice run only - nothing is saved and nothing is scored.",
            )}
          </p>
          <button className={styles.primary} type="button" onClick={restart}>
            {t("เริ่มทดลองใหม่", "Try again")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.frame}>
      <div className={styles.head}>
        <strong>{title}</strong>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>

      {instructions?.trim() ? (
        <div className={styles.instructions}>
          <strong>{t("คำชี้แจง", "Instructions")}</strong>
          <p>{instructions}</p>
        </div>
      ) : null}

      <div className={styles.progressBox}>
        <div className={styles.progressText}>
          <span>{t("ความคืบหน้า", "Progress")}</span>
          <strong>
            {t(`ตอบแล้ว ${answeredCount} จาก ${walked.length} ข้อ`, `${answeredCount} of ${walked.length} answered`)}
          </strong>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={walked.length}
          aria-valuenow={answeredCount}
        >
          <div
            className={styles.progressFill}
            style={{ width: `${Math.round((answeredCount / Math.max(1, walked.length)) * 100)}%` }}
          />
        </div>
        {sections.length > 1 ? (
          // Denominator is every section on the form, not the visited count: a respondent expects
          // a page count that does not move under them as they answer.
          <p className={styles.sectionCounter}>
            {t(`ส่วนที่ ${sectionIndex} จาก ${sections.length}`, `Section ${sectionIndex} of ${sections.length}`)}
          </p>
        ) : null}
      </div>

      {current.map((item) => {
        const answer = answers[item.id];
        const missing = showMissing && missingOnPage.some((candidate) => candidate.id === item.id);

        if (isBlock(item.kind)) {
          return (
            <div className={styles.block} key={item.id} data-kind={item.kind}>
              <h4>{item.text}</h4>
              {item.description?.trim() ? <p>{item.description}</p> : null}
            </div>
          );
        }

        return (
          <article className={styles.card} key={item.id} data-missing={missing}>
            <div className={styles.cardHead}>
              <span className={styles.order}>{numbers.get(item.id)}.</span>
              <span>{item.text}</span>
              {item.isRequired ? <em className={styles.required}>*</em> : null}
            </div>

            {isGrid(item.kind) ? (
              <div className={styles.gridScroll}>
                <table className={styles.gridTable}>
                  <thead>
                    <tr>
                      <th />
                      {colsOf(item).map((column) => <th key={column.id} scope="col">{column.text}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsOf(item).map((row) => {
                      const picked = answer?.grid[row.id] ?? [];
                      return (
                        <tr key={row.id}>
                          <th scope="row">{row.text}</th>
                          {colsOf(item).map((column) => (
                            <td key={column.id}>
                              <input
                                type={item.kind === "grid" ? "radio" : "checkbox"}
                                name={`preview-${item.id}-${row.id}`}
                                aria-label={`${row.text} - ${column.text}`}
                                checked={picked.includes(column.id)}
                                onChange={() => toggleGridCell(item, row.id, column.id)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : item.kind === "single" || item.kind === "multiple" ? (
              <div className={styles.options}>
                {item.options.map((option) => (
                  <label key={option.id}>
                    <input
                      type={item.kind === "single" ? "radio" : "checkbox"}
                      name={`preview-${item.id}`}
                      checked={answer?.choiceIds.includes(option.id) ?? false}
                      onChange={() => toggleChoice(item, option.id)}
                    />
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>
            ) : item.kind === "rating" ? (
              <div className={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={styles.ratingBtn}
                    type="button"
                    data-active={answer?.rating === value}
                    onClick={() => setAnswer(item.id, { rating: value })}
                  >
                    {value}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                className={styles.text}
                rows={3}
                value={answer?.text ?? ""}
                placeholder={t("พิมพ์คำตอบที่นี่...", "Type your answer here...")}
                onChange={(event) => setAnswer(item.id, { text: event.target.value })}
              />
            )}

            {missing ? <p className={styles.missing}>{t("ต้องตอบข้อนี้", "This question is required")}</p> : null}
          </article>
        );
      })}

      <div className={styles.footer}>
        <button className={styles.secondary} type="button" onClick={restart}>
          {t("เริ่มใหม่", "Restart")}
        </button>
        {positionInPath > 0 ? (
          <button
            className={styles.secondary}
            type="button"
            onClick={() => { setShowMissing(false); setRequestedSection(path[positionInPath - 1]); }}
          >
            {t("ย้อนกลับ", "Back")}
          </button>
        ) : null}
        <button className={styles.primary} type="button" onClick={advance}>
          {isLastSection ? t("ส่งคำตอบ (ทดลอง)", "Submit (practice)") : t("ถัดไป", "Next")}
        </button>
      </div>

      <p className={styles.note}>
        {t(
          "* ทดลองตอบได้จริงเพื่อดูหน้าตาที่พนักงานจะเห็น ไม่มีการบันทึกคำตอบ และผู้เรียนจะไม่เห็นเฉลยหรือคะแนนรายข้อ",
          "* A real practice run showing what the employee sees. Nothing is saved, and learners never see correct answers or per-question scores.",
        )}
      </p>
    </div>
  );
}
