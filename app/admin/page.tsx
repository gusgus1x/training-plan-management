"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticatedUser } from "../components/AuthenticatedUserContext";
import AdminDashboard from "../components/admin/AdminDashboard";

export default function AdminPage() {
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

  return <AdminDashboard />;
}
