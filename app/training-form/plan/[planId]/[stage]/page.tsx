import TrainingFormScanLanding from "../../../../components/employee/TrainingFormScanLanding";

/**
 * Where a scanned QR code lands. Three segments after /training-form, so it never collides with
 * the two-segment /training-form/[enrollmentId]/[stage] an employee is forwarded to.
 */
export default async function TrainingFormScanPage({
  params,
}: {
  params: Promise<{ planId: string; stage: string }>;
}) {
  const { planId, stage } = await params;
  return <TrainingFormScanLanding planId={planId} stage={stage} />;
}
