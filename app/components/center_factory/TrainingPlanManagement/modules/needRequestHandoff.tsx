"use client";

import { createEnrollment, EnrollmentApiError } from "../../../../lib/trainingEnrollment/client";
import { listNeedRequests, updateNeedRequest } from "../../../../lib/trainingNeedRequests/client";
import type { NeedRequestRecord } from "../../../../lib/trainingNeedRequests/types";
import type { useConfirm } from "../../../ConfirmDialog";
import styles from "./TrainingRolling.module.css";

/**
 * Approved training need requests travelling from Request Training Need to Training Rolling (and
 * through Training OAP when the course has no plan yet). The ids ride in the address -
 * `?needRequestIds=1,2,3` - so the hand-off survives a reload and works in any browser.
 */

export const readNeedRequestIds = () => {
  if (typeof window === "undefined") return [];
  const raw = new URLSearchParams(window.location.search).get("needRequestIds") ?? "";
  return raw.split(",").map((id) => id.trim()).filter((id) => /^\d+$/.test(id));
};

export const needRequestQuery = (ids: string[]) => (ids.length ? `?needRequestIds=${ids.join(",")}` : "");

/** Loads the named requests that are still approved and waiting for a batch. */
export const loadHandoffRequests = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const { needRequests } = await listNeedRequests({ status: "APPROVED" });
  return needRequests.filter((request) => ids.includes(request.id));
};

/** "[SY-000002] Excel (Refresher)" names its course by code; a typed topic usually does not. */
export const courseCodeInRequest = (name: string) => name.match(/\[([A-Za-z0-9_-]+)\]/)?.[1] ?? null;

type Confirm = ReturnType<typeof useConfirm>;

export type HandoffOutcome = {
  linked: number;
  skipped: string[];
  failed: Array<{ name: string; message: string }>;
};

/**
 * Puts each requester into the batch, then marks their request planned against it. Uses the
 * ordinary enrollment rules - target match, company scope, and the prerequisite prompt HRD
 * already sees on the other screens - one person at a time, so one refusal does not stop the rest.
 * Someone already enrolled in the batch is only linked.
 */
export const enrollAndLink = async (
  requests: NeedRequestRecord[],
  planId: string,
  source: "HRD_CENTER" | "HRD_FACTORY",
  confirm: Confirm,
): Promise<HandoffOutcome> => {
  const outcome: HandoffOutcome = { linked: 0, skipped: [], failed: [] };
  for (const request of requests) {
    const label = `${request.employeeName} (${request.employeeCode})`;
    // employeeId is still a required field on this route; the user_id travels in both and the
    // repository resolves by employeeUserId whenever it is present.
    const input = { planId, employeeId: request.employeeUserId, employeeUserId: request.employeeUserId, source };
    try {
      try {
        await createEnrollment(input);
      } catch (error) {
        if (error instanceof EnrollmentApiError && error.code === "RESOURCE_CONFLICT") {
          // Already in this batch: nothing to add, the link still stands.
        } else if (error instanceof EnrollmentApiError && error.code === "PREREQUISITE_NOT_MET") {
          const details = error.details as { missingCourseNames?: string } | undefined;
          const missing = (details?.missingCourseNames || "").split(",").filter(Boolean).join(", ");
          const ok = await confirm({
            title: { th: "ยังไม่ผ่านหลักสูตรก่อนหน้า", en: "Prerequisite not completed" },
            message: {
              th: `${label} ยังไม่ผ่านการอบรมหลักสูตร ${missing}\nยืนยันที่จะเพิ่มเข้ารุ่นนี้หรือไม่?`,
              en: `${label} has not completed ${missing}. Add them anyway?`,
            },
            confirmLabel: { th: "ยืนยันให้เพิ่ม", en: "Add anyway" },
            cancelLabel: { th: "ข้ามคนนี้", en: "Skip" },
            danger: true,
          });
          if (!ok) {
            outcome.skipped.push(label);
            continue;
          }
          await createEnrollment({ ...input, acknowledgePrerequisite: true });
        } else {
          throw error;
        }
      }
      await updateNeedRequest(request.id, { action: "link", planId });
      outcome.linked += 1;
    } catch (error) {
      outcome.failed.push({ name: label, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return outcome;
};

type PanelProps = {
  requests: NeedRequestRecord[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  sessionLabels: string[];
  targetSession: number;
  onTargetSession: (index: number) => void;
  /** The chosen OAP's owning company code, or null for a central plan. */
  planCompanyCode: string | null;
  onCreateOap: () => void;
  isThai: boolean;
};

/** The requests attached to this batch form: who gets enrolled and linked when it is saved. */
export function NeedRequestAttachPanel({
  requests,
  checkedIds,
  onToggle,
  sessionLabels,
  targetSession,
  onTargetSession,
  planCompanyCode,
  onCreateOap,
  isThai,
}: PanelProps) {
  const t = (th: string, en: string) => (isThai ? th : en);
  return (
    <div className={`${styles.fullField} ${styles.needRequestPanel}`}>
      <div className={styles.sectionHeader}>
        <div>
          <strong>{t(`คำขออบรมที่แนบมา (${requests.length})`, `Attached training requests (${requests.length})`)}</strong>
          <span>
            {t(
              "บันทึกแล้ว คนที่ติ๊กจะถูกลงชื่อเข้ารุ่นที่เลือก และคำขอเปลี่ยนเป็น \"บรรจุในแผนแล้ว\"",
              "On save, ticked people are enrolled in the chosen session and their requests become Planned.",
            )}
          </span>
        </div>
        <button className={styles.addSessionButton} type="button" onClick={onCreateOap}>
          {t("ยังไม่มีแผน OAP ของหลักสูตรนี้? สร้างแผน OAP", "No OAP for this course? Create one")}
        </button>
      </div>
      {sessionLabels.length > 1 ? (
        <label className={styles.needRequestTarget}>
          {t("ลงชื่อเข้ารุ่น", "Enrol into session")}
          <select value={targetSession} onChange={(event) => onTargetSession(Number(event.target.value))}>
            {sessionLabels.map((label, index) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {requests.length === 0 ? (
        <p className={styles.needRequestNote}>
          {t("คำขอที่แนบมาถูกจัดรุ่นไปแล้ว หรือยังไม่ได้รับอนุมัติ", "The attached requests are already planned or not approved.")}
        </p>
      ) : (
        <ul className={styles.needRequestList}>
          {requests.map((request) => {
            // A company batch only takes that company's people; the server refuses the rest anyway.
            const wrongCompany = planCompanyCode !== null && request.companyCode !== planCompanyCode;
            return (
              <li key={request.id}>
                <label title={wrongCompany ? t("แผนของบริษัทอื่น รับคนต่างบริษัทไม่ได้", "A company plan only takes its own people") : undefined}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(request.id) && !wrongCompany}
                    disabled={wrongCompany}
                    onChange={() => onToggle(request.id)}
                  />
                  <strong>{request.employeeName}</strong>
                  <span>
                    {request.employeeCode} · {request.companyCode} · {request.requestNo} · {request.requestedCourseName}
                  </span>
                  {wrongCompany ? <em>{t("ต่างบริษัท", "Other company")}</em> : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
