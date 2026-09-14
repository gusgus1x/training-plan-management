import { NextRequest } from "next/server";
import { apiSuccess } from "../../../lib/api/response";
import { auditRequestContext } from "../../../lib/audit";
import { triggerAuditPurgeIfDue } from "../../../lib/audit/purge";
import { createProtectedRoute } from "../../../lib/auth/guard";
import { getActiveSessionsList, trackUserSession } from "../../../lib/auth/activeSessions";

export const POST = createProtectedRoute(async (request: NextRequest, principal) => {
  // Trigger automatic daily audit log purge if due (throttled to once every 24 hours)
  triggerAuditPurgeIfDue();
  let currentPage = "Dashboard";
  try {
    const body = (await request.json()) as { currentPage?: string };
    if (body.currentPage) {
      currentPage = body.currentPage;
    }
  } catch {
    // Body is optional
  }

  const context = auditRequestContext(request);

  trackUserSession({
    userId: principal.userId,
    username: principal.username,
    role: principal.role,
    companyCode: principal.companyCode ?? null,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    currentPage,
  });

  const activeSessions = getActiveSessionsList();

  return apiSuccess({
    success: true,
    activeCount: activeSessions.filter((s) => s.status === "ONLINE").length,
  });
});
