export const DEPARTMENT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type DepartmentStatus = (typeof DEPARTMENT_STATUSES)[number];

export type DepartmentRecord = {
  departmentId: string;
  departmentCode: string;
  departmentNameTh: string;
  departmentNameEn: string | null;
  status: DepartmentStatus;
};

export type DepartmentListFilters = {
  search: string | null;
  status: DepartmentStatus | null;
  skip: number;
  take: number;
};

export type CreateDepartmentInput = {
  departmentCode: string;
  departmentNameTh: string;
  departmentNameEn: string | null;
  status: DepartmentStatus;
};

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>;
