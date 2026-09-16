/**
 * A training need an employee asks HRD to plan. The employee names their section head when they
 * raise it; the head approves or rejects first, and only a head-approved request reaches HRD.
 */

/**
 * Database values, fixed by the live check constraint `CK_RC2_training_need_request_status_enum`.
 * The UI labels live in `labels.ts`, not here. Waiting for the head and waiting for HRD are both
 * PENDING - `stage` tells them apart.
 */
export type NeedRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "PLANNED";

export type ApproverDecision = "APPROVED" | "REJECTED";

/**
 * Where a request is right now, derived from status plus the head's decision. The one value every
 * screen reads, so "waiting for whom" is decided in one place.
 */
export type NeedRequestStage =
  | "WAITING_HEAD"
  | "WAITING_HRD"
  | "REJECTED_BY_HEAD"
  | "REJECTED"
  | "APPROVED"
  | "PLANNED";

export type NeedRequestPerson = {
  userId: string;
  employeeCode: string;
  name: string;
  position: string;
};

export type NeedRequestPlan = {
  planId: string;
  planCode: string;
  planName: string;
  startAt: string;
  endAt: string;
};

export type NeedRequestRecord = {
  id: string;
  requestNo: string;
  employeeUserId: string;
  employeeCode: string;
  employeeName: string;
  companyId: string;
  companyCode: string;
  functionId: string | null;
  functionName: string;
  requestedCourseName: string;
  requestReason: string;
  preferredStartDate: string | null;
  preferredEndDate: string | null;
  status: NeedRequestStatus;
  stage: NeedRequestStage;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  rejectionReason: string;
  /** The course this request names, once one was picked. Null for a typed topic and for requests
   *  raised before the course was recorded. */
  courseId: string | null;
  /** Who owns that course: the centre, or the factory whose company code is beside it. Null when
   *  the request names no course, so nobody owns it and the requester's HRD answers it. */
  courseOwner: "CENTER" | "FACTORY" | null;
  courseOwnerCompanyCode: string | null;
  /** The course's code and name as they were when the request was filed, for display. */
  courseCodeSnapshot: string | null;
  courseNameSnapshot: string | null;
  /** Null for a request raised before the section-head step existed. */
  approver: NeedRequestPerson | null;
  approverDecision: ApproverDecision | null;
  approverDecidedAt: string | null;
  approverNote: string;
  approverOpenedAt: string | null;
  /** Set once HRD links the request to a training batch. */
  trainingPlanId: string | null;
  plan: NeedRequestPlan | null;
  plannedAt: string | null;
};

export type CreateNeedRequestInput = {
  /**
   * The course the employee picked from their own record, when they picked one. Null for a topic
   * they typed themselves - that course does not exist yet, so there is nothing to point at.
   * Stored as the id, not the code: the id is the key nothing renames or reuses, and it is what
   * lets every later screen read the course's owner instead of guessing from the typed text.
   */
  courseId: string | null;
  requestedCourseName: string;
  requestReason: string;
  preferredStartDate: string | null;
  preferredEndDate: string | null;
  approverUserId: string;
};

/**
 * approve / reject / reset are HRD's; head_approve / head_reject are the named section head's;
 * link / unlink tie an approved request to a training batch and back.
 */
export type NeedRequestAction =
  | "approve"
  | "reject"
  | "reset"
  | "head_approve"
  | "head_reject"
  | "link"
  | "unlink";

export type UpdateNeedRequestInput = {
  action: NeedRequestAction;
  note: string | null;
  /** Required for link only. */
  planId: string | null;
};

export type BulkNeedRequestInput = {
  ids: string[];
  action: "approve" | "reject";
  note: string | null;
};

/** "mine" is the requester's own list; "approvals" is what waits on the caller as a section head. */
export type NeedRequestView = "mine" | "approvals";

export type NeedRequestListFilters = {
  status: NeedRequestStatus | null;
  employeeUserId: string | null;
  approverUserId: string | null;
};

/** Who is acting, as the repository needs it: never taken from the request body. */
export type NeedRequestActor = {
  role: "HRD_CENTER" | "HRD_FACTORY" | "EMPLOYEE";
  userId: string;
  employeeUserId: string | null;
  companyId: string | null;
};
