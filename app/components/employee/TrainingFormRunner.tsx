"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../ToastHost";
import { useUiLanguage } from "../ThaiUiLocalization";
import {
  readAssessment,
  readEvaluation,
  submitAssessment,
  submitEvaluation,
  TrainingFormsClientError,
} from "../../lib/trainingForms/client";
import type {
  AssessmentForEmployee,
  EvaluationForEmployee,
  GradedStage,
  SubmissionSummary,
} from "../../lib/trainingForms/types";
import recordStyles from "./RecordModule.module.css";
import styles from "./TrainingFormRunner.module.css";

type RunnerProps =
  | { kind: "assessment"; enrollmentId: string; stage: GradedStage; courseTitle: string; onClose: () => void; onSubmitted: () => void }
  | {
      kind: "evaluation";
      enrollmentId: string;
      stage: "EVALUATION" | "EVALUATION_30DAY";
      courseTitle: string;
      onClose: () => void;
      onSubmitted: () => void;
    };

// One shape covers every question type from both assessments and evaluations - the two forms
// overlap almost completely (single/multiple choice, free text), and a second component is the
// path by which the two would quietly drift out of sync with each other.
type RunnerKind = "single" | "multiple" | "text" | "rating";

type RunnerOption = { id: string; order: number; text: string };

type RunnerQuestion = {
  questionId: string;
  order: number;
  text: string;
  isRequired: boolean;
  kind: RunnerKind;
  options: RunnerOption[];
  sectionName: string | null;
};

type AnswerState = { choiceIds: string[]; text: string; rating: number | null };

const emptyAnswer: AnswerState = { choiceIds: [], text: "", rating: null };

const isAnswered = (question: RunnerQuestion, answer: AnswerState | undefined) => {
  if (!answer) return false;
  if (question.kind === "single" || question.kind === "multiple") return answer.choiceIds.length > 0;
  if (question.kind === "rating") return answer.rating !== null;
  return answer.text.trim().length > 0;
};

const fromAssessment = (form: AssessmentForEmployee): RunnerQuestion[] =>
  form.questions.map((q) => ({
    questionId: q.questionId,
    order: q.questionOrder,
    text: q.questionText,
    isRequired: q.isRequired,
    kind: q.questionType === "MULTIPLE_CHOICE" ? "multiple" : q.questionType === "SHORT_ANSWER" ? "text" : "single",
    options: q.choices.map((c) => ({ id: c.choiceId, order: c.choiceOrder, text: c.choiceText })),
    sectionName: null,
  }));

const fromEvaluation = (form: EvaluationForEmployee): RunnerQuestion[] =>
  form.questions.map((q) => ({
    questionId: q.questionId,
    order: q.questionOrder,
    text: q.questionText,
    isRequired: q.isRequired,
    kind: q.questionType === "RATING" ? "rating" : q.questionType === "MULTIPLE_CHOICE" ? "multiple" : q.questionType === "SINGLE_CHOICE" ? "single" : "text",
    options: q.options.map((o) => ({ id: o.optionId, order: o.optionOrder, text: o.optionText })),
    sectionName: q.sectionName,
  }));

const passStatusLabel = (status: SubmissionSummary["passStatus"], t: (th: string, en: string) => string) =>
  status === "PASS" ? t("ผ่าน", "Pass") : status === "FAIL" ? t("ไม่ผ่าน", "Fail") : t("รอผล", "Pending");

const errorMessage = (error: unknown, t: (th: string, en: string) => string) => {
  if (error instanceof TrainingFormsClientError) {
    if (error.code === "STAGE_NOT_OPEN") return t("แบบฟอร์มนี้ยังไม่เปิดให้ทำ", "This form is not open yet");
    if (error.code === "STAGE_CLOSED") return t("HRD ปิดรับแบบฟอร์มนี้แล้ว", "HRD has closed this form");
    if (error.code === "ALREADY_SUBMITTED") return t("ส่งแบบฟอร์มนี้ไปแล้ว ทำซ้ำไม่ได้", "This form was already submitted and cannot be repeated");
    if (error.code === "RESOURCE_NOT_FOUND") return t("ไม่พบแบบฟอร์มสำหรับหลักสูตรนี้", "This course has no form to take");
  }
  return t("เกิดข้อผิดพลาด กรุณาลองใหม่", "Something went wrong, please try again");
};

