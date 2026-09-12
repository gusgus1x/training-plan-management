"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listAssignedEvaluations, markAssignedEvaluationOpened } from "../../lib/trainingForms/client";
import type { AssignedEvaluation } from "../../lib/trainingForms/types";
import { useUiLanguage } from "../ThaiUiLocalization";
import { ChevronDown, ChevronUp } from "../icons/LucideIcons";
import styles from "./AssignedEvaluations.module.css";

const formatDate = (iso: string, isThai: boolean) =>
  new Date(iso).toLocaleDateString(isThai ? "th-TH" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatTime = (iso: string, isThai: boolean) =>
  new Date(iso).toLocaleTimeString(isThai ? "th-TH" : "en-GB", { hour: "2-digit", minute: "2-digit" });

/** When the round ran, as one line: the date, then the hours it covered. */
const formatWhen = (startAt: string, endAt: string, isThai: boolean) => {
  const startDate = formatDate(startAt, isThai);
  const endDate = formatDate(endAt, isThai);
  const hours = `${formatTime(startAt, isThai)} - ${formatTime(endAt, isThai)}`;
  return startDate === endDate ? `${startDate} · ${hours}` : `${startDate} - ${endDate} · ${hours}`;
};

/**
 * One round of one course, with the people on it whose evaluations are this supervisor's to fill
 * in.
 *
 * The list used to be one flat row per person, which named the course again on every line and left
 * the supervisor working out for themselves which of their people had been on what. Grouping says
 * it once: this course, this round, these dates, this form - and then the names.
 */
export type AssignedGroup = {
  key: string;
  courseName: string;
  batchName: string | null;
  startAt: string;
  endAt: string;
  stage: AssignedEvaluation["stage"];
  rows: AssignedEvaluation[];
};

export const groupByRound = (rows: AssignedEvaluation[]): AssignedGroup[] => {
  const groups = new Map<string, AssignedGroup>();
  for (const row of rows) {
    // The stage is part of the key: the same round can carry both an after-training evaluation and
    // a 30-day follow-up, and they are two different things to answer.
    const key = `${row.courseName}|${row.batchName ?? ""}|${row.startAt}|${row.stage}`;
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
      continue;
    }
    groups.set(key, {
      key,
      courseName: row.courseName,
      batchName: row.batchName,
      startAt: row.startAt,
      endAt: row.endAt,
      stage: row.stage,
      rows: [row],
    });
  }
  // Most recent round first, which is the one a supervisor has just been asked about.
  return [...groups.values()].sort((left, right) => right.startAt.localeCompare(left.startAt));
};

/**
 * The evaluations a supervisor has been asked to fill in about the people they manage.
 *
 * A LINK row can only ever report whether the link was followed, never whether it was answered -
 * the form belongs to somebody else. The wording says "opened", and saying anything stronger would
 * be the screen inventing a fact the database does not hold.
 */
export default function AssignedEvaluations() {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);

  const [rows, setRows] = useState<AssignedEvaluation[] | null>(null);
  const [error, setError] = useState("");
  /** Rounds the supervisor has folded away. Open is the default: the names are the point. */
  const [collapsed, setCollapsed] = useState<Record<string, true>>({});

  useEffect(() => {
    listAssignedEvaluations()
      .then((result) => setRows(result.assignedEvaluations))
      .catch((cause: Error) => {
        setRows([]);
        setError(cause.message);
      });
  }, []);

  const markOpened = (enrollmentId: string) =>
    markAssignedEvaluationOpened(enrollmentId)
      .then(() =>
        setRows((current) =>
          (current ?? []).map((row) =>
            row.enrollmentId === enrollmentId && row.openedAt === null
              ? { ...row, openedAt: new Date().toISOString() }
              : row,
          ),
        ),
      )
      // The link opens either way. Losing the note that it was opened is not worth blocking the
      // supervisor over, and the next open records it.
      .catch(() => undefined);

  const groups = useMemo(() => groupByRound(rows ?? []), [rows]);

  // Renders nothing at all while loading, on error, or with nothing assigned. Most employees are
  // not a supervisor and never will be, and this sits inside My Record - an empty panel telling
  // them so would be permanent noise on somebody else's screen.
  if (rows === null || error || rows.length === 0) return null;

  return (
    <section className={styles.panel} aria-label="Assigned evaluations">
      <h2 className={styles.title}>{t("แบบประเมินที่ได้รับมอบหมาย", "Evaluations assigned to you")}</h2>
      {groups.map((group) => {
        const isOpen = !collapsed[group.key];
        return (
          <article className={styles.group} key={group.key}>
            {/* The course said once, at the top of its own round, rather than on every name. */}
            <button
              type="button"
              className={styles.groupHead}
              aria-expanded={isOpen}
              onClick={() =>
                setCollapsed((current) => {
                  const next = { ...current };
                  if (isOpen) next[group.key] = true;
                  else delete next[group.key];
                  return next;
                })
              }
            >
              <span className={styles.groupAbout}>
                <strong>{group.courseName}</strong>
                <span className={styles.meta}>
                  {group.batchName ? `${t("รุ่นที่", "Batch")} ${group.batchName} · ` : ""}
                  {formatWhen(group.startAt, group.endAt, isThai)}
                </span>
                <span className={styles.groupForm}>
                  {t("แบบประเมินที่คุณต้องตอบ", "The evaluation you are asked for")}:{" "}
                  {group.stage === "EVALUATION"
                    ? t("ประเมินหลังอบรม", "After training")
                    : t("ติดตามผลหลังอบรม 30 วัน", "30-day follow-up")}
                </span>
              </span>
              <span className={styles.groupCount}>
                {t(`${group.rows.length} คน`, `${group.rows.length} people`)}
              </span>
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isOpen ? (
      <ul className={styles.list}>
        {group.rows.map((row) => (
          <li key={`${row.enrollmentId}-${row.stage}`} className={styles.row}>
            <div className={styles.about}>
              <strong>{row.attendeeName}</strong>
              <span className={styles.meta}>{row.attendeeEmployeeCode}</span>
            </div>

            <div className={styles.action}>
              {!row.isOpen ? (
                <span className={styles.waiting}>
                  {t("เปิดให้ทำ", "Opens")} {formatDate(row.opensAt, isThai)}
                </span>
              ) : row.submitted ? (
                <span className={styles.done}>{t("ตอบแล้ว", "Answered")}</span>
              ) : row.mode === "LINK" ? (
                <a
                  className={styles.button}
                  href={row.link ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  // The click is the only thing this system can witness about an external form, so
                  // it is recorded on the server rather than in this browser. HRD has to see it,
                  // and a note kept in localStorage would never reach them.
                  onClick={() => void markOpened(row.enrollmentId)}
                >
                  {t("เปิดลิงก์แบบประเมิน", "Open the evaluation link")}
                </a>
              ) : (
                <Link className={styles.button} href={`/training-form/${row.enrollmentId}/${row.stage}`}>
                  {t("ทำแบบประเมิน", "Fill in the evaluation")}
                </Link>
              )}

              {/* Only ever "opened", never "done": for a LINK row this system cannot see the
                  answers, and for a FORM row `submitted` above already says it better. */}
              {row.openedAt && !row.submitted ? (
                <span className={styles.meta}>
                  {t("เปิดแล้วเมื่อ", "Opened on")} {formatDate(row.openedAt, isThai)}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
