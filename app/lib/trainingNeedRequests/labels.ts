import type { UiLanguage } from "../../components/ThaiUiLocalization";
import type { NeedRequestStatus } from "./types";

/**
 * The database stores PENDING / APPROVED / REJECTED / PLANNED. Both screens read the same labels
 * from here so an employee and the HRD reviewing them never see the same request described
 * differently.
 */
const LABELS: Record<NeedRequestStatus, { th: string; en: string }> = {
  PENDING: { th: "รอตรวจสอบ", en: "Pending" },
  APPROVED: { th: "อนุมัติแล้ว", en: "Approved" },
  REJECTED: { th: "ไม่อนุมัติ", en: "Rejected" },
  PLANNED: { th: "บรรจุในแผนแล้ว", en: "Planned" },
};

export const needRequestStatusLabel = (status: NeedRequestStatus, language: UiLanguage) =>
  LABELS[status]?.[language === "th" ? "th" : "en"] ?? status;

export const NEED_REQUEST_STATUSES = Object.keys(LABELS) as NeedRequestStatus[];
