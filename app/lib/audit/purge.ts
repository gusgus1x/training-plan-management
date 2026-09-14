import { getPrismaClient } from "../database/prisma";

let lastPurgeCheck = 0;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Purges audit logs whose retention period has expired.
 * Matches rows where `retain_until < today` (at midnight).
 * Returns the number of deleted records.
 */
export async function purgeExpiredAuditLogs(): Promise<number> {
  const prisma = getPrismaClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  try {
    const result = await prisma.audit_log.deleteMany({
      where: {
        retain_until: {
          lt: startOfToday,
        },
      },
    });

    if (result.count > 0) {
      console.log(
        `[Audit Log Auto-Purge] Automatically deleted ${result.count} expired audit logs (retain_until < ${startOfToday.toISOString().slice(0, 10)}).`
      );
    }
    return result.count;
  } catch (error) {
    console.error("[Audit Log Auto-Purge Error]:", error);
    return 0;
  }
}

/**
 * Throttled trigger for automatic maintenance:
 * Checks at most once every 24 hours.
 * Runs non-blocking in the background so it never slows down user requests.
 */
export function triggerAuditPurgeIfDue(): void {
  const now = Date.now();
  if (now - lastPurgeCheck < ONE_DAY_MS) {
    return;
  }
  lastPurgeCheck = now;

  // Execute asynchronously in background
  void purgeExpiredAuditLogs();
}
