export const LEVEL_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type LevelStatus = (typeof LEVEL_STATUSES)[number];

export type LevelRecord = {
  levelId: string;
  levelCode: string;
  levelCodeTh: string;
  levelCodeEn: string;
  levelNameTh: string;
  levelNameEn: string | null;
  pl: string | null;
  levelKey: string;
  remark: string | null;
  status: LevelStatus;
};

export type LevelListFilters = {
  search: string | null;
  status: LevelStatus | null;
  skip: number;
  take: number;
};

export type CreateLevelInput = {
  levelCodeTh: string;
  levelCodeEn: string;
  levelNameTh: string;
  levelNameEn: string | null;
  pl: string;
  levelKey: string;
  remark: string | null;
  status: LevelStatus;
};

export type UpdateLevelInput = Partial<CreateLevelInput>;
export type PersistLevelInput = CreateLevelInput & { levelCode: string };
