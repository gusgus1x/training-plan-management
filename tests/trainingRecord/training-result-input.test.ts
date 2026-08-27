import { describe, expect, it } from "vitest";
import { ApiError } from "../../app/lib/api/errors";
import { parseSaveResults } from "../../app/lib/trainingRecord/validation";

const rejectionReason = (run: () => unknown) => {
  try {
    run();
  } catch (error: unknown) {
    if (!(error instanceof ApiError)) throw error;
    return String((error.details as { reason?: string } | undefined)?.reason ?? "");
  }
  throw new Error("Expected the input to be rejected, but it was accepted");
};

const row = (overrides: Record<string, unknown> = {}) => ({
  enrollmentId: "1",
  preScore: 40,
  postScore: 85,
  completionStatus: "COMPLETED",
  validUntil: "2027-12-31",
  certificateNo: "CERT-001",
  ...overrides,
});

describe("training result input", () => {
  it("keeps what HRD graded", () => {
    const { results } = parseSaveResults({ results: [row()] });

    expect(results[0]).toEqual({
      enrollmentId: "1",
      preScore: 40,
      postScore: 85,
      completionStatus: "COMPLETED",
      validUntil: "2027-12-31",
      certificateNo: "CERT-001",
    });
  });

  it("treats a blank score as ungraded, not as zero", () => {
    // On a record an employee hands to a prospective employer, "no score recorded" and "scored 0"
    // are different claims.
    const { results } = parseSaveResults({
      results: [row({ preScore: "", postScore: null })],
    });

    expect(results[0].preScore).toBeNull();
    expect(results[0].postScore).toBeNull();
  });

  it("refuses a negative score, which the database would reject anyway", () => {
    expect(rejectionReason(() => parseSaveResults({ results: [row({ postScore: -1 })] }))).toMatch(
      /non-negative/,
    );
  });

  it("refuses a status the check constraint does not allow", () => {
    expect(
      rejectionReason(() => parseSaveResults({ results: [row({ completionStatus: "FINISHED" })] })),
    ).toMatch(/PENDING, NOT_COMPLETED, COMPLETED/);
  });

  it("refuses a calendar date that does not exist", () => {
    expect(
      rejectionReason(() => parseSaveResults({ results: [row({ validUntil: "2027-02-31" })] })),
    ).toMatch(/real calendar date/);
  });

  it("refuses the same enrollment twice in one save", () => {
    // training_result has one row per enrollment, so the winner would otherwise depend on which
    // entry the writer happened to apply last.
    expect(
      rejectionReason(() =>
        parseSaveResults({
          results: [row({ certificateNo: "A" }), row({ certificateNo: "B" })],
        }),
      ),
    ).toMatch(/appears twice/);
  });

  it("turns an empty certificate number into null rather than an empty string", () => {
    // certificate_no is unique with a filter on NOT NULL: empty strings would collide with each
    // other, while nulls do not.
    const { results } = parseSaveResults({ results: [row({ certificateNo: "   " })] });

    expect(results[0].certificateNo).toBeNull();
  });

  it("refuses a payload that is not a list of results", () => {
    expect(rejectionReason(() => parseSaveResults({ results: "everything" }))).toMatch(/array/);
  });
});
