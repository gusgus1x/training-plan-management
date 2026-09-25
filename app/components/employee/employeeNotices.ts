import { followUpReminderAt } from "../../lib/trainingForms/availability";
import { employeePath } from "./employeePaths";
import type { EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import { outstandingStageKeys, STAGE_LABELS_EN, STAGE_LABELS_TH } from "./RecordModule";

/** Enrollments whose 30-day follow-up evaluation is due for a reminder and still unanswered. Fires
 *  from FOLLOW_UP_REMINDER_AFTER_DAYS, which is earlier than the form itself opens
 *  (FOLLOW_UP_OPENS_AFTER_DAYS), so employees see it coming. */
export const pendingFollowUpEvaluationsOf = (enrollments: EnrollmentRecord[], now: Date = new Date()) =>
  enrollments.filter(
    (enrollment) =>
      enrollment.plan.assessment.evaluationAfter30Day.mode === "FORM" &&
      enrollment.plan.assessment.evaluationAfter30Day.submission === null &&
      now.getTime() >= new Date(followUpReminderAt(enrollment.plan.endAt)).getTime(),
  );

/** Enrollments carrying an issued certificate. The repository has already filtered to CONFIRMED +
 *  ACTIVE, so anything present here is a certificate HRD signed off. */
export const certificatesOf = (enrollments: EnrollmentRecord[]) =>
  enrollments.filter((enrollment) => enrollment.certificate !== null);

import type { TrainingRecordRequestRecord } from "../../lib/trainingRecordRequests/types";

export type NoticeStageKey = "pre" | "post" | "evaluation" | "evaluation30";
const STAGE_ORDER: NoticeStageKey[] = ["pre", "post", "evaluation", "evaluation30"];

type NoticeBase = {
  /** Stable per piece of news. */
  id: string;
  tab: "completed" | "pending" | "download";
};

/**
 * Things still waiting on this person, worked out from their records every time: each one goes
 * away by itself once it is done. News about something that already happened (a certificate, a
 * decision, a changed batch) is written to the notification table instead - see
 * useStoredNotifications.
 */
export type EmployeeNotice =
  | (NoticeBase & { kind: "forms"; stages: NoticeStageKey[]; enrollmentId: string; courseName: string; courseCode: string; tab: "completed" | "pending" })
  | (NoticeBase & { kind: "record_request_approval"; request: TrainingRecordRequestRecord; tab: "download" })
  | (NoticeBase & { kind: "enrollment_approval"; enrollment: EnrollmentRecord; tab: "pending" });

const APPROVED_STATUSES = ["Factory Approved", "Center Approved"];

export const buildEmployeeNotices = (
  enrollments: EnrollmentRecord[],
  recordRequests?: {
    pendingApprovals?: TrainingRecordRequestRecord[];
  },
  pendingEnrollments?: EnrollmentRecord[],
  now: Date = new Date(),
): EmployeeNotice[] => {
  const followUpDue = new Set(pendingFollowUpEvaluationsOf(enrollments, now).map((enrollment) => enrollment.id));
  const notices: EmployeeNotice[] = [];

  // 1. Pending training enrollment approval for approver (Section Head / Manager / Superior)
  if (pendingEnrollments?.length) {
    for (const enr of pendingEnrollments) {
      if (enr.status === "Pending Approval") {
        notices.push({
          id: `enrollment_approval:${enr.id}`,
          kind: "enrollment_approval",
          enrollment: enr,
          tab: "pending",
        });
      }
    }
  }

  // 2. Pending training record requests for approver (Section Head / Manager)
  if (recordRequests?.pendingApprovals?.length) {
    for (const req of recordRequests.pendingApprovals) {
      if (req.status === "PENDING") {
        notices.push({
          id: `record_request_approval:${req.id}`,
          kind: "record_request_approval",
          request: req,
          tab: "download",
        });
      }
    }
  }

  // 3. Forms still to answer on each course
  // (Decisions, certificates and the notification table's rows are news, not to-dos: the bell reads
  // those through useStoredNotifications.)
  for (const enrollment of enrollments) {
    const attended = enrollment.attendance?.status === "PRESENT";
    const base = {
      enrollmentId: enrollment.id,
      courseName: enrollment.plan.courseName,
      courseCode: enrollment.plan.courseCode,
      tab: attended ? ("completed" as const) : ("pending" as const),
    };
    // A course still waiting on approval has nothing the employee can answer yet.
    if (!attended && !APPROVED_STATUSES.includes(enrollment.status)) continue;
    const stages = new Set<NoticeStageKey>(outstandingStageKeys(enrollment.plan.assessment));
    if (followUpDue.has(enrollment.id)) stages.add("evaluation30");
    if (!stages.size) continue;
    const ordered = STAGE_ORDER.filter((key) => stages.has(key));
    notices.push({ ...base, id: `forms:${enrollment.id}:${ordered.join("+")}`, kind: "forms", stages: ordered });
  }
  return notices;
};

/** The wording, shared by the dashboard card and the bell so the two never say different things. */
export const noticeText = (notice: EmployeeNotice, isThai: boolean) => {
  if (notice.kind === "enrollment_approval") {
    const enr = notice.enrollment;
    const requester = enr.employeeName
      ? `${enr.employeeName}${enr.employeeCode ? ` (${enr.employeeCode})` : ""}`
      : enr.employeeCode || "พนักงาน";
    const courseTitle = enr.plan.courseName || enr.plan.courseCode;
    const scheduleDate = enr.plan.startAt ? enr.plan.startAt.slice(0, 10) : "-";
    return isThai
      ? {
          eyebrow: "คำขออนุมัติการลงทะเบียนอบรม",
          title: `คุณ ${requester} ได้ส่งคำขอลงทะเบียนหลักสูตร ${courseTitle} รอให้ท่านพิจารณาอนุมัติ`,
          detail: `รหัสวิชา: ${enr.plan.courseCode} • วันที่: ${scheduleDate}`,
        }
      : {
          eyebrow: "Course registration approval needed",
          title: `Registration for ${courseTitle} from ${requester} awaits your approval`,
          detail: `Course: ${enr.plan.courseCode} • Date: ${scheduleDate}`,
        };
  }

  if (notice.kind === "record_request_approval") {
    const req = notice.request;
    const requester = req.employeeName
      ? `${req.employeeName}${req.employeeCode ? ` (${req.employeeCode})` : ""}`
      : req.employeeCode || "พนักงาน";
    return isThai
      ? {
          eyebrow: "คำขออนุมัติประวัติการอบรม",
          title: `คุณ ${requester} ได้ส่งคำขอประวัติการอบรม รอให้ท่านพิจารณาอนุมัติ`,
          detail: `เลขที่คำขอ ${req.requestNo} • เพื่อดาวน์โหลดเอกสาร Word (.docx) ฉบับเต็ม`,
        }
      : {
          eyebrow: "Record approval needed",
          title: `Training record request from ${requester} awaits your approval`,
          detail: `Request #${req.requestNo} • To download full official Word (.docx) document`,
        };
  }

  const hasTest = notice.stages.some((key) => key === "pre" || key === "post");
  const hasEvaluation = notice.stages.some((key) => key === "evaluation" || key === "evaluation30");
  const what = isThai
    ? hasTest && hasEvaluation ? "แบบทดสอบและแบบประเมิน" : hasTest ? "แบบทดสอบ" : "แบบประเมิน"
    : hasTest && hasEvaluation ? "tests and evaluations" : hasTest ? "a test" : "an evaluation";
  const labels = isThai ? STAGE_LABELS_TH : STAGE_LABELS_EN;
  return isThai
    ? {
        eyebrow: "งานที่ต้องทำ",
        title: `คอร์ส ${notice.courseName} มี${what}ที่คุณต้องทำให้เสร็จ`,
        detail: notice.stages.map((key) => labels[key]).join(" · "),
      }
    : {
        eyebrow: "To do",
        title: `${notice.courseName} has ${what} for you to finish`,
        detail: notice.stages.map((key) => labels[key]).join(" · "),
      };
};

// ---- What the employee has done with each notice --------------------------------------------

const DAY_MS = 86_400_000;
/** A dashboard card retires on its own this long after it was first shown. */
export const NOTICE_LIFETIME_MS = 3 * DAY_MS;
/** The X only puts a card away until tomorrow. */
export const NOTICE_SNOOZE_MS = DAY_MS;

export type NoticeEntry = {
  firstSeenAt: number;
  snoozedUntil?: number;
  /** "Don't show again", or the card was opened - either way the employee has taken it in. */
  dismissed?: true;
  /** Seen in the bell's list, which only clears the red count. */
  seenInBell?: true;
};
export type NoticeState = Record<string, NoticeEntry>;

export const isShownOnDashboard = (entry: NoticeEntry | undefined, now: number) =>
  Boolean(
    entry &&
      !entry.dismissed &&
      now - entry.firstSeenAt < NOTICE_LIFETIME_MS &&
      !(entry.snoozedUntil && now < entry.snoozedUntil),
  );

export const stampFirstSeen = (state: NoticeState, notices: EmployeeNotice[], now: number): NoticeState => {
  const missing = notices.filter((notice) => !state[notice.id]);
  if (!missing.length) return state;
  const next = { ...state };
  for (const notice of missing) next[notice.id] = { firstSeenAt: now };
  return next;
};

const patchEntry = (state: NoticeState, id: string, patch: Partial<NoticeEntry>, now: number): NoticeState => ({
  ...state,
  [id]: { ...state[id], firstSeenAt: state[id]?.firstSeenAt ?? now, ...patch },
});

/** "Don't show again", or opened from a card or the bell. */
export const markDismissed = (state: NoticeState, id: string, now = Date.now()) =>
  patchEntry(state, id, { dismissed: true }, now);

/** The card's X: back tomorrow. */
export const markSnoozed = (state: NoticeState, id: string, now = Date.now()) =>
  patchEntry(state, id, { snoozedUntil: now + NOTICE_SNOOZE_MS }, now);

/** Opening the bell's list clears its red count. */
export const markSeenInBell = (state: NoticeState, notices: EmployeeNotice[], now = Date.now()) =>
  notices.reduce((next, notice) => patchEntry(next, notice.id, { seenInBell: true }, now), state);

export const unreadCount = (notices: EmployeeNotice[], state: NoticeState) =>
  notices.filter((notice) => !state[notice.id]?.seenInBell).length;

/** Lands on the course or request in My Record. `at` makes a repeat click on the same notice still
 *  count as a new navigation. */
export const noticeHref = (notice: EmployeeNotice, now = Date.now()) => {
  if (notice.kind === "record_request_approval") {
    return employeePath("record", "download", { focusRequest: notice.request.id, at: now });
  }
  if (notice.kind === "enrollment_approval") {
    return employeePath("register", null, { focusApproval: notice.enrollment.id, at: now });
  }
  return employeePath("record", notice.tab, { focus: notice.enrollmentId, at: now });
};

// ---- Persistence ----------------------------------------------------------------------------
// ponytail: per-browser localStorage, so a notice put away on the office PC shows again on a phone.
// Move to a table keyed by employee if that starts to matter.

export const NOTICE_EVENT = "employee-notices-change";
const storageKey = (userKey: string) => `employee-notices:${userKey}`;

export const loadNoticeState = (userKey: string): NoticeState => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userKey)) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as NoticeState) : {};
  } catch {
    return {};
  }
};

/** Read-modify-write against storage, not a component's copy: the bell and the cards both write,
 *  and a stale copy in one would undo the other's change. */
export const updateNoticeState = (userKey: string, change: (state: NoticeState) => NoticeState) => {
  const current = loadNoticeState(userKey);
  const next = change(current);
  if (next === current) return;
  try {
    window.localStorage.setItem(storageKey(userKey), JSON.stringify(next));
  } catch {
    // Private browsing or a full quota - the notice just comes back next time.
  }
  window.dispatchEvent(new Event(NOTICE_EVENT));
};
