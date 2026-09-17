import type { UiLanguage } from "../../components/ThaiUiLocalization";
import type { NeedRequestStage, NeedRequestStatus } from "./types";

/**
 * Both screens read the same labels from here so an employee, their head and the HRD reviewing
 * them never see the same request described differently.
 */
const LABELS: Record<NeedRequestStatus, { th: string; en: string }> = {
  PENDING: { th: "รอพิจารณา", en: "Pending" },
  APPROVED: { th: "อนุมัติแล้ว", en: "Approved" },
  REJECTED: { th: "ไม่อนุมัติ", en: "Rejected" },
  PLANNED: { th: "จัดเข้ารุ่นแล้ว", en: "Planned" },
};

const STAGE_LABELS: Record<NeedRequestStage, { th: string; en: string }> = {
  WAITING_HEAD: { th: "รอหัวหน้าอนุมัติ", en: "Waiting for section head" },
  WAITING_HRD: { th: "รอ HRD พิจารณา", en: "Waiting for HRD" },
  REJECTED_BY_HEAD: { th: "หัวหน้าไม่อนุมัติ", en: "Rejected by section head" },
  REJECTED: { th: "HRD ไม่อนุมัติ", en: "Rejected by HRD" },
  APPROVED: { th: "อนุมัติแล้ว รอจัดรุ่น", en: "Approved, awaiting a batch" },
  PLANNED: { th: "จัดเข้ารุ่นแล้ว", en: "Planned" },
};

const pick = (entry: { th: string; en: string } | undefined, language: UiLanguage, fallback: string) =>
  entry?.[language === "th" ? "th" : "en"] ?? fallback;

export const needRequestStatusLabel = (status: NeedRequestStatus, language: UiLanguage) =>
  pick(LABELS[status], language, status);

export const needRequestStageLabel = (stage: NeedRequestStage, language: UiLanguage) =>
  pick(STAGE_LABELS[stage], language, stage);

export const NEED_REQUEST_STATUSES = Object.keys(LABELS) as NeedRequestStatus[];

/**
 * HRD's ready-made rejection reasons. The last one points the employee at Register Train, and the
 * employee screen offers a button there when a rejection reason is exactly that text.
 */
export const HRD_REJECT_REASONS = [
  { key: "closed", th: "คอร์สนี้ปิดรับแล้ว กรุณารอรอบปีหน้าเมื่อมีประกาศ", en: "This course is closed. Please wait for next year's announcement." },
  { key: "upcoming", th: "คอร์สนี้กำลังจะจัดภายใน 1-3 เดือนข้างหน้า กรุณารอดูประกาศ", en: "This course runs within the next 1-3 months. Please watch for the announcement." },
  { key: "register", th: "คอร์สนี้เปิดรับสมัครแล้ว สมัครได้ที่เมนู Register Train", en: "This course is open for registration. Apply in Register Train." },
] as const;

const REGISTER_REASONS: readonly string[] = [HRD_REJECT_REASONS[2].th, HRD_REJECT_REASONS[2].en];

export const pointsToRegisterTrain = (rejectionReason: string) => REGISTER_REASONS.includes(rejectionReason.trim());
