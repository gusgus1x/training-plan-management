import { describe, expect, it } from "vitest";
import { resolveScanDestination } from "../../app/components/employee/TrainingFormScanLanding";
import type { EnrollmentRecord, EnrollmentStageInfo } from "../../app/lib/trainingEnrollment/types";

/**
 * What a scanned QR does once we know who scanned it. Every branch is a sentence the employee sees
 * on their phone, so each one is worth pinning: a blank screen or a raw error at the door of a
 * training room is worse than "you are not enrolled in this session".
 */

const t = (th: string) => th;
const formatDate = (isoDate: string) => isoDate.slice(0, 10);

const stage = (overrides: Partial<EnrollmentStageInfo> = {}): EnrollmentStageInfo => ({
  mode: "FORM",
  link: null,
  opensAt: "2026-09-01T02:00:00.000Z",
  availability: "OPEN",
  submission: null,
  ...overrides,
});

const enrollment = (overrides: {
  status?: EnrollmentRecord["status"];
  preTest?: EnrollmentStageInfo;
} = {}): EnrollmentRecord =>
  ({
    id: "77",
    status: overrides.status ?? "Center Approved",
    plan: {
      assessment: {
        preTest: overrides.preTest ?? stage(),
        postTest: stage(),
        evaluation: stage(),
        evaluationAfter30Day: stage(),
      },
    },
  }) as unknown as EnrollmentRecord;

const resolve = (record: EnrollmentRecord | null) =>
  resolveScanDestination(record, "PRE_TEST", t, formatDate);

describe("resolveScanDestination", () => {
  it("forwards an approved enrollee to their OWN copy of the form", () => {
    // The QR encodes the plan; the enrollment id must come from the scanner, never from the QR.
    expect(resolve(enrollment())).toEqual({ kind: "forward", href: "/training-form/77/PRE_TEST" });
  });

  it("says so when the scanner is not in this session", () => {
    const result = resolve(null);
    expect(result.kind).toBe("message");
    expect(result).toMatchObject({ title: expect.stringContaining("ไม่ได้อยู่ในรุ่นอบรมนี้") });
  });

  it("does not forward while the registration is still awaiting approval", () => {
    const result = resolve(enrollment({ status: "Pending Approval" }));
    expect(result.kind).toBe("message");
  });

  it("does not forward a rejected or cancelled registration", () => {
    expect(resolve(enrollment({ status: "Rejected" })).kind).toBe("message");
    expect(resolve(enrollment({ status: "Cancelled" })).kind).toBe("message");
  });

  it("reports the opening date instead of forwarding to a form nobody can take yet", () => {
    const result = resolve(enrollment({ preTest: stage({ availability: "NOT_YET" }) }));
    expect(result).toMatchObject({ kind: "message", detail: expect.stringContaining("2026-09-01") });
  });

  it("reports HRD's close switch", () => {
    const result = resolve(enrollment({ preTest: stage({ availability: "CLOSED_BY_HRD" }) }));
    expect(result.kind).toBe("message");
  });

  it("sends the scanner to the external form when the batch uses a link for that stage", () => {
    const result = resolve(
      enrollment({ preTest: stage({ mode: "LINK", link: "https://forms.gle/abc" }) }),
    );
    expect(result).toEqual({ kind: "external", href: "https://forms.gle/abc" });
  });

  it("says so when the stage has no form at all", () => {
    const result = resolve(enrollment({ preTest: stage({ mode: "NONE" }) }));
    expect(result.kind).toBe("message");
  });

  it("still forwards someone who already submitted - the runner tells them, and a retake is allowed", () => {
    const submitted = stage({
      submission: { attemptNo: 1, submittedAt: "2026-09-02T00:00:00.000Z", score: 90, passStatus: "PASS", gradingStatus: "REVIEWED", resultsPublished: true },
    });
    expect(resolve(enrollment({ preTest: submitted }))).toMatchObject({ kind: "forward" });
  });
});
