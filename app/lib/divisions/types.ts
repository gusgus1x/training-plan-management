export const DIVISION_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type DivisionStatus = (typeof DIVISION_STATUSES)[number];

export type DivisionRecord = {
  divisionId: string;
  divisionCode: string;
  divisionNameTh: string;
  divisionNameEn: string | null;
  status: DivisionStatus;
};

export type DivisionListFilters = {
  search: string | null;
  status: DivisionStatus | null;
  skip: number;
  take: number;
};

export type CreateDivisionInput = {
  divisionCode: string;
  divisionNameTh: string;
  divisionNameEn: string | null;
  status: DivisionStatus;
};

export type UpdateDivisionInput = Partial<CreateDivisionInput>;

export type DivisionMappingRecord = {
  divisionMappingId: string;
  companyId: string;
  companyCode: string;
  companyNameTh: string;
  plantDivisionCode: string;
  plantDivisionName: string;
  divisionId: string;
  divisionCode: string;
  divisionNameTh: string;
  status: DivisionStatus;
};

export type MappingListFilters = DivisionListFilters & {
  companyId: string | null;
};

export type CreateDivisionMappingInput = {
  companyId: string | null;
  plantDivisionCode: string;
  plantDivisionName: string;
  divisionId: string;
  status: DivisionStatus;
};

export type UpdateDivisionMappingInput = Partial<
  Omit<CreateDivisionMappingInput, "companyId">
>;

export type PaginatedResult<Item> = {
  items: Item[];
  totalItems: number;
};
