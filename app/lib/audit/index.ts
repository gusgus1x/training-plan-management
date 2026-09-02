import type { Prisma } from "../../generated/prisma/client";
import { getPrismaClient } from "../database/prisma";

/**
 * Retention is decided here, at write time, and stamped onto the row as `retain_until`. That
 * keeps the purge job a single `DELETE ... WHERE retain_until < today` instead of scattering the
 * per-category rules across the writer, the purge script and the admin UI.
 * See docs/admin-and-audit-log-plan.md.
 */
const RETENTION_DAYS = {
  AUTH: 90,
  PII: 730,
  DELETE: 730,
  ACCOUNT: 730,
  EXPORT: 730,
} as const;

export type AuditCategory = keyof typeof RETENTION_DAYS;

export type AuditActor = {
  userId?: string | null;
  username?: string | null;
  role?: string | null;
};

export type AuditEntry = {
  category: AuditCategory;
  action: string;
  actor?: AuditActor;
  entityType?: string;
  entityId?: string;
  /** Name as it read at the time — the row itself may be gone by the time anyone reads this. */
  entityLabel?: string;
  detail?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Only the one call this module makes, so a transaction client, the plain client and a test
 * double are all accepted. Passing a transaction client is what lets a delete and its audit row
 * commit or roll back together.
 */
type AuditClient = {
  audit_log: {
    create(args: { data: Prisma.audit_logUncheckedCreateInput }): Promise<unknown>;
  };
};

const addDays = (from: Date, days: number) =>
  new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

const toBigInt = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const truncate = (value: string | null | undefined, max: number) =>
  value ? value.slice(0, max) : null;

/**
 * Writes one audit row. Deliberately fail-closed: this throws if the insert fails, so a caller
 * inside a transaction rolls its own work back rather than completing unrecorded.
 */
export const recordAudit = async (
  entry: AuditEntry,
  client: AuditClient = getPrismaClient(),
) => {
  const occurredAt = new Date();

  await client.audit_log.create({
    data: {
      occurred_at: occurredAt,
      category: entry.category,
      action: entry.action,
      actor_user_id: toBigInt(entry.actor?.userId),
      actor_username: truncate(entry.actor?.username, 100),
      actor_role: truncate(entry.actor?.role, 30),
      entity_type: truncate(entry.entityType, 60),
      entity_id: truncate(entry.entityId, 50),
      entity_label: truncate(entry.entityLabel, 255),
      detail: entry.detail === undefined ? null : JSON.stringify(entry.detail),
      ip_address: truncate(entry.ipAddress, 45),
      user_agent: truncate(entry.userAgent, 400),
      retain_until: addDays(occurredAt, RETENTION_DAYS[entry.category]),
    },
  });
};

/**
 * For events where losing the log is preferable to failing the user's request — currently only
 * sign-in, where a broken audit table would otherwise lock everyone out of the application.
 */
export const recordAuditQuietly = async (
  entry: AuditEntry,
  client?: AuditClient,
) => {
  try {
    await recordAudit(entry, client);
  } catch (error) {
    console.error("[audit] failed to record", entry.action, error);
  }
};

/** Request metadata for the log; behind a proxy the first x-forwarded-for hop is the client. */
export const auditRequestContext = (request: {
  headers: { get(name: string): string | null };
}) => ({
  ipAddress:
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null,
  userAgent: request.headers.get("user-agent"),
});

/**
 * One-liner for the single-row master-data deletes.
 *
 * Runs after the delete has already committed, so it cannot be fail-closed: throwing here would
 * return 500 for a delete that actually succeeded, and the row would be gone either way. It
 * therefore logs to the console and lets the request succeed.
 *
 * ponytail: post-hoc logging, so an audit-table outage loses these lines. Move the write inside
 * each service's transaction (as cascadeDeleteTrainingPlans does) if that ever matters.
 */
export const recordDeleteAudit = async (
  request: { headers: { get(name: string): string | null } },
  principal: { userId: string; username: string; role: string },
  entityType: string,
  entityId: string,
  entityLabel?: string,
) =>
  recordAuditQuietly({
    category: "DELETE",
    action: `${entityType.toUpperCase()}_DELETED`,
    actor: {
      userId: principal.userId,
      username: principal.username,
      role: principal.role,
    },
    entityType,
    entityId,
    entityLabel,
    ...auditRequestContext(request),
  });

export const AUDIT_RETENTION_DAYS = RETENTION_DAYS;
