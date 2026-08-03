export const MASTER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type MasterStatus = (typeof MASTER_STATUSES)[number];

export type OrganizationFunctionRecord = {
  functionId: string;
  functionCode: string;
  functionNameTh: string;
  functionNameEn: string | null;
  status: MasterStatus;
};

export type FunctionMappingRecord = {
  functionMappingId: string;
  companyId: string;
  companyCode: string;
  companyNameTh: string;
  plantFunctionCode: string;
  plantFunctionName: string;
  functionId: string;
  functionCode: string;
  functionNameTh: string;
  status: MasterStatus;
};

export type FunctionListFilters = {
  search: string | null;
  status: MasterStatus | null;
  skip: number;
  take: number;
};

export type MappingListFilters = FunctionListFilters & {
  companyId: string | null;
};

export type CreateOrganizationFunctionInput = {
  functionCode: string;
  functionNameTh: string;
  functionNameEn: string | null;
  status: MasterStatus;
};

export type UpdateOrganizationFunctionInput =
  Partial<CreateOrganizationFunctionInput>;

export type CreateFunctionMappingInput = {
  companyId: string | null;
  plantFunctionCode: string;
  plantFunctionName: string;
  functionId: string;
  status: MasterStatus;
};

export type UpdateFunctionMappingInput = Partial<
  Omit<CreateFunctionMappingInput, "companyId">
>;

export type PaginatedResult<Item> = {
  items: Item[];
  totalItems: number;
};
