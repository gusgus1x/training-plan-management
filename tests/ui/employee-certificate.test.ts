import { describe, expect, it } from "vitest";
import { certificatesOf } from "../../app/components/employee/UserDashboard";
import { buildRecords, toRecord } from "../../app/components/employee/RecordModule";
import { emptyEnrollmentStage, type EnrollmentRecord } from "../../app/lib/trainingEnrollment/types";

const enrollment = (overrides: Partial<EnrollmentRecord> = {}): EnrollmentRecord =>
  ({
    id: "1",
    planId: "10",
    result: null,
    certificate: null,
    plan: {
      assessment: {
        preTest: emptyEnrollmentStage,
        postTest: emptyEnrollmentStage,
        evaluation: emptyEnrollmentStage,
        evaluationAfter30Day: emptyEnrollmentStage,
      },
      courseCode: "C-001",
      courseName: "หลักสูตรทดสอบ",
      startAt: "2026-05-10T09:00:00.000Z",
      endAt: "2026-05-12T16:00:00.000Z",
      hours: 6,
      venue: "TEP",
      instructor: "สมชาย",
      batchName: "1",
      owner: "CENTER",
    },
    employeeId: "500",
    employeeUserId: "u-1",
    employeeCode: "C-1",
    employeeName: "พนักงาน ทดสอบ",
    company: "ATA",
    department: "-",
    position: "-",
    attendance: { status: "PRESENT" },
    ...overrides,
  }) as unknown as EnrollmentRecord;

const certificate = { certificateFileId: "77", fileName: "12345_x.pdf", issuedAt: "2026-06-01T00:00:00.000Z" };

describe("certificatesOf", () => {
  it("returns nothing when no certificate has been issued", () => {
    expect(certificatesOf([enrollment(), enrollment({ id: "2" })])).toEqual([]);
  });

  it("returns only the enrollments carrying one, in order", () => {
    const withCertificate = enrollment({ id: "2", certificate });
    expect(certificatesOf([enrollment(), withCertificate])).toEqual([withCertificate]);
  });
});

describe("toRecord", () => {
  it("carries the certificate straight through", () => {
    expect(toRecord(enrollment({ certificate })).certificate).toEqual(certificate);
  });

  it("reports null rather than inventing one", () => {
    // Same principle as certificateNo's "-": a fabricated credential is worse than an absent one.
    expect(toRecord(enrollment()).certificate).toBeNull();
  });
});

describe("buildRecords", () => {
  it("still shows only courses actually attended once certificates are in play", () => {
    const attended = enrollment({ id: "2", certificate });
    const absent = enrollment({
      id: "3",
      certificate,
      attendance: { status: "ABSENT" },
    } as unknown as Partial<EnrollmentRecord>);

    expect(buildRecords([attended, absent]).map((record) => record.id)).toEqual(["2"]);
  });
});
