import type { ComponentType } from "react";
import { withSlug } from "../../../../lib/slug";
import CompanyData, { companyDataModule } from "./CompanyData";
import EmployeeData, { employeeDataModule } from "./EmployeeData";
import FunctionData, { functionDataModule } from "./FunctionData";
import FunctionMapping, { functionMappingModule } from "./FunctionMapping";
import InstructorData, { instructorDataModule } from "./InstructorData";
import LevelData, { levelDataModule } from "./LevelData";
import PositionData, { positionDataModule } from "./PositionData";
import CourseGroup, { courseGroupModule } from "./CourseGroup";
import CourseType, { courseTypeModule } from "./CourseType";
import InstituteProviderData, {
  instituteProviderDataModule,
} from "./InstituteProviderData";

export type MasterDataModuleTopic = {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  locked?: boolean;
  slug: string;
  Component: ComponentType;
};

export const masterDataItems: readonly MasterDataModuleTopic[] = [
  { ...withSlug(employeeDataModule), icon: "👥", Component: EmployeeData },
  { ...withSlug(functionDataModule), icon: "⚙️", Component: FunctionData },
  { ...withSlug(functionMappingModule), icon: "🔗", Component: FunctionMapping },
  { ...withSlug(instructorDataModule), icon: "🧑‍🏫", Component: InstructorData },
  {
    ...withSlug(instituteProviderDataModule),
    icon: "🏛️",
    Component: InstituteProviderData,
  },
  { ...withSlug(companyDataModule), icon: "🏢", Component: CompanyData },
  { ...withSlug(positionDataModule), icon: "💼", Component: PositionData },
  { ...withSlug(levelDataModule), icon: "📶", Component: LevelData },
  { ...withSlug(courseTypeModule), icon: "🏷️", Component: CourseType },
  { ...withSlug(courseGroupModule), icon: "🗂️", Component: CourseGroup },
];

