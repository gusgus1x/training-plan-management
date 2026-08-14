import CenterFactoryTrainingCourseManagement from "../../components/center_factory/TrainingCourseManagement/CenterFactory_TrainingCourseManagement";

export default async function TrainingCourseSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <CenterFactoryTrainingCourseManagement selectedSlug={section} />;
}
