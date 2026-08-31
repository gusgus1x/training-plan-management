import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as courseOutline } from "../../app/api/course-master/course-outline/route";
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
