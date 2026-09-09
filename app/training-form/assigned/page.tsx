import AssignedEvaluations from "../../components/employee/AssignedEvaluations";

/**
 * A supervisor's list of evaluations about other people. One segment after /training-form, so it
 * never collides with the two-segment /training-form/[enrollmentId]/[stage] the rows link to.
 */
export default function AssignedEvaluationsPage() {
  return <AssignedEvaluations />;
}
