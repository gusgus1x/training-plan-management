import { describe, expect, it } from "vitest";
import { buildRecords, resolveStageState, toRecord } from "../../app/components/employee/RecordModule";
import { emptyEnrollmentStage, type EnrollmentRecord, type EnrollmentStageInfo } from "../../app/lib/trainingEnrollment/types";

const enrollment = (overrides: Partial<EnrollmentRecord> = {}): EnrollmentRecord => ({
  id: "1",
  planId: "10",
  result: null,
  plan: {
    assessment: {
      preTest: emptyEnrollmentStage,
      postTest: emptyEnrollmentStage,
      evaluation: emptyEnrollmentStage,
      evaluationAfter30Day: emptyEnrollmentStage,
    },
    validityMonths: null,
    planCode: "PLAN-001",
    planName: "Quality Control Basics batch 1",
    batchName: "Batch 1",
    courseCode: "QC-001",
    courseName: "Quality Control Basics",
    hours: 6,
    instructor: "HRD Learning Team",
    provider: "",
    venue: "Training Room A",
    startAt: "2026-05-12T02:00:00.000Z",
    endAt: "2026-05-12T09:00:00.000Z",
    owner: "CENTER",
  },
  employeeId: "4043",
  employeeUserId: "TEST0001",
  employeeCode: "",
  employeeName: "นาย ทดสอบ ระบบอบรม",
  company: "ATA",
  department: "Office Administration",
  position: "Officer",
  level: "S3",
  source: "EMPLOYEE",
  status: "Center Approved",
  targetMatchStatus: "MATCHED",
  levelMatchStatus: "NOT_REQUIRED",
  remark: "",
  enrolledAt: "2026-05-01T00:00:00.000Z",
  approvedBy: null,
  approvedAt: null,
  attendance: {
    attendanceId: "1",
    status: "PRESENT",
    checkInAt: null,
    checkOutAt: null,
    method: "MANUAL",
    recordedBy: null,
    remark: "",
  },
  ...overrides,
});

describe("employee training record is built from attendance, not from invented data", () => {
  it("keeps only enrollments the employee actually attended", () => {
    const records = buildRecords([
      enrollment({ id: "present" }),
      enrollment({ id: "absent", attendance: { ...enrollment().attendance!, status: "ABSENT" } }),
      enrollment({ id: "never-checked-in", attendance: null }),
    ]);

    expect(records.map((record) => record.id)).toEqual(["present"]);
  });

  it("never invents a certificate number or a score", () => {
    const record = toRecord(enrollment());

    // This row is exported into a file employees hand to prospective employers. A generated
    // certificate number would be a forged credential, not a placeholder.
    expect(record.certificateNo).toBe("-");
    expect(record.score).toBeNull();
  });

  it("shows the newest training first", () => {
    const older = enrollment({ id: "older" });
    older.plan = { ...older.plan, startAt: "2026-01-05T02:00:00.000Z" };
    const newer = enrollment({ id: "newer" });
    newer.plan = { ...newer.plan, startAt: "2026-09-30T02:00:00.000Z" };

    expect(buildRecords([older, newer]).map((record) => record.id)).toEqual(["newer", "older"]);
  });

  it("names the owning HRD as the provider", () => {
    expect(toRecord(enrollment()).provider).toBe("HRD Center");

    const factory = enrollment();
    factory.plan = { ...factory.plan, owner: "FACTORY" };
    expect(toRecord(factory).provider).toBe("Factory HRD");
  });

  // preTestStatus/postTestStatus/evaluationStatus used to be hardcoded "Pending" for every
  // enrollment regardless of stage config or submission state, and that literal string was
  // exported straight into the official training-record document employees hand to employers.
  it("reads pre/post-test status from the real submission, not a hardcoded Pending", () => {
    const withScore = enrollment();
    withScore.plan = {
      ...withScore.plan,
      assessment: {
        ...withScore.plan.assessment,
        preTest: {
          mode: "FORM",
          link: null,
          opensAt: "2026-05-12T02:00:00.000Z",
          availability: "OPEN",
          submission: { attemptNo: 1, submittedAt: "2026-05-12T03:00:00.000Z", score: 90, passStatus: "PASS", gradingStatus: "REVIEWED", resultsPublished: true },
        },
      },
    };
    expect(toRecord(withScore).preTestStatus).toBe("Completed");
  });

  it("reports a FORM stage nobody has attempted yet as Pending, not Completed", () => {
    const notDone = enrollment();
    notDone.plan = {
      ...notDone.plan,
      assessment: {
        ...notDone.plan.assessment,
        preTest: { mode: "FORM", link: null, opensAt: "2026-05-12T02:00:00.000Z", availability: "OPEN", submission: null },
      },
    };
    expect(toRecord(notDone).preTestStatus).toBe("Pending");
  });

  it("reports a course with no test at all as N/A, not Pending", () => {
    // A course that never had a pre-test was never "pending" one - the old hardcoded value
    // claimed otherwise for every single course, tested or not.
    expect(toRecord(enrollment()).preTestStatus).toBe("N/A");
  });
});

