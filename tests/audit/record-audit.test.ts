import { describe, expect, it } from "vitest";
import { AUDIT_RETENTION_DAYS, recordAudit } from "../../app/lib/audit";

const fakeClient = () => {
  const rows: Record<string, unknown>[] = [];
  return {
    rows,
    audit_log: {
      create: async (args: { data: Record<string, unknown> }) => {
        rows.push(args.data);
        return args.data;
      },
    },
  };
};

const daysBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));

describe("recordAudit", () => {
  it("keeps auth events for 90 days and deletes for 2 years", async () => {
    expect(AUDIT_RETENTION_DAYS.AUTH).toBe(90);
    expect(AUDIT_RETENTION_DAYS.DELETE).toBe(730);
    expect(AUDIT_RETENTION_DAYS.PII).toBe(730);

    const client = fakeClient();
    await recordAudit({ category: "AUTH", action: "LOGIN_FAILED" }, client);
    await recordAudit({ category: "DELETE", action: "COURSE_DELETED" }, client);

    const [auth, del] = client.rows;
    expect(daysBetween(auth.occurred_at as Date, auth.retain_until as Date)).toBe(90);
    expect(daysBetween(del.occurred_at as Date, del.retain_until as Date)).toBe(730);
  });

  it("serialises detail to JSON and leaves it null when absent", async () => {
    const client = fakeClient();
    await recordAudit(
      { category: "DELETE", action: "X", detail: { deletedRows: { attendance: 3 } } },
      client,
    );
    await recordAudit({ category: "DELETE", action: "Y" }, client);

    expect(client.rows[0].detail).toBe('{"deletedRows":{"attendance":3}}');
    expect(client.rows[1].detail).toBeNull();
  });

  it("stores a missing actor as null rather than failing", async () => {
    const client = fakeClient();
    await recordAudit({ category: "AUTH", action: "LOGIN_FAILED" }, client);

    expect(client.rows[0].actor_user_id).toBeNull();
    expect(client.rows[0].actor_username).toBeNull();
  });

  it("truncates oversized values to the column widths", async () => {
    const client = fakeClient();
    await recordAudit(
      {
        category: "PII",
        action: "NATIONAL_ID_REVEALED",
        actor: { username: "u".repeat(200) },
        entityLabel: "l".repeat(400),
        userAgent: "a".repeat(900),
      },
      client,
    );

    expect((client.rows[0].actor_username as string).length).toBe(100);
    expect((client.rows[0].entity_label as string).length).toBe(255);
    expect((client.rows[0].user_agent as string).length).toBe(400);
  });

  it("ignores a non-numeric actor id instead of throwing", async () => {
    const client = fakeClient();
    await recordAudit(
      { category: "AUTH", action: "LOGIN_SUCCEEDED", actor: { userId: "preview-hrd-center" } },
      client,
    );

    expect(client.rows[0].actor_user_id).toBeNull();
  });
});
