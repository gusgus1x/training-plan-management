import { describe, expect, it } from "vitest";
import { parseReviewerSearch, parseSaveReviewers } from "../../app/lib/trainingRecord/validation";

describe("parseSaveReviewers", () => {
  it("keeps a null reviewer, which is the instruction to unassign", () => {
    const parsed = parseSaveReviewers({ assignments: [{ enrollmentId: "7", reviewerUserId: null }] });
    expect(parsed.assignments).toEqual([{ enrollmentId: "7", reviewerUserId: null }]);
  });

  it("trims the reviewer id", () => {
    const parsed = parseSaveReviewers({ assignments: [{ enrollmentId: "7", reviewerUserId: " 12345678 " }] });
    expect(parsed.assignments[0].reviewerUserId).toBe("12345678");
  });

  it("refuses the same attendee twice, which would silently keep only one of the two", () => {
    expect(() =>
      parseSaveReviewers({
        assignments: [
          { enrollmentId: "7", reviewerUserId: "a" },
          { enrollmentId: "7", reviewerUserId: "b" },
        ],
      }),
    ).toThrow();
  });

  it("refuses a missing reviewer id, which is not the same as an explicit null", () => {
    expect(() => parseSaveReviewers({ assignments: [{ enrollmentId: "7" }] })).toThrow();
  });

  it("refuses an enrollment id that is not a positive identifier", () => {
    expect(() => parseSaveReviewers({ assignments: [{ enrollmentId: "0", reviewerUserId: "a" }] })).toThrow();
  });
});

describe("parseReviewerSearch", () => {
  it("refuses one character, which narrows a company roster to nothing readable", () => {
    expect(() => parseReviewerSearch(new URLSearchParams("search=ก"))).toThrow();
  });

  it("accepts no search at all, which asks for the section-head list", () => {
    expect(parseReviewerSearch(new URLSearchParams())).toBe("");
    expect(parseReviewerSearch(new URLSearchParams("search=%20%20"))).toBe("");
  });

  it("returns the trimmed search text", () => {
    expect(parseReviewerSearch(new URLSearchParams("search=%20สมชาย%20"))).toBe("สมชาย");
  });
});