export default function TrainingFormRunner(props: RunnerProps) {
  const { kind, enrollmentId, stage, courseTitle, onClose, onSubmitted } = props;
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const confirm = useConfirm();
  const toast = useToast();

  const [questions, setQuestions] = useState<RunnerQuestion[] | null>(null);
  const [priorAttempts, setPriorAttempts] = useState<SubmissionSummary[]>([]);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    const load = kind === "assessment" ? readAssessment(enrollmentId, stage as GradedStage) : readEvaluation(enrollmentId, stage as "EVALUATION" | "EVALUATION_30DAY");

    load
      .then((form) => {
        if (cancelled) return;
        if (kind === "assessment") {
          const assessmentForm = form as AssessmentForEmployee;
          setFormTitle(assessmentForm.seriesName);
          setQuestions(fromAssessment(assessmentForm));
          setPriorAttempts(assessmentForm.submissions);
          setAlreadySubmitted(false);
        } else {
          const evaluationForm = form as EvaluationForEmployee;
          setFormTitle(evaluationForm.formName);
          setQuestions(fromEvaluation(evaluationForm));
          setPriorAttempts([]);
          setAlreadySubmitted(evaluationForm.alreadySubmitted);
        }
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorMessage(error, t));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentId, stage, kind]);

  const missingRequiredIds = useMemo(() => {
    if (!questions) return [];
    return questions.filter((q) => q.isRequired && !isAnswered(q, answers[q.questionId])).map((q) => q.questionId);
  }, [questions, answers]);

  const hasStartedAnswering = useMemo(() => Object.values(answers).some((a) => isAnswered({ kind: "text" } as RunnerQuestion, a) || a.choiceIds.length > 0 || a.rating !== null), [answers]);

  const setAnswer = (questionId: string, patch: Partial<AnswerState>) =>
    setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] ?? emptyAnswer), ...patch } }));

  const toggleChoice = (question: RunnerQuestion, choiceId: string) => {
    setAnswers((prev) => {
      const current = prev[question.questionId] ?? emptyAnswer;
      if (question.kind === "single") {
        return { ...prev, [question.questionId]: { ...current, choiceIds: [choiceId] } };
      }
      const already = current.choiceIds.includes(choiceId);
      const choiceIds = already ? current.choiceIds.filter((id) => id !== choiceId) : [...current.choiceIds, choiceId];
      return { ...prev, [question.questionId]: { ...current, choiceIds } };
    });
  };

  const handleClose = async () => {
    if (hasStartedAnswering && !alreadySubmitted) {
      const ok = await confirm({
        title: { th: "ยกเลิกการทำแบบฟอร์ม", en: "Discard this form" },
        message: {
          th: "คำตอบที่กรอกไว้จะหายไปหากปิดตอนนี้ ต้องการปิดหรือไม่?",
          en: "Your answers will be lost if you close now. Close anyway?",
        },
        confirmLabel: { th: "ปิดโดยไม่บันทึก", en: "Close without saving" },
        cancelLabel: { th: "กลับไปทำต่อ", en: "Keep going" },
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (!questions) return;
    if (missingRequiredIds.length > 0) {
      setShowMissing(true);
      toast.error(t("กรุณาตอบคำถามที่จำเป็นให้ครบก่อนส่ง", "Please answer every required question before submitting"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (kind === "assessment") {
        const result = await submitAssessment(enrollmentId, stage as GradedStage, {
          answers: questions.map((q) => ({
            questionId: q.questionId,
            choiceIds: answers[q.questionId]?.choiceIds ?? [],
            text: q.kind === "text" ? answers[q.questionId]?.text ?? null : null,
          })),
        });
        if (result.gradingStatus === "PENDING_REVIEW") {
          toast.success(t("ส่งคำตอบแล้ว รอ HRD ตรวจข้อเขียน", "Submitted - waiting for HRD to grade the written answers"));
        } else {
          toast.success(
            t(
              `ส่งคำตอบแล้ว คะแนน ${result.score}% (${passStatusLabel(result.passStatus, t)})`,
              `Submitted - score ${result.score}% (${passStatusLabel(result.passStatus, t)})`,
            ),
          );
        }
      } else {
        await submitEvaluation(enrollmentId, stage as "EVALUATION" | "EVALUATION_30DAY", {
          answers: questions.map((q) => ({
            questionId: q.questionId,
            optionIds: answers[q.questionId]?.choiceIds ?? [],
            ratingValue: q.kind === "rating" ? answers[q.questionId]?.rating ?? null : null,
            text: q.kind === "text" ? answers[q.questionId]?.text ?? null : null,
          })),
        });
        toast.success(t("ส่งแบบประเมินเรียบร้อยแล้ว ขอบคุณครับ", "Evaluation submitted - thank you"));
      }
      onSubmitted();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={recordStyles.modalOverlay} role="dialog" aria-modal="true" onClick={() => void handleClose()}>
      <div className={recordStyles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={recordStyles.modalHeader}>
          <div>
            <span className={recordStyles.providerTag}>{courseTitle}</span>
            <h3 className={recordStyles.courseTitleText} style={{ margin: "4px 0" }}>
              {formTitle || (kind === "assessment" ? t("แบบทดสอบ", "Assessment") : t("แบบประเมิน", "Evaluation"))}
            </h3>
          </div>
          <button className={recordStyles.modalCloseBtn} type="button" onClick={() => void handleClose()} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {isLoading ? (
            <p className={styles.meta}>{t("กำลังโหลด...", "Loading...")}</p>
          ) : loadError ? (
            <div className={recordStyles.emptyStateBox} role="alert">
              {loadError}
            </div>
          ) : alreadySubmitted ? (
            <div className={recordStyles.emptyStateBox}>
              {t("ส่งแบบประเมินนี้ไปแล้ว ทำได้เพียงครั้งเดียว", "This evaluation has already been submitted and cannot be repeated")}
            </div>
          ) : (
            <>
              {priorAttempts.length > 0 ? (
                <div className={styles.priorAttempts}>
                  <strong>{t("ครั้งก่อนหน้า", "Previous attempts")}</strong>
                  {priorAttempts.map((attempt) => (
                    <div className={styles.priorAttemptRow} key={attempt.submissionId}>
                      <span>
                        {t(`ครั้งที่ ${attempt.attemptNo}`, `Attempt ${attempt.attemptNo}`)}:{" "}
                        {attempt.gradingStatus === "PENDING_REVIEW"
                          ? t("รอตรวจ", "Awaiting review")
                          : attempt.score !== null
                            ? `${attempt.score}% (${passStatusLabel(attempt.passStatus, t)})`
                            : "-"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {(questions ?? []).map((question) => {
                const answer = answers[question.questionId];
                const missing = showMissing && missingRequiredIds.includes(question.questionId);
                return (
                  <div className={styles.questionCard} data-missing={missing} key={question.questionId}>
                    {question.sectionName ? <small style={{ color: "var(--ui-30-muted)" }}>{question.sectionName}</small> : null}
                    <div className={styles.questionHeader}>
                      <span className={styles.questionOrder}>{question.order}.</span>
                      <span>{question.text}</span>
                      {question.isRequired ? <span className={styles.required}>*</span> : null}
                    </div>

                    {question.kind === "single" || question.kind === "multiple" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {question.options.map((option) => (
                          <label className={styles.optionRow} key={option.id}>
                            <input
                              type={question.kind === "single" ? "radio" : "checkbox"}
                              name={question.questionId}
                              checked={answer?.choiceIds.includes(option.id) ?? false}
                              onChange={() => toggleChoice(question, option.id)}
                            />
                            <span>{option.text}</span>
                          </label>
                        ))}
                      </div>
                    ) : question.kind === "rating" ? (
                      <div className={styles.ratingRow}>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={styles.ratingBtn}
                            data-active={answer?.rating === value}
                            onClick={() => setAnswer(question.questionId, { rating: value })}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        className={styles.textInput}
                        value={answer?.text ?? ""}
                        onChange={(e) => setAnswer(question.questionId, { text: e.target.value })}
                        placeholder={t("พิมพ์คำตอบที่นี่...", "Type your answer here...")}
                      />
                    )}

                    {missing ? <p className={styles.missingNote}>{t("ต้องตอบข้อนี้", "This question is required")}</p> : null}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {!isLoading && !loadError && !alreadySubmitted ? (
          <div className={styles.footer}>
            <button className={recordStyles.exportBtn} type="button" onClick={() => void handleClose()}>
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              className={recordStyles.exportBtn}
              type="button"
              disabled={isSubmitting || (questions ?? []).length === 0}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? t("กำลังส่ง...", "Submitting...") : t("ส่งคำตอบ", "Submit")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
