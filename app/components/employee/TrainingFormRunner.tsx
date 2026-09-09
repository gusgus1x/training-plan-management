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
import {
  resolveNextSection,
  splitSections,
  visitedItems,
  visitedPath,
  type FlowItem,
} from "../../lib/trainingForms/formFlow";
import type { GridAxis } from "../../lib/formGrids";
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
// "section" and "note" are not answerable: a section break starts a new page and renders as its
// heading, a note is a title plus prose. Everything that counts answers filters them out.
type RunnerKind = "single" | "multiple" | "text" | "rating" | "section" | "note" | "grid" | "gridMulti";

type RunnerOption = {
  id: string;
  order: number;
  text: string;
  nextSection: number | null;
  /** 'ROW' / 'COLUMN' on a grid question. */
  axis: GridAxis | null;
};

const isGridKind = (kind: RunnerKind) => kind === "grid" || kind === "gridMulti";

type RunnerQuestion = {
  questionId: string;
  order: number;
  text: string;
  isRequired: boolean;
  kind: RunnerKind;
  options: RunnerOption[];
  sectionName: string | null;
  /** Body of a note, sub-caption of a section heading. */
  description: string | null;
  /** Section breaks only: the default "after this section" target. */
  nextSection: number | null;
};

/** RunnerKind back to the raw question_type the flow helpers key on. */
const flowItems = (questions: readonly RunnerQuestion[]): FlowItem[] =>
  questions.map((question) => ({
    questionId: question.questionId,
    type: question.kind === "section" ? "SECTION_BREAK" : question.kind === "note" ? "TEXT_BLOCK" : question.kind,
    isRequired: question.isRequired,
    nextSection: question.nextSection,
    options: question.options.map((option) => ({ id: option.id, nextSection: option.nextSection })),
  }));

const isBlockKind = (kind: RunnerKind) => kind === "section" || kind === "note";

type AnswerState = {
  choiceIds: string[];
  text: string;
  rating: number | null;
  /** Grid questions: row id -> the column ids picked for that row. */
  grid: Record<string, string[]>;
};

const emptyAnswer: AnswerState = { choiceIds: [], text: "", rating: null, grid: {} };

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

/** Only rows that actually exist on the question, so a stale draft cannot submit a dead row id. */
const gridAnswerFor = (question: RunnerQuestion, answer: AnswerState | undefined) =>
  gridRows(question).map((row) => ({ rowId: row.id, columnIds: answer?.grid[row.id] ?? [] }))
    .filter((row) => row.columnIds.length > 0);

const gridRows = (question: RunnerQuestion) => question.options.filter((option) => option.axis === "ROW");
const gridColumns = (question: RunnerQuestion) => question.options.filter((option) => option.axis === "COLUMN");

const isAnswered = (question: RunnerQuestion, answer: AnswerState | undefined) => {
  // A section or note has nothing to answer, so it must never count toward progress or hold up
  // the submit button.
  if (isBlockKind(question.kind)) return false;
  if (!answer) return false;
  // Google Forms' "require a response in each row": a grid counts as answered only when every row
  // has something, so a half-filled grid cannot pass a required check.
  if (isGridKind(question.kind)) {
    return gridRows(question).every((row) => (answer.grid[row.id] ?? []).length > 0);
  }
  if (question.kind === "single" || question.kind === "multiple") return answer.choiceIds.length > 0;
  if (question.kind === "rating") return answer.rating !== null;
  return answer.text.trim().length > 0;
};

// Both maps are exhaustive on purpose. The previous ternary chains ended in a bare `: "single"` /
// `: "text"`, so a type the runner did not know about rendered as an empty radio group or a stray
// textarea instead of failing loudly.
const ASSESSMENT_KINDS: Record<AssessmentForEmployee["questions"][number]["questionType"], RunnerKind> = {
  SINGLE_CHOICE: "single",
  TRUE_FALSE: "single",
  MULTIPLE_CHOICE: "multiple",
  SHORT_ANSWER: "text",
  MULTIPLE_CHOICE_GRID: "grid",
  CHECKBOX_GRID: "gridMulti",
  SECTION_BREAK: "section",
  TEXT_BLOCK: "note",
};

