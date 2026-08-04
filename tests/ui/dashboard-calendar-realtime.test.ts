import { describe, expect, it } from "vitest";
import {
  buildCalendarYearOptions,
  getCurrentCalendarDate,
} from "../../app/lib/calendarDate";

describe("dashboard calendar real-time defaults", () => {
  it("derives the displayed date from the current local date", () => {
    expect(getCurrentCalendarDate(new Date(2026, 7, 3, 14, 30))).toEqual({
      year: "2026",
      month: "08",
      day: 3,
    });
  });

  it("keeps the current, next, and scheduled years available", () => {
    expect(
      buildCalendarYearOptions("2026", ["2025-12-01", "2027-01-15"]),
    ).toEqual(["2025", "2026", "2027"]);
  });
});
