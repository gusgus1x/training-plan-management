import { NextRequest } from "next/server";
import { apiSuccess } from "../../../lib/api/response";
import { createProtectedRoute } from "../../../lib/auth/guard";
import { getPrismaClient } from "../../../lib/database/prisma";

const adminOptions = { allowedRoles: ["ADMIN"] as const };

export const dynamic = "force-dynamic";

export const GET = createProtectedRoute(
  async (_request: NextRequest) => {
    const prisma = getPrismaClient();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Calculate 7 days ago
    const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

    // 1. Parallel database counts across main modules
    const [
      userCount,
      activeUserCount,
      companyCount,
      employeeCount,
      courseCount,
      planCount,
      enrollmentCount,
      totalLogs,
      expiredLogs,
      oldestLog,
      recentAuditLogs,
      recentEvents,
    ] = await Promise.all([
      prisma.user_account.count(),
      prisma.user_account.count({ where: { status: "ACTIVE" } }),
      prisma.company.count(),
      prisma.employee.count(),
      prisma.course.count(),
      prisma.training_plan.count(),
      prisma.training_enrollment.count(),
      prisma.audit_log.count(),
      prisma.audit_log.count({ where: { retain_until: { lt: startOfToday } } }),
      prisma.audit_log.findFirst({
        orderBy: { occurred_at: "asc" },
        select: { occurred_at: true },
      }),
      prisma.audit_log.findMany({
        where: { occurred_at: { gte: sevenDaysAgo } },
        select: {
          category: true,
          action: true,
          occurred_at: true,
        },
        orderBy: { occurred_at: "asc" },
      }),
      prisma.audit_log.findMany({
        take: 6,
        orderBy: { occurred_at: "desc" },
        select: {
          audit_log_id: true,
          occurred_at: true,
          category: true,
          action: true,
          actor_username: true,
          actor_role: true,
          entity_label: true,
        },
      }),
    ]);

    // 2. Aggregate 7-day daily activity (Login success vs failed)
    const dailyMap = new Map<string, { date: string; label: string; success: number; failed: number; other: number }>();

    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(d);
      dailyMap.set(key, { date: key, label, success: 0, failed: 0, other: 0 });
    }

    const categoryMap = new Map<string, number>();

    let logins7Days = 0;
    let failedLogins7Days = 0;

    for (const log of recentAuditLogs) {
      const dayKey = log.occurred_at.toISOString().slice(0, 10);
      const bucket = dailyMap.get(dayKey);

      if (log.action === "LOGIN_SUCCESS") {
        logins7Days++;
        if (bucket) bucket.success++;
      } else if (log.action === "LOGIN_FAILED") {
        failedLogins7Days++;
        if (bucket) bucket.failed++;
      } else {
        if (bucket) bucket.other++;
      }

      categoryMap.set(log.category, (categoryMap.get(log.category) || 0) + 1);
    }

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    return apiSuccess({
      database: {
        status: "ONLINE",
        checkedAt: now.toISOString(),
      },
      counts: {
        users: userCount,
        activeUsers: activeUserCount,
        companies: companyCount,
        employees: employeeCount,
        courses: courseCount,
        plans: planCount,
        enrollments: enrollmentCount,
      },
      auditStats: {
        totalLogs,
        expiredLogs,
        oldestLogDate: oldestLog?.occurred_at ? oldestLog.occurred_at.toISOString() : null,
      },
      securitySummary: {
        logins7Days,
        failedLogins7Days,
        dailyActivity: Array.from(dailyMap.values()),
        categoryBreakdown,
      },
      recentEvents: recentEvents.map((e) => ({
        id: e.audit_log_id.toString(),
        occurredAt: e.occurred_at.toISOString(),
        category: e.category,
        action: e.action,
        actorUsername: e.actor_username,
        actorRole: e.actor_role,
        entityLabel: e.entity_label,
      })),
    });
  },
  adminOptions
);
