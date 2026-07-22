export type TrainingNeedRequestStatus = "New Request" | "Review" | "Accepted" | "Rejected";
export type TrainingNeedUrgency = "Low" | "Normal" | "High";
export type TrainingCourseOwner = "Center" | "Factory";

export type EmployeeTrainingNeedRequest = {
  id: string;
  requestNo: string;
  employeeCode: string;
  employeeName: string;
  company: string;
  functionName: string;
  courseNeed: string;
  reason: string;
  sourceCourse?: string;
  sourceCourseDate?: string;
  sourceCourseResult?: string;
  sourceCourseOwner?: TrainingCourseOwner;
  expectedBenefit: string;
  preferredMonth: string;
  urgency: TrainingNeedUrgency;
  status: TrainingNeedRequestStatus;
  submittedAt: string;
  approvedBy: string;
};

export const EMPLOYEE_TRAINING_REQUESTS_STORAGE_KEY =
  "training-plan.employee-training-requests";

export const APPROVED_TRAINING_NEED_STORAGE_KEY =
  "training-plan.approved-training-need";

export const createTrainingNeedRequestNo = () => {
  const now = new Date();
  return `REQ-${now.getFullYear()}-${String(now.getTime()).slice(-5)}`;
};
