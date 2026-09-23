import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createGetCourseCoverageHandler } from "../../app/api/training-plan/enrollments/course-coverage/route";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import { filterByView, summarize } from "../../app/lib/trainingEnrollment/coverageSummary";
import { isTrainedEnrollment } from "../../app/lib/trainingEnrollment/trained";
import type { CourseCoverageEmployee } from "../../app/lib/trainingEnrollment/types";

const now = new Date("2026-09-23T10:00:00Z");
const past = new Date("2026-08-01T17:00:00Z");
const future = new Date("2026-10-01T17:00:00Z");

describe("isTrainedEnrollment", () => {
  it("counts only a finished batch the employee completed or was checked in to", () => {
    expect(isTrainedEnrollment({ completionStatus: "COMPLETED", attendanceStatus: null, planEnd: past }, now)).toBe(true);
    expect(isTrainedEnrollment({ completionStatus: null, attendanceStatus: "PRESENT", planEnd: past }, now)).toBe(true);
    expect(isTrainedEnrollment({ completionStatus: null, attendanceStatus: "LATE", planEnd: past }, now)).toBe(true);
  });

  it("does not count an approval alone, an absence, or a batch still to come", () => {
    expect(isTrainedEnrollment({ completionStatus: null, attendanceStatus: null, planEnd: past }, now)).toBe(false);
    expect(isTrainedEnrollment({ completionStatus: "NOT_COMPLETED", attendanceStatus: "ABSENT", planEnd: past }, now)).toBe(false);
    expect(isTrainedEnrollment({ completionStatus: "COMPLETED", attendanceStatus: "PRESENT", planEnd: future }, now)).toBe(false);
  });
});

const row = (overrides: Partial<CourseCoverageEmployee>): CourseCoverageEmployee => ({
  employeeId: "1",
  employeeUserId: "u1",
  employeeCode: "E1",
  name: "A",
  companyCode: "ATA",
  department: "ส่วนผลิต",
  section: "แผนกหล่อ",
  inTarget: true,
  lastTrainedAt: null,
  lastBatchName: null,
  timesTrained: 0,
  seatedNow: false,
  ...overrides,
});

describe("coverage summary", () => {
  const rows = [
    row({ employeeId: "1", timesTrained: 1 }),
    row({ employeeId: "2" }),
    row({ employeeId: "3", section: "แผนกหลอม", timesTrained: 2 }),
    row({ employeeId: "4", department: "ส่วน QA", section: "แผนก QA", inTarget: false }),
    row({ employeeId: "5", companyCode: "SNF", timesTrained: 1 }),
  ];

  it("filters by view and company", () => {
    expect(filterByView(rows, "target", "ALL").map((r) => r.employeeId)).toEqual(["1", "2", "3", "5"]);
    expect(filterByView(rows, "company", "ATA").map((r) => r.employeeId)).toEqual(["1", "2", "3", "4"]);
    expect(filterByView(rows, "all", "ATA")).toHaveLength(5);
  });

  it("totals trained and remaining per department and section", () => {
    const summary = summarize(filterByView(rows, "company", "ATA"));
    expect(summary).toMatchObject({ total: 4, trained: 2, remain: 2, pct: 50 });
    const production = summary.departments.find((d) => d.name === "ส่วนผลิต");
    expect(production).toMatchObject({ total: 3, trained: 2 });
    expect(production?.sections.map((s) => [s.name, s.trained, s.total])).toEqual([
      ["แผนกหล่อ", 1, 2],
      ["แผนกหลอม", 1, 1],
    ]);
  });
});

const principal = (overrides: Partial<AuthenticatedPrincipal>): AuthenticatedPrincipal => ({
  userId: "7",
  username: "hrd",
  role: "HRD_FACTORY",
  employeeId: null,
  employeeUserId: null,
  companyId: "3",
  email: null,
  employeeCode: null,
  displayName: "HRD",
  companyCode: "SNF",
  companyName: null,
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
  ...overrides,
});

const call = async (user: AuthenticatedPrincipal, query = "planId=99") => {
  const getCourseCoverage = vi.fn().mockResolvedValue([]);
  const handler = createGetCourseCoverageHandler({
    auth: {
      verifyToken: () => ({ version: 1 as const, userId: user.userId, issuedAt: 100, lastSeenAt: 200, bootId: "test-boot-id" }),
      revalidate: vi.fn().mockResolvedValue(user),
      rollToken: () => "rolled-token",
      production: false,
    },
    getCourseCoverage,
  });
  const response = await handler(
    new NextRequest(`http://localhost/api/training-plan/enrollments/course-coverage?${query}`, {
      headers: { cookie: "tpm_session=valid-token" },
    }),
    undefined,
  );
  return { status: response.status, getCourseCoverage };
};

describe("GET /api/training-plan/enrollments/course-coverage", () => {
  it("pins an HRD factory to its own company and lets the center see every company", async () => {
    expect((await call(principal({}))).getCourseCoverage).toHaveBeenCalledWith("99", "3");
    expect((await call(principal({ role: "HRD_CENTER", companyId: null }))).getCourseCoverage).toHaveBeenCalledWith("99", null);
  });

  it("gives an HRD factory without a company nothing, and refuses employees", async () => {
    const orphan = await call(principal({ companyId: null }));
    expect(orphan.status).toBe(200);
    expect(orphan.getCourseCoverage).not.toHaveBeenCalled();
    expect((await call(principal({ role: "EMPLOYEE" }))).status).toBe(403);
  });
});
