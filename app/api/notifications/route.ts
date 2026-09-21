import type { NextRequest } from "next/server";
import { apiSuccess } from "../../lib/api/response";
import { readJsonObject } from "../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../lib/auth/guard";
import { getPrismaClient } from "../../lib/database/prisma";
import type { NotificationRecord } from "../../lib/notifications/types";

type Dependencies = {
  auth?: ProtectedRouteOptions;
};

const allowedRoles = ["EMPLOYEE", "HRD_FACTORY", "HRD_CENTER", "ADMIN"] as const;

export const createListNotificationsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (_request: NextRequest, principal) => {
      const db = getPrismaClient();
      const userId = BigInt(principal.userId);

      const rows = await db.notification.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: 50,
      });

      const unreadCount = await db.notification.count({
        where: { user_id: userId, is_read: false },
      });

      const notifications: NotificationRecord[] = rows.map((r) => ({
        notificationId: r.notification_id.toString(),
        userId: r.user_id.toString(),
        title: r.title,
        message: r.message,
        relatedType: r.related_type ?? null,
        relatedId: r.related_id ? r.related_id.toString() : null,
        isRead: r.is_read,
        createdAt: r.created_at.toISOString(),
      }));

      return apiSuccess({ notifications, unreadCount });
    },
    { ...dependencies.auth, allowedRoles },
  );

export const createUpdateNotificationHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(
    async (request: NextRequest, principal) => {
      const db = getPrismaClient();
      const userId = BigInt(principal.userId);
      const body = await readJsonObject(request);
      const markAllRead = Boolean(body.markAllRead);
      const notificationId = body.notificationId ? String(body.notificationId).trim() : null;

      if (markAllRead) {
        await db.notification.updateMany({
          where: { user_id: userId, is_read: false },
          data: { is_read: true },
        });
      } else if (notificationId) {
        await db.notification.updateMany({
          where: { notification_id: BigInt(notificationId), user_id: userId },
          data: { is_read: true },
        });
      }

      return apiSuccess({ success: true });
    },
    { ...dependencies.auth, allowedRoles },
  );

export const GET = createListNotificationsHandler();
export const PATCH = createUpdateNotificationHandler();
