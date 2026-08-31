/**
 * Shown on controls whose UI is finished but whose backend is not.
 *
 * Each of these used to run and report success — a toast saying the LINE message was sent, the
 * courses were imported, the file was downloaded — while writing nothing anywhere. Disabling them
 * and saying why is honest; the screens stay exactly where they are, ready for the backend.
 *
 * Kept in one place so every such control says the same thing instead of each screen inventing its
 * own wording.
 */
export const UNDER_DEVELOPMENT = {
  th: "อยู่ระหว่างพัฒนา ยังใช้งานไม่ได้",
  en: "Under development, not available yet",
} as const;
