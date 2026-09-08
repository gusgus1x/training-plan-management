import { describe, expect, it } from "vitest";
import {
  formatCorrectColumns,
  gridTotalScore,
  isGridRowCorrect,
  isGridType,
  parseCorrectColumns,
} from "../../app/lib/formGrids";

/**
 * Google Forms scores a grid PER ROW: each row has its own points and its own correct column(s),
 * and a row earns its points only on an exact match. These are the rules the whole feature rests
 * on, so they are tested away from React and Prisma.
 */

describe("parseCorrectColumns / formatCorrectColumns", () => {
  it("round-trips a single correct column", () => {
    expect(parseCorrectColumns(formatCorrectColumns([2]))).toEqual([2]);
  });

  it("sorts, de-duplicates and drops junk", () => {
    expect(formatCorrectColumns([3, 1, 3])).toBe("1,3");
    expect(parseCorrectColumns("3, 1 ,3")).toEqual([3, 1, 3]);
    expect(parseCorrectColumns("a,0,-2")).toEqual([]);
  });

  it("treats an empty key as no key at all", () => {
    expect(formatCorrectColumns([])).toBeNull();
    expect(parseCorrectColumns(null)).toEqual([]);
    expect(parseCorrectColumns("")).toEqual([]);
  });
});

describe("isGridRowCorrect", () => {
  it("awards a multiple choice grid row only for the right column", () => {
    expect(isGridRowCorrect([2], [2])).toBe(true);
    expect(isGridRowCorrect([2], [1])).toBe(false);
  });

  it("requires an exact match on a checkbox grid row", () => {
    // Google is all-or-nothing on checkbox answers, so two of three correct scores nothing.
    expect(isGridRowCorrect([1, 3], [1, 3])).toBe(true);
    expect(isGridRowCorrect([1, 3], [3, 1])).toBe(true);
    expect(isGridRowCorrect([1, 3], [1])).toBe(false);
    expect(isGridRowCorrect([1, 3], [1, 2, 3])).toBe(false);
  });

  it("never awards a row that has no answer key", () => {
    // Otherwise an unmarked grid would hand out free marks the way an empty choice set once did.
    expect(isGridRowCorrect([], [])).toBe(false);
    expect(isGridRowCorrect([], [1])).toBe(false);
  });

  it("scores nothing for an unanswered row", () => {
    expect(isGridRowCorrect([2], [])).toBe(false);
  });
});

describe("gridTotalScore", () => {
  it("sums the row points, which is what question_score must equal", () => {
    // Keeping question_score in sync is what lets every existing denominator loop stay unaware
    // that grids exist.
    expect(gridTotalScore(["1", "1", "2"])).toBe("4.00");
    expect(gridTotalScore([])).toBe("0.00");
    expect(gridTotalScore(["0.5", "0.5"])).toBe("1.00");
  });
});

describe("isGridType", () => {
  it("recognises both grid types and nothing else", () => {
    expect(isGridType("MULTIPLE_CHOICE_GRID")).toBe(true);
    expect(isGridType("CHECKBOX_GRID")).toBe(true);
    expect(isGridType("MULTIPLE_CHOICE")).toBe(false);
    expect(isGridType("SECTION_BREAK")).toBe(false);
  });
});
