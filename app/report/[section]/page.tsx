import CenterFactoryReportManagement from "../../components/center_factory/ReportManagement/CenterFactory_ReportManagement";

export default async function ReportSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { section } = await params;
  const { year, month } = await searchParams;
  return (
    <CenterFactoryReportManagement
      selectedSlug={section}
      initialYear={year}
      initialMonth={month}
    />
  );
}
