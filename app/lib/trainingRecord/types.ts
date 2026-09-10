import type { AssessmentStageInfo } from "../trainingEnrollment/types";

export type TrainingRecordExpenses = {
  accommodation: number;
  foodBeverage: number;
  instructor: number;
  material: number;
  seminarRoom: number;
  traveling: number;
};

/** The three values dbo.training_result's check constraint allows. */
export const COMPLETION_STATUSES = ["PENDING", "NOT_COMPLETED", "COMPLETED"] as const;
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

/**
 * What HRD reads on screen. The stored values are database enum names; nobody filling in a
 * roster knows what NOT_COMPLETED is supposed to mean, and the question they are actually
 * answering is whether the person passed.
 */
export const completionStatusLabel = (status: CompletionStatus, language: "th" | "en") =>
  ({
    COMPLETED: { th: "ผ่าน", en: "Passed" },
    NOT_COMPLETED: { th: "ไม่ผ่าน", en: "Not passed" },
    PENDING: { th: "ยังไม่ระบุ", en: "Not decided" },
  })[status][language === "th" ? "th" : "en"];

/** What HRD records for one attendee once the course is over. */
export type TrainingResultEntry = {
  enrollmentId: string;
  preScore: number | null;
  postScore: number | null;
  completionStatus: CompletionStatus;
  completedAt: string | null;
  validUntil: string | null;
  certificateNo: string | null;
};

/**
 * One person who could be asked to evaluate an attendee. The org unit fields are on the picker
 * because this system has no reporting line: HRD is the one who knows which section head belongs to
 * which attendee, and division/department/section is what they recognise them by. Two people can
 * easily share a name.
 */
export type ReviewerCandidate = {
  reviewerUserId: string;
  employeeCode: string;
  name: string;
  position: string;
  /** Company code. A centre HRD user sees every company at once, so the picker needs it both to
   *  filter by and to tell two people of the same name apart. */
  company: string;
  division: string;
  department: string;
  section: string;
};

/**
 * A reviewer HRD has actually assigned to one attendee.
 *
 * `openedAt` is the first time the reviewer opened the form or followed the link. It is NOT a
 * completion record - for a course evaluated by an external link it is the only signal that will
 * ever exist, because this system cannot see what happens on someone else's form. `submitted` can
 * only ever be true for an in-system form.
 */
export type ReviewerAssignment = ReviewerCandidate & {
  assignedAt: string;
  openedAt: string | null;
  submitted: boolean;
};

export type TrainingRecordAttendee = {
  enrollmentId: string;
  employeeId: string;
  /** The SAP UserID. HRD needs it to name certificate files, but it identifies a person, so the
   *  screen keeps it masked until someone asks for it. */
  employeeUserId: string;
  employeeCode: string;
  name: string;
  department: string;
  position: string;
  company: string;
  /**
   * The four organisation levels an employee record actually carries, in both languages, empty
   * where unset. They are four different things and the roster shows all four: `department` above
   * carries only the function, which is why a column headed Dept had been reading as one for so
   * long. Both languages travel together because the screen can switch language without refetching.
   */
  orgUnit: {
    functionTh: string;
    functionEn: string;
    divisionTh: string;
    divisionEn: string;
    departmentTh: string;
    departmentEn: string;
    sectionTh: string;
    sectionEn: string;
  };
  attended: boolean;
  preTestPassed: boolean | null;
  postTestPassed: boolean | null;
  /** The attendee's own evaluation. A reviewer's answers never count towards this. */
  evaluationCompleted: boolean;
  /** null until HRD records one. */
  result: TrainingResultEntry | null;
  /** Who was asked to evaluate this attendee, or null when nobody has been. */
  reviewer: ReviewerAssignment | null;
};

/** One row of the basket HRD saves: the attendee, and who reviews them. A null reviewer removes
 *  whoever was assigned. */
export type SaveReviewersInput = {
  assignments: Array<{ enrollmentId: string; reviewerUserId: string | null }>;
};

export type SaveResultsInput = {
  results: Array<{
    enrollmentId: string;
    preScore: number | null;
    postScore: number | null;
    completionStatus: CompletionStatus;
    validUntil: string | null;
    certificateNo: string | null;
  }>;
};

export type TrainingRecordSummary = {
  planId: string;
  /** How this course is evaluated: an in-system form, an external link, or not at all. */
  evaluation: AssessmentStageInfo;
  /** The 30-day follow-up, resolved the same way. Kept apart from `evaluation` because it is the
   *  only stage a supervisor is ever asked to fill in: the follow-up asks what changed in the
   *  person since the course, which is a question only their supervisor can answer. */
  evaluationAfter30Day: AssessmentStageInfo;
  registeredCount: number;
  attendedCount: number;
  expenses: TrainingRecordExpenses;
  preTestPassCount: number;
  postTestPassCount: number;
  evaluationCompletedCount: number;
  attendees: TrainingRecordAttendee[];
  savedAt: string;
};

export type CompanyCostBreakdownRow = {
  companyCode: string;
  presentCount: number;
  allocatedCost: number;
};

export type CostBreakdown = {
  planId: string;
  plannedTotals: TrainingRecordExpenses;
  plannedGrandTotal: number;
  actualTotals: TrainingRecordExpenses;
  actualGrandTotal: number;
  presentCount: number;
  costPerPerson: number;
  companyBreakdown: CompanyCostBreakdownRow[];
};

export const EXPENSE_CATEGORIES = [
  "ACCOMMODATION",
  "FOOD_BEVERAGE",
  "INSTRUCTOR",
  "MATERIAL",
  "SEMINAR_ROOM",
  "TRAVELING",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type SaveExpensesInput = Record<
  "accommodation" | "foodBeverage" | "instructor" | "material" | "seminarRoom" | "traveling",
  number
>;

export type ExpenseKey = keyof SaveExpensesInput;

/**
 * When a result taken on `trainingDate` stops being valid, given the course's validity period.
 * Returns null when the course declares none, because then there is no expiry to record.
 *
 * Month arithmetic overflows: 31 August plus 6 months is 31 February, which Date rolls forward
 * into March. The day is clamped to the end of the target month instead, so a certificate cannot
 * silently gain days.
 */
export const expiryFrom = (trainingDate: string, validityMonths: number | null) => {
  if (!validityMonths || validityMonths <= 0) return null;

  const start = new Date(`${trainingDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;

  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + validityMonths;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), lastDayOfTargetMonth);

  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
};

/**
 * One name per expense, shared by every screen. Training Actual and Training Record each had their
 * own list, and the same key read "ค่าวัดผล / เอกสารประกอบ" on the form and "ค่าเอกสาร & อุปกรณ์"
 * on the report - two different things to anyone reading them side by side.
 */
export const EXPENSE_ITEMS: ReadonlyArray<{ key: ExpenseKey; label: string; icon: string }> = [
  { key: "instructor", label: "ค่าวิทยากร (Instructor)", icon: "instructor" },
  { key: "traveling", label: "ค่าเดินทาง (Traveling)", icon: "traveling" },
  { key: "seminarRoom", label: "ค่าห้องอบรม & สถานที่ (Seminar Room)", icon: "seminarRoom" },
  { key: "accommodation", label: "ค่าที่พัก (Accommodation)", icon: "accommodation" },
  { key: "material", label: "ค่าเอกสาร & อุปกรณ์ (Material)", icon: "material" },
  { key: "foodBeverage", label: "ค่าอาหาร & เครื่องดื่ม (Food & Beverage)", icon: "foodBeverage" },
];
