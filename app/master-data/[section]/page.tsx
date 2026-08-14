import CenterFactoryMasterDataManagement from "../../components/center_factory/MasterDataManagement/CenterFactory_MasterDataManagement";

export default async function MasterDataSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <CenterFactoryMasterDataManagement selectedSlug={section} />;
}
