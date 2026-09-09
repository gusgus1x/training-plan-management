import SubmissionReviewPage from "../../../../components/center_factory/TrainingRecordManagement/modules/SubmissionReviewPage";

/**
 * HRD's view of one submitted paper. Three segments after /training-record, so it never collides
 * with the single-segment /training-record/[section] the workspace tabs use.
 */
export default async function TrainingRecordSubmissionPage({
  params,
}: {
  params: Promise<{ planId: string; submissionId: string }>;
}) {
  const { planId, submissionId } = await params;
  return <SubmissionReviewPage planId={planId} submissionId={submissionId} />;
}
