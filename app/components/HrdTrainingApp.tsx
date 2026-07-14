"use client";

import { useState } from "react";
import Dashboard from "./center/Dashboard";
import MasterDataManagement from "./center/MasterDataManagement";
import ReportManagement from "./center/ReportManagement";
import TrainingCourseManagement from "./center/TrainingCourseManagement";
import TrainingPlanManagement from "./center/TrainingPlanManagement";
import TrainingRecordManagement from "./center/TrainingRecordManagement";
import FactoryDashboard from "./factory/Dashboard";
import FactoryMasterDataManagement from "./factory/MasterDataManagement";
import FactoryReportManagement from "./factory/ReportManagement";
import FactoryTrainingCourseManagement from "./factory/TrainingCourseManagement";
import FactoryTrainingPlanManagement from "./factory/TrainingPlanManagement";
import FactoryTrainingRecordManagement from "./factory/TrainingRecordManagement";
import UserDashboard from "./employee/UserDashboard";
import LoginPage from "./LoginPage";

type AppView =
  | "dashboard"
  | "training-plan"
  | "training-record"
  | "master-data"
  | "report"
  | "training-course";

type UserRole = "admin" | "factory" | "user";

export default function HrdTrainingApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<UserRole>("admin");
  const [view, setView] = useState<AppView>("dashboard");
  const centerUsername = "HRD-CENTER";
  const factoryUsername = "HRD-FACTORY";

  const handleLogin = (nextRole: UserRole = "admin") => {
    setRole(nextRole);
    setIsLoggedIn(true);
    setView("dashboard");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setView("dashboard");
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (role === "user") {
    return (
      <UserDashboard
        onHome={() => setView("dashboard")}
        onLogout={handleLogout}
        username="emp.user"
      />
    );
  }

  if (role === "factory") {
    if (view === "training-plan") {
      return (
        <FactoryTrainingPlanManagement
          onBack={() => setView("dashboard")}
          onHome={() => setView("dashboard")}
          onLogout={handleLogout}
          username={factoryUsername}
        />
      );
    }

    if (view === "training-record") {
      return (
        <FactoryTrainingRecordManagement
          onBack={() => setView("dashboard")}
          onHome={() => setView("dashboard")}
          onLogout={handleLogout}
          username={factoryUsername}
        />
      );
    }

    if (view === "training-course") {
      return (
        <FactoryTrainingCourseManagement
          onBack={() => setView("dashboard")}
          onHome={() => setView("dashboard")}
          onLogout={handleLogout}
          username={factoryUsername}
        />
      );
    }

    if (view === "master-data") {
      return (
        <FactoryMasterDataManagement
          onBack={() => setView("dashboard")}
          onHome={() => setView("dashboard")}
          onLogout={handleLogout}
          username={factoryUsername}
        />
      );
    }

    if (view === "report") {
      return (
        <FactoryReportManagement
          onBack={() => setView("dashboard")}
          onHome={() => setView("dashboard")}
          onLogout={handleLogout}
          username={factoryUsername}
        />
      );
    }

    return (
      <FactoryDashboard
        onOpenTrainingPlan={() => setView("training-plan")}
        onOpenTrainingRecord={() => setView("training-record")}
        onOpenTrainingCourse={() => setView("training-course")}
        onOpenMasterData={() => setView("master-data")}
        onOpenReport={() => setView("report")}
        onHome={() => setView("dashboard")}
        onLogout={handleLogout}
        username={factoryUsername}
      />
    );
  }

  if (view === "training-plan") {
    return (
      <TrainingPlanManagement
        onBack={() => setView("dashboard")}
        onHome={() => setView("dashboard")}
        onLogout={handleLogout}
        username={centerUsername}
      />
    );
  }

  if (view === "training-record") {
    return (
      <TrainingRecordManagement
        onBack={() => setView("dashboard")}
        onHome={() => setView("dashboard")}
        onLogout={handleLogout}
        username={centerUsername}
      />
    );
  }

  if (view === "training-course") {
    return (
      <TrainingCourseManagement
        onBack={() => setView("dashboard")}
        onHome={() => setView("dashboard")}
        onLogout={handleLogout}
        username={centerUsername}
      />
    );
  }

  if (view === "master-data") {
    return (
      <MasterDataManagement
        onBack={() => setView("dashboard")}
        onHome={() => setView("dashboard")}
        onLogout={handleLogout}
        username={centerUsername}
      />
    );
  }

  if (view === "report") {
    return (
      <ReportManagement
        onBack={() => setView("dashboard")}
        onHome={() => setView("dashboard")}
        onLogout={handleLogout}
        username={centerUsername}
      />
    );
  }

  return (
    <Dashboard
      onOpenTrainingPlan={() => setView("training-plan")}
      onOpenTrainingRecord={() => setView("training-record")}
      onOpenTrainingCourse={() => setView("training-course")}
      onOpenMasterData={() => setView("master-data")}
      onOpenReport={() => setView("report")}
      onHome={() => setView("dashboard")}
      onLogout={handleLogout}
      username={centerUsername}
    />
  );
}
