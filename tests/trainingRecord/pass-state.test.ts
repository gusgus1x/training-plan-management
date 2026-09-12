import { describe, expect, it } from "vitest";
import { prePostOf } from "../../app/components/center_factory/TrainingRecordManagement/modules/TrainingRecord";
import type { TrainingRecordAttendee } from "../../app/lib/trainingRecord/types";

const attendee = (overrides: Partial<TrainingRecordAttendee> = {}): TrainingRecordAttendee => ({
  enrollmentId: "1",
  employeeId: "10",
  employeeUserId: "12345678",
  employeeCode: "1290-000017",
  name: "ทดสอบ ระบบอบรม",
  department: "Office Administration",
  position: "Officer",
  company: "ATA",
  attended: true,
  preTestSubmitted: false,
  postTestSubmitted: false,
  preTestPassed: null,
  postTestPassed: null,
  orgUnit: {
    functionTh: "",
    functionEn: "",
    divisionTh: "",
    divisionEn: "",
    departmentTh: "",
    departmentEn: "",
    sectionTh: "",
    sectionEn: "",
  },
  evaluationCompleted: false,
  result: null,
  reviewer: null,
  ...overrides,
});

const withResult = (status: "PENDING" | "NOT_COMPLETED" | "COMPLETED") =>
  attendee({
    result: {
      enrollmentId: "1",
      preScore: null,
      preLinkScoreMax: null,
      postScore: null,
      postLinkScoreMax: null,
      completionStatus: status,
      completedAt: null,
      validUntil: null,
      certificateNo: null,
    },
  });

describe("whether an attendee passed", () => {
  it("does not call an ungraded attendee failed", () => {
    // assessment_submission is empty, so postTestPassed is null for everyone. The old rule was
    // `postTestPassed ? "Passed" : "Failed"`, which marked every attendee in the company as having
    // failed a test that was never given.
    expect(prePostOf(attendee())).toBe("Pending");
  });

  it("follows the result HRD recorded", () => {
    expect(prePostOf(withResult("COMPLETED"))).toBe("Passed");
    expect(prePostOf(withResult("NOT_COMPLETED"))).toBe("Failed");
  });

  it("keeps a result left undecided out of both buckets", () => {
    expect(prePostOf(withResult("PENDING"))).toBe("Pending");
  });

  it("falls back to the post test when no result was recorded", () => {
    expect(prePostOf(attendee({ postTestPassed: true }))).toBe("Passed");
    expect(prePostOf(attendee({ postTestPassed: false }))).toBe("Failed");
  });

  it("lets the recorded result override the submission", () => {
    // A person decided this; the submission is only evidence, and HRD may be correcting it.
    const overridden = withResult("COMPLETED");
    overridden.postTestPassed = false;
    expect(prePostOf(overridden)).toBe("Passed");
  });
});
