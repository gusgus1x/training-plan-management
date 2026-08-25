"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buildMissingFieldsMessage } from "../lib/validationNotice";
import styles from "./ConfirmDialog.module.css";

export type NoticeOptions = {
  title?: string;
  /** Free-form body. Ignored when `missingFields` is given. */
  message?: string;
  /** Required fields the user left empty — renders the standard bilingual message. */
  missingFields?: string[];
  okLabel?: string;
};

type PendingNotice = {
  options: NoticeOptions;
  resolve: () => void;
};

const NOTICE_CHANGE_EVENT = "attg-notice-change";
let pending: PendingNotice | null = null;

const subscribe = (onStoreChange: () => void) => {
  window.addEventListener(NOTICE_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(NOTICE_CHANGE_EVENT, onStoreChange);
};

const getSnapshot = () => pending;
const getServerSnapshot = () => null;

const notify = () => {
  window.dispatchEvent(new Event(NOTICE_CHANGE_EVENT));
};

// ponytail: own pending slot and own <dialog>, deliberately NOT shared with ConfirmDialog.
// Sharing that module's single `pending` slot would let a notice overwrite an awaiting
// confirm() and leave its promise unresolved forever.
export const useNotice = () => {
  return useCallback((options: NoticeOptions) => {
    return new Promise<void>((resolve) => {
      // A notice replacing a notice is harmless — resolve the old one so no caller hangs.
      pending?.resolve();
      pending = { options, resolve };
      notify();
    });
  }, []);
};

const resolvePending = () => {
  if (!pending) return;
  const { resolve } = pending;
  pending = null;
  notify();
  resolve();
};

const resolveText = (options: NoticeOptions) => {
  if (options.missingFields) {
    const built = buildMissingFieldsMessage(options.missingFields);
    return { title: options.title ?? built.title, message: built.message };
  }
  return { title: options.title, message: options.message ?? "" };
};

export default function NoticeDialogHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [displayOptions, setDisplayOptions] = useState<NoticeOptions | null>(null);

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

  const text = displayOptions ? resolveText(displayOptions) : null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        resolvePending();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          resolvePending();
        }
      }}
    >
      {text ? (
        <div className={styles.panel}>
          {text.title ? <h2 className={styles.title}>{text.title}</h2> : null}
          <p className={styles.message}>{text.message}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.confirmButton} onClick={() => resolvePending()}>
              {displayOptions?.okLabel ?? "ตกลง / OK"}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
