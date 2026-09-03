"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../ToastHost";
import { useUiLanguage } from "../ThaiUiLocalization";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
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
  FormStageKey,
  GradedStage,
  SubmissionSummary,
} from "../../lib/trainingForms/types";
import styles from "./TrainingFormRunner.module.css";

type TrainingFormRunnerProps = {
  enrollmentId: string;
  /** Raw path segment from the URL - validated here, not trusted from the route. */
  stage: string;
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

/** Stable DOM id per question, so the submit handler can scroll to the first unanswered one. */
const questionDomId = (questionId: string) => `training-form-q-${questionId}`;

/** Half-finished answers used to die with the tab; only a "you will lose your answers" dialog stood
 *  between the employee and a lost form. Google Forms keeps a draft per respondent instead.
 *  ponytail: localStorage, so the draft is per browser, not per account - move it to
 *  assessment_submission (status IN_PROGRESS + started_at already exist) if resuming on another
 *  device is ever asked for. */
const DRAFT_STORAGE_PREFIX = "training-form:draft";
type StoredDraft = { answers: Record<string, AnswerState>; deadlineAt: number | null };
const draftKey = (enrollmentId: string, stage: string) => `${DRAFT_STORAGE_PREFIX}:${enrollmentId}:${stage}`;

const loadDraft = (key: string): StoredDraft | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    return parsed && typeof parsed === "object" && parsed.answers ? parsed : null;
  } catch {
    return null;
  }
};
const saveDraft = (key: string, draft: StoredDraft) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // A full or blocked store must never stop someone from finishing the form.
  }
};
const clearDraft = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // as above
  }
};

const countdownLabel = (msLeft: number) => {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

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
    if (error.code === "FORBIDDEN") return t("คุณไม่มีสิทธิ์เข้าถึงรายการนี้", "You do not have access to this record");
  }
  return t("เกิดข้อผิดพลาด กรุณาลองใหม่", "Something went wrong, please try again");
};

const GRADED_STAGES: readonly GradedStage[] = ["PRE_TEST", "POST_TEST"];
const isValidStage = (value: string): value is FormStageKey =>
  (GRADED_STAGES as readonly string[]).includes(value) || value === "EVALUATION" || value === "EVALUATION_30DAY";

