import { describe, expect, it } from "vitest";
import { scoreLabel } from "../../app/lib/trainingEnrollment/types";
import { scorePercentOf } from "../../app/lib/trainingRecord/types";

describe("marks on screen", () => {
  it("leads with the mark and trails the percentage", () => {
    // The mark is what is stored and what the paper says. The percentage is the reading of it,
    // which is the whole reason nothing stores one any more.
    expect(scoreLabel(8, 10)).toBe("8 / 10 (80%)");
    expect(scoreLabel(3, 4)).toBe("3 / 4 (75%)");
  });

  it("shows the bare mark when nobody recorded what it is out of", () => {
    // An external test with no full marks entered. Inventing a denominator would restate somebody's
    // result on a record they hand to an employer.
    expect(scoreLabel(80, null)).toBe("80");
    expect(scorePercentOf(80, null)).toBeNull();
  });

  it("keeps an ungraded score ungraded", () => {
    // "Not graded" and "scored zero" are different claims.
    expect(scoreLabel(null, 10)).toBeNull();
    expect(scoreLabel(0, 10)).toBe("0 / 10 (0%)");
  });

  it("does not round a fraction into a whole percentage", () => {
    expect(scorePercentOf(7, 9)).toBe(77.78);
    expect(scoreLabel(7, 9)).toBe("7 / 9 (77.8%)");
  });
});
