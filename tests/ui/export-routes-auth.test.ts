import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createCourseOutlineHandler, POST as courseOutline } from "../../app/api/course-master/course-outline/route";
import type { AuthenticatedPrincipal } from "../../app/lib/auth/types";
import { POST as attendanceSheet } from "../../app/api/training-accept-survey/attendance-sheet/route";

/**
 * Both routes used to `export async function POST` directly, with no `createProtectedRoute` wrapper
 * — the only two in `app/api/**` besides `auth/*` and `health/*` that did. The one remaining gate
 * was `proxy.ts`, whose `shouldRedirectToLogin` exempts non-production entirely, so anyone able to
 * reach the host could make the server read a template off disk and build a workbook per request.
 *
 * No session cookie is sent, so the guard refuses before any token verification: this needs no
 * AUTH_SESSION_SECRET and touches neither the filesystem nor the database.
 */
const post = (url: string) =>
  new NextRequest(url, {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
  });

describe("Excel export routes require a session", () => {
  it("refuses an unauthenticated course outline export", async () => {
    const response = await courseOutline(
      post("http://localhost/api/course-master/course-outline"),
      undefined as never,
    );

    expect(response.status).toBe(401);
  });

  it("refuses an unauthenticated attendance sheet export", async () => {
    const response = await attendanceSheet(
      post("http://localhost/api/training-accept-survey/attendance-sheet"),
      undefined as never,
    );

    expect(response.status).toBe(401);
  });
});

const employee = (positionName: string): AuthenticatedPrincipal => ({
  userId: "42",
  username: "someone",
  role: "EMPLOYEE",
  employeeId: "7",
  employeeUserId: "10000042",
  companyId: "3",
  email: null,
  employeeCode: "1290-000042",
  displayName: null,
  companyCode: "ATA",
  companyName: null,
  functionCode: null,
  functionName: null,
  positionCode: null,
  positionName,
  levelCode: null,
  levelName: null,
  pl: null,
});

const asSignedIn = (user: AuthenticatedPrincipal) =>
  createCourseOutlineHandler({
    verifyToken: () => ({ version: 1, userId: user.userId, issuedAt: 100, lastSeenAt: 200, bootId: "test-boot-id" }),
    revalidate: vi.fn().mockResolvedValue(user),
    rollToken: () => "rolled-token",
    production: false,
  });

describe("course outline is for Section Head and above", () => {
  const signedPost = () =>
    new NextRequest("http://localhost/api/course-master/course-outline", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json", cookie: "tpm_session=valid-token" },
    });

  it("refuses an employee below Section Head", async () => {
    const response = await asSignedIn(employee("Engineer"))(signedPost(), undefined as never);
    expect(response.status).toBe(403);
  });

  it("lets a Section Head through to the export (an empty body then fails validation, not the guard)", async () => {
    const response = await asSignedIn(employee("Section Head"))(signedPost(), undefined as never);
    expect(response.status).toBe(400);
  });
});
