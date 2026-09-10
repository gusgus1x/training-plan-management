import EvaluationResultsPage from "../../../components/center_factory/TrainingRecordManagement/modules/EvaluationResultsPage";

/**
 * One course's evaluation answers, charted. Three segments after /training-record, so it never
 * collides with the single-segment /training-record/[section] the workspace tabs use.
 */
export default async function TrainingRecordEvaluationsPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  return <EvaluationResultsPage planId={planId} />;
}
