import { describe, expect, it } from "vitest";
import { getSanitizedDestination } from "../../app/lib/auth/route-guard";

/**
 * Where someone lands after logging in. The employee branch used to return "/" unconditionally,
 * which threw away the URL they were trying to reach - so any deep link into a form was unusable
 * for anyone not already signed in, which is exactly the person scanning a QR code.
 */

describe("getSanitizedDestination", () => {
  describe("EMPLOYEE", () => {
    it("keeps a form URL so a scanned QR survives the login round-trip", () => {
      expect(getSanitizedDestination("/training-form/plan/12/PRE_TEST", "EMPLOYEE")).toBe(
        "/training-form/plan/12/PRE_TEST",
      );
      expect(getSanitizedDestination("/training-form/900/POST_TEST", "EMPLOYEE")).toBe("/training-form/900/POST_TEST");
    });

    it("keeps a query string on the way through", () => {
      expect(getSanitizedDestination("/training-form/plan/12/PRE_TEST?from=qr", "EMPLOYEE")).toBe(
        "/training-form/plan/12/PRE_TEST?from=qr",
      );
    });

    it("still refuses every page an employee may not visit", () => {
      for (const path of ["/admin", "/training-plan", "/master-data", "/report", "/training-course"]) {
        expect(getSanitizedDestination(path, "EMPLOYEE")).toBe("/");
      }
    });

    it("refuses a look-alike prefix", () => {
      // Guards the same trap isEmployeeAllowedPath was written for.
      expect(getSanitizedDestination("/training-formx/evil", "EMPLOYEE")).toBe("/");
    });

    it("refuses anything that is not an internal path", () => {
      expect(getSanitizedDestination("https://evil.example.com", "EMPLOYEE")).toBe("/");
      expect(getSanitizedDestination("//evil.example.com", "EMPLOYEE")).toBe("/");
      expect(getSanitizedDestination("/login", "EMPLOYEE")).toBe("/");
      expect(getSanitizedDestination(null, "EMPLOYEE")).toBe("/");
      expect(getSanitizedDestination("", "EMPLOYEE")).toBe("/");
    });
  });

  describe("other roles are unchanged", () => {
    it("pins ADMIN to the admin dashboard but allows deep links inside it", () => {
      expect(getSanitizedDestination("/training-plan", "ADMIN")).toBe("/admin");
      expect(getSanitizedDestination(null, "ADMIN")).toBe("/admin");
      expect(getSanitizedDestination("/admin/audit", "ADMIN")).toBe("/admin/audit");
    });

    it("lets HRD back to the page they were trying to reach", () => {
      expect(getSanitizedDestination("/training-plan", "HRD_CENTER")).toBe("/training-plan");
      expect(getSanitizedDestination("/report/summary", "HRD_FACTORY")).toBe("/report/summary");
      expect(getSanitizedDestination("https://evil.example.com", "HRD_CENTER")).toBe("/");
    });
  });
});
