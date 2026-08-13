export const SECTION_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

export type SectionRecord = {
  sectionId: string;
  sectionCode: string;
  sectionNameTh: string;
  sectionNameEn: string | null;
  status: SectionStatus;
};

export type SectionListFilters = {
  search: string | null;
  status: SectionStatus | null;
  skip: number;
  take: number;
};

export type CreateSectionInput = {
  sectionCode: string;
  sectionNameTh: string;
  sectionNameEn: string | null;
  status: SectionStatus;
};

export type UpdateSectionInput = Partial<CreateSectionInput>;
