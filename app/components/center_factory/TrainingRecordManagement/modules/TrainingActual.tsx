"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtime } from "../../../useRealtime";
import { profileValue, useAuthenticatedUser } from "../../../AuthenticatedUserContext";
import { useConfirm } from "../../../ConfirmDialog";
import { useToast } from "../../../ToastHost";
import { useUiLanguage } from "../../../ThaiUiLocalization";
import SearchableSelect from "../../../SearchableSelect";
import {
  formatRollingPlanCompanies,
  getRollingPlanCompanies,
  loadWorkflowRollingPlans,
  type RollingPlan,
} from "../../TrainingPlanManagement/modules/TrainingRolling";
import { listEmployees } from "../../../../lib/employees/client";
import type { EmployeeRecord } from "../../../../lib/employees/types";
import { createEnrollment, EnrollmentApiError, listEnrollments, setEnrollmentAttendance } from "../../../../lib/trainingEnrollment/client";
import {
  emptyEnrollmentStage,
  scoreLabel,
  type AssessmentStageInfo,
  type EnrollmentAssessmentInfo,
  type EnrollmentRecord,
  type EnrollmentStageInfo,
} from "../../../../lib/trainingEnrollment/types";
import {
  getCostBreakdown,
  listTrainingRecords,
  saveTrainingRecordExpenses,
  saveTrainingResults,
} from "../../../../lib/trainingRecord/client";
import {
  EXPENSE_ITEMS,
  completionStatusLabel,
  expiryFrom,
  scorePercentOf,
  type CompletionStatus,
  type TrainingRecordSummary,
} from "../../../../lib/trainingRecord/types";
import { gradeSubmission, listPendingGrading, publishSubmissionResults, readEvaluationSummary } from "../../../../lib/trainingForms/client";
import type { PendingGradingSubmission } from "../../../../lib/trainingForms/types";
import type { CostBreakdown } from "../../../../lib/trainingRecord/types";
import { formatDateDayMonthYear } from "../../../../lib/calendarDate";
import { formatBatchText, formatRoundText, formatBatchRoundText } from "../../../../lib/batchRound";
import styles from "./TrainingRecord.module.css";
import actualStyles from "./TrainingActual.module.css";
import {
  Send,
  Building2,
  Factory,
  Pin,
  Calendar,
  Clock,
  MapPin,
  User,
  Wallet,
  Users,
  CheckCircle2,
  XCircle,
  BarChart3,
  X,
  Check,
  Plus,
  Search,
  FileText,
  AlertTriangle,
  BookOpen,
  Home,
  Utensils,
  Info,
  Zap,
} from "../../../icons/LucideIcons";

function getExpenseIcon(key: string, size = 15) {
  switch (key) {
    case "instructor":
      return <User size={size} />;
    case "traveling":
      return <MapPin size={size} />;
    case "seminarRoom":
      return <Building2 size={size} />;
    case "accommodation":
      return <Home size={size} />;
    case "material":
      return <BookOpen size={size} />;
    case "foodBeverage":
      return <Utensils size={size} />;
    default:
      return <Wallet size={size} />;
  }
}

export const trainingActualModule = {
  title: "Training Actual",
  subtitle: "Actual Attendance",
  description:
    "Check actual attendance, record real training expenses, and save the completed actual record.",
} as const;

/** One master-data employee as a SearchableSelect option for the "add attendee" search - the
 *  component filters on label, secondaryLabel and badge together, so code, English name, Thai
 *  name, company and department are all searchable even though only the Thai name is shown as
 *  the main label. */
const employeeSelectOption = (employee: EmployeeRecord) => {
  const nameEn = `${employee.firstNameEn || ""} ${employee.lastNameEn || ""}`.trim();
  return {
    value: employee.employeeId,
    label: `${employee.firstNameTh} ${employee.lastNameTh}`.trim(),
    secondaryLabel: [employee.employeeCode, nameEn, employee.functionName].filter(Boolean).join(" • "),
    badge: employee.companyCode,
  };
};

type ExpenseKey =
  | "instructor"
  | "traveling"
  | "seminarRoom"
  | "accommodation"
  | "material"
  | "foodBeverage";

type Attendee = {
  id: string;
  employeeCode: string;
  name: string;
  prefix: string;
  firstName: string;
  lastName: string;
  company?: string;
  section?: string;
  division?: string;
  department: string;
  position?: string;
  level?: string;
  registered: boolean;
  attended: boolean;
};

/** One attendee's result while it is being typed. Everything is a string so a half-typed score
 *  does not have to survive a round trip through Number. */
type ResultDraft = {
  /** The MARK, not the percentage the server stores - "8", not "80". A screen showing 80 for a
   *  test out of 10 reads as eighty marks, which is the confusion this whole pair of fields
   *  exists to remove. */
  preScore: string;
  /** Full marks the mark beside it is out of. Blank means nobody knows, and the mark is then a
   *  percentage - the only thing an external test's score can be. */
  preScoreMax: string;
  postScore: string;
  postScoreMax: string;
  completionStatus: CompletionStatus;
  validUntil: string;
  certificateNo: string;
};

const emptyResultDraft: ResultDraft = {
  preScore: "",
  preScoreMax: "",
  postScore: "",
  postScoreMax: "",
  completionStatus: "PENDING",
  validUntil: "",
  certificateNo: "",
};

/**
 * Seeds the form from what is already stored. Without this the boxes come back empty after a
 * save, and editing one person's score rebuilt their whole row from the blank draft - so saving
 * again wiped the certificate number, expiry and status that had been recorded for them.
 */
/** What the system already knows about one person's in-system tests, when the stage is a FORM the
 *  server has graded AND released. An unreleased score is deliberately invisible here too - the
 *  projections null it out, so `score` simply arrives empty. */
const systemScores = (record: EnrollmentRecord) => {
  const pre = record.plan.assessment.preTest;
  const post = record.plan.assessment.postTest;
  const scoreOf = (stage: typeof pre) =>
    stage.mode === "FORM" && stage.submission?.resultsPublished && stage.submission.score !== null
      ? stage.submission.score
      : null;
  // The marks the form is out of, which an in-system form knows before anybody sits it - the total
  // belongs to the paper, not to an attempt. The attempt's own total is the fallback, for a stage
  // whose assessment the plan has since been pointed away from.
  const maxOf = (stage: typeof pre) =>
    stage.mode === "FORM" ? stage.totalScore ?? stage.submission?.scoreMax ?? null : null;

  // The post-test is what decides completion when a course has one; a course with only a pre-test
  // falls back to that. passStatus was computed on the server against the assessment's own
  // passing_score_percent, so the threshold is never re-implemented (or re-typed) here.
  const deciding = post.mode === "FORM" ? post : pre.mode === "FORM" ? pre : null;
  const decidingStatus =
    deciding?.submission?.resultsPublished && deciding.submission.passStatus !== "PENDING"
      ? deciding.submission.passStatus
      : null;

  return {
    preScore: scoreOf(pre),
    preScoreMax: maxOf(pre),
    postScore: scoreOf(post),
    postScoreMax: maxOf(post),
    suggestedCompletion:
      decidingStatus === null ? null : decidingStatus === "PASS" ? ("COMPLETED" as const) : ("NOT_COMPLETED" as const),
  };
};

const numberBox = (value: number | null): string => (value === null ? "" : String(value));

/** What a half-typed mark comes to as a percentage, for the line under the box. Null when there is
 *  nothing to work it out from - a blank mark, or full marks nobody has entered yet. */
const percentOfMark = (score: string, max: string): number | null => {
  const mark = Number(score);
  const total = Number(max);
  if (score.trim() === "" || max.trim() === "" || !Number.isFinite(mark) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return scorePercentOf(mark, total);
};

const draftsFromEnrollments = (records: EnrollmentRecord[]): Record<string, ResultDraft> => {
  const drafts: Record<string, ResultDraft> = {};
  for (const record of records) {
    // The expiry follows from the course's validity period and the training date, so it is filled
    // in rather than asked for. HRD can still change it; what they cannot do is get it wrong on
    // thirty rows by hand.
    const derivedExpiry = expiryFrom(record.plan.startAt, record.plan.validityMonths) ?? "";
    // Tests taken inside the system already produced a score and a pass/fail verdict. Retyping
    // them by hand is both wasted work and a chance to mistype a mark onto a document the employee
    // hands to an employer. HRD still owns the final say: these are prefilled draft values that
    // nothing writes until Save, and every box stays editable.
    const system = systemScores(record);

    if (!record.result) {
      // The marks the paper is out of count as something to prefill on their own: an attendee who
      // has not sat the test yet still has a box that should read "of 3" rather than empty.
      const hasSomethingToPrefill =
        derivedExpiry ||
        system.preScore !== null ||
        system.postScore !== null ||
        system.preScoreMax !== null ||
        system.postScoreMax !== null ||
        system.suggestedCompletion;
      if (hasSomethingToPrefill) {
        drafts[record.id] = {
          ...emptyResultDraft,
          preScore: numberBox(system.preScore),
          preScoreMax: numberBox(system.preScoreMax),
          postScore: numberBox(system.postScore),
          postScoreMax: numberBox(system.postScoreMax),
          completionStatus: system.suggestedCompletion ?? emptyResultDraft.completionStatus,
          validUntil: derivedExpiry,
        };
      }
      continue;
    }

    drafts[record.id] = {
      // A stored score wins: HRD may have corrected it deliberately, and overwriting that from the
      // submission every reload would undo their edit in front of them.
      preScore: numberBox(record.result.preScore ?? system.preScore),
      // An in-system form knows its own total, so that wins; the stored column only carries the
      // full marks of a test this system cannot see.
      preScoreMax: numberBox(system.preScoreMax ?? record.result.preLinkScoreMax),
      postScore: numberBox(record.result.postScore ?? system.postScore),
      postScoreMax: numberBox(system.postScoreMax ?? record.result.postLinkScoreMax),
      completionStatus:
        record.result.completionStatus === "PENDING" && system.suggestedCompletion
          ? system.suggestedCompletion
          : record.result.completionStatus,
      validUntil: record.result.validUntil ?? derivedExpiry,
      certificateNo: record.result.certificateNo ?? "",
    };
  }
  return drafts;
};

const parseNameParts = (fullName: string) => {
  const knownPrefixes = [
    "นางสาว",
    "นาย",
    "นาง",
    "Mr.",
    "Ms.",
    "Mrs.",
    "Dr.",
    "ดร.",
  ];

  let raw = (fullName || "").trim();
  let foundPrefix = "";

  for (const p of knownPrefixes) {
    if (raw.startsWith(p)) {
      foundPrefix = p;
      raw = raw.slice(p.length).trim();
      break;
    }
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || raw || "-";
  const lastName = parts.slice(1).join(" ") || "-";

  return {
    prefix: foundPrefix || "-",
    firstName,
    lastName,
  };
};

type ActualCourse = {
  id: string;
  groupId: string;
  code: string;
  title: string;
  date: string;
  batch?: string;
  batchNo?: number;
  batchName?: string;
  batchText?: string;
  roundText?: string;
  batchRoundLabel?: string;
  startTime?: string;
  endTime?: string;
  time: string;
  room: string;
  company: string;
  relatedCompanies?: string[];
  owner: "CENTER" | "FACTORY";
  ownerCompany?: string;
  instructor: string;
  hours?: string;
  budget?: string;
};

type ActualCourseGroup = {
  id: string;
  code: string;
  title: string;
  owner: "CENTER" | "FACTORY";
  sessions: ActualCourse[];
};

type CourseOwner = ActualCourse["owner"];
type CourseOwnerFilter = CourseOwner | "";

/**
 * The three steps that pick what this screen is about - the scope, the course, and the session -
 * survive leaving the page and coming back. Without this, opening an attempt or reloading dropped
 * HRD at Step 1 mid-way through recording a course they had already chosen three times over.
 *
 * sessionStorage, not localStorage: this is where somebody is in a piece of work, not a setting,
 * and a new tab or a new day should start from the top rather than from a course that has since
 * been closed. Ids that no longer exist simply resolve to nothing, which the screen already draws
 * as "not chosen yet" - a stale entry cannot select the wrong course.
 */
const SELECTION_STORAGE_KEY = "training-actual:selection";

type StoredSelection = { owner: CourseOwnerFilter; groupId: string; courseId: string };

const emptySelection: StoredSelection = { owner: "", groupId: "", courseId: "" };

const loadSelection = (): StoredSelection => {
  if (typeof window === "undefined") return emptySelection;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(SELECTION_STORAGE_KEY) || "{}");
    return {
      owner: stored?.owner === "CENTER" || stored?.owner === "FACTORY" ? stored.owner : "",
      groupId: typeof stored?.groupId === "string" ? stored.groupId : "",
      courseId: typeof stored?.courseId === "string" ? stored.courseId : "",
    };
  } catch {
    // Private browsing, or somebody hand-edited the entry. Starting at Step 1 is the old behaviour.
    return emptySelection;
  }
};

const saveSelection = (selection: StoredSelection) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // A full quota costs three clicks. Nothing to recover from.
  }
};

// Shared with Training Record. Each screen used to keep its own list, so the same key read
// "ค่าวัดผล / เอกสารประกอบ" on the form and "ค่าเอกสาร & อุปกรณ์" on the report.
const expenseFields = EXPENSE_ITEMS;

const emptyExpenses: Record<ExpenseKey, string> = {
  instructor: "",
  traveling: "",
  seminarRoom: "",
  accommodation: "",
  material: "",
  foodBeverage: "",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);

