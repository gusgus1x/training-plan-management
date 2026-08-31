/**
 * A training need an employee asks HRD to plan. The table has existed since Phase 20 with a
 * foreign key onto employee.user_id; until now both screens exchanged these through localStorage,
 * so a request was visible only in the browser that created it.
 */

/**
 * Database values, fixed by the live check constraint `CK_RC2_training_need_request_status_enum`.
 * The UI labels live in `labels.ts`, not here. PLANNED is set once the approved request becomes a
 * training plan; no screen writes it yet, so it only ever arrives from the database.
 */
export type NeedRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "PLANNED";

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
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  rejectionReason: string;
  /** Set once HRD turns the request into a plan. */
  trainingPlanId: string | null;
  plannedAt: string | null;
};

export type CreateNeedRequestInput = {
  requestedCourseName: string;
  requestReason: string;
  preferredStartDate: string | null;
  preferredEndDate: string | null;
};

export type NeedRequestAction = "approve" | "reject" | "reset";

export type UpdateNeedRequestInput = {
  action: NeedRequestAction;
  note: string | null;
};

export type NeedRequestListFilters = {
  status: NeedRequestStatus | null;
  employeeUserId: string | null;
};
