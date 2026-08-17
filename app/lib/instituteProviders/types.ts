export const INSTITUTE_PROVIDER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type InstituteProviderStatus = (typeof INSTITUTE_PROVIDER_STATUSES)[number];

export type InstituteProviderRecord = {
  instituteProviderId: string;
  instituteProviderCode: string;
  instituteProviderName: string;
  status: InstituteProviderStatus;
};

export type InstituteProviderListFilters = {
  search: string | null;
  status: InstituteProviderStatus | null;
  skip: number;
  take: number;
};

export type CreateInstituteProviderInput = {
  instituteProviderCode: string;
  instituteProviderName: string;
  status: InstituteProviderStatus;
};

export type UpdateInstituteProviderInput = Partial<CreateInstituteProviderInput>;

export type DeleteInstituteProviderResult = {
  instituteProvider: InstituteProviderRecord;
  outcome: "DELETED" | "DEACTIVATED";
};
