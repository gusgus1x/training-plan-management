import { moduleCards, type UserModule } from "./data";

/** My Record's three tabs, each with its own path under /employee/record. */
export const RECORD_TABS = ["pending", "completed", "download"] as const;
export type RecordTab = (typeof RECORD_TABS)[number];

export const isUserModule = (value: string | null | undefined): value is UserModule =>
  moduleCards.some((module) => module.key === value);

export const isRecordTab = (value: string | null | undefined): value is RecordTab =>
  RECORD_TABS.includes(value as RecordTab);

/**
 * Where an employee page lives: "/" for the dashboard home, "/employee/<module>" for a module and
 * "/employee/record/<tab>" for a My Record tab. Empty query values are left out.
 */
export const employeePath = (
  module: UserModule | null,
  sub?: string | null,
  query: Record<string, string | number | null | undefined> = {},
) => {
  const path = module ? `/employee/${module}${sub ? `/${encodeURIComponent(sub)}` : ""}` : "/";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
};
