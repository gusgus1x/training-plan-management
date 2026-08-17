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

export type DepartmentMappingRecord = {
  departmentMappingId: string;
  companyId: string;
  companyCode: string;
  companyNameTh: string;
  plantDepartmentCode: string;
  plantDepartmentName: string;
  departmentId: string;
  departmentCode: string;
  departmentNameTh: string;
  status: DepartmentStatus;
};

export type MappingListFilters = DepartmentListFilters & {
  companyId: string | null;
};

export type CreateDepartmentMappingInput = {
  companyId: string | null;
  plantDepartmentCode: string;
  plantDepartmentName: string;
  departmentId: string;
  status: DepartmentStatus;
};

export type UpdateDepartmentMappingInput = Partial<
  Omit<CreateDepartmentMappingInput, "companyId">
>;

export type PaginatedResult<Item> = {
  items: Item[];
  totalItems: number;
};
