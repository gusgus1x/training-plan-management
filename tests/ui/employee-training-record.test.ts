import { describe, expect, it } from "vitest";
import { buildRecords, toRecord } from "../../app/components/employee/RecordModule";
import { emptyEnrollmentStage, type EnrollmentRecord } from "../../app/lib/trainingEnrollment/types";

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
          submission: { attemptNo: 1, submittedAt: "2026-05-12T03:00:00.000Z", score: 90, passStatus: "PASS", gradingStatus: "REVIEWED" },
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