const EVALUATION_KINDS: Record<EvaluationForEmployee["questions"][number]["questionType"], RunnerKind> = {
  RATING: "rating",
  SINGLE_CHOICE: "single",
  MULTIPLE_CHOICE: "multiple",
  SHORT_TEXT: "text",
  LONG_TEXT: "text",
  MULTIPLE_CHOICE_GRID: "grid",
  CHECKBOX_GRID: "gridMulti",
  SECTION_BREAK: "section",
  TEXT_BLOCK: "note",
};

const fromAssessment = (form: AssessmentForEmployee): RunnerQuestion[] =>
  form.questions.map((q) => ({
    questionId: q.questionId,
    order: q.questionOrder,
    text: q.questionText,
    isRequired: q.isRequired,
    kind: ASSESSMENT_KINDS[q.questionType],
    options: q.choices.map((c) => ({ id: c.choiceId, order: c.choiceOrder, text: c.choiceText, nextSection: c.nextSection, axis: c.axis })),
    sectionName: null,
    description: q.questionDescription,
    nextSection: q.nextSection,
  }));

const fromEvaluation = (form: EvaluationForEmployee): RunnerQuestion[] =>
  form.questions.map((q) => ({
    questionId: q.questionId,
    order: q.questionOrder,
    text: q.questionText,
    isRequired: q.isRequired,
    kind: EVALUATION_KINDS[q.questionType],
    options: q.options.map((o) => ({ id: o.optionId, order: o.optionOrder, text: o.optionText, nextSection: o.nextSection, axis: o.axis })),
    sectionName: q.sectionName,
    description: q.questionDescription,
    nextSection: q.nextSection,
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

    // The enrollment record carries the course name; the URL only has raw ids. A caller with no
    // matching enrollment simply gets no title: the supervisor filling in somebody else's 30-day
    // follow-up is not enrolled on that course and never will be, and treating that as a refusal
    // locked them out of a form the server had already agreed to hand over. Access is the form
    // request's decision, which enforces it against the assignment as well as the enrolment.
    const loadCourseTitle = listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then((result) => result.enrollments.find((e) => e.id === enrollmentId)?.plan.courseName ?? "")
      .catch(() => "");

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

  // Sections and the path through them. A branch that skips a section makes its questions
  // unreachable, so everything below counts the VISITED path rather than the whole form - otherwise
  // a required question the learner was never shown would block submit forever.
  const selected = useMemo(
    () => Object.fromEntries(Object.entries(answers).map(([id, answer]) => [id, answer.choiceIds])),
    [answers],
  );
  const sections = useMemo(() => splitSections(flowItems(questions ?? [])), [questions]);
  const path = useMemo(() => visitedPath(sections, selected), [sections, selected]);

  const byId = useMemo(() => new Map((questions ?? []).map((q) => [q.questionId, q])), [questions]);
  const questionsIn = (sectionIndex: number): RunnerQuestion[] =>
    (sections.find((section) => section.index === sectionIndex)?.items ?? [])
      .map((item) => byId.get(item.questionId))
      .filter((question): question is RunnerQuestion => Boolean(question));

  const [requestedSection, setSectionIndex] = useState(1);
  // Re-answering a branching question can drop the page the learner is standing on out of the
  // path. Derived rather than synced in an effect, so there is never a render showing a section
  // that is no longer reachable.
  const sectionIndex = path.includes(requestedSection) ? requestedSection : path[path.length - 1] ?? 1;

  const currentQuestions = questionsIn(sectionIndex);
  const visitedQuestions = useMemo(
    () => visitedItems(sections, selected)
      .map((item) => byId.get(item.questionId))
      .filter((question): question is RunnerQuestion => Boolean(question)),
    [sections, selected, byId],
  );

  /** Display numbering skips blocks, so a note between two questions does not eat a number. */
  const displayNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    let next = 1;
    for (const question of questions ?? []) if (!isBlockKind(question.kind)) numbers.set(question.questionId, next++);
    return numbers;
  }, [questions]);

  const missingIn = (list: readonly RunnerQuestion[]) =>
    list.filter((q) => q.isRequired && !isAnswered(q, answers[q.questionId])).map((q) => q.questionId);

  /** Gates Submit: everything required the learner actually walked past. */
  const missingRequiredIds = useMemo(
    () => visitedQuestions.filter((q) => q.isRequired && !isAnswered(q, answers[q.questionId])).map((q) => q.questionId),
    [visitedQuestions, answers],
  );
  /** Gates Next: only this page. */
  const missingOnPage = missingIn(currentQuestions);

  const hasStartedAnswering = useMemo(() => Object.values(answers).some((a) => a.text.trim().length > 0 || a.choiceIds.length > 0 || a.rating !== null), [answers]);

  const answerable = visitedQuestions;
  const answeredCount = useMemo(
    () => answerable.filter((q) => isAnswered(q, answers[q.questionId])).length,
    [answerable, answers],
  );

  const isLastSection = resolveNextSection(sections, sectionIndex, selected) === null;
  const positionInPath = path.indexOf(sectionIndex);

  const setAnswer = (questionId: string, patch: Partial<AnswerState>) =>
    setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] ?? emptyAnswer), ...patch } }));

  const toggleGridCell = (question: RunnerQuestion, rowId: string, columnId: string) =>
    setAnswers((prev) => {
      const current = prev[question.questionId] ?? emptyAnswer;
      const picked = current.grid[rowId] ?? [];
      // A multiple choice grid replaces the row's answer; a checkbox grid toggles within the row.
      const next = question.kind === "grid"
        ? [columnId]
        : picked.includes(columnId)
          ? picked.filter((id) => id !== columnId)
          : [...picked, columnId];
      return { ...prev, [question.questionId]: { ...current, grid: { ...current.grid, [rowId]: next } } };
    });

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
      // required question instead, so do the same. With sections that gap can be on another page,
      // so switch to it first; the scroll then runs once that page has rendered.
      const target = missingRequiredIds[0];
      const owning = sections.find((section) => section.items.some((item) => item.questionId === target));
      if (owning && owning.index !== sectionIndex) setSectionIndex(owning.index);
      window.setTimeout(
        () => document.getElementById(questionDomId(target))?.scrollIntoView({ behavior: "smooth", block: "center" }),
        0,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Only what the learner actually walked. Building this from every question, or straight from
      // `answers`, would send answers left behind in a section they backtracked out of after
      // changing a branching choice - they are still in state and in the saved draft.
      if (kind === "assessment") {
        const result = await submitAssessment(enrollmentId, stage as GradedStage, {
          answers: visitedQuestions.map((q) => ({
            questionId: q.questionId,
            choiceIds: answers[q.questionId]?.choiceIds ?? [],
            text: q.kind === "text" ? answers[q.questionId]?.text ?? null : null,
            grid: isGridKind(q.kind) ? gridAnswerFor(q, answers[q.questionId]) : undefined,
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
          answers: visitedQuestions.map((q) => ({
            questionId: q.questionId,
            optionIds: answers[q.questionId]?.choiceIds ?? [],
            ratingValue: q.kind === "rating" ? answers[q.questionId]?.rating ?? null : null,
            text: q.kind === "text" ? answers[q.questionId]?.text ?? null : null,
            grid: isGridKind(q.kind) ? gridAnswerFor(q, answers[q.questionId]) : undefined,
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

            {answerable.length > 0 ? (
              <div className={styles.progressBox}>
                <div className={styles.progressText}>
                  <span>{t("ความคืบหน้า", "Progress")}</span>
                  <strong>
                    {t(
                      `ตอบแล้ว ${answeredCount} จาก ${answerable.length} ข้อ`,
                      `${answeredCount} of ${answerable.length} answered`,
                    )}
                  </strong>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={answerable.length}
                  aria-valuenow={answeredCount}
                >
                  <div
                    className={styles.progressFill}
                    style={{ width: `${Math.round((answeredCount / Math.max(1, answerable.length)) * 100)}%` }}
                  />
                </div>
                {sections.length > 1 ? (
                  // Denominator is every section on the form, not the visited count: a respondent
                  // expects a page count that does not move under them as they answer.
                  <p className={styles.sectionCounter}>
                    {t(
                      `ส่วนที่ ${sectionIndex} จาก ${sections.length}`,
                      `Section ${sectionIndex} of ${sections.length}`,
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}

            {currentQuestions.map((question, index) => {
              const answer = answers[question.questionId];
              const missing = showMissing && missingRequiredIds.includes(question.questionId);

              // A section break renders as this page's heading, a note as a titled prose block.
              // Neither takes an input, so both return before the question card below.
              if (question.kind === "section" || question.kind === "note") {
                return (
                  <div className={styles.blockCard} key={question.questionId} data-kind={question.kind}>
                    <h3 className={styles.sectionHeader}>{question.text}</h3>
                    {question.description?.trim() ? <p className={styles.blockBody}>{question.description}</p> : null}
                  </div>
                );
              }

              // Legacy section_name grouping, kept for forms authored before real section breaks
              // existed and not yet re-saved. New forms leave section_name null.
              const previousSection = index > 0 ? currentQuestions[index - 1].sectionName : null;
              const startsSection = question.sectionName !== null && question.sectionName !== previousSection;
              return (
                <Fragment key={question.questionId}>
                  {startsSection ? <h3 className={styles.sectionHeader}>{question.sectionName}</h3> : null}
                <div className={styles.questionCard} data-missing={missing} id={questionDomId(question.questionId)}>
                  <div className={styles.questionHeader}>
                    <span className={styles.questionOrder}>{displayNumbers.get(question.questionId) ?? question.order}.</span>
                    <span>{question.text}</span>
                    {question.isRequired ? <span className={styles.required}>*</span> : null}
                  </div>

                  {isGridKind(question.kind) ? (
                    // Rows down the side, columns across the top. A multiple choice grid takes one
                    // column per row (radio, grouped by row); a checkbox grid takes any number.
                    <div className={styles.gridScroll}>
                      <table className={styles.gridTable}>
                        <thead>
                          <tr>
                            <th />
                            {gridColumns(question).map((column) => <th key={column.id} scope="col">{column.text}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {gridRows(question).map((row) => {
                            const picked = answer?.grid[row.id] ?? [];
                            return (
                              <tr key={row.id}>
                                <th scope="row">{row.text}</th>
                                {gridColumns(question).map((column) => (
                                  <td key={column.id}>
                                    <input
                                      type={question.kind === "grid" ? "radio" : "checkbox"}
                                      name={`${question.questionId}-${row.id}`}
                                      aria-label={`${row.text} - ${column.text}`}
                                      checked={picked.includes(column.id)}
                                      onChange={() => toggleGridCell(question, row.id, column.id)}
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : question.kind === "single" || question.kind === "multiple" ? (
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
          {positionInPath > 0 ? (
            <button
              className={styles.secondaryBtn}
              type="button"
              disabled={isSubmitting}
              onClick={() => setSectionIndex(path[positionInPath - 1])}
            >
              {t("ย้อนกลับ", "Back")}
            </button>
          ) : null}
          {isLastSection ? (
            <button
              className={styles.primaryBtn}
              type="button"
              disabled={isSubmitting || timeIsUp || answerable.length === 0}
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? t("กำลังส่ง...", "Submitting...") : t("ส่งคำตอบ", "Submit")}
            </button>
          ) : (
            <button
              className={styles.primaryBtn}
              type="button"
              disabled={isSubmitting || timeIsUp}
              onClick={() => {
                // Gated by THIS page only. Submit still checks the whole visited path, so a gap
                // left behind on an earlier page cannot slip through.
                if (missingOnPage.length > 0) {
                  setShowMissing(true);
                  toast.error(t("กรุณาตอบคำถามที่จำเป็นในส่วนนี้ให้ครบ", "Please answer every required question in this section"));
                  document.getElementById(questionDomId(missingOnPage[0]))?.scrollIntoView({ behavior: "smooth", block: "center" });
                  return;
                }
                const next = resolveNextSection(sections, sectionIndex, selected);
                if (next !== null) setSectionIndex(next);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {t("ถัดไป", "Next")}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
