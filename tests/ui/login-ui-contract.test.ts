import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loginPageSource = readFileSync(
  new URL("../../app/components/LoginPage.tsx", import.meta.url),
  "utf8",
);
const appSource = readFileSync(
  new URL("../../app/components/TrainingPlanManagement.tsx", import.meta.url),
  "utf8",
);

describe("login UI contract", () => {
  it("contains no browser credential storage or leaked server secrets", () => {
    const authenticationUiSource = `${loginPageSource}\n${appSource}`;

    expect(authenticationUiSource).not.toContain("defaultValue=");
    expect(authenticationUiSource).not.toContain("localStorage");
    expect(authenticationUiSource).not.toContain("sessionStorage");
    expect(authenticationUiSource).not.toContain("passwordHash");
    expect(authenticationUiSource).not.toContain("AUTH_SESSION_SECRET");
    expect(authenticationUiSource).not.toContain("SESSION_COOKIE_NAME");
  });

  it("keeps real login on the API and limits mock preview to development", () => {
    expect(loginPageSource).toContain("Mock UI Preview");
    expect(appSource).toContain(
      'process.env.NODE_ENV === "development"',
    );
    expect(appSource).toContain('status: "preview"');
    expect(appSource).toContain("DEVELOPMENT_PREVIEW_USERS");
    expect(appSource).toContain("No server session");
    expect(appSource).toContain("loginWithCredentials(username, password)");
  });

  it("disables form controls while submitting and clears password state", () => {
    expect(loginPageSource).toContain("disabled={isSubmitting}");
    expect(loginPageSource).toContain('setPassword("")');
    expect(loginPageSource).toContain("GENERIC_LOGIN_ERROR");
  });

  it("checks the current session and uses server-derived identity", () => {
    expect(appSource).toContain("getCurrentSession()");
    expect(appSource).toContain('status: "error"');
    expect(appSource).toContain("Retry session check");
    expect(appSource).toContain("username={user.username}");
    expect(appSource).toContain("logoutCurrentSession()");
  });

  it("maps employees separately and shares the center/factory application", () => {
    expect(appSource).toContain('user.roleCode === "EMPLOYEE"');
    expect(appSource).toContain("<UserDashboard");
    expect(appSource).toContain("<CenterFactoryDashboard");
    expect(appSource).not.toContain('user.roleCode === "HRD_FACTORY"');
    expect(appSource).not.toContain("<FactoryDashboard");
  });

  it("preserves mockup page navigation without treating preview as a session", () => {
    expect(appSource).toContain('setView("training-plan")');
    expect(appSource).toContain('setView("training-record")');
    expect(appSource).toContain('setView("training-course")');
    expect(appSource).toContain('setView("master-data")');
    expect(appSource).toContain('setView("report")');
    expect(appSource).not.toContain("setIsLoggedIn");
    expect(appSource).not.toContain("UserRole");
    expect(appSource).not.toContain('status: "authenticated", user: DEVELOPMENT_PREVIEW');
  });
});
