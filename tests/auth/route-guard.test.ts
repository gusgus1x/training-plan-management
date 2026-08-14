import { describe, expect, it } from "vitest";
import { shouldRedirectToLogin } from "../../app/lib/auth/route-guard";

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
