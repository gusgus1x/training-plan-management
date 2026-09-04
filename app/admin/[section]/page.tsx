"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticatedUser } from "../../components/AuthenticatedUserContext";
import AdminDashboard, { type AdminTabKey } from "../../components/admin/AdminDashboard";

export default function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);
  const user = useAuthenticatedUser();
  const router = useRouter();

  useEffect(() => {
    if (user && user.roleCode !== "ADMIN") {
      router.replace("/");
    }
  }, [user, router]);

  if (!user || user.roleCode !== "ADMIN") {
    return null;
  }

  const normalized = decodeURIComponent(section || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");

  let tab: AdminTabKey = "dashboard";
  if (normalized === "user_accounts" || normalized === "users" || normalized === "user") {
    tab = "users";
  } else if (normalized === "audit_logs" || normalized === "audit" || normalized === "audit_log") {
    tab = "audit";
  } else if (normalized === "charts" || normalized === "chart") {
    tab = "charts";
  } else if (normalized === "tables" || normalized === "table") {
    tab = "tables";
  }

  return <AdminDashboard initialTab={tab} />;
}
