import CenterFactoryTrainingRecordManagement from "../../components/center_factory/TrainingRecordManagement/CenterFactory_TrainingRecordManagement";

export default async function TrainingRecordSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <CenterFactoryTrainingRecordManagement selectedSlug={section} />;
}
