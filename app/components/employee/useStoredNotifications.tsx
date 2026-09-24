"use client";

import { useCallback, useEffect, useState } from "react";
import { listNotifications, markNotificationsAsRead } from "../../lib/notifications/client";
import type { NotificationRecord } from "../../lib/notifications/types";
import { useRealtime } from "../useRealtime";
import { Award, Bell, CheckCircle2, FileText, XCircle } from "../icons/LucideIcons";

export const storedIcon = (type: string | null, size: number) => {
  if (!type) return <Bell size={size} />;
  if (type === "CERTIFICATE_ISSUED") return <Award size={size} />;
  if (/REJECTED|CANCELLED/.test(type)) return <XCircle size={size} style={{ color: "#ef4444" }} />;
  if (/APPROVED|PLANNED/.test(type)) return <CheckCircle2 size={size} style={{ color: "#10b981" }} />;
  return <FileText size={size} style={{ color: "#3b82f6" }} />;
};

/** Fired after a mark-read so the bell and the dashboard cards, each holding a copy, both refetch. */
const STORED_EVENT = "stored-notifications-change";

/**
 * "Something waits for your approval" rows. The approver's to-do is worked out from the pending
 * requests themselves (employeeNotices) and goes away once decided; the stored copy would linger,
 * so these stay out of the list. Their decisions are news and do show.
 */
const TO_DO_TYPES = new Set(["TRAINING_RECORD_REQUEST", "TRAINING_ENROLLMENT"]);

/**
 * What the server wrote when something happened to this person, with read state kept in the
 * database - so reading it on one device reads it everywhere.
 */
export function useStoredNotifications() {
  const [rows, setRows] = useState<NotificationRecord[]>([]);
  // Bumped when the server says a notification was written, so the list below reloads.
  const [version, setVersion] = useState(0);
  useRealtime(["notification.created"], () => setVersion((current) => current + 1));

  useEffect(() => {
    let alive = true;
    const load = () =>
      listNotifications()
        .then((result) => {
          if (alive) setRows((result.notifications || []).filter((row) => !TO_DO_TYPES.has(row.relatedType ?? "")));
        })
        .catch(() => {});
    load();
    window.addEventListener(STORED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(STORED_EVENT, load);
    };
  }, [version]);

  /** No ids marks every unread row read. */
  const markRead = useCallback((ids?: string[]) => {
    const hit = (row: NotificationRecord) => !ids || ids.includes(row.notificationId);
    setRows((current) => current.map((row) => (hit(row) ? { ...row, isRead: true } : row)));
    // The route marks one row or all of them; a handful of ids is a handful of calls.
    const done = ids
      ? Promise.all(ids.map((notificationId) => markNotificationsAsRead({ notificationId })))
      : markNotificationsAsRead({ markAllRead: true });
    void done.then(() => window.dispatchEvent(new Event(STORED_EVENT)));
  }, []);

  return { rows, markRead };
}

/** Where a row lands when opened. Types with nowhere useful to go return null. */
export const storedHref = (row: NotificationRecord, now = Date.now()) => {
  const type = row.relatedType ?? "";
  const id = row.relatedId ? encodeURIComponent(row.relatedId) : null;
  if (type.startsWith("NEED_REQUEST_")) return `/?module=request&at=${now}`;
  if (type === "TRAINING_RECORD_REQUEST_APPROVED" && id) return `/?module=record&tab=download&downloadReq=${id}&at=${now}`;
  if (type === "TRAINING_RECORD_REQUEST_REJECTED" && id) return `/?module=record&tab=download&focusRequest=${id}&at=${now}`;
  // related_id is the certificate file (the dashboard card previews it), not the enrollment.
  if (type === "CERTIFICATE_ISSUED") return `/?module=record&tab=completed&at=${now}`;
  if (type.startsWith("ENROLLMENT_") && id) return `/?module=record&tab=pending&focus=${id}&at=${now}`;
  if (type.startsWith("PLAN_") || type === "REVIEWER_ASSIGNED") return `/?module=record&at=${now}`;
  return null;
};
