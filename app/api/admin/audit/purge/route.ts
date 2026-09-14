import { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { createProtectedRoute } from "../../../../lib/auth/guard";
import { purgeExpiredAuditLogs } from "../../../../lib/audit/purge";
import { recordAudit } from "../../../../lib/audit";

const adminOptions = { allowedRoles: ["ADMIN"] as const };

export const POST = createProtectedRoute(
  async (request: NextRequest, principal) => {
    const deletedCount = await purgeExpiredAuditLogs();

    // Record the audit purge action itself
    await recordAudit({
      category: "DELETE",
      action: "AUDIT_LOG_PURGED",
      actor: {
        userId: principal.userId,
        username: principal.username,
        role: principal.role,
      },
      entityType: "audit_log",
      entityLabel: `Purged ${deletedCount} expired log records`,
      detail: { deletedCount },
    });

    return apiSuccess({
      success: true,
      deletedCount,
      message: `ล้างข้อมูล Audit Log ที่หมดอายุแล้วจำนวน ${deletedCount} รายการเรียบร้อย`,
    });
  },
  adminOptions
);
