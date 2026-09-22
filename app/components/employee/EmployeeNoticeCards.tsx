"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { certificateFileUrl } from "../../lib/certificates/client";
import type { NotificationRecord } from "../../lib/notifications/types";
import type { EnrollmentRecord } from "../../lib/trainingEnrollment/types";
import { useUiLanguage } from "../ThaiUiLocalization";
import { Bell, ChevronRight, ClipboardList, FileText, X } from "../icons/LucideIcons";
import {
  isShownOnDashboard,
  markDismissed,
  markSnoozed,
  noticeHref,
  noticeText,
  type EmployeeNotice,
} from "./employeeNotices";
import { useEmployeeNotices } from "./useEmployeeNotices";
import { storedHref, storedIcon, useStoredNotifications } from "./useStoredNotifications";
import styles from "./EmployeeNoticeCards.module.css";

const renderCardIcon = (kind: EmployeeNotice["kind"], size: number) => {
  switch (kind) {
    case "enrollment_approval":
      return <FileText size={size} style={{ color: "var(--ui-30-primary, #007a3d)" }} />;
    case "record_request_approval":
      return <FileText size={size} style={{ color: "#3b82f6" }} />;
    case "forms":
    default:
      return <ClipboardList size={size} />;
  }
};

/** Once per browser session per employee: coming back to the dashboard home should not throw the
 *  popup up again, but the next person to log in on the same tab must still get theirs. */
const popupSessionKey = (userKey: string) => `employee-notices-popup-shown:${userKey}`;
const popupAlreadyShown = (userKey: string | null) => {
  if (!userKey) return false;
  try {
    return window.sessionStorage.getItem(popupSessionKey(userKey)) === "1";
  } catch {
    return false;
  }
};

