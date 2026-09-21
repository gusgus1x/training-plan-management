export const RECORD_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export type RecordRequestStatus = (typeof RECORD_REQUEST_STATUSES)[number];

export const RECORD_REQUEST_TYPES = ["DOCUMENT", "TRANSFER", "RESIGNATION", "OTHER"] as const;
export type RecordRequestType = (typeof RECORD_REQUEST_TYPES)[number];

export type RecordRequestApproverCandidate = {
  reviewerUserId: string;
  employeeCode: string;
  name: string;
  position: string;
  department: string;
  section: string;
  company: string;
};

export type CreateRecordRequestInput = {
  approverUserId: string;
  requestReason: string;
  requestType?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type RecordRequestDecisionInput = {
  action: "approve" | "reject";
  note?: string | null;
};

export type TrainingRecordRequestRecord = {
  id: string;
  requestNo: string;
  companyId: string;
  companyCode: string;
  employeeUserId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  positionName: string;
  requestReason: string;
  requestType: string;
  dateFrom: string | null;
  dateTo: string | null;
  status: RecordRequestStatus;
  requestedAt: string;
  approverUserId: string | null;
  approverName: string | null;
  approverPosition: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
};