const parseMoney = (value?: string) => {
  const normalizedValue = value?.replace(/[^\d.-]/g, "") ?? "";
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

// Same shape TrainingRolling.tsx already uses to detect a center-owned plan — a course is
// "center" if it's owned centrally or targets every company, regardless of which field carries
// that signal for a given data source.
const isCenterCourse = (course: Pick<ActualCourse, "owner" | "ownerCompany" | "company">) =>
  course.owner === "CENTER" ||
  (course.ownerCompany ?? course.company) === "HRD Center" ||
  course.company === "All Companies";

type GradeDraft = Record<string, { scoreAwarded: string; reviewComment: string }>;

/**
 * The written-answer questions no autograder can score, waiting on an HRD reviewer. Lives here
 * (not on Training Record's open/close panel) because grading produces a score, and this is
 * already where HRD enters every other score for the plan.
 */
const PendingGradingPanel = ({ planId, onGraded }: { planId: string; onGraded: (enrollmentId: string) => void }) => {
  const toast = useToast();
  const { language } = useUiLanguage();
  const t = (th: string, en: string) => (language === "th" ? th : en);
  const [submissions, setSubmissions] = useState<PendingGradingSubmission[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, GradeDraft>>({});
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  /** Employee code (or name) of the one open row. One at a time: HRD grades one person, saves,
   *  moves on - keeping every row open is what made this panel unreadable. */
  const [openEmployee, setOpenEmployee] = useState("");

  const load = () => {
    listPendingGrading(planId)
      .then((result) => setSubmissions(result.submissions))
      .catch(() => setSubmissions([]));
  };

  useEffect(() => {
    setSubmissions(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const setAnswerDraft = (submissionId: string, answerId: string, patch: Partial<GradeDraft[string]>) =>
    setDrafts((current) => {
      const existing = current[submissionId]?.[answerId] ?? { scoreAwarded: "0", reviewComment: "" };
      return {
        ...current,
        [submissionId]: { ...current[submissionId], [answerId]: { ...existing, ...patch } },
      };
    });

  const handleSave = async (submission: PendingGradingSubmission) => {
    const draft = drafts[submission.submissionId] ?? {};
    const answers = submission.pendingAnswers.map((answer) => {
      const entry = draft[answer.answerId] ?? { scoreAwarded: "0", reviewComment: "" };
      return {
        answerId: answer.answerId,
        scoreAwarded: Number(entry.scoreAwarded) || 0,
        reviewComment: entry.reviewComment.trim() || null,
      };
    });

    setSavingSubmissionId(submission.submissionId);
    try {
      await gradeSubmission(planId, submission.submissionId, { answers });
      toast.success(t(`บันทึกคะแนนของ ${submission.employeeName} แล้ว`, `Marks saved for ${submission.employeeName}`));
      load();
      onGraded(submission.enrollmentId);
    } catch {
      toast.error(t("บันทึกคะแนนไม่สำเร็จ กรุณาลองใหม่", "Could not save the marks. Please try again."));
    } finally {
      setSavingSubmissionId(null);
    }
  };

  const handlePublish = async (submission: PendingGradingSubmission) => {
    setSavingSubmissionId(submission.submissionId);
    try {
      await publishSubmissionResults(planId, submission.submissionId);
      toast.success(t(`ประกาศผลของ ${submission.employeeName} แล้ว`, `Result released for ${submission.employeeName}`));
      load();
      onGraded(submission.enrollmentId);
    } catch {
      toast.error(t("ประกาศผลไม่สำเร็จ กรุณาลองใหม่", "Could not release the result. Please try again."));
    } finally {
      setSavingSubmissionId(null);
    }
  };

  if (submissions === null || submissions.length === 0) return null;

  // One person, all their outstanding submissions. The panel used to be a flat list, so an employee
  // with both a pre-test and a post-test to mark appeared as two unrelated cards with the same name
  // - and a wide row per answer pushed the score box off the side of the screen.
  const byEmployee = new Map<string, { name: string; code: string; rows: PendingGradingSubmission[] }>();
  for (const submission of submissions) {
    const groupKey = submission.employeeCode || submission.employeeName;
    const group = byEmployee.get(groupKey);
    if (group) group.rows.push(submission);
    else byEmployee.set(groupKey, { name: submission.employeeName, code: submission.employeeCode, rows: [submission] });
  }
  const groups = [...byEmployee.entries()].map(([groupKey, group]) => ({ groupKey, ...group }));

  return (
    <section className={styles.actualResultsPanel} aria-label="Pending written-answer grading" style={{ marginBottom: "16px" }}>
      <div className={styles.actualResultsHeader}>
        <div>
          <span>{t("รอตรวจ / รอประกาศผล", "Awaiting marking or release")}</span>
          <strong>Pending Grading &amp; Release</strong>
        </div>
        <small>{t(`${groups.length} คน · ${submissions.length} รายการ`, `${groups.length} people · ${submissions.length} papers`)}</small>
      </div>

      {/* Not .actualResultsRows: that one caps at 420px and scrolls inside itself, which suited a
          flat list of short rows. An expanded person is taller than the cap, and an inner
          scrollbar competing with the page's own is worse than simply letting the panel grow. */}
      <div className={styles.gradingQueue}>
        {groups.map((group) => {
          const isOpen = openEmployee === group.groupKey;
          const toGrade = group.rows.filter((row) => !row.awaitingPublication).length;
          const toRelease = group.rows.length - toGrade;
          return (
        <article key={group.groupKey} className={styles.gradingGroup}>
          <button
            type="button"
            className={styles.gradingGroupHeader}
            aria-expanded={isOpen}
            onClick={() => setOpenEmployee(isOpen ? "" : group.groupKey)}
          >
            <span className={styles.gradingChevron} data-open={isOpen} aria-hidden="true" />
            <span>
              <strong>{group.name}</strong>
              <small>{group.code || "-"}</small>
            </span>
            <span className={styles.gradingGroupTags}>
              {toGrade > 0 ? <em data-tone="grade">{t(`รอตรวจ ${toGrade}`, `${toGrade} to mark`)}</em> : null}
              {toRelease > 0 ? <em data-tone="release">{t(`รอประกาศผล ${toRelease}`, `${toRelease} to release`)}</em> : null}
            </span>
          </button>

          {isOpen ? group.rows.map((submission) => (
          <div key={submission.submissionId} className={styles.gradingSubmission}>
            <div className={styles.actualResultWho}>
              <strong>{submission.stage === "PRE_TEST" ? t("แบบทดสอบก่อนอบรม", "Pre test") : t("แบบทดสอบหลังอบรม", "Post test")}</strong>
              <small>
                {t(`ครั้งที่ ${submission.attemptNo}`, `Attempt ${submission.attemptNo}`)} ·{" "}
                {submission.awaitingPublication
                  ? t("ตรวจแล้ว รอประกาศผล", "Marked, awaiting release")
                  : t(`รอตรวจ ${submission.pendingAnswers.length} ข้อ`, `${submission.pendingAnswers.length} to mark`)}
              </small>
            </div>

            {submission.pendingAnswers.map((answer) => {
              const entry = drafts[submission.submissionId]?.[answer.answerId] ?? { scoreAwarded: "0", reviewComment: "" };
              return (
                <div key={answer.answerId} className={styles.gradingAnswer}>
                  <span className={styles.gradingQuestion}>{answer.questionText}</span>
                  <p className={styles.gradingAnswerText}>{answer.answerText || t("(ไม่มีคำตอบ)", "(no answer)")}</p>
                  <div className={styles.gradingInputs}>
                    <label>
                      <span>{t("คะแนน", "Mark")}</span>
                      <input
                        type="number"
                        min={0}
                        max={Number(answer.questionScore)}
                        value={entry.scoreAwarded}
                        onChange={(e) => setAnswerDraft(submission.submissionId, answer.answerId, { scoreAwarded: e.target.value })}
                      />
                      <small>/ {answer.questionScore}</small>
                    </label>
                    <input
                      type="text"
                      placeholder={t("ความเห็นถึงผู้เรียน (ถ้ามี)", "Comment for the learner (optional)")}
                      value={entry.reviewComment}
                      onChange={(e) => setAnswerDraft(submission.submissionId, answer.answerId, { reviewComment: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}

            {submission.awaitingPublication ? (
              <button
                type="button"
                className={styles.gradingSaveButton}
                disabled={savingSubmissionId === submission.submissionId}
                onClick={() => void handlePublish(submission)}
              >
                {savingSubmissionId === submission.submissionId ? (
                  t("กำลังประกาศผล...", "Releasing...")
                ) : (
                  <>
                    <Send size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                    {t("ประกาศผลให้พนักงาน", "Release to the employee")}
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                className={styles.gradingSaveButton}
                disabled={savingSubmissionId === submission.submissionId}
                onClick={() => void handleSave(submission)}
              >
                {savingSubmissionId === submission.submissionId ? t("กำลังบันทึก...", "Saving...") : t("บันทึกคะแนน", "Save marks")}
              </button>
            )}
          </div>
          )) : null}
        </article>
          );
        })}
      </div>
    </section>
  );
};

const evaluationStateOf = (
  stage: AssessmentStageInfo | undefined,
  completed: boolean,
): "Done" | "Pending" | "None" | "External" => {
  if (completed) return "Done";
  if (!stage || stage.mode === "NONE") return "None";
  if (stage.mode === "LINK") return "External";
  return "Pending";
};

export default function TrainingActual() {
  const user = useAuthenticatedUser();
  const toast = useToast();
  const confirm = useConfirm();
  const [masterEmployees, setMasterEmployees] = useState<EmployeeRecord[]>([]);
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);
  const [draftAttendees, setDraftAttendees] = useState<EmployeeRecord[]>([]);
  const [isSavingDraftAttendees, setIsSavingDraftAttendees] = useState(false);
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});
  const [evaluationSubmissionsCount, setEvaluationSubmissionsCount] = useState<number | null>(null);
  /** The attempts card: one attendee's papers for both stages, opened from their result row. */
  const [attemptsCard, setAttemptsCard] = useState<{
    enrollmentId: string;
    name: string;
    preTest: EnrollmentStageInfo;
    postTest: EnrollmentStageInfo;
  } | null>(null);
  const [attemptsStage, setAttemptsStage] = useState<"preTest" | "postTest">("postTest");
  const [isSavingResults, setIsSavingResults] = useState(false);
  const noAssessment: EnrollmentAssessmentInfo = {
    preTest: emptyEnrollmentStage,
    postTest: emptyEnrollmentStage,
    evaluation: emptyEnrollmentStage,
    evaluationAfter30Day: emptyEnrollmentStage,
  };
  const { language } = useUiLanguage();
  const isThai = language === "th";
  /** Both strings at the call site rather than a dictionary key: this screen is read beside the
   *  Thai paperwork it records, and a key would put the wording a file away from its use. */
  const t = (th: string, en: string) => (isThai ? th : en);
  const [courses, setCourses] = useState<ActualCourse[]>([]);
  const [courseOwnerFilter, setCourseOwnerFilter] = useState<CourseOwnerFilter>(() => loadSelection().owner);
  const [selectedCourseGroupId, setSelectedCourseGroupId] = useState(() => loadSelection().groupId);
  const [selectedCourseId, setSelectedCourseId] = useState(() => loadSelection().courseId);
  const [savedMessage, setSavedMessage] = useState("");
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [savedSummaryData, setSavedSummaryData] = useState<{
    courseCode: string;
    courseTitle: string;
    batch: string;
    date: string;
    actualCount: number;
    totalCost: number;
    costPerPerson: number;
    savedTime: string;
  } | null>(null);
  const isFactoryUser = user?.roleCode === "HRD_FACTORY";
  const userCompanyCode = profileValue(user?.companyCode);
  const [rollingPlans, setRollingPlans] = useState<RollingPlan[]>([]);
  const [recordedPlanIds, setRecordedPlanIds] = useState<Set<string>>(new Set());
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [expenses, setExpenses] = useState<Record<ExpenseKey, string>>(emptyExpenses);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);

  const reloadPlansAndRecords = useCallback(async () => {
    try {
      const [plans, recordResult] = await Promise.all([
        loadWorkflowRollingPlans().catch(() => []),
        listTrainingRecords().catch(() => ({ trainingRecords: [] as TrainingRecordSummary[] })),
      ]);
      const recordedSet = new Set<string>();
      (recordResult.trainingRecords || []).forEach((r) => {
        if (r.planId) recordedSet.add(String(r.planId));
      });
      plans.forEach((p) => {
        if (p.dbStatus === "COMPLETED" || (p as any).status === "COMPLETED") {
          recordedSet.add(String(p.rollingId));
        }
      });
      setRecordedPlanIds(recordedSet);
      setRollingPlans(plans);
    } catch (error) {
      console.error("Failed to load plans or records", error);
    }
  }, []);

  useEffect(() => {
    void reloadPlansAndRecords();
  }, [reloadPlansAndRecords]);

  useEffect(() => {
    let active = true;
    void listEmployees()
      .then((result) => {
        if (active) setMasterEmployees(result.items || []);
      })
      .catch(() => {
        if (active) setMasterEmployees([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nextCourses = rollingPlans
      .filter(
        (plan) =>
          plan.status === "Planned" &&
          plan.dbStatus !== "COMPLETED" &&
          !recordedPlanIds.has(String(plan.rollingId)),
      )
      .map<ActualCourse>((plan) => ({
        id: plan.rollingId,
        groupId: plan.scheduleGroupId,
        code: plan.course.code,
        title: plan.course.name,
        date: plan.trainingDate,
        batchNo: plan.batchNo,
        batchName: plan.batchName,
        batchText: formatBatchText(plan, isThai),
        roundText: formatRoundText(plan, isThai),
        batchRoundLabel: formatBatchRoundText(plan, isThai),
        batch: formatBatchRoundText(plan, isThai) || plan.batch,
        startTime: plan.startTime,
        endTime: plan.endTime,
        time: `${plan.startTime} - ${plan.endTime}`,
        room: plan.location,
        company: formatRollingPlanCompanies(plan),
        relatedCompanies: getRollingPlanCompanies(plan),
        owner: plan.ownerScope === "CENTER" ? "CENTER" : "FACTORY",
        ownerCompany:
          plan.ownerScope === "CENTER"
            ? "HRD Center"
            : plan.ownerCompany ?? plan.company,
        instructor: plan.trainer,
        hours: plan.hours,
        budget: plan.budget,
      }));

    setCourses(nextCourses);
  }, [rollingPlans, recordedPlanIds]);
  const availableCourses = useMemo(
    () =>
      isFactoryUser
        ? courses.filter(
            (course) =>
              course.owner === "FACTORY" &&
              (course.ownerCompany ?? course.company) === userCompanyCode,
          )
        : courses,
    [courses, isFactoryUser, userCompanyCode],
  );

  useEffect(() => {
    if (isFactoryUser && courseOwnerFilter !== "FACTORY") {
      setCourseOwnerFilter("FACTORY");
    }
  }, [isFactoryUser, courseOwnerFilter]);

  useEffect(() => {
    saveSelection({ owner: courseOwnerFilter, groupId: selectedCourseGroupId, courseId: selectedCourseId });
  }, [courseOwnerFilter, selectedCourseGroupId, selectedCourseId]);
  const selectedCourseOwner: CourseOwnerFilter = courseOwnerFilter;
  const ownerFilteredCourses = useMemo(
    () =>
      selectedCourseOwner
        ? availableCourses.filter((course) => course.owner === selectedCourseOwner)
        : [],
    [availableCourses, selectedCourseOwner],
  );
  const availableCourseGroups = useMemo<ActualCourseGroup[]>(() => {
    const groups = new Map<string, ActualCourse[]>();

    ownerFilteredCourses.forEach((course) => {
      groups.set(course.groupId, [...(groups.get(course.groupId) ?? []), course]);
    });

    return [...groups.entries()].map(([id, sessions]) => {
      const sortedSessions = [...sessions].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startTime ?? "").localeCompare(b.startTime ?? ""),
      );
      const firstSession = sortedSessions[0];

      return {
        id,
        code: firstSession.code,
        title: firstSession.title,
        owner: firstSession.owner,
        sessions: sortedSessions,
      };
    });
  }, [ownerFilteredCourses]);
  const selectedCourseGroup =
    availableCourseGroups.find((group) => group.id === selectedCourseGroupId) ??
    null;
  const availableSessions = selectedCourseGroup?.sessions ?? [];
  const selectedCourse =
    availableSessions.find((course) => course.id === selectedCourseId) ?? null;
  const isSelectedCourseCenter = selectedCourse ? isCenterCourse(selectedCourse) : false;
  const isSelectedCourseReadOnlyForFactory = isFactoryUser && isSelectedCourseCenter;

  useEffect(() => {
    if (selectedCourseGroupId && availableCourseGroups.length > 0 && !availableCourseGroups.some((group) => group.id === selectedCourseGroupId)) {
      setSelectedCourseGroupId("");
      setSelectedCourseId("");
      return;
    }
    if (selectedCourseId && availableSessions.length > 0 && !availableSessions.some((session) => session.id === selectedCourseId)) {
      setSelectedCourseId(availableSessions[0]?.id ?? "");
    }
  }, [availableCourseGroups, availableSessions, selectedCourseGroupId, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourse) {
      setEnrollments([]);
      return;
    }
    let active = true;
    listEnrollments({ planId: selectedCourse.id, employeeId: null, employeeUserId: null })
      .then((result) => {
        if (!active) return;
        const loaded = result.enrollments || [];
        setEnrollments(loaded);
        // Switching course starts a fresh form, seeded from whatever is already recorded.
        setResultDrafts(draftsFromEnrollments(loaded));
      })
      .catch((error) => {
        console.error("Failed to load attendees", error);
        if (active) setEnrollments([]);
      });
    return () => {
      active = false;
    };
  }, [selectedCourse?.id]);

  useEffect(() => {
    setExpenses(emptyExpenses);
    setSavedMessage("");
  }, [selectedCourse?.id]);

  useEffect(() => {
    if (!selectedCourse?.id) {
      setEvaluationSubmissionsCount(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      readEvaluationSummary(selectedCourse.id, "EVALUATION", "EMPLOYEE").catch(() => ({ summary: null })),
      readEvaluationSummary(selectedCourse.id, "EVALUATION_30DAY", "EMPLOYEE").catch(() => ({ summary: null })),
      readEvaluationSummary(selectedCourse.id, "EVALUATION_30DAY", "SUPERVISOR").catch(() => ({ summary: null })),
    ]).then((results) => {
      if (cancelled) return;
      const anyForm = results.some((result) => result.summary !== null);
      setEvaluationSubmissionsCount(
        anyForm ? results.reduce((sum, result) => sum + (result.summary?.submittedCount ?? 0), 0) : null,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCourse?.id]);

  // Returns what it fetched. The save handler needs the fresh numbers in the same tick, and
  // reading them back from state would show whatever was on screen before the save.
  // `isStale` lets the effect below discard a response for a course the user has already moved off,
  // while the save handler — which calls this for the value, not the render — always keeps it.
  const reloadCostBreakdown = async (
    planId: string,
    isStale: () => boolean = () => false,
    syncExpenses: boolean = false,
  ) => {
    try {
      const result = await getCostBreakdown(planId);
      if (!isStale()) {
        const cb = result.costBreakdown;
        setCostBreakdown(cb);
        if (syncExpenses && cb) {
          const hasActuals =
            cb.actualGrandTotal > 0 ||
            Object.values(cb.actualTotals || {}).some((v) => Number(v) > 0);
          if (hasActuals && cb.actualTotals) {
            setExpenses({
              instructor: cb.actualTotals.instructor != null && cb.actualTotals.instructor !== 0 ? String(cb.actualTotals.instructor) : (cb.actualTotals.instructor === 0 ? "0" : ""),
              traveling: cb.actualTotals.traveling != null && cb.actualTotals.traveling !== 0 ? String(cb.actualTotals.traveling) : (cb.actualTotals.traveling === 0 ? "0" : ""),
              seminarRoom: cb.actualTotals.seminarRoom != null && cb.actualTotals.seminarRoom !== 0 ? String(cb.actualTotals.seminarRoom) : (cb.actualTotals.seminarRoom === 0 ? "0" : ""),
              accommodation: cb.actualTotals.accommodation != null && cb.actualTotals.accommodation !== 0 ? String(cb.actualTotals.accommodation) : (cb.actualTotals.accommodation === 0 ? "0" : ""),
              material: cb.actualTotals.material != null && cb.actualTotals.material !== 0 ? String(cb.actualTotals.material) : (cb.actualTotals.material === 0 ? "0" : ""),
              foodBeverage: cb.actualTotals.foodBeverage != null && cb.actualTotals.foodBeverage !== 0 ? String(cb.actualTotals.foodBeverage) : (cb.actualTotals.foodBeverage === 0 ? "0" : ""),
            });
          } else {
            setExpenses(emptyExpenses);
          }
        }
      }
      return result.costBreakdown;
    } catch (error) {
      console.error("Failed to load cost breakdown", error);
      if (!isStale()) setCostBreakdown(null);
      return null;
    }
  };

  useEffect(() => {
    if (!selectedCourse) {
      setCostBreakdown(null);
      return;
    }
    // Without this, a slow response for course A could land after course B's and paint A's budget
    // and actual expenses next to B's title and attendees — and a save from that screen would write
    // B's plan with A's numbers. The attendee effect above already guards itself the same way.
    let active = true;
    void reloadCostBreakdown(selectedCourse.id, () => !active, true);
    return () => {
      active = false;
    };
  }, [selectedCourse?.id]);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCourse?.id]);

  const attendees: Attendee[] = selectedCourse
    ? enrollments
        .filter((candidate) =>
          selectedCourse.owner === "CENTER"
            ? candidate.status === "Center Approved"
            : candidate.status === "Factory Approved",
        )
        .map((candidate) => {
          const nameParts = parseNameParts(candidate.employeeName);
          return {
            id: candidate.id,
            employeeCode: candidate.employeeCode,
            name: candidate.employeeName,
            prefix: (candidate as any).prefix || nameParts.prefix,
            firstName: (candidate as any).firstName || nameParts.firstName,
            lastName: (candidate as any).lastName || nameParts.lastName,
            company: candidate.company,
            section: (candidate as any).section || "-",
            division: (candidate as any).division || "-",
            department: candidate.department || "-",
            position: candidate.position || "-",
            level: candidate.level || "-",
            registered: true,
            // Present-only, matching the server's cost-breakdown counting rule
            attended: candidate.attendance?.status === "PRESENT",
          };
        })
    : [];

  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [attendanceCompanyFilter, setAttendanceCompanyFilter] = useState("ALL");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");

  const filteredAttendees = useMemo(() => {
    return attendees.filter((attendee) => {
      if (
        attendanceCompanyFilter !== "ALL" &&
        attendee.company !== attendanceCompanyFilter
      ) {
        return false;
      }
      if (attendanceStatusFilter === "PRESENT" && !attendee.attended) {
        return false;
      }
      if (attendanceStatusFilter === "ABSENT" && attendee.attended) {
        return false;
      }
      if (attendanceSearchQuery.trim()) {
        const query = attendanceSearchQuery.toLowerCase().trim();
        const matchesCode = (attendee.employeeCode || "").toLowerCase().includes(query);
        const matchesName = (attendee.name || `${attendee.firstName} ${attendee.lastName}`).toLowerCase().includes(query);
        const matchesDept = (attendee.department || "").toLowerCase().includes(query);
        const matchesPos = (attendee.position || "").toLowerCase().includes(query);
        return matchesCode || matchesName || matchesDept || matchesPos;
      }
      return true;
    });
  }, [attendees, attendanceCompanyFilter, attendanceStatusFilter, attendanceSearchQuery]);

  const attendeeCompanyList = useMemo(() => {
    const companies = new Set<string>();
    attendees.forEach((att) => {
      if (att.company) companies.add(att.company);
    });
    return Array.from(companies).sort();
  }, [attendees]);

  const totalPages = Math.ceil(filteredAttendees.length / PAGE_SIZE) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * PAGE_SIZE;
  const pagedAttendees = useMemo(
    () => filteredAttendees.slice(startIndex, startIndex + PAGE_SIZE),
    [filteredAttendees, startIndex],
  );

  const actualCount = attendees.filter((attendee) => attendee.attended).length;
  const walkInCount = attendees.filter((attendee) => attendee.attended && !attendee.registered).length;
  const registeredCount = attendees.filter((attendee) => attendee.registered).length;
  const absentCount = attendees.length - actualCount;
  const expenseTotal = expenseFields.reduce(
    (total, field) => total + parseMoney(expenses[field.key]),
    0,
  );
  const hasExpenseInputs = Object.values(expenses).some((val) => val.trim() !== "");
  const effectiveActualTotal = hasExpenseInputs ? expenseTotal : (costBreakdown?.actualGrandTotal ?? 0);
  const plannedBudget = costBreakdown?.plannedGrandTotal ?? (selectedCourse ? parseMoney(selectedCourse.budget) : 0);
  const effectiveRemainingBudget = plannedBudget - effectiveActualTotal;
  const presentAttendeesCount = costBreakdown?.presentCount ?? actualCount;
  const effectiveCostPerPerson = presentAttendeesCount > 0 ? Math.round((effectiveActualTotal / presentAttendeesCount) * 100) / 100 : 0;
  const actualCostPerPerson = effectiveCostPerPerson;
  const savedActualTotal = effectiveActualTotal;
  const remainingBudget = effectiveRemainingBudget;
  const budgetStatus =
    plannedBudget > 0 && remainingBudget < 0 ? "Over budget" : "Within budget";
  const allAttended = Boolean(
    attendees.length && attendees.every((attendee) => attendee.attended),
  );
  const allPassed = Boolean(
    attendees.length &&
      attendees.every((attendee) => (resultDrafts[attendee.id] ?? emptyResultDraft).completionStatus === "COMPLETED"),
  );
  const companyCostBreakdown = costBreakdown?.companyBreakdown ?? [];

  const reloadEnrollments = async () => {
    if (!selectedCourse) return;
    try {
      const result = await listEnrollments({ planId: selectedCourse.id, employeeId: null, employeeUserId: null });
      const loaded = result.enrollments || [];
      setEnrollments(loaded);
      // Keep whatever is being typed; only fill in rows that have no draft yet.
      setResultDrafts((current) => ({ ...draftsFromEnrollments(loaded), ...current }));
    } catch (error) {
      console.error("Failed to reload attendees", error);
    }
  };

  // People scanning the QR code show up while HRD watches; drafts being typed are kept (see above).
  useRealtime(["attendance.changed", "enrollment.changed"], () => void reloadEnrollments(), {
    planId: selectedCourse?.id ?? null,
    debounceMs: 800,
  });

  // The general reload above deliberately keeps whatever HRD already has open in a draft, which
  // is right for protecting mid-typing edits but wrong here: HRD just graded a written answer and
  // the score that grading produced would otherwise be masked by whatever training_result held at
  // the last page load. Overwrite only the one row that changed.
  const handleGraded = async (enrollmentId: string) => {
    if (!selectedCourse) return;
    try {
      const result = await listEnrollments({ planId: selectedCourse.id, employeeId: null, employeeUserId: null });
      const loaded = result.enrollments || [];
      setEnrollments(loaded);
      const fresh = draftsFromEnrollments(loaded);
      setResultDrafts((current) => ({ ...current, ...(fresh[enrollmentId] ? { [enrollmentId]: fresh[enrollmentId] } : {}) }));
    } catch (error) {
      console.error("Failed to refresh the graded attendee", error);
    }
  };

  const toggleAttendance = async (enrollmentId: string, attended: boolean) => {
    if (isSelectedCourseReadOnlyForFactory) return;
    const nextAttended = !attended;

    // Optimistic UI update so the attendance toggle flips IMMEDIATELY with 0ms lag
    setEnrollments((current) =>
      current.map((en) =>
        en.id === enrollmentId
          ? {
              ...en,
              attendance: nextAttended
                ? {
                    attendanceId: en.attendance?.attendanceId || "temp",
                    status: "PRESENT",
                    checkInAt: new Date().toISOString(),
                    checkOutAt: null,
                    method: "MANUAL",
                    recordedBy: null,
                    remark: "",
                  }
                : null,
            }
          : en,
      ),
    );

    try {
      await setEnrollmentAttendance(enrollmentId, { attended: nextAttended });
      await reloadEnrollments();
      if (selectedCourse) await reloadCostBreakdown(selectedCourse.id);
    } catch (error) {
      console.error("Failed to update attendance", error);
      await reloadEnrollments();
      toast.error(t("บันทึกการเช็คชื่อไม่สำเร็จ", "Failed to update attendance"));
    }
  };

  const setAllAttendance = async (attended: boolean) => {
    if (isSelectedCourseReadOnlyForFactory) return;

    // Optimistic UI update for all attendees
    setEnrollments((current) =>
      current.map((en) => ({
        ...en,
        attendance: attended
          ? {
              attendanceId: en.attendance?.attendanceId || "temp",
              status: "PRESENT",
              checkInAt: new Date().toISOString(),
              checkOutAt: null,
              method: "MANUAL",
              recordedBy: null,
              remark: "",
            }
          : null,
      })),
    );

    try {
      await Promise.all(
        attendees
          .filter((attendee) => attendee.attended !== attended)
          .map((attendee) => setEnrollmentAttendance(attendee.id, { attended })),
      );
      await reloadEnrollments();
      if (selectedCourse) await reloadCostBreakdown(selectedCourse.id);
    } catch (error) {
      console.error("Failed to update attendance", error);
      await reloadEnrollments();
      toast.error(t("บันทึกการเช็คชื่อไม่สำเร็จ", "Failed to update attendance"));
    }
  };

  /** Picking a search result adds them to the draft basket instead of saving immediately, so HRD
   *  can gather several people before committing them all at once. */
  const addEmployeeToDraft = (employeeId: string) => {
    const master = masterEmployees.find((employee) => employee.employeeId === employeeId);
    if (!master) return;
    setDraftAttendees((current) =>
      current.some((employee) => employee.employeeId === master.employeeId)
        ? current
        : [...current, master],
    );
  };

  const removeDraftAttendee = (employeeId: string) => {
    setDraftAttendees((current) => current.filter((employee) => employee.employeeId !== employeeId));
  };

  /** Enrols one employee for real; if the plan has a prerequisite they have not completed, asks
   *  HRD to confirm by name before overriding it. Mirrors TrainingAcceptSurvey's own version of
   *  this same override flow. Returns null only when HRD cancels that override prompt. */
  const enrollAttendeeWithPrerequisiteCheck = async (employee: EmployeeRecord, planId: string, source: "HRD_CENTER" | "HRD_FACTORY") => {
    const employeeLabel = `${employee.firstNameTh} ${employee.lastNameTh} (${employee.employeeCode})`;
    try {
      return await createEnrollment({ planId, employeeId: employee.employeeId, employeeUserId: employee.userId, source });
    } catch (error) {
      if (!(error instanceof EnrollmentApiError) || error.code !== "PREREQUISITE_NOT_MET") throw error;
      const details = error.details as { missingCourseNames?: string } | undefined;
      const missingNames = (details?.missingCourseNames || "").split(",").filter(Boolean).join(", ");
      const ok = await confirm({
        title: { th: "ยังไม่ผ่านหลักสูตรก่อนหน้า", en: "Prerequisite not completed" },
        message: {
          th: `${employeeLabel} ยังไม่ผ่านการอบรมหลักสูตร ${missingNames}\nยืนยันที่จะเพิ่มเข้าหลักสูตรนี้หรือไม่?`,
          en: `${employeeLabel} has not completed ${missingNames}. Add them anyway?`,
        },
        confirmLabel: { th: "ยืนยันให้เพิ่ม", en: "Add anyway" },
        cancelLabel: { th: "ข้ามคนนี้", en: "Skip" },
        danger: true,
      });
      if (!ok) return null;
      return createEnrollment({ planId, employeeId: employee.employeeId, employeeUserId: employee.userId, source, acknowledgePrerequisite: true });
    }
  };

  /** Commits the draft basket for real: creates (and auto-approves, since HRD is adding them
   *  directly) an enrollment per person, then reloads the attendance checklist so they land in it
   *  like anyone else - HRD checks them present and grades them from there, same as usual. Once
   *  saved there is no undo from this screen, which is why the confirm prompt says so up front. */
  const saveDraftAttendees = async () => {
    if (!selectedCourse) return;
    if (draftAttendees.length === 0) {
      toast.error(t("กรุณาค้นหาและเลือกพนักงานอย่างน้อย 1 คน", "Search and select at least one employee"));
      return;
    }

    const ok = await confirm({
      title: { th: "ยืนยันการเพิ่มผู้เข้าอบรม", en: "Confirm adding attendees" },
      message: {
        th: `เมื่อบันทึกแล้วจะแก้ไขไม่ได้ ยืนยันที่จะเพิ่ม ${draftAttendees.length} คนเข้า ${selectedCourse.code} หรือไม่?`,
        en: `Once saved this cannot be edited. Add ${draftAttendees.length} attendee(s) to ${selectedCourse.code}?`,
      },
      confirmLabel: { th: "ยืนยันบันทึก", en: "Confirm & Save" },
      cancelLabel: { th: "ยกเลิก", en: "Cancel" },
      danger: true,
    });
    if (!ok) return;

    setIsSavingDraftAttendees(true);
    const source = isFactoryUser ? "HRD_FACTORY" : "HRD_CENTER";
    const added: string[] = [];
    const skipped: string[] = [];
    try {
      for (const employee of draftAttendees) {
        const employeeLabel = `${employee.firstNameTh} ${employee.lastNameTh}`;
        const enrollment = await enrollAttendeeWithPrerequisiteCheck(employee, selectedCourse.id, source);
        if (!enrollment) {
          skipped.push(employeeLabel);
          continue;
        }
        added.push(employeeLabel);
      }
      await reloadEnrollments();
      setDraftAttendees([]);
      setIsAddingAttendee(false);
      toast.success(
        t(
          t(`เพิ่มผู้เข้าอบรม ${added.length} คน เข้า ${selectedCourse.code} แล้ว`, `Added ${added.length} attendees to ${selectedCourse.code}`),
          `Added ${added.length} attendee(s) to ${selectedCourse.code}`,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save attendees");
    } finally {
      setIsSavingDraftAttendees(false);
    }
  };

  const updateExpense = (key: ExpenseKey, value: string) => {
    setExpenses((current) => ({ ...current, [key]: value }));
  };

  const handleAutoFillFromBudget = () => {
    if (!costBreakdown?.plannedTotals) {
      toast.error(t("ไม่พบข้อมูลงบประมาณที่วางแผนไว้", "No planned budget data found"));
      return;
    }
    setExpenses({
      instructor: costBreakdown.plannedTotals.instructor ? String(costBreakdown.plannedTotals.instructor) : "",
      traveling: costBreakdown.plannedTotals.traveling ? String(costBreakdown.plannedTotals.traveling) : "",
      seminarRoom: costBreakdown.plannedTotals.seminarRoom ? String(costBreakdown.plannedTotals.seminarRoom) : "",
      accommodation: costBreakdown.plannedTotals.accommodation ? String(costBreakdown.plannedTotals.accommodation) : "",
      material: costBreakdown.plannedTotals.material ? String(costBreakdown.plannedTotals.material) : "",
      foodBeverage: costBreakdown.plannedTotals.foodBeverage ? String(costBreakdown.plannedTotals.foodBeverage) : "",
    });
    toast.success(t("ดึงค่าใช้จ่ายจริงตามงบประมาณเรียบร้อยแล้ว", "Auto-filled actual expenses from planned budget"));
  };

  const handleClearExpenses = () => {
    setExpenses(emptyExpenses);
    toast.info(t("ล้างค่าใช้จ่ายจริงแล้ว", "Cleared actual expenses"));
  };

  // Results are edited per attendee and saved as one payload, because training_result has one row
  // per enrollment and a partial save would leave the roster half-graded with no sign of it.
  const setResultField = (
    enrollmentId: string,
    field: keyof ResultDraft,
    value: string,
  ) => {
    setResultDrafts((current) => ({
      ...current,
      [enrollmentId]: { ...(current[enrollmentId] ?? emptyResultDraft), [field]: value },
    }));
  };

  const setAllCompletion = (status: CompletionStatus) => {
    setResultDrafts((current) => {
      const next = { ...current };
      attendees.forEach((attendee) => {
        next[attendee.id] = { ...(next[attendee.id] ?? emptyResultDraft), completionStatus: status };
      });
      return next;
    });
  };

  // Every enrollment on one plan shares the same course, so the configuration is the plan's.
  const assessment = enrollments[0]?.plan.assessment ?? noAssessment;
  const validityMonths = enrollments[0]?.plan.validityMonths ?? null;

  const handleSave = async () => {
    if (!selectedCourse || isSelectedCourseReadOnlyForFactory) {
      return;
    }

    const now = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());

    setIsSavingResults(true);
    try {
      await saveTrainingRecordExpenses(selectedCourse.id, {
        accommodation: parseMoney(expenses.accommodation),
        foodBeverage: parseMoney(expenses.foodBeverage),
        instructor: parseMoney(expenses.instructor),
        material: parseMoney(expenses.material),
        seminarRoom: parseMoney(expenses.seminarRoom),
        traveling: parseMoney(expenses.traveling),
      });

      // Results ride along with the same button. Two save buttons on one screen left it unclear
      // which one committed what, and it was possible to fill in results and leave without them.
      const edited = attendees
        .map((attendee) => ({ attendee, draft: resultDrafts[attendee.id] }))
        .filter(({ draft }) => draft !== undefined);

      if (edited.length > 0) {
        await saveTrainingResults(selectedCourse.id, {
          results: edited.map(({ attendee, draft }) => ({
            enrollmentId: attendee.id,
            // An empty box means "not graded", which is not the same as a score of zero on a
            // record the employee downloads as evidence.
            preScore: draft.preScore.trim() === "" ? null : Number(draft.preScore),
            // Only an external test's full marks are stored. An in-system form totals its own
            // questions, so sending its total back would write the same fact to a second place.
            preLinkScoreMax:
              assessment.preTest.mode === "FORM" || draft.preScoreMax.trim() === ""
                ? null
                : Number(draft.preScoreMax),
            postScore: draft.postScore.trim() === "" ? null : Number(draft.postScore),
            postLinkScoreMax:
              assessment.postTest.mode === "FORM" || draft.postScoreMax.trim() === ""
                ? null
                : Number(draft.postScoreMax),
            completionStatus: draft.completionStatus,
            validUntil: draft.validUntil.trim() === "" ? null : draft.validUntil,
            certificateNo: draft.certificateNo.trim() === "" ? null : draft.certificateNo.trim(),
          })),
        });

        const refreshed = await listEnrollments({
          planId: selectedCourse.id,
          employeeId: null,
          employeeUserId: null,
        });
        const saved = refreshed.enrollments || [];
        setEnrollments(saved);
        // After a save the stored values are the truth, so the form is rebuilt from them.
        setResultDrafts(draftsFromEnrollments(saved));
      }

      // Read the figures from what the server just returned. Reading them from state here showed
      // the values from before the save, so the very first save always reported 0 per person.
      const fresh = await reloadCostBreakdown(selectedCourse.id, () => false, true);
      const freshPerPerson = fresh?.costPerPerson ?? 0;
      const freshPresent = fresh?.presentCount ?? 0;

      setSavedSummaryData({
        courseCode: selectedCourse.code,
        courseTitle: selectedCourse.title,
        batch: selectedCourse.batch ?? "1",
        date: selectedCourse.date,
        actualCount: freshPresent || actualCount,
        totalCost: expenseTotal,
        costPerPerson: freshPerPerson,
        savedTime: now,
      });
      setShowSaveSuccessModal(true);

      const savedCourseId = String(selectedCourse.id);
      setRecordedPlanIds((prev) => {
        const next = new Set(prev);
        next.add(savedCourseId);
        return next;
      });
      void reloadPlansAndRecords();

      setSavedMessage(
        `Saved ${selectedCourse.code} with ${freshPresent} present attendees, total THB ${formatCurrency(expenseTotal)} (THB ${formatCurrency(freshPerPerson)}/person) at ${now}.`,
      );
      toast.success(t("บันทึกข้อมูลการอบรมจริงและย้ายไปยัง Training Record แล้ว", "Training actual saved and moved to Training Record"));
    } catch (error) {
      console.error("Failed to save training actual", error);
      // Surface what the server said. A certificate clash or a completion without attendance is
      // something HRD can fix, but only if they are told which one it was.
      toast.error(error instanceof Error ? error.message : t("บันทึกไม่สำเร็จ", "Could not save"));
    } finally {
      setIsSavingResults(false);
    }
  };

  return (
    <section className={styles.page} aria-label="Training Actual module">
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{trainingActualModule.subtitle}</p>
          <h2>{trainingActualModule.title}</h2>
          <p>{trainingActualModule.description}</p>
        </div>
        <div className={styles.heroMeta}>
          <span>{actualCount} Actual</span>
          <span>
            {selectedCourseOwner
              ? selectedCourseOwner === "CENTER"
                ? "Center owner"
                : "Factory owner"
              : "Select owner"}
          </span>
          <span>THB {formatCurrency(expenseTotal)}</span>
          {selectedCourse && actualCount > 0 ? (
            <span className={styles.costPerPersonHeroBadge}>
              THB {formatCurrency(actualCostPerPerson)} / person
            </span>
          ) : null}
        </div>
      </section>

      {/* Course Picker Stepper Section */}
      <section className={actualStyles.pickerSection} aria-label="Select training actual course">
        <div className={actualStyles.pickerHeader}>
          <div className={actualStyles.pickerHeaderLeft}>
            <div className={actualStyles.pickerIconBox}>
              <BookOpen size={17} />
            </div>
            <div>
              <h3 className={actualStyles.pickerTitle}>
                {t("เลือกรอบการอบรมเพื่อบันทึกผลจริง", "Select Training Session")}
              </h3>
              <p className={actualStyles.pickerSubtitle}>
                {t("เลือกตามขั้นตอน 1 → 2 → 3 เพื่อเช็คชื่อผู้เข้าเรียนและคิดค่าใช้จ่ายจริง", "Follow steps 1 → 2 → 3 to record attendance and actual expenses")}
              </p>
            </div>
          </div>
          {selectedCourse ? (
            <span className={`${actualStyles.pickerStatusBadge} ${actualStyles.pickerStatusBadgeReady}`}>
              <CheckCircle2 size={13} style={{ color: "#10b981" }} />
              {t("พร้อมบันทึกผล", "Ready")}
            </span>
          ) : (
            <span className={actualStyles.pickerStatusBadge}>
              {t("รอเลือกหลักสูตร", "Pending selection")}
            </span>
          )}
        </div>

        <div className={actualStyles.stepperGrid}>
          {/* Step 1: Course Owner */}
          <div className={`${actualStyles.stepCard} ${selectedCourseOwner ? actualStyles.stepCardDone : actualStyles.stepCardActive}`}>
            <div className={actualStyles.stepCardHeader}>
              <div className={actualStyles.stepBadgeRow}>
                <span className={`${actualStyles.stepNum} ${selectedCourseOwner ? actualStyles.stepNumDone : actualStyles.stepNumActive}`}>
                  {selectedCourseOwner ? <Check size={12} /> : "1"}
                </span>
                <span className={actualStyles.stepLabel}>{t("Step 1 — สิทธิ์ผู้จัด", "Step 1 — Owner")}</span>
              </div>
            </div>
            <select
              className={actualStyles.stepSelect}
              value={selectedCourseOwner}
              onChange={(event) => {
                setCourseOwnerFilter(event.target.value as CourseOwnerFilter);
                setSelectedCourseGroupId("");
                setSelectedCourseId("");
                setSavedMessage("");
              }}
            >
              {!isFactoryUser && <option value="">{t("เลือกสิทธิ์ผู้จัด (ส่วนกลาง / โรงงาน)", "Pick an owner (Center / Factory)")}</option>}
              {!isFactoryUser && <option value="CENTER">{t("ส่วนกลาง (Center Standard)", "Center Standard")}</option>}
              <option value="FACTORY">{t(`โรงงาน ${userCompanyCode || ""}`, `Factory ${userCompanyCode || ""}`)}</option>
            </select>
          </div>

          {/* Step 2: Course */}
          <div
            className={`${actualStyles.stepCard} ${
              !selectedCourseOwner
                ? ""
                : selectedCourseGroupId
                  ? actualStyles.stepCardDone
                  : actualStyles.stepCardActive
            }`}
          >
            <div className={actualStyles.stepCardHeader}>
              <div className={actualStyles.stepBadgeRow}>
                <span
                  className={`${actualStyles.stepNum} ${
                    selectedCourseGroupId
                      ? actualStyles.stepNumDone
                      : selectedCourseOwner
                        ? actualStyles.stepNumActive
                        : ""
                  }`}
                >
                  {selectedCourseGroupId ? <Check size={12} /> : "2"}
                </span>
                <span className={actualStyles.stepLabel}>{t("Step 2 — หลักสูตร", "Step 2 — Course")}</span>
              </div>
            </div>
            <select
              className={actualStyles.stepSelect}
              disabled={!selectedCourseOwner}
              value={selectedCourseGroupId}
              onChange={(event) => {
                setSelectedCourseGroupId(event.target.value);
                setSelectedCourseId("");
                setSavedMessage("");
              }}
            >
              <option value="">
                {!selectedCourseOwner
                  ? t("กรุณาเลือกผู้จัดหลักสูตรก่อน", "Pick a course owner first")
                  : availableCourseGroups.length > 0
                    ? t("เลือกหลักสูตรที่ต้องการบันทึก", "Pick the course to record")
                    : t(`ไม่พบหลักสูตรในสิทธิ์ ${selectedCourseOwner}`, `No course under ${selectedCourseOwner}`)}
              </option>
              {availableCourseGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {t(
                    `[${group.code}] ${group.title} — ${t("งบประมาณ", "Budget")} THB ${formatCurrency(parseMoney(group.sessions[0]?.budget))} (${group.sessions.length} ${t("รอบ", "sessions")})`,
                    `[${group.code}] ${group.title} — budget THB ${formatCurrency(parseMoney(group.sessions[0]?.budget))} (${group.sessions.length} session(s))`,
                  )}
                </option>
              ))}
            </select>
          </div>

          {/* Step 3: Session */}
          <div
            className={`${actualStyles.stepCard} ${
              !selectedCourseGroupId
                ? ""
                : selectedCourseId
                  ? actualStyles.stepCardDone
                  : actualStyles.stepCardActive
            }`}
          >
            <div className={actualStyles.stepCardHeader}>
              <div className={actualStyles.stepBadgeRow}>
                <span
                  className={`${actualStyles.stepNum} ${
                    selectedCourseId
                      ? actualStyles.stepNumDone
                      : selectedCourseGroupId
                        ? actualStyles.stepNumActive
                        : ""
                  }`}
                >
                  {selectedCourseId ? <Check size={12} /> : "3"}
                </span>
                <span className={actualStyles.stepLabel}>{t("Step 3 — รอบอบรม / รุ่น", "Step 3 — Session")}</span>
              </div>
            </div>
            <select
              className={actualStyles.stepSelect}
              disabled={!selectedCourseGroup}
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSavedMessage("");
              }}
            >
              <option value="">
                {selectedCourseGroup
                  ? t("เลือกรอบการอบรมที่ดำเนินการแล้ว", "Pick a session that has already run")
                  : t("กรุณาเลือกหลักสูตรก่อน", "Pick a course first")}
              </option>
              {availableSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.batchRoundLabel || session.batch || "1"} / {formatDateDayMonthYear(session.date, isThai)} ({session.time}) / {t("ห้อง", "Room")} {session.room}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {selectedCourse ? (
        <section className={styles.actualWorkspace}>
          <div className={styles.actualMainPanel}>
            {/* Executive Course Detail Header Banner */}
            <div className={actualStyles.courseSummaryCard}>
              <div className={actualStyles.courseIdentity}>
                <div className={actualStyles.courseBadgeRow}>
                  <span className={selectedCourse.owner === "CENTER" ? actualStyles.ownerPillCenter : actualStyles.ownerPillFactory}>
                    {selectedCourse.owner === "CENTER" ? (
                      <>
                        <Building2 size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        {t("ส่วนกลาง (Center Standard)", "Center Standard")}
                      </>
                    ) : (
                      <>
                        <Factory size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                        {t(
                          `${selectedCourse.ownerCompany ?? selectedCourse.company}`,
                          `${selectedCourse.ownerCompany ?? selectedCourse.company} Scope`,
                        )}
                      </>
                    )}
                  </span>
                  <span className={actualStyles.batchBadge}>
                    {selectedCourse.batchRoundLabel || `${t("รุ่นที่", "Batch")} ${selectedCourse.batch ?? "1"}`}
                  </span>
                  <span className={actualStyles.courseCodeTag}>
                    <Pin size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />
                    {selectedCourse.code}
                  </span>
                </div>

                <h3 className={actualStyles.courseTitle}>{selectedCourse.title}</h3>

                <div className={actualStyles.courseMetaChips}>
                  <span className={actualStyles.courseMetaChip}>
                    <Building2 size={13} />
                    <span>{t("บริษัท", "Company")}: <strong>{selectedCourse.company}</strong></span>
                  </span>
                  <span className={actualStyles.courseMetaChip}>
                    <Calendar size={13} />
                    <span>{t("วันที่", "Date")}: <strong>{formatDateDayMonthYear(selectedCourse.date, isThai)}</strong> ({selectedCourse.time})</span>
                  </span>
                  <span className={actualStyles.courseMetaChip}>
                    <MapPin size={13} />
                    <span>{t("สถานที่", "Venue")}: <strong>{selectedCourse.room}</strong></span>
                  </span>
                  <span className={actualStyles.courseMetaChip}>
                    <User size={13} />
                    <span>{t("วิทยากร", "Instructor")}: <strong>{selectedCourse.instructor}</strong></span>
                  </span>
                </div>
              </div>

              {/* Executive Key Metrics Grid */}
              <div className={actualStyles.metricsGrid}>
                <article className={actualStyles.metricCard}>
                  <div className={actualStyles.metricCardHeader}>
                    <Wallet size={13} />
                    <span>{t("งบประมาณตามแผน", "Planned budget")}</span>
                  </div>
                  <strong className={actualStyles.metricValue}>THB {formatCurrency(plannedBudget)}</strong>
                </article>

                <article className={actualStyles.metricCard}>
                  <div className={actualStyles.metricCardHeader}>
                    <Users size={13} />
                    <span>{t("ลงทะเบียน", "Registered")}</span>
                  </div>
                  <strong className={actualStyles.metricValue}>{t(`${registeredCount} คน`, `${registeredCount}`)}</strong>
                </article>

                <article className={`${actualStyles.metricCard} ${actualStyles.metricCardAttended}`}>
                  <div className={actualStyles.metricCardHeader}>
                    <CheckCircle2 size={13} />
                    <span>{t("เข้าเรียนจริง", "Attended")}</span>
                  </div>
                  <div className={actualStyles.metricAttendedRow}>
                    <strong className={actualStyles.metricValue}>{t(`${actualCount} คน`, `${actualCount}`)}</strong>
                    <span className={actualStyles.metricRateBadge}>
                      {attendees.length ? Math.round((actualCount / attendees.length) * 100) : 0}%
                    </span>
                  </div>
                </article>

                <article className={`${actualStyles.metricCard} ${absentCount > 0 ? actualStyles.metricCardAbsent : ""}`}>
                  <div className={actualStyles.metricCardHeader}>
                    <XCircle size={13} />
                    <span>{t("ขาดเรียน", "Absent")}</span>
                  </div>
                  <strong className={actualStyles.metricValue}>{t(`${absentCount} คน`, `${absentCount}`)}</strong>
                </article>

                <article className={`${actualStyles.metricCard} ${actualStyles.metricCardCost}`}>
                  <div className={actualStyles.metricCardHeader}>
                    <BarChart3 size={13} />
                    <span>{t("ค่าใช้จ่าย / คน", "Cost / person")}</span>
                  </div>
                  <strong className={actualStyles.metricValue}>THB {formatCurrency(actualCostPerPerson)}</strong>
                </article>
              </div>
            </div>

            {isSelectedCourseReadOnlyForFactory ? (
              <div className={actualStyles.permissionBanner}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>
                  {t(
                    "แผนจัดอบรมของส่วนกลาง (HRD Center) — โรงงานดูรายงานได้แต่บันทึกการเข้าอบรมหรือค่าใช้จ่ายไม่ได้",
                    "An HRD Center plan. Factory users can read the report but cannot record attendance or cost.",
                  )}
                </span>
              </div>
            ) : isFactoryUser ? (
              <div className={actualStyles.permissionBanner}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>
                  Factory permission: courses owned by {userCompanyCode}, plus HRD Center courses (view-only).
                </span>
              </div>
            ) : null}

            {/* Executive Attendance Checklist Workspace */}
            <div className={actualStyles.attendanceSection}>
              <div className={actualStyles.attendanceHeader}>
                <div className={actualStyles.attendanceHeaderTitle}>
                  <p className={actualStyles.attendanceHeaderKicker}>Attendance Checklist</p>
                  <h3 className={actualStyles.attendanceHeaderH3}>{t("รายการเช็คชื่อเข้าร่วมอบรม", "Attendance sheet")}</h3>
                </div>
                <div className={actualStyles.attendanceHeaderActions}>
                  <span className={actualStyles.attendanceProgressBadge}>
                    <span className={actualStyles.glowingDotGreen} />{" "}
                    {t(
                      `${t("เข้าเรียน", "Attended")} ${actualCount} / ${attendees.length} ${t("คน", "attendees")}`,
                      `${actualCount} of ${attendees.length} attended`,
                    )}{" "}
                    ({attendees.length ? Math.round((actualCount / attendees.length) * 100) : 0}%)
                  </span>
                  <button
                    type="button"
                    className={`${actualStyles.actionBtn} ${allAttended ? actualStyles.actionBtnActive : ""}`}
                    disabled={attendees.length === 0 || isSelectedCourseReadOnlyForFactory}
                    onClick={() => void setAllAttendance(!allAttended)}
                  >
                    {allAttended ? (
                      <>
                        <X size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 2 }} />
                        {t("ยกเลิกเช็คชื่อทั้งหมด", "Clear all")}
                      </>
                    ) : (
                      <>
                        <Check size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 2 }} />
                        {t("เลือกเช็คชื่อทั้งหมด", "Mark all present")}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`${actualStyles.actionBtn} ${isAddingAttendee ? actualStyles.actionBtnActive : ""}`}
                    disabled={isSelectedCourseReadOnlyForFactory}
                    onClick={() => setIsAddingAttendee(!isAddingAttendee)}
                  >
                    {isAddingAttendee ? (
                      <>
                        <X size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 2 }} />
                        {t("ยกเลิก", "Cancel")}
                      </>
                    ) : (
                      <>
                        <Plus size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 2 }} />
                        {t("เพิ่มรายชื่อผู้เข้าอบรมเพิ่มเติม", "Add more attendees")}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {isAddingAttendee ? (
                <div className={actualStyles.addAttendeeWorkspace}>
                  <div>
                    <label className={actualStyles.addAttendeeLabel}>
                      <span>{t("ค้นหารายชื่อพนักงานเพื่อเพิ่มในรอบนี้", "Search employee to add to this session")}</span>
                      <SearchableSelect
                        options={masterEmployees.map(employeeSelectOption)}
                        value=""
                        onChange={addEmployeeToDraft}
                        placeholder={t("พิมพ์ชื่อ รหัสพนักงาน หรือบริษัท...", "Type a name, code, or company...")}
                        emptyText={t("ไม่พบพนักงานที่ตรงกัน", "No matching employee")}
                      />
                    </label>
                  </div>

                  {draftAttendees.length > 0 ? (
                    <div className={actualStyles.attendanceTableWrap} style={{ marginTop: 8 }}>
                      <table className={actualStyles.attendanceTable}>
                        <thead>
                          <tr>
                            <th>{t("พนักงาน", "Employee")}</th>
                            <th>{t("บริษัท / สำนักงาน", "Company / office")}</th>
                            <th>{t("หน่วยงาน", "Org unit")}</th>
                            <th>{t("เลเวล", "Level")}</th>
                            <th style={{ width: 44 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftAttendees.map((employee) => (
                            <tr key={employee.employeeId}>
                              <td>
                                <div className={actualStyles.empNameBox}>
                                  <strong className={actualStyles.empFullName}>
                                    {`${employee.firstNameTh} ${employee.lastNameTh}`.trim()}
                                  </strong>
                                  <span className={actualStyles.empCodeTag}>{employee.employeeCode}</span>
                                </div>
                              </td>
                              <td>
                                <div className={actualStyles.deptBox}>
                                  <span className={actualStyles.companyBadge}>{employee.companyCode}</span>
                                  <span className={actualStyles.deptText}>{employee.functionName || "-"}</span>
                                </div>
                              </td>
                              <td>
                                <div className={actualStyles.orgBox}>
                                  <span className={actualStyles.orgMainText}>{employee.divisionName || "-"}</span>
                                  <span className={actualStyles.orgSubText}>
                                    {[employee.departmentName, employee.sectionName].filter(Boolean).join(" • ") || "-"}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className={actualStyles.levelTag}>{employee.levelCode || employee.levelKey || "-"}</span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className={actualStyles.removeDraftBtn}
                                  title={t("เอาออกจากรายชื่อ", "Remove")}
                                  onClick={() => removeDraftAttendee(employee.employeeId)}
                                >
                                  <X size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className={actualStyles.saveDraftBtn}
                    disabled={draftAttendees.length === 0 || isSavingDraftAttendees}
                    onClick={() => void saveDraftAttendees()}
                  >
                    <Check size={14} />
                    {isSavingDraftAttendees ? t("กำลังบันทึก...", "Saving...") : t(`บันทึก (${draftAttendees.length})`, `Save (${draftAttendees.length})`)}
                  </button>
                </div>
              ) : null}

              {/* Attendance Toolbar: Company Filters, Status Filters, & Real-Time Search */}
              <div className={actualStyles.filterToolbar}>
                <div className={actualStyles.filterRowCompanies}>
                  <span className={actualStyles.filterRowLabel}>
                    <Building2 size={13} /> {t("สังกัดบริษัท:", "Company:")}
                  </span>
                  <div className={actualStyles.filterChipsGroup}>
                    <button
                      type="button"
                      className={`${actualStyles.filterChip} ${attendanceCompanyFilter === "ALL" ? actualStyles.filterChipActive : ""}`}
                      onClick={() => setAttendanceCompanyFilter("ALL")}
                    >
                      {t(`ทุกบริษัท (${attendees.length})`, `All companies (${attendees.length})`)}
                    </button>
                    {attendeeCompanyList.map((comp) => {
                      const count = attendees.filter((a) => a.company === comp).length;
                      return (
                        <button
                          key={comp}
                          type="button"
                          className={`${actualStyles.filterChip} ${attendanceCompanyFilter === comp ? actualStyles.filterChipActive : ""}`}
                          onClick={() => setAttendanceCompanyFilter(comp)}
                        >
                          {comp} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={actualStyles.filterRowBottom}>
                  <div className={actualStyles.filterChipsGroup}>
                    <button
                      type="button"
                      className={`${actualStyles.filterChip} ${attendanceStatusFilter === "ALL" ? actualStyles.filterChipActive : ""}`}
                      onClick={() => setAttendanceStatusFilter("ALL")}
                    >
                      {t("ทั้งหมด", "All")}
                    </button>
                    <button
                      type="button"
                      className={`${actualStyles.filterChip} ${attendanceStatusFilter === "PRESENT" ? actualStyles.filterChipActivePresent : ""}`}
                      onClick={() => setAttendanceStatusFilter("PRESENT")}
                    >
                      <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 2 }} />
                      {t(`มาเรียน (${actualCount})`, `Present (${actualCount})`)}
                    </button>
                    <button
                      type="button"
                      className={`${actualStyles.filterChip} ${attendanceStatusFilter === "ABSENT" ? actualStyles.filterChipActiveAbsent : ""}`}
                      onClick={() => setAttendanceStatusFilter("ABSENT")}
                    >
                      <XCircle size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 2 }} />
                      {t(`ขาดเรียน (${absentCount})`, `Absent (${absentCount})`)}
                    </button>
                  </div>

                  <div className={actualStyles.searchBox}>
                    <span className={actualStyles.searchIcon}><Search size={14} /></span>
                    <input
                      type="text"
                      className={actualStyles.searchInput}
                      placeholder={t("ค้นหาชื่อ, รหัสพนักงาน, แผนก...", "Search a name, code, or department...")}
                      value={attendanceSearchQuery}
                      onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                    />
                    {attendanceSearchQuery ? (
                      <button
                        type="button"
                        className={actualStyles.searchClearBtn}
                        onClick={() => setAttendanceSearchQuery("")}
                      >
                        <X size={11} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Attendance Table */}
              <div className={actualStyles.attendanceTableWrap}>
                <table className={actualStyles.attendanceTable}>
                  <thead>
                    <tr>
                      <th style={{ width: "135px" }}>{t("เข้าร่วม", "Attended")}</th>
                      <th>{t("ข้อมูลพนักงาน", "Employee")}</th>
                      <th>{t("บริษัท / ส่วน", "Company / department")}</th>
                      <th>{t("แผนก / ฝ่าย", "Section / division")}</th>
                      <th>{t("ตำแหน่ง / ระดับ", "Position / level")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAttendees.map((attendee) => (
                      <tr
                        key={attendee.id}
                        className={attendee.attended ? actualStyles.rowAttended : undefined}
                      >
                        <td>
                          <button
                            type="button"
                            className={`${actualStyles.togglePill} ${
                              attendee.attended
                                ? actualStyles.togglePillPresent
                                : actualStyles.togglePillAbsent
                            }`}
                            disabled={isSelectedCourseReadOnlyForFactory}
                            onClick={() => void toggleAttendance(attendee.id, attendee.attended)}
                            title={
                              isSelectedCourseReadOnlyForFactory
                                ? t("ไม่สามารถเช็คชื่อได้เนื่องจากเป็นหลักสูตรของส่วนกลาง", "Read-only Center course")
                                : attendee.attended
                                  ? t("คลิกเพื่อเปลี่ยนเป็นขาดเรียน", "Click to mark absent")
                                  : t("คลิกเพื่อเช็คชื่อเข้าเรียน", "Click to mark present")
                            }
                          >
                            {attendee.attended ? (
                              <>
                                <span className={actualStyles.glowingDotGreen} /> {t("มาเรียน", "Present")}
                              </>
                            ) : (
                              <>
                                <span className={actualStyles.glowingDotRed} /> {t("ขาดเรียน", "Absent")}
                              </>
                            )}
                          </button>
                        </td>
                        <td>
                          <div className={actualStyles.empNameBox}>
                            <strong className={actualStyles.empFullName}>
                              {attendee.prefix !== "-" ? `${attendee.prefix} ` : ""}
                              {attendee.firstName} {attendee.lastName}
                            </strong>
                            <span className={actualStyles.empCodeTag}>{attendee.employeeCode}</span>
                          </div>
                        </td>
                        <td>
                          <div className={actualStyles.deptBox}>
                            <span className={actualStyles.companyBadge}>{attendee.company || "-"}</span>
                            <span className={actualStyles.deptText}>{attendee.department || "-"}</span>
                          </div>
                        </td>
                        <td>
                          <div className={actualStyles.orgBox}>
                            <span className={actualStyles.orgMainText}>{attendee.section || "-"}</span>
                            <span className={actualStyles.orgSubText}>{attendee.division || "-"}</span>
                          </div>
                        </td>
                        <td>
                          <div className={actualStyles.posBox}>
                            <span className={actualStyles.posTitleText}>{attendee.position || "-"}</span>
                            <span className={actualStyles.levelTag}>{attendee.level || "-"}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pagedAttendees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={actualStyles.emptySearchRow}>
                          <Search size={15} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
                          {t("ไม่พบรายชื่อพนักงานตามเงื่อนไขค้นหา", "No attendee matches this search")}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <div className={actualStyles.paginationBar}>
                  <span className={actualStyles.paginationInfo}>
                    {t(
                      `${t("แสดง", "Showing")} ${startIndex + 1}-${Math.min(startIndex + PAGE_SIZE, attendees.length)} ${t("จากทั้งหมด", "of")} ${attendees.length} ${t("คน", "attendees")} (${t("หน้า", "page")} ${activePage} ${t("จาก", "of")} ${totalPages})`,
                      `Showing ${startIndex + 1}-${Math.min(startIndex + PAGE_SIZE, attendees.length)} of ${attendees.length} (page ${activePage} of ${totalPages})`,
                    )}
                  </span>
                  <div className={actualStyles.paginationNav}>
                    <button
                      className={actualStyles.pageButton}
                      type="button"
                      disabled={activePage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      title={t("หน้าก่อนหน้า", "Previous page")}
                    >
                      ‹
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        className={`${actualStyles.pageButton} ${p === activePage ? actualStyles.pageButtonActive : ""}`}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      className={actualStyles.pageButton}
                      type="button"
                      disabled={activePage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      title={t("หน้าถัดไป", "Next page")}
                    >
                      ›
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            {selectedCourse ? <PendingGradingPanel planId={selectedCourse.id} onGraded={(id) => void handleGraded(id)} /> : null}
            {/* Executive Training Results & Assessment Panel */}
            <section className={actualStyles.resultsSection} aria-label="Training results">
              <div className={actualStyles.resultsHeader}>
                <div className={actualStyles.resultsHeaderTitle}>
                  <p className={actualStyles.resultsHeaderKicker}>Evaluation & Assessment</p>
                  <h3 className={actualStyles.resultsHeaderH3}>{t("ผลการอบรมและคะแนนสอบ", "Training Results & Scores")}</h3>
                </div>
                <div className={actualStyles.attendanceHeaderActions}>
                  {evaluationSubmissionsCount !== null && selectedCourse ? (
                    <a
                      className={actualStyles.evaluationResultsButton}
                      href={`/training-record/evaluations/${selectedCourse.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t("ดูผลการตอบกลับแบบประเมินทั้งหมด", "View all evaluation responses")}
                    >
                      <BarChart3 size={14} />
                      {t("ดูการตอบกลับแบบประเมิน", "Evaluation responses")}
                      <span className={actualStyles.evaluationResultsBadge}>
                        {evaluationSubmissionsCount > 99 ? "99+" : evaluationSubmissionsCount}
                      </span>
                    </a>
                  ) : null}
                  <span className={actualStyles.attendanceProgressBadge}>
                    <CheckCircle2 size={13} style={{ color: "#10b981" }} />
                    {t(
                      `เข้าเรียน ${attendees.filter((a) => a.attended).length} คน`,
                      `${attendees.filter((a) => a.attended).length} attended`,
                    )}
                  </span>
                  <button
                    type="button"
                    className={`${actualStyles.actionBtn} ${allPassed ? actualStyles.actionBtnActive : ""}`}
                    disabled={attendees.length === 0 || isSelectedCourseReadOnlyForFactory}
                    onClick={() => setAllCompletion(allPassed ? "NOT_COMPLETED" : "COMPLETED")}
                  >
                    {allPassed ? (
                      <>
                        <X size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 2 }} />
                        {t("ยกเลิกผ่านทั้งหมด", "Clear all passes")}
                      </>
                    ) : (
                      <>
                        <Check size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 2 }} />
                        {t("เลือกผ่านทั้งหมด", "Pass everyone")}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {assessment.preTest.mode === "NONE" && assessment.postTest.mode === "NONE" ? (
                <div className={actualStyles.resultsNotice}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>
                    {t(
                      "หลักสูตรนี้ไม่ได้กำหนดแบบทดสอบ จึงไม่มีคะแนนให้บันทึก",
                      "This course has no test configured, so there is no score to record",
                    )}
                  </span>
                </div>
              ) : null}
              {assessment.preTest.mode === "LINK" || assessment.postTest.mode === "LINK" ? (
                <div className={actualStyles.resultsNotice}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>
                    {t(
                      "แบบทดสอบใช้ลิงก์ภายนอก ระบบมองไม่เห็นคะแนน กรุณากรอกคะแนนด้วยตนเอง",
                      "The test is an external link, so this system cannot read the score - enter it manually",
                    )}
                  </span>
                </div>
              ) : null}

              {attendees.length === 0 ? (
                <div className={actualStyles.resultsEmptyBox}>
                  {t("ยังไม่มีผู้เข้าอบรมที่อนุมัติแล้ว", "No approved attendee yet")}
                </div>
              ) : (
                <div className={actualStyles.assessmentTableWrap}>
                  <table className={actualStyles.assessmentTable}>
                    <thead>
                      <tr>
                        <th style={{ width: "115px" }}>{t("ผลการประเมิน", "Result")}</th>
                        <th>{t("ข้อมูลผู้เข้าอบรม", "Attendee")}</th>
                        {assessment.preTest.mode !== "NONE" && (
                          <th style={{ width: "190px" }}>{t("คะแนนก่อนอบรม (Pre)", "Pre-Test Score")}</th>
                        )}
                        {assessment.postTest.mode !== "NONE" && (
                          <th style={{ width: "190px" }}>{t("คะแนนหลังอบรม (Post)", "Post-Test Score")}</th>
                        )}
                        <th style={{ width: "135px" }}>{t("แบบประเมิน", "Evaluation")}</th>
                        {validityMonths !== null && (
                          <th style={{ width: "150px" }}>{t("วันหมดอายุ", "Expires")}</th>
                        )}
                        <th style={{ width: "140px", textAlign: "right" }}>{t("การจัดการ", "Actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendees.map((attendee) => {
                        const saved = enrollments.find((e) => e.id === attendee.id);
                        const draft = resultDrafts[attendee.id] ?? emptyResultDraft;
                        const system = saved ? systemScores(saved) : null;
                        const fromSystem = Boolean(system && (system.preScore !== null || system.postScore !== null));
                        const isCompleted = draft.completionStatus === "COMPLETED";

                        return (
                          <tr
                            key={attendee.id}
                            className={isCompleted ? actualStyles.assessmentRowPassed : undefined}
                          >
                            {/* Col 1: Status Toggle */}
                            <td>
                              <button
                                type="button"
                                className={`${actualStyles.resultPassPill} ${
                                  isCompleted
                                    ? actualStyles.resultPassPillCompleted
                                    : draft.completionStatus === "PENDING"
                                      ? actualStyles.resultPassPillPending
                                      : actualStyles.resultPassPillNotCompleted
                                }`}
                                disabled={isSelectedCourseReadOnlyForFactory}
                                onClick={() =>
                                  setResultField(
                                    attendee.id,
                                    "completionStatus",
                                    isCompleted ? "NOT_COMPLETED" : "COMPLETED",
                                  )
                                }
                                title={
                                  isCompleted
                                    ? t("คลิกเพื่อเปลี่ยนเป็นไม่ผ่าน", "Click to mark not passed")
                                    : t("คลิกเพื่อเปลี่ยนเป็นผ่าน", "Click to mark passed")
                                }
                              >
                                {isCompleted ? (
                                  <>
                                    <span className={actualStyles.glowingDotGreen} /> {t("ผ่าน", "Passed")}
                                  </>
                                ) : (
                                  <>
                                    <span className={actualStyles.glowingDotRed} />{" "}
                                    {draft.completionStatus === "PENDING" ? t("ยังไม่ระบุ", "Pending") : t("ไม่ผ่าน", "Failed")}
                                  </>
                                )}
                              </button>
                            </td>

                            {/* Col 2: Attendee Info */}
                            <td>
                              <div className={actualStyles.assessmentAttendeeBox}>
                                <strong className={actualStyles.resultAttendeeName}>{attendee.name}</strong>
                                <div className={actualStyles.resultAttendeeMeta}>
                                  <span className={actualStyles.empCodeTag}>{attendee.employeeCode || "-"}</span>
                                  <span className={actualStyles.companyBadge}>{attendee.company}</span>
                                  {!attendee.attended && (
                                    <span className={actualStyles.resultAbsentBadge}>
                                      {t("ขาดเรียน", "Absent")}
                                    </span>
                                  )}
                                  {fromSystem && (
                                    <span className={actualStyles.resultSystemBadge}>
                                      {t("คะแนนในระบบ", "System")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Col 3: Pre-Test (if enabled) */}
                            {assessment.preTest.mode !== "NONE" && (() => {
                              const percent = percentOfMark(draft.preScore, draft.preScoreMax);
                              const totalIsFixed = assessment.preTest.mode === "FORM";
                              return (
                                <td>
                                  <div className={actualStyles.scoreInputBox}>
                                    <input
                                      type="number"
                                      min={0}
                                      className={actualStyles.scoreNumInput}
                                      value={draft.preScore}
                                      placeholder="0"
                                      disabled={isSelectedCourseReadOnlyForFactory}
                                      onChange={(event) => setResultField(attendee.id, "preScore", event.target.value)}
                                    />
                                    <span className={actualStyles.scoreSlash}>/</span>
                                    <input
                                      type="number"
                                      min={0}
                                      readOnly={totalIsFixed}
                                      disabled={isSelectedCourseReadOnlyForFactory}
                                      className={actualStyles.scoreNumInput}
                                      value={draft.preScoreMax}
                                      placeholder="0"
                                      onChange={(event) => setResultField(attendee.id, "preScoreMax", event.target.value)}
                                    />
                                    {percent !== null ? (
                                      <span className={actualStyles.scorePctTag}>{percent}%</span>
                                    ) : (
                                      <span className={actualStyles.scorePctPending}>-%</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })()}

                            {/* Col 4: Post-Test (if enabled) */}
                            {assessment.postTest.mode !== "NONE" && (() => {
                              const percent = percentOfMark(draft.postScore, draft.postScoreMax);
                              const totalIsFixed = assessment.postTest.mode === "FORM";
                              return (
                                <td>
                                  <div className={actualStyles.scoreInputBox}>
                                    <input
                                      type="number"
                                      min={0}
                                      className={actualStyles.scoreNumInput}
                                      value={draft.postScore}
                                      placeholder="0"
                                      disabled={isSelectedCourseReadOnlyForFactory}
                                      onChange={(event) => setResultField(attendee.id, "postScore", event.target.value)}
                                    />
                                    <span className={actualStyles.scoreSlash}>/</span>
                                    <input
                                      type="number"
                                      min={0}
                                      readOnly={totalIsFixed}
                                      disabled={isSelectedCourseReadOnlyForFactory}
                                      className={actualStyles.scoreNumInput}
                                      value={draft.postScoreMax}
                                      placeholder="0"
                                      onChange={(event) => setResultField(attendee.id, "postScoreMax", event.target.value)}
                                    />
                                    {percent !== null ? (
                                      <span className={actualStyles.scorePctTag}>{percent}%</span>
                                    ) : (
                                      <span className={actualStyles.scorePctPending}>-%</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })()}

                            {/* Col: Evaluation */}
                            <td>
                              {(() => {
                                const evalStage = saved?.plan.assessment.evaluation ?? assessment.evaluation;
                                const isDone = Boolean(saved?.plan.assessment.evaluation.submission?.submittedAt);
                                const state = evaluationStateOf(evalStage, isDone);
                                return (
                                  <span
                                    className={`${actualStyles.evalStatusPill} ${
                                      state === "Done"
                                        ? actualStyles.evalStatusDone
                                        : state === "Pending"
                                          ? actualStyles.evalStatusPending
                                          : actualStyles.evalStatusNeutral
                                    }`}
                                  >
                                    {state === "Done" ? (
                                      <>
                                        <span className={actualStyles.glowingDotGreen} /> {t("ทำแล้ว", "Done")}
                                      </>
                                    ) : state === "None" ? (
                                      t("ไม่มีแบบประเมิน", "No form")
                                    ) : state === "External" ? (
                                      t("ทำผ่านลิงก์", "External link")
                                    ) : (
                                      <>
                                        <span className={actualStyles.glowingDotAmber} /> {t("รอดำเนินการ", "Pending")}
                                      </>
                                    )}
                                  </span>
                                );
                              })()}
                            </td>

                            {/* Col 5: Expiry Date (if validity period configured) */}
                            {validityMonths !== null && (
                              <td>
                                <input
                                  type="date"
                                  disabled={isSelectedCourseReadOnlyForFactory}
                                  className={actualStyles.resultExpiryInput}
                                  value={draft.validUntil}
                                  onChange={(event) =>
                                    setResultField(attendee.id, "validUntil", event.target.value)
                                  }
                                />
                              </td>
                            )}

                            {/* Col 6: Actions / Attempts */}
                            <td style={{ textAlign: "right" }}>
                              <div className={actualStyles.assessmentActionsCell}>
                                {(() => {
                                  const attemptCount =
                                    (saved?.plan.assessment.preTest.attempts.length ?? 0) +
                                    (saved?.plan.assessment.postTest.attempts.length ?? 0);
                                  if (attemptCount === 0) return null;
                                  return (
                                    <button
                                      type="button"
                                      className={actualStyles.resultReviewBtn}
                                      onClick={() =>
                                        setAttemptsCard({
                                          enrollmentId: attendee.id,
                                          name: attendee.name,
                                          preTest: saved!.plan.assessment.preTest,
                                          postTest: saved!.plan.assessment.postTest,
                                        })
                                      }
                                    >
                                      <FileText size={13} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />
                                      {t(`ดูแบบทดสอบ (${attemptCount})`, `Attempts (${attemptCount})`)}
                                    </button>
                                  );
                                })()}
                                {saved?.result && (
                                  <span className={actualStyles.resultSavedPill}>
                                    <Check size={12} />
                                    {completionStatusLabel(saved.result.completionStatus, language)}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className={actualStyles.resultsFooterBanner}>
                <AlertTriangle size={15} style={{ flexShrink: 0, color: "var(--ui-30-primary)" }} />
                <span>
                  {t(
                    "กรอกคะแนนและผลการอบรมแล้ว กดปุ่มบันทึกที่แผงด้านขวา เพื่อบันทึกทั้งค่าใช้จ่ายและผลการอบรมพร้อมกัน",
                    "Fill these in and click Save on the right sidebar - it saves expenses and training results together.",
                  )}
                </span>
              </div>
            </section>

          </div>

          {/* Executive Expense Calculation Sidebar */}
          <aside className={actualStyles.sidebarPanel} aria-label="Actual training expenses">
            <div className={actualStyles.sidebarHeader}>
              <div className={actualStyles.sidebarHeaderTopRow}>
                <div>
                  <p className={actualStyles.sidebarKicker}>Expense Calculation</p>
                  <h3 className={actualStyles.sidebarTitle}>{t("บันทึกค่าใช้จ่ายจริง", "Record the actual cost")}</h3>
                </div>
                <div className={actualStyles.sidebarExpenseActions}>
                  <button
                    type="button"
                    className={actualStyles.autoFillBtn}
                    onClick={handleAutoFillFromBudget}
                    disabled={isSelectedCourseReadOnlyForFactory || !costBreakdown?.plannedTotals}
                    title={t("ดึงค่าใช้จ่ายจริงตามงบประมาณที่วางแผนไว้", "Auto-fill actual expenses from planned budget")}
                  >
                    <Zap size={13} />
                    <span>{t("ดึงตามงบประมาณ", "Auto-fill")}</span>
                  </button>
                  {hasExpenseInputs && !isSelectedCourseReadOnlyForFactory ? (
                    <button
                      type="button"
                      className={actualStyles.clearExpensesBtn}
                      onClick={handleClearExpenses}
                      title={t("ล้างค่าใช้จ่ายที่กรอกไว้", "Clear entered expenses")}
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
              </div>
              <span className={actualStyles.sidebarSubtitle}>{t("บันทึกค่าใช้จ่ายจริงที่เกิดขึ้นในการอบรม", "What the training actually cost")}</span>
            </div>

            <div className={actualStyles.expenseGrid}>
              {expenseFields.map((field) => (
                <label key={field.key} className={actualStyles.expenseCard}>
                  <div className={actualStyles.expenseCardHeader}>
                    <div className={actualStyles.expenseIconBadge}>
                      {getExpenseIcon(field.key, 15)}
                    </div>
                    <span className={actualStyles.expenseCardLabel}>{field.label}</span>
                  </div>
                  <div className={actualStyles.expenseInputRow}>
                    <span className={actualStyles.expenseCurrencyTag}>THB</span>
                    <input
                      className={actualStyles.expenseInputField}
                      inputMode="decimal"
                      disabled={isSelectedCourseReadOnlyForFactory}
                      placeholder="0"
                      value={expenses[field.key]}
                      onChange={(event) => updateExpense(field.key, event.target.value)}
                    />
                  </div>
                </label>
              ))}
            </div>

            <div className={actualStyles.totalDraftCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className={actualStyles.expenseIconBadge} style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(0, 122, 61, 0.15)", color: "var(--ui-30-primary)" }}>
                  <Wallet size={18} />
                </div>
                <div className={actualStyles.totalDraftLabel}>
                  <span>{t("รวมค่าใช้จ่ายจริง", "Actual cost")}</span>
                  <small>{t("ฉบับร่างที่ยังไม่บันทึก", "Unsaved draft")}</small>
                </div>
              </div>
              <strong className={actualStyles.totalDraftValue}>THB {formatCurrency(expenseTotal)}</strong>
            </div>

            {/* Variance Analysis Table */}
            <div className={actualStyles.varianceCard}>
              <h4 className={actualStyles.varianceCardTitle}>{t("เปรียบเทียบงบประมาณ & จ่ายจริง", "Planned vs Actual Variance")}</h4>
              <div className={actualStyles.miniTableWrap}>
                <table className={actualStyles.miniTable}>
                  <thead>
                    <tr>
                      <th>{t("หมวดหมู่", "Category")}</th>
                      <th>{t("งบประมาณ", "Planned")}</th>
                      <th>{t("จ่ายจริง", "Actual")}</th>
                      <th style={{ textAlign: "right" }}>{t("ส่วนต่าง", "Variance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseFields.map((field) => {
                      const planned = costBreakdown?.plannedTotals[field.key] ?? 0;
                      const actual = expenses[field.key].trim() !== ""
                        ? parseMoney(expenses[field.key])
                        : (costBreakdown?.actualTotals[field.key] ?? 0);
                      const variance = planned - actual;
                      return (
                        <tr key={field.key}>
                          <td>
                            <span className={actualStyles.tableExpenseIcon}>{getExpenseIcon(field.key, 14)}</span>
                            <span>{field.label}</span>
                          </td>
                          <td>THB {formatCurrency(planned)}</td>
                          <td>THB {formatCurrency(actual)}</td>
                          <td style={{ textAlign: "right" }} className={variance < 0 ? actualStyles.varianceOverrun : actualStyles.varianceSaving}>
                            {variance >= 0 ? `+THB ${formatCurrency(variance)}` : `-THB ${formatCurrency(Math.abs(variance))}`}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className={actualStyles.miniTableTotalRow}>
                      <td><strong>{t("รวมทั้งหมด", "Total")}</strong></td>
                      <td><strong>THB {formatCurrency(plannedBudget)}</strong></td>
                      <td><strong>THB {formatCurrency(savedActualTotal)}</strong></td>
                      <td style={{ textAlign: "right" }} className={remainingBudget < 0 ? actualStyles.varianceOverrun : actualStyles.varianceSaving}>
                        <strong>{remainingBudget >= 0 ? `+THB ${formatCurrency(remainingBudget)}` : `-THB ${formatCurrency(Math.abs(remainingBudget))}`}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className={actualStyles.costPerPersonBox}>
              <div className={actualStyles.costPerPersonHeader}>
                <span>{t("เฉลี่ยงบ / คน", "Cost per person")}</span>
                <strong>THB {formatCurrency(actualCostPerPerson)}</strong>
              </div>
              <small className={actualStyles.costPerPersonFootnote}>
                {(() => {
                  // Built at call time with the totals in it, so the DOM localizer can never
                  // match it against a dictionary key — pick the language here instead.
                  const present = costBreakdown?.presentCount ?? actualCount;
                  const total = formatCurrency(savedActualTotal);
                  return language === "th"
                    ? t(`คำนวณจาก THB ${total} ÷ ผู้เข้าอบรมจริง ${present} คน`, `Calculated from THB ${total} ÷ ${present} attendees`)
                    : `Calculated from THB ${total} ÷ ${present} present attendee${present === 1 ? "" : "s"}`;
                })()}
              </small>
            </div>

            {/* The per-person figure is the total divided by who was marked PRESENT. With nobody
                marked, there is nothing to divide by, and rendering nothing at all made the save
                look like it had failed. */}
            {(costBreakdown?.presentCount ?? 0) === 0 ? (
              <p className={actualStyles.panelCallout}>
                <Info size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                {language === "th"
                  ? t(
                      t("ยังไม่มีใครถูกเช็กชื่อว่าเข้าอบรม จึงยังจำแนกค่าใช้จ่ายต่อคนไม่ได้ — เช็กชื่อในตารางด้านซ้ายก่อน", "No attendees checked in yet; cost per person cannot be allocated — check attendance in the left table first"),
                      "Nobody is marked as present yet, so there is no cost per person to work out - mark attendance on the left first",
                    )
                  : "Nobody is marked as present yet, so the cost cannot be split per person - check attendance in the table on the left first"}
              </p>
            ) : null}

            {companyCostBreakdown.length > 0 ? (
              <div className={actualStyles.companyShareCard}>
                <div className={actualStyles.sidebarHeader} style={{ paddingBottom: 6 }}>
                  <p className={actualStyles.sidebarKicker}>Company Cost Share</p>
                  <h4 className={actualStyles.sidebarTitle} style={{ fontSize: "0.92rem" }}>
                    {isSelectedCourseReadOnlyForFactory || (isFactoryUser && isSelectedCourseCenter)
                      ? t("งบปันส่วนบริษัทของคุณ", "Your company allocation")
                      : t("การปันส่วนงบประมาณตามบริษัท", "Allocation by company")}
                  </h4>
                </div>

                <div className={actualStyles.miniTableWrap}>
                  <table className={actualStyles.miniTable}>
                    <thead>
                      <tr>
                        <th>{t("บริษัท", "Company")}</th>
                        <th>{t("ผู้เข้าเรียน", "Attended")}</th>
                        <th>{t("สัดส่วน %", "Share %")}</th>
                        <th style={{ textAlign: "right" }}>{t("งบปันส่วน (THB)", "Allocated (THB)")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyCostBreakdown.map((item) => {
                        const totalPresent = costBreakdown?.presentCount || actualCount || 1;
                        const pct = Math.round((item.presentCount / totalPresent) * 100);
                        return (
                          <tr key={item.companyCode}>
                            <td>
                              <span className={actualStyles.companyBadgePill}>{item.companyCode}</span>
                            </td>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <CheckCircle2 size={12} style={{ color: "#10b981" }} />
                                {t(`${item.presentCount} คน`, `${item.presentCount}`)}
                              </span>
                            </td>
                            <td>
                              <div className={actualStyles.companySharePctCell}>
                                <div className={actualStyles.companyShareBarWrap}>
                                  <div
                                    className={actualStyles.companyShareBarFill}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>{pct}%</span>
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <strong style={{ color: "var(--ui-30-primary)" }}>
                                THB {formatCurrency(totalPresent > 0 ? Math.round((item.presentCount / totalPresent) * savedActualTotal * 100) / 100 : item.allocatedCost)}
                              </strong>
                            </td>
                          </tr>
                        );
                      })}
                      {isFactoryUser && isSelectedCourseCenter ? (
                        <tr className={actualStyles.miniTableTotalRow}>
                          <td colSpan={3}>
                            <strong>{t("รวมทุกบริษัท", "All companies total")}</strong>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <strong style={{ color: "var(--ui-30-primary)" }}>
                              THB {formatCurrency(savedActualTotal)}
                            </strong>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className={actualStyles.budgetComparisonCard}>
              <div className={actualStyles.budgetCompItem}>
                <span>{t("งบประมาณที่วางแผนไว้", "Planned budget")}</span>
                <strong>THB {formatCurrency(plannedBudget)}</strong>
              </div>
              <div className={actualStyles.budgetCompItem}>
                <span>{t("งบประมาณคงเหลือ", "Budget left")}</span>
                <strong className={remainingBudget < 0 ? actualStyles.varianceOverrun : actualStyles.varianceSaving}>
                  THB {formatCurrency(remainingBudget)}
                </strong>
              </div>
              <div className={`${actualStyles.budgetStatusBanner} ${remainingBudget >= 0 ? actualStyles.budgetStatusWithin : actualStyles.budgetStatusOver}`}>
                {remainingBudget >= 0 ? (
                  <>
                    <CheckCircle2 size={13} style={{ color: "#10b981" }} />
                    <span>{t("อยู่ในงบประมาณ", "Within budget")}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={13} style={{ color: "#ef4444" }} />
                    <span>{t("เกินงบประมาณ", "Over budget")}</span>
                  </>
                )}
              </div>
            </div>

            <button
              className={actualStyles.mainSaveButton}
              type="button"
              disabled={isSelectedCourseReadOnlyForFactory || isSavingResults}
              title={
                isSelectedCourseReadOnlyForFactory
                  ? t(
                      t("หลักสูตรของส่วนกลาง โรงงานดูได้อย่างเดียว แก้ไขไม่ได้", "Center course — Factory users have read-only access"),
                      "A Center course - read-only for factory users",
                    )
                  : undefined
              }
              onClick={() => void handleSave()}
            >
              {isSavingResults ? (
                t("กำลังบันทึก...", "Saving...")
              ) : (
                <>
                  <FileText size={16} />
                  {t("บันทึกค่าใช้จ่าย & ผลการอบรม", "Save cost & results")}
                </>
              )}
            </button>

            {savedMessage ? <p className={actualStyles.saveMessageText}>{savedMessage}</p> : null}
          </aside>
        </section>
      ) : (
        <section className={actualStyles.emptyStateBox} aria-label="No selected actual course">
          <div className={actualStyles.emptyStateIcon}>
            <BookOpen size={28} />
          </div>
          <h3 className={actualStyles.emptyStateTitle}>
            {t("พร้อมสำหรับการบันทึกผลการอบรมจริง", "Ready for Training Actual Recording")}
          </h3>
          <p className={actualStyles.emptyStateDesc}>
            {t(
              "กรุณาเลือก สิทธิ์ผู้จัด, หลักสูตร, และรอบการอบรม จาก Step 1-3 ด้านบน เพื่อเริ่มต้นเช็คชื่อและคำนวณค่าใช้จ่ายจริง",
              "Please select Course Owner, Course, and Training Session from Steps 1-3 above to record attendance and actual costs.",
            )}
          </p>
        </section>
      )}

      {/* Save Success Dialog Modal */}
      {showSaveSuccessModal && savedSummaryData ? (
        <div className={styles.successModalBackdrop} onClick={() => setShowSaveSuccessModal(false)}>
          <div
            className={styles.successModalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.successIconRing}>
              <span className={styles.checkIconEmoji}><Check size={28} /></span>
            </div>

            <div className={styles.successModalHeader}>
              <h3>{t("บันทึกข้อมูลการอบรมจริงสำเร็จ!", "Training actual saved")}</h3>
              <p>
                {t(
                  "ระบบบันทึกข้อมูลเรียบร้อยแล้ว โดยหลักสูตรนี้ถูกย้ายไปยังเมนู Training Record (ประวัติผลการอบรม) แล้ว และจะไม่แสดงในหน้านี้อีก",
                  "Attendance, cost, and results are recorded. This course has been moved to Training Record and will not be displayed here anymore.",
                )}
              </p>
            </div>

            <div className={styles.successCourseCard}>
              <div className={styles.successCourseCodeBadge}>[{savedSummaryData.courseCode}]</div>
              <div className={styles.successCourseTitle}>{savedSummaryData.courseTitle}</div>
              <div className={styles.successCourseMeta}>
                {t("รุ่นที่", "Batch")} <strong>{savedSummaryData.batch}</strong> • {t("วันที่", "Date")}{" "}
                <strong>{savedSummaryData.date}</strong>
              </div>
            </div>

            <div className={styles.savedMetricGrid}>
              <div className={styles.savedMetricCard}>
                <span>
                  <CheckCircle2 size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4, color: "#10b981" }} />
                  {t("ผู้เข้าเรียนจริง", "Attended")}
                </span>
                <strong>{t(`${savedSummaryData.actualCount} คน`, `${savedSummaryData.actualCount}`)}</strong>
              </div>
              <div className={styles.savedMetricCard}>
                <span>
                  <Wallet size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                  {t("รวมค่าใช้จ่ายจริง", "Total actual cost")}
                </span>
                <strong>THB {formatCurrency(savedSummaryData.totalCost)}</strong>
              </div>
              <div className={styles.savedMetricCard}>
                <span>
                  <BarChart3 size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                  {t("เฉลี่ยงบ / คน", "Cost per person")}
                </span>
                <strong>THB {formatCurrency(savedSummaryData.costPerPerson)}</strong>
              </div>
            </div>

            <div className={styles.savedTimestamp}>
              <Clock size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
              {t(`บันทึกเมื่อ: ${savedSummaryData.savedTime}`, `Saved at ${savedSummaryData.savedTime}`)}
            </div>

            <div className={styles.successModalActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setShowSaveSuccessModal(false)}
              >
                <Check size={14} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: 4 }} />
                {t("ตกลง", "Done")}
              </button>
              <a
                href="/training-record/training-record"
                className={styles.secondaryButton}
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <BookOpen size={14} />
                {t("ดูใน Training Record", "View in Training Record")}
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* Every paper one attendee handed in, both stages, with the stage chosen by a tab. Opening a
          row goes to the marked-up review; the card only says what exists. */}
      {attemptsCard ? (
        <div className={styles.attemptsOverlay} role="dialog" aria-modal="true" onClick={() => setAttemptsCard(null)}>
          <div className={styles.attemptsCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.attemptsHeader}>
              <div>
                <p className={styles.attemptsKicker}>{t("ประวัติการทำแบบทดสอบ", "Test attempts")}</p>
                <h3>{attemptsCard.name}</h3>
              </div>
              <button type="button" className={styles.attemptsClose} onClick={() => setAttemptsCard(null)}>
                <X size={14} />
              </button>
            </div>

            <div className={styles.attemptsTabs}>
              {(["preTest", "postTest"] as const).map((stageKey) => {
                const count = attemptsCard[stageKey].attempts.length;
                return (
                  <button
                    key={stageKey}
                    type="button"
                    className={attemptsStage === stageKey ? styles.attemptsTabOn : styles.attemptsTab}
                    onClick={() => setAttemptsStage(stageKey)}
                  >
                    {stageKey === "preTest" ? t("ก่อนอบรม", "Pre test") : t("หลังอบรม", "Post test")} · {count}
                  </button>
                );
              })}
            </div>

            {/* Two headline facts for the chosen stage, the same pair the employee's own panel
                leads with: the best they reached, and how many times they sat it. */}
            {(() => {
              const attempts = attemptsCard[attemptsStage].attempts;
              const scored = attempts.filter((attempt) => attempt.resultsPublished && attempt.score !== null);
              const best = scored.reduce<(typeof scored)[number] | null>(
                (top, attempt) => (top === null || attempt.score! > top.score! ? attempt : top),
                null,
              );
              return (
                <div className={styles.attemptsSummaryRow}>
                  <div className={styles.attemptsSummaryCard}>
                    <span>{t("คะแนนสูงสุด", "Best score")}</span>
                    <strong>{(best && scoreLabel(best.score, best.scoreMax)) || "-"}</strong>
                    <em>
                      {best
                        ? t(`ครั้งที่ ${best.attemptNo}`, `Attempt ${best.attemptNo}`)
                        : t("ยังไม่มีผลที่ประกาศแล้ว", "No released result yet")}
                    </em>
                  </div>
                  <div className={styles.attemptsSummaryCard}>
                    <span>{t("จำนวนครั้งที่ทำ", "Attempts taken")}</span>
                    <strong>{attempts.length}</strong>
                    <em>
                      {attempts.length - scored.length === 0
                        ? t("ประกาศผลครบแล้ว", "All results released")
                        : t(
                            t(`รอผลอีก ${attempts.length - scored.length} ครั้ง`, `Awaiting ${attempts.length - scored.length} more result(s)`),
                            `${attempts.length - scored.length} awaiting a result`,
                          )}
                    </em>
                  </div>
                </div>
              );
            })()}

            {attemptsCard[attemptsStage].attempts.length === 0 ? (
              <p className={styles.attemptsEmpty}>
                {attemptsCard[attemptsStage].mode === "FORM"
                  ? t("ยังไม่มีการทำแบบทดสอบนี้", "No attempt yet")
                  : t(
                      t("แบบทดสอบนี้ไม่ได้อยู่ในระบบ จึงไม่มีกระดาษคำตอบให้ดู", "This test is hosted externally, answer sheet not available in system"),
                      "This test is not held in the system, so there is no paper to open",
                    )}
              </p>
            ) : (
              <ul className={styles.attemptsList}>
                {attemptsCard[attemptsStage].attempts.map((attempt) => (
                  <li key={attempt.submissionId}>
                    {/* Opens in its own tab. This screen's course, session and half-typed results
                        live in component state, so navigating away and back would drop HRD at Step
                        1 with everything they had entered gone. */}
                    <a
                      className={styles.attemptsRow}
                      href={`/training-record/submission/${selectedCourse?.id}/${attempt.submissionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <strong>{t(`ครั้งที่ ${attempt.attemptNo}`, `Attempt ${attempt.attemptNo}`)}</strong>
                      <span>
                        {attempt.submittedAt
                          ? new Date(attempt.submittedAt).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </span>
                      <span>
                        {/* An unreleased score is not shown here either - the review page is where
                            HRD sees the marks, and this card is a list, not a result. */}
                        {(attempt.resultsPublished && scoreLabel(attempt.score, attempt.scoreMax)) ||
                          t("ยังไม่ประกาศผล", "Not released")}
                      </span>
                      <span className={styles.attemptsGo}>
                        {attempt.gradingStatus === "PENDING_REVIEW" ? t("รอตรวจ · เปิด →", "To mark · open →") : t("เปิด →", "Open →")}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
