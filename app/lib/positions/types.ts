export const POSITION_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export type PositionRecord = {
  positionId: string;
  positionCode: string;
  positionNameTh: string;
  positionNameEn: string | null;
  status: PositionStatus;
};

export type PositionListFilters = {
  search: string | null;
  status: PositionStatus | null;
  skip: number;
  take: number;
};

export type CreatePositionInput = {
  positionCode: string;
  positionNameTh: string;
  positionNameEn: string | null;
  status: PositionStatus;
};

export type UpdatePositionInput = Partial<CreatePositionInput>;
