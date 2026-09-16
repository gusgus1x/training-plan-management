import { describe, expect, it } from "vitest";
import {
  buildEmployeeNotices,
  isShownOnDashboard,
  markDismissed,
  markSeenInBell,
  markSnoozed,
  noticeHref,
  stampFirstSeen,
  unreadCount,
} from "../../app/components/employee/employeeNotices";
import { emptyEnrollmentStage, type EnrollmentRecord } from "../../app/lib/trainingEnrollment/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = Date.parse("2026-09-14T08:00:00.000Z");

const enrollment = (overrides: Partial<EnrollmentRecord> = {}, postTest = emptyEnrollmentStage): EnrollmentRecord => ({
  id: "e1",
  planId: "10",
  certificate: null,
  result: null,
  plan: {
    assessment: {
      preTest: emptyEnrollmentStage,
      postTest,
      evaluation: emptyEnrollmentStage,
      evaluationAfter30Day: emptyEnrollmentStage,
    },
    validityMonths: null,
    planCode: "PLAN-001",
    planName: "QC batch 1",
    batchName: "1",
    courseId: "1",
    courseCode: "QC-001",
    courseName: "Quality Control Basics",
    hours: 6,
    instructor: "",
    provider: "",
    venue: "",
    startAt: "2026-09-01T02:00:00.000Z",
    endAt: "2026-09-01T09:00:00.000Z",
    owner: "CENTER",
  },
  employeeId: "4043",
  employeeUserId: "TEST0001",
  employeeCode: "",
  employeeName: "Test",
  company: "ATA",
  department: "",
  position: "",
  level: "S3",
  source: "EMPLOYEE",
  status: "Center Approved",
  targetMatchStatus: "MATCHED",
  levelMatchStatus: "NOT_REQUIRED",
  remark: "",
  enrolledAt: "2026-08-01T00:00:00.000Z",
  approvedBy: null,
  approvedAt: null,
  attendance: { attendanceId: "1", status: "PRESENT", checkInAt: null, checkOutAt: null, method: "MANUAL", recordedBy: null, remark: "" },
  ...overrides,
});

const openPostTest = { ...emptyEnrollmentStage, mode: "FORM" as const, availability: "OPEN" as const };
const certificate = { certificateFileId: "c9", issuedAt: "2026-09-10T00:00:00.000Z" } as EnrollmentRecord["certificate"];

describe("which notices an employee gets", () => {
  it("raises a certificate notice and a forms notice pointing at the completed tab", () => {
    const notices = buildEmployeeNotices([enrollment({ certificate }, openPostTest)], new Date(T0));
    expect(notices.map((notice) => notice.id)).toEqual(["certificate:c9", "forms:e1:post"]);
    expect(notices.every((notice) => notice.tab === "completed")).toBe(true);
    expect(noticeHref(notices[1], 5)).toBe("/?module=record&tab=completed&focus=e1&at=5");
  });

  it("says nothing about forms on a course still waiting for approval", () => {
    const pending = enrollment({ status: "Pending Approval", attendance: null }, openPostTest);
    expect(buildEmployeeNotices([pending], new Date(T0))).toEqual([]);
  });
});

describe("dashboard card lifetime", () => {
  const [notice] = buildEmployeeNotices([enrollment({ certificate })], new Date(T0));
  const seen = stampFirstSeen({}, [notice], T0);

  it("shows for three days from first sight, then retires", () => {
    expect(isShownOnDashboard(seen[notice.id], T0 + 3 * DAY - 1)).toBe(true);
    expect(isShownOnDashboard(seen[notice.id], T0 + 3 * DAY)).toBe(false);
  });

  it("keeps the first-seen time when the page loads again", () => {
    expect(stampFirstSeen(seen, [notice], T0 + DAY)).toBe(seen);
  });

  it("X hides it for one day only", () => {
    const snoozed = markSnoozed(seen, notice.id, T0 + HOUR);
    expect(isShownOnDashboard(snoozed[notice.id], T0 + HOUR + DAY - 1)).toBe(false);
    expect(isShownOnDashboard(snoozed[notice.id], T0 + HOUR + DAY)).toBe(true);
    expect(snoozed[notice.id].firstSeenAt).toBe(T0);
  });

  it("don't-show-again or opening it hides it for good", () => {
    expect(isShownOnDashboard(markDismissed(seen, notice.id, T0)[notice.id], T0 + HOUR)).toBe(false);
  });
});

describe("bell count", () => {
  it("counts notices not yet looked at in the bell, and clears on open without hiding them", () => {
    const notices = buildEmployeeNotices([enrollment({ certificate }, openPostTest)], new Date(T0));
    const dismissed = markDismissed({}, notices[0].id, T0);
    expect(unreadCount(notices, dismissed)).toBe(2);
    const opened = markSeenInBell(dismissed, notices, T0);
    expect(unreadCount(notices, opened)).toBe(0);
    expect(opened[notices[0].id].dismissed).toBe(true);
  });
});
