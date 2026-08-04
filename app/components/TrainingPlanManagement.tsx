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
import LoginPage, { type PreviewCompanyCode } from "./LoginPage";
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
  | { status: "anonymous" }
  | { status: "error"; message: string }
  | { status: "authenticated"; user: ClientSessionUser }
  | { status: "preview"; user: ClientSessionUser };

const SESSION_CHECK_ERROR =
  "Unable to verify your session. Check the connection and try again.";
const LOGOUT_ERROR = "Unable to sign out. Please try again.";
const DEVELOPMENT_PREVIEW_ENABLED = process.env.NODE_ENV === "development";
const DEVELOPMENT_PREVIEW_COMPANY_NAMES: Record<PreviewCompanyCode, string> = {
  ATA: "Aisin Takaoka Asia Co., Ltd.",
  TEP: "Thai Engineering Products Co., Ltd.",
  ATFB: "Aisin Takaoka Foundry Bangpakong Co., Ltd.",
  NIC: "The Nawaloha Industry Co., Ltd.",
  SATI: "Siam AT Industry Co., Ltd.",
  SNF: "The Siam Nawaloha Foundry Co., Ltd.",
};

const DEVELOPMENT_PREVIEW_USERS: Record<ClientRoleCode, ClientSessionUser> = {
  HRD_CENTER: {
    userId: "preview-hrd-center",
    username: "Mock HRD Center",
    roleCode: "HRD_CENTER",
    employeeId: null,
    companyId: null,
    email: "mock.hrd.center@example.invalid",
    employeeCode: null,
    displayName: "Mock HRD Center",
    companyCode: null,
    companyName: null,
    functionCode: "HRD_CENTER",
    functionName: "Human Resources Development Center",
    positionCode: "HRD_CENTER",
    positionName: "HRD Center",
    levelCode: null,
    levelName: null,
    pl: null,
  },
  HRD_FACTORY: {
    userId: "preview-hrd-factory",
    username: "Mock HRD Factory",
    roleCode: "HRD_FACTORY",
    employeeId: null,
    companyId: "preview-company-sati",
    email: "mock.hrd.factory@example.invalid",
    employeeCode: null,
    displayName: "Mock HRD Factory",
    companyCode: "SATI",
    companyName: "SATI Mock Company",
    functionCode: "HRD_FACTORY",
    functionName: "Human Resources Development",
    positionCode: "HRD_FACTORY",
    positionName: "HRD Factory",
    levelCode: null,
    levelName: null,
    pl: null,
  },
  EMPLOYEE: {
    userId: "preview-employee",
    username: "Mock Employee",
    roleCode: "EMPLOYEE",
    employeeId: "preview-employee-sati",
    companyId: "preview-company-sati",
    email: "mock.employee@example.invalid",
    employeeCode: "MOCK-EMP-001",
    displayName: "Mock Employee",
    companyCode: "SATI",
    companyName: "SATI Mock Company",
    functionCode: "MOCK_PRODUCTION",
    functionName: "Mock Production",
    positionCode: "MOCK_OPERATOR",
    positionName: "Mock Operator",
    levelCode: "MOCK_LEVEL",
    levelName: "Mock Level",
    pl: "MOCK-PL1",
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
          setAuthentication({ status: "authenticated", user });
          return;
        }

        setAuthentication({ status: "anonymous" });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setAuthentication({
          status: "error",
          message: SESSION_CHECK_ERROR,
        });
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

  const handlePreviewLogin = (
    roleCode: ClientRoleCode,
    companyCode?: PreviewCompanyCode,
  ) => {
    if (!DEVELOPMENT_PREVIEW_ENABLED || roleCode === "EMPLOYEE") {
      return;
    }

    const previewUser =
      roleCode === "HRD_FACTORY" && companyCode
        ? {
            ...DEVELOPMENT_PREVIEW_USERS.HRD_FACTORY,
            userId: `preview-hrd-factory-${companyCode.toLowerCase()}`,
            username: `Mock HRD Factory (${companyCode})`,
            companyId: `preview-company-${companyCode.toLowerCase()}`,
            email: `mock.hrd.factory.${companyCode.toLowerCase()}@example.invalid`,
            displayName: `Mock HRD Factory (${companyCode})`,
            companyCode,
            companyName: DEVELOPMENT_PREVIEW_COMPANY_NAMES[companyCode],
          }
        : DEVELOPMENT_PREVIEW_USERS[roleCode];

    setView("dashboard");
    setLogoutMessage(null);
    setAuthentication({
      status: "preview",
      user: previewUser,
    });
  };

  const handleRetrySession = async () => {
    setAuthentication({ status: "checking" });

    try {
      const user = await getCurrentSession();

      setAuthentication(
        user ? { status: "authenticated", user } : { status: "anonymous" },
      );
    } catch {
      setAuthentication({
        status: "error",
        message: SESSION_CHECK_ERROR,
      });
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setLogoutMessage(null);

    if (authentication.status === "preview") {
      setView("dashboard");
      setAuthentication({ status: "anonymous" });
      setIsLoggingOut(false);
      return;
    }

    try {
      await logoutCurrentSession();
    } catch {
      // Local sign-out should still complete if the cookie clearing request fails.
      setLogoutMessage(LOGOUT_ERROR);
    } finally {
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

  if (authentication.status === "error") {
    return (
      <main className={styles.statusPage}>
        <Navbar />
        <section className={styles.statusCard} role="alert">
          <p className={styles.eyebrow}>Authentication unavailable</p>
          <h1>We could not verify your session.</h1>
          <p>{authentication.message}</p>
          <div className={styles.statusActions}>
            <button
              className={styles.retryButton}
              type="button"
              onClick={() => void handleRetrySession()}
            >
              Retry session check
            </button>
            <button
              className={styles.signInButton}
              type="button"
              onClick={() => setAuthentication({ status: "anonymous" })}
            >
              Return to sign in
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (authentication.status === "anonymous") {
    return (
      <LoginPage
        onLogin={handleLogin}
        onPreviewLogin={
          DEVELOPMENT_PREVIEW_ENABLED ? handlePreviewLogin : undefined
        }
      />
    );
  }

  const { user } = authentication;
  const isDevelopmentPreview = authentication.status === "preview";
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
      <div
        className={
          isDevelopmentPreview ? styles.previewBadge : styles.demoBadge
        }
      >
        {isDevelopmentPreview
          ? `MOCK UI PREVIEW · ${user.roleCode} · No server session`
          : "Development sample data"}
      </div>
    </AuthenticatedUserProvider>
  );
}
