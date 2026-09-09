"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAssignedEvaluations, markAssignedEvaluationOpened } from "../../lib/trainingForms/client";
import type { AssignedEvaluation } from "../../lib/trainingForms/types";
import { useUiLanguage } from "../ThaiUiLocalization";
import styles from "./AssignedEvaluations.module.css";

const formatDate = (iso: string, isThai: boolean) =>
  new Date(iso).toLocaleDateString(isThai ? "th-TH" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

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

  // Renders nothing at all while loading, on error, or with nothing assigned. Most employees are
  // not a supervisor and never will be, and this sits inside My Record - an empty panel telling
  // them so would be permanent noise on somebody else's screen.
  if (rows === null || error || rows.length === 0) return null;

  return (
    <section className={styles.panel} aria-label="Assigned evaluations">
      <h2 className={styles.title}>{t("แบบประเมินที่ได้รับมอบหมาย", "Evaluations assigned to you")}</h2>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={`${row.enrollmentId}-${row.stage}`} className={styles.row}>
            <div className={styles.about}>
              <strong>{row.attendeeName}</strong>
              <span className={styles.meta}>
                {row.attendeeEmployeeCode}
                {row.batchNo === null ? "" : ` · ${t("รุ่นที่", "Batch")} ${row.batchNo}`}
              </span>
              <span className={styles.meta}>{row.courseName}</span>
              <span className={styles.meta}>
                {row.stage === "EVALUATION"
                  ? t("ประเมินหลังอบรม", "After training")
                  : t("ติดตามผล 30 วัน", "30-day follow-up")}
                {` · ${formatDate(row.startAt, isThai)}`}
              </span>
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
    </section>
  );
}
