"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ClientSessionUser } from "../lib/auth/client";

const AuthenticatedUserContext = createContext<ClientSessionUser | null>(null);

export function AuthenticatedUserProvider({
  user,
  children,
}: {
  user: ClientSessionUser;
  children: ReactNode;
}) {
  return (
    <AuthenticatedUserContext.Provider value={user}>
      {children}
    </AuthenticatedUserContext.Provider>
  );
}

export const useAuthenticatedUser = () => useContext(AuthenticatedUserContext);

export const profileValue = (value: string | null | undefined) =>
  value?.trim() || "-";

export const buildProfileItems = (user: ClientSessionUser | null) => [
  { label: "Employee Code", value: profileValue(user?.employeeCode) },
  { label: "Position", value: profileValue(user?.positionName) },
  { label: "Function", value: profileValue(user?.functionName) },
  {
    label: "Company",
    value:
      user?.roleCode === "HRD_CENTER"
        ? "All Companies"
        : profileValue(user?.companyName ?? user?.companyCode),
  },
  {
    label: "Level",
    value: profileValue(
      [user?.levelName, user?.pl].filter(Boolean).join(" / ") || null,
    ),
  },
  { label: "Email", value: profileValue(user?.email) },
];
