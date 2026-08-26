import { describe, expect, it } from "vitest";
import {
  parseCreateEnrollment,
  parseEnrollmentListFilters,
} from "../../app/lib/trainingEnrollment/validation";

// Phase 20 runs both employee keys in parallel. The caller says which one it is sending; the API
// never infers it from the value. Every user_id in this database is an 8-digit number, so a
// sniffing rule would quietly depend on employee_id never reaching 8 digits — on an identifier
// that decides who may act on whose training record.
describe("enrollment input accepts both employee keys, explicitly", () => {
  it("keeps working for a caller that only knows the surrogate id", () => {
    const input = parseCreateEnrollment({
      planId: "5",
      employeeId: "101",
      source: "EMPLOYEE",
    });

    expect(input.employeeId).toBe("101");
    expect(input.employeeUserId).toBeNull();
  });

  it("carries the durable key when the caller sends it", () => {
    const input = parseCreateEnrollment({
      planId: "5",
      employeeId: "101",
      employeeUserId: "12900012",
      source: "EMPLOYEE",
    });

    expect(input.employeeUserId).toBe("12900012");
  });

  it("treats a blank durable key as absent rather than as a value", () => {
    const input = parseCreateEnrollment({
      planId: "5",
      employeeId: "101",
      employeeUserId: "   ",
      source: "EMPLOYEE",
    });

    expect(input.employeeUserId).toBeNull();
  });

  it("reads either key from the list filter", () => {
    expect(
      parseEnrollmentListFilters(new URLSearchParams("employeeId=101")),
    ).toMatchObject({ employeeId: "101", employeeUserId: null });

    expect(
      parseEnrollmentListFilters(new URLSearchParams("employeeUserId=12900012")),
    ).toMatchObject({ employeeId: null, employeeUserId: "12900012" });
  });
});
