import CenterFactoryTrainingPlanManagement from "../../components/center_factory/TrainingPlanManagement/CenterFactory_TrainingPlanManagement";

export default async function TrainingPlanSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <CenterFactoryTrainingPlanManagement selectedSlug={section} />;
}
