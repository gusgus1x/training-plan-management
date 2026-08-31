export type EnrollmentSource = "EMPLOYEE" | "HRD_FACTORY" | "HRD_CENTER";

export type EnrollmentStatus = "Pending Approval" | "Factory Approved" | "Center Approved" | "Rejected" | "Cancelled";

export type MatchStatus = "MATCHED" | "NOT_MATCHED";
export type LevelMatchStatus = "MATCHED" | "NOT_MATCHED" | "NOT_REQUIRED";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

export type AttendanceRecord = {
  attendanceId: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  method: string;
  recordedBy: string | null;
  remark: string;
};

/**
 * How one stage of a course is assessed. The course table carries both an in-system form id and
 * an external link per stage, and either may be absent:
 *
 *   FORM  - an assessment built in this system; the score can come from the submission
 *   LINK  - somebody else's form (Google Forms and the like); this system cannot see the score
 *   NONE  - the course has no test or evaluation at this stage at all
 *
 * The distinction matters on the result screen: for NONE there is no score to record, and writing
 * one would put a mark for an exam that never existed onto a document the employee uses as
 * evidence.
 */
export type AssessmentMode = "NONE" | "LINK" | "FORM";

export type AssessmentStageInfo = {
  mode: AssessmentMode;
  /** Only set when mode is LINK. */
  link: string | null;
};

/**
 * Reads one stage's configuration off a course. A form wins over a link when a course carries
 * both: the in-system copy is the one this system can read a result from. Lives beside the type
 * because both the enrollment and the training-record repositories resolve stages the same way,
 * and two copies of this rule would drift.
 */
export const assessmentStage = (
  formId: bigint | null,
  link: string | null,
): AssessmentStageInfo => {
  if (formId !== null) return { mode: "FORM", link: null };
  if (link && link.trim()) return { mode: "LINK", link: link.trim() };
  return { mode: "NONE", link: null };
};

export type EnrollmentAssessmentInfo = {
  preTest: AssessmentStageInfo;
  postTest: AssessmentStageInfo;
  evaluation: AssessmentStageInfo;
  evaluationAfter30Day: AssessmentStageInfo;
};

/** What the employee actually enrolled in. Snapshotted onto the enrollment so the employee
 *  portal never has to read the organisation-wide plan list. */
export type EnrollmentPlanInfo = {
  assessment: EnrollmentAssessmentInfo;
  /**
   * How long a result for this course stays valid, in months. Null means it does not expire, so
   * there is no expiry to record. When it is set, the expiry is the training date plus this many
   * months - a figure the course already declares, which nobody should be retyping per attendee.
   */
  validityMonths: number | null;
  planCode: string;
  planName: string;
  batchName: string;
  courseCode: string;
  courseName: string;
  hours: number;
  instructor: string;
  provider: string;
  venue: string;
  startAt: string;
  endAt: string;
  owner: "CENTER" | "FACTORY";
};

/** What HRD recorded once the course ended. Null until somebody records it. */
export type EnrollmentResultInfo = {
  preScore: number | null;
  postScore: number | null;
  completionStatus: "PENDING" | "NOT_COMPLETED" | "COMPLETED";
  completedAt: string | null;
  validUntil: string | null;
  certificateNo: string | null;
};

/**
 * What a cancel returns. Cancelling deletes the enrollment and its results, attendance and
 * submissions outright — the product decision, not a soft delete — so there is no record left to
 * hand back and no stored status to name.
 */
export type EnrollmentDeleted = {
  enrollmentId: string;
  outcome: "DELETED";
};

export type EnrollmentRecord = {
  id: string;
  planId: string;
  plan: EnrollmentPlanInfo;
  result: EnrollmentResultInfo | null;
  employeeId: string;
  employeeUserId: string | null;
  employeeCode: string;
  employeeName: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  company: string;
  section?: string;
  division?: string;
  department: string;
  position: string;
  level: string;
  source: EnrollmentSource;
  status: EnrollmentStatus;
  targetMatchStatus: MatchStatus;
  levelMatchStatus: LevelMatchStatus;
  remark: string;
  enrolledAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  attendance: AttendanceRecord | null;
};

export type CreateEnrollmentInput = {
  planId: string;
  /** Surrogate employee id. Legacy during Phase 20; employeeUserId is preferred. */
  employeeId: string;
  /** Durable employee business key. Preferred; falls back to employeeId when absent. */
  employeeUserId: string | null;
  source: EnrollmentSource;
};

export type EnrollmentAction = "approve" | "reject" | "cancel";

export type UpdateEnrollmentInput = {
  action: EnrollmentAction;
  reason?: string;
};

export type SetAttendanceInput = {
  attended: boolean;
};

export type EnrollmentListFilters = {
  planId: string | null;
  employeeId: string | null;
  employeeUserId: string | null;
};
