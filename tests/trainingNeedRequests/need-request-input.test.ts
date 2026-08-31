import { describe, expect, it } from "vitest";
import { ApiError } from "../../app/lib/api/errors";
import {
  parseCreateNeedRequest,
  parseNeedRequestListFilters,
  parseUpdateNeedRequest,
} from "../../app/lib/trainingNeedRequests/validation";

// ApiError carries one headline for the caller and the specific complaint in details.reason, so
// the assertions read the reason rather than the shared headline every rejection would match.
const rejectionReason = (run: () => unknown) => {
  try {
    run();
  } catch (error: unknown) {
    if (!(error instanceof ApiError)) throw error;
    return String((error.details as { reason?: string } | undefined)?.reason ?? "");
  }
  throw new Error("Expected the input to be rejected, but it was accepted");
};

describe("training need request input", () => {
  it("keeps the course and reason the employee typed", () => {
    const input = parseCreateNeedRequest({
      requestedCourseName: "Advanced Quality Control",
      requestReason: "Need deeper inspection skills for the new line.",
    });

    expect(input.requestedCourseName).toBe("Advanced Quality Control");
    expect(input.preferredStartDate).toBeNull();
    expect(input.preferredEndDate).toBeNull();
  });

  it("refuses a date the driver would otherwise coerce", () => {
    const reason = rejectionReason(() =>
      parseCreateNeedRequest({
        requestedCourseName: "Course",
        requestReason: "Reason",
        preferredStartDate: "12/05/2026",
      }),
    );

    expect(reason).toMatch(/YYYY-MM-DD/);
  });

  it("refuses a calendar date that does not exist", () => {
    // Date.parse rolls 31 February forward to 3 March rather than rejecting it, which would file
    // the request against a day the employee never chose.
    const reason = rejectionReason(() =>
      parseCreateNeedRequest({
        requestedCourseName: "Course",
        requestReason: "Reason",
        preferredStartDate: "2026-02-31",
      }),
    );

    expect(reason).toMatch(/real calendar date/);
  });

  it("refuses an end date before the start date", () => {
    const reason = rejectionReason(() =>
      parseCreateNeedRequest({
        requestedCourseName: "Course",
        requestReason: "Reason",
        preferredStartDate: "2026-09-10",
        preferredEndDate: "2026-09-01",
      }),
    );

    expect(reason).toMatch(/cannot fall before/);
  });

  it("requires a reason when rejecting, so the employee can act on it", () => {
    expect(rejectionReason(() => parseUpdateNeedRequest({ action: "reject" }))).toMatch(
      /reason is required/,
    );
    expect(parseUpdateNeedRequest({ action: "reject", note: "Budget is spent" }).note).toBe(
      "Budget is spent",
    );
  });

  it("approves without demanding a note", () => {
    expect(parseUpdateNeedRequest({ action: "approve" }).action).toBe("approve");
    expect(parseUpdateNeedRequest({ action: "approve" }).note).toBeNull();
  });

  it("rejects an unknown action rather than passing it to the database", () => {
    // "review" and "accept" were the old action names; the check constraint refuses the statuses
    // they mapped to, so they must not survive as silent aliases. Matched loosely because the
    // accepted set grows — "reset" was added later — and only the refusal has to hold.
    for (const action of ["delete", "review", "accept"]) {
      expect(rejectionReason(() => parseUpdateNeedRequest({ action }))).toMatch(
        /Action must be/,
      );
    }
  });

  it("refuses reason text longer than the NVARCHAR(1000) columns", () => {
    const tooLong = "x".repeat(1001);

    expect(
      rejectionReason(() =>
        parseCreateNeedRequest({ requestedCourseName: "Course", requestReason: tooLong }),
      ),
    ).toBeTruthy();
    expect(
      rejectionReason(() => parseUpdateNeedRequest({ action: "reject", note: tooLong })),
    ).toBeTruthy();
  });

  it("only allows status filters the check constraint accepts", () => {
    expect(
      rejectionReason(() => parseNeedRequestListFilters(new URLSearchParams("status=WHATEVER"))),
    ).toMatch(/Status must be one of/);

    // The live constraint CK_RC2_training_need_request_status_enum refuses these two.
    for (const status of ["REVIEW", "ACCEPTED"]) {
      expect(
        rejectionReason(() =>
          parseNeedRequestListFilters(new URLSearchParams(`status=${status}`)),
        ),
      ).toMatch(/Status must be one of/);
    }

    for (const status of ["PENDING", "APPROVED", "REJECTED", "PLANNED"]) {
      expect(parseNeedRequestListFilters(new URLSearchParams(`status=${status}`))).toEqual({
        status,
        employeeUserId: null,
      });
    }
  });
});
