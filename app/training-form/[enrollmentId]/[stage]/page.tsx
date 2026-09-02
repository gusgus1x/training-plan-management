import TrainingFormRunner from "../../../components/employee/TrainingFormRunner";

export default async function TrainingFormPage({
  params,
}: {
  params: Promise<{ enrollmentId: string; stage: string }>;
}) {
  const { enrollmentId, stage } = await params;
  return <TrainingFormRunner enrollmentId={enrollmentId} stage={stage} />;
}
