"use client";

import { useRouter } from "next/navigation";
import { useAuthenticatedUser } from "./components/AuthenticatedUserContext";
import { useAuthActions } from "./components/AuthActionsContext";
import AdminDashboard from "./components/admin/AdminDashboard";
import CenterFactoryDashboard from "./components/center_factory/CenterFactory_Dashboard";
import UserDashboard from "./components/employee/UserDashboard";
import { slugify } from "./lib/slug";

export default function Home() {
  const user = useAuthenticatedUser();
  const { logout } = useAuthActions();
  const router = useRouter();

  if (!user) {
    return null;
  }

  const goHome = () => router.push("/");

  if (user.roleCode === "EMPLOYEE") {
    return <UserDashboard onHome={goHome} onLogout={logout} username={user.username} />;
  }

  // Administrators view the dedicated Admin Dashboard
  if (user.roleCode === "ADMIN") {
    return <AdminDashboard />;
  }

  return (
    <CenterFactoryDashboard
      onOpenTrainingPlan={() => router.push("/training-plan")}
      onOpenTrainingRecord={() => router.push("/training-record")}
      onOpenTrainingCourse={() => router.push("/training-course")}
      onOpenMasterData={() => router.push("/master-data")}
      onOpenReport={(targetModule, year, month) => {
        const path = targetModule ? `/report/${slugify(targetModule)}` : "/report";
        const query = new URLSearchParams();
        if (year) query.set("year", year);
        if (month) query.set("month", month);
        const queryString = query.toString();
        router.push(queryString ? `${path}?${queryString}` : path);
      }}
      onHome={goHome}
      onLogout={logout}
      username={user.username}
    />
  );
}
