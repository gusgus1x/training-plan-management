"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "../AuthActionsContext";
import { useAuthenticatedUser } from "../AuthenticatedUserContext";
import UserDashboard from "./UserDashboard";
import { isUserModule } from "./employeePaths";

/**
 * The employee dashboard at a path. Anyone else, or an unknown module, goes back to "/", which
 * shows each role its own home.
 */
export default function EmployeeWorkspace({ module, sub }: { module: string | null; sub: string | null }) {
  const user = useAuthenticatedUser();
  const { logout } = useAuthActions();
  const router = useRouter();
  const allowed = user?.roleCode === "EMPLOYEE" && (module === null || isUserModule(module));

  useEffect(() => {
    if (user && !allowed) router.replace("/");
  }, [user, allowed, router]);

  if (!user || !allowed) return null;
  return (
    <UserDashboard
      module={module && isUserModule(module) ? module : null}
      sub={sub}
      onHome={() => router.push("/")}
      onLogout={logout}
      username={user.username}
    />
  );
}