describe("resolveStageState - the assessment/evaluation button and label state", () => {
  const stage = (overrides: Partial<EnrollmentStageInfo>): EnrollmentStageInfo => ({
    ...emptyEnrollmentStage,
    mode: "FORM",
    availability: "OPEN",
    ...overrides,
  });

  it("refuses a LINK stage before its opening date, the same as a FORM stage", () => {
    // The bug this guards: the LINK branch used to be checked before availability, so an external
    // link was clickable regardless of the 25-day (or any) date rule.
    const notYetLink = stage({ mode: "LINK", link: "https://forms.example.com/x", availability: "NOT_YET" });
    expect(resolveStageState(notYetLink)).toBe("NOT_YET");
  });

  it("refuses a LINK stage HRD has closed, the same as a FORM stage", () => {
    const closedLink = stage({ mode: "LINK", link: "https://forms.example.com/x", availability: "CLOSED_BY_HRD" });
    expect(resolveStageState(closedLink)).toBe("CLOSED_BY_HRD");
  });

  it("only reaches LINK once the stage is actually open", () => {
    const openLink = stage({ mode: "LINK", link: "https://forms.example.com/x", availability: "OPEN" });
    expect(resolveStageState(openLink)).toBe("LINK");
  });

  it("reports NONE regardless of availability", () => {
    expect(resolveStageState(stage({ mode: "NONE", availability: "NOT_YET" }))).toBe("NONE");
  });

  it("distinguishes a graded submission from one still awaiting HRD review", () => {
    const reviewed = stage({
      submission: { attemptNo: 1, submittedAt: "2026-05-12T00:00:00.000Z", score: 80, passStatus: "PASS", gradingStatus: "REVIEWED", resultsPublished: true },
    });
    const pending = stage({
      submission: { attemptNo: 1, submittedAt: "2026-05-12T00:00:00.000Z", score: null, passStatus: "PENDING", gradingStatus: "PENDING_REVIEW", resultsPublished: false },
    });
    expect(resolveStageState(reviewed)).toBe("DONE");
    expect(resolveStageState(pending)).toBe("REVIEW_PENDING");
  });

  it("keeps a graded submission hidden until HRD releases the result", () => {
    // Grading and releasing are separate acts: a REVIEWED submission HRD has not published yet
    // must not show up as Completed with a score the employee is not supposed to see.
    const held = stage({
      submission: { attemptNo: 1, submittedAt: "2026-05-12T00:00:00.000Z", score: null, passStatus: "PENDING", gradingStatus: "REVIEWED", resultsPublished: false },
    });
    expect(resolveStageState(held)).toBe("REVIEW_PENDING");
  });

  it("reports TODO for an open FORM stage nobody has attempted", () => {
    expect(resolveStageState(stage({}))).toBe("TODO");
  });
});
