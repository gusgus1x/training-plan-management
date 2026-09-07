"use client";

import styles from "./MaskedUserId.module.css";

/**
 * A SAP UserID in a table cell: hidden until someone asks for it.
 *
 * The id identifies a person, so no screen puts a column of them on display by default - but HRD
 * genuinely needs it (naming certificate files, matching against the HR system), so hiding it
 * behind a click is the balance rather than leaving it out.
 *
 * Same eye-open / eye-closed pair the login password field uses, so the gesture means the same
 * thing everywhere in the app.
 */

/** Sized by whichever container styles it; `.icon` carries a default for use outside a toggle. */
export const EyeOpenIcon = ({ className = styles.icon }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
    <path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeClosedIcon = ({ className = styles.icon }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
    <path d="m3 3 18 18" />
    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.6 10.6 0 0 1 12 4c5.5 0 9 8 9 8a16.3 16.3 0 0 1-2.1 3.2M6.6 6.6C4.3 8.2 3 12 3 12s3.5 8 9 8a9.8 9.8 0 0 0 4-.9" />
  </svg>
);

export const USER_ID_MASK = "••••••••";

export default function MaskedUserId({
  value,
  revealed,
  onToggle,
  isThai,
}: {
  value: string;
  revealed: boolean;
  onToggle: () => void;
  isThai: boolean;
}) {
  const t = (th: string, en: string) => (isThai ? th : en);
  const label = revealed ? t("ซ่อน UserID", "Hide UserID") : t("เปิดดู UserID", "Show UserID");

  // Nothing to hide, and nothing to reveal: an employee record with no UserID (an imported
  // spreadsheet row, say) gets a dash rather than a toggle that would do nothing.
  if (!value) return <span className={styles.masked}>-</span>;

  return (
    <span className={styles.cell}>
      <span
        className={revealed ? styles.value : styles.masked}
        aria-label={revealed ? undefined : t("UserID ถูกซ่อนไว้", "UserID hidden")}
      >
        {revealed ? value : USER_ID_MASK}
      </span>
      <button
        type="button"
        className={styles.toggle}
        onClick={onToggle}
        aria-pressed={revealed}
        aria-label={label}
        title={label}
      >
        {revealed ? <EyeClosedIcon /> : <EyeOpenIcon />}
      </button>
    </span>
  );
}
