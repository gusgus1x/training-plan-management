"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  loginWithCredentials,
  logoutCurrentSession,
  type ClientRoleCode,
  type ClientSessionUser,
} from "../lib/auth/client";
import { isEmployeeAllowedPath } from "../lib/auth/route-guard";
import { initializeTrainingWorkflow } from "../lib/trainingWorkflow";
import LoginPage, { type PreviewCompanyCode } from "./LoginPage";
import { AuthenticatedUserProvider } from "./AuthenticatedUserContext";
import { AuthActionsProvider } from "./AuthActionsContext";
import { useToast } from "./ToastHost";
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
  // System administrator: no employee record and no company, matching the real ADMIN principal.
  ADMIN: {
    userId: "preview-admin",
    username: "System Admin",
    roleCode: "ADMIN",
    employeeId: null,
    companyId: null,
    email: "admin@example.invalid",
    employeeCode: null,
    displayName: "System Admin",
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
  const toast = useToast();
  const [previewUser, setPreviewUser] = useState<ClientSessionUser | null>(null);
  // The user the login response already handed back. Without it there is a window between
  // router.push and the refreshed server layout where the session is real but this component still
  // sees null — and the effect below reads that as "signed out" and bounces back to /login.
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [targetReturnUrl, setTargetReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    initializeTrainingWorkflow();
  }, []);

  const getSanitizedDestination = (targetUrl: string | null, roleCode?: ClientRoleCode): string => {
    // Employees always land directly on their personal UserDashboard at "/"
    if (roleCode === "EMPLOYEE") return "/";
    if (!targetUrl || typeof targetUrl !== "string") return "/";
    if (targetUrl === "/login" || !targetUrl.startsWith("/")) return "/";
    const path = targetUrl.split("?")[0];
    const validBasePaths = [
      "/",
      "/master-data",
      "/training-course",
      "/training-plan",
      "/training-record",
      "/report",
    ];
    const isValid = validBasePaths.some((base) => path === base || path.startsWith(`${base}/`));
    return isValid ? targetUrl : "/";
  };

  const handleLogin = async (username: string, password: string) => {
    const loggedUser = await loginWithCredentials(username, password);
    setSessionUser(loggedUser);
    setLogoutMessage(null);
    const displayName = loggedUser.displayName || loggedUser.username;
    toast.success(`🎉 ยินดีต้อนรับคุณ ${displayName} เข้าสู่ระบบ / Welcome ${displayName}!`);
    const dest = getSanitizedDestination(targetReturnUrl, loggedUser.roleCode);
    setTargetReturnUrl(null);
    router.push(dest);
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
            levelCode: null,
            levelName: null,
          }
        : DEVELOPMENT_PREVIEW_USERS[roleCode];

    setLogoutMessage(null);
    setPreviewUser(nextPreviewUser);
    const displayName = nextPreviewUser.displayName || nextPreviewUser.username;
    toast.success(`🎉 ยินดีต้อนรับคุณ ${displayName} เข้าสู่ระบบ / Welcome ${displayName}!`);
    const dest = getSanitizedDestination(targetReturnUrl, nextPreviewUser.roleCode);
    setTargetReturnUrl(null);
    router.push(dest);
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setLogoutMessage(null);
    // Clear session user and target return url so the next login does not inherit the previous page
    setSessionUser(null);
    setTargetReturnUrl(null);

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

  // The server session wins once it arrives; sessionUser only covers the gap right after login.
  const effectiveUser = user ?? sessionUser ?? previewUser;
  const isDevelopmentPreview = !user && previewUser !== null;

  useEffect(() => {
    if (!effectiveUser && pathname !== "/login") {
      if (typeof window !== "undefined") {
        const fullUrl = `${pathname}${window.location.search}`;
        setTargetReturnUrl(fullUrl);
      }
      router.replace("/login");
    } else if (effectiveUser && pathname === "/login") {
      const dest = getSanitizedDestination(targetReturnUrl, effectiveUser.roleCode);
      setTargetReturnUrl(null);
      router.replace(dest);
    } else if (effectiveUser && effectiveUser.roleCode === "EMPLOYEE" && !isEmployeeAllowedPath(pathname)) {
      // Employees do not access Center/Factory sub-routes; redirect to their personal dashboard
      router.replace("/");
    }
  }, [effectiveUser, pathname, router, targetReturnUrl]);

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
        {isDevelopmentPreview ? (
          <div className={styles.previewBadge}>
            {`MOCK UI PREVIEW · ${effectiveUser.roleCode} · No server session`}
          </div>
        ) : null}
      </AuthActionsProvider>
    </AuthenticatedUserProvider>
  );
}
