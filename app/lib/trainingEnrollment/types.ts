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

export type EnrollmentRecord = {
  id: string;
  planId: string;
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
