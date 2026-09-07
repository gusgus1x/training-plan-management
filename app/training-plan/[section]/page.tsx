import CenterFactoryTrainingPlanManagement from "../../components/center_factory/TrainingPlanManagement/CenterFactory_TrainingPlanManagement";

export default async function TrainingPlanSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { section } = await params;
  const query = searchParams ? await searchParams : {};
  const courseId = typeof query.courseId === "string" ? query.courseId : (typeof query.planId === "string" ? query.planId : undefined);
  return <CenterFactoryTrainingPlanManagement selectedSlug={section} initialCourseId={courseId} />;
}
