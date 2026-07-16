"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ClientSessionUser } from "../lib/auth/client";

const AuthenticatedUserContext = createContext<ClientSessionUser | null>(null);

export function AuthenticatedUserProvider({ user, children }: {
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
  { label: "รหัสพนักงาน", value: profileValue(user?.employeeCode) },
  { label: "ตำแหน่ง", value: profileValue(user?.positionName) },
  { label: "แผนก", value: profileValue(user?.functionName) },
  {
    label: "บริษัท",
    value: user?.roleCode === "HRD_CENTER"
      ? "ทุกบริษัท"
      : profileValue(user?.companyName ?? user?.companyCode),
  },
  {
    label: "ระดับพนักงาน",
    value: profileValue(
      [user?.levelName, user?.pl].filter(Boolean).join(" / ") || null,
    ),
  },
  { label: "อีเมล", value: profileValue(user?.email) },
];
