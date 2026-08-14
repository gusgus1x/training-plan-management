import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loginPageSource = readFileSync(
  new URL("../../app/components/LoginPage.tsx", import.meta.url),
  "utf8",
);
const authGateSource = readFileSync(
  new URL("../../app/components/AuthGate.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../../app/page.tsx", import.meta.url),
  "utf8",
);
const layoutSource = readFileSync(
  new URL("../../app/layout.tsx", import.meta.url),
  "utf8",
);
const serverSessionSource = readFileSync(
  new URL("../../app/lib/auth/server-session.ts", import.meta.url),
  "utf8",
);

describe("login UI contract", () => {
  it("contains no browser credential storage or leaked server secrets", () => {
    const authenticationUiSource = `${loginPageSource}\n${authGateSource}`;

    expect(authenticationUiSource).not.toContain("defaultValue=");
    expect(authenticationUiSource).not.toContain("localStorage");
    expect(authenticationUiSource).not.toContain("sessionStorage");
    expect(authenticationUiSource).not.toContain("passwordHash");
    expect(authenticationUiSource).not.toContain("AUTH_SESSION_SECRET");
    expect(authenticationUiSource).not.toContain("SESSION_COOKIE_NAME");
  });

  it("keeps real login on the API and limits mock preview to development", () => {
    expect(loginPageSource).toContain("Mock UI Preview");
    expect(authGateSource).toContain('process.env.NODE_ENV === "development"');
    expect(authGateSource).toContain("previewUser");
    expect(authGateSource).toContain("DEVELOPMENT_PREVIEW_USERS");
    expect(authGateSource).toContain("No server session");
    expect(authGateSource).toContain("loginWithCredentials(username, password)");
  });

  it("disables form controls while submitting and clears password state", () => {
    expect(loginPageSource).toContain("disabled={isSubmitting}");
    expect(loginPageSource).toContain('setPassword("")');
    expect(loginPageSource).toContain("GENERIC_LOGIN_ERROR");
  });

  it("derives identity server-side and signs out through the API", () => {
    expect(layoutSource).toContain("getServerSessionUser()");
    expect(serverSessionSource).toContain("verifySessionToken");
    expect(serverSessionSource).not.toContain("use client");
    expect(authGateSource).not.toContain("getCurrentSession()");
    expect(authGateSource).toContain("logoutCurrentSession()");
  });

  it("maps employees separately and shares the center/factory application", () => {
    expect(pageSource).toContain('user.roleCode === "EMPLOYEE"');
    expect(pageSource).toContain("<UserDashboard");
    expect(pageSource).toContain("<CenterFactoryDashboard");
    expect(pageSource).not.toContain('user.roleCode === "HRD_FACTORY"');
    expect(pageSource).not.toContain("<FactoryDashboard");
  });

  it("preserves mockup page navigation without treating preview as a session", () => {
    expect(pageSource).not.toContain("setIsLoggedIn");
    expect(pageSource).not.toContain("UserRole");
    expect(pageSource).not.toContain('status: "authenticated", user: DEVELOPMENT_PREVIEW');
  });
});