/** The dashboard's news: a popup on arrival, and the same notices as cards on the page. */
export default function EmployeeNoticeCards({ enrollments }: { enrollments: EnrollmentRecord[] }) {
  const router = useRouter();
  const { language } = useUiLanguage();
  const isThai = language === "th";
  const t = (th: string, en: string) => (isThai ? th : en);
  const { notices, state, update, userKey } = useEmployeeNotices(enrollments);
  const { rows, markRead } = useStoredNotifications();
  // Read once per mount: a card expiring mid-visit can wait for the next page load.
  const [now] = useState(Date.now);
  // Keyed by employee, so a different login never inherits someone else's "closed".
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const [neverAgain, setNeverAgain] = useState(false);
  const visible = notices.filter((notice) => isShownOnDashboard(state[notice.id], now));
  // News stays on the dashboard until it has been read, here or in the bell, on any device.
  const unreadStored = rows.filter((row) => !row.isRead);
  const count = visible.length + unreadStored.length;
  const popupClosed = !userKey || closedFor === userKey || popupAlreadyShown(userKey);
  const popupOpen = !popupClosed && count > 0;

  const closePopup = () => {
    // "Don't show again" covers what the popup was showing; the cards below go with it.
    if (neverAgain) {
      update((current) => visible.reduce((next, notice) => markDismissed(next, notice.id), current));
      if (unreadStored.length) markRead(unreadStored.map((row) => row.notificationId));
    }
    try {
      if (userKey) window.sessionStorage.setItem(popupSessionKey(userKey), "1");
    } catch {
      // Without sessionStorage the popup simply shows again on the next visit.
    }
    setClosedFor(userKey);
  };

  useEffect(() => {
    if (!popupOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePopup();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!count) return null;

  const open = (notice: EmployeeNotice) => {
    // Opening it is reading it.
    update((current) => markDismissed(current, notice.id));
    setClosedFor(userKey);
    router.push(noticeHref(notice));
  };

  const openStored = (row: NotificationRecord) => {
    markRead([row.notificationId]);
    setClosedFor(userKey);
    const href = storedHref(row);
    if (href) router.push(href);
  };

  const closeLabel = t("ปิด (แสดงอีกครั้งพรุ่งนี้)", "Close (shows again tomorrow)");
  const readLabel = t("ปิด (อ่านแล้ว)", "Close (mark as read)");

  const renderStoredCard = (row: NotificationRecord, withClose: boolean) => (
    <article key={`stored:${row.notificationId}`} className={styles.card} data-kind="stored">
      <button type="button" className={styles.main} onClick={() => openStored(row)}>
        {row.relatedType === "CERTIFICATE_ISSUED" && row.relatedId ? (
          <span className={styles.thumb} aria-hidden="true">
            {/* The real PDF scaled down; the button owns the click, so the frame ignores it. */}
            <iframe src={certificateFileUrl(row.relatedId)} title={row.title} tabIndex={-1} />
          </span>
        ) : (
          <span className={styles.icon} aria-hidden="true">
            {storedIcon(row.relatedType, 22)}
          </span>
        )}
        <span className={styles.body}>
          <span className={styles.eyebrow}>
            {storedIcon(row.relatedType, 14)}
            {new Date(row.createdAt).toLocaleString(isThai ? "th-TH" : "en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <strong className={styles.title}>{row.title}</strong>
          <span className={styles.detail}>{row.message}</span>
        </span>
        <ChevronRight className={styles.chevron} size={20} aria-hidden="true" />
      </button>
      {withClose ? (
        // News has no "tomorrow": closing it is reading it.
        <button type="button" className={styles.close} onClick={() => markRead([row.notificationId])} aria-label={readLabel} title={readLabel}>
          <X size={16} />
        </button>
      ) : null}
    </article>
  );

  const renderCard = (notice: EmployeeNotice, withClose: boolean) => {
    const text = noticeText(notice, isThai);
    return (
      <article key={notice.id} className={styles.card} data-kind={notice.kind}>
        <button type="button" className={styles.main} onClick={() => open(notice)}>
          <span className={styles.icon} aria-hidden="true">
            {renderCardIcon(notice.kind, 22)}
          </span>
          <span className={styles.body}>
            <span className={styles.eyebrow}>
              {renderCardIcon(notice.kind, 14)}
              {text.eyebrow}
            </span>
            <strong className={styles.title}>{text.title}</strong>
            <span className={styles.detail}>{text.detail}</span>
          </span>
          <ChevronRight className={styles.chevron} size={20} aria-hidden="true" />
        </button>
        {withClose ? (
          <button
            type="button"
            className={styles.close}
            onClick={() => update((current) => markSnoozed(current, notice.id))}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <X size={16} />
          </button>
        ) : null}
      </article>
    );
  };

  return (
    <>
      <section className={styles.stack} aria-label={t("การแจ้งเตือน", "Notifications")}>
        {unreadStored.map((row) => renderStoredCard(row, true))}
        {visible.map((notice) => renderCard(notice, true))}
      </section>

      {popupOpen ? (
        <div className={styles.overlay} onClick={closePopup}>
          <div
            className={styles.popup}
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-notice-popup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.popupHeader}>
              <span className={styles.popupBell} aria-hidden="true">
                <Bell size={22} />
              </span>
              <div>
                <h2 id="employee-notice-popup-title">{t("มีข้อมูลใหม่สำหรับคุณ", "Something new for you")}</h2>
                <p>{t(`${count} รายการ · กดที่รายการเพื่อดูรายละเอียด`, `${count} items · tap one to see it`)}</p>
              </div>
            </div>
            <div className={styles.popupList}>
              {unreadStored.map((row) => renderStoredCard(row, false))}
              {visible.map((notice) => renderCard(notice, false))}
            </div>
            <div className={styles.popupFooter}>
              <label className={styles.never}>
                <input type="checkbox" checked={neverAgain} onChange={(event) => setNeverAgain(event.target.checked)} />
                {t("ไม่ต้องแสดงข้อมูลนี้อีก", "Don't show this again")}
              </label>
              <button type="button" className={styles.okButton} onClick={closePopup} autoFocus>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
