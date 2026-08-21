"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  loginWithCredentials,
  logoutCurrentSession,
  type ClientRoleCode,
  type ClientSessionUser,
} from "../lib/auth/client";
import { initializeTrainingWorkflow } from "../lib/trainingWorkflow";
import LoginPage, { type PreviewCompanyCode } from "./LoginPage";
import { AuthenticatedUserProvider } from "./AuthenticatedUserContext";
import { AuthActionsProvider } from "./AuthActionsContext";
import styles from "./AuthGate.module.css";

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
    username: "HRD Center",
    roleCode: "HRD_CENTER",
    employeeId: null,
    companyId: null,
    email: "hrd.center@example.invalid",
    employeeCode: null,
    displayName: "HRD Center",
    companyCode: null,
    companyName: null,
    functionCode: null,
    functionName: null,
    positionCode: null,
    positionName: null,
    levelCode: null,
    levelName: null,
    pl: null,
  },
  HRD_FACTORY: {
    userId: "preview-hrd-factory",
    username: "HRD SATI",
    roleCode: "HRD_FACTORY",
    employeeId: null,
    companyId: "preview-company-sati",
    email: "hrd.sati@example.invalid",
    employeeCode: null,
    displayName: "HRD SATI",
    companyCode: "SATI",
    companyName: "SATI Mock Company",
    functionCode: null,
    functionName: null,
    positionCode: null,
    positionName: null,
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
    functionCode: "QUAL",
    functionName: "Quality Control",
    positionCode: "OFFICER",
    positionName: "Quality Officer",
    levelCode: "O2",
    levelName: "Officer 2",
    pl: "PL2",
  },
};

export default function AuthGate({
  user,
  children,
}: {
  user: ClientSessionUser | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [previewUser, setPreviewUser] = useState<ClientSessionUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  useEffect(() => {
    initializeTrainingWorkflow();
  }, []);

  const handleLogin = async (username: string, password: string) => {
    await loginWithCredentials(username, password);
    setLogoutMessage(null);
    router.refresh();
  };

  const handlePreviewLogin = (
    roleCode: ClientRoleCode,
    companyCode?: PreviewCompanyCode,
  ) => {
    if (!DEVELOPMENT_PREVIEW_ENABLED || roleCode === "EMPLOYEE") {
      return;
    }

    const nextPreviewUser =
      roleCode === "HRD_FACTORY" && companyCode
        ? {
            ...DEVELOPMENT_PREVIEW_USERS.HRD_FACTORY,
            userId: `preview-hrd-factory-${companyCode.toLowerCase()}`,
            username: `HRD ${companyCode}`,
            companyId: `preview-company-${companyCode.toLowerCase()}`,
            email: `hrd.${companyCode.toLowerCase()}@example.invalid`,
            displayName: `HRD ${companyCode}`,
            companyCode,
            companyName: DEVELOPMENT_PREVIEW_COMPANY_NAMES[companyCode],
            employeeCode: null,
            positionCode: null,
            positionName: null,
            functionCode: null,
            functionName: null,
          }
        : DEVELOPMENT_PREVIEW_USERS[roleCode];

    setLogoutMessage(null);
    setPreviewUser(nextPreviewUser);
    router.push("/");
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setLogoutMessage(null);

    if (previewUser) {
      setPreviewUser(null);
      setIsLoggingOut(false);
      router.push("/");
      return;
    }

    try {
      await logoutCurrentSession();
    } catch {
      // Local sign-out should still complete if the cookie clearing request fails.
      setLogoutMessage(LOGOUT_ERROR);
    } finally {
      setIsLoggingOut(false);
      router.push("/");
      router.refresh();
    }
  };

  const effectiveUser = user ?? previewUser;
  const isDevelopmentPreview = !user && previewUser !== null;

  useEffect(() => {
    if (!effectiveUser && pathname !== "/login") {
      router.replace("/login");
    } else if (effectiveUser && pathname === "/login") {
      router.replace("/");
    }
  }, [effectiveUser, pathname, router]);

  if (!effectiveUser) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onPreviewLogin={
          DEVELOPMENT_PREVIEW_ENABLED ? handlePreviewLogin : undefined
        }
      />
    );
  }

  return (
    <AuthenticatedUserProvider user={effectiveUser}>
      <AuthActionsProvider actions={{ logout: () => void handleLogout() }}>
        {logoutMessage ? (
          <p className={styles.logoutError} role="alert">
            {logoutMessage}
          </p>
        ) : null}
        {children}
        <div
          className={
            isDevelopmentPreview ? styles.previewBadge : styles.demoBadge
          }
        >
          {isDevelopmentPreview
            ? `MOCK UI PREVIEW · ${effectiveUser.roleCode} · No server session`
            : "Development sample data"}
        </div>
      </AuthActionsProvider>
    </AuthenticatedUserProvider>
  );
}
