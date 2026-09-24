"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { NotificationRecord } from "../../lib/notifications/types";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import type { EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import { useUiLanguage } from "../ThaiUiLocalization";
import { Bell, ClipboardList, FileText } from "../icons/LucideIcons";
import { markDismissed, markSeenInBell, noticeHref, noticeText, unreadCount, type EmployeeNotice } from "./employeeNotices";
import { useEmployeeNotices } from "./useEmployeeNotices";
import { useRealtime } from "../useRealtime";
import { storedHref, storedIcon, useStoredNotifications } from "./useStoredNotifications";
import styles from "./NotificationBell.module.css";

const renderNoticeIcon = (kind: EmployeeNotice["kind"]) => {
  switch (kind) {
    case "enrollment_approval":
      return <FileText size={18} style={{ color: "var(--ui-30-primary, #007a3d)" }} />;
    case "record_request_approval":
      return <FileText size={18} style={{ color: "#3b82f6" }} />;
    case "forms":
    default:
      return <ClipboardList size={18} />;
  }
};

/**
 * Two sources in one list: rows the server wrote when something happened (the notification
 * table, read state kept there), then the to-dos worked out from the employee's own records.
 *
 * Every notice, always - unlike the dashboard cards, nothing here retires. The red count is only
 * what has not been looked at in this list yet, and opening the list clears it.
 */
export default function NotificationBell() {
  const router = useRouter();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [enrollmentsVersion, setEnrollmentsVersion] = useState(0);
  useRealtime(["enrollment.changed", "plan.changed"], () => setEnrollmentsVersion((current) => current + 1), { debounceMs: 1000 });
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { rows: stored, markRead } = useStoredNotifications();
  const { notices, state, update } = useEmployeeNotices(enrollments);
  const storedUnread = stored.filter((row) => !row.isRead).length;
  const unread = unreadCount(notices, state) + storedUnread;

  useEffect(() => {
    // The server scopes an EMPLOYEE caller to their own enrollments.
    listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then((result) => setEnrollments(result.enrollments || []))
      .catch(() => setEnrollments([]));
  }, [enrollmentsVersion]);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen]);

  const toggle = () => {
    if (!isOpen && unread) {
      update((current) => markSeenInBell(current, notices));
      // Opening the list clears the count, same as the to-dos.
      if (storedUnread) markRead();
    }
    setIsOpen(!isOpen);
  };

  const openStored = (row: NotificationRecord) => {
    setIsOpen(false);
    const href = storedHref(row);
    if (href) router.push(href);
  };

  const total = stored.length + notices.length;
  const formatWhen = (iso: string) =>
    new Date(iso).toLocaleString(isThai ? "th-TH" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const open = (notice: EmployeeNotice) => {
    // Read here counts as read on the dashboard too.
    update((current) => markDismissed(current, notice.id));
    setIsOpen(false);
    router.push(noticeHref(notice));
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={toggle}
        aria-expanded={isOpen}
        aria-label={unread ? t(`การแจ้งเตือน ${unread} รายการใหม่`, `${unread} new notifications`) : t("การแจ้งเตือน", "Notifications")}
      >
        <Bell size={20} />
        {unread ? <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span> : null}
      </button>

      {isOpen ? (
        <div className={styles.panel} role="dialog" aria-label={t("การแจ้งเตือน", "Notifications")}>
          <div className={styles.panelHeader}>
            <strong>{t("การแจ้งเตือน", "Notifications")}</strong>
            <span>{total} {t("รายการ", "items")}</span>
          </div>
          {total ? (
            <ul className={styles.list}>
              {stored.map((row) => (
                <li key={`stored:${row.notificationId}`}>
                  <button type="button" className={styles.item} data-kind="stored" onClick={() => openStored(row)}>
                    <span className={styles.itemIcon} aria-hidden="true">
                      {storedIcon(row.relatedType, 18)}
                    </span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemEyebrow}>{formatWhen(row.createdAt)}</span>
                      <span className={styles.itemTitle}>{row.title}</span>
                      <span className={styles.itemDetail}>{row.message}</span>
                    </span>
                  </button>
                </li>
              ))}
              {notices.map((notice) => {
                const text = noticeText(notice, isThai);
                return (
                  <li key={notice.id}>
                    <button type="button" className={styles.item} data-kind={notice.kind} onClick={() => open(notice)}>
                      <span className={styles.itemIcon} aria-hidden="true">
                        {renderNoticeIcon(notice.kind)}
                      </span>
                      <span className={styles.itemBody}>
                        <span className={styles.itemEyebrow}>{text.eyebrow}</span>
                        <span className={styles.itemTitle}>{text.title}</span>
                        <span className={styles.itemDetail}>{text.detail}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.empty}>{t("ยังไม่มีการแจ้งเตือน", "No notifications yet")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
