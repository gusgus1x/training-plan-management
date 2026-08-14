import type { ComponentType } from "react";
import { withSlug } from "../../../../lib/slug";
import CompanyData, { companyDataModule } from "./CompanyData";
import EmployeeData, { employeeDataModule } from "./EmployeeData";
import FunctionData, { functionDataModule } from "./FunctionData";
import InstructorData, { instructorDataModule } from "./InstructorData";
import LevelData, { levelDataModule } from "./LevelData";
import PositionData, { positionDataModule } from "./PositionData";
import CourseGroup, { courseGroupModule } from "./CourseGroup";
import CourseType, { courseTypeModule } from "./CourseType";

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
  { ...withSlug(courseTypeModule), icon: "🏷️", Component: CourseType },
  { ...withSlug(courseGroupModule), icon: "🗂️", Component: CourseGroup },
  { ...withSlug(companyDataModule), icon: "🏢", Component: CompanyData },
  { ...withSlug(functionDataModule), icon: "⚙️", Component: FunctionData },
  { ...withSlug(positionDataModule), icon: "💼", Component: PositionData },
  { ...withSlug(levelDataModule), icon: "📶", Component: LevelData },
  { ...withSlug(employeeDataModule), icon: "👥", Component: EmployeeData },
  { ...withSlug(instructorDataModule), icon: "🧑‍🏫", Component: InstructorData },
];
