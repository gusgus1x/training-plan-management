export type EmploymentStatus = "ACTIVE" | "INACTIVE";
export type EmployeeRecord = {
  employeeId: string; companyId: string; companyCode: string; employeeCode: string | null; userId: string;
  functionId: string | null; functionCode: string | null; functionName: string | null;
  divisionId: string | null; divisionCode: string | null; divisionName: string | null;
  departmentId: string | null; departmentCode: string | null; departmentName: string | null;
  sectionId: string | null; sectionCode: string | null; sectionName: string | null;
  positionId: string | null; positionCode: string | null; positionName: string | null;
  levelId: string | null; levelCode: string | null; levelKey: string | null;
  titleTh: string | null; titleEn: string | null; firstNameTh: string; lastNameTh: string;
  firstNameEn: string | null; lastNameEn: string | null; birthDate: string | null;
  hireDate: string | null; telephone: string | null; email: string | null;
  employmentStatus: EmploymentStatus; nationalIdMasked: string;
};
export type EmployeeInput = {
  companyId: string; employeeCode: string | null; userId: string; functionId: string | null;
  divisionId: string | null; departmentId: string | null; sectionId: string | null;
  positionId: string | null; levelId: string | null; nationalId: string;
  titleTh: string | null; titleEn: string | null; firstNameTh: string; lastNameTh: string;
  firstNameEn: string | null; lastNameEn: string | null; birthDate: string | null;
  hireDate: string | null; telephone: string | null; email: string | null;
  employmentStatus: EmploymentStatus;
};
export type UpdateEmployeeInput = Partial<Omit<EmployeeInput, "companyId">> & { companyId?: string };
export type EmployeeListFilters = { search: string | null; status: EmploymentStatus | null; skip: number; take: number };
