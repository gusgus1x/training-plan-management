"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  getCurrentSession,
  loginWithCredentials,
  logoutCurrentSession,
  type ClientSessionUser,
} from "../lib/auth/client";
import Dashboard from "./center/Dashboard";
import MasterDataManagement from "./center/MasterDataManagement";
import ReportManagement from "./center/ReportManagement";
import TrainingCourseManagement from "./center/TrainingCourseManagement";
import TrainingPlanManagement from "./center/TrainingPlanManagement";
import TrainingRecordManagement from "./center/TrainingRecordManagement";
import UserDashboard from "./employee/UserDashboard";
import FactoryDashboard from "./factory/Factory_Dashboard";
import FactoryMasterDataManagement from "./factory/Factory_MasterDataManagement";
import FactoryReportManagement from "./factory/Factory_ReportManagement";
import FactoryTrainingCourseManagement from "./factory/Factory_TrainingCourseManagement";
import FactoryTrainingPlanManagement from "./factory/Factory_TrainingPlanManagement";
import FactoryTrainingRecordManagement from "./factory/Factory_TrainingRecordManagement";
import LoginPage from "./LoginPage";
import Navbar from "./Navbar";
import { AuthenticatedUserProvider } from "./AuthenticatedUserContext";
import styles from "./HrdTrainingApp.module.css";

type AppView =
  | "dashboard"
  | "training-plan"
  | "training-record"
  | "master-data"
  | "report"
  | "training-course";

type AuthenticationState =
  | { status: "checking" }
  | { status: "anonymous"; message?: string }
  | { status: "authenticated"; user: ClientSessionUser };

const SESSION_CHECK_ERROR =
  "Unable to verify your previous session. Please sign in again.";
const LOGOUT_ERROR = "Unable to sign out. Please try again.";

export default function HrdTrainingApp() {
  const [authentication, setAuthentication] =
    useState<AuthenticationState>({ status: "checking" });
  const [view, setView] = useState<AppView>("dashboard");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getCurrentSession()
      .then((user) => {
        if (!active) {
          return;
        }

        setAuthentication(
          user ? { status: "authenticated", user } : { status: "anonymous" },
        );
      })
      .catch(() => {
        if (active) {
          setAuthentication({
            status: "anonymous",
            message: SESSION_CHECK_ERROR,
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (username: string, password: string) => {
    const user = await loginWithCredentials(username, password);
    setView("dashboard");
    setLogoutMessage(null);
    setAuthentication({ status: "authenticated", user });
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setLogoutMessage(null);

    try {
      await logoutCurrentSession();
      setView("dashboard");
      setAuthentication({ status: "anonymous" });
    } catch {
      setLogoutMessage(LOGOUT_ERROR);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (authentication.status === "checking") {
    return (
      <main className={styles.statusPage} aria-busy="true">
        <Navbar />
        <section className={styles.statusCard}>
          <p className={styles.eyebrow}>Authentication</p>
          <h1>Checking your session...</h1>
        </section>
      </main>
    );
  }

  if (authentication.status === "anonymous") {
    return (
      <LoginPage
        onLogin={handleLogin}
        sessionMessage={authentication.message}
      />
    );
  }

  const { user } = authentication;
  const goHome = () => setView("dashboard");
  const logout = () => void handleLogout();
  let application: ReactNode;

  if (user.roleCode === "EMPLOYEE") {
    application = (
      <UserDashboard
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else if (user.roleCode === "HRD_FACTORY") {
    if (view === "training-plan") {
      application = (
        <FactoryTrainingPlanManagement
          onBack={goHome}
          onHome={goHome}
          onLogout={logout}
          username={user.username}
        />
      );
    } else if (view === "training-record") {
      application = (
        <FactoryTrainingRecordManagement
          onBack={goHome}
          onHome={goHome}
          onLogout={logout}
          username={user.username}
        />
      );
    } else if (view === "training-course") {
      application = (
        <FactoryTrainingCourseManagement
          onBack={goHome}
          onHome={goHome}
          onLogout={logout}
          username={user.username}
        />
      );
    } else if (view === "master-data") {
      application = (
        <FactoryMasterDataManagement
          onBack={goHome}
          onHome={goHome}
          onLogout={logout}
          username={user.username}
        />
      );
    } else if (view === "report") {
      application = (
        <FactoryReportManagement
          onBack={goHome}
          onHome={goHome}
          onLogout={logout}
          username={user.username}
        />
      );
    } else {
      application = (
        <FactoryDashboard
          onOpenTrainingPlan={() => setView("training-plan")}
          onOpenTrainingRecord={() => setView("training-record")}
          onOpenTrainingCourse={() => setView("training-course")}
          onOpenMasterData={() => setView("master-data")}
          onOpenReport={() => setView("report")}
          onHome={goHome}
          onLogout={logout}
          username={user.username}
        />
      );
    }
  } else if (view === "training-plan") {
    application = (
      <TrainingPlanManagement
        onBack={goHome}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else if (view === "training-record") {
    application = (
      <TrainingRecordManagement
        onBack={goHome}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else if (view === "training-course") {
    application = (
      <TrainingCourseManagement
        onBack={goHome}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else if (view === "master-data") {
    application = (
      <MasterDataManagement
        onBack={goHome}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else if (view === "report") {
    application = (
      <ReportManagement
        onBack={goHome}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else {
    application = (
      <Dashboard
        onOpenTrainingPlan={() => setView("training-plan")}
        onOpenTrainingRecord={() => setView("training-record")}
        onOpenTrainingCourse={() => setView("training-course")}
        onOpenMasterData={() => setView("master-data")}
        onOpenReport={() => setView("report")}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  }

  return (
    <AuthenticatedUserProvider user={user}>
      {logoutMessage ? (
        <p className={styles.logoutError} role="alert">
          {logoutMessage}
        </p>
      ) : null}
      {application}
      <div className={styles.demoBadge}>ข้อมูลตัวอย่างสำหรับการพัฒนา</div>
    </AuthenticatedUserProvider>
  );
}
