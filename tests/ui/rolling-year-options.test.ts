import { describe, expect, it } from "vitest";
import { currentYear, rollingYearOptions } from "../../app/components/center_factory/TrainingPlanManagement/modules/TrainingRolling";

/**
 * The year filter was the literal list ["2026", "2025", "2024"], with "2026" hardcoded as both the
 * initial value and the reset value. Nothing fails when the calendar rolls over - the filter simply
 * defaults to a past year and offers no option to reach the current one, so every plan scheduled in
 * it disappears from the screen with no error. Same shape as the UTC+7 date bug: right today, quietly
 * wrong later.
 */
describe("rollingYearOptions", () => {
  it("always offers the current year, even with no plans at all", () => {
    expect(rollingYearOptions([])).toEqual([currentYear()]);
  });

  it("offers every year the plans actually fall in", () => {
    const options = rollingYearOptions([
      { trainingDate: "2024-03-01" },
      { trainingDate: "2031-11-20" },
    ]);
    expect(options).toContain("2024");
    expect(options).toContain("2031");
    expect(options).toContain(currentYear());
  });

  it("lists newest first", () => {
    const options = rollingYearOptions([
      { trainingDate: "2024-01-01" },
      { trainingDate: "2031-01-01" },
      { trainingDate: "2028-01-01" },
    ]);
    expect(options).toEqual([...options].sort((a, b) => b.localeCompare(a)));
  });

  it("lists a year once however many plans sit in it", () => {
    const options = rollingYearOptions([
      { trainingDate: "2031-01-01" },
      { trainingDate: "2031-06-01" },
      { trainingDate: "2031-12-31" },
    ]);
    expect(options.filter((year) => year === "2031")).toHaveLength(1);
  });

  it("ignores a missing or malformed date rather than offering a junk year", () => {
    const options = rollingYearOptions([
      { trainingDate: undefined },
      { trainingDate: "" },
      { trainingDate: "-" },
      { trainingDate: "not-a-date" },
    ]);
    expect(options).toEqual([currentYear()]);
  });
});
