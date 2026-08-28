import { describe, expect, it } from "vitest";
import { expiryFrom } from "../../app/lib/trainingRecord/types";

describe("when a training result expires", () => {
  it("adds the course's validity period to the training date", () => {
    expect(expiryFrom("2026-05-12", 12)).toBe("2027-05-12");
    expect(expiryFrom("2026-05-12", 1)).toBe("2026-06-12");
  });

  it("has no expiry when the course declares no validity period", () => {
    // Most courses are like this. An expiry box for them would be asking for a date that has no
    // meaning, on a record used as evidence.
    expect(expiryFrom("2026-05-12", null)).toBeNull();
    expect(expiryFrom("2026-05-12", 0)).toBeNull();
  });

  it("clamps rather than rolling into the next month", () => {
    // 31 August plus 6 months is 31 February; Date would roll that forward to 3 March and quietly
    // hand the certificate three extra days.
    expect(expiryFrom("2026-08-31", 6)).toBe("2027-02-28");
    expect(expiryFrom("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("keeps 29 February when the target year has one", () => {
    expect(expiryFrom("2027-02-28", 12)).toBe("2028-02-28");
    expect(expiryFrom("2028-02-29", 12)).toBe("2029-02-28");
  });

  it("crosses the year boundary", () => {
    expect(expiryFrom("2026-11-15", 3)).toBe("2027-02-15");
    expect(expiryFrom("2026-05-12", 24)).toBe("2028-05-12");
  });

  it("returns null for a date it cannot read instead of an invalid one", () => {
    expect(expiryFrom("not a date", 12)).toBeNull();
  });

  it("accepts a full timestamp and uses its date part", () => {
    expect(expiryFrom("2026-05-12T09:00:00.000Z", 12)).toBe("2027-05-12");
  });
});
