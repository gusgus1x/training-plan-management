import { describe, expect, it } from "vitest";
import { isPastHalfway } from "../../app/components/ScrollToTop";

describe("isPastHalfway", () => {
  // Page is 3000px tall in a 1000px viewport -> 2000px of scrollable distance.
  it("stays hidden before the halfway mark", () => {
    expect(isPastHalfway(999, 3000, 1000)).toBe(false);
    expect(isPastHalfway(1000, 3000, 1000)).toBe(false);
  });

  it("shows past the halfway mark", () => {
    expect(isPastHalfway(1001, 3000, 1000)).toBe(true);
    expect(isPastHalfway(2000, 3000, 1000)).toBe(true);
  });

  it("stays hidden on a page that does not scroll", () => {
    expect(isPastHalfway(0, 800, 1000)).toBe(false);
    expect(isPastHalfway(0, 1000, 1000)).toBe(false);
  });
});
