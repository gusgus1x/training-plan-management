import type { ComponentType } from "react";
import CompanyData, { companyDataModule } from "./CompanyData";
import EmployeeData, { employeeDataModule } from "./EmployeeData";
import FunctionData, { functionDataModule } from "./FunctionData";
import InstructorData, { instructorDataModule } from "./InstructorData";
import LevelData, { levelDataModule } from "./LevelData";
import PositionData, { positionDataModule } from "./PositionData";

export type MasterDataModuleTopic = {
  title: string;
  subtitle: string;
  description: string;
  Component: ComponentType;
};

export const masterDataItems: readonly MasterDataModuleTopic[] = [
  { ...companyDataModule, Component: CompanyData },
  { ...functionDataModule, Component: FunctionData },
  { ...positionDataModule, Component: PositionData },
  { ...levelDataModule, Component: LevelData },
  { ...employeeDataModule, Component: EmployeeData },
  { ...instructorDataModule, Component: InstructorData },
];
