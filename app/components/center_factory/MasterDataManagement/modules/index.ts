import React, { type ComponentType } from "react";
import {
  Users,
  Settings,
  Link2,
  GraduationCap,
  Landmark,
  Building2,
  Briefcase,
  TrendingUp,
  Tag,
  Folder,
} from "../../../icons/LucideIcons";
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
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  locked?: boolean;
  slug: string;
  Component: ComponentType;
};

export const masterDataItems: readonly MasterDataModuleTopic[] = [
  { ...withSlug(employeeDataModule), icon: React.createElement(Users, { size: 24 }), Component: EmployeeData },
  { ...withSlug(functionDataModule), icon: React.createElement(Settings, { size: 24 }), Component: FunctionData },
  { ...withSlug(functionMappingModule), icon: React.createElement(Link2, { size: 24 }), Component: FunctionMapping },
  { ...withSlug(instructorDataModule), icon: React.createElement(GraduationCap, { size: 24 }), Component: InstructorData },
  {
    ...withSlug(instituteProviderDataModule),
    icon: React.createElement(Landmark, { size: 24 }),
    Component: InstituteProviderData,
  },
  { ...withSlug(companyDataModule), icon: React.createElement(Building2, { size: 24 }), Component: CompanyData },
  { ...withSlug(positionDataModule), icon: React.createElement(Briefcase, { size: 24 }), Component: PositionData },
  { ...withSlug(levelDataModule), icon: React.createElement(TrendingUp, { size: 24 }), Component: LevelData },
  { ...withSlug(courseTypeModule), icon: React.createElement(Tag, { size: 24 }), Component: CourseType },
  { ...withSlug(courseGroupModule), icon: React.createElement(Folder, { size: 24 }), Component: CourseGroup },
];

