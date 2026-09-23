export type TrainedCandidate = {
  attendanceStatus: string | null | undefined;
  completionStatus: string | null | undefined;
  planEnd: Date;
};

/**
 * Whether one enrollment means the employee has actually been trained: the batch is over, and they
 * either completed it or were checked in. An approval alone is only a seat, not a training, and a
 * batch still to come has trained nobody yet.
 */
export const isTrainedEnrollment = (row: TrainedCandidate, now: Date) =>
  row.planEnd.getTime() < now.getTime() &&
  (row.completionStatus === "COMPLETED" || row.attendanceStatus === "PRESENT" || row.attendanceStatus === "LATE");

/** Every enrollment on any batch of a course, with what isTrainedEnrollment needs. */
export const courseEnrollmentsSelect = {
  plan_id: true,
  employee_user_id: true,
  approval_status: true,
  attendance: { select: { attendance_status: true } },
  training_result: { select: { completion_status: true, completed_at: true } },
  training_plan: {
    select: {
      plan_id: true,
      plan_name: true,
      batch_no: true,
      batch_name: true,
      start_datetime: true,
      end_datetime: true,
      training_plan_oap: { select: { plan_year: true } },
    },
  },
} as const;

export const batchLabel = (plan: { batch_no: number | null; batch_name: string | null }) =>
  plan.batch_name || (plan.batch_no ? `รุ่น ${plan.batch_no}` : null);
