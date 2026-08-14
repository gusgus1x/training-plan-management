import type { ComponentType } from "react";
import CompanyData, { companyDataModule } from "./CompanyData";
import EmployeeData, { employeeDataModule } from "./EmployeeData";
import FunctionData, { functionDataModule } from "./FunctionData";
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
  Component: ComponentType;
};

export const masterDataItems: readonly MasterDataModuleTopic[] = [
  { ...courseTypeModule, icon: "🏷️", Component: CourseType },
  { ...courseGroupModule, icon: "🗂️", Component: CourseGroup },
  { ...companyDataModule, icon: "🏢", Component: CompanyData },
  { ...functionDataModule, icon: "⚙️", Component: FunctionData },
  { ...positionDataModule, icon: "💼", Component: PositionData },
  { ...levelDataModule, icon: "📶", Component: LevelData },
  { ...employeeDataModule, icon: "👥", Component: EmployeeData },
  { ...instructorDataModule, icon: "🧑‍🏫", Component: InstructorData },
  { ...instituteProviderDataModule, icon: "🏛️", Component: InstituteProviderData },
];
