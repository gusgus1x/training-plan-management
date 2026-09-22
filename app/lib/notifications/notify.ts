import type { PrismaClient } from "../../generated/prisma/client";

export type NotificationPayload = {
  title: string;
  message: string;
  /** What the row is about, so the bell knows where a click should land. */
  relatedType: string;
  relatedId: bigint | null;
};

type NotifyClient = Pick<PrismaClient, "user_account" | "notification">;

/**
 * Writes one notification row per login account of each employee named. Recipients are people
 * (employee.user_id), because that is what every workflow table stores; the account ids are looked
 * up here so no caller has to.
 *
 * Never throws: the action that caused the news has already happened, and failing it now because
 * the bell could not be told would leave the person with neither. That is why the wording comes as
 * a function - building it reads the saved row, and a surprise there is caught here too. Pass the
 * repository's own client so a test double never reaches the real database from here.
 */
export const notifyEmployees = async (
  db: NotifyClient,
  employeeUserIds: Array<string | null | undefined>,
  build: () => NotificationPayload,
) => {
  const people = [...new Set(employeeUserIds.filter((id): id is string => Boolean(id)))];
  if (!people.length) return;
  let payload: NotificationPayload | null = null;
  try {
    payload = build();
    const accounts = await db.user_account.findMany({
      where: { employee_user_id: { in: people }, status: "ACTIVE" },
      select: { user_id: true },
    });
    if (!accounts.length) return;
    const { title, message, relatedType, relatedId } = payload;
    await db.notification.createMany({
      data: accounts.map((account) => ({
        user_id: account.user_id,
        title: title.slice(0, 255),
        message,
        related_type: relatedType,
        related_id: relatedId,
      })),
    });
  } catch (error) {
    console.warn(`Could not write ${payload?.relatedType ?? "a"} notification:`, error);
  }
};