export default function TrainingFormRunner({ enrollmentId, stage: rawStage }: TrainingFormRunnerProps) {
  const router = useRouter();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const confirm = useConfirm();
  const toast = useToast();

  const stageIsValid = isValidStage(rawStage);
  const stage = stageIsValid ? rawStage : null;
  const kind: "assessment" | "evaluation" | null = stage === null ? null : GRADED_STAGES.includes(stage as GradedStage) ? "assessment" : "evaluation";

  const [courseTitle, setCourseTitle] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [questions, setQuestions] = useState<RunnerQuestion[] | null>(null);
  const [priorAttempts, setPriorAttempts] = useState<SubmissionSummary[]>([]);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [draftRestored, setDraftRestored] = useState(false);

  const storageKey = stage ? draftKey(enrollmentId, stage) : "";

  const goBackToRecord = () => router.push("/?module=record");

  useEffect(() => {
    if (!stage || !kind) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setAccessDenied(false);

    // The enrollment record carries the course name; the URL only has raw ids. Loaded alongside
    // the form itself rather than blocking on it - an employee with no matching enrollment (not
    // theirs, or mistyped id) gets a clear refusal instead of a title-less form.
    const loadCourseTitle = listEnrollments({ planId: null, employeeId: null, employeeUserId: null }).then((result) => {
      const match = result.enrollments.find((e) => e.id === enrollmentId);
      if (!match) throw new TrainingFormsClientError("FORBIDDEN");
      return match.plan.courseName;
    });

    const loadForm = kind === "assessment" ? readAssessment(enrollmentId, stage as GradedStage) : readEvaluation(enrollmentId, stage as "EVALUATION" | "EVALUATION_30DAY");

    Promise.all([loadCourseTitle, loadForm])
      .then(([title, form]) => {
        if (cancelled) return;
        setCourseTitle(title);
        let timeLimitMinutes: number | null = null;
        if (kind === "assessment") {
          const assessmentForm = form as AssessmentForEmployee;
          setFormTitle(assessmentForm.seriesName);
          setQuestions(fromAssessment(assessmentForm));
          setPriorAttempts(assessmentForm.submissions);
          setAlreadySubmitted(false);
          setInstructions(assessmentForm.instructions);
          timeLimitMinutes = assessmentForm.timeLimitMinutes;
        } else {
          const evaluationForm = form as EvaluationForEmployee;
          setFormTitle(evaluationForm.formName);
          setQuestions(fromEvaluation(evaluationForm));
          setPriorAttempts([]);
          setAlreadySubmitted(evaluationForm.alreadySubmitted);
          setInstructions(evaluationForm.description);
        }

        // Draft and deadline are restored together: reopening the tab must not hand back a fresh
        // clock on a timed test.
        const draft = loadDraft(draftKey(enrollmentId, stage));
        if (draft?.answers && Object.keys(draft.answers).length > 0) {
          setAnswers(draft.answers);
          setDraftRestored(true);
        }
        if (timeLimitMinutes !== null && timeLimitMinutes > 0) {
          setDeadlineAt(draft?.deadlineAt ?? Date.now() + timeLimitMinutes * 60_000);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof TrainingFormsClientError && error.code === "FORBIDDEN") {
          setAccessDenied(true);
        } else {
          setLoadError(errorMessage(error, t));
        }
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

  const hasStartedAnswering = useMemo(() => Object.values(answers).some((a) => a.text.trim().length > 0 || a.choiceIds.length > 0 || a.rating !== null), [answers]);

  const answeredCount = useMemo(
    () => (questions ?? []).filter((q) => isAnswered(q, answers[q.questionId])).length,
    [questions, answers],
  );

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

  // Autosave. Skipped while nothing has been typed, so merely opening a form does not leave a
  // draft behind that would later restore an empty answer set over a fresh start.
  useEffect(() => {
    if (!storageKey || alreadySubmitted) return;
    if (!hasStartedAnswering && deadlineAt === null) return;
    saveDraft(storageKey, { answers, deadlineAt });
  }, [storageKey, answers, deadlineAt, hasStartedAnswering, alreadySubmitted]);

  // One ticker drives the countdown; it stops itself once the deadline passes.
  useEffect(() => {
    if (deadlineAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadlineAt]);

  const msLeft = deadlineAt === null ? null : deadlineAt - now;
  const timeIsUp = msLeft !== null && msLeft <= 0;

  const handleBack = async () => {
    if (hasStartedAnswering && !alreadySubmitted) {
      const ok = await confirm({
        title: { th: "ยกเลิกการทำแบบฟอร์ม", en: "Discard this form" },
        message: {
          th: "คำตอบที่กรอกไว้จะหายไปหากออกตอนนี้ ต้องการออกหรือไม่?",
          en: "Your answers will be lost if you leave now. Leave anyway?",
        },
        confirmLabel: { th: "ออกโดยไม่บันทึก", en: "Leave without saving" },
        cancelLabel: { th: "กลับไปทำต่อ", en: "Keep going" },
        danger: true,
      });
      if (!ok) return;
    }
    if (storageKey) clearDraft(storageKey);
    goBackToRecord();
  };

  const handleSubmit = async (auto = false) => {
    if (!questions || !stage || !kind) return;
    // An expired timer sends whatever is there. Blocking on a required question the employee ran
    // out of time to answer would mean the attempt is never recorded at all.
    if (!auto && missingRequiredIds.length > 0) {
      setShowMissing(true);
      toast.error(t("กรุณาตอบคำถามที่จำเป็นให้ครบก่อนส่ง", "Please answer every required question before submitting"));
      // A toast at the top of the screen says nothing about WHERE the gap is - on a long form the
      // employee is left scrolling to hunt for it. Google Forms jumps to the first unanswered
      // required question instead, so do the same.
      document
        .getElementById(questionDomId(missingRequiredIds[0]))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        if (!result.resultsPublished) {
          toast.success(t("ส่งคำตอบแล้ว รอ HRD ตรวจและประกาศผล", "Submitted - waiting for HRD to grade and release the result"));
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
      if (storageKey) clearDraft(storageKey);
      goBackToRecord();
    } catch (error) {
      toast.error(errorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fires exactly once - the ref survives the re-render the submit itself causes.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (!timeIsUp || autoSubmitted.current || isSubmitting || alreadySubmitted || !questions) return;
    autoSubmitted.current = true;
    toast.error(t("หมดเวลาทำแบบทดสอบ ระบบส่งคำตอบให้อัตโนมัติ", "Time is up - your answers were submitted automatically"));
    void handleSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeIsUp, isSubmitting, alreadySubmitted, questions]);

  if (!stage || !kind) {
    return (
      <section className={styles.page}>
        <div className={styles.pageHeader}>
          <button className={styles.backBtn} type="button" onClick={goBackToRecord}>
            ← {t("กลับไป My Record", "Back to My Record")}
          </button>
        </div>
        <div className={styles.errorBox} role="alert">
          {t("ไม่พบแบบฟอร์มที่ต้องการ", "This form could not be found")}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} type="button" onClick={() => void handleBack()}>
          ← {t("กลับไป My Record", "Back to My Record")}
        </button>
        {courseTitle ? <span className={styles.courseTag}>{courseTitle}</span> : null}
      </div>

      <h2 className={styles.pageTitle}>
        {formTitle || (kind === "assessment" ? t("แบบทดสอบ", "Assessment") : t("แบบประเมิน", "Evaluation"))}
      </h2>

      <div className={styles.body}>
        {isLoading ? (
          <p className={styles.meta}>{t("กำลังโหลด...", "Loading...")}</p>
        ) : accessDenied ? (
          <div className={styles.errorBox} role="alert">
            {t("ไม่พบรายการลงทะเบียนนี้ หรือคุณไม่มีสิทธิ์เข้าถึง", "This registration was not found, or you do not have access to it")}
          </div>
        ) : loadError ? (
          <div className={styles.errorBox} role="alert">
            {loadError}
          </div>
        ) : alreadySubmitted ? (
          <div className={styles.errorBox}>
            {t("ส่งแบบประเมินนี้ไปแล้ว ทำได้เพียงครั้งเดียว", "This evaluation has already been submitted and cannot be repeated")}
          </div>
        ) : (
          <>
            {instructions?.trim() ? (
              <div className={styles.instructionsBox}>
                <strong>{t("คำชี้แจง", "Instructions")}</strong>
                <p>{instructions}</p>
              </div>
            ) : null}

            {msLeft !== null ? (
              <div className={styles.timerBox} data-urgent={msLeft <= 60_000}>
                <span>{t("เวลาที่เหลือ", "Time remaining")}</span>
                <strong>{countdownLabel(msLeft)}</strong>
              </div>
            ) : null}

            {draftRestored ? (
              <p className={styles.draftNote}>
                {t("กู้คำตอบที่ค้างไว้จากครั้งก่อนแล้ว", "Restored the answers you left unfinished")}
              </p>
            ) : null}

            {priorAttempts.length > 0 ? (
              <div className={styles.priorAttempts}>
                <strong>{t("ครั้งก่อนหน้า", "Previous attempts")}</strong>
                {priorAttempts.map((attempt) => (
                  <div className={styles.priorAttemptRow} key={attempt.submissionId}>
                    <span>
                      {t(`ครั้งที่ ${attempt.attemptNo}`, `Attempt ${attempt.attemptNo}`)}:{" "}
                      {!attempt.resultsPublished
                        ? t("รอตรวจ/ประกาศผล", "Awaiting review")
                        : attempt.score !== null
                          ? `${attempt.score}% (${passStatusLabel(attempt.passStatus, t)})`
                          : "-"}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {(questions ?? []).length > 0 ? (
              <div className={styles.progressBox}>
                <div className={styles.progressText}>
                  <span>{t("ความคืบหน้า", "Progress")}</span>
                  <strong>
                    {t(
                      `ตอบแล้ว ${answeredCount} จาก ${(questions ?? []).length} ข้อ`,
                      `${answeredCount} of ${(questions ?? []).length} answered`,
                    )}
                  </strong>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={(questions ?? []).length}
                  aria-valuenow={answeredCount}
                >
                  <div
                    className={styles.progressFill}
                    style={{ width: `${Math.round((answeredCount / Math.max(1, (questions ?? []).length)) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}

            {(questions ?? []).map((question, index) => {
              const answer = answers[question.questionId];
              const missing = showMissing && missingRequiredIds.includes(question.questionId);
              // A section's name used to be a small grey line inside every question card, which
              // repeated it per question and never actually separated one section from the next.
              const previousSection = index > 0 ? (questions ?? [])[index - 1].sectionName : null;
              const startsSection = question.sectionName !== null && question.sectionName !== previousSection;
              return (
                <Fragment key={question.questionId}>
                  {startsSection ? <h3 className={styles.sectionHeader}>{question.sectionName}</h3> : null}
                <div className={styles.questionCard} data-missing={missing} id={questionDomId(question.questionId)}>
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
                </Fragment>
              );
            })}
          </>
        )}
      </div>

      {!isLoading && !accessDenied && !loadError && !alreadySubmitted ? (
        <div className={styles.footer}>
          <button className={styles.secondaryBtn} type="button" onClick={() => void handleBack()}>
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            className={styles.primaryBtn}
            type="button"
            disabled={isSubmitting || timeIsUp || (questions ?? []).length === 0}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? t("กำลังส่ง...", "Submitting...") : t("ส่งคำตอบ", "Submit")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
