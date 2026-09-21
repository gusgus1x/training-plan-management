import type { NotificationListResponse } from "./types";

export const listNotifications = async (): Promise<NotificationListResponse> => {
  try {
    const res = await fetch("/api/notifications", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      return { notifications: [], unreadCount: 0 };
    }
    const json = await res.json();
    if (json.ok && json.data) {
      return json.data;
    }
    return { notifications: [], unreadCount: 0 };
  } catch {
    return { notifications: [], unreadCount: 0 };
  }
};

export const markNotificationsAsRead = async (options?: {
  notificationId?: string;
  markAllRead?: boolean;
}): Promise<void> => {
  try {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(options || { markAllRead: true }),
    });
  } catch {
    // Ignore transient network errors
  }
};
