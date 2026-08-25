"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  AUTO_DISMISS_MS,
  addToast,
  removeToast,
  type Toast,
  type ToastVariant,
} from "../lib/toastQueue";
import styles from "./ToastHost.module.css";

const TOAST_CHANGE_EVENT = "attg-toast-change";

let toasts: Toast[] = [];
let nextId = 1;

const subscribe = (onStoreChange: () => void) => {
  window.addEventListener(TOAST_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(TOAST_CHANGE_EVENT, onStoreChange);
};

const getSnapshot = () => toasts;
const emptySnapshot: Toast[] = [];
const getServerSnapshot = () => emptySnapshot;

const notify = () => {
  window.dispatchEvent(new Event(TOAST_CHANGE_EVENT));
};

const dismiss = (id: number) => {
  const next = removeToast(toasts, id);
  if (next.length === toasts.length) return;
  toasts = next;
  notify();
};

const push = (variant: ToastVariant, message: string) => {
  const id = nextId++;
  toasts = addToast(toasts, { id, variant, message });
  notify();

  const ttl = AUTO_DISMISS_MS[variant];
  // ponytail: one timer per toast, no pause-on-hover. Add hover-pause only if someone
  // actually complains they cannot finish reading a 4s message.
  if (ttl !== null) window.setTimeout(() => dismiss(id), ttl);
  return id;
};

/**
 * Non-modal Bootstrap-style alerts for reporting what an action did.
 * Use `notice()` from NoticeDialog for what the user must fix before an action can run.
 */
export const useToast = () =>
  useMemo(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
      warning: (message: string) => push("warning", message),
      info: (message: string) => push("info", message),
    }),
    [],
  );

const ICONS: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i",
};

export default function ToastHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const handleDismiss = useCallback((id: number) => dismiss(id), []);

  if (current.length === 0) return null;

  return (
    <div className={styles.stack} aria-live="polite">
      {current.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.variant]}`}
          role={toast.variant === "error" ? "alert" : "status"}
        >
          <span className={styles.icon} aria-hidden="true">
            {ICONS[toast.variant]}
          </span>
          <p className={styles.message}>{toast.message}</p>
          <button
            type="button"
            className={styles.close}
            aria-label="ปิดการแจ้งเตือน (Dismiss)"
            onClick={() => handleDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
