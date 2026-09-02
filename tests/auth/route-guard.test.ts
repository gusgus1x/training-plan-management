import { describe, expect, it } from "vitest";
import { isEmployeeAllowedPath, shouldRedirectToLogin } from "../../app/lib/auth/route-guard";

describe("shouldRedirectToLogin", () => {
  it("never redirects outside production", () => {
    expect(shouldRedirectToLogin("/master-data", false, "development")).toBe(false);
    expect(shouldRedirectToLogin("/master-data", false, "test")).toBe(false);
  });

  it("never redirects the login path itself", () => {
    expect(shouldRedirectToLogin("/login", false, "production")).toBe(false);
  });

  it("never redirects a valid session", () => {
    expect(shouldRedirectToLogin("/master-data", true, "production")).toBe(false);
  });

  it("redirects an unauthenticated request to a non-login path in production", () => {
    expect(shouldRedirectToLogin("/master-data", false, "production")).toBe(true);
    expect(shouldRedirectToLogin("/", false, "production")).toBe(true);
  });
});

describe("isEmployeeAllowedPath", () => {
  it("allows the employee's own dashboard", () => {
    expect(isEmployeeAllowedPath("/")).toBe(true);
  });

  it("allows a training-form page and its sub-paths", () => {
    expect(isEmployeeAllowedPath("/training-form/1/PRE_TEST")).toBe(true);
    expect(isEmployeeAllowedPath("/training-form")).toBe(true);
  });

  it("refuses Center/Factory sub-routes", () => {
    expect(isEmployeeAllowedPath("/master-data")).toBe(false);
  });

  it("refuses a path that only looks like a prefix match", () => {
    // A naive startsWith("/training-form") would wrongly allow this.
    expect(isEmployeeAllowedPath("/training-formx")).toBe(false);
  });
});
