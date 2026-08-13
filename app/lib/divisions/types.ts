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
