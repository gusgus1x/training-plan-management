"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { listEnrollments } from "../../lib/trainingEnrollment/client";
import type { EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import { useUiLanguage } from "../ThaiUiLocalization";
import { Award, Bell, CheckCircle2, ClipboardList, Download, FileText, XCircle } from "../icons/LucideIcons";
import { markDismissed, markSeenInBell, noticeHref, noticeText, unreadCount, type EmployeeNotice } from "./employeeNotices";
import { useEmployeeNotices } from "./useEmployeeNotices";
import styles from "./NotificationBell.module.css";

const renderNoticeIcon = (kind: EmployeeNotice["kind"]) => {
  switch (kind) {
    case "certificate":
      return <Award size={18} />;
    case "record_request_approval":
      return <FileText size={18} style={{ color: "#3b82f6" }} />;
    case "record_request_approved":
      return <CheckCircle2 size={18} style={{ color: "#10b981" }} />;
    case "record_request_rejected":
      return <XCircle size={18} style={{ color: "#ef4444" }} />;
    case "forms":
    default:
      return <ClipboardList size={18} />;
  }
};

/**
 * Every notice, always - unlike the dashboard cards, nothing here retires. The red count is only
 * what has not been looked at in this list yet, and opening the list clears it.
 */
export default function NotificationBell() {
  const router = useRouter();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { notices, state, update } = useEmployeeNotices(enrollments);
  const unread = unreadCount(notices, state);

  useEffect(() => {
    // The server scopes an EMPLOYEE caller to their own enrollments.
    listEnrollments({ planId: null, employeeId: null, employeeUserId: null })
      .then((result) => setEnrollments(result.enrollments || []))
      .catch(() => setEnrollments([]));
  }, []);

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
    }
    setIsOpen(!isOpen);
  };

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
            <span>{notices.length} {t("รายการ", "items")}</span>
          </div>
          {notices.length ? (
            <ul className={styles.list}>
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
