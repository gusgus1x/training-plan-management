"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  getCurrentSession,
  loginWithCredentials,
  logoutCurrentSession,
  type ClientRoleCode,
  type ClientSessionUser,
} from "../lib/auth/client";
import { initializeTrainingWorkflow } from "../lib/trainingWorkflow";
import CenterFactoryDashboard from "./center_factory/CenterFactory_Dashboard";
import CenterFactoryMasterDataManagement from "./center_factory/MasterDataManagement/CenterFactory_MasterDataManagement";
import CenterFactoryReportManagement from "./center_factory/ReportManagement/CenterFactory_ReportManagement";
import CenterFactoryTrainingCourseManagement from "./center_factory/TrainingCourseManagement/CenterFactory_TrainingCourseManagement";
import CenterFactoryTrainingPlanManagement from "./center_factory/TrainingPlanManagement/CenterFactory_TrainingPlanManagement";
import CenterFactoryTrainingRecordManagement from "./center_factory/TrainingRecordManagement/CenterFactory_TrainingRecordManagement";
import UserDashboard from "./employee/UserDashboard";
import LoginPage from "./LoginPage";
import Navbar from "./Navbar";
import { AuthenticatedUserProvider } from "./AuthenticatedUserContext";
import styles from "./TrainingPlanManagement.module.css";

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
const AUTHENTICATED_USER_STORAGE_KEY = "tpm_authenticated_user";

const readCachedUser = (): ClientSessionUser | null => {
  try {
    const serializedUser = sessionStorage.getItem(AUTHENTICATED_USER_STORAGE_KEY);

    if (!serializedUser) {
      return null;
    }

    const user = JSON.parse(serializedUser) as Partial<ClientSessionUser>;

    if (
      typeof user.userId !== "string" ||
      typeof user.username !== "string" ||
      !["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER"].includes(user.roleCode ?? "")
    ) {
      return null;
    }

    return user as ClientSessionUser;
  } catch {
    return null;
  }
};

const writeCachedUser = (user: ClientSessionUser) => {
  sessionStorage.setItem(AUTHENTICATED_USER_STORAGE_KEY, JSON.stringify(user));
};

const clearCachedUser = () => {
  sessionStorage.removeItem(AUTHENTICATED_USER_STORAGE_KEY);
};

const testUsers: Record<ClientRoleCode, ClientSessionUser> = {
  EMPLOYEE: {
    userId: "test-employee",
    username: "test.employee",
    roleCode: "EMPLOYEE",
    employeeId: "emp-test-001",
    companyId: "company-snf",
    email: "test.employee@attg.local",
    employeeCode: "SNF-5401",
    displayName: "Test Employee",
    companyCode: "SNF",
    companyName: "The Siam Nawaloha Foundry Co.,Ltd",
    functionCode: "PRD",
    functionName: "Production",
    positionCode: "OP",
    positionName: "Operator",
    levelCode: "L2",
    levelName: "L2",
    pl: "PL2",
  },
  HRD_CENTER: {
    userId: "test-center",
    username: "test.center",
    roleCode: "HRD_CENTER",
    employeeId: "center-test-001",
    companyId: null,
    email: "test.center@attg.local",
    employeeCode: "HRD-0001",
    displayName: "Test HRD Center",
    companyCode: null,
    companyName: "HRD Center",
    functionCode: "HRD",
    functionName: "Human Resource Development",
    positionCode: "HRD",
    positionName: "HRD Center",
    levelCode: "L5",
    levelName: "L5",
    pl: "PL5",
  },
  HRD_FACTORY: {
    userId: "test-factory",
    username: "test.factory",
    roleCode: "HRD_FACTORY",
    employeeId: "factory-test-001",
    companyId: "company-snf",
    email: "test.factory@attg.local",
    employeeCode: "SNF-HRD-01",
    displayName: "Test HRD Factory",
    companyCode: "SNF",
    companyName: "The Siam Nawaloha Foundry Co.,Ltd",
    functionCode: "HRD",
    functionName: "Human Resource Development",
    positionCode: "HRD",
    positionName: "HRD Factory",
    levelCode: "L4",
    levelName: "L4",
    pl: "PL4",
  },
};

export default function TrainingPlanManagement() {
  const [authentication, setAuthentication] =
    useState<AuthenticationState>({ status: "checking" });
  const [view, setView] = useState<AppView>("dashboard");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  useEffect(() => {
    initializeTrainingWorkflow();
    let active = true;

    getCurrentSession()
      .then((user) => {
        if (!active) {
          return;
        }

        if (user) {
          writeCachedUser(user);
          setAuthentication({ status: "authenticated", user });
          return;
        }

        clearCachedUser();
        setAuthentication({ status: "anonymous" });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        const cachedUser = readCachedUser();

        if (cachedUser) {
          setAuthentication({ status: "authenticated", user: cachedUser });
          return;
        }

        setAuthentication({
          status: "anonymous",
          message: SESSION_CHECK_ERROR,
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (username: string, password: string) => {
    clearCachedUser();
    const user = await loginWithCredentials(username, password);
    writeCachedUser(user);
    setView("dashboard");
    setLogoutMessage(null);
    setAuthentication({ status: "authenticated", user });
  };

  const handleTestLogin = (roleCode: ClientRoleCode) => {
    const user = testUsers[roleCode];

    writeCachedUser(user);
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
    } catch {
      // Local sign-out should still complete if the cookie clearing request fails.
      setLogoutMessage(LOGOUT_ERROR);
    } finally {
      clearCachedUser();
      setView("dashboard");
      setAuthentication({ status: "anonymous" });
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
        onTestLogin={handleTestLogin}
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
  } else if (view === "training-plan") {
    application = (
      <CenterFactoryTrainingPlanManagement
        onBack={goHome}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else if (view === "training-record") {
    application = (
      <CenterFactoryTrainingRecordManagement
        onBack={goHome}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else if (view === "training-course") {
    application = (
      <CenterFactoryTrainingCourseManagement
        onBack={goHome}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else if (view === "master-data") {
    application = (
      <CenterFactoryMasterDataManagement
        onBack={goHome}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else if (view === "report") {
    application = (
      <CenterFactoryReportManagement
        onBack={goHome}
        onHome={goHome}
        onLogout={logout}
        username={user.username}
      />
    );
  } else {
    application = (
      <CenterFactoryDashboard
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
