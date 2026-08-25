"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useUiLanguage, type UiLanguage } from "./ThaiUiLocalization";
import styles from "./ConfirmDialog.module.css";

/**
 * Text the DOM localizer cannot reach: these strings are built at call time (often with a
 * record code in them), so they never match a dictionary key. Pass both languages and the
 * dialog picks one — a plain string is still accepted for text that needs no translation.
 */
export type LocalizedText = string | { th: string; en: string };

export const pickText = (text: LocalizedText, language: UiLanguage) =>
  typeof text === "string" ? text : text[language];

export type ConfirmOptions = {
  title?: LocalizedText;
  message: LocalizedText;
  confirmLabel?: LocalizedText;
  cancelLabel?: LocalizedText;
  danger?: boolean;
};

type PendingConfirm = {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
};

const CONFIRM_CHANGE_EVENT = "attg-confirm-change";
let pending: PendingConfirm | null = null;

const subscribe = (onStoreChange: () => void) => {
  window.addEventListener(CONFIRM_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(CONFIRM_CHANGE_EVENT, onStoreChange);
};

const getSnapshot = () => pending;
const getServerSnapshot = () => null;

const notify = () => {
  window.dispatchEvent(new Event(CONFIRM_CHANGE_EVENT));
};

// ponytail: single global pending slot, not a queue — these are always triggered by one user
// click at a time in a single-page-at-a-time UI. Upgrade to a queue only if concurrent confirm()
// calls become a real problem.
export const useConfirm = () => {
  return useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      pending = { options, resolve };
      notify();
    });
  }, []);
};

const resolvePending = (result: boolean) => {
  if (!pending) return;
  const { resolve } = pending;
  pending = null;
  notify();
  resolve(result);
};

export default function ConfirmDialogHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { language } = useUiLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [displayOptions, setDisplayOptions] = useState<ConfirmOptions | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (current) {
      setDisplayOptions(current.options);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [current]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        resolvePending(false);
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          resolvePending(false);
        }
      }}
    >
      {displayOptions ? (
        <div className={styles.panel}>
          {displayOptions.title ? (
            <h2 className={styles.title}>{pickText(displayOptions.title, language)}</h2>
          ) : null}
          <p className={styles.message}>{pickText(displayOptions.message, language)}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={() => resolvePending(false)}>
              {pickText(displayOptions.cancelLabel ?? { th: "ยกเลิก", en: "Cancel" }, language)}
            </button>
            <button
              type="button"
              className={displayOptions.danger ? styles.dangerButton : styles.confirmButton}
              onClick={() => resolvePending(true)}
            >
              {pickText(displayOptions.confirmLabel ?? { th: "ยืนยัน", en: "Confirm" }, language)}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
