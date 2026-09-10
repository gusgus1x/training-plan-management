"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  gradeSubmission,
  publishSubmissionResults,
  readSubmissionReview,
} from "../../../../lib/trainingForms/client";
import type { SubmissionReview, SubmissionReviewQuestion } from "../../../../lib/trainingForms/types";
import { isFormBlockType } from "../../../../lib/formBlocks";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import styles from "./SubmissionReviewPage.module.css";

/**
 * One person's answer paper, marked up, for HRD.
 *
 * Two jobs on one screen, because they are the same reading: seeing what was answered, and marking
 * the written answers this system cannot mark itself. A written answer carries no verdict of its
 * own until somebody reads it, so those questions are the ones the jump links lead to.
 *
 * Saving marks and releasing the score are separate buttons on purpose: HRD can finish marking a
 * whole batch before any employee sees a grade, which is the behaviour publishSubmissionResults
 * was built for.
 */
export default function SubmissionReviewPage({
  planId,
  submissionId,
}: {
  planId: string;
  submissionId: string;
}) {
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const toast = useToast();
  const router = useRouter();

  const [review, setReview] = useState<SubmissionReview | null>(null);
  const [error, setError] = useState("");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const questionRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = () =>
    readSubmissionReview(planId, submissionId)
      .then((result) => {
        setReview(result.review);
        setError("");
      })
      .catch((cause: Error) => setError(cause.message));

  useEffect(() => {
    void load();
    // planId and submissionId identify the paper; nothing else changes what is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, submissionId]);

  const pending = useMemo(
    () => (review?.questions ?? []).filter((question) => question.needsReview),
    [review],
  );

  /** The total once the marks typed on this screen are counted, so the number moves as HRD works
   *  rather than only after a save. */
  const runningScore = useMemo(() => {
    if (!review) return 0;
    return review.questions.reduce((sum, question) => {
      if (question.needsReview) {
        const typed = Number(marks[question.answerId ?? ""] ?? "");
        return sum + (Number.isFinite(typed) ? typed : 0);
      }
      return sum + (question.scoreAwarded ?? 0);
    }, 0);
  }, [review, marks]);

  const jumpTo = (questionId: string) => {
    questionRefs.current[questionId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const saveMarks = () => {
    if (!review) return;
    const answers = pending.map((question) => ({
      answerId: question.answerId!,
      scoreAwarded: Number(marks[question.answerId!] ?? ""),
      reviewComment: comments[question.answerId!]?.trim() || null,
    }));
    // The server refuses a partial save (GRADING_INCOMPLETE), so an unfilled box is caught here
    // where the person can still see which one it is.
    const missing = answers.find((answer) => !Number.isFinite(answer.scoreAwarded));
    if (missing) {
      toast.warning(t("กรอกคะแนนให้ครบทุกข้อเขียนก่อน", "Every written answer needs a mark first"));
      return;
    }
    const overMax = pending.find(
      (question) => Number(marks[question.answerId!] ?? "") > question.questionScore,
    );
    if (overMax) {
      toast.warning(
        t(
          `ข้อ ${overMax.questionOrder} ให้คะแนนเกิน ${overMax.questionScore}`,
          `Question ${overMax.questionOrder} scores more than its ${overMax.questionScore}`,
        ),
      );
      return;
    }

    setIsSaving(true);
    gradeSubmission(planId, submissionId, { answers })
      .then(() => load())
      .then(() => toast.success(t("บันทึกคะแนนแล้ว", "Marks saved")))
      .catch((cause: Error) => toast.error(cause.message))
      .finally(() => setIsSaving(false));
  };

  const publish = () => {
    setIsSaving(true);
    publishSubmissionResults(planId, submissionId)
      .then(() => load())
      .then(() => toast.success(t("ปล่อยผลให้พนักงานเห็นแล้ว", "Result released to the employee")))
      .catch((cause: Error) => toast.error(cause.message))
      .finally(() => setIsSaving(false));
  };

  if (error) return <p className={styles.state}>{error}</p>;
  if (!review) return <p className={styles.state}>{t("กำลังโหลด...", "Loading...")}</p>;

  const stageLabel =
    review.stage === "PRE_TEST" ? t("ก่อนอบรม", "Pre test") : t("หลังอบรม", "Post test");

  return (
    <section className={styles.page}>
      {/* Opened in its own tab from Training Actual, so there is usually nothing to go back to.
          Closing returns the person to the workspace tab they left running; the push is the
          fallback for anyone who reached this page by typing the address. */}
      <button
        type="button"
        className={styles.backBtn}
        onClick={() => {
          if (typeof window !== "undefined" && window.opener) {
            window.close();
            return;
          }
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
          }
          router.push("/training-record/training-actual");
        }}
      >
        ← {t("กลับ", "Back")}
      </button>

      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{review.employeeName}</h2>
          <p className={styles.meta}>
            {[review.employeeCode, stageLabel, t(`ครั้งที่ ${review.attemptNo}`, `Attempt ${review.attemptNo}`)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className={styles.scoreBox}>
          <strong>
            {runningScore} / {review.totalScore}
          </strong>
          <span>{t(`เกณฑ์ผ่าน ${review.passingScorePercent}%`, `Pass mark ${review.passingScorePercent}%`)}</span>
          {review.resultsPublished ? (
            <span className={styles.publishedTag}>{t("ปล่อยผลแล้ว", "Released")}</span>
          ) : (
            <span className={styles.heldTag}>{t("ยังไม่ปล่อยผล", "Not released")}</span>
          )}
        </div>
      </header>

      {/* The jump list is the point of this screen for a long paper: written answers are the only
          ones a person has to act on, and they can sit anywhere among fifty questions. */}
      {pending.length > 0 ? (
        <div className={styles.pendingBar}>
          <strong>
            {t(`ต้องตรวจเอง ${pending.length} ข้อ`, `${pending.length} answers need marking`)}
          </strong>
          <span className={styles.jumpLinks}>
            {pending.map((question) => (
              <button
                key={question.questionId}
                type="button"
                className={styles.jumpLink}
                onClick={() => jumpTo(question.questionId)}
              >
                {t(`ข้อ ${question.questionOrder}`, `Q${question.questionOrder}`)}
              </button>
            ))}
          </span>
          <button type="button" className={styles.primaryButton} disabled={isSaving} onClick={saveMarks}>
            {isSaving ? t("กำลังบันทึก...", "Saving...") : t("บันทึกคะแนน", "Save marks")}
          </button>
        </div>
      ) : review.resultsPublished ? null : (
        <div className={styles.pendingBar}>
          <strong>{t("ตรวจครบแล้ว", "Marking complete")}</strong>
          <button type="button" className={styles.primaryButton} disabled={isSaving} onClick={publish}>
            {t("ปล่อยผลให้พนักงาน", "Release to the employee")}
          </button>
        </div>
      )}

      <ol className={styles.questions}>
        {review.questions.map((question) => (
          <li
            key={question.questionId}
            ref={(node) => {
              questionRefs.current[question.questionId] = node;
            }}
            className={questionClass(question)}
          >
            <QuestionCard
              question={question}
              isThai={isThai}
              mark={marks[question.answerId ?? ""] ?? ""}
              comment={comments[question.answerId ?? ""] ?? question.reviewComment ?? ""}
              onMark={(value) =>
                setMarks((current) => ({ ...current, [question.answerId ?? ""]: value }))
              }
              onComment={(value) =>
                setComments((current) => ({ ...current, [question.answerId ?? ""]: value }))
              }
            />
          </li>
        ))}
      </ol>
    </section>
  );

  function questionClass(question: SubmissionReviewQuestion) {
    if (isFormBlockType(question.questionType)) return styles.blockRow;
    if (question.needsReview) return styles.pendingRow;
    if (question.isCorrect === true) return styles.correctRow;
    return styles.wrongRow;
  }
}

const QuestionCard = ({
  question,
  isThai,
  mark,
  comment,
  onMark,
  onComment,
}: {
  question: SubmissionReviewQuestion;
  isThai: boolean;
  mark: string;
  comment: string;
  onMark: (value: string) => void;
  onComment: (value: string) => void;
}) => {
  const t = (th: string, en: string) => (isThai ? th : en);

  // A section break or text block is not a question and has no answer - shown so the paper reads in
  // the same order the person saw, and nothing more.
  if (isFormBlockType(question.questionType)) {
    return (
      <div className={styles.blockCard}>
        <strong>{question.questionText}</strong>
      </div>
    );
  }

  const rows = question.choices.filter((choice) => choice.axis === "ROW");
  const columns = question.choices.filter((choice) => choice.axis === "COLUMN");
  const plainChoices = question.choices.filter((choice) => choice.axis === null);

  return (
    <div className={styles.questionCard}>
      <div className={styles.questionHead}>
        <span className={styles.questionOrder}>{question.questionOrder}.</span>
        <span className={styles.questionText}>{question.questionText}</span>
        <span className={styles.questionScore}>
          {question.scoreAwarded ?? "-"} / {question.questionScore}
        </span>
      </div>

      {plainChoices.length > 0 ? (
        <ul className={styles.choices}>
          {plainChoices.map((choice) => (
            <li
              key={choice.choiceId}
              className={
                choice.isCorrect ? styles.choiceCorrect : choice.picked ? styles.choiceWrong : styles.choice
              }
            >
              <span className={styles.choiceMark}>
                {choice.picked ? (choice.isCorrect ? "✓" : "✕") : choice.isCorrect ? "•" : ""}
              </span>
              <span>{choice.choiceText}</span>
              {choice.isCorrect && !choice.picked ? (
                <em className={styles.keyNote}>{t("เฉลย", "answer key")}</em>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length > 0 && columns.length > 0 ? (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th />
                {columns.map((column) => (
                  <th key={column.choiceId}>{column.choiceText}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.choiceId}>
                  <th scope="row">{row.choiceText}</th>
                  {columns.map((column) => {
                    const picked = column.picked && column.rowId === row.choiceId;
                    return (
                      <td key={column.choiceId} className={picked ? styles.gridPicked : undefined}>
                        {picked ? "●" : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {question.answerText !== null ? (
        <blockquote className={styles.written}>{question.answerText}</blockquote>
      ) : null}

      {question.needsReview ? (
        <div className={styles.markRow}>
          <label>
            <span>{t("ให้คะแนน", "Mark")}</span>
            <input
              type="number"
              min={0}
              max={question.questionScore}
              step="0.01"
              value={mark}
              onChange={(event) => onMark(event.target.value)}
            />
          </label>
          <label className={styles.commentField}>
            <span>{t("ความเห็น (ถ้ามี)", "Comment (optional)")}</span>
            <input type="text" value={comment} onChange={(event) => onComment(event.target.value)} />
          </label>
        </div>
      ) : question.reviewComment ? (
        <p className={styles.savedComment}>{question.reviewComment}</p>
      ) : null}
    </div>
  );
};
