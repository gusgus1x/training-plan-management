import { describe, expect, it } from "vitest";
import {
  legacySectionBreakPoints,
  legacySectionTitleAt,
} from "../../app/lib/evaluations/legacySections";

/**
 * Old evaluation forms grouped questions with a section_name label. The editor converts those runs
 * into real SECTION_BREAK rows when the form is opened, because the repository deletes and
 * recreates every question row on save - without the conversion the grouping is silently lost the
 * first time anyone edits an old form. Three forms on the live database still carry these labels.
 */
const rows = (...names: Array<string | null>) => names.map((sectionName) => ({ sectionName }));

describe("legacySectionBreakPoints", () => {
  it("inserts nothing when every question shares one section", () => {
    expect(legacySectionBreakPoints(rows("Course Content", "Course Content", "Course Content"))).toEqual([]);
  });

  it("breaks where the section changes, and never before the first row", () => {
    // Three groups produce two breaks: everything up to the first break is already section 1.
    const points = legacySectionBreakPoints(rows("Course Content", "Course Content", "Instructor", "Comments"));
    expect(points).toEqual([2, 3]);
    expect(points).not.toContain(0);
  });

  it("inserts nothing when no question carries a section name", () => {
    expect(legacySectionBreakPoints(rows(null, null, null))).toEqual([]);
  });

  it("treats a blank name as no name rather than a new section", () => {
    expect(legacySectionBreakPoints(rows("Instructor", "   ", "Instructor"))).toEqual([]);
  });

  it("does not break again when a section name repeats consecutively after a change", () => {
    expect(legacySectionBreakPoints(rows("A", "B", "B", "B"))).toEqual([1]);
  });

  it("names each break after the section it opens", () => {
    const source = rows("Course Content", "Instructor");
    expect(legacySectionTitleAt(source, 1)).toBe("Instructor");
    expect(legacySectionTitleAt(source, 9)).toBe("Untitled section");
  });
});
