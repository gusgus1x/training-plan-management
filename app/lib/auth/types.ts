export const ROLE_CODES = ["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER"] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export type AuthenticationAccount = {
  userId: string;
  username: string;
  passwordHash: string;
  accountStatus: string;
  roleCode: string;
  roleStatus: string;
  employeeId: string | null;
  employeeStatus: string | null;
  employeeCompanyId: string | null;
  employeeCompanyStatus: string | null;
  accountCompanyId: string | null;
  accountCompanyStatus: string | null;
  accountEmail: string | null;
  employeeCode: string | null;
  employeeFirstNameTh: string | null;
  employeeLastNameTh: string | null;
  employeeFirstNameEn: string | null;
  employeeLastNameEn: string | null;
  employeeEmail: string | null;
  companyCode: string | null;
  companyNameTh: string | null;
  companyNameEn: string | null;
  functionCode: string | null;
  functionNameTh: string | null;
  functionNameEn: string | null;
  positionCode: string | null;
  positionNameTh: string | null;
  positionNameEn: string | null;
  levelCode: string | null;
  levelNameTh: string | null;
  levelNameEn: string | null;
  pl: string | null;
};

export type AuthenticatedPrincipal = {
  userId: string;
  username: string;
  role: RoleCode;
  employeeId: string | null;
  companyId: string | null;
  email: string | null;
  employeeCode: string | null;
  displayName: string | null;
  companyCode: string | null;
  companyName: string | null;
  functionCode: string | null;
  functionName: string | null;
  positionCode: string | null;
  positionName: string | null;
  levelCode: string | null;
  levelName: string | null;
  pl: string | null;
};
