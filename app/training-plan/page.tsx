import CenterFactoryTrainingPlanManagement from "../components/center_factory/TrainingPlanManagement/CenterFactory_TrainingPlanManagement";

export default async function TrainingPlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = searchParams ? await searchParams : {};
  const courseId = typeof query.courseId === "string" ? query.courseId : (typeof query.planId === "string" ? query.planId : undefined);
  return <CenterFactoryTrainingPlanManagement initialCourseId={courseId} />;
}

