import { NextRequest } from "next/server";
import { apiSuccess } from "../../../lib/api/response";
import { createProtectedRoute } from "../../../lib/auth/guard";
import { getPrismaClient } from "../../../lib/database/prisma";
import type { Prisma } from "../../../generated/prisma/client";

const adminOptions = { allowedRoles: ["ADMIN"] as const };

export type AuditLogRecord = {
  id: string;
  occurredAt: string;
  category: string;
  action: string;
  actorUserId: string | null;
  actorUsername: string | null;
  actorRole: string | null;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  detail: unknown;
  ipAddress: string | null;
  userAgent: string | null;
};

export const GET = createProtectedRoute(
  async (request: NextRequest) => {
    const prisma = getPrismaClient();
    const searchParams = request.nextUrl.searchParams;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get("limit") || "25", 10)));
    const category = searchParams.get("category");
    const search = searchParams.get("search")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Prisma.audit_logWhereInput = {};

    if (category && category !== "all") {
      where.category = category;
    }

    if (from || to) {
      where.occurred_at = {};
      if (from) {
        where.occurred_at.gte = new Date(from);
      }
      if (to) {
        // Include up to end of the day if just a date is passed
        const toDate = new Date(to);
        if (to.length <= 10) {
          toDate.setHours(23, 59, 59, 999);
        }
        where.occurred_at.lte = toDate;
      }
    }

    if (search) {
      where.OR = [
        { actor_username: { contains: search } },
        { action: { contains: search } },
        { entity_label: { contains: search } },
        { ip_address: { contains: search } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.audit_log.count({ where }),
      prisma.audit_log.findMany({
        where,
        orderBy: { occurred_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const logs: AuditLogRecord[] = rows.map((r) => {
      let parsedDetail: unknown = null;
      if (r.detail) {
        try {
          parsedDetail = JSON.parse(r.detail);
        } catch {
          parsedDetail = r.detail;
        }
      }

      return {
        id: r.audit_log_id.toString(),
        occurredAt: r.occurred_at.toISOString(),
        category: r.category,
        action: r.action,
        actorUserId: r.actor_user_id ? r.actor_user_id.toString() : null,
        actorUsername: r.actor_username,
        actorRole: r.actor_role,
        entityType: r.entity_type,
        entityId: r.entity_id,
        entityLabel: r.entity_label,
        detail: parsedDetail,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
      };
    });

    return apiSuccess({
      logs,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  },
  adminOptions,
);
