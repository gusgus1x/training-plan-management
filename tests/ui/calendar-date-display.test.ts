import { describe, expect, it } from "vitest";
import {
  calculateDaysBetween,
  formatDateDayMonthYear,
  formatDateRangeDayMonthYear,
  formatTrainingDuration,
} from "../../app/lib/calendarDate";

describe("calendarDate formatting utilities", () => {
  describe("formatDateDayMonthYear", () => {
    it("formats YYYY-MM-DD into Day Month Year in Thai", () => {
      expect(formatDateDayMonthYear("2026-10-01", true)).toBe("1 ต.ค. 2026");
      expect(formatDateDayMonthYear("2026-01-15", true)).toBe("15 ม.ค. 2026");
      expect(formatDateDayMonthYear("2026-12-31", true)).toBe("31 ธ.ค. 2026");
    });

    it("formats YYYY-MM-DD into Day Month Year in English", () => {
      expect(formatDateDayMonthYear("2026-10-01", false)).toBe("1 Oct 2026");
      expect(formatDateDayMonthYear("2026-05-09", false)).toBe("9 May 2026");
    });

    it("handles ISO strings", () => {
      expect(formatDateDayMonthYear("2026-10-01T09:00:00.000Z", true)).toBe("1 ต.ค. 2026");
    });

    it("handles null or empty", () => {
      expect(formatDateDayMonthYear("-", true)).toBe("-");
      expect(formatDateDayMonthYear(null, true)).toBe("-");
    });
  });

  describe("formatDateRangeDayMonthYear", () => {
    it("formats single day when start and end are identical", () => {
      expect(formatDateRangeDayMonthYear("2026-10-01", "2026-10-01", true)).toBe("1 ต.ค. 2026");
      expect(formatDateRangeDayMonthYear("2026-10-01", undefined, true)).toBe("1 ต.ค. 2026");
    });

    it("formats multi-day range with Day Month Year", () => {
      expect(formatDateRangeDayMonthYear("2026-10-01", "2026-10-02", true)).toBe("1 ต.ค. 2026 - 2 ต.ค. 2026");
      expect(formatDateRangeDayMonthYear("2026-09-30", "2026-10-02", true)).toBe("30 ก.ย. 2026 - 2 ต.ค. 2026");
      expect(formatDateRangeDayMonthYear("2026-10-01", "2026-10-02", false)).toBe("1 Oct 2026 - 2 Oct 2026");
    });
  });

  describe("calculateDaysBetween", () => {
    it("returns 1 for single day", () => {
      expect(calculateDaysBetween("2026-10-01", "2026-10-01")).toBe(1);
      expect(calculateDaysBetween("2026-10-01", undefined)).toBe(1);
    });

    it("calculates inclusive days correctly for multi-day", () => {
      expect(calculateDaysBetween("2026-10-01", "2026-10-02")).toBe(2);
      expect(calculateDaysBetween("2026-10-01", "2026-10-03")).toBe(3);
      expect(calculateDaysBetween("2026-09-29", "2026-10-01")).toBe(3);
    });
  });

  describe("formatTrainingDuration", () => {
    it("shows daily hours and total hours when 2 days", () => {
      expect(formatTrainingDuration(18, "2026-10-01", "2026-10-02", true)).toBe("วันละ 9 ชม. / รวม 18 ชม.");
      expect(formatTrainingDuration(18, "2026-10-01", "2026-10-02", false)).toBe("9 hrs/day · 18 hrs total");
    });

    it("shows standard duration for 1 day", () => {
      expect(formatTrainingDuration(6, "2026-10-01", "2026-10-01", true)).toBe("6 ชม.");
      expect(formatTrainingDuration("6", "2026-10-01", "2026-10-01", false)).toBe("6 hrs");
    });

    it("handles string hours and 3 days", () => {
      expect(formatTrainingDuration("18", "2026-10-01", "2026-10-03", true)).toBe("วันละ 6 ชม. / รวม 18 ชม.");
    });
  });
});
