export type ToastVariant = "success" | "error" | "warning" | "info";

export type Toast = {
  id: number;
  variant: ToastVariant;
  message: string;
};

/** Beyond this the stack covers the screen; the oldest is dropped. */
export const MAX_VISIBLE_TOASTS = 4;

/** How long each variant stays up. `null` means it waits for the user to dismiss it. */
export const AUTO_DISMISS_MS: Record<ToastVariant, number | null> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: null,
};

export const addToast = (current: Toast[], toast: Toast): Toast[] =>
  [...current, toast].slice(-MAX_VISIBLE_TOASTS);

export const removeToast = (current: Toast[], id: number): Toast[] =>
  current.filter((toast) => toast.id !== id);
