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

export type SectionMappingRecord = {
  sectionMappingId: string;
  companyId: string;
  companyCode: string;
  companyNameTh: string;
  plantSectionCode: string;
  plantSectionName: string;
  sectionId: string;
  sectionCode: string;
  sectionNameTh: string;
  status: SectionStatus;
};

export type MappingListFilters = SectionListFilters & {
  companyId: string | null;
};

export type CreateSectionMappingInput = {
  companyId: string | null;
  plantSectionCode: string;
  plantSectionName: string;
  sectionId: string;
  status: SectionStatus;
};

export type UpdateSectionMappingInput = Partial<
  Omit<CreateSectionMappingInput, "companyId">
>;

export type PaginatedResult<Item> = {
  items: Item[];
  totalItems: number;
};
