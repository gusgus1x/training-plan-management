export const COMPANY_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export type CompanyRecord = {
  companyId: string;
  companyCode: string;
  companyNameTh: string;
  companyNameEn: string | null;
  remark: string | null;
  status: CompanyStatus;
};

export type CompanyListFilters = {
  search: string | null;
  status: CompanyStatus | null;
  skip: number;
  take: number;
};

export type CreateCompanyInput = {
  companyCode: string;
  companyNameTh: string;
  companyNameEn: string | null;
  remark: string | null;
  status: CompanyStatus;
};

export type UpdateCompanyInput = Partial<CreateCompanyInput>;

export type CompanyListResponse = {
  items: CompanyRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};
