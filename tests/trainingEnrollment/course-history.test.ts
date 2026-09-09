import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createGetCourseHistoryHandler } from "../../app/api/training-plan/enrollments/course-history/route";
import type { EnrollmentService } from "../../app/lib/trainingEnrollment/service";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import type { CoursePriorHistoryRecord } from "../../app/lib/trainingEnrollment/types";

const principal: AuthenticatedPrincipal = {
  userId: "1",
  username: "hrd.center",
  role: "HRD_CENTER",
  employeeId: null,
  employeeUserId: null,
  companyId: null,
  email: "hrd@center.com",
  employeeCode: null,
  displayName: "HRD Center Admin",
  companyCode: "HRD Center",
  companyName: null,
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName: null,
  levelCode: null,
  levelName: null,
  pl: null,
};

const auth = (user: AuthenticatedPrincipal) => ({
  verifyToken: () => ({
    version: 1 as const,
    userId: user.userId,
    issuedAt: 100,
    lastSeenAt: 200,
    bootId: "test-boot-id",
  }),
  revalidate: vi.fn().mockResolvedValue(user),
  rollToken: () => "rolled-token",
  production: false,
});

describe("GET /api/training-plan/enrollments/course-history", () => {
  it("rejects request without planId", async () => {
    const service: Partial<EnrollmentService> = {
      getCourseHistory: vi.fn(),
    };
    const handler = createGetCourseHistoryHandler({ auth: auth(principal), service: service as EnrollmentService });
    const request = new NextRequest("http://localhost/api/training-plan/enrollments/course-history", {
      headers: { cookie: "tpm_session=valid-token" },
    });
    const response = await handler(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("returns course history records for valid planId", async () => {
    const mockHistory: CoursePriorHistoryRecord[] = [
      {
        employeeId: "101",
        employeeUserId: "USER-101",
        employeeCode: "EMP001",
        planId: "50",
        planName: "หลักสูตรความปลอดภัย รุ่น 1",
        planYear: 2025,
        batchNo: 1,
        batchName: "รุ่น 1",
        completedAt: "2025-05-10T00:00:00.000Z",
        completionStatus: "COMPLETED",
        attendanceStatus: "PRESENT",
        approvalStatus: "APPROVED",
      },
    ];

    const service: Partial<EnrollmentService> = {
      getCourseHistory: vi.fn().mockResolvedValue(mockHistory),
    };

    const handler = createGetCourseHistoryHandler({ auth: auth(principal), service: service as EnrollmentService });
    const request = new NextRequest("http://localhost/api/training-plan/enrollments/course-history?planId=99", {
      headers: { cookie: "tpm_session=valid-token" },
    });
    const response = await handler(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.data.history).toHaveLength(1);
    expect(json.data.history[0].employeeCode).toBe("EMP001");
    expect(json.data.history[0].planYear).toBe(2025);
    expect(service.getCourseHistory).toHaveBeenCalledWith("99");
  });
});
