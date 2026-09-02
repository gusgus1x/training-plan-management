import type { RoleCode } from "../auth/types";

export const USER_ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "LOCKED"] as const;
export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export type UserAccountRecord = {
  userId: string;
  username: string;
  email: string | null;
  roleCode: RoleCode;
  roleName: string;
  companyId: string | null;
  companyCode: string | null;
  employeeId: string | null;
  employeeName: string | null;
  status: UserAccountStatus;
  lastLoginAt: string | null;
  createdAt: string;
};

export type UserAccountListFilters = {
  search: string | null;
  status: UserAccountStatus | null;
  roleCode: RoleCode | null;
};

export type CreateUserAccountInput = {
  username: string;
  password: string;
  roleCode: RoleCode;
  companyId: string | null;
  employeeId: string | null;
  email: string | null;
  status: UserAccountStatus;
};

/** Password is changed through its own reset endpoint, never as part of a general edit. */
export type UpdateUserAccountInput = Partial<
  Omit<CreateUserAccountInput, "username" | "password">
>;
